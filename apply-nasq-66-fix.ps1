$ErrorActionPreference = "Stop"

$Repo = Split-Path -Parent $PSCommandPath
if (-not (Test-Path (Join-Path $Repo ".git"))) {
    Write-Host "ERROR: ضع الملفين داخل جذر مستودع 76 الذي يحتوي مجلد .git ثم شغّل ملف BAT." -ForegroundColor Red
    exit 1
}

$required = @("src\Studio.tsx","backend\app-routes.ts","tests\tests.txt","backlog.md")
foreach ($relative in $required) {
    if (-not (Test-Path (Join-Path $Repo $relative))) {
        Write-Host "ERROR: الملف غير موجود: $relative" -ForegroundColor Red
        exit 1
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "NASQ-backups\before-66-fix-$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
foreach ($relative in $required) {
    $source = Join-Path $Repo $relative
    $destination = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

function Read-Utf8([string]$Path) {
    [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}
function Write-Utf8([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

$studioPath = Join-Path $Repo "src\Studio.tsx"
$studio = Read-Utf8 $studioPath

if ($studio -match "/run-legacy") {
    $pattern = '(?ms)^  async function executeAgentWaves\(project: Project\) \{.*?^  \}\r?\n\r?\n  async function runManagedPipeline'
    $replacement = @'
  async function executeAgentWaves(project: Project) {
    const response = await api.post(`/api/projects/${project.id}/run`, {});
    const current = response.data.project as Project;
    syncProject(current);
    return current;
  }

  async function runManagedPipeline
'@
    $next = [regex]::Replace($studio, $pattern, $replacement, 1)
    if ($next -eq $studio -or $next -match "/run-legacy") { throw "تعذر إلغاء run-legacy بأمان." }
    $studio = $next
}

$oldRunning = "  const running = project.status === 'running';"
$newRunning = @"
  const recoverablePartial = project.status === 'running' && project.agentOutputs.length > 0 && project.agentOutputs.length < 9;
  const running = project.status === 'running' && !recoverablePartial;
"@
if ($studio.Contains($oldRunning)) {
    $studio = $studio.Replace($oldRunning, $newRunning.TrimEnd())
} elseif (-not $studio.Contains("const recoverablePartial = project.status === 'running'")) {
    throw "تعذر إضافة حالة استكمال المشروع الجزئي."
}

$oldLabel = "{project.agentOutputs.length ? 'تشغيل جولة جديدة' : 'تشغيل الوكلاء'}"
$newLabel = "{recoverablePartial ? 'استكمال التشغيل' : project.agentOutputs.length ? 'تشغيل جولة جديدة' : 'تشغيل الوكلاء'}"
if ($studio.Contains($oldLabel)) {
    $studio = $studio.Replace($oldLabel, $newLabel)
} elseif (-not $studio.Contains("recoverablePartial ? 'استكمال التشغيل'")) {
    throw "تعذر تحديث زر استكمال التشغيل."
}
Write-Utf8 $studioPath $studio

$routesPath = Join-Path $Repo "backend\app-routes.ts"
$routes = Read-Utf8 $routesPath
$oldGuard = "      if (project.status === 'running' && project.progress > 10) return error('هناك مجلس يعمل حاليًا', 409);"
$newGuard = @"
      const legacyPartial = project.agentOutputs.length > 0 && project.agentOutputs.length < 9;
      if (project.status === 'running' && project.currentRunId && !legacyPartial) return error('هناك مجلس يعمل حاليًا', 409);
"@
if ($routes.Contains($oldGuard)) {
    $routes = $routes.Replace($oldGuard, $newGuard.TrimEnd())
} elseif (-not $routes.Contains("const legacyPartial = project.agentOutputs.length > 0")) {
    throw "حالة backend/app-routes.ts غير متوقعة."
}
Write-Utf8 $routesPath $routes

$testsPath = Join-Path $Repo "tests\tests.txt"
$tests = Read-Utf8 $testsPath
$tests = $tests.Replace(
    "Description: يشغّل مشروعًا حيًا عبر ثلاث موجات ذكاء فعلية حتى المعاينة، ويتحقق أن المحتوى والهوية مخصصان ولا يكرران نص الفكرة أو قالب نَسَق العام.",
    "Description: يشغّل مشروعًا حيًا عبر مسار واحد مستقر حتى المعاينة، ويتحقق من اكتمال 9/9 دون إعادة تشغيل، وأن المشروع الجزئي عند 66% يعرض استكمال التشغيل."
)
$tests = $tests.Replace(
    "4. راقب سجل التشغيل حتى تظهر الموجة الأولى والثانية واكتمال 9/9 وكلاء ثم القرار التصميمي النهائي",
    "4. راقب التقدم حتى يكتمل 9/9 مرة واحدة دون رجوع إلى 66% أو بدء جولة ثانية"
)
$tests = $tests.Replace(
    "Expected: تظهر موجات الوكلاء المحفوظة ثم موقع قهوة عربي كامل بألوان دافئة وأقسام مرتبطة بالقهوة، ولا يعيد نص الفكرة حرفيًا ولا يعرض مصطلحات الوكلاء أو قالب نَسَق الداكن.",
    "Expected: يكتمل 9/9 مرة واحدة وتظهر معاينة قهوة عربية بألوان دافئة، ولا تعاد الجولة ولا تتوقف عند 66% ولا يظهر قالب نَسَق الداكن."
)
Write-Utf8 $testsPath $tests

$backlogPath = Join-Path $Repo "backlog.md"
$backlog = Read-Utf8 $backlogPath
$doneLine = "- [x] P0 إيقاف المسار القديم الذي كان يعيد الجولة ويتعطل عند 66%، وتحويل الواجهة إلى تشغيل مستقر واحد مع استكمال المشاريع العالقة."
if (-not $backlog.Contains($doneLine)) {
    $anchor = "- [x] P0 إضافة اختبار E2E حي: مدير نَسَق → 9/9 أدوار → معاينة تلقائية → فحص بصري للتصميم."
    if (-not $backlog.Contains($anchor)) { throw "تعذر تحديث backlog.md." }
    $backlog = $backlog.Replace($anchor, "$anchor`r`n$doneLine")
    Write-Utf8 $backlogPath $backlog
}

Write-Host ""
Write-Host "تم تطبيق إصلاح إعادة التشغيل و66% بنجاح." -ForegroundColor Green
Write-Host "النسخة الاحتياطية: $backupRoot" -ForegroundColor Cyan
Write-Host "ارجع إلى GitHub Desktop: Commit ثم Push على نفس الفرع." -ForegroundColor Yellow
exit 0
