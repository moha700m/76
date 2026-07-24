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
  {
    id: 'brief-analyst',
    name: 'محلل الموجز',
    title: 'تحويل الطلب إلى مواصفات قابلة للتحقق',
    workshop: 'How We Claude Code',
    mission: 'حلّل الموجز، اكشف الغموض والتعارضات، وحدد نطاق المنتج ومعايير نجاح واضحة قابلة للقياس.'
  },
  {
    id: 'evidence-researcher',
    name: 'باحث الأدلة',
    title: 'السوق والمنافسون والمراجع',
    workshop: 'Research Desk',
    mission: 'استخرج أنماط السوق واحتياجات الجمهور من الموجز والأدلة المرجعية، وافصل الحقائق عن الافتراضات.'
  },
  {
    id: 'product-strategist',
    name: 'استراتيجي المنتج',
    title: 'التموضع والقيمة والأولويات',
    workshop: 'Agent Decomposition',
    mission: 'قسّم المشكلة إلى أهداف وتجارب ووحدات، وحدد الوعد الأساسي والأولويات وما يجب استبعاده من الإصدار الأول.'
  },
  {
    id: 'memory-curator',
    name: 'أمين ذاكرة العلامة',
    title: 'استرجاع القرارات السابقة ومنع التكرار',
    workshop: 'Agents That Remember',
    mission: 'استفد من ذاكرة المشاريع المعتمدة، وحوّلها إلى قواعد تصميم ونبرة ومخاطر يجب تذكرها في هذا المشروع.'
  },
  {
    id: 'ux-architect',
    name: 'معماري تجربة المستخدم',
    title: 'الرحلات والبنية والتدفقات',
    workshop: 'Production-Ready Agent',
    mission: 'صمّم رحلة المستخدم، بنية المعلومات، الحالات الحرجة، وبوابات المراجعة البشرية قبل الإجراءات المهمة.'
  },
  {
    id: 'ui-director',
    name: 'مخرج الواجهة',
    title: 'النظام البصري والمكوّنات',
    workshop: 'Ship Your First Managed Agent',
    mission: 'حوّل الاستراتيجية إلى اتجاه UI واضح: تخطيط، تسلسل بصري، مكوّنات، ألوان، خط، وحركة قابلة للتنفيذ.'
  },
  {
    id: 'efficiency-router',
    name: 'مهندس الكفاءة',
    title: 'اختيار عمق التنفيذ وموازنة التكلفة',
    workshop: 'Picking the Right Model',
    mission: 'حدّد أين نحتاج عمقًا أكبر وأين تكفي حلول بسيطة، واقترح خطة تنفيذ تحافظ على الجودة والسرعة والتكلفة.'
  },
  {
    id: 'quality-evaluator',
    name: 'مراجع الجودة',
    title: 'التقييم وإمكانية الوصول والأداء',
    workshop: 'Eval-Driven Agent Development',
    mission: 'أنشئ scorecard واضحًا، وافحص الوصول والتباين والجوال والأداء والاتساق وحالات الخطأ، واقترح اختبارات قبول.'
  },
  {
    id: 'challenger',
    name: 'الناقد المنافس',
    title: 'كسر الحل قبل أن يكسره السوق',
    workshop: 'Agent Battle',
    mission: 'هاجم الخطة كمنافس وكمستخدم متردد، وحدد نقاط الفشل والبدائل الأقوى ثم قدم توصيات حاسمة.'
  }
] as const;

export function buildRecoveryOutput(agentIndex: number, context: ProjectContext, previous: AgentOutput[]): AgentOutput {
  const agent = DESIGN_AGENTS[agentIndex];
  const evidenceNote = context.referenceEvidence.length ? `توفر ${context.referenceEvidence.length} مرجعًا يمكن الرجوع إليه أثناء التنفيذ.` : 'لا توجد مراجع خارجية مؤكدة، لذلك يجب إبقاء الافتراضات قابلة للتعديل.';
  return {
    agentId: agent.id,
    name: agent.name,
    title: agent.title,
    workshop: agent.workshop,
    status: 'complete',
    summary: `تم إنشاء مخرج تعافٍ تنفيذي لدور ${agent.name} حتى لا يتوقف المشروع عند تعذر مزود الذكاء الاصطناعي. يرتبط المخرج مباشرة بهدف ${context.name} وجمهوره.`,
    findings: [
      `الجمهور الأساسي: ${context.audience}.`,
      `الهدف التنفيذي: ${context.goal}.`,
      `الاتجاه البصري المطلوب: ${context.style}.`,
      `${agent.mission} ${evidenceNote}`
    ],
    decisions: [
      'تقديم الإجراء الرئيسي بوضوح من أول شاشة مع مسار Mobile First.',
      'تمييز الحقائق عن الافتراضات وإبقاء القرارات غير المؤكدة قابلة للمراجعة.',
      `الحفاظ على الاتساق مع ${previous.filter(item => item.status === 'complete').length} مخرجًا مكتملًا من بقية المجلس.`
    ],
    deliverable: `${agent.title}: قائمة تنفيذ مرتبطة بالموجز، تشمل الأولوية، معيار القبول، والمخاطر التي تحتاج مراجعة بشرية قبل الاعتماد.`,
    confidence: 80,
    elapsedMs: 0
  };
}

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
    project: {
      name: context.name,
      brief: context.brief,
      audience: context.audience,
      goal: context.goal,
      style: context.style,
      references: context.references,
      feedback: context.feedback || ''
    },
    evidence: context.referenceEvidence.map(item => ({ url: item.url, title: item.title, excerpt: item.text.slice(0, 2200) })),
    approvedMemory: context.memories.slice(0, 8),
    priorAgents: previous.map(item => ({ agent: item.name, summary: item.summary, findings: item.findings, decisions: item.decisions, deliverable: item.deliverable }))
  }).slice(0, 28000);
}

export async function runDesignCouncil(context: ProjectContext, thinkingMode: ThinkingMode): Promise<{ outputs: AgentOutput[]; synthesis: Record<string, unknown> }> {
  const startedAt = Date.now();
  const roleSchema = {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      summary: { type: 'string' },
      finding: { type: 'string' },
      decision: { type: 'string' },
      deliverable: { type: 'string' },
      confidence: { type: 'number', minimum: 55, maximum: 100 }
    },
    required: ['agentId', 'summary', 'finding', 'decision', 'deliverable', 'confidence']
  };
  const sectionSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      purpose: { type: 'string' },
      items: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 }
    },
    required: ['name', 'purpose', 'items']
  };
  const councilSchema = {
    type: 'object',
    properties: {
      roles: { type: 'array', minItems: 9, maxItems: 9, items: roleSchema },
      executiveSummary: { type: 'string' },
      positioning: { type: 'string' },
      designDirection: { type: 'string' },
      palette: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 5 },
      typography: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
      journey: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 6 },
      sections: { type: 'array', items: sectionSchema, minItems: 4, maxItems: 6 },
      conversionPlan: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 4 },
      risks: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
      acceptanceCriteria: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 7 },
      nextActions: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 }
    },
    required: ['roles', 'executiveSummary', 'positioning', 'designDirection', 'palette', 'typography', 'journey', 'sections', 'conversionPlan', 'risks', 'acceptanceCriteria', 'nextActions']
  };
  const assignments = DESIGN_AGENTS.map(agent => ({ agentId: agent.id, role: agent.name, mission: agent.mission }));
  let result: Awaited<ReturnType<typeof ai.extract>> | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await ai.extract({
        system: 'أنت مجلس تصميم عربي من تسعة خبراء مستقلين. أعد تسعة أدوار موجزة ومختلفة بنفس agentId، ثم مخطط تصميم واحد خاص بالمشروع. لا تكرر النص، لا تخترع حقائق، ولا تستخدم قالب نَسَق أو ألوانه إلا إذا طلبها المشروع.',
        prompt: `نفّذ هذه الأدوار التسعة بالترتيب ثم أنشئ مخطط الموقع: ${JSON.stringify(assignments)}. اجعل كل دور عالي الكثافة في خمسة حقول فقط، واجعل الأقسام والهوية مرتبطة مباشرة بنوع المشروع والطابع المطلوب.`,
        content: compactContext(context, []).slice(0, 16000),
        schema: councilSchema,
        maxRetries: 1,
        maxTokens: 5600,
        temperature: 0.2,
        thinkingMode
      });
      break;
    } catch (err) {
      lastError = err;
      const statusCode = err && typeof err === 'object' && 'statusCode' in err ? Number((err as { statusCode?: unknown }).statusCode || 0) : 0;
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '') : String(err || '');
      const retryable = statusCode === 429 || statusCode >= 500 || statusCode === 0 && /rate|temporar|overload|resource exhausted|unavailable/i.test(message);
      if (!retryable || attempt === 2) throw err;
      await new Promise(resolve => setTimeout(resolve, 6000 * (attempt + 1)));
    }
  }
  if (!result) throw lastError || new Error('تعذر استدعاء مجلس التصميم');
  const data = result.data as {
    roles?: Array<{ agentId?: string; summary?: string; finding?: string; decision?: string; deliverable?: string; confidence?: number }>;
    executiveSummary?: string; positioning?: string; designDirection?: string; palette?: string[]; typography?: string[]; journey?: string[];
    sections?: Array<{ name?: string; purpose?: string; items?: string[] }>;
    conversionPlan?: string[]; risks?: string[]; acceptanceCriteria?: string[]; nextActions?: string[];
  };
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const outputs = DESIGN_AGENTS.map((agent, position) => {
    const role = roles.find(item => item.agentId === agent.id) || roles[position];
    if (!role?.summary || !role.finding || !role.decision || !role.deliverable) return { agentId: agent.id, name: agent.name, title: agent.title, workshop: agent.workshop, status: 'degraded' as const, summary: 'لم يصل مخرج مستقل لهذا الدور.', findings: ['أعد تشغيل المجلس.'], decisions: ['لا تعتمد هذا الدور.'], deliverable: 'مخرج غير مكتمل.', confidence: 25, elapsedMs: Date.now() - startedAt };
    return {
      agentId: agent.id,
      name: agent.name,
      title: agent.title,
      workshop: agent.workshop,
      status: 'complete' as const,
      summary: String(role.summary).trim(),
      findings: [String(role.finding).trim()],
      decisions: [String(role.decision).trim()],
      deliverable: String(role.deliverable).trim(),
      confidence: Math.max(55, Math.min(100, Number(role.confidence) || 75)),
      elapsedMs: Date.now() - startedAt
    };
  });
  const sections = Array.isArray(data.sections) ? data.sections : [];
  if (outputs.some(output => output.status === 'degraded') || sections.length < 4 || !data.executiveSummary || !data.designDirection) throw new Error('لم يكتمل مخطط مجلس الوكلاء التسعة');
  const componentNames = Array.from(new Set(sections.flatMap(section => Array.isArray(section.items) ? section.items : []))).slice(0, 10);
  const synthesis: Record<string, unknown> = {
    executiveSummary: String(data.executiveSummary),
    positioning: String(data.positioning || context.goal),
    designDirection: String(data.designDirection),
    primaryJourney: data.journey || [],
    pages: sections.map(section => ({ name: String(section.name || 'قسم'), purpose: String(section.purpose || ''), sections: Array.isArray(section.items) ? section.items.map(String) : [] })),
    designSystem: {
      palette: data.palette || [],
      typography: data.typography || [],
      components: componentNames.length >= 5 ? componentNames : [...componentNames, 'زر الإجراء الرئيسي', 'بطاقة محتوى', 'شريط تنقل', 'نموذج مختصر', 'رسالة حالة'].slice(0, 8),
      motion: ['ظهور متدرج خفيف', 'استجابة hover واضحة', 'انتقالات تحترم reduced-motion']
    },
    conversionPlan: data.conversionPlan || [],
    risks: data.risks || [],
    acceptanceCriteria: data.acceptanceCriteria || [],
    nextActions: data.nextActions || []
  };
  return { outputs, synthesis };
}

export async function runDesignWave(agentIndices: number[], context: ProjectContext, previous: AgentOutput[], thinkingMode: ThinkingMode): Promise<AgentOutput[]> {
  const agents = agentIndices.map(index => DESIGN_AGENTS[index]);
  const startedAt = Date.now();
  const waveSchema = {
    type: 'object',
    properties: {
      outputs: {
        type: 'array',
        minItems: agents.length,
        maxItems: agents.length,
        items: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            summary: { type: 'string' },
            findings: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
            decisions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
            deliverable: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 100 }
          },
          required: ['agentId', 'summary', 'findings', 'decisions', 'deliverable', 'confidence']
        }
      }
    },
    required: ['outputs']
  };
  try {
    const assignments = agents.map(agent => ({ agentId: agent.id, role: agent.name, title: agent.title, mission: agent.mission }));
    const result = await ai.extract({
      system: 'أنت مجلس تصميم عربي يضم أدوارًا مستقلة. نفّذ كل مهمة بصوتها التخصصي منفصلة، ولا تدمج المخرجات أو تكرر النص بين الأدوار. اربط كل قرار بالموجز والأدلة، ولا تدّعِ حقائق غير موجودة.',
      prompt: `نفّذ هذه الموجة المكونة من ${agents.length} أدوار. أعد مخرجًا مستقلًا كاملًا لكل agentId وبنفس الترتيب: ${JSON.stringify(assignments)}.`,
      content: compactContext(context, previous),
      schema: waveSchema,
      maxRetries: 2,
      maxTokens: thinkingMode === 'DEEP' ? 3600 : 2600,
      temperature: 0.25,
      thinkingMode
    });
    const data = result.data as { outputs?: Array<{ agentId?: string; summary?: string; findings?: string[]; decisions?: string[]; deliverable?: string; confidence?: number }> };
    const rawOutputs = Array.isArray(data.outputs) ? data.outputs : [];
    return agents.map((agent, position) => {
      const raw = rawOutputs.find(item => item.agentId === agent.id) || rawOutputs[position];
      if (!raw) return { agentId: agent.id, name: agent.name, title: agent.title, workshop: agent.workshop, status: 'degraded' as const, summary: 'لم يصل مخرج مستقل لهذا الدور من موجة الذكاء.', findings: ['أعد تشغيل هذه الموجة.'], decisions: ['لا تعتمد هذا الدور قبل اكتماله.'], deliverable: 'مخرج غير مكتمل.', confidence: 25, elapsedMs: Date.now() - startedAt };
      return {
        agentId: agent.id,
        name: agent.name,
        title: agent.title,
        workshop: agent.workshop,
        status: 'complete' as const,
        summary: String(raw.summary || '').trim(),
        findings: Array.isArray(raw.findings) ? raw.findings.map(String) : [],
        decisions: Array.isArray(raw.decisions) ? raw.decisions.map(String) : [],
        deliverable: String(raw.deliverable || '').trim(),
        confidence: Math.max(0, Math.min(100, Number(raw.confidence) || 70)),
        elapsedMs: Date.now() - startedAt
      };
    });
  } catch (err) {
    console.error('agent_wave_failed', agents.map(agent => agent.id).join(','), err);
    return agents.map(agent => ({ agentId: agent.id, name: agent.name, title: agent.title, workshop: agent.workshop, status: 'degraded' as const, summary: 'تعذر إكمال موجة الذكاء لهذا الدور.', findings: ['أعد تشغيل الموجة لاحقًا.', 'لا تعتمد هذا الجزء قبل اكتماله.'], decisions: ['تمييز المخرج كغير مكتمل.'], deliverable: 'مخرج يحتاج إعادة تشغيل.', confidence: 25, elapsedMs: Date.now() - startedAt }));
  }
}

export async function runDesignAgent(agentIndex: number, context: ProjectContext, previous: AgentOutput[], thinkingMode: ThinkingMode): Promise<AgentOutput> {
  const agent = DESIGN_AGENTS[agentIndex];
  const startedAt = Date.now();
  try {
    const result = await ai.extract({
      system: `أنت ${agent.name}، خبير عربي senior في تصميم المنتجات الرقمية وتجربة المستخدم. اكتب بالعربية الواضحة، لا تستخدم كلامًا عامًا، واربط كل قرار بالموجز والأدلة. لا تدّعِ حقائق غير موجودة.`,
      prompt: `${agent.mission}\nأخرج نتيجة عملية لفريق تصميم وبرمجة يستطيع تنفيذها مباشرة.`,
      content: compactContext(context, previous),
      schema: resultSchema,
      maxRetries: 1,
      maxTokens: thinkingMode === 'DEEP' ? 1200 : 850,
      temperature: 0.25,
      thinkingMode
    });
    const data = result.data as { summary?: string; findings?: string[]; decisions?: string[]; deliverable?: string; confidence?: number };
    return {
      agentId: agent.id,
      name: agent.name,
      title: agent.title,
      workshop: agent.workshop,
      status: 'complete',
      summary: data.summary || 'تم التحليل دون ملخص واضح.',
      findings: Array.isArray(data.findings) ? data.findings : [],
      decisions: Array.isArray(data.decisions) ? data.decisions : [],
      deliverable: data.deliverable || '',
      confidence: Math.max(0, Math.min(100, Number(data.confidence) || 70)),
      elapsedMs: Date.now() - startedAt
    };
  } catch (err) {
    console.error('agent_failed', agent.id, err);
    return {
      agentId: agent.id,
      name: agent.name,
      title: agent.title,
      workshop: agent.workshop,
      status: 'degraded',
      summary: 'تعذر إكمال الاستدعاء الذكي لهذا الوكيل، لذلك تم إبقاء المشروع قابلًا للمتابعة مع تنبيه للمراجعة البشرية.',
      findings: ['أعد تشغيل الجولة لاحقًا لإكمال هذا الدور.', 'لا تعتمد القرار النهائي قبل مراجعة هذا الجزء.'],
      decisions: ['تمييز المخرج كحالة منخفضة الثقة.'],
      deliverable: 'مخرج احتياطي يحتاج مراجعة بشرية.',
      confidence: 25,
      elapsedMs: Date.now() - startedAt
    };
  }
}

export async function synthesizeDesign(context: ProjectContext, outputs: AgentOutput[], thinkingMode: ThinkingMode) {
  try {
    const result = await ai.extract({
      system: 'أنت منسق مجلس تصميم عربي. مهمتك دمج مخرجات تسعة وكلاء في قرار واحد متماسك، إزالة التعارض، والمحافظة على ما تدعمه الأدلة فقط.',
      prompt: 'أنشئ وثيقة تنفيذ نهائية لمشروع UI/UX تشمل التموضع والصفحات والنظام البصري والتحويل والمخاطر ومعايير القبول والخطوات التالية.',
      content: compactContext(context, outputs),
      schema: synthesisSchema,
      maxRetries: 1,
      maxTokens: thinkingMode === 'DEEP' ? 2200 : 1500,
      temperature: 0.2,
      thinkingMode
    });
    return result.data as Record<string, unknown>;
  } catch (err) {
    console.error('synthesis_failed', err);
    return {
      executiveSummary: outputs.map(item => item.summary).join(' '),
      positioning: context.goal,
      designDirection: context.style,
      primaryJourney: ['دخول المستخدم', 'فهم القيمة', 'مراجعة الدليل', 'تنفيذ الإجراء الرئيسي'],
      pages: [{ name: 'الرئيسية', purpose: 'شرح القيمة وتحويل المستخدم', sections: ['العنوان الرئيسي', 'الدليل', 'الخدمات', 'الدعوة للإجراء'] }],
      designSystem: { palette: ['لون أساسي', 'لون إبراز', 'خلفية', 'نص'], typography: ['عنوان', 'نص'], components: ['زر', 'بطاقة', 'نموذج', 'تنقل', 'تنبيه'], motion: ['ظهور خفيف', 'استجابة hover'] },
      conversionPlan: ['دعوة إجراء واحدة واضحة', 'إظهار الثقة قبل النموذج', 'تقليل الحقول'],
      risks: ['المخرج النهائي احتياطي بسبب تعذر الدمج الذكي'],
      acceptanceCriteria: ['توافق الجوال', 'تباين جيد', 'وضوح المسار', 'عدم وجود أخطاء', 'سرعة تحميل مناسبة'],
      nextActions: ['مراجعة بشرية', 'إعادة تشغيل الدمج', 'بدء wireframes']
    };
  }
}

export function calculateScore(outputs: AgentOutput[]) {
  const average = outputs.reduce((sum, item) => sum + item.confidence, 0) / Math.max(outputs.length, 1);
  const complete = outputs.filter(item => item.status === 'complete').length;
  return Math.round(Math.min(100, average * 0.75 + (complete / 9) * 25));
}
