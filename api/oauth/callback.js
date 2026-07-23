import { methodNotAllowed } from '../_lib/http.js';

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>رجعنا من منصة النشر — نَسَق</title>
  <style>
    :root{color-scheme:dark;--bg:#05070b;--panel:#0a0e15;--line:#263649;--text:#f7fbff;--muted:#9eabba;--cyan:#73e7ff;--danger:#ff91a6}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 0,rgba(115,231,255,.12),transparent 38%),var(--bg);font-family:Cairo,"Noto Sans Arabic",Tahoma,sans-serif;color:var(--text)}main{width:min(660px,100%);padding:30px;border:1px solid var(--line);border-radius:24px;background:rgba(10,14,21,.94);box-shadow:0 30px 90px rgba(0,0,0,.45)}.badge{display:inline-flex;padding:6px 10px;border:1px solid rgba(115,231,255,.25);border-radius:999px;color:var(--cyan);font-size:12px}h1{margin:18px 0 10px;font-size:clamp(28px,5vw,42px);line-height:1.35}p{color:var(--muted);line-height:1.9}.box{margin-top:18px;padding:16px;border:1px solid var(--line);border-radius:16px;background:#070a10;word-break:break-all}.label{display:block;margin-bottom:7px;color:var(--cyan);font-size:12px}.value{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px}.error{color:var(--danger)}button{width:100%;margin-top:14px;padding:13px 18px;border:0;border-radius:14px;background:var(--cyan);color:#05070b;font-weight:800;cursor:pointer}small{display:block;margin-top:16px;color:#687789;line-height:1.7}</style>
</head>
<body>
<main>
  <span class="badge">OAuth Return</span>
  <h1>تم الرجوع من منصة النشر</h1>
  <p id="message">نراجع البيانات اللي رجعت من المنصة داخل المتصفح فقط.</p>
  <div class="box"><span class="label">Authorization code</span><span class="value" id="code">—</span></div>
  <div class="box"><span class="label">State</span><span class="value" id="state">—</span></div>
  <button id="copy" type="button">انسخ أمر الاستبدال</button>
  <small>لا ترسل الكود أو الرموز في محادثة عامة، ولا تحفظها داخل GitHub. الكود مؤقت ويُستخدم مرة واحدة لاستبداله برمز وصول من جهازك أو الخادم الآمن.</small>
</main>
<script>
(() => {
  const params = new URLSearchParams(location.search);
  const code = params.get('code') || '';
  const state = params.get('state') || '';
  const error = params.get('error') || '';
  const codeNode = document.getElementById('code');
  const stateNode = document.getElementById('state');
  const message = document.getElementById('message');
  const copy = document.getElementById('copy');
  if (error) {
    message.textContent = 'المنصة رجعت بخطأ: ' + error;
    message.className = 'error';
    copy.disabled = true;
    return;
  }
  codeNode.textContent = code || 'ما وصل code';
  stateNode.textContent = state || 'ما وصل state';
  if (!code) {
    message.textContent = 'ما وصل Authorization code. أعد التفويض وتأكد أن Redirect URI مطابق حرفيًا.';
    message.className = 'error';
    copy.disabled = true;
    return;
  }
  copy.addEventListener('click', async () => {
    const command = 'npm run oauth:tiktok -- exchange --code="' + code.replaceAll('"', '') + '"';
    await navigator.clipboard.writeText(command);
    copy.textContent = 'تم النسخ';
  });
})();
</script>
</body>
</html>`;

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.end(html);
}
