import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.env.LIGHTHOUSE_OUTPUT_DIR || '.lighthouseci');
const files = (await readdir(directory).catch(() => [])).filter(name => name.endsWith('.json'));
const runs = [];
for (const name of files) {
  try {
    const data = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
    if (!data.categories || !data.finalUrl) continue;
    runs.push({
      file: name,
      url: data.finalUrl,
      performance: Math.round((data.categories.performance?.score || 0) * 100),
      accessibility: Math.round((data.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((data.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((data.categories.seo?.score || 0) * 100),
      lcpMs: Math.round(data.audits?.['largest-contentful-paint']?.numericValue || 0),
      cls: Number((data.audits?.['cumulative-layout-shift']?.numericValue || 0).toFixed(3)),
      inpMs: Math.round(data.audits?.['interaction-to-next-paint']?.numericValue || 0)
    });
  } catch {}
}
if (!runs.length) throw new Error('No Lighthouse result JSON files found');
const average = key => Math.round(runs.reduce((sum, item) => sum + Number(item[key] || 0), 0) / runs.length);
const report = {
  capturedAt: new Date().toISOString(),
  runCount: runs.length,
  scores: {
    performance: average('performance'),
    accessibility: average('accessibility'),
    bestPractices: average('bestPractices'),
    seo: average('seo')
  },
  vitals: {
    lcpMs: average('lcpMs'),
    cls: Number((runs.reduce((sum, item) => sum + item.cls, 0) / runs.length).toFixed(3)),
    inpMs: average('inpMs')
  },
  runs
};
await mkdir('reports/metrics', { recursive: true });
await writeFile('reports/metrics/lighthouse-latest.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report.scores));
