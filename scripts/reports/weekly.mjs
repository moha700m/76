import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function git(args, fallback = '') {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return fallback; }
}

const now = new Date();
const date = now.toISOString().slice(0, 10);
const reportDir = path.resolve('reports/weekly');
await mkdir(reportDir, { recursive: true });
const backlog = await readFile('backlog.md', 'utf8').catch(() => '');
const completed = (backlog.match(/- \[x\]/gi) || []).length;
const pending = (backlog.match(/- \[ \]/g) || []).length;
const commits = Number(git(['rev-list', '--count', '--since=7 days ago', 'HEAD'], '0')) || 0;
const features = Number(git(['log', '--since=7 days ago', '--pretty=%s'], '').split('\n').filter(line => /feat|ميزة|إضافة/i.test(line)).length);
const fixes = Number(git(['log', '--since=7 days ago', '--pretty=%s'], '').split('\n').filter(line => /fix|إصلاح|bug/i.test(line)).length);
const contentDir = path.resolve('content/pending-uploads');
const manifests = await readdir(contentDir).catch(() => []);
let publishedVideos = 0;
const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
for (const name of manifests.filter(item => item.endsWith('.json'))) {
  const item = JSON.parse(await readFile(path.join(contentDir, name), 'utf8'));
  publishedVideos += Object.values(item.results || {}).filter(result => result?.status === 'published' && Date.parse(result.updatedAt || 0) >= weekAgo).length;
}
const lighthouse = JSON.parse(await readFile('reports/metrics/lighthouse-latest.json', 'utf8').catch(() => '{}'));
const performance = Number(lighthouse.scores?.performance || 0);
const accessibility = Number(lighthouse.scores?.accessibility || 0);
const seo = Number(lighthouse.scores?.seo || 0);

const previousFiles = (await readdir(reportDir)).filter(name => name.endsWith('.md')).sort();
const previousName = previousFiles.at(-1);
let previous = {};
if (previousName) {
  const text = await readFile(path.join(reportDir, previousName), 'utf8');
  for (const key of ['commits', 'features', 'fixes', 'publishedVideos', 'performance', 'accessibility', 'seo']) {
    const match = text.match(new RegExp(`<!-- ${key}:(\\d+) -->`));
    previous[key] = match ? Number(match[1]) : 0;
  }
}

function compare(current, old) {
  const delta = current - (old || 0);
  return delta === 0 ? 'بدون تغيير' : delta > 0 ? `+${delta}` : String(delta);
}

const report = `# تقرير مرصد تسعة الأسبوعي — ${date}\n\n` +
`<!-- commits:${commits} -->\n<!-- features:${features} -->\n<!-- fixes:${fixes} -->\n<!-- publishedVideos:${publishedVideos} -->\n<!-- performance:${performance} -->\n<!-- accessibility:${accessibility} -->\n<!-- seo:${seo} -->\n\n` +
`| المؤشر | هذا الأسبوع | مقارنة بالسابق |\n|---|---:|---:|\n` +
`| Commits | ${commits} | ${compare(commits, previous.commits)} |\n` +
`| الميزات الجديدة | ${features} | ${compare(features, previous.features)} |\n` +
`| الأخطاء المصلحة | ${fixes} | ${compare(fixes, previous.fixes)} |\n` +
`| عمليات النشر على المنصات | ${publishedVideos} | ${compare(publishedVideos, previous.publishedVideos)} |\n` +
`| Lighthouse Performance | ${performance || 'غير متاح'} | ${performance ? compare(performance, previous.performance) : '—'} |\n` +
`| Lighthouse Accessibility | ${accessibility || 'غير متاح'} | ${accessibility ? compare(accessibility, previous.accessibility) : '—'} |\n` +
`| Lighthouse SEO | ${seo || 'غير متاح'} | ${seo ? compare(seo, previous.seo) : '—'} |\n` +
`| مهام Backlog المكتملة | ${completed} | — |\n` +
`| مهام Backlog المفتوحة | ${pending} | — |\n\n` +
`## ملاحظة الأداء\n\nتُقرأ أحدث نتيجة Lighthouse من reports/metrics/lighthouse-latest.json عند توفر PRODUCTION_URL وتشغيل التدقيق.\n`;

const output = path.join(reportDir, `${date}.md`);
await writeFile(output, report, 'utf8');
console.log(output);
