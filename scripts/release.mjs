import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const config = JSON.parse(readFileSync(new URL('../update.config.json', import.meta.url), 'utf8'));
const message = process.argv.slice(2).join(' ').trim() || `Update ${new Date().toISOString()}`;

function run(command, args = [], options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

function output(command, args = []) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function shell(command) {
  const shellName = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
  const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];
  run(shellName, shellArgs);
}

try {
  output('git', ['rev-parse', '--is-inside-work-tree']);
} catch {
  console.error('هذا الأمر يجب تشغيله من داخل مستودع Git.');
  process.exit(1);
}

const branch = output('git', ['branch', '--show-current']);
if (!branch) {
  console.error('لا يمكن النشر من detached HEAD.');
  process.exit(1);
}

const remote = config.remote || 'origin';
try {
  output('git', ['remote', 'get-url', remote]);
} catch {
  console.error(`المستودع غير مربوط بالريموت ${remote}.`);
  process.exit(1);
}

const status = output('git', ['status', '--porcelain']);
if (!status) {
  console.log('لا توجد تغييرات جديدة للنشر.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const tag = `${config.backupTagPrefix || 'backup'}-${stamp}`;

console.log(`إنشاء نسخة احتياطية: ${tag}`);
run('git', ['tag', '-a', tag, '-m', `Backup before ${message}`]);

for (const check of config.checks || []) {
  console.log(`تشغيل الفحص: ${check}`);
  shell(check);
}

run('git', ['add', '-A']);
run('git', ['commit', '-m', message]);
run('git', ['push', remote, `HEAD:${config.branch || branch}`]);
run('git', ['push', remote, tag]);

console.log('\nتم رفع التحديث بنجاح.');
console.log(`نسخة الرجوع: ${tag}`);
console.log('إذا كان المستودع مربوطًا بـVercel فسيبدأ النشر تلقائيًا.');
