import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function listManifestFiles(directory) {
  const names = await readdir(directory).catch(error => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  return names.filter(name => name.endsWith('.json')).sort().map(name => path.join(directory, name));
}

export async function readManifest(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeManifest(file, manifest) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}
