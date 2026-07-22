import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.APPDEPLOY_BACKUP_ENDPOINT;
const token = process.env.APPDEPLOY_BACKUP_TOKEN;
if (!endpoint || !token) {
  console.log('Backup skipped: APPDEPLOY_BACKUP_ENDPOINT or APPDEPLOY_BACKUP_TOKEN is not configured.');
  process.exit(0);
}
const response = await fetch(endpoint, { headers: { 'x-backup-token': token } });
if (!response.ok) throw new Error(`Backup request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
const backup = await response.text();
const outputDir = path.resolve(process.env.BACKUP_OUTPUT_DIR || 'backups');
await mkdir(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(outputDir, `appdeploy-${stamp}.json`);
await writeFile(output, backup, 'utf8');
console.log(output);
