import { ai } from '@appdeploy/sdk';

export type ThinkingMode = 'FAST' | 'DEEP';
export type AgentOutput = {
  agentId: string;
  name: string;
  title: string;
  workshop: string;
  status: 'complete' | 'degraded';
  summary: string;
  findings: string[];
  decisions: string[];
  deliverable: string;
  confidence: number;
  elapsedMs: number;
};

export type ProjectContext = {
  name: string;
  brief: string;
  audience: string;
  goal: string;
  style: string;
  references: string[];
  referenceEvidence: Array<{ url: string; title: string; text: string }>;
  memories: Array<{ title: string; content: string }>;
  feedback?: string;
};

export const DESIGN_AGENTS = [
  { id: 'brief-analyst', name: 'محلل الموجز', title: 'تحويل الطلب إلى مواصفات قابلة للتحقق', workshop: 'How We Claude Code', mission: 'حلّل الموجز، اكشف الغموض والتعارضات، وحدد نطاق المنتج ومعايير نجاح واضحة قابلة للقياس.' },
  { id: 'evidence-researcher', name: 'باحث الأدلة', title: 'السوق والمنافسون والمراجع', workshop: 'Research Desk', mission: 'استخرج أنماط السوق واحتياجات الجمهور من الموجز والأدلة المرجعية، وافصل الحقائق عن الافتراضات.' },
  { id: 'product-strategist', name: 'استراتيجي المنتج', title: 'التموضع والقيمة والأولويات', workshop: 'Agent Decomposition', mission: 'قسّم المشكلة إلى أهداف وتجارب ووحدات، وحدد الوعد الأساسي والأولويات وما يجب استبعاده من الإصدار الأول.' },
  { id: 'memory-curator', name: 'أمين ذاكرة العلامة', title: 'استرجاع القرارات السابقة ومنع التكرار', workshop: 'Agents That Remember', mission: 'استفد من ذاكرة المشاريع المعتمدة، وحوّلها إلى قواعد تصميم ونبرة ومخاطر يجب تذكرها في هذا المشروع.' },
  { id: 'ux-architect', name: 'معماري تجربة المستخدم', title: 'الرحلات والبنية والتدفقات', workshop: 'Production-Ready Agent', mission: 'صمّم رحلة المستخدم، بنية المعلومات، الحالات الحرجة، وبوابات المراجعة البشرية قبل الإجراءات المهمة.' },
  { id: 'ui-director', name: 'مخرج الواجهة', title: 'النظام البصري والمكوّنات', workshop: 'Ship Your First Managed Agent', mission: 'حوّل الاستراتيجية إلى اتجاه UI واضح: تخطيط، تسلسل بصري، مكوّنات، ألوان، خط، وحركة قابلة للتنفيذ.' },
  { id: 'efficiency-router', name: 'مهندس الكفاءة', title: 'اختيار عمق التنفيذ وموازنة التكلفة', workshop: 'Picking the Right Model', mission: 'حدّد أين نحتاج عمقًا أكبر وأين تكفي حلول بسيطة، واقترح خطة تنفيذ تحافظ على الجودة والسرعة والتكلفة.' },
  { id: 'quality-evaluator', name: 'مراجع الجودة', title: 'التقييم وإمكانية الوصول والأداء', workshop: 'Eval-Driven Agent Development', mission: 'أنشئ scorecard واضحًا، وافحص الوصول والتباين والجوال والأداء والاتساق وحالات الخطأ، واقترح اختبارات قبول.' },
  { id: 'challenger', name: 'الناقد المنافس', title: 'كسر الحل قبل أن يكسره السوق', workshop: 'Agent Battle', mission: 'هاجم الخطة كمنافس وكمستخدم متردد، وحدد نقاط الفشل والبدائل الأقوى ثم قدم توصيات حاسمة.' }
] as const;

const resultSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
    decisions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    deliverable: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 100 }
  },
  required: ['summary', 'findings', 'decisions', 'deliverable', 'confidence']
};

const synthesisSchema = {
  type: 'object',
  properties: {
    executiveSummary: { type: 'string' },
    positioning: { type: 'string' },
    designDirection: { type: 'string' },
    primaryJourney: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 8 },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          purpose: { type: 'string' },
          sections: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'purpose', 'sections']
      },
      minItems: 3,
      maxItems: 8
    },
    designSystem: {
      type: 'object',
      properties: {
        palette: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 6 },
        typography: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
        components: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 12 },
        motion: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 }
      },
      required: ['palette', 'typography', 'components', 'motion']
    },
    conversionPlan: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 7 },
    risks: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
    acceptanceCriteria: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 10 },
    nextActions: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 7 }
  },
  required: ['executiveSummary', 'positioning', 'designDirection', 'primaryJourney', 'pages', 'designSystem', 'conversionPlan', 'risks', 'acceptanceCriteria', 'nextActions']
};

function compactContext(context: ProjectContext, previous: AgentOutput[]) {
  return JSON.stringify({
    project: { name: context.name, brief: context.brief, audience: context.audience, goal: context.goal, style: context.style, references: context.references, feedback: context.feedback || '' },
    evidence: context.referenceEvidence.map(item => ({ url: item.url, title: item.title, excerpt: item.text.slice(0, 2200) })),
    approvedMemory: context.memories.slice(0, 8),
    priorAgents: previous.map(item => ({ agent: item.name, summary: item.summary, findings: item.findings, decisions: item.decisions, deliverable: item.deliverable }))
  }).slice(0, 28000);
}

export async function runDesignAgent(agentIndex: number, context: ProjectContext, previous: AgentOutput[], thinkingMode: ThinkingMode): Promise<AgentOutput> {
  const agent = DESIGN_AGENTS[agentIndex];
  const startedAt = Date.now();
  try {
    const result = await ai.extract({
      system: `أنت ${agent.name}، خبير عربي senior في تصميم المنتجات الرقمية وتجربة المستخدم. اكتب بالعربية الواضحة، لا تستخدم كلامًا عامًا، واربط كل قرار بالموجز والأدلة. لا تدّعِ حقائق غير موجودة.`,
      prompt: `${agent.mission}\nأخرج نتيجة عملية لفريق تصميم وبرمجة يستطيع تنفيذها مباشرة.`,
      content: compactContext(context, previous), schema: resultSchema, maxRetries: 1,
      maxTokens: thinkingMode === 'DEEP' ? 1200 : 850, temperature: 0.25, thinkingMode
    });
    const data = result.data as { summary?: string; findings?: string[]; decisions?: string[]; deliverable?: string; confidence?: number };
    return {
      agentId: agent.id, name: agent.name, title: agent.title, workshop: agent.workshop, status: 'complete',
      summary: data.summary || 'تم التحليل دون ملخص واضح.', findings: Array.isArray(data.findings) ? data.findings : [],
      decisions: Array.isArray(data.decisions) ? data.decisions : [], deliverable: data.deliverable || '',
      confidence: Math.max(0, Math.min(100, Number(data.confidence) || 70)), elapsedMs: Date.now() - startedAt
    };
  } catch (err) {
    console.error('agent_failed', agent.id, err);
    return {
      agentId: agent.id, name: agent.name, title: agent.title, workshop: agent.workshop, status: 'degraded',
      summary: 'تعذر إكمال الاستدعاء الذكي لهذا الوكيل، لذلك تم إبقاء المشروع قابلًا للمتابعة مع تنبيه للمراجعة البشرية.',
      findings: ['أعد تشغيل الجولة لاحقًا لإكمال هذا الدور.', 'لا تعتمد القرار النهائي قبل مراجعة هذا الجزء.'],
      decisions: ['تمييز المخرج كحالة منخفضة الثقة.'], deliverable: 'مخرج احتياطي يحتاج مراجعة بشرية.',
      confidence: 25, elapsedMs: Date.now() - startedAt
    };
  }
}

export async function synthesizeDesign(context: ProjectContext, outputs: AgentOutput[], thinkingMode: ThinkingMode) {
  try {
    const result = await ai.extract({
      system: 'أنت منسق مجلس تصميم عربي. مهمتك دمج مخرجات تسعة وكلاء في قرار واحد متماسك، إزالة التعارض، والمحافظة على ما تدعمه الأدلة فقط.',
      prompt: 'أنشئ وثيقة تنفيذ نهائية لمشروع UI/UX تشمل التموضع والصفحات والنظام البصري والتحويل والمخاطر ومعايير القبول والخطوات التالية.',
      content: compactContext(context, outputs), schema: synthesisSchema, maxRetries: 1,
      maxTokens: thinkingMode === 'DEEP' ? 2200 : 1500, temperature: 0.2, thinkingMode
    });
    return result.data as Record<string, unknown>;
  } catch (err) {
    console.error('synthesis_failed', err);
    return {
      executiveSummary: outputs.map(item => item.summary).join(' '), positioning: context.goal,
      designDirection: context.style, primaryJourney: ['دخول المستخدم', 'فهم القيمة', 'مراجعة الدليل', 'تنفيذ الإجراء الرئيسي'],
      pages: [{ name: 'الرئيسية', purpose: 'شرح القيمة وتحويل المستخدم', sections: ['العنوان الرئيسي', 'الدليل', 'الخدمات', 'الدعوة للإجراء'] }],
      designSystem: { palette: ['لون أساسي', 'لون إبراز', 'خلفية', 'نص'], typography: ['عنوان', 'نص'], components: ['زر', 'بطاقة', 'نموذج', 'تنقل', 'تنبيه'], motion: ['ظهور خفيف', 'استجابة hover'] },
      conversionPlan: ['دعوة إجراء واحدة واضحة', 'إظهار الثقة قبل النموذج', 'تقليل الحقول'],
      risks: ['المخرج النهائي احتياطي بسبب تعذر الدمج الذكي'], acceptanceCriteria: ['توافق الجوال', 'تباين جيد', 'وضوح المسار', 'عدم وجود أخطاء', 'سرعة تحميل مناسبة'],
      nextActions: ['مراجعة بشرية', 'إعادة تشغيل الدمج', 'بدء wireframes']
    };
  }
}

export function calculateScore(outputs: AgentOutput[]) {
  const average = outputs.reduce((sum, item) => sum + item.confidence, 0) / Math.max(outputs.length, 1);
  const complete = outputs.filter(item => item.status === 'complete').length;
  return Math.round(Math.min(100, average * 0.75 + (complete / 9) * 25));
}
