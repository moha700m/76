import { ai } from '@appdeploy/sdk';

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
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html) || html.length < 1600) return '';
  return html;
}

export function buildFallbackPreview(project: SitePreviewProject) {
  const synthesis = project.synthesis || {};
  const executive = esc(synthesis.executiveSummary || project.brief);
  const positioning = esc(synthesis.positioning || project.goal);
  const direction = esc(synthesis.designDirection || project.style);
  const journey = strings(synthesis.primaryJourney, ['فهم الاحتياج', 'اختيار الحل', 'إرسال الطلب', 'بدء التنفيذ']);
  const rawPages = Array.isArray(synthesis.pages) ? synthesis.pages : [];
  const pages = rawPages.slice(0, 6).map(item => {
    const page = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { name: esc(page.name || 'حل رئيسي'), purpose: esc(page.purpose || 'شرح الحل بوضوح'), sections: strings(page.sections).slice(0, 4).map(esc) };
  });
  const cards = (pages.length ? pages : [
    { name: 'الخدمة الأساسية', purpose: 'عرض القيمة الرئيسية للعميل بوضوح', sections: ['حل مخصص', 'تنفيذ واضح'] },
    { name: 'طريقة العمل', purpose: 'شرح المراحل من الطلب إلى التسليم', sections: ['موجز', 'تنفيذ'] },
    { name: 'بدء التواصل', purpose: 'تسهيل اتخاذ الخطوة التالية', sections: ['طلب سريع', 'رد واضح'] }
  ]).map((page, index) => `<article class="card"><span>0${index + 1}</span><h3>${page.name}</h3><p>${page.purpose}</p><div>${page.sections.map(section => `<small>${section}</small>`).join('')}</div></article>`).join('');
  const steps = journey.slice(0, 6).map((step, index) => `<li><b>${index + 1}</b><span>${esc(step)}</span></li>`).join('');
  const name = esc(project.name);
  const initial = esc(project.name.trim().slice(0, 1) || 'م');

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet"><style>
:root{--bg:#05070b;--surface:#0a0e15;--line:#1b2736;--text:#f7fbff;--muted:#a8b4c3;--cyan:#73e7ff;--violet:#9d8cff}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:'Noto Sans Arabic',sans-serif;line-height:1.8}body:before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 12% 10%,rgba(115,231,255,.09),transparent 30%),radial-gradient(circle at 88% 52%,rgba(157,140,255,.08),transparent 30%);z-index:-1}h1,h2,h3,.brand{font-family:'Cairo',sans-serif}.wrap{width:min(1180px,calc(100% - 40px));margin:auto}a{color:inherit;text-decoration:none}.nav{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--line);background:rgba(5,7,11,.88);backdrop-filter:blur(18px)}.navin{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:12px;font-weight:800}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--cyan),var(--violet));color:var(--bg)}.links{display:flex;gap:22px;color:var(--muted);font-size:13px}.btn,.ghost{display:inline-flex;align-items:center;justify-content:center;padding:12px 22px;border-radius:14px;font-weight:700;transition:.25s}.btn{background:var(--cyan);color:var(--bg)}.btn:hover{background:white;transform:translateY(-2px)}.ghost{border:1px solid #2b3b4e;background:var(--surface)}.hero{min-height:720px;display:grid;align-items:center;padding:80px 0}.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:55px;align-items:center}.tag{display:inline-flex;padding:6px 12px;border:1px solid rgba(115,231,255,.2);border-radius:999px;background:rgba(115,231,255,.06);color:#9af0ff;font-size:12px}.hero h1{font-size:clamp(42px,6.5vw,76px);line-height:1.2;margin:22px 0}.hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--cyan),#c3bbff);-webkit-background-clip:text;color:transparent}.hero p{font-size:18px;color:var(--muted)}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.showcase{border:1px solid #2b3b4e;border-radius:32px;padding:28px;background:linear-gradient(145deg,#101925,#080b11);box-shadow:0 36px 100px rgba(0,0,0,.5)}.showcase h2{font-size:28px;margin:44px 0 10px}.showcase p{color:var(--muted)}.signal{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:28px}.signal div{border:1px solid var(--line);border-radius:16px;padding:15px;text-align:center}.signal b{display:block;color:var(--cyan)}.section{padding:95px 0;border-top:1px solid var(--line)}.section h2{font-size:clamp(30px,5vw,48px);margin:0 0 12px}.section-copy{max-width:680px;color:var(--muted);margin-bottom:40px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{border:1px solid var(--line);border-radius:24px;background:var(--surface);padding:25px;transition:.25s}.card:hover{transform:translateY(-5px);border-color:rgba(115,231,255,.3)}.card>span{color:var(--cyan);font-size:12px}.card h3{margin:30px 0 8px}.card p{color:var(--muted);min-height:60px}.card small{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:4px 9px;margin:3px;color:#768496}.split{display:grid;grid-template-columns:.9fr 1.1fr;gap:45px}.statement{border:1px solid #2b3b4e;border-radius:28px;padding:32px;background:linear-gradient(145deg,#111925,var(--surface))}.statement p{color:var(--muted)}.steps{list-style:none;padding:0;margin:0;display:grid;gap:12px}.steps li{display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:18px;padding:17px;background:var(--surface)}.steps b{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:rgba(115,231,255,.1);color:var(--cyan)}.cta{padding:80px 0 100px}.cta-box{border:1px solid rgba(115,231,255,.25);border-radius:32px;padding:45px;background:linear-gradient(120deg,rgba(115,231,255,.14),rgba(157,140,255,.1),var(--surface));display:flex;align-items:center;justify-content:space-between;gap:25px}.footer{padding:30px 0;border-top:1px solid var(--line);color:#768496;font-size:12px}@media(max-width:850px){.links{display:none}.hero-grid,.split{grid-template-columns:1fr}.cards{grid-template-columns:1fr 1fr}.cta-box{display:block}.cta-box .btn{margin-top:22px}}@media(max-width:560px){.wrap{width:min(100% - 24px,1180px)}.hero{padding:65px 0;min-height:auto}.hero h1{font-size:40px}.actions a{width:100%}.cards{grid-template-columns:1fr}.signal{grid-template-columns:1fr}.section{padding:70px 0}}
</style></head><body><nav class="nav"><div class="wrap navin"><a class="brand" href="#top"><span class="mark">${initial}</span>${name}</a><div class="links"><a href="#services">الحلول</a><a href="#journey">طريقة العمل</a><a href="#contact">ابدأ الآن</a></div><a class="btn" href="#contact">طلب الخدمة ↗</a></div></nav><main id="top"><section class="hero"><div class="wrap hero-grid"><div><span class="tag">حل رقمي مبني على احتياج حقيقي</span><h1>${positioning}<br><em>${esc(project.goal)}</em></h1><p>${executive}</p><div class="actions"><a class="btn" href="#contact">ابدأ طلبك ↗</a><a class="ghost" href="#services">استكشف الحل</a></div><small>مصمم للجمهور: ${esc(project.audience)}</small></div><div class="showcase"><span class="tag">LIVE PREVIEW</span><h2>${esc(project.goal)}</h2><p>${direction}</p><div class="signal"><div><b>واضح</b><small>رسالة مباشرة</small></div><div><b>متجاوب</b><small>جوال وكمبيوتر</small></div><div><b>مركّز</b><small>إجراء رئيسي</small></div></div></div></div></section><section class="section" id="services"><div class="wrap"><h2>أقسام تخدم القرار، لا تملأ الصفحة.</h2><p class="section-copy">تم تحويل مخرجات مجلس التصميم إلى بنية يمكن للعميل تصفحها ومراجعتها فعليًا.</p><div class="cards">${cards}</div></div></section><section class="section" id="journey"><div class="wrap split"><div class="statement"><small>DESIGN DIRECTION</small><h2>${esc(project.style)}</h2><p>${direction}</p></div><div><h2>من الفهم إلى اتخاذ الإجراء.</h2><ol class="steps">${steps}</ol></div></div></section><section class="cta" id="contact"><div class="wrap cta-box"><div><h2>جاهز للانتقال من المعاينة إلى التنفيذ؟</h2><p>راجع المحتوى والهوية، ثم اعتمد النسخة قبل النشر النهائي.</p></div><a class="btn" href="#top">مراجعة الموقع ↑</a></div></section></main><footer class="footer"><div class="wrap">${name} — معاينة تصميمية مولدة من بيانات المشروع، دون أرقام أو ادعاءات غير مقدمة.</div></footer></body></html>`;
}

export async function generateSitePreview(project: SitePreviewProject) {
  const content = JSON.stringify({
    project: { name: project.name, brief: project.brief, audience: project.audience, goal: project.goal, style: project.style },
    synthesis: project.synthesis,
    agents: (project.agentOutputs || []).map(agent => ({ name: agent.name, summary: agent.summary, confidence: agent.confidence, status: agent.status }))
  }).slice(0, 30000);
  try {
    const result = await ai.generate({
      system: 'أنت مصمم ومطور واجهات عربي senior. أنشئ ملف HTML واحدًا كاملًا لمعاينة موقع عميل حقيقية، RTL ومتجاوبة Mobile First. أخرج HTML فقط دون markdown. استخدم CSS داخل الملف ولا تستخدم JavaScript أو iframe أو مكتبات أو صور خارجية. اجعل التصميم مخصصًا للمشروع لا قالبًا عامًا، مع هوية واضحة وتسلسل بصري قوي وحالات hover وتنقل داخلي. لا تخترع أرقامًا أو شهادات أو عملاء أو عناوين أو وسائل تواصل أو مزايا غير موجودة في البيانات. لا تعرض مصطلحات الوكلاء داخل موقع العميل إلا إذا كان المشروع نفسه منصة وكلاء. التزم بتباين جيد وأزرار واضحة ومساحات مريحة.',
      prompt: 'حوّل قرار مجلس التصميم التالي إلى موقع عربي متكامل قابل للعرض على العميل. يجب أن يحتوي تنقلًا، Hero قويًا، أقسام خدمة أو منتج خاصة بالمشروع، طريقة عمل أو رحلة مستخدم، دليلًا مبنيًا فقط على المعلومات المقدمة، دعوة إجراء، وتذييلًا واضحًا.\n\nبيانات المشروع:\n' + content,
      maxTokens: 6500,
      temperature: 0.4,
      thinkingMode: 'FAST'
    });
    const cleaned = sanitizeGeneratedHtml(result.text);
    if (cleaned) return cleaned;
  } catch (err) {
    console.error('site_preview_generation_failed', err);
  }
  return buildFallbackPreview(project);
}

export function buildDemoPreview() {
  return buildFallbackPreview({
    name: 'مرصد تسعة Pro',
    brief: 'منصة عربية تشغّل تسعة وكلاء متخصصين ثم تبني معاينة موقع حقيقية قابلة للمشاركة.',
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
