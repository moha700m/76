import path from 'node:path';
import { listManifestFiles, readManifest } from '../../lib/social/files.mjs';
import { validateManifest } from '../../lib/social/content.mjs';

const directory = path.resolve(process.argv[2] || 'content/pending-uploads');
const files = await listManifestFiles(directory);
let failed = 0;

if (!files.length) console.log(`No content manifests found in ${directory}`);
for (const file of files) {
  const manifest = await readManifest(file);
  const result = validateManifest(manifest, { requireApproval: false });
  if (result.ok) console.log(`✓ ${manifest.id || file}`);
  else {
    failed += 1;
    console.error(`✗ ${manifest.id || file}: ${result.errors.join(' | ')}`);
  }
}
if (failed) process.exitCode = 1;
