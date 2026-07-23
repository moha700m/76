const URL_PATTERN = /https?:\/\/[^\s<>()"']+/gi;

export function normalizeIdea(value, maxLength = 3000) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function extractIdeaUrls(value, limit = 5) {
  const seen = new Set();
  const urls = [];
  for (const match of normalizeIdea(value).match(URL_PATTERN) || []) {
    const clean = match.replace(/[.,،؛:!?]+$/g, '');
    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push(clean);
    }
    if (urls.length >= limit) break;
  }
  return urls;
}

export function fallbackProjectName(idea) {
  const clean = normalizeIdea(idea)
    .replace(URL_PATTERN, '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[.,،؛:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.split(' ').filter(Boolean).slice(0, 6);
  return words.join(' ') || 'مشروع جديد';
}

export function createFallbackBrief(idea, mode = 'balanced') {
  const normalized = normalizeIdea(idea);
  return {
    name: fallbackProjectName(normalized),
    brief: normalized,
    audience: 'الجمهور الأكثر استفادة من الفكرة كما يحدده بحث المشروع',
    goal: 'تحويل الفكرة إلى تجربة رقمية واضحة وقابلة للاختبار والمشاركة',
    style: 'حديث، واضح، عربي RTL، Mobile First',
    references: extractIdeaUrls(normalized),
    assumptions: ['المعلومات غير المذكورة ستعامل كافتراضات قابلة للتعديل وليست حقائق.'],
    openQuestions: ['ما أهم إجراء تريد من الزائر تنفيذه؟'],
    mode: ['economy', 'deep'].includes(mode) ? mode : 'balanced'
  };
}

export function createTaskPlan(agents, brief) {
  return agents.map(agent => ({
    agentId: agent.id,
    agentName: agent.name,
    task: `${agent.mission} اربط النتيجة مباشرة بهدف المشروع: ${brief.goal}.`
  }));
}
