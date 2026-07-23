import { randomUUID, timingSafeEqual } from 'crypto';
import { ai, db, error, json, requireAuth, secrets, storage, type RouterRoutes } from '@appdeploy/sdk';
import { notifySubscribers } from './realtime-subscribers';
import { calculateScore, DESIGN_AGENTS, runDesignAgent, synthesizeDesign, type AgentOutput, type ProjectContext, type ThinkingMode } from './design-agents';
import { buildDemoPreview, generateSitePreview, htmlResponse } from './site-preview';
import { expandProjectIdea, type ManagerBrief } from './project-manager';
import { mergeImprovedOutputs, selectImprovementIndices } from '../lib/project-quality.mjs';

type ProjectRecord = {
  userId: string; name: string; brief: string; audience: string; goal: string; style: string;
  references: string[]; mode: 'economy' | 'balanced' | 'deep';
  status: 'draft' | 'running' | 'review' | 'approved' | 'needs_revision' | 'error';
  progress: number; currentWave: number; currentRunId?: string; agentOutputs: AgentOutput[];
  synthesis?: Record<string, unknown>; score?: number; feedback?: string; conceptImagePath?: string;
  previewToken?: string; previewHtmlPath?: string; previewUpdatedAt?: number;
  managerBrief?: ManagerBrief; acceptanceTarget?: number;
  acceptanceHistory?: Array<{ at: number; before: number; after: number; rerunAgents: string[] }>;
  timeline: Array<{ at: number; label: string; detail: string }>; createdAt: number; updatedAt: number;
};

type RunRecord = {
  userId: string; projectId: string; status: string; mode: string; outputs: AgentOutput[];
  synthesis?: Record<string, unknown>; score?: number; startedAt: number; completedAt?: number;
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

function modeToThinking(mode: ProjectRecord['mode']): ThinkingMode { return mode === 'deep' ? 'DEEP' : 'FAST'; }

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
  return { id, ...project, conceptImageUrl, previewPath: project.previewToken ? `#/preview/${project.previewToken}` : undefined, scoreBreakdown: { completeAgents, degradedAgents, averageConfidence, label: qualityLabel } };
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

async function buildContext(project: ProjectRecord): Promise<ProjectContext> {
  const [referenceEvidence, memories] = await Promise.all([scrapeReferences(project.references || []), loadMemories(project.userId)]);
  return { name: project.name, brief: project.brief, audience: project.audience, goal: project.goal, style: project.style, references: project.references || [], referenceEvidence, memories, feedback: project.feedback, managerSummary: project.managerBrief?.summary, taskPlan: project.managerBrief?.taskPlan };
}

async function runWave(indices: number[], context: ProjectContext, previous: AgentOutput[], thinkingMode: ThinkingMode) {
  return Promise.all(indices.map(index => runDesignAgent(index, context, previous, thinkingMode)));
}


async function improveAcceptance(project: ProjectRecord, context: ProjectContext, outputs: AgentOutput[], thinkingMode: ThinkingMode) {
  const target = Math.max(70, Math.min(95, project.acceptanceTarget || 85));
  const before = calculateScore(outputs);
  const indices = selectImprovementIndices(outputs, target, 2);
  if (!indices.length) return { outputs, history: project.acceptanceHistory || [], improved: false, before, after: before, rerunAgents: [] as string[] };
  const feedback = [context.feedback || '', `جولة تحسين قبول مستهدفة للوصول إلى ${target}/100. عالج نقاط الضعف والتناقضات واكتب مخرجات قابلة للتنفيذ.`].filter(Boolean).join('\n');
  const improvedContext: ProjectContext = { ...context, feedback };
  const replacements = await runWave(indices, improvedContext, outputs, thinkingMode);
  const merged = mergeImprovedOutputs(outputs, replacements) as AgentOutput[];
  const after = calculateScore(merged);
  const rerunAgents = replacements.map(item => item.name);
  return {
    outputs: merged,
    improved: after > before,
    before,
    after,
    rerunAgents,
    history: [...(project.acceptanceHistory || []), { at: Date.now(), before, after, rerunAgents }]
  };
}

async function finalizeProject(id: string, project: ProjectRecord) {
  const hasFinalizingLog = project.timeline.some(item => item.label === 'تجميع النتيجة');
  const preparing: ProjectRecord = {
    ...project, status: 'running', progress: 95, updatedAt: Date.now(),
    timeline: hasFinalizingLog ? project.timeline : [...project.timeline, { at: Date.now(), label: 'تجميع النتيجة', detail: 'المنسق النهائي يدمج مخرجات الوكلاء التسعة.' }]
  };
  await updateProject(id, preparing);
  const context = await buildContext(preparing);
  const synthesis = await synthesizeDesign(context, preparing.agentOutputs, modeToThinking(preparing.mode));
  const score = calculateScore(preparing.agentOutputs);
  const completedAt = Date.now();
  const finished: ProjectRecord = {
    ...preparing, status: 'review', progress: 100, synthesis, score, updatedAt: completedAt,
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
      app: 'marsad-tisaa-pro',
      exportedAt: new Date().toISOString(),
      counts: { projects: projects.length, runs: runs.length, memories: memories.length },
      data: { projects, runs, memories }
    });
  }],
  'GET /api/methodology': [async () => json({ agents: DESIGN_AGENTS })],
  'GET /api/demo-preview': [async () => htmlResponse(buildDemoPreview())],
  'GET /api/public-preview/:token': [async ctx => {
    const { items } = await db.list<ProjectRecord>(PROJECTS, { filter: { previewToken: ctx.params.token } });
    const project = items[0];
    if (!project?.previewHtmlPath) return error('المعاينة غير موجودة', 404);
    const [file] = await storage.read([project.previewHtmlPath]);
    if (!file?.content) return error('ملف المعاينة غير موجود', 404);
    return htmlResponse(file.content);
  }],
  'GET /api/preview-content/:token': [async ctx => {
    if (ctx.params.token === 'demo') return json({ name: 'استوديو تصميم ذكي', html: buildDemoPreview() });
    const { items } = await db.list<ProjectRecord>(PROJECTS, { filter: { previewToken: ctx.params.token } });
    const project = items[0];
    if (!project?.previewHtmlPath) return error('المعاينة غير موجودة', 404);
    const [file] = await storage.read([project.previewHtmlPath]);
    if (!file?.content) return error('ملف المعاينة غير موجود', 404);
    return json({ name: project.name, html: file.content });
  }],


  'POST /api/project-manager/brief': [requireAuth(), async ctx => {
    const body = (ctx.body || {}) as { idea?: string; mode?: ProjectRecord['mode'] };
    const idea = String(body.idea || '').trim();
    if (idea.length < 8) return error('اكتب فكرتك بجملة قصيرة على الأقل', 400);
    const mode = body.mode === 'economy' || body.mode === 'deep' ? body.mode : 'balanced';
    const managerBrief = await expandProjectIdea(idea, mode);
    return json({ managerBrief });
  }],

  'POST /api/projects/from-idea': [requireAuth(), async ctx => {
    const body = (ctx.body || {}) as { idea?: string; mode?: ProjectRecord['mode']; acceptanceTarget?: number };
    const idea = String(body.idea || '').trim();
    if (idea.length < 8) return error('اكتب فكرتك بجملة قصيرة على الأقل', 400);
    const mode = body.mode === 'economy' || body.mode === 'deep' ? body.mode : 'balanced';
    const managerBrief = await expandProjectIdea(idea, mode);
    const now = Date.now();
    const acceptanceTarget = Math.max(75, Math.min(95, Number(body.acceptanceTarget) || 85));
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
      status: 'draft', progress: 0, currentWave: 0, agentOutputs: [],
      timeline: [
        { at: now, label: 'استلم مدير نَسَق الفكرة', detail: managerBrief.summary },
        { at: now + 1, label: 'تم توزيع المهام', detail: `وُزعت خطة التنفيذ على ${managerBrief.taskPlan.length}/9 وكلاء، والهدف ${acceptanceTarget}/100.` }
      ],
      createdAt: now, updatedAt: now
    };
    const [id] = await db.add(PROJECTS, [record]);
    if (!id) return error('تعذر إنشاء المشروع', 500);
    return json({ project: await enrichProject(id, record) }, 201);
  }],

  'GET /api/projects': [requireAuth(), async ctx => {
    const { items } = await db.list<ProjectRecord>(PROJECTS, { filter: { userId: ctx.user!.userId } });
    const projects = await Promise.all(items.sort((a, b) => b.updatedAt - a.updatedAt).map(item => enrichProject(item.id, item)));
    return json({ projects });
  }],

  'POST /api/projects': [requireAuth(), async ctx => {
    const body = (ctx.body || {}) as Partial<ProjectRecord>;
    if (!body.name?.trim() || !body.brief?.trim()) return error('اسم المشروع والموجز مطلوبان', 400);
    const now = Date.now();
    const record: ProjectRecord = {
      userId: ctx.user!.userId, name: body.name.trim().slice(0, 120), brief: body.brief.trim().slice(0, 6000),
      audience: String(body.audience || 'الجمهور العام').slice(0, 500), goal: String(body.goal || 'تحسين الوضوح والتحويل').slice(0, 500),
      style: String(body.style || 'حديث وواضح').slice(0, 500), references: Array.isArray(body.references) ? body.references.map(String).filter(Boolean).slice(0, 5) : [],
      mode: body.mode === 'economy' || body.mode === 'deep' ? body.mode : 'balanced', acceptanceTarget: 85, acceptanceHistory: [], status: 'draft', progress: 0, currentWave: 0,
      agentOutputs: [], timeline: [{ at: now, label: 'تم إنشاء المشروع', detail: 'الموجز جاهز لبدء مجلس التصميم.' }], createdAt: now, updatedAt: now
    };
    const [id] = await db.add(PROJECTS, [record]);
    if (!id) return error('تعذر إنشاء المشروع', 500);
    return json({ project: await enrichProject(id, record) }, 201);
  }],

  'GET /api/projects/:id': [requireAuth(), async ctx => {
    const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
    if (!project) return error('المشروع غير موجود', 404);
    return json({ project: await enrichProject(ctx.params.id, project) });
  }],

  'GET /api/projects/:id/runs': [requireAuth(), async ctx => {
    const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
    if (!project) return error('المشروع غير موجود', 404);
    const { items } = await db.list<RunRecord>(RUNS, { filter: { userId: ctx.user!.userId, projectId: ctx.params.id } });
    return json({ runs: items.sort((a, b) => b.startedAt - a.startedAt) });
  }],

  'DELETE /api/projects/:id': [requireAuth(), async ctx => {
    const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
    if (!project) return error('المشروع غير موجود', 404);
    const storedPaths = [project.conceptImagePath, project.previewHtmlPath].filter((value): value is string => Boolean(value));
    if (storedPaths.length) await storage.delete(storedPaths);
    const { items: runs } = await db.list<RunRecord>(RUNS, { filter: { userId: ctx.user!.userId, projectId: ctx.params.id } });
    if (runs.length) await db.delete(RUNS, runs.map(item => item.id));
    await db.delete(PROJECTS, [ctx.params.id]);
    return json({ ok: true });
  }],

  'POST /api/projects/:id/run': [requireAuth(), async ctx => {
    const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
    if (!project) return error('المشروع غير موجود', 404);
    if (project.status === 'running') return error('هناك جولة تعمل حاليًا', 409);
    const now = Date.now();
    const run: RunRecord = { userId: project.userId, projectId: ctx.params.id, status: 'running', mode: project.mode, outputs: [], startedAt: now };
    const [runId] = await db.add(RUNS, [run]);
    if (!runId) return error('تعذر بدء الجولة', 500);
    let working: ProjectRecord = {
      ...project, status: 'running', progress: 4, currentWave: 0, currentRunId: runId, agentOutputs: [], synthesis: undefined, score: undefined,
      updatedAt: now, timeline: [...project.timeline, { at: now, label: 'بدأت الجولة', detail: 'جاري تجهيز الأدلة والذاكرة.' }]
    };
    await updateProject(ctx.params.id, working);
    try {
      const context = await buildContext(working);
      const thinkingMode = modeToThinking(working.mode);
      working = { ...working, progress: 10, updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'اكتملت التهيئة', detail: `تم تحميل ${context.referenceEvidence.length} مرجع و${context.memories.length} ذاكرة معتمدة.` }] };
      await updateProject(ctx.params.id, working);

      const wave1 = await runWave([0, 1, 2], context, [], thinkingMode);
      working = { ...working, currentWave: 1, progress: 34, agentOutputs: wave1, updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'الموجة الأولى', detail: 'اكتملت المواصفات والبحث والاستراتيجية.' }] };
      await db.update(RUNS, [{ id: runId, record: { ...run, outputs: wave1, status: 'running' } }]);
      await updateProject(ctx.params.id, working);

      const wave2 = await runWave([3, 4, 5], context, wave1, thinkingMode);
      const firstSix = [...wave1, ...wave2];
      working = { ...working, currentWave: 2, progress: 66, agentOutputs: firstSix, updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'الموجة الثانية', detail: 'اكتملت الذاكرة ومعمارية UX واتجاه UI.' }] };
      await db.update(RUNS, [{ id: runId, record: { ...run, outputs: firstSix, status: 'running' } }]);
      await updateProject(ctx.params.id, working);

      const wave3 = await runWave([6, 7, 8], context, firstSix, thinkingMode);
      const allOutputs = [...firstSix, ...wave3];
      working = { ...working, currentWave: 3, progress: 86, agentOutputs: allOutputs, updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'الموجة الثالثة', detail: 'اكتملت الكفاءة والتقييم والنقد المنافس.' }] };
      await updateProject(ctx.params.id, working);

      const improvement = await improveAcceptance(working, context, allOutputs, thinkingMode);
      working = {
        ...working,
        progress: 92,
        agentOutputs: improvement.outputs,
        acceptanceHistory: improvement.history,
        updatedAt: Date.now(),
        timeline: [...working.timeline, {
          at: Date.now(),
          label: improvement.rerunAgents.length ? 'تحسين درجة القبول' : 'درجة القبول مستوفاة',
          detail: improvement.rerunAgents.length
            ? `أعيدت مراجعة ${improvement.rerunAgents.join(' و')} وانتقلت الدرجة من ${improvement.before} إلى ${improvement.after}/100.`
            : `النتيجة الأولية ${improvement.after}/100 وتجاوزت الهدف دون جولة إضافية.`
        }]
      };
      await updateProject(ctx.params.id, working);
      return json({ project: await finalizeProject(ctx.params.id, working) });
    } catch (err) {
      console.error('run_failed', err);
      const failed: ProjectRecord = { ...working, status: 'error', updatedAt: Date.now(), timeline: [...working.timeline, { at: Date.now(), label: 'تعذر إكمال الجولة', detail: 'راجع الاتصال ثم أعد التشغيل.' }] };
      await updateProject(ctx.params.id, failed);
      return error('تعذر إكمال جولة الوكلاء', 502);
    }
  }],

  'POST /api/projects/:id/finalize': [requireAuth(), async ctx => {
    const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
    if (!project) return error('المشروع غير موجود', 404);
    if (project.synthesis) return json({ project: await enrichProject(ctx.params.id, project) });
    if (project.agentOutputs.length < 9) return error('لم تكتمل مخرجات الوكلاء التسعة بعد', 409);
    if (project.progress === 95 && Date.now() - project.updatedAt < 120000) return error('المنسق النهائي يعمل حاليًا', 409);
    try { return json({ project: await finalizeProject(ctx.params.id, project) }); }
    catch (err) {
      console.error('finalize_failed', err);
      const failed: ProjectRecord = { ...project, status: 'error', progress: 88, updatedAt: Date.now(), timeline: [...project.timeline, { at: Date.now(), label: 'تعذر تجميع النتيجة', detail: 'مخرجات 9/9 محفوظة ويمكن الضغط على استكمال النتيجة مجددًا.' }] };
      await updateProject(ctx.params.id, failed);
      return error('تعذر تجميع النتيجة النهائية', 502);
    }
  }],

  'POST /api/projects/:id/decision': [requireAuth(), async ctx => {
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
      ...project, status: body.decision === 'approve' ? 'approved' : 'needs_revision', feedback: String(body.feedback || '').slice(0, 2000), updatedAt: now,
      timeline: [...project.timeline, { at: now, label: body.decision === 'approve' ? 'تم الاعتماد' : 'مطلوب تعديل', detail: body.feedback || (body.decision === 'approve' ? 'تم حفظ القرار في ذاكرة الاستوديو.' : 'أضف ملاحظاتك ثم شغّل جولة جديدة.') }]
    };
    return json({ project: await updateProject(ctx.params.id, next) });
  }],

  'POST /api/projects/:id/site-preview': [requireAuth(), async ctx => {
    const project = await getOwnedProject(ctx.user!.userId, ctx.params.id);
    if (!project) return error('المشروع غير موجود', 404);
    if (!project.synthesis) return error('أكمل نتيجة الوكلاء أولًا', 400);
    try {
      const token = project.previewToken || randomUUID().replace(/-/g, '');
      const path = project.previewHtmlPath || `site-previews/${project.userId}/${token}.html`;
      const html = await generateSitePreview(project);
      const [ok] = await storage.write([{ path, content: html, contentType: 'text/html; charset=utf-8' }]);
      if (!ok) return error('تعذر حفظ معاينة الموقع', 500);
      const now = Date.now();
      const next: ProjectRecord = { ...project, previewToken: token, previewHtmlPath: path, previewUpdatedAt: now, updatedAt: now, timeline: [...project.timeline, { at: now, label: 'تم بناء معاينة الموقع', detail: 'أصبحت نسخة الموقع الكاملة جاهزة للفتح والمشاركة.' }] };
      return json({ project: await updateProject(ctx.params.id, next) });
    } catch (err) {
      console.error('site_preview_failed', err);
      return error('تعذر بناء معاينة الموقع الآن', 502);
    }
  }],

  'POST /api/projects/:id/concept-image': [requireAuth(), async ctx => {
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
  }]
};
