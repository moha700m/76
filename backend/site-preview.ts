import { ai } from '@appdeploy/sdk';
import { generatePremiumSitePreview } from './premium-site-preview';

export type SitePreviewProject = {
  name: string;
  brief: string;
  audience: string;
  goal: string;
  style: string;
  synthesis?: Record<string, unknown>;
  agentOutputs?: Array<{ name: string; summary: string; confidence: number; status: string }>;
};

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}

function strings(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string').map(String) : fallback;
}

function objectValue(source: Record<string, unknown>, key: string, fallback: unknown) {
  return source[key] ?? fallback;
}

function sanitizeGeneratedHtml(raw: string) {
  let html = raw.replace(/```(?:html)?/gi, '').replace(/```/g, '').trim();
  const start = html.search(/<!doctype html|<html/i);
  if (start > 0) html = html.slice(start);
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<(?:object|embed|base)[\s\S]*?>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, ' href="#"');
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html) || html.length < 1600 || html.length > 90000) return '';
  return html;
}

export function buildFallbackPreview(project: SitePreviewProject) {
  const synthesis = project.synthesis || {};
  const name = esc(project.name);
  const initial = esc(project.name.trim().slice(0, 1) || 'م');
  const executive = esc(objectValue(synthesis, 'executiveSummary', project.brief));
  const positioning = esc(objectValue(synthesis, 'positioning', project.goal));
  const direction = esc(objectValue(synthesis, 'designDirection', project.style));
  const journey = strings(objectValue(synthesis, 'primaryJourney', []), ['فهم الاحتياج', 'اختيار الحل', 'إرسال الطلب', 'بدء التنفيذ']);
  const rawPages = Array.isArray(synthesis.pages) ? synthesis.pages : [];
  const pages = rawPages.slice(0, 6).map(item => {
    const page = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      name: esc(page.name || 'حل رئيسي'),
      purpose: esc(page.purpose || 'شرح الحل بوضوح'),
      sections: strings(page.sections).slice(0, 4).map(esc)
    };
  });
  const cards = (pages.length ? pages : [
    { name: 'الخدمة الأساسية', purpose: 'عرض القيمة الرئيسية للعميل بوضوح', sections: ['حل مخصص', 'تنفيذ واضح'] },
    { name: 'طريقة العمل', purpose: 'شرح المراحل من الطلب إلى التسليم', sections: ['موجز', 'تنفيذ'] },
    { name: 'بدء التواصل', purpose: 'تسهيل اتخاذ الخطوة التالية', sections: ['طلب سريع', 'رد واضح'] }
  ]).map((page, index) => `<article class="service-card"><div class="card-top"><span class="number">0${index + 1}</span><span class="arrow">↗</span></div><h3>${page.name}</h3><p>${page.purpose}</p><div class="chips">${page.sections.map(section => `<span>${section}</span>`).join('')}</div></article>`).join('');
  const steps = journey.slice(0, 6).map((step, index) => `<li><span class="step-index">${index + 1}</span><div><b>${esc(step)}</b><small>${index === 0 ? 'نبدأ بفهم الهدف والسياق.' : index === journey.length - 1 ? 'ننتقل إلى الإجراء الواضح.' : 'خطوة مترابطة تبني على ما قبلها.'}</small></div></li>`).join('');

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet"><style>
:root{--bg:#05070b;--surface:#0a0e15;--raised:#0d121b;--line:#1b2736;--line2:#2b3b4e;--text:#f7fbff;--muted:#a8b4c3;--subtle:#768496;--cyan:#73e7ff;--violet:#9d8cff;--warm:#ffd166}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:'Noto Sans Arabic',sans-serif;line-height:1.8}body:before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 12% 10%,rgba(115,231,255,.09),transparent 30%),radial-gradient(circle at 88% 52%,rgba(157,140,255,.08),transparent 30%),linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:auto,auto,48px 48px,48px 48px;z-index:-1}h1,h2,h3,.brand{font-family:'Cairo',sans-serif}a{color:inherit;text-decoration:none}.wrap{width:min(1180px,calc(100% - 40px));margin:auto}.nav{position:sticky;top:0;z-index:30;border-bottom:1px solid var(--line);background:rgba(5,7,11,.86);backdrop-filter:blur(20px)}.nav-inner{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:12px;font-weight:800}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--cyan),var(--violet));color:var(--bg);font-weight:800}.links{display:flex;gap:26px;color:var(--muted);font-size:13px}.links a:hover{color:var(--text)}.button,.button-ghost{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:12px 22px;border-radius:14px;font-weight:700;transition:.25s ease}.button{background:var(--cyan);color:var(--bg)}.button:hover{background:white;transform:translateY(-2px)}.button-ghost{border:1px solid var(--line2);background:var(--surface);color:var(--text)}.button-ghost:hover{border-color:rgba(115,231,255,.45)}.hero{min-height:760px;display:grid;align-items:center;padding:82px 0}.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:60px;align-items:center}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid rgba(115,231,255,.2);border-radius:999px;background:rgba(115,231,255,.06);color:#9af0ff;font-size:12px;font-weight:700}.hero h1{font-size:clamp(42px,6.8vw,78px);line-height:1.19;letter-spacing:-1.6px;margin:22px 0}.hero h1 span{background:linear-gradient(90deg,var(--cyan),#c3bbff);-webkit-background-clip:text;color:transparent}.hero-copy>p{font-size:19px;color:var(--muted);max-width:680px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.trust{margin-top:20px;color:var(--subtle);font-size:12px}.showcase{position:relative;border:1px solid var(--line2);border-radius:34px;padding:24px;background:linear-gradient(145deg,#101925,#080b11);box-shadow:0 36px 100px rgba(0,0,0,.52);overflow:hidden}.showcase:before,.showcase:after{content:'';position:absolute;width:300px;height:300px;border-radius:50%;filter:blur(70px);opacity:.15}.showcase:before{background:var(--cyan);right:-140px;top:-120px}.showcase:after{background:var(--violet);left:-150px;bottom:-150px}.showcase>*{position:relative}.showcase-head{display:flex;justify-content:space-between;align-items:center}.live{padding:5px 10px;border-radius:999px;background:rgba(115,231,255,.1);color:var(--cyan);font-size:10px;font-weight:800;letter-spacing:.14em}.showcase h2{font-size:25px;margin:46px 0 12px}.showcase p{color:var(--muted)}.signal{margin-top:34px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.signal div{border:1px solid var(--line);border-radius:16px;background:rgba(10,14,21,.74);padding:16px 10px;text-align:center}.signal b{display:block;color:var(--cyan);font-size:17px}.signal span{font-size:10px;color:var(--subtle)}.section{padding:100px 0;border-top:1px solid var(--line)}.section-head{max-width:720px;margin-bottom:42px}.kicker{font-size:11px;color:var(--cyan);font-weight:800;letter-spacing:.16em}.section h2{font-size:clamp(31px,5vw,50px);line-height:1.35;margin:10px 0}.section-head p{color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.service-card{border:1px solid var(--line);border-radius:24px;background:var(--surface);padding:25px;transition:.25s}.service-card:hover{transform:translateY(-5px);border-color:rgba(115,231,255,.3)}.card-top{display:flex;justify-content:space-between;color:var(--cyan);font-size:12px}.arrow{font-size:18px;color:var(--subtle)}.service-card h3{margin:34px 0 8px;font-size:20px}.service-card p{color:var(--muted);min-height:60px}.chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:20px}.chips span{border:1px solid var(--line);border-radius:999px;padding:4px 9px;color:var(--subtle);font-size:10px}.split{display:grid;grid-template-columns:.86fr 1.14fr;gap:50px;align-items:start}.statement{position:sticky;top:110px;border:1px solid var(--line2);border-radius:30px;padding:34px;background:linear-gradient(145deg,#111925,var(--surface))}.statement h3{font-size:28px;margin:14px 0}.statement p{color:var(--muted)}.steps{list-style:none;padding:0;margin:0;display:grid;gap:12px}.steps li{display:flex;align-items:center;gap:16px;border:1px solid var(--line);border-radius:19px;padding:17px;background:var(--surface)}.step-index{display:grid;place-items:center;flex:0 0 36px;height:36px;border-radius:12px;background:rgba(115,231,255,.1);color:var(--cyan);font-weight:800}.steps b{display:block}.steps small{display:block;color:var(--subtle);font-size:11px}.cta-section{padding:80px 0 100px}.cta-box{position:relative;overflow:hidden;border:1px solid rgba(115,231,255,.25);border-radius:34px;padding:48px;background:linear-gradient(120deg,rgba(115,231,255,.14),rgba(157,140,255,.1),var(--surface));display:flex;align-items:center;justify-content:space-between;gap:30px}.cta-box h2{font-size:36px;margin:0 0 8px}.cta-box p{color:var(--muted);margin:0}.footer{padding:30px 0;border-top:1px solid var(--line);color:var(--subtle);font-size:12px}.footer-inner{display:flex;justify-content:space-between;gap:20px}@media(max-width:850px){.links{display:none}.hero{min-height:auto;padding:70px 0}.hero-grid,.split{grid-template-columns:1fr}.showcase{order:2}.statement{position:static}.cards{grid-template-columns:1fr 1fr}.cta-box{display:block}.cta-box .button{margin-top:24px}}@media(max-width:560px){.wrap{width:min(100% - 24px,1180px)}.nav-inner{min-height:66px}.nav .button{padding:9px 13px;font-size:12px}.hero h1{font-size:40px}.hero-copy>p{font-size:16px}.actions a{width:100%}.showcase{padding:18px;border-radius:24px}.signal{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.section{padding:72px 0}.cta-box{padding:30px}.cta-box h2{font-size:28px}.footer-inner{display:block}.footer-inner span+span{display:block;margin-top:8px}}
</style></head><body><nav class="nav"><div class="wrap nav-inner"><a class="brand" href="#top"><span class="mark">${initial}</span><span>${name}</span></a><div class="links"><a href="#services">الحلول</a><a href="#journey">طريقة العمل</a><a href="#contact">ابدأ الآن</a></div><a class="button" href="#contact">طلب الخدمة ↗</a></div></nav><main id="top"><section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><span class="eyebrow">حل رقمي مبني على احتياج حقيقي</span><h1>${positioning}<br><span>${esc(project.goal)}</span></h1><p>${executive}</p><div class="actions"><a class="button" href="#contact">ابدأ طلبك ↗</a><a class="button-ghost" href="#services">استكشف الحل</a></div><div class="trust">مصمم للجمهور: ${esc(project.audience)}</div></div><div class="showcase"><div class="showcase-head"><span class="live">LIVE PREVIEW</span><span>${name}</span></div><h2>${esc(project.goal)}</h2><p>${direction}</p><div class="signal"><div><b>واضح</b><span>رسالة مباشرة</span></div><div><b>متجاوب</b><span>جوال وكمبيوتر</span></div><div><b>مركّز</b><span>إجراء رئيسي</span></div></div></div></div></section><section class="section" id="services"><div class="wrap"><div class="section-head"><span class="kicker">SOLUTION STRUCTURE</span><h2>أقسام تخدم القرار، لا تملأ الصفحة.</h2><p>تم تحويل مخرجات مجلس التصميم إلى بنية يمكن للعميل تصفحها ومراجعتها فعليًا.</p></div><div class="cards">${cards}</div></div></section><section class="section" id="journey"><div class="wrap split"><div class="statement"><span class="kicker">DESIGN DIRECTION</span><h3>${esc(project.style)}</h3><p>${direction}</p></div><div><div class="section-head"><span class="kicker">PRIMARY JOURNEY</span><h2>من الفهم إلى اتخاذ الإجراء.</h2></div><ol class="steps">${steps}</ol></div></div></section><section class="cta-section" id="contact"><div class="wrap cta-box"><div><h2>جاهز للانتقال من المعاينة إلى التنفيذ؟</h2><p>راجع المحتوى والهوية، ثم اعتمد النسخة قبل النشر النهائي.</p></div><a class="button" href="#top">مراجعة الموقع ↑</a></div></section></main><footer class="footer"><div class="wrap footer-inner"><span>${name}</span><span>معاينة تصميمية مولدة من بيانات المشروع، دون أرقام أو ادعاءات غير مقدمة.</span></div></footer></body></html>`;
}

function adaptiveTheme(style: string) {
  const value = style.toLowerCase();
  if (/عاجي|بني|زيتوني|دافئ|ورقي|قهوة|ترابي/.test(value)) return { bg:'#F3ECDF', surface:'#FFFAF2', text:'#3A2A20', muted:'#78695D', accent:'#6F7D45', accent2:'#B46C3B', line:'#DED2C2' };
  if (/فاخر|ذهبي|أسود|luxury/.test(value)) return { bg:'#0E0D0B', surface:'#1A1814', text:'#F6F0E4', muted:'#B8AB98', accent:'#B99352', accent2:'#D8C7A1', line:'#373026' };
  if (/تقني|داكن|سماوي|بنفسجي|نيون/.test(value)) return { bg:'#05070B', surface:'#0A0E15', text:'#F7FBFF', muted:'#A8B4C3', accent:'#73E7FF', accent2:'#9D8CFF', line:'#263548' };
  return { bg:'#F4F1EA', surface:'#FFFFFF', text:'#18201C', muted:'#66726B', accent:'#2F6B52', accent2:'#D29062', line:'#D9DED9' };
}

function adaptiveSections(project: SitePreviewProject) {
  const source = `${project.name} ${project.brief} ${project.goal}`.toLowerCase();
  if (/قهوة|بن|محمصة/.test(source)) return [['اختيارات القهوة','استكشف المحاصيل والخلطات المناسبة لذائقتك'],['تجربة التحضير','محتوى يساعد الزائر على اختيار طريقة التحضير'],['من الحبة إلى الكوب','رحلة واضحة تشرح القيمة وجودة التجربة']];
  if (/حضانة|أطفال|روضة/.test(source)) return [['البرامج اليومية','عرض البرامج والأنشطة المناسبة للأطفال'],['بيئة آمنة','شرح تجربة الطفل وراحة ولي الأمر'],['احجز زيارة','خطوة واضحة للتعرف على الحضانة']];
  if (/صيانة|فني|منزل/.test(source)) return [['اختر الخدمة','الوصول السريع إلى نوع الصيانة المطلوبة'],['موعد واضح','شرح الحجز والتأكيد والمتابعة'],['ثقة من البداية','توضيح ما يحتاجه العميل قبل الطلب']];
  if (/متجر|منتج|بيع|تجارة/.test(source)) return [['المنتجات','عرض منظم يساعد على الاختيار'],['لماذا هذا المتجر','تقديم القيمة والهوية بوضوح'],['ابدأ الطلب','مسار مختصر نحو الشراء أو التواصل']];
  return [['ما الذي نقدمه','عرض الفكرة والخدمات المرتبطة بها'],['كيف تعمل التجربة','رحلة بسيطة من الاهتمام إلى الإجراء'],['ابدأ الآن','دعوة واضحة لاتخاذ الخطوة التالية']];
}

function buildAdaptivePreview(project: SitePreviewProject) {
  const synthesis = project.synthesis || {};
  const designSystem = synthesis.designSystem && typeof synthesis.designSystem === 'object' ? synthesis.designSystem as Record<string, unknown> : {};
  const palette = strings(designSystem.palette).filter(value => /^#[0-9a-f]{6}$/i.test(value));
  const fallbackTheme = adaptiveTheme(project.style);
  const theme = { bg:palette[0] || fallbackTheme.bg, surface:palette[1] || fallbackTheme.surface, text:palette[2] || fallbackTheme.text, muted:fallbackTheme.muted, accent:palette[3] || fallbackTheme.accent, accent2:palette[4] || fallbackTheme.accent2, line:fallbackTheme.line };
  const executive = String(objectValue(synthesis, 'executiveSummary', `تجربة عربية مصممة خصيصًا لـ ${project.name} وتساعد الجمهور على الوصول إلى الإجراء الرئيسي بوضوح.`));
  const positioning = String(objectValue(synthesis, 'positioning', `تجربة واضحة ومخصصة لـ ${project.name}`));
  const direction = String(objectValue(synthesis, 'designDirection', project.style));
  const rawPages = Array.isArray(synthesis.pages) ? synthesis.pages : [];
  const derivedSections = rawPages.slice(0, 4).map(item => { const page = item && typeof item === 'object' ? item as Record<string, unknown> : {}; return [String(page.name || 'قسم رئيسي'), String(page.purpose || 'قسم يخدم رحلة المستخدم')]; });
  const sections = derivedSections.length >= 3 ? derivedSections : adaptiveSections(project);
  const cards = sections.map((item, index) => `<article class="card"><span>0${index + 1}</span><h3>${esc(item[0])}</h3><p>${esc(item[1])}</p></article>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.name)}</title><style>:root{--bg:${theme.bg};--surface:${theme.surface};--text:${theme.text};--muted:${theme.muted};--accent:${theme.accent};--accent2:${theme.accent2};--line:${theme.line}}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:Tahoma,'Noto Sans Arabic',sans-serif;line-height:1.8}a{color:inherit;text-decoration:none}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}.nav{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}.navin{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:20px;font-weight:800}.btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 20px;border-radius:999px;background:var(--accent);color:var(--surface);font-weight:800}.hero{padding:88px 0 70px}.grid{display:grid;grid-template-columns:1.06fr .94fr;gap:54px;align-items:center}.tag{display:inline-flex;padding:7px 12px;border:1px solid var(--line);border-radius:999px;color:var(--accent);background:var(--surface);font-size:12px;font-weight:700}.hero h1{font-size:clamp(42px,7vw,78px);line-height:1.15;margin:22px 0;letter-spacing:-1.5px}.hero p{font-size:18px;color:var(--muted);max-width:680px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.ghost{display:inline-flex;padding:11px 19px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font-weight:700}.visual{position:relative;min-height:430px;border:1px solid var(--line);border-radius:38px;background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--accent) 10%,var(--surface)));overflow:hidden;box-shadow:0 30px 80px color-mix(in srgb,var(--text) 15%,transparent)}.visual:before{content:'';position:absolute;width:280px;height:280px;border-radius:50%;background:var(--accent);opacity:.2;top:-90px;left:-60px}.visual:after{content:'';position:absolute;width:220px;height:220px;border-radius:42% 58% 65% 35%;background:var(--accent2);opacity:.25;bottom:-50px;right:-30px;transform:rotate(24deg)}.panel{position:absolute;inset:70px 48px;border:1px solid var(--line);border-radius:28px;background:color-mix(in srgb,var(--surface) 86%,transparent);padding:30px;display:flex;flex-direction:column;justify-content:space-between}.panel strong{font-size:30px}.panel small{color:var(--muted)}.section{padding:88px 0;border-top:1px solid var(--line)}.section h2{font-size:clamp(30px,5vw,52px);margin:0 0 12px}.lead{color:var(--muted);max-width:720px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:38px}.card{padding:26px;border:1px solid var(--line);border-radius:24px;background:var(--surface);transition:.25s}.card:hover{transform:translateY(-5px);border-color:var(--accent)}.card span{color:var(--accent);font-size:12px;font-weight:800}.card h3{font-size:22px;margin:28px 0 8px}.card p{color:var(--muted);margin:0}.journey{display:grid;grid-template-columns:.85fr 1.15fr;gap:40px;align-items:start}.quote{padding:30px;border-radius:28px;background:var(--accent);color:var(--surface);position:sticky;top:100px}.steps{display:grid;gap:12px}.step{padding:18px 20px;border:1px solid var(--line);background:var(--surface);border-radius:18px}.step b{color:var(--accent);margin-left:10px}.cta{padding:74px 0}.ctabox{padding:42px;border-radius:32px;background:linear-gradient(120deg,var(--accent),var(--accent2));color:var(--surface);display:flex;justify-content:space-between;align-items:center;gap:28px}.ctabox h2{margin:0;font-size:36px}.ctabox .btn{background:var(--surface);color:var(--text)}footer{padding:28px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}@media(max-width:800px){.grid,.journey{grid-template-columns:1fr}.visual{min-height:360px}.cards{grid-template-columns:1fr}.quote{position:static}.ctabox{display:block}.ctabox .btn{margin-top:22px}.hero{padding-top:62px}}@media(max-width:480px){.wrap{width:min(100% - 22px,1120px)}.nav .btn{padding:9px 13px;font-size:12px}.hero h1{font-size:40px}.actions a{width:100%}.panel{inset:46px 22px}.ctabox{padding:28px}.ctabox h2{font-size:28px}}</style></head><body><nav class="nav"><div class="wrap navin"><a class="brand" href="#top">${esc(project.name)}</a><a class="btn" href="#start">ابدأ الآن</a></div></nav><main id="top"><section class="hero"><div class="wrap grid"><div><span class="tag">تجربة مبنية على احتياج جمهورك</span><h1>${esc(positioning)}</h1><p>${esc(executive)}</p><div class="actions"><a class="btn" href="#start">اتخذ الخطوة التالية</a><a class="ghost" href="#offer">استكشف التجربة</a></div></div><div class="visual"><div class="panel"><small>${esc(direction)}</small><strong>${esc(project.name)}</strong><p>مصمم لـ ${esc(project.audience)}</p></div></div></div></section><section class="section" id="offer"><div class="wrap"><h2>تجربة مبنية حول ما يحتاجه زائرك.</h2><p class="lead">تم تحويل موجز المشروع إلى أقسام واضحة ومحتوى مرتبط مباشرة بالفكرة، دون نسخ قالب عام.</p><div class="cards">${cards}</div></div></section><section class="section"><div class="wrap journey"><div class="quote"><small>الطابع البصري</small><h2>${esc(project.style)}</h2><p>هوية وتكوين ومساحات تتبع وصف المشروع نفسه.</p></div><div class="steps"><div class="step"><b>01</b>يفهم الزائر قيمة المشروع بسرعة.</div><div class="step"><b>02</b>يستكشف العرض أو الخدمة المناسبة.</div><div class="step"><b>03</b>يعرف طريقة الاستخدام أو الطلب.</div><div class="step"><b>04</b>ينتقل إلى الإجراء الرئيسي بثقة.</div></div></div></section><section class="cta" id="start"><div class="wrap ctabox"><div><h2>${esc(project.goal)}</h2><p>راجع هذه المعاينة ثم اعتمد المحتوى والهوية أو اطلب تعديلهما.</p></div><a class="btn" href="#top">مراجعة الموقع</a></div></section></main><footer><div class="wrap">${esc(project.name)} — معاينة متجاوبة مولدة من موجز المشروع.</div></footer></body></html>`;
}

export async function generateSitePreview(project: SitePreviewProject) {
  // Build the preview directly and deterministically from the saved project data.
  // The long AI HTML request (generatePremiumSitePreview) was the main source of finalize/preview
  // 504s, so it is no longer used at this stage. The output stays safe, RTL, mobile-first and
  // responsive. buildFallbackPreview / buildDemoPreview and the premium builder remain available.
  return buildAdaptivePreview(project);
}
export function buildDemoPreview() {
  return buildFallbackPreview({
    name: 'نَسَق',
    brief: 'نَسَق منصة عربية ترتب عمل تسعة وكلاء متخصصين وتحول الفكرة إلى معاينة موقع حقيقية قابلة للمشاركة.',
    audience: 'أصحاب الأعمال والوكالات والمستقلون في السعودية',
    goal: 'تحويل الفكرة إلى قرار تصميم ورابط عرض واضح',
    style: 'تقني فاخر، حبر داكن، سماوي وبنفسجي، Mobile First',
    synthesis: {
      executiveSummary: 'تجربة تبيع النتيجة بدل المصطلحات: يرى العميل فريق الوكلاء يعمل، يفهم القرارات، ثم يفتح موقعًا حقيقيًا قابلًا للمشاركة.',
      positioning: 'تسعة تخصصات تعمل كاستوديو واحد',
      designDirection: 'خلفية حبرية عميقة، سماوي مضيء، بنفسجي بارد، طبقات واضحة وحركة وظيفية هادئة.',
      primaryJourney: ['فهم الوعد', 'مشاهدة العمل الحي', 'إنشاء الموجز', 'متابعة الوكلاء', 'مراجعة القرار', 'فتح المعاينة'],
      pages: [
        { name: 'تحليل الموجز', purpose: 'تحويل الفكرة إلى أهداف قابلة للفحص', sections: ['مواصفات', 'معايير قبول'] },
        { name: 'مجلس الوكلاء', purpose: 'إظهار عمل التخصصات التسعة لحظة بلحظة', sections: ['3 موجات', 'سجل مباشر'] },
        { name: 'المعاينة', purpose: 'تسليم رابط موقع متجاوب للعميل', sections: ['كمبيوتر', 'جوال'] }
      ]
    }
  });
}

export function htmlResponse(html: string) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: https:; script-src 'none'; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff'
    },
    body: html
  };
}
