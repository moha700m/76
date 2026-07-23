import { ai } from '@appdeploy/sdk';
import { DESIGN_AGENTS } from './design-agents';
import { createFallbackBrief, createTaskPlan, extractIdeaUrls, normalizeIdea } from '../lib/project-manager.mjs';

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
  const fallback = createFallbackBrief(idea, mode);
  let data: any = fallback;
  try {
    const result = await ai.extract({
      system: 'أنت مدير استوديو نَسَق. تستقبل فكرة قصيرة جدًا من صاحب مشروع سعودي، ثم تحولها إلى موجز احترافي واضح دون اختراع حقائق. اكتب بالعربية السعودية المهنية. افصل الافتراضات عن المعلومات المؤكدة. لا تنشئ روابط غير موجودة في كلام المستخدم.',
      prompt: 'استخرج اسمًا مناسبًا، الجمهور، الهدف، الطابع البصري، وموجزًا تنفيذيًا كاملًا يمكن توزيعه على تسعة وكلاء تصميم. اجعل الملخص مفهومًا لصاحب المشروع، والأسئلة المفتوحة قليلة وغير معطلة للتنفيذ.',
      content: JSON.stringify({ idea, explicitReferenceUrls: references, requestedMode: mode }),
      schema: managerSchema,
      maxRetries: 1,
      maxTokens: mode === 'deep' ? 1600 : 1100,
      temperature: 0.25,
      thinkingMode: mode === 'deep' ? 'DEEP' : 'FAST'
    });
    data = result.data || fallback;
  } catch (error) {
    console.error('project_manager_expand_failed', error);
  }

  const normalizedBrief = {
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
    summary: String(data.summary || `حوّلت فكرتك إلى موجز جاهز لتوزيعه على فريق نَسَق.`).trim().slice(0, 800),
    ...normalizedBrief,
    taskPlan: createTaskPlan(DESIGN_AGENTS, normalizedBrief),
    generatedAt: Date.now()
  };
}
