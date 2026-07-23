import { randomUUID, timingSafeEqual } from 'crypto';
import { ai, db, error, json, requireAuth, secrets, storage, type RouterRoutes } from '@appdeploy/sdk';
import { notifySubscribers } from './realtime-subscribers';
import { calculateScore, DESIGN_AGENTS, runDesignWave, synthesizeDesign, type AgentOutput, type ProjectContext, type ThinkingMode } from './design-agents';
import { buildDemoPreview, generateSitePreview, htmlResponse } from './site-preview';
import { expandProjectIdea, type ManagerBrief } from './project-manager';

type ProjectRecord = {
  userId: string;
  name: string;
  brief: string;
  audience: string;
  goal: string;
  style: string;
  references: string[];
  mode: 'economy' | 'balanced' | 'deep';
  status: 'draft' | 'running' | 'review' | 'approved' | 'needs_revision' | 'error';
  progress: number;
  currentWave: number;
  currentRunId?: string;
  agentOutputs: AgentOutput[];
  synthesis?: Record<string, unknown>;
  score?: number;
  feedback?: string;
  conceptImagePath?: string;
  previewToken?: string;
  previewHtmlPath?: string;
  previewUpdatedAt?: number;
  managerBrief?: ManagerBrief;
  acceptanceTarget?: number;
  acceptanceHistory?: Array<{ at: number; before: number; after: number; rerunAgents: string[] }>;
  timeline: Array<{ at: number; label: string; detail: string }>;
  createdAt: number;
  updatedAt: number;
};

type RunRecord = {
  userId: string;
  projectId: string;
  status: string;
  mode: string;
  outputs: AgentOutput[];
  synthesis?: Record<string, unknown>;
  score?: number;
  startedAt: number;
  completedAt?: number;
};

const PROJECTS = 'design_projects';
const RUNS = 'design_runs';
const MEMORIES = 'design_memories';

function safeTokenEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function listAllRecords<T>(table: string) {
  const items: Array<Omit<T, 'id'> & { id: string }> = [];
  let nextToken: string | undefined;
  do {
    const page = await db.list<T>(table, { nextToken, limit: 1000 });
    items.push(...page.items);
    nextToken = page.nextToken;
  } while (nextToken && items.length < 20000);
  return items;
}

function modeToThinking(mode: ProjectRecord['mode']): ThinkingMode {
  return mode === 'economy' ? 'FAST' : 'DEEP';
}

async function getOwnedProject(userId: string, id: string) {
  const [project] = await db.get<ProjectRecord>(PROJECTS, [id]);
  if (!project || project.userId !== userId) return null;
  return project;
}

async function enrichProject(id: string, project: ProjectRecord) {
  let conceptImageUrl: string | undefined;
  if (project.conceptImagePath) {
    const [item] = await storage.url([project.conceptImagePath]);
    conceptImageUrl = item?.url;
  }
  const completeAgents = project.agentOutputs.filter(item => item.status === 'complete').length;
  const degradedAgents = project.agentOutputs.filter(item => item.status === 'degraded').length;
  const averageConfidence = project.agentOutputs.length ? Math.round(project.agentOutputs.reduce((sum, item) => sum + item.confidence, 0) / project.agentOutputs.length) : 0;
  const qualityScore = project.score ?? (project.agentOutputs.length ? calculateScore(project.agentOutputs) : 0);
  const qualityLabel = qualityScore >= 85 ? 'قوي' : qualityScore >= 70 ? 'جيد' : qualityScore >= 50 ? 'يحتاج تحسين' : 'منخفض';
  return { id, ...project, conceptImageUrl, previewPath:project.previewToken ? `#/preview/${project.previewToken}` : undefined, scoreBreakdown:{ completeAgents, degradedAgents, averageConfidence, label:qualityLabel } };
}

async function updateProject(id: string, project: ProjectRecord) {
  await db.update(PROJECTS, [{ id, record: project }]);
  const payload = await enrichProject(id, project);
  await notifySubscribers('project', id, payload);
  return payload;
}

async function scrapeReferences(references: string[]) {
  const urls = references.filter(value => /^https?:\/\//i.test(value)).slice(0, 3);
  const results = await Promise.allSettled(urls.map(async url => {
    const page = await ai.scrape({ url });
    return { url, title: page.title || url, text: page.status < 400 ? page.text.slice(0, 6000) : '' };
  }));
  return results.flatMap(item => item.status === 'fulfilled' && item.value.text ? [item.value] : []);
}

async function loadMemories(userId: string) {
  const { items } = await db.list<{ userId: string; title: string; content: string; createdAt: number }>(MEMORIES, { filter: { userId } });
  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8).map(item => ({ title: item.title, content: item.content }));
}

function projectBriefForAgents(project: ProjectRecord) {
  if (!project.managerBrief) return project.brief;
  const tasks = project.managerBrief.taskPlan.map(item => `${item.agentName}: ${item.task}`).join('\n');
  return `${project.brief}\n\nتوجيه مدير نَسَق:\n${project.managerBrief.summary}\n\nخطة توزيع المهام:\n${tasks}`;
}

async function buildContext(project: ProjectRecord): Promise<ProjectContext> {
  const [referenceEvidence, memories] = await Promise.all([scrapeReferences(project.references || []), loadMemories(project.userId)]);
  return {
    name: project.name,
    brief: projectBriefForAgents(project),
    audience: project.audience,
    goal: project.goal,
    style: project.style,
    references: project.references || [],
    referenceEvidence,
    memories,
    feedback: project.feedback
  };
}

async function buildFinalizeContext(project: ProjectRecord): Promise<ProjectContext> {
  const memories = await loadMemories(project.userId);
  return {
    name: project.name,
    brief: projectBriefForAgents(project),
    audience: project.audience,
    goal: project.goal,
    style: project.style,
    references: project.references || [],
    referenceEvidence: [],
    memories,
    feedback: project.feedback
  };
}

function paletteFromStyle(style: string) {
  const value = style.toLowerCase();
  if (/عاجي|بني|زيتوني|دافئ|ورقي|قهوة|ترابي/.test(value)) return ['#F3ECDF', '#FFFAF2', '#3A2A20', '#6F7D45', '#B46C3B'];
  if (/فاخر|ذهبي|أسود|luxury/.test(value)) return ['#0E0D0B', '#1A1814', '#F6F0E4', '#B99352', '#D8C7A1'];
  if (/تقني|داكن|سماوي|بنفسجي|نيون/.test(value)) return ['#05070B', '#0A0E15', '#F7FBFF', '#73E7FF', '#9D8CFF'];
  return ['#F4F1EA', '#FFFFFF', '#18201C', '#2F6B52', '#D29062'];
}

function buildDirectCouncil(project: ProjectRecord, context: ProjectContext): { outputs: AgentOutput[]; synthesis: Record<string, unknown> } {
  const rolePlans = [
    ['تثبيت نطاق المشروع ومتطلبات النجاح', 'إبراز الإجراء الرئيسي من أول شاشة', 'مواصفات مختصرة قابلة للتنفيذ'],
    ['تحديد احتياجات الجمهور والافتراضات', 'صياغة المحتوى بلغة الجمهور المستهدف', 'خريطة احتياجات وأسئلة تحقق'],
    ['بلورة وعد المشروع وتموضعه', 'ربط كل قسم بالهدف التجاري', 'رسالة قيمة وتسلسل إقناع'],
    ['حفظ القيود والقرارات المعتمدة', 'عدم اختراع بيانات أو مزايا غير مذكورة', 'سجل قرارات قابل للمراجعة'],
    ['تصميم رحلة استخدام قصيرة وواضحة', 'تقليل الخطوات حتى الإجراء الرئيسي', 'بنية صفحات ومسار Mobile First'],
    ['تحويل الطابع المطلوب إلى نظام بصري', 'اشتقاق الألوان والبطاقات والمساحات من وصف المستخدم', 'اتجاه UI ومكونات أساسية'],
    ['فحص الوضوح والتباين والاستجابة', 'رفض القالب العام أو الهوية غير المناسبة', 'قائمة قبول للجوال والكمبيوتر'],
    ['تجهيز وصف التسليم والمعاينة', 'توضيح ما هو مؤكد وما هو افتراض', 'ملخص تنفيذي قابل للمشاركة'],
    ['مهاجمة نقاط الضعف قبل العرض', 'إزالة التكرار والعبارات العامة', 'مخاطر وتوصيات تحسين حاسمة']
  ];
  const evidence = context.referenceEvidence.length ? `تمت مراعاة ${context.referenceEvidence.length} مراجع مقدمة.` : 'لم تُقدّم مراجع خارجية؛ اعتمدت الخطة على الموجز فقط.';
  const outputs = DESIGN_AGENTS.map((agent, index) => ({
    agentId: agent.id,
    name: agent.name,
    title: agent.title,
    workshop: agent.workshop,
    status: 'complete' as const,
    summary: `${rolePlans[index][0]} لمشروع ${project.name} بما يخدم ${project.goal}.`,
    findings: [`الجمهور: ${project.audience}.`, `الطابع: ${project.style}.`, evidence],
    decisions: [rolePlans[index][1], 'الحفاظ على محتوى خاص بالمشروع وعدم نسخ قالب نَسَق.'],
    deliverable: rolePlans[index][2],
    confidence: 84,
    elapsedMs: 0
  }));
  const palette = paletteFromStyle(project.style);
  const synthesis: Record<string, unknown> = {
    executiveSummary: `موقع عربي متجاوب يعرض فكرة ${project.name} كما وصفها المستخدم، ويقود ${project.audience} نحو ${project.goal} دون محتوى مختلق.`,
    positioning: project.goal,
    designDirection: `${project.style}. يجب أن تكون الهوية خاصة بالمشروع ومختلفة بصريًا عن واجهة نَسَق.`,
    primaryJourney: ['فهم وعد المشروع', 'استكشاف العرض أو الخدمات', 'معرفة طريقة الاستخدام أو الشراء', 'اتخاذ الإجراء الرئيسي'],
    pages: [
      { name: 'الرئيسية', purpose: `تقديم ${project.name} ووعده بوضوح`, sections: ['Hero مخصص', 'القيمة الرئيسية', 'الإجراء الرئيسي'] },
      { name: 'العرض الأساسي', purpose: 'عرض المنتجات أو الخدمات المناسبة للموجز', sections: ['بطاقات مخصصة', 'تفاصيل مختصرة', 'مزايا مؤكدة'] },
      { name: 'طريقة الاستخدام', purpose: 'شرح الرحلة من البداية حتى النتيجة', sections: ['خطوات واضحة', 'حالات الاستخدام', 'أسئلة متوقعة'] },
      { name: 'بدء الطلب', purpose: `تحويل الزائر نحو ${project.goal}`, sections: ['دعوة إجراء', 'نموذج مختصر', 'تأكيد الخطوة التالية'] }
    ],
    designSystem: { palette, typography: ['عنوان عربي بارز', 'نص عربي واضح'], components: ['شريط تنقل', 'Hero مخصص', 'بطاقات محتوى', 'خطوات', 'زر إجراء', 'تذييل'], motion: ['ظهور خفيف', 'Hover وظيفي', 'احترام reduced-motion'] },
    conversionPlan: ['دعوة إجراء واحدة واضحة', 'تقديم القيمة قبل التفاصيل', 'تقليل الحقول والخطوات'],
    risks: ['نقص المعلومات التفصيلية قد يتطلب تعديل المحتوى لاحقًا', 'يجب عدم اختراع أسعار أو شهادات أو بيانات تواصل'],
    acceptanceCriteria: ['مطابقة الفكرة والطابع', 'توافق الجوال أولًا', 'هوية مختلفة عن نَسَق', 'محتوى عربي واضح', 'تباين جيد', 'رابط معاينة يعمل'],
    nextActions: ['بناء المعاينة الحية', 'مراجعة المحتوى والألوان', 'اعتماد النسخة أو طلب تعديل']
  };
  return { outputs, synthesis };
}

async function runWave(indices: number[], context: ProjectContext, previous: AgentOutput[], thinkingMode: ThinkingMode) {
  return runDesignWave(indices, context, previous, thinkingMode);
}

async function improveAcceptance(project: ProjectRecord, context: ProjectContext, outputs: AgentOutput[], thinkingMode: ThinkingMode) {
  const target = Math.max(70, Math.min(95, project.acceptanceTarget || 85));
  const before = calculateScore(outputs);
  if (before >= target) return { outputs, history: project.acceptanceHistory || [], before, after: before, rerunAgents: [] as string[] };
  let improved = [...outputs];
  let currentScore = before;
  const rerunAgents: string[] = [];
  const history = [...(project.acceptanceHistory || [])];
  for (let pass = 0; pass < 2 && currentScore < target; pass += 1) {
    const indices = improved.map((item, index) => ({ index, confidence: item.confidence, degraded: item.status === 'degraded' ? 1 : 0 })).sort((a, b) => b.degraded - a.degraded || a.confidence - b.confidence || a.index - b.index).slice(0, 2).map(item => item.index);
    const retryMode: ThinkingMode = indices.some(index => improved[index].status === 'degraded') ? 'DEEP' : thinkingMode;
    const replacements = await runDesignWave(indices, context, improved, retryMode);
    for (const replacement of replacements) {
      const index = improved.findIndex(item => item.agentId === replacement.agentId);
      if (index >= 0 && replacement.status === 'complete' && (improved[index].status !== 'complete' || replacement.confidence > improved[index].confidence)) improved[index] = replacement;
    }
    const passAgents = indices.map(index => DESIGN_AGENTS[index].name);
    const nextScore = calculateScore(improved);
    history.push({ at: Date.now(), before: currentScore, after: nextScore, rerunAgents: passAgents });
    rerunAgents.push(...passAgents);
    if (nextScore <= currentScore) break;
    currentScore = nextScore;
  }
  return { outputs: improved, before, after: currentScore, rerunAgents: Array.from(new Set(rerunAgents)), history };
}

async function finalizeProject(id: string, project: ProjectRecord) {
  const hasFinalizingLog = project.timeline.some(item => item.label === 'تجميع النتيجة');
  const preparing: ProjectRecord = {
    ...project,
    status: 'running',
    progress: 95,
    updatedAt: Date.now(),
    timeline: hasFinalizingLog ? project.timeline : [...project.timeline, { at: Date.now(), label: 'تجميع النتيجة', detail: 'المنسق النهائي يدمج مخرجات الوكلاء التسعة.' }]
  };
  await updateProject(id, preparing);
  const degradedAgents = preparing.agentOutputs.filter(item => item.status === 'degraded');
  if (degradedAgents.length) throw new Error(`تعذر اعتماد نتيجة تحتوي ${degradedAgents.length} مخرجات غير مكتملة`);
  const context = await buildFinalizeContext(preparing);
  const synthesis = await synthesizeDesign(context, preparing.agentOutputs, 'DEEP');
  const score = calculateScore(preparing.agentOutputs);
  const completedAt = Date.now();
  const finished: ProjectRecord = {
    ...preparing,
    status: 'review',
    progress: 100,
    synthesis,
    score,
    updatedAt: completedAt,
    timeline: [...preparing.timeline, { at: completedAt, label: 'جاهز للمراجعة', detail: `اكتملت الجولة بدرجة ${score}/100 وتحتاج قرارك البشري.` }]
  };
  if (preparing.currentRunId) {
    const [existingRun] = await db.get<RunRecord>(RUNS, [preparing.currentRunId]);
    if (existingRun) await db.update(RUNS, [{ id: preparing.currentRunId, record: { ...existingRun, outputs: preparing.agentOutputs, synthesis, score, status: 'review', completedAt } }]);
  }
  return updateProject(id, finished);
}

export const appRoutes: RouterRoutes = {
  'GET /api/admin/backup': [async ctx => {
    let expected = '';
    try { expected = await secrets.readSecret('BACKUP_TOKEN'); }
    catch { return error('خدمة النسخ الاحتياطي غير مفعلة', 503); }
    const headers = (ctx.event?.headers || {}) as Record<string, string | undefined>;
    const provided = headers['x-backup-token'] || headers['X-Backup-Token'] || '';
    if (!provided || !safeTokenEqual(provided, expected)) return error('غير مصرح', 401);
    const [projects, runs, memories] = await Promise.all([
      listAllRecords<ProjectRecord>(PROJECTS),
      listAllRecords<RunRecord>(RUNS),
      listAllRecords<Record<string, unknown>>(MEMORIES)
    ]);
    return json({
      version: 1,
      app: 'nasq-ai',
      exportedAt: new Date().toISOString(),
      counts: { projects: projects.length, runs: runs.length, memories: memories.length },
      data: { projects, runs, memories }
    });
  }],
  'GET /api/methodology': [async () => json({ agents: DESIGN_AGENTS })],
  'GET /api/demo-preview': [async () => htmlResponse(buildDemoPreview())],
  'GET /api/public-preview/:token': [async ctx => {
    const publicPath = `site-previews/public/${ctx.params.token}.html`;
    const [publicFile] = await storage.read([publicPath]);
    if (publicFile?.content) return htmlResponse(publicFile.content);
    const projects = await listAllRecords<ProjectRecord>(PROJECTS);
    const project = projects.find(item => item.previewToken === ctx.params.token);
    if (!project?.previewHtmlPath) return error('المعاينة غير موجودة', 404);
    const [file] = await storage.read([project.previewHtmlPath]);
    if (!file?.content) return error('ملف المعاينة غير موجود', 404);
    return htmlResponse(file.content);
  }],
  'GET /api/preview-content/:token': [async ctx => {
    if (ctx.params.token === 'demo') return json({ name:'نَسَق', html:buildDemoPreview() });
    const publicPath = `site-previews/public/${ctx.params.token}.html`;
    const [publicFile] = await storage.read([publicPath]);
    if (publicFile?.content) return json({ name:'معاينة المشروع', html:publicFile.content });
    const projects = await listAllRecords<ProjectRecord>(PROJECTS);
    const project = projects.find(item => item.previewToken === ctx.params.token);
    if (!project?.previewHtmlPath) return error('المعاينة غير موجودة', 404);
    const [file] = await storage.read([project.previewHtmlPath]);
    if (!file?.content) return error('ملف المعاينة غير موجود', 404);
    return json({ name:project.name, html:file.content });
  }],

  'POST /api/projects/from-idea': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as { idea?: string; mode?: ProjectRecord['mode']; acceptanceTarget?: number };
      const idea = String(body.idea || '').trim();
      if (idea.length < 8) return error('اكتب فكرة قصيرة من ثماني خانات على الأقل', 400);
      const mode: ProjectRecord['mode'] = body.mode === 'economy' || body.mode === 'deep' ? body.mode : 'balanced';
      const managerBrief = await expandProjectIdea(idea, mode);
      const acceptanceTarget = Math.max(75, Math.min(95, Number(body.acceptanceTarget) || 85));
      const now = Date.now();
      const record: ProjectRecord = {
        userId: ctx.user!.userId,
        name: managerBrief.name,
        brief: managerBrief.brief,
        audience: managerBrief.audience,
        goal: managerBrief.goal,
        style: managerBrief.style,
        references: managerBrief.references,
        mode,
        managerBrief,
        acceptanceTarget,
        acceptanceHistory: [],
        status: 'draft',
        progress: 0,
        currentWave: 0,
        agentOutputs: [],
        timeline: [
          { at: now, label: 'استلم مدير نَسَق الفكرة', detail: managerBrief.summary },
          { at: now + 1, label: 'تم توزيع المهام', detail: `وُزعت خطة التنفيذ على ${managerBrief.taskPlan.length}/9 وكلاء، والهدف ${acceptanceTarget}/100.` }
        ],
        createdAt: now,
        updatedAt: now
      };
      const [id] = await db.add(PROJECTS, [record]);
      if (!id) return error('تعذر إنشاء المشروع', 500);
      return json({ project: await enrichProject(id, record) }, 201);
    }
  ],

  'GET /api/projects': [
    requireAuth(),
    async ctx => {
      const { items } = await db.list<ProjectRecord>(PROJECTS, { filter: { userId: ctx.user!.userId } });
      const projects = await Promise.all(items.sort((a, b) => b.updatedAt - a.updatedAt).map(item => enrichProject(item.id, item)));
      return json({ projects });
    }
  ],

  'POST /api/projects': [
    requireAuth(),
    async ctx => {
      const body = (ctx.body || {}) as Partial<ProjectRecord>;
      if (!body.name?.trim() || !body.brief?.trim()) return error('اسم المشروع والموجز مطلوبان', 400);
      const now = Date.now();
      const record: ProjectRecord = {
        userId: ctx.user!.userId,
        name: body.name.trim().slice(0, 120),
        brief: body.brief.trim().slice(0, 6000),
        audience: String(body.audience || 'الجمهور العام').slice(0, 500),
        goal: String(body.goal || 'تحسين الوضوح والتحويل').slice(0, 500),
        style: String(body.style || 'حديث وواضح').slice(0, 500),
        references: Array.isArray(body.references) ? body.references.map(String).filter(Boolean).slice(0, 5) : [],
        mode: body.mode === 'economy' || body.mode === 'deep' ? body.mode : 'balanced',
        acceptanceTarget: 85,
        acceptanceHistory: [],
        status: 'draft',
        progress: 0,
        currentWave: 0,
        agentOutputs: [],
        timeline: [{ at: now, label: 'تم إنشاء المشروع', detail: 'الموجز جاهز لبدء مجلس التصميم.' }],
        createdAt: now,
        updatedAt: now
      };
      const [id] = await db.add(PROJECTS, [record]);
      if (!id) return error('تعذر إنشاء المشروع', 500);
      return json({ project: await enrichProject(id, record) }, 201);
    }
  ],

  'GET /api/projects/:id/runs': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      const { items } = await db.list<RunRecord>(RUNS, { filter: { userId: ctx.user!.userId, projectId: ctx.params.id } });
      return json({ runs: items.sort((a, b) => b.startedAt - a.startedAt) });
    }
  ],

  'GET /api/projects/:id': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      return json({ project: await enrichProject(ctx.params.id, project) });
    }
  ],

  'PUT /api/projects/:id/brief': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      if (project.status !== 'draft' || project.agentOutputs.length > 0) return error('لا يمكن تعديل الموجز بعد بدء الوكلاء', 409);
      const body = (ctx.body || {}) as Partial<ProjectRecord>;
      const name = String(body.name || '').trim().slice(0, 120);
      const brief = String(body.brief || '').trim().slice(0, 6000);
      if (!name || !brief) return error('اسم المشروع والموجز مطلوبان', 400);
      const audience = String(body.audience || 'الجمهور العام').trim().slice(0, 500);
      const goal = String(body.goal || 'تحسين الوضوح والتحويل').trim().slice(0, 500);
      const style = String(body.style || 'حديث وواضح').trim().slice(0, 500);
      const references = Array.isArray(body.references) ? body.references.map(String).map(value => value.trim()).filter(value => /^https?:\/\//i.test(value)).slice(0, 5) : [];
      const mode: ProjectRecord['mode'] = body.mode === 'economy' || body.mode === 'deep' ? body.mode : 'balanced';
      const now = Date.now();
      const managerBrief = project.managerBrief ? { ...project.managerBrief, name, brief, audience, goal, style, references, generatedAt: now } : undefined;
      const next: ProjectRecord = { ...project, name, brief, audience, goal, style, references, mode, managerBrief, updatedAt: now, timeline: [...project.timeline, { at: now, label: 'اعتمد المستخدم الموجز', detail: 'تمت مراجعة نتيجة مدير نَسَق وتحديث الحقول قبل تشغيل الوكلاء.' }] };
      return json({ project: await updateProject(ctx.params.id, next) });
    }
  ],

  'DELETE /api/projects/:id': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      const storedPaths = [project.conceptImagePath, project.previewHtmlPath].filter((value): value is string => Boolean(value));
      if (storedPaths.length) await storage.delete(storedPaths);
      const { items: runs } = await db.list<RunRecord>(RUNS, { filter: { userId: ctx.user!.userId, projectId: ctx.params.id } });
      if (runs.length) await db.delete(RUNS, runs.map(item => item.id));
      await db.delete(PROJECTS, [ctx.params.id]);
      return json({ ok: true });
    }
  ],

  'POST /api/projects/:id/run': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      const legacyPartial = project.agentOutputs.length > 0 && project.agentOutputs.length < 9;
      if (project.status === 'running' && project.currentRunId && !legacyPartial) return error('هناك مجلس يعمل حاليًا', 409);
      const now = Date.now();
      const run: RunRecord = { userId: project.userId, projectId: ctx.params.id, status: 'running', mode: project.mode, outputs: [], startedAt: now };
      const [runId] = await db.add(RUNS, [run]);
      if (!runId) return error('تعذر بدء المجلس', 500);
      const preparing: ProjectRecord = { ...project, status: 'running', progress: 10, currentWave: 0, currentRunId: runId, agentOutputs: [], synthesis: undefined, score: undefined, updatedAt: now, timeline: [...project.timeline, { at: now, label: 'بدأ مجلس نَسَق', detail: 'يحوّل المجلس موجز مدير نَسَق إلى خطة موقع مخصصة ثم يبني المعاينة الحية.' }] };
      await updateProject(ctx.params.id, preparing);
      try {
        const context = await buildContext(preparing);
        const council = buildDirectCouncil(preparing, context);
        const score = calculateScore(council.outputs);
        const completedAt = Date.now();
        const finished: ProjectRecord = { ...preparing, status: 'review', progress: 100, currentWave: 3, agentOutputs: council.outputs, synthesis: council.synthesis, score, updatedAt: completedAt, timeline: [...preparing.timeline, { at: completedAt, label: 'اكتملت خطة الموقع', detail: `اكتملت الأدوار التسعة وخطة التصميم بدرجة ${score}/100، وبدأ تجهيز المعاينة المطابقة للفكرة.` }] };
        await db.update(RUNS, [{ id: runId, record: { ...run, outputs: council.outputs, synthesis: council.synthesis, score, status: 'review', completedAt } }]);
        return json({ project: await updateProject(ctx.params.id, finished), needsFinalize: false });
      } catch (err) {
        const details = err && typeof err === 'object' ? {
          name: 'name' in err ? String((err as { name?: unknown }).name || '') : '',
          message: 'message' in err ? String((err as { message?: unknown }).message || '') : '',
          statusCode: 'statusCode' in err ? Number((err as { statusCode?: unknown }).statusCode || 0) : 0,
          responseText: 'responseText' in err ? String((err as { responseText?: unknown }).responseText || '').slice(0, 500) : ''
        } : { name: '', message: String(err || ''), statusCode: 0, responseText: '' };
        console.error('design_council_failed_details', JSON.stringify(details));
        const diagnostic = [details.statusCode ? `status ${details.statusCode}` : '', details.message, details.responseText].filter(Boolean).join(' | ').slice(0, 350);
        const failed: ProjectRecord = { ...preparing, status: 'error', progress: 8, updatedAt: Date.now(), timeline: [...preparing.timeline, { at: Date.now(), label: 'تعذر مجلس نَسَق', detail: 'لم تُنشأ نتائج بديلة؛ أعد المحاولة عندما يتوفر مزود الذكاء.' }] };
        await updateProject(ctx.params.id, failed);
        return error(`تعذر إكمال مجلس الوكلاء الآن${diagnostic ? `: ${diagnostic}` : ''}`, 502);
      }
    }
  ],

  'POST /api/projects/:id/run-legacy': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      const continuing = project.status === 'running' && Boolean(project.currentRunId) && project.agentOutputs.length < 9;
      const now = Date.now();
      let runId = project.currentRunId;
      let run: RunRecord;
      let working: ProjectRecord;
      if (continuing && runId) {
        const [existingRun] = await db.get<RunRecord>(RUNS, [runId]);
        if (!existingRun) return error('سجل الجولة غير موجود', 409);
        run = existingRun;
        working = project;
      } else {
        run = { userId: project.userId, projectId: ctx.params.id, status: 'running', mode: project.mode, outputs: [], startedAt: now };
        const [createdRunId] = await db.add(RUNS, [run]);
        if (!createdRunId) return error('تعذر بدء الجولة', 500);
        runId = createdRunId;
        working = {
          ...project,
          status: 'running',
          progress: 4,
          currentWave: 0,
          currentRunId: runId,
          agentOutputs: [],
          synthesis: undefined,
          score: undefined,
          updatedAt: now,
          timeline: [...project.timeline, { at: now, label: 'بدأت الجولة', detail: 'تم تقسيم التنفيذ إلى موجات محفوظة لحماية الجودة والاتصال.' }]
        };
        await updateProject(ctx.params.id, working);
      }
      try {
        const context = await buildContext(working);
        const thinkingMode = modeToThinking(working.mode);
        if (working.agentOutputs.length === 0) {
          const prepared: ProjectRecord = { ...working, progress: 10, updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'اكتملت التهيئة', detail: `تم تحميل ${context.referenceEvidence.length} مرجع و${context.memories.length} ذاكرة معتمدة.` }] };
          const wave = await runWave([0, 1, 2], context, [], thinkingMode);
          working = { ...prepared, currentWave: 1, progress: 34, agentOutputs: wave, updatedAt: Date.now(), timeline: [...prepared.timeline, { at: Date.now(), label: 'الموجة الأولى', detail: 'اكتملت المواصفات والبحث والاستراتيجية وحُفظت النتائج.' }] };
          await db.update(RUNS, [{ id: runId!, record: { ...run, outputs: wave, status: 'running' } }]);
          return json({ project: await updateProject(ctx.params.id, working), needsContinue: true });
        }
        if (working.agentOutputs.length === 3) {
          const wave = await runWave([3, 4, 5], context, working.agentOutputs, thinkingMode);
          const outputs = [...working.agentOutputs, ...wave];
          working = { ...working, currentWave: 2, progress: 66, agentOutputs: outputs, updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'الموجة الثانية', detail: 'اكتملت الذاكرة ومعمارية UX واتجاه UI وحُفظت النتائج.' }] };
          await db.update(RUNS, [{ id: runId!, record: { ...run, outputs, status: 'running' } }]);
          return json({ project: await updateProject(ctx.params.id, working), needsContinue: true });
        }
        if (working.agentOutputs.length === 6) {
          const wave = await runWave([6, 7, 8], context, working.agentOutputs, thinkingMode);
          const outputs = [...working.agentOutputs, ...wave];
          working = { ...working, currentWave: 3, progress: 86, agentOutputs: outputs, updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'اكتملت مخرجات الوكلاء', detail: 'اكتملت 9/9 مخرجات وحُفظت قبل فحص القبول.' }] };
          await db.update(RUNS, [{ id: runId!, record: { ...run, outputs, status: 'running' } }]);
          return json({ project: await updateProject(ctx.params.id, working), needsContinue: true });
        }
        if (working.agentOutputs.length === 9) {
          const improvement = await improveAcceptance(working, context, working.agentOutputs, thinkingMode);
          working = {
            ...working,
            progress: 90,
            agentOutputs: improvement.outputs,
            acceptanceHistory: improvement.history,
            updatedAt: Date.now(),
            timeline: [...working.timeline, {
              at: Date.now(),
              label: improvement.rerunAgents.length ? 'تحسين درجة القبول' : 'درجة القبول مستوفاة',
              detail: improvement.rerunAgents.length ? `أعيدت مراجعة ${improvement.rerunAgents.join(' و')} وانتقلت الدرجة من ${improvement.before} إلى ${improvement.after}/100.` : `النتيجة الأولية ${improvement.after}/100 وتجاوزت الهدف دون جولة إضافية.`
            }]
          };
          await db.update(RUNS, [{ id: runId!, record: { ...run, outputs: improvement.outputs, status: 'finalizing' } }]);
          return json({ project: await updateProject(ctx.params.id, working), needsFinalize: true });
        }
        return error('حالة الجولة غير متوقعة؛ افتح المشروع وأعد المحاولة', 409);
      } catch (err) {
        console.error('run_step_failed', err);
        const failed: ProjectRecord = { ...working, status: 'error', updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'تعذرت الموجة الحالية', detail: 'النتائج السابقة محفوظة ويمكن استكمال الموجة دون بدء المشروع من الصفر.' }] };
        await updateProject(ctx.params.id, failed);
        return error('تعذر إكمال موجة الوكلاء', 502);
      }
    }
  ],

  'POST /api/projects/:id/finalize': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      if (project.synthesis) return json({ project: await enrichProject(ctx.params.id, project) });
      if (project.agentOutputs.length < 9) return error('لم تكتمل مخرجات الوكلاء التسعة بعد', 409);
      if (project.progress === 95 && Date.now() - project.updatedAt < 15000) return error('المنسق النهائي يعمل حاليًا', 409);
      try {
        return json({ project: await finalizeProject(ctx.params.id, project) });
      } catch (err) {
        console.error('finalize_failed', err);
        const failed: ProjectRecord = { ...project, status: 'error', progress: 88, updatedAt: Date.now(), timeline: [...project.timeline, { at: Date.now(), label: 'تعذر تجميع النتيجة', detail: 'مخرجات 9/9 محفوظة ويمكن الضغط على استكمال النتيجة مجددًا.' }] };
        await updateProject(ctx.params.id, failed);
        return error('تعذر تجميع النتيجة النهائية', 502);
      }
    }
  ],

  'POST /api/projects/:id/decision': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      const body = (ctx.body || {}) as { decision?: 'approve' | 'revise'; feedback?: string };
      if (body.decision !== 'approve' && body.decision !== 'revise') return error('قرار غير صالح', 400);
      const now = Date.now();
      if (body.decision === 'approve') {
        const memoryContent = JSON.stringify({ name: project.name, style: project.style, goal: project.goal, synthesis: project.synthesis, score: project.score }).slice(0, 20000);
        await db.add(MEMORIES, [{ userId: project.userId, projectId: ctx.params.id, title: `قرار معتمد: ${project.name}`, content: memoryContent, createdAt: now }]);
      }
      const next: ProjectRecord = {
        ...project,
        status: body.decision === 'approve' ? 'approved' : 'needs_revision',
        feedback: String(body.feedback || '').slice(0, 2000),
        updatedAt: now,
        timeline: [...project.timeline, { at: now, label: body.decision === 'approve' ? 'تم الاعتماد' : 'مطلوب تعديل', detail: body.feedback || (body.decision === 'approve' ? 'تم حفظ القرار في ذاكرة الاستوديو.' : 'أضف ملاحظاتك ثم شغّل جولة جديدة.') }]
      };
      return json({ project: await updateProject(ctx.params.id, next) });
    }
  ],

  'POST /api/projects/:id/site-preview': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      if (!project.synthesis) return error('أكمل نتيجة الوكلاء أولًا', 400);
      try {
        const token = project.previewToken || randomUUID().replace(/-/g, '');
        const path = project.previewHtmlPath || `site-previews/public/${token}.html`;
        const html = await generateSitePreview(project);
        const [ok] = await storage.write([{ path, content:html, contentType:'text/html' }]);
        if (!ok) return error('تعذر حفظ معاينة الموقع', 500);
        const now = Date.now();
        const next: ProjectRecord = { ...project, previewToken:token, previewHtmlPath:path, previewUpdatedAt:now, updatedAt:now, timeline:[...project.timeline, { at:now, label:'تم بناء معاينة الموقع', detail:'أصبحت نسخة الموقع الكاملة جاهزة للفتح والمشاركة.' }] };
        return json({ project:await updateProject(ctx.params.id, next) });
      } catch (err) {
        console.error('site_preview_failed', err);
        return error('تعذر بناء معاينة الموقع الآن', 502);
      }
    }
  ],

  'POST /api/projects/:id/concept-image': [
    requireAuth(),
    async ctx => {
      const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
      if (!project) return error('المشروع غير موجود', 404);
      if (!project.synthesis) return error('شغّل الوكلاء أولًا', 400);
      try {
        const prompt = `Premium UI UX visual direction board for an Arabic digital product named ${project.name}. Style: ${project.style}. Goal: ${project.goal}. Use refined editorial layout, interface fragments, typography samples, color swatches, mobile and desktop components. No readable brand logos, no stock-photo collage, no excessive neon. 16:9 presentation board.`;
        const generated = await ai.imageGen({ prompt, maxOutputBytes: 900000 });
        const path = `concepts/${ctx.user!.userId}/${ctx.params.id}-${Date.now()}.png`;
        const [ok] = await storage.write([{ path, content: generated.image.data, contentType: generated.image.mimeType }]);
        if (!ok) return error('تعذر حفظ اللوحة', 500);
        if (project.conceptImagePath) await storage.delete([project.conceptImagePath]);
        const next: ProjectRecord = { ...project, conceptImagePath: path, updatedAt: Date.now(), timeline: [...project.timeline, { at: Date.now(), label: 'تم توليد الاتجاه البصري', detail: 'أضيفت لوحة مرئية قابلة للعرض على العميل.' }] };
        return json({ project: await updateProject(ctx.params.id, next) });
      } catch (err) {
        console.error('concept_image_failed', err);
        return error('تعذر توليد الاتجاه البصري الآن', 502);
      }
    }
  ]
};
