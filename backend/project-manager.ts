import { ai } from '@appdeploy/sdk';
import { DESIGN_AGENTS } from './design-agents';

export type ManagerBrief = {
  idea: string;
  summary: string;
  name: string;
  brief: string;
  audience: string;
  goal: string;
  style: string;
  references: string[];
  assumptions: string[];
  openQuestions: string[];
  taskPlan: Array<{ agentId: string; agentName: string; task: string }>;
  generatedAt: number;
};

const URL_PATTERN = /https?:\/\/[^\s<>()"']+/gi;

function normalizeIdea(value: string, maxLength = 3000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function extractIdeaUrls(value: string, limit = 5) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of normalizeIdea(value).match(URL_PATTERN) || []) {
    const clean = match.replace(/[.,،؛:!?]+$/g, '');
    if (!seen.has(clean)) { seen.add(clean); urls.push(clean); }
    if (urls.length >= limit) break;
  }
  return urls;
}

function fallbackProjectName(idea: string) {
  const clean = normalizeIdea(idea).replace(URL_PATTERN, '').replace(/[.,،؛:!?()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.split(' ').filter(Boolean).slice(0, 6).join(' ') || 'مشروع جديد';
}

function fallbackBrief(idea: string) {
  return {
    name: fallbackProjectName(idea),
    brief: idea,
    audience: 'الجمهور الأكثر استفادة من الفكرة كما يحدده بحث المشروع',
    goal: 'تحويل الفكرة إلى تجربة رقمية واضحة وقابلة للاختبار والمشاركة',
    style: 'حديث، واضح، عربي RTL، Mobile First',
    assumptions: ['المعلومات غير المذكورة ستعامل كافتراضات قابلة للتعديل وليست حقائق.'],
    openQuestions: ['ما أهم إجراء تريد من الزائر تنفيذه؟'],
    summary: 'حوّلت الفكرة المختصرة إلى موجز جاهز للتنفيذ والتوزيع على فريق نَسَق.'
  };
}

const managerSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    brief: { type: 'string' },
    audience: { type: 'string' },
    goal: { type: 'string' },
    style: { type: 'string' },
    summary: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
    openQuestions: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 5 }
  },
  required: ['name', 'brief', 'audience', 'goal', 'style', 'summary', 'assumptions', 'openQuestions']
};

export async function expandProjectIdea(rawIdea: string, mode: 'economy' | 'balanced' | 'deep' = 'balanced'): Promise<ManagerBrief> {
  const idea = normalizeIdea(rawIdea);
  const references = extractIdeaUrls(idea);
  const fallback = fallbackBrief(idea);
  let data: any = fallback;
  try {
    const result = await ai.extract({
      system: 'أنت مدير استوديو نَسَق. تستقبل فكرة قصيرة جدًا من صاحب مشروع سعودي وتحولها إلى موجز احترافي واضح دون اختراع حقائق. اكتب بالعربية السعودية المهنية، وافصل الافتراضات عن المعلومات المؤكدة، ولا تنشئ روابط غير موجودة في كلام المستخدم.',
      prompt: 'استخرج اسم المشروع، الجمهور، الهدف، الطابع البصري، وموجزًا تنفيذيًا كاملًا يمكن توزيعه على تسعة وكلاء تصميم. اجعل الأسئلة المفتوحة قليلة وغير معطلة للتنفيذ.',
      content: JSON.stringify({ idea, explicitReferenceUrls: references, requestedMode: mode }),
      schema: managerSchema,
      maxRetries: 1,
      maxTokens: mode === 'deep' ? 1600 : 1100,
      temperature: 0.25,
      thinkingMode: mode === 'deep' ? 'DEEP' : 'FAST'
    });
    data = result.data || fallback;
  } catch (err) {
    console.error('project_manager_expand_failed', err);
  }
  const brief = {
    name: String(data.name || fallback.name).trim().slice(0, 120),
    brief: String(data.brief || fallback.brief).trim().slice(0, 6000),
    audience: String(data.audience || fallback.audience).trim().slice(0, 500),
    goal: String(data.goal || fallback.goal).trim().slice(0, 500),
    style: String(data.style || fallback.style).trim().slice(0, 500),
    references,
    assumptions: Array.isArray(data.assumptions) ? data.assumptions.map(String).filter(Boolean).slice(0, 6) : fallback.assumptions,
    openQuestions: Array.isArray(data.openQuestions) ? data.openQuestions.map(String).filter(Boolean).slice(0, 5) : fallback.openQuestions
  };
  return {
    idea,
    summary: String(data.summary || fallback.summary).trim().slice(0, 800),
    ...brief,
    taskPlan: DESIGN_AGENTS.map(agent => ({ agentId: agent.id, agentName: agent.name, task: `${agent.mission} اربط النتيجة مباشرة بهدف المشروع: ${brief.goal}.` })),
    generatedAt: Date.now()
  };
}
