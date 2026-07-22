import path from 'node:path';
import { isDue, sanitizeForLogs, validateManifest } from '../../lib/social/content.mjs';
import { listManifestFiles, readManifest, writeManifest } from '../../lib/social/files.mjs';
import { publishManifest } from '../../lib/social/publisher.mjs';

const args = new Set(process.argv.slice(2));
const directory = path.resolve(process.env.CONTENT_QUEUE_DIR || 'content/pending-uploads');
const forcedDryRun = args.has('--dry-run');
const dispatcherMode = forcedDryRun ? 'dry-run' : (process.env.SOCIAL_PUBLISH_MODE === 'live' ? 'live' : 'dry-run');
const dryRun = dispatcherMode !== 'live';
const requestedId = process.argv.find(value => value.startsWith('--id='))?.split('=')[1];
const now = new Date(process.env.PUBLISH_NOW || Date.now());
const endpoint = process.env.SOCIAL_PUBLISH_ENDPOINT;
const adminToken = process.env.SOCIAL_PUBLISH_ADMIN_TOKEN;
const files = await listManifestFiles(directory);
let attempted = 0;
let failures = 0;

async function remotePublish(manifest) {
  if (!adminToken) throw new Error('SOCIAL_PUBLISH_ADMIN_TOKEN is required when SOCIAL_PUBLISH_ENDPOINT is set');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ manifest, mode: dispatcherMode })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Remote publisher failed (${response.status})`);
  return data.manifest;
}

for (const file of files) {
  let manifest = await readManifest(file);
  if (requestedId && manifest.id !== requestedId) continue;
  const validation = validateManifest(manifest, { requireApproval: !dryRun });
  if (!validation.ok) {
    console.error(`Skipping ${manifest.id}: ${validation.errors.join(' | ')}`);
    failures += 1;
    continue;
  }
  if (!dryRun && !isDue(manifest, now)) continue;
  attempted += 1;
  try {
    manifest = endpoint
      ? await remotePublish(manifest)
      : await publishManifest(manifest, { mode: dispatcherMode });
    await writeManifest(file, manifest);
    console.log(JSON.stringify(sanitizeForLogs({ id: manifest.id, status: manifest.status, results: manifest.results }), null, 2));
  } catch (error) {
    failures += 1;
    console.error(`Publishing ${manifest.id} failed:`, error instanceof Error ? error.message : error);
    if (error?.manifest) await writeManifest(file, error.manifest);
  }
}

console.log(`Processed ${attempted} manifest(s), failures: ${failures}`);
if (failures) process.exitCode = 1;
