import { ai } from '@appdeploy/sdk';
import type { SitePreviewProject } from './site-preview';

type PublicPlan = {
  brandName: string;
  navigation: string[];
  hero: { eyebrow: string; title: string; body: string; primaryCta: string; secondaryCta: string };
  visualMotif: string;
  sections: Array<{ kicker: string; title: string; body: string; items: string[] }>;
  closing: { title: string; body: string; cta: string };
  footerLine: string;
};

const planSchema = {
  type: 'object',
  properties: {
    brandName: { type: 'string' },
    navigation: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
    hero: {
      type: 'object',
      properties: {
        eyebrow: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' },
        primaryCta: { type: 'string' }, secondaryCta: { type: 'string' }
      },
      required: ['eyebrow', 'title', 'body', 'primaryCta', 'secondaryCta']
    },
    visualMotif: { type: 'string' },
    sections: {
      type: 'array', minItems: 5, maxItems: 7,
      items: {
        type: 'object',
        properties: {
          kicker: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' },
          items: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 }
        },
        required: ['kicker', 'title', 'body', 'items']
      }
    },
    closing: {
      type: 'object',
      properties: { title: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' } },
      required: ['title', 'body', 'cta']
    },
    footerLine: { type: 'string' }
  },
  required: ['brandName', 'navigation', 'hero', 'visualMotif', 'sections', 'closing', 'footerLine']
};

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[،؛؟.:\-_/]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
}

function leak(text: string, project: SitePreviewProject) {
  const target = normalize(text);
  const fragments = [project.brief, project.audience, project.goal, project.style]
    .flatMap(value => String(value || '').split(/[،.]/))
    .map(normalize)
    .filter(value => value.length >= 18);
  return fragments.find(fragment => target.includes(fragment)) || '';
}

function issues(html: string, project: SitePreviewProject) {
  const target = normalize(html);
  const found: string[] = [];
  if (leak(html, project)) found.push('كرر نص التخطيط الداخلي');
  const forbidden = ['موجز المشروع', 'الطابع البصري', 'الجمهور المستهدف', 'مدير نسق', 'مجلس التصميم', 'الوكلاء', 'مخرجات الوكلاء', 'راجع هذه المعاينة', 'معاينة متجاوبة', 'mobile first', 'design system', 'تم تحويل موجز'];
  if (forbidden.some(term => target.includes(normalize(term)))) found.push('أظهر مصطلحات داخلية');
  const lower = html.toLowerCase();
  if (html.length < 8500) found.push('الصفحة قصيرة');
  if ((lower.match(/<section/g) || []).length < 6) found.push('الأقسام قليلة');
  if ((lower.match(/<a\s/g) || []).length < 4) found.push('دعوات الإجراء ضعيفة');
  if (!lower.includes('<nav') || !lower.includes('<footer')) found.push('البنية ناقصة');
  if (!lower.includes('@media') || !lower.includes(':hover')) found.push('الاستجابة أو التفاعل ناقص');
  return found;
}

function validPlan(value: unknown): value is PublicPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as PublicPlan;
  return Boolean(
    plan.brandName && plan.hero?.title && plan.hero?.body &&
    Array.isArray(plan.navigation) && plan.navigation.length >= 3 &&
    Array.isArray(plan.sections) && plan.sections.length >= 5 &&
    plan.closing?.title && plan.footerLine
  );
}

function sectorPlan(project: SitePreviewProject): PublicPlan {
  const source = normalize(`${project.name} ${project.brief}`);
  if (/قهوة|بن|محمصة|محاصيل/.test(source)) {
    return {
      brandName: project.name,
      navigation: ['المحاصيل', 'الحكاية', 'التحضير', 'ابدأ طلبك'],
      hero: {
        eyebrow: 'قهوة مختارة بذائقة تعرف الفرق',
        title: 'كل كوب يبدأ من اختيار يستحقه.',
        body: 'محاصيل وشخصيات نكهة واضحة تساعدك على الوصول إلى الكوب الذي يشبه مزاجك اليومي.',
        primaryCta: 'استكشف المحاصيل',
        secondaryCta: 'اعرف حكايتنا'
      },
      visualMotif: 'طبقات ورقية دافئة مستوحاة من خطوط التحميص وحركة البخار',
      sections: [
        { kicker: 'THE SELECTION', title: 'محاصيل لها حضورها الخاص', body: 'اختيارات مرتبة لتسهّل المقارنة بين النكهات وطرق الاستمتاع بها.', items: ['نكهات واضحة', 'اختيار أسهل', 'تجربة متجددة'] },
        { kicker: 'ROAST CHARACTER', title: 'تحميص يحافظ على شخصية الحبة', body: 'الهدف ليس لونًا واحدًا؛ بل إبراز ما يميز كل محصول في الكوب.', items: ['توازن', 'وضوح', 'اتساق'] },
        { kicker: 'BREW GUIDE', title: 'ابدأ بطريقتك المفضلة', body: 'خطوات مختصرة تقرّبك من نتيجة متوازنة دون تعقيد.', items: ['ترشيح', 'إسبريسو', 'تحضير منزلي'] },
        { kicker: 'THE RITUAL', title: 'لحظة صغيرة تغيّر إيقاع اليوم', body: 'تجربة هادئة من فتح العبوة حتى أول رشفة.', items: ['رائحة', 'ملمس', 'نكهة'] },
        { kicker: 'GIFTING', title: 'هدية يعرفها محب القهوة', body: 'اختيارات أنيقة للمناسبات واللحظات التي تستحق مشاركة الذائقة.', items: ['اختيار مدروس', 'تقديم أنيق', 'ذكرى طيبة'] }
      ],
      closing: { title: 'اختر محصلك القادم.', body: 'ابدأ من النكهة التي تحبها ودع بقية التجربة تتكشف في الكوب.', cta: 'ابدأ الاختيار' },
      footerLine: 'قهوة تُختار بعناية وتُروى بطريقتها.'
    };
  }
  if (/ذهب|مجوهرات|مجوهر|ألماس/.test(source)) {
    return {
      brandName: project.name,
      navigation: ['المجموعات', 'الحرفية', 'المناسبات', 'ابدأ الاختيار'],
      hero: { eyebrow: 'تفاصيل تبقى أبعد من اللحظة', title: 'قطعة تختصر حضورك دون مبالغة.', body: 'اختيارات أنيقة تجمع صفاء الخطوط ودفء الذهب لترافق المناسبات واللحظات اليومية.', primaryCta: 'استكشف المجموعة', secondaryCta: 'اكتشف الحرفية' },
      visualMotif: 'أقواس ذهبية رفيعة ومساحات سوداء عميقة تحاكي انعكاس المعدن',
      sections: [
        { kicker: 'SIGNATURE', title: 'خطوط تعرف متى تتكلم', body: 'تصاميم واضحة الحضور تترك للمادة والتفصيل فرصة الظهور.', items: ['توازن', 'نعومة', 'حضور'] },
        { kicker: 'CRAFT', title: 'الحرفية في ما لا يُرى أولًا', body: 'جودة القطعة تبدأ من دقة الإنهاء وراحة الارتداء.', items: ['تشطيب', 'ملمس', 'اتساق'] },
        { kicker: 'OCCASIONS', title: 'لكل لحظة اختيارها', body: 'من الهدية الهادئة إلى القطعة التي تعلن المناسبة.', items: ['هدية', 'احتفال', 'يومي'] },
        { kicker: 'CURATION', title: 'مجموعة أقل، اختيار أوضح', body: 'تنظيم يساعدك على الوصول إلى ما يلائم ذائقتك بسرعة.', items: ['خواتم', 'أساور', 'قلائد'] },
        { kicker: 'CARE', title: 'جمال يستمر بالعناية الصحيحة', body: 'إرشادات بسيطة تحافظ على اللمعان والحضور.', items: ['حفظ', 'تنظيف', 'استخدام'] }
      ],
      closing: { title: 'اختر القطعة التي تشبه اللحظة.', body: 'ابدأ من المجموعة الأقرب لذائقتك.', cta: 'ابدأ الاختيار' },
      footerLine: 'تفاصيل مصنوعة لتبقى.'
    };
  }
  return {
    brandName: project.name,
    navigation: ['ما نقدمه', 'كيف نعمل', 'التجربة', 'ابدأ الآن'],
    hero: { eyebrow: 'فكرة واضحة، تجربة أسهل', title: 'كل ما تحتاجه في مسار أقصر.', body: 'تجربة عربية مرتبة تساعدك على فهم الخيارات والوصول إلى الخطوة المناسبة بثقة.', primaryCta: 'ابدأ الآن', secondaryCta: 'اكتشف المزيد' },
    visualMotif: 'طبقات هندسية هادئة ومساحات متوازنة تعبّر عن الوضوح والحركة',
    sections: [
      { kicker: 'VALUE', title: 'القيمة تظهر من أول لحظة', body: 'رسالة واضحة تضع الأهم في المقدمة وتترك التفاصيل في مكانها الصحيح.', items: ['وضوح', 'تركيز', 'سهولة'] },
      { kicker: 'OFFER', title: 'خيارات منظمة حول احتياجك', body: 'عرض يسهل استكشافه ومقارنته دون ازدحام.', items: ['اختيار', 'مقارنة', 'قرار'] },
      { kicker: 'JOURNEY', title: 'خطوات تعرف إلى أين تقودك', body: 'من الاستكشاف إلى الإجراء في رحلة قصيرة ومفهومة.', items: ['اكتشاف', 'فهم', 'بدء'] },
      { kicker: 'EXPERIENCE', title: 'تفاصيل تخدم الاستخدام', body: 'تفاعل هادئ وسريع ومتجاوب مع مختلف الشاشات.', items: ['سرعة', 'استجابة', 'اتساق'] },
      { kicker: 'NEXT', title: 'الخطوة التالية أمامك دائمًا', body: 'دعوة واضحة تظهر في الوقت المناسب دون ضغط أو تشتيت.', items: ['تواصل', 'طلب', 'متابعة'] }
    ],
    closing: { title: 'ابدأ بخطوة واضحة.', body: 'اختر المسار المناسب واترك الباقي لتجربة مرتبة.', cta: 'ابدأ الآن' },
    footerLine: 'تجربة أبسط لقرار أوضح.'
  };
}

function theme(project: SitePreviewProject) {
  const synthesis = project.synthesis || {};
  const designSystem = synthesis.designSystem && typeof synthesis.designSystem === 'object' ? synthesis.designSystem as Record<string, unknown> : {};
  const palette = Array.isArray(designSystem.palette) ? designSystem.palette.map(String).filter(value => /^#[0-9a-f]{6}$/i.test(value)) : [];
  const value = normalize(project.style);
  const fallback = /عاجي|بني|زيتوني|دافئ|ورقي|قهوة|ترابي/.test(value)
    ? ['#F2E8D8', '#FFF9EF', '#2E241D', '#66713D', '#B36A3E', '#DCC9AE']
    : /فاخر|ذهبي|أسود|luxury|ذهب/.test(value)
      ? ['#0C0B09', '#17140F', '#F4EBDD', '#B58B45', '#D8C29A', '#332B20']
      : /تقني|داكن|سماوي|بنفسجي|نيون/.test(value)
        ? ['#05070B', '#0B1018', '#F6FBFF', '#69DDF6', '#8F82F4', '#263448']
        : ['#F3F0E9', '#FFFFFF', '#19231E', '#2E6B50', '#D1895E', '#D8DED9'];
  const colors = [...palette, ...fallback];
  return { bg: colors[0], surface: colors[1], text: colors[2], accent: colors[3], accent2: colors[4], line: colors[5] };
}

function buildPremiumFallback(project: SitePreviewProject, plan: PublicPlan) {
  const colors = theme(project);
  const first = plan.sections.slice(0, 3);
  const rest = plan.sections.slice(3);
  const nav = plan.navigation.slice(0, 4).map((item, index) => `<a href="#s${index + 1}">${esc(item)}</a>`).join('');
  const cards = first.map((section, index) => `<article class="feature"><div class="feature-no">0${index + 1}</div><span>${esc(section.kicker)}</span><h3>${esc(section.title)}</h3><p>${esc(section.body)}</p><ul>${section.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></article>`).join('');
  const stories = rest.map((section, index) => `<article class="story" id="s${index + 2}"><div class="story-copy"><span>${esc(section.kicker)}</span><h3>${esc(section.title)}</h3><p>${esc(section.body)}</p></div><div class="story-list">${section.items.map((item, itemIndex) => `<div><b>0${itemIndex + 1}</b><strong>${esc(item)}</strong></div>`).join('')}</div></article>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(plan.brandName)}</title><style>
:root{--bg:${colors.bg};--surface:${colors.surface};--text:${colors.text};--accent:${colors.accent};--accent2:${colors.accent2};--line:${colors.line};--muted:color-mix(in srgb,var(--text) 62%,transparent)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:"Noto Sans Arabic",Tahoma,Arial,sans-serif;line-height:1.75;overflow-x:hidden}a{color:inherit;text-decoration:none}.wrap{width:min(1180px,calc(100% - 38px));margin:auto}.nav{position:sticky;top:0;z-index:40;border-bottom:1px solid color-mix(in srgb,var(--line) 72%,transparent);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(22px)}.navin{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:12px;font-weight:900;font-size:19px}.brand-mark{width:38px;height:38px;border-radius:50% 50% 42% 58%;background:linear-gradient(145deg,var(--accent),var(--accent2));box-shadow:0 10px 30px color-mix(in srgb,var(--accent) 28%,transparent)}.links{display:flex;gap:28px;font-size:13px;color:var(--muted)}.links a{position:relative}.links a:after{content:"";position:absolute;right:0;left:100%;bottom:-6px;height:1px;background:var(--accent);transition:.25s}.links a:hover:after{left:0}.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:12px 21px;border-radius:999px;background:var(--accent);color:var(--surface);font-weight:900;transition:.25s;border:1px solid transparent}.btn:hover{transform:translateY(-3px);box-shadow:0 14px 34px color-mix(in srgb,var(--accent) 28%,transparent)}.btn.ghost{background:transparent;color:var(--text);border-color:var(--line)}.hero{position:relative;min-height:760px;display:grid;align-items:center;padding:80px 0 92px}.hero:before{content:"";position:absolute;width:520px;height:520px;border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);border-radius:48% 52% 58% 42%;left:-240px;top:40px;transform:rotate(24deg);opacity:.55}.hero-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:70px;align-items:center}.eyebrow,.kicker{font-size:11px;font-weight:900;letter-spacing:.13em;color:var(--accent)}.hero h1{font-size:clamp(48px,7.4vw,88px);line-height:1.08;letter-spacing:-2px;margin:20px 0 24px;max-width:800px}.hero-copy>p{font-size:19px;color:var(--muted);max-width:650px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}.art{position:relative;min-height:520px}.art-frame{position:absolute;inset:26px 0 26px 56px;border:1px solid var(--line);border-radius:220px 220px 42px 42px;background:linear-gradient(155deg,color-mix(in srgb,var(--surface) 96%,transparent),color-mix(in srgb,var(--accent) 14%,var(--surface)));overflow:hidden;box-shadow:0 45px 120px color-mix(in srgb,var(--text) 14%,transparent)}.art-frame:before{content:"";position:absolute;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle at 32% 30%,color-mix(in srgb,var(--accent2) 85%,white),var(--accent2) 34%,transparent 35%);left:-80px;top:-70px;opacity:.72}.art-frame:after{content:"";position:absolute;width:270px;height:440px;border:1px solid color-mix(in srgb,var(--accent) 58%,transparent);border-radius:160px;right:38px;bottom:-180px;transform:rotate(-18deg);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 28%,transparent),transparent)}.art-card{position:absolute;right:34px;left:92px;bottom:34px;padding:26px;border-radius:28px;border:1px solid color-mix(in srgb,var(--line) 74%,transparent);background:color-mix(in srgb,var(--surface) 84%,transparent);backdrop-filter:blur(16px)}.art-card small{display:block;color:var(--muted);margin-bottom:8px}.art-card strong{font-size:26px}.marquee{border-block:1px solid var(--line);overflow:hidden;background:var(--surface)}.marquee-track{display:flex;gap:54px;width:max-content;padding:15px 0;animation:flow 24s linear infinite;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.08em}.marquee-track span:before{content:"✦";color:var(--accent);margin-left:54px}@keyframes flow{to{transform:translateX(40%)}}.section{padding:105px 0}.section-head{display:grid;grid-template-columns:.72fr 1.28fr;gap:40px;align-items:end;margin-bottom:48px}.section-head h2{font-size:clamp(34px,5.4vw,62px);line-height:1.2;margin:8px 0}.section-head p{color:var(--muted);margin:0}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.feature{min-height:390px;padding:26px;border:1px solid var(--line);border-radius:30px;background:var(--surface);display:flex;flex-direction:column;transition:.3s;overflow:hidden;position:relative}.feature:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;background:var(--accent);opacity:.06;left:-70px;bottom:-70px}.feature:hover{transform:translateY(-8px);border-color:color-mix(in srgb,var(--accent) 60%,var(--line));box-shadow:0 26px 70px color-mix(in srgb,var(--text) 10%,transparent)}.feature-no{align-self:flex-start;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:10px;color:var(--muted)}.feature>span{margin-top:auto;color:var(--accent);font-size:10px;font-weight:900;letter-spacing:.12em}.feature h3{font-size:25px;line-height:1.4;margin:12px 0}.feature p{color:var(--muted)}.feature ul{display:flex;flex-wrap:wrap;gap:7px;padding:0;margin:18px 0 0;list-style:none}.feature li{padding:5px 10px;border:1px solid var(--line);border-radius:999px;font-size:10px;color:var(--muted)}.manifesto{padding:80px 0;background:var(--text);color:var(--bg);position:relative;overflow:hidden}.manifesto:after{content:"${esc(plan.visualMotif)}";position:absolute;left:-10px;bottom:-30px;font-size:clamp(50px,10vw,150px);font-weight:900;opacity:.035;white-space:nowrap}.manifesto-grid{display:grid;grid-template-columns:.7fr 1.3fr;gap:60px;align-items:center}.manifesto strong{font-size:clamp(34px,5vw,64px);line-height:1.3}.manifesto p{font-size:18px;opacity:.66}.stories{display:grid;gap:18px}.story{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;padding:38px;border:1px solid var(--line);border-radius:34px;background:var(--surface);align-items:center}.story-copy>span{color:var(--accent);font-size:10px;font-weight:900;letter-spacing:.12em}.story h3{font-size:34px;line-height:1.35;margin:12px 0}.story p{color:var(--muted)}.story-list{display:grid;gap:9px}.story-list div{display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--line);padding:13px 0}.story-list b{color:var(--accent);font-size:10px}.story-list strong{font-size:14px}.signature{padding:90px 0}.signature-box{min-height:420px;border-radius:44px;overflow:hidden;position:relative;background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--surface);display:grid;align-items:end;padding:48px}.signature-box:before,.signature-box:after{content:"";position:absolute;border:1px solid color-mix(in srgb,var(--surface) 45%,transparent);border-radius:50%}.signature-box:before{width:430px;height:430px;left:-100px;top:-170px}.signature-box:after{width:260px;height:260px;left:180px;top:40px}.signature-copy{position:relative;z-index:2;max-width:720px}.signature-copy span{font-size:11px;font-weight:900;letter-spacing:.13em}.signature-copy h2{font-size:clamp(38px,6vw,72px);line-height:1.18;margin:12px 0}.closing{padding:105px 0;border-top:1px solid var(--line)}.closing-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:50px;align-items:end}.closing h2{font-size:clamp(40px,6vw,74px);line-height:1.2;margin:0}.closing p{color:var(--muted);font-size:18px}.footer{padding:30px 0;border-top:1px solid var(--line);color:var(--muted);font-size:12px}.footerin{display:flex;justify-content:space-between;gap:20px}@media(max-width:900px){.links{display:none}.hero{min-height:auto}.hero-grid,.section-head,.manifesto-grid,.story,.closing-grid{grid-template-columns:1fr}.art{min-height:440px}.features{grid-template-columns:1fr 1fr}.story{gap:20px}.closing-grid{align-items:start}}@media(max-width:620px){.wrap{width:min(100% - 22px,1180px)}.navin{min-height:66px}.nav .btn{padding:9px 13px;font-size:11px}.hero{padding:60px 0 72px}.hero h1{font-size:43px;letter-spacing:-1px}.hero-copy>p{font-size:16px}.actions a{width:100%}.art{min-height:360px}.art-frame{inset:10px 0;border-radius:160px 160px 32px 32px}.art-card{right:18px;left:18px;bottom:18px}.features{grid-template-columns:1fr}.feature{min-height:330px}.section{padding:76px 0}.story{padding:25px;border-radius:26px}.story h3{font-size:28px}.signature{padding:65px 0}.signature-box{padding:28px;min-height:350px;border-radius:30px}.closing{padding:76px 0}.footerin{display:block}.footerin span+span{display:block;margin-top:8px}}
</style></head><body><nav class="nav"><div class="wrap navin"><a class="brand" href="#top"><span class="brand-mark"></span>${esc(plan.brandName)}</a><div class="links">${nav}</div><a class="btn" href="#start">${esc(plan.hero.primaryCta)}</a></div></nav><main id="top"><section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><span class="eyebrow">${esc(plan.hero.eyebrow)}</span><h1>${esc(plan.hero.title)}</h1><p>${esc(plan.hero.body)}</p><div class="actions"><a class="btn" href="#s1">${esc(plan.hero.primaryCta)} ↗</a><a class="btn ghost" href="#story">${esc(plan.hero.secondaryCta)}</a></div></div><div class="art"><div class="art-frame"><div class="art-card"><small>${esc(plan.hero.eyebrow)}</small><strong>${esc(plan.brandName)}</strong></div></div></div></div></section><div class="marquee"><div class="marquee-track">${[...plan.navigation,...plan.navigation,...plan.navigation].map(item=>`<span>${esc(item)}</span>`).join('')}</div></div><section class="section" id="s1"><div class="wrap"><div class="section-head"><div><span class="kicker">CURATED EXPERIENCE</span><h2>${esc(first[0]?.title || plan.hero.title)}</h2></div><p>${esc(first[0]?.body || plan.hero.body)}</p></div><div class="features">${cards}</div></div></section><section class="manifesto"><div class="wrap manifesto-grid"><span class="kicker">OUR POINT OF VIEW</span><div><strong>${esc(plan.visualMotif)}</strong><p>${esc(plan.footerLine)}</p></div></div></section><section class="section" id="story"><div class="wrap stories">${stories}</div></section><section class="signature"><div class="wrap signature-box"><div class="signature-copy"><span>${esc(plan.sections[1]?.kicker || 'SIGNATURE')}</span><h2>${esc(plan.sections[1]?.title || plan.hero.title)}</h2><p>${esc(plan.sections[1]?.body || plan.hero.body)}</p></div></div></section><section class="closing" id="start"><div class="wrap closing-grid"><h2>${esc(plan.closing.title)}</h2><div><p>${esc(plan.closing.body)}</p><a class="btn" href="#top">${esc(plan.closing.cta)} ↗</a></div></div></section></main><footer class="footer"><div class="wrap footerin"><strong>${esc(plan.brandName)}</strong><span>${esc(plan.footerLine)}</span></div></footer></body></html>`;
}

async function createLegacyPublicPlan(project: SitePreviewProject): Promise<PublicPlan> {
  const privatePlanning = JSON.stringify({
    privateResearch: { name: project.name, brief: project.brief, audience: project.audience, goal: project.goal, style: project.style },
    councilDecision: project.synthesis
  }).slice(0, 16000);
  const result = await ai.extract({
    system: 'أنت رئيس كتابة إبداعية عربي لمواقع العلامات التجارية. البيانات بحث خاص لا يجوز إظهاره أو اقتباسه. حوّل المعنى إلى كتابة تسويقية جديدة تبدو صادرة من العلامة نفسها. لا تذكر الجمهور المستهدف أو الموجز أو الطابع البصري أو التصميم أو الوكلاء أو المعاينة. لا تخترع أسعارًا أو أرقامًا أو شهادات أو مواقع أو وسائل تواصل.',
    prompt: 'أنشئ خطة محتوى عامة جاهزة لموقع عميل حقيقي، بخمسة أقسام أو أكثر وعناوين محددة للقطاع وليست عبارات عامة.',
    content: privatePlanning,
    schema: planSchema,
    maxRetries: 1,
    maxTokens: 2300,
    temperature: 0.42,
    thinkingMode: 'FAST'
  });
  if (!validPlan(result.data) || leak(JSON.stringify(result.data), project)) throw new Error('تعذر إنشاء محتوى عام آمن');
  return result.data as PublicPlan;
}

export async function generatePremiumSitePreview(project: SitePreviewProject, sanitize: (raw: string) => string) {
  const synthesis = project.synthesis || {};
  let plan = validPlan(synthesis.publicContent) ? synthesis.publicContent as PublicPlan : null;
  if (!plan || leak(JSON.stringify(plan), project)) {
    try { plan = await createLegacyPublicPlan(project); }
    catch { plan = sectorPlan(project); }
  }
  const deterministic = buildPremiumFallback(project, plan);
  const generationInput = JSON.stringify({
    publicContent: plan,
    visualDirectionPrivateUseOnly: synthesis.designDirection || project.style,
    designSystem: synthesis.designSystem || {},
    pageStructure: synthesis.pages || []
  }).slice(0, 18000);
  try {
    const result = await ai.generate({
      system: 'أنت مخرج فني ومطور واجهات عربي من مستوى عالمي. أنشئ ملف HTML واحدًا كاملًا لموقع عميل نهائي، RTL ومتجاوب، وأخرج HTML فقط دون markdown. استخدم CSS احترافيًا ورسومات SVG أو CSS أصلية، بلا JavaScript أو iframe أو صور خارجية. اجعل التكوين فاخرًا ومميزًا للقطاع، مع Hero توقيعي، ستة أقسام أو أكثر، إيقاع متنوع، مساحات مدروسة، حالات hover، وتوافق ممتاز للجوال. استخدم publicContent وحده للنص الظاهر. visualDirectionPrivateUseOnly مخصص للألوان والتكوين فقط ويُمنع طباعته أو شرحه. لا تذكر التخطيط أو الجمهور أو الموجز أو التصميم أو الوكلاء أو المعاينة. لا تستخدم قالب SaaS أو بطاقة تجريدية فارغة، ولا تخترع حقائق.',
      prompt: `ابنِ موقعًا كاملًا جاهزًا للعرض اعتمادًا على البيانات التالية. يجب أن تبدو الصفحة كعلامة حقيقية وليست تقرير تصميم. ${generationInput}`,
      maxTokens: 7800,
      temperature: 0.44,
      thinkingMode: 'DEEP'
    });
    const cleaned = sanitize(result.text);
    const found = cleaned ? issues(cleaned, project) : ['HTML غير مكتمل'];
    if (cleaned && !found.length) return cleaned;
    console.warn('premium_preview_quality_fallback', found.join(','));
    return deterministic;
  } catch (error) {
    console.warn('premium_preview_provider_fallback', error instanceof Error ? error.name : 'unknown');
    return deterministic;
  }
}
