// Derives a unified DesignDNA and normalized content from a project brief (+ optional synthesis).
import type {
  ColorMood, DesignDNA, Industry, PreviewContent, PreviewProject, SectionKind, Tone
} from './types.ts';

// Small, stable string hash (FNV-1a) used for deterministic variant selection.
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function detectIndustry(text: string): Industry {
  const v = text.toLowerCase();
  if (/قهوة|بن|محمصة|كافيه|coffee/.test(v)) return 'coffee';
  if (/حضانة|أطفال|روضة|nursery|kids/.test(v)) return 'nursery';
  if (/صيانة|فني|سباك|كهرب|maintenance|repair/.test(v)) return 'maintenance';
  if (/عيادة|طبي|أسنان|clinic|dental|health/.test(v)) return 'clinic';
  if (/عقار|شقق|إيجار|realestate|property/.test(v)) return 'realestate';
  if (/مطعم|مأكولات|restaurant|food/.test(v)) return 'restaurant';
  if (/متجر|منتج|بيع|تجارة|store|shop|ecommerce/.test(v)) return 'retail';
  if (/وكالة|تسويق|استوديو|agency|studio|design/.test(v)) return 'agency';
  return 'generic';
}

function detectTone(style: string): Tone {
  const v = style.toLowerCase();
  if (/فاخر|ذهبي|أسود|luxury|premium/.test(v)) return 'luxury';
  if (/تقني|ستارت|حديث|modern|tech|startup/.test(v)) return 'modern';
  if (/مؤسسي|رسمي|corporate|clean|formal/.test(v)) return 'corporate';
  if (/جريء|قوي|bold|landing|vivid/.test(v)) return 'bold';
  if (/دافئ|ورقي|عاجي|بني|زيتوني|warm|earthy/.test(v)) return 'warm';
  if (/إبداعي|فني|creative|artistic|studio/.test(v)) return 'creative';
  return 'modern';
}

function detectColorMood(style: string, tone: Tone): ColorMood {
  const v = style.toLowerCase();
  if (/داكن|أسود|dark|ليلي|نيون|neon/.test(v)) return 'dark';
  if (/دافئ|ورقي|عاجي|بني|warm/.test(v)) return 'warm';
  if (/فاتح|أبيض|light|ناصع/.test(v)) return 'light';
  if (/حيوي|زاهي|vibrant|bold|جريء/.test(v)) return 'vibrant';
  if (tone === 'luxury') return 'dark';
  if (tone === 'warm') return 'warm';
  if (tone === 'corporate') return 'light';
  return 'muted';
}

function isRtl(text: string): boolean {
  // Default to RTL for this Arabic-first product; only flip to LTR for clearly Latin-only briefs.
  return /[؀-ۿ]/.test(text) || !/[a-z]/i.test(text);
}

export function deriveDesignDNA(project: PreviewProject): DesignDNA {
  const corpus = `${project.name} ${project.brief} ${project.goal}`;
  const industry = detectIndustry(corpus);
  const tone = detectTone(project.style);
  const colorMood = detectColorMood(project.style, tone);
  return {
    industry,
    audience: project.audience || 'جمهورك المستهدف',
    tone,
    goal: project.goal || 'اتخاذ الإجراء الرئيسي',
    colorMood,
    sectionsNeeded: sectionsForIndustry(industry),
    rtl: isRtl(corpus)
  };
}

// Section plan per industry: keep it focused, always include hero + cta + footer.
export function sectionsForIndustry(industry: Industry): SectionKind[] {
  const lean: SectionKind[] = ['hero', 'highlights', 'services', 'process', 'cta', 'footer'];
  switch (industry) {
    case 'coffee': return ['hero', 'highlights', 'services', 'gallery', 'process', 'testimonials', 'faq', 'cta', 'footer'];
    case 'restaurant': return ['hero', 'gallery', 'highlights', 'services', 'testimonials', 'faq', 'cta', 'footer'];
    case 'retail': return ['hero', 'highlights', 'services', 'gallery', 'testimonials', 'faq', 'cta', 'footer'];
    case 'clinic': return ['hero', 'highlights', 'services', 'process', 'testimonials', 'faq', 'cta', 'footer'];
    case 'maintenance': return ['hero', 'highlights', 'services', 'process', 'testimonials', 'cta', 'footer'];
    case 'realestate': return ['hero', 'gallery', 'highlights', 'services', 'process', 'testimonials', 'cta', 'footer'];
    case 'nursery': return ['hero', 'highlights', 'services', 'gallery', 'process', 'testimonials', 'faq', 'cta', 'footer'];
    case 'agency': return ['hero', 'highlights', 'services', 'process', 'gallery', 'testimonials', 'faq', 'cta', 'footer'];
    default: return lean;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(x => typeof x === 'string') as string[] : [];
}

// Builds normalized content, preferring saved synthesis.publicContent when available,
// then synthesis fields, then project-derived defaults. Never invents specific claims.
export function buildContent(project: PreviewProject, dna: DesignDNA): PreviewContent {
  const s = (project.synthesis || {}) as Record<string, unknown>;
  const pc = (s.publicContent && typeof s.publicContent === 'object' ? s.publicContent : {}) as Record<string, unknown>;
  const hero = (pc.hero && typeof pc.hero === 'object' ? pc.hero : {}) as Record<string, unknown>;
  const pcSections = Array.isArray(pc.sections) ? pc.sections as Array<Record<string, unknown>> : [];
  const pages = Array.isArray(s.pages) ? s.pages as Array<Record<string, unknown>> : [];

  const serviceSource = pcSections.length ? pcSections.map(x => ({
    title: String(x.title || x.kicker || 'قسم'),
    body: String(x.body || 'محتوى مرتبط بالمشروع.')
  })) : pages.map(p => ({
    title: String(p.name || 'قسم'),
    body: String(p.purpose || 'محتوى مرتبط بالمشروع.')
  }));

  const services = (serviceSource.length ? serviceSource : industryServices(dna.industry)).slice(0, 6);

  return {
    brandName: String(pc.brandName || project.name),
    tagline: String(hero.eyebrow || dna.audience),
    heroTitle: String(hero.title || s.positioning || project.name),
    heroBody: String(hero.body || s.executiveSummary || project.brief),
    primaryCta: String(hero.primaryCta || 'ابدأ الآن'),
    secondaryCta: String(hero.secondaryCta || 'استكشف العرض'),
    services,
    testimonials: buildTestimonials(project, dna),
    ctaTitle: String((pc.closing as Record<string, unknown>)?.title || project.goal),
    ctaBody: String((pc.closing as Record<string, unknown>)?.body || 'راجع المحتوى والهوية ثم اعتمد النسخة.'),
    footerLine: String(pc.footerLine || project.name),
    navigation: (asStringArray(pc.navigation).length ? asStringArray(pc.navigation) : ['الرئيسية', 'العرض', 'ابدأ']).slice(0, 5),
    highlights: buildHighlights(dna),
    steps: buildSteps(project, dna),
    gallery: buildGallery(services),
    faqs: buildFaqs(dna)
  };
}

// Qualitative value props only — never fabricated numbers or claims.
function buildHighlights(dna: DesignDNA): string[] {
  return ['هوية مخصصة لمشروعك', 'تجربة جوال أولًا', `محتوى عربي واضح لـ ${dna.audience}`, 'رحلة قصيرة نحو الإجراء'];
}

function buildSteps(project: PreviewProject, dna: DesignDNA): Array<{ title: string; desc: string }> {
  const s = (project.synthesis || {}) as Record<string, unknown>;
  const journey = Array.isArray(s.primaryJourney) ? (s.primaryJourney as unknown[]).filter(x => typeof x === 'string') as string[] : [];
  const base = journey.length >= 3 ? journey : ['فهم وعد المشروع', 'استكشاف العرض المناسب', 'معرفة طريقة الاستخدام', `اتخاذ الإجراء: ${dna.goal}`];
  return base.slice(0, 4).map((title, i) => ({
    title,
    desc: i === 0 ? 'نبدأ بفهم الهدف والسياق.' : i === base.length - 1 ? 'ننتقل إلى الإجراء بثقة.' : 'خطوة مترابطة تبني على ما قبلها.'
  }));
}

function buildGallery(services: Array<{ title: string; body: string }>): string[] {
  const labels = services.map(x => x.title).filter(Boolean);
  const fill = ['واجهة', 'تفاصيل', 'تجربة', 'هوية', 'محتوى', 'خطوة'];
  return (labels.length ? labels : fill).slice(0, 6);
}

function buildFaqs(dna: DesignDNA): Array<{ q: string; a: string }> {
  return [
    { q: 'كيف أبدأ؟', a: `تواصل معنا ونوضح لك الخطوات المناسبة لـ ${dna.audience}.` },
    { q: 'ما الذي يميّز التجربة؟', a: `${dna.goal} عبر تجربة واضحة ومحتوى مرتبط مباشرة بفكرتك.` },
    { q: 'هل التصميم مناسب للجوال؟', a: 'نعم، مبني جوال أولًا ومتجاوب مع جميع المقاسات.' }
  ];
}

function industryServices(industry: Industry): Array<{ title: string; body: string }> {
  const map: Record<Industry, Array<[string, string]>> = {
    coffee: [['اختيارات القهوة', 'استكشف المحاصيل والخلطات المناسبة لذائقتك'], ['تجربة التحضير', 'محتوى يساعدك على اختيار طريقة التحضير'], ['من الحبة إلى الكوب', 'رحلة واضحة تشرح جودة التجربة']],
    nursery: [['البرامج اليومية', 'أنشطة مناسبة لأعمار الأطفال'], ['بيئة آمنة', 'راحة الطفل وثقة ولي الأمر'], ['احجز زيارة', 'خطوة واضحة للتعرف على الحضانة']],
    maintenance: [['اختر الخدمة', 'وصول سريع لنوع الصيانة المطلوبة'], ['موعد واضح', 'حجز وتأكيد ومتابعة'], ['ثقة من البداية', 'ما تحتاج معرفته قبل الطلب']],
    retail: [['المنتجات', 'عرض منظم يسهّل الاختيار'], ['لماذا نحن', 'القيمة والهوية بوضوح'], ['ابدأ الطلب', 'مسار مختصر نحو الشراء']],
    clinic: [['الخدمات الطبية', 'تخصصات واضحة مناسبة لاحتياجك'], ['حجز موعد', 'خطوات بسيطة وسريعة'], ['رعاية موثوقة', 'ما يميز تجربة العيادة']],
    realestate: [['الوحدات المتاحة', 'عروض منظمة حسب احتياجك'], ['جولة وتفاصيل', 'معلومات واضحة قبل الزيارة'], ['تواصل الآن', 'خطوة سريعة للحجز']],
    restaurant: [['القائمة', 'أطباق مختارة تعرض تجربتك'], ['التجربة', 'أجواء وخدمة واضحة'], ['احجز طاولة', 'خطوة مباشرة للطلب أو الحجز']],
    agency: [['خدماتنا', 'ما نقدمه وكيف يخدم هدفك'], ['طريقة العمل', 'رحلة من الفكرة إلى التنفيذ'], ['ابدأ مشروعك', 'خطوة أولى واضحة']],
    generic: [['ما نقدمه', 'الفكرة والخدمات المرتبطة بها'], ['كيف تعمل التجربة', 'رحلة بسيطة نحو الإجراء'], ['ابدأ الآن', 'دعوة واضحة للخطوة التالية']]
  };
  return map[industry].map(([title, body]) => ({ title, body }));
}

function buildTestimonials(project: PreviewProject, dna: DesignDNA): Array<{ quote: string; author: string }> {
  // Generic, non-fabricated placeholders framed as sample voices (no invented names/metrics).
  return [
    { quote: `تجربة واضحة تخدم ${dna.audience} وتوصل الفكرة بسرعة.`, author: 'رأي عميل (نموذج)' },
    { quote: `المحتوى مرتبط مباشرة بـ ${project.goal} دون حشو.`, author: 'رأي عميل (نموذج)' }
  ];
}
