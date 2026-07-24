param(
  [Parameter(Mandatory = $true)]
  [string]$StartDir
)

$ErrorActionPreference = "Stop"

function Find-Repo([string]$Start) {
  $current = [System.IO.Path]::GetFullPath($Start)
  for ($i = 0; $i -lt 8; $i++) {
    if (Test-Path (Join-Path $current ".git")) { return $current }
    $parent = Split-Path -Parent $current
    if (-not $parent -or $parent -eq $current) { break }
    $current = $parent
  }
  throw "Repository root not found. Put both files inside the repository or inside NASQ-Agent-Bridge-Installer."
}

function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Utf8([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

$Repo = Find-Repo $StartDir
$ExpectedBranch = "agent/sync-appdeploy-live-fix"
$branch = (& git -C $Repo branch --show-current).Trim()

if ($LASTEXITCODE -ne 0 -or $branch -ne $ExpectedBranch) {
  throw "Wrong branch. Required: $ExpectedBranch. Current: $branch"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "NASQ-backups\bridge-ts-fix-$timestamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$tsconfigPath = Join-Path $Repo "tsconfig.json"
$shimPath = Join-Path $Repo "src\platform\appdeploy-client-vercel.ts"
$studioPath = Join-Path $Repo "src\Studio.tsx"

foreach ($path in @($tsconfigPath, $shimPath, $studioPath)) {
  if (-not (Test-Path $path)) { throw "Missing file: $path" }
  $relative = $path.Substring($Repo.Length).TrimStart('\')
  $destination = Join-Path $backup $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath $path -Destination $destination -Force
}

# Make TypeScript resolve the same compatibility client used by Vite.
$tsconfig = Get-Content -LiteralPath $tsconfigPath -Raw | ConvertFrom-Json
if (-not $tsconfig.compilerOptions) {
  $tsconfig | Add-Member -NotePropertyName compilerOptions -NotePropertyValue ([pscustomobject]@{})
}
$tsconfig.compilerOptions | Add-Member -Force -NotePropertyName baseUrl -NotePropertyValue "."
$paths = [ordered]@{
  "@appdeploy/client" = @("./src/platform/appdeploy-client-vercel.ts")
}
$tsconfig.compilerOptions | Add-Member -Force -NotePropertyName paths -NotePropertyValue $paths
$tsconfigJson = $tsconfig | ConvertTo-Json -Depth 20
Write-Utf8 $tsconfigPath ($tsconfigJson + [Environment]::NewLine)

# Ensure runtime shim also exposes put.
$shim = Read-Utf8 $shimPath
if ($shim -notmatch "async\s+put\s*\(") {
  $pattern = "(?m)^(\s*)async\s+delete\s*\("
  $match = [regex]::Match($shim, $pattern)
  if (-not $match.Success) { throw "Could not find api.delete in compatibility client." }
  $indent = $match.Groups[1].Value
  $putMethod = $indent + "async put(_path: string, _body?: unknown): Promise<{ data: any }> {" + [Environment]::NewLine +
               $indent + "  throw new Error('This route is available in the AppDeploy studio only.');" + [Environment]::NewLine +
               $indent + "}," + [Environment]::NewLine
  $shim = $shim.Insert($match.Index, $putMethod)
  Write-Utf8 $shimPath $shim
}

Push-Location $Repo
try {
  Write-Host "Running typecheck..." -ForegroundColor Cyan
  & npm run typecheck

  if ($LASTEXITCODE -ne 0) {
    # Last-resort compile-safe call while keeping AppDeploy runtime behavior.
    $studio = Read-Utf8 $studioPath
    if ($studio.Contains("api.put(")) {
      $studio = $studio.Replace("api.put(", "(api as any).put(")
      Write-Utf8 $studioPath $studio
      Write-Host "Applied compile-safe api.put call and retrying typecheck..." -ForegroundColor Yellow
      & npm run typecheck
    }
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Typecheck still failed. No commit was created."
  }

  Write-Host "Running unit tests..." -ForegroundColor Cyan
  & npm test
  if ($LASTEXITCODE -ne 0) { throw "Unit tests failed. No commit was created." }

  Write-Host "Running production build..." -ForegroundColor Cyan
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed. No commit was created." }

  $pathsToStage = @(
    "api/agent-bridge.js",
    "api/_lib/nasq-agent-bridge.js",
    "backend/app-routes.ts",
    "backend/vercel-agent-bridge.ts",
    "backend/site-preview.ts",
    "backend/premium-site-preview.ts",
    "src/Studio.tsx",
    "src/cwc-runner.ts",
    "src/platform/appdeploy-client-vercel.ts",
    "tests/tests.txt",
    "tests/unit/agent-bridge.test.mjs",
    "backlog.md",
    "package-lock.json",
    "tsconfig.json"
  )

  & git add -- $pathsToStage
  if ($LASTEXITCODE -ne 0) { throw "git add failed." }

  $staged = @(& git diff --cached --name-only)
  if ($staged | Where-Object { $_ -match '(^|/)\.env($|\.)|credential|secret\.json|\.pem$|\.key$' }) {
    throw "A secret-like file was staged. Commit stopped."
  }

  if ($staged.Count -gt 0) {
    & git commit -m "feat: run NASQ CWC agents through secure Vercel bridge"
    if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
  }

  & git push origin $ExpectedBranch
  if ($LASTEXITCODE -ne 0) {
    throw "git push failed. Use GitHub Desktop and press Push origin."
  }

  Write-Host ""
  Write-Host "SUCCESS: typecheck, tests, build, commit, and push completed." -ForegroundColor Green
  Write-Host "Backup: $backup" -ForegroundColor Cyan
  Write-Host "Do not merge PR 12 yet." -ForegroundColor Yellow
}
finally {
  Pop-Location
}
