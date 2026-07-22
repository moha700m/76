import { execFileSync } from 'node:child_process';
import process from 'node:process';

const tag = process.argv[2];
if (!tag) {
  console.error('الاستخدام: npm run rollback -- backup-YYYYMMDDTHHMMSSZ');
  process.exit(1);
}

function run(command, args = []) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function output(command, args = []) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

try {
  output('git', ['rev-parse', '--verify', `${tag}^{commit}`]);
} catch {
  console.error(`وسم النسخة الاحتياطية غير موجود: ${tag}`);
  process.exit(1);
}

if (output('git', ['status', '--porcelain'])) {
  console.error('احفظ أو ألغِ التغييرات الحالية قبل الرجوع.');
  process.exit(1);
}

run('git', ['checkout', tag, '--', '.']);
run('git', ['add', '-A']);
run('git', ['commit', '-m', `Rollback to ${tag}`]);
run('git', ['push', 'origin', 'HEAD:main']);
console.log(`تم إنشاء تحديث رجوع آمن إلى ${tag}.`);
