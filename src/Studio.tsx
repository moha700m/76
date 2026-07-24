import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { runCwcWaves } from './cwc-runner';
import { api, auth, ws, type AuthUser, type WsConnection } from '@appdeploy/client';
import {
  ArrowLeft, ArrowUpLeft, BookOpen, Bot, Brain, Check, ChevronLeft,
  Clock3, Copy, Download, ExternalLink, FileText, Gauge, Image, Layers3,
  LayoutDashboard, LogIn, LogOut, Menu, MessageSquareText, Monitor, Palette, Play, Plus, ChevronDown,
  RefreshCw, Search, ShieldCheck, Sparkles, Trash2, UserCheck, X, Zap
} from 'lucide-react';

type AgentOutput = {
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

type ManagerBrief = {
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

type Project = {
  id: string;
  name: string;
  brief: string;
  audience: string;
  goal: string;
  style: string;
  references: string[];
  mode: 'economy' | 'balanced' | 'deep';
  status: string;
  progress: number;
  currentWave: number;
  currentRunId?: string;
  agentOutputs: AgentOutput[];
  synthesis?: any;
  score?: number;
  scoreBreakdown?: { completeAgents: number; degradedAgents: number; averageConfidence: number; label: string };
  feedback?: string;
  conceptImageUrl?: string;
  previewPath?: string;
  previewUpdatedAt?: number;
  managerBrief?: ManagerBrief;
  acceptanceTarget?: number;
  acceptanceHistory?: Array<{ at: number; before: number; after: number; rerunAgents: string[] }>;
  timeline: Array<{ at: number; label: string; detail: string }>;
  createdAt: number;
  updatedAt: number;
};

type MethodAgent = { id: string; name: string; title: string; workshop: string; mission: string };
type ViewName = 'landing' | 'dashboard' | 'new' | 'project' | 'sources';

function apiErrorMessage(err: unknown, fallback: string) {
  if (!err || typeof err !== 'object') return fallback;
  const record = err as Record<string, unknown>;
  const response = record.response && typeof record.response === 'object' ? record.response as Record<string, unknown> : null;
  const data = response?.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  const candidate = data?.error || data?.message || response?.statusText || record.message;
  return typeof candidate === 'string' && candidate.trim() ? candidate.slice(0, 500) : fallback;
}

const agentBlueprints = [
  ['brief-analyst', 'محلل الموجز', 'تحويل الطلب إلى مواصفات', 'How We Claude Code', 'حوّل الطلب إلى أهداف واضحة ومعايير قبول قابلة للفحص.'],
  ['evidence-researcher', 'باحث الأدلة', 'السوق والمنافسون والمراجع', 'Research Desk', 'حلل المراجع وحدد ما يثق به الجمهور وما يجب تجنبه.'],
  ['product-strategist', 'استراتيجي المنتج', 'التموضع والقيمة والأولويات', 'Agent Decomposition', 'حدد الوعد الأساسي وما الذي يستحق البناء أولًا.'],
  ['memory-curator', 'أمين ذاكرة العلامة', 'القرارات السابقة والاتساق', 'Agents That Remember', 'استرجع القواعد المعتمدة كي لا يبدأ كل مشروع من الصفر.'],
  ['ux-architect', 'معماري التجربة', 'الرحلات والبنية والتدفقات', 'Production-Ready Agent', 'ابنِ أقصر رحلة من فهم القيمة إلى اتخاذ الإجراء.'],
  ['ui-director', 'مخرج الواجهة', 'النظام البصري والمكوّنات', 'Ship Your First Managed Agent', 'حوّل القرار إلى لغة بصرية متماسكة وقابلة للتنفيذ.'],
  ['efficiency-router', 'مهندس الكفاءة', 'عمق التفكير والوقت والتكلفة', 'Picking the Right Model', 'اختر العمق المناسب لكل مهمة دون هدر.'],
  ['quality-evaluator', 'مراجع الجودة', 'الوصول والأداء والاختبارات', 'Eval-Driven Agent Development', 'افحص الجوال والتباين والوضوح وحالات الخطأ.'],
  ['challenger', 'الناقد المنافس', 'كسر الحل قبل السوق', 'Agent Battle', 'اعترض على الحل وابحث عن الوعود الضعيفة ونقاط التسرب.']
] as const;

const demoAgents: AgentOutput[] = agentBlueprints.map((agent, index) => ({
  agentId: agent[0],
  name: agent[1],
  title: agent[2],
  workshop: agent[3],
  status: 'complete',
  summary: agent[4],
  findings: [
    index < 3 ? 'الرسالة الرئيسية يجب أن تظهر خلال الشاشة الأولى.' : 'كل قرار يجب أن يرتبط بهدف المستخدم.',
    index % 2 === 0 ? 'الجوال هو نقطة البداية وليس نسخة مصغرة من سطح المكتب.' : 'التفاصيل التقنية تظهر عند الطلب فقط.'
  ],
  decisions: ['مسار رئيسي واحد', 'واجهة RTL أصلية'],
  deliverable: `${agent[2]} جاهز للتسليم إلى الوكيل التالي.`,
  confidence: 88 + (index % 6),
  elapsedMs: 1200 + index * 140
}));

const demoProject: Project = {
  id: 'demo',
  name: 'نَسَق',
  brief: 'نَسَق منصة عربية ترتب عمل تسعة وكلاء متخصصين وتحول فكرة العميل إلى قرار تصميم ومعاينة موقع حقيقية قابلة للمشاركة.',
  audience: 'أصحاب الأعمال والوكالات والمستقلون في السعودية',
  goal: 'تحويل الفكرة إلى قرار تصميم ورابط عرض واضح',
  style: 'تقني فاخر، حبر داكن، سماوي وبنفسجي، Mobile First',
  references: [],
  mode: 'balanced',
  status: 'review',
  progress: 100,
  currentWave: 3,
  agentOutputs: demoAgents,
  score: 92,
  scoreBreakdown: { completeAgents: 9, degradedAgents: 0, averageConfidence: 92, label: 'قوي' },
  previewPath: '#/preview/demo',
  synthesis: {
    executiveSummary: 'تجربة تبيع النتيجة بدل المصطلحات: يرى العميل فريق الوكلاء يعمل، يفهم القرارات، ثم يفتح موقعًا حقيقيًا قابلًا للمشاركة.',
    positioning: 'تسعة تخصصات تعمل كاستوديو واحد، مع مراجعة بشرية قبل اعتماد النتيجة.',
    designDirection: 'خلفية حبرية عميقة، سماوي مضيء، بنفسجي بارد، طبقات واضحة وحركة وظيفية هادئة.',
    primaryJourney: ['فهم الوعد', 'مشاهدة العمل الحي', 'إنشاء الموجز', 'متابعة الوكلاء', 'مراجعة القرار', 'فتح المعاينة'],
    pages: [
      { name: 'الرئيسية', purpose: 'بيع الوعد وإظهار العمل الحي', sections: ['Hero', 'Live agents', 'Proof', 'CTA'] },
      { name: 'لوحة المشاريع', purpose: 'إدارة الجولات والمعاينات', sections: ['Overview', 'Projects', 'Quick start'] },
      { name: 'تفاصيل المشروع', purpose: 'متابعة الوكلاء والقرار', sections: ['Progress', 'Agents', 'Synthesis', 'Preview'] }
    ],
    designSystem: {
      palette: ['#05070B', '#0A0E15', '#73E7FF', '#9D8CFF', '#FFD166', '#F7FBFF'],
      typography: ['Cairo للعناوين', 'Noto Sans Arabic للنصوص'],
      components: ['زر رئيسي', 'بطاقة وكيل', 'حالة تشغيل', 'بطاقة قياس', 'مسرح معاينة']
    },
    conversionPlan: ['CTA رئيسي واضح', 'مثال حي قبل التسجيل', 'معاينة قابلة للمشاركة'],
    risks: ['إغراق المستخدم بالتفاصيل التقنية', 'إظهار الدرجة دون تفسير'],
    acceptanceCriteria: ['RTL كامل', 'متجاوب من 375px', 'تباين واضح', '9 مخرجات مستقلة', 'رابط معاينة عام'],
    nextActions: ['تشغيل مشروع حقيقي', 'مراجعة المعاينة', 'اعتماد النتيجة']
  },
  timeline: [
    { at: Date.now() - 90000, label: 'بدأت الجولة', detail: 'تم تجهيز الموجز والأدلة.' },
    { at: Date.now() - 30000, label: 'اكتملت الموجات', detail: 'أنهى الوكلاء التسعة أعمالهم.' },
    { at: Date.now(), label: 'جاهز للمراجعة', detail: 'اكتمل القرار بدرجة 92/100.' }
  ],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const sourceIcons = [FileText, Search, Layers3, Brain, UserCheck, Bot, Gauge, ShieldCheck, Zap];
const waveNames = ['المواصفات والبحث', 'التجربة والواجهة', 'التقييم والنقد'];
const APPDEPLOY_STUDIO_URL = 'https://441a4987f6936b832e.v2.appdeploy.ai/';

function isAppDeployHost() {
  return window.location.hostname.endsWith('.appdeploy.ai');
}

function openAppDeployStudio(startProject = false) {
  const target = new URL(APPDEPLOY_STUDIO_URL);
  if (startProject) target.searchParams.set('start', '1');
  window.location.assign(target.toString());
}

function Studio() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [methodology, setMethodology] = useState<MethodAgent[]>([]);
  const [view, setView] = useState<ViewName>('landing');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [decisionFeedback, setDecisionFeedback] = useState('');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [managerIdea, setManagerIdea] = useState('');
  const [managerStatus, setManagerStatus] = useState('اكتب فكرتك حتى لو كانت جملة واحدة، وأنا أرتب الباقي وأوزعه على الفريق.');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [managedDraft, setManagedDraft] = useState<Project | null>(null);
  const [autoRunAfterAnalysis, setAutoRunAfterAnalysis] = useState(false);
  const [form, setForm] = useState({
    name: '', brief: '', audience: '', goal: '',
    style: 'تقني فاخر، واضح، Mobile First', references: '', mode: 'balanced' as Project['mode']
  });
  const connectionRef = useRef<WsConnection | null>(null);
  const finalizeAttemptRef = useRef<Set<string>>(new Set());

  const projectTitle = selected?.name || 'المشروع';
  const statusLabel = useMemo(() => ({
    draft: 'مسودة', running: 'الوكلاء يعملون', review: 'جاهز للمراجعة', approved: 'معتمد',
    needs_revision: 'يحتاج تعديل', error: 'تعذر التنفيذ'
  }[selected?.status || 'draft'] || selected?.status || 'مشروع'), [selected?.status]);

  useEffect(() => {
    Promise.all([auth.getUser(), api.get('/api/methodology')]).then(([current, method]) => {
      const startRequested = new URLSearchParams(window.location.search).get('start') === '1';
      if (startRequested) window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
      setUser(current);
      setMethodology(method.data.agents || []);
      if (current) {
        setView(startRequested ? 'new' : 'dashboard');
        void loadProjects();
      } else if (startRequested) {
        setAuthError('وصلت للاستوديو الصحيح. سجّل دخولك وكمل مشروعك من هنا.');
      }
    }).catch(() => setAuthError('ما قدرنا نحمّل حالة حسابك الحين. جرّب مرة ثانية.')).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const connection = ws.connect();
    connection.onMessage((message: any) => {
      if (message?.type !== 'entity.update' || message?.payload?.entity_type !== 'project') return;
      const updated = message.payload.data as Project;
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      setSelected(current => current?.id === updated.id ? updated : current);
    });
    connectionRef.current = connection;
    return () => { connection.disconnect(); connectionRef.current = null; };
  }, [user]);

  useEffect(() => {
    if (!selected || selected.id === 'demo' || !connectionRef.current) return;
    const connection = connectionRef.current;
    let active = true;
    connection.ready.then(() => {
      if (active && connection.connectionId) {
        void api.post('/api/subscriptions', { entity_type: 'project', entity_id: selected.id, connection_id: connection.connectionId });
      }
    });
    return () => {
      active = false;
      if (connection.connectionId) {
        api.post('/api/subscriptions/remove', { entity_type: 'project', entity_id: selected.id, connection_id: connection.connectionId }).catch(() => undefined);
      }
    };
  }, [selected?.id]);

  async function loadProjects() {
    try {
      const response = await api.get('/api/projects');
      setProjects(response.data.projects || []);
    } catch {
      setErrorText('تعذر تحميل المشاريع.');
    }
  }

  async function signIn(destination: 'dashboard' | 'new' = 'dashboard') {
    if (!isAppDeployHost()) {
      openAppDeployStudio(destination === 'new');
      return;
    }
    setAuthError('');
    try {
      const result = await auth.signIn({ scope: 'openid email profile offline_access' });
      setUser(result.user);
      setView(destination);
      await loadProjects();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setAuthError(code === 'popup_blocked' ? 'اسمح بالنوافذ المنبثقة وجرّب مرة ثانية.' : code === 'popup_closed' ? 'قفلت نافذة تسجيل الدخول قبل ما تكمّل.' : 'ما قدرنا نسجّل دخولك الحين. جرّب مرة ثانية.');
    }
  }

  useEffect(() => {
    if (!selected || selected.id === 'demo' || selected.synthesis || selected.agentOutputs.length < 9 || busy) return;
    const runKey = `${selected.id}:${selected.currentRunId || 'saved'}`;
    if (finalizeAttemptRef.current.has(runKey)) return;
    const delay = selected.progress === 95 ? 16000 : 1200;
    const timer = window.setTimeout(() => {
      finalizeAttemptRef.current.add(runKey);
      setBusy(true);
      setErrorText('');
      completeFinalization(selected).catch(async () => {
        try {
          const response = await api.get(`/api/projects/${selected.id}`);
          const latest = response.data.project as Project;
          syncProject(latest);
          if (!latest.synthesis) setErrorText('تعذر التجميع التلقائي. اضغط «استكمال النتيجة» للمحاولة دون إعادة الوكلاء.');
        } catch {
          setErrorText('تعذر التجميع التلقائي. اضغط «استكمال النتيجة» للمحاولة دون إعادة الوكلاء.');
        }
      }).finally(() => setBusy(false));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [selected?.id, selected?.currentRunId, selected?.progress, selected?.agentOutputs.length, selected?.synthesis, busy]);

  async function signOut() {
    await auth.signOut();
    setUser(null); setProjects([]); setSelected(null); setView('landing');
  }

  function openDemo() { setSelected(demoProject); setView('project'); setMobileMenu(false); }
  function openProject(project: Project) { setSelected(project); setView('project'); setMobileMenu(false); }
  function startProject() { if (!user) { void signIn('new'); return; } setSelected(null); setView('new'); setMobileMenu(false); }

  async function startManagedProject() {
    if (!user) { void signIn('new'); return; }
    const idea = managerIdea.trim();
    if (idea.length < 8) { setErrorText('اكتب فكرتك بجملة قصيرة على الأقل.'); return; }
    setBusy(true); setErrorText(''); setManagerStatus('مدير نَسَق يفهم الفكرة ويجهز الموجز الاحترافي...');
    try {
      const response = await api.post('/api/projects/from-idea', { idea, mode: form.mode, acceptanceTarget: 85 });
      const project = response.data.project as Project;
      setForm({ name: project.name, brief: project.brief, audience: project.audience, goal: project.goal, style: project.style, references: project.references.join('\n'), mode: project.mode });
      setProjects(items => [project, ...items.filter(item => item.id !== project.id)]);
      if (autoRunAfterAnalysis) {
        setManagedDraft(null);
        setManagerStatus('اكتمل التحليل، وبدأ تشغيل الوكلاء تلقائيًا حسب اختيارك المتقدم.');
        await runManagedPipeline(project);
      } else {
        setManagedDraft(project);
        setShowAdvanced(true);
        setManagerStatus('اكتمل التحليل. راجع الحقول وعدّلها، ثم اعتمد الموجز لتشغيل الوكلاء التسعة.');
      }
    } catch {
      setErrorText('تعذر تحليل الفكرة الآن. جرّب مرة ثانية أو اكتب التفاصيل يدويًا.');
    } finally { setBusy(false); }
  }

  async function executeAgentWaves(project: Project) {
    const current = await runCwcWaves(project, { onStatus: setManagerStatus, onProject: syncProject, finalize: completeFinalization });
    syncProject(current);
    return current;
  }

  async function runManagedPipeline(project: Project) {
    setSelected(project); setView('project');
    setManagerStatus('تم اعتماد الموجز، وبدأ نَسَق تحويل فكرتك إلى خطة تصميم ثم موقع حي مخصص.');
    let completed = await executeAgentWaves(project);
    if (completed.agentOutputs.length === 9 && !completed.synthesis) completed = await completeFinalization(completed);
    if (completed.synthesis && !completed.previewPath) {
      setManagerStatus('اكتملت النتيجة، ومدير نَسَق يبني الآن معاينة الموقع ورابط المشاركة...');
      try {
        await new Promise(resolve => window.setTimeout(resolve, 4000));
        const previewResponse = await api.post(`/api/projects/${completed.id}/site-preview`, {});
        completed = previewResponse.data.project as Project;
        setManagerStatus('اكتمل المشروع: الخطة والمعاينة الحية المطابقة للفكرة ورابط المشاركة جاهزة.');
      } catch {
        setManagerStatus('اكتملت نتيجة الوكلاء. تعذر إنشاء المعاينة تلقائيًا ويمكن بناؤها من داخل المشروع.');
      }
    }
    syncProject(completed);
  }

  async function confirmManagedProject(event: FormEvent) {
    event.preventDefault();
    if (!managedDraft) return;
    if (!form.name.trim() || !form.brief.trim()) { setErrorText('راجع اسم المشروع والموجز قبل تشغيل الفريق.'); return; }
    setBusy(true); setErrorText('');
    try {
      const response = await (api as any).put(`/api/projects/${managedDraft.id}/brief`, {
        ...form,
        references: form.references.split('\n').map(value => value.trim()).filter(Boolean)
      });
      const project = response.data.project as Project;
      setManagedDraft(null);
      syncProject(project);
      await runManagedPipeline(project);
    } catch (err) {
      setErrorText(apiErrorMessage(err, 'تعذر اعتماد الموجز أو تشغيل الفريق الآن. التعديلات محفوظة في الشاشة ويمكن المحاولة مجددًا.'));
    } finally { setBusy(false); }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!user) { setAuthError('سجّل دخولك أول عشان نحفظ مشروعك ونشغّل الوكلاء الحقيقيين.'); return; }
    if (!form.name.trim() || !form.brief.trim()) { setErrorText('اكتب اسم المشروع وفكرته الأساسية عشان نبدأ.'); return; }
    setBusy(true); setErrorText('');
    try {
      const response = await api.post('/api/projects', {
        ...form,
        references: form.references.split('\n').map(value => value.trim()).filter(Boolean)
      });
      const project = response.data.project as Project;
      setProjects(items => [project, ...items]); setSelected(project); setView('project');
    } catch {
      setErrorText('تعذر إنشاء المشروع.');
    } finally {
      setBusy(false);
    }
  }

  function syncProject(project: Project) {
    setSelected(project);
    setProjects(items => items.map(item => item.id === project.id ? project : item));
  }

  async function completeFinalization(project: Project) {
    const response = await api.post(`/api/projects/${project.id}/finalize`, {});
    const completed = response.data.project as Project;
    syncProject(completed);
    return completed;
  }

  async function runAgents() {
    if (!selected || selected.id === 'demo') return;
    setBusy(true); setErrorText('');
    try {
      const response = await api.post(`/api/projects/${selected.id}/run`, {});
      const project = response.data.project as Project;
      syncProject(project);
      if (project.agentOutputs.length === 9 && !project.synthesis) await completeFinalization(project);
    } catch {
      try {
        const response = await api.get(`/api/projects/${selected.id}`);
        const latest = response.data.project as Project;
        syncProject(latest);
        if (latest.synthesis) return;
        if (latest.agentOutputs.length === 9) {
          if (latest.progress !== 95) await completeFinalization(latest);
          return;
        }
      } catch {}
      setErrorText('انقطع الاتصال قبل اكتمال الجولة. ما تم حفظه لم يضع؛ افتح المشروع واضغط استكمال التشغيل.');
    } finally {
      setBusy(false);
    }
  }

  async function finalizeResult() {
    if (!selected || selected.id === 'demo') return;
    setBusy(true); setErrorText('');
    try {
      await completeFinalization(selected);
    } catch {
      setErrorText('تعذر تجميع النتيجة الآن. المحاولة التالية لن تعيد تشغيل الوكلاء.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'approve' | 'revise') {
    if (!selected || selected.id === 'demo') return;
    setBusy(true); setErrorText('');
    try {
      const response = await api.post(`/api/projects/${selected.id}/decision`, { decision, feedback: decisionFeedback });
      setSelected(response.data.project); setDecisionFeedback('');
    } catch {
      setErrorText('تعذر حفظ القرار.');
    } finally {
      setBusy(false);
    }
  }

  async function generateConcept() {
    if (!selected || selected.id === 'demo') return;
    setBusy(true); setErrorText('');
    try {
      const response = await api.post(`/api/projects/${selected.id}/concept-image`, {});
      setSelected(response.data.project);
    } catch {
      setErrorText('تعذر توليد الاتجاه البصري الآن.');
    } finally {
      setBusy(false);
    }
  }

  async function buildSitePreview() {
    if (!selected || selected.id === 'demo') return;
    setBusy(true); setErrorText('');
    try {
      const response = await api.post(`/api/projects/${selected.id}/site-preview`, {});
      setSelected(response.data.project);
      setProjects(items => items.map(item => item.id === selected.id ? response.data.project : item));
    } catch {
      setErrorText('تعذر بناء معاينة الموقع الآن. أعد المحاولة بعد قليل.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    if (!selected || selected.id === 'demo' || !window.confirm('حذف المشروع نهائيًا؟')) return;
    await api.delete(`/api/projects/${selected.id}`);
    setProjects(items => items.filter(item => item.id !== selected.id));
    setSelected(null); setView('dashboard');
  }

  function exportReport() {
    if (!selected?.synthesis) return;
    const synthesis = selected.synthesis;
    const text = `# ${selected.name}\n\n## الملخص\n${synthesis.executiveSummary || ''}\n\n## التموضع\n${synthesis.positioning || ''}\n\n## الاتجاه البصري\n${synthesis.designDirection || ''}\n\n## رحلة المستخدم\n${(synthesis.primaryJourney || []).map((item: string) => `- ${item}`).join('\n')}\n\n## الصفحات\n${(synthesis.pages || []).map((page: any) => `### ${page.name}\n${page.purpose}`).join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${selected.name}-design-report.md`; anchor.click(); URL.revokeObjectURL(url);
  }

  if (authLoading) return <LoadingScreen />;

  return <main className="min-h-screen bg-[#05070B] text-[#F7FBFF] selection:bg-[#73E7FF] selection:text-[#05070B]" dir="rtl">
    <AmbientBackground />
    {view === 'landing' ? (
      <Landing user={user} authError={authError} onSignIn={() => signIn('dashboard')} onStart={startProject} onDashboard={() => setView('dashboard')} onDemo={openDemo} onSources={() => setView('sources')} />
    ) : (
      <div className="relative z-10 flex min-h-screen">
        <Sidebar user={user} view={view} projects={projects} mobileOpen={mobileMenu} onClose={() => setMobileMenu(false)} onNavigate={setView} onProject={openProject} onDemo={openDemo} onSignIn={signIn} onSignOut={signOut} />
        <div className="min-w-0 flex-1 lg:pr-72">
          <AppHeader view={view} title={projectTitle} user={user} onMenu={() => setMobileMenu(true)} />
          <div className="p-4 sm:p-7 lg:p-9">
            {errorText && <ErrorBanner text={errorText} onClose={() => setErrorText('')} />}
            {view === 'dashboard' && <Dashboard projects={projects} user={user} onNew={() => user ? setView('new') : setAuthError('سجّل الدخول أولًا.')} onProject={openProject} onDemo={openDemo} onSignIn={signIn} authError={authError} />}
            {view === 'new' && <NewProject idea={managerIdea} setIdea={setManagerIdea} managerStatus={managerStatus} form={form} setForm={setForm} busy={busy} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} managedDraft={managedDraft} autoRunAfterAnalysis={autoRunAfterAnalysis} setAutoRunAfterAnalysis={setAutoRunAfterAnalysis} onManagedStart={startManagedProject} onConfirm={confirmManagedProject} onSubmit={createProject} />}
            {view === 'project' && selected && <ProjectView project={selected} statusLabel={statusLabel} busy={busy} expandedAgent={expandedAgent} setExpandedAgent={setExpandedAgent} feedback={decisionFeedback} setFeedback={setDecisionFeedback} onRun={runAgents} onFinalize={finalizeResult} onApprove={() => decide('approve')} onRevise={() => decide('revise')} onConcept={generateConcept} onBuildPreview={buildSitePreview} onExport={exportReport} onDelete={deleteProject} />}
            {view === 'sources' && <Sources agents={methodology.length ? methodology : agentBlueprints.map(item => ({ id: item[0], name: item[1], title: item[2], workshop: item[3], mission: item[4] }))} />}
          </div>
        </div>
      </div>
    )}
  </main>;
}

function AmbientBackground() {
  return <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#73E7FF]/[.07] blur-[120px]" />
    <div className="absolute -bottom-56 -left-36 h-[620px] w-[620px] rounded-full bg-[#9D8CFF]/[.07] blur-[140px]" />
    <div className="noise-grid absolute inset-0 opacity-40" />
  </div>;
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#05070B] text-[#73E7FF]" dir="rtl">
    <div className="text-center"><BrandMark large /><p className="mt-5 text-sm text-white/40">جاري تجهيز الاستوديو...</p></div>
  </div>;
}

function BrandMark({ large = false }: { large?: boolean }) {
  return <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#73E7FF] to-[#9D8CFF] text-[#05070B] shadow-[0_0_36px_rgba(115,231,255,.16)] ${large ? 'h-16 w-16' : 'h-10 w-10'}`}>
    <span className={large ? 'text-3xl font-extrabold' : 'text-xl font-extrabold'}>ن</span>
  </span>;
}

function AppHeader({ view, title, user, onMenu }: { view: ViewName; title: string; user: AuthUser | null; onMenu: () => void }) {
  const label = view === 'project' ? title : view === 'new' ? 'مشروع جديد' : view === 'sources' ? 'مصادر السورس' : 'لوحة المشاريع';
  return <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#1B2736] bg-[#05070B]/85 px-4 backdrop-blur-2xl sm:px-7">
    <button className="rounded-xl border border-[#1B2736] bg-[#0A0E15] p-2 lg:hidden" onClick={onMenu} aria-label="فتح القائمة"><Menu className="h-5 w-5" /></button>
    <div><span className="text-[10px] font-semibold tracking-[.16em] text-[#73E7FF]/70">NASQ AI</span><h1 className="mt-0.5 text-sm font-bold sm:text-base">{label}</h1></div>
    <div className="flex items-center gap-3"><span className="hidden text-xs text-white/40 sm:block">{user?.name || 'وضع العرض'}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#73E7FF] to-[#9D8CFF] text-xs font-bold text-[#05070B]">{user?.name?.slice(0, 1) || 'ن'}</span></div>
  </header>;
}

function ErrorBanner({ text, onClose }: { text: string; onClose: () => void }) {
  return <div className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-[#FF7A91]/25 bg-[#FF7A91]/[.07] p-4 text-sm text-[#FFD5DD]">
    <span>{text}</span><button onClick={onClose} className="rounded-lg p-1 hover:bg-white/5"><X className="h-4 w-4" /></button>
  </div>;
}

function Landing({ user, authError, onSignIn, onStart, onDashboard, onDemo, onSources }: { user: AuthUser | null; authError: string; onSignIn: () => void; onStart: () => void; onDashboard: () => void; onDemo: () => void; onSources: () => void }) {
  const liveRows = [
    ['باحث الأدلة', 'يحلل السوق والمراجع', 'مكتمل', 'green'],
    ['معماري التجربة', 'يبني رحلة المستخدم', 'يعمل الآن', 'cyan'],
    ['مخرج الواجهة', 'يجهز النظام البصري', 'التالي', 'violet'],
    ['مراجع الجودة', 'يفحص الجوال والتباين', 'بانتظار', 'amber']
  ] as const;
  return <div className="relative z-10 overflow-hidden">
    <header className="border-b border-[#1B2736] bg-[#05070B]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <button onClick={onDashboard} className="flex items-center gap-3 text-right"><BrandMark /><span><strong className="block text-sm">نَسَق</strong><small className="text-[9px] font-semibold tracking-[.18em] text-white/30">NASQ AI</small></span></button>
        <nav className="hidden items-center gap-7 text-sm text-white/45 md:flex"><button onClick={onSources} className="hover:text-white">المنهج</button><button onClick={onDemo} className="hover:text-white">مثال حي</button><button onClick={onDashboard} className="hover:text-white">لوحة المشاريع</button></nav>
        <button onClick={user ? onDashboard : onSignIn} className="inline-flex items-center gap-2 rounded-xl bg-[#73E7FF] px-5 py-2.5 text-sm font-bold text-[#05070B] transition hover:-translate-y-0.5 hover:bg-white">{user ? 'فتح الاستوديو' : 'تسجيل الدخول'}<ArrowUpLeft className="h-4 w-4" /></button>
      </div>
    </header>

    <section className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:py-24">
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#73E7FF]/20 bg-[#73E7FF]/[.06] px-3 py-1.5 text-xs font-semibold text-[#9AF0FF]"><Sparkles className="h-3.5 w-3.5" />9 وكلاء • موقع كامل • رابط مباشر</div>
        <h1 className="mt-7 max-w-3xl text-5xl font-extrabold leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl">خل فكرتك تصير موقع جاهز<br /><span className="bg-gradient-to-l from-[#73E7FF] to-[#B2A7FF] bg-clip-text text-transparent">خلال دقائق.</span></h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-[#A8B4C3]">اكتب فكرتك وبس. فريق من 9 وكلاء يحلل المشروع ويرتب تجربة المستخدم ويجهز الواجهة والمعاينة قدامك خطوة بخطوة، وبالنهاية تستلم رابط تقدر تفتحه وتشاركه.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <button onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#73E7FF] px-7 py-3.5 font-bold text-[#05070B] transition hover:-translate-y-1 hover:bg-white">ابدأ مشروعك الحين<Play className="h-4 w-4 fill-current" /></button>
          <button onClick={onDemo} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B3B4E] bg-[#0A0E15] px-7 py-3.5 text-[#D8E3EE] transition hover:border-[#73E7FF]/40 hover:text-white">شوف مثال شغال<ChevronLeft className="h-4 w-4" /></button>
        </div>
        {authError && <p className="mt-4 text-sm text-[#FF9CAF]">{authError}</p>}
        <p className="mt-6 text-xs text-white/30">ما تحتاج خبرة تصميم • عربي من الأساس • القرار النهائي دايم بيدك</p>
      </div>

      <div className="relative mx-auto w-full max-w-[570px]">
        <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-[#73E7FF]/10 to-[#9D8CFF]/10 blur-3xl" />
        <div className="relative overflow-hidden rounded-[2rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#080B11] p-4 shadow-[0_35px_100px_rgba(0,0,0,.5)] sm:p-6">
          <div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-[#73E7FF]/10 px-3 py-1 text-[10px] font-bold tracking-[.16em] text-[#73E7FF]">LIVE</span><div className="text-left"><strong className="block text-sm">مجلس التصميم يعمل الآن</strong><span className="text-[10px] text-white/30">3 موجات • 9 وكلاء مستقلين</span></div></div>
          <div className="space-y-2.5">{liveRows.map(([name, copy, status, tone], index) => <LiveRow key={name} name={name} copy={copy} status={status} tone={tone} active={index === 1} />)}</div>
          <div className="mt-5"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-[#73E7FF]">42%</span><span className="text-white/35">الموجة الثانية</span></div><div className="h-2 overflow-hidden rounded-full bg-[#1B2736]"><div className="agent-scan h-full w-[42%] rounded-full bg-gradient-to-l from-[#73E7FF] to-[#9D8CFF]" /></div></div>
        </div>
      </div>
    </section>

    <section className="border-y border-[#1B2736] bg-[#070A0F] px-5 py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-3">{[
        ['01', 'يفهم وش تبي', 'يرتب فكرتك ويحولها لأهداف وخطوات واضحة قبل يبدأ الشغل.'],
        ['02', 'يشتغل قدامك', 'تشوف كل وكيل وش يسوي ووين وصل بدون انتظار مبهم.'],
        ['03', 'يسلمك رابط جاهز', 'يحوّل النتيجة لموقع متجاوب تفتحه على الجوال والكمبيوتر وتشاركه.']
      ].map(([num, title, copy]) => <article key={num} className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-6 transition hover:-translate-y-1 hover:border-[#73E7FF]/25"><span className="text-xs font-bold text-[#73E7FF]">{num}</span><h2 className="mt-8 text-xl font-bold">{title}</h2><p className="mt-3 leading-7 text-[#768496]">{copy}</p></article>)}</div>
    </section>
  </div>;
}

function LiveRow({ name, copy, status, tone, active }: { name: string; copy: string; status: string; tone: 'green' | 'cyan' | 'violet' | 'amber'; active: boolean }) {
  const palette = { green: ['#4AE1A8', 'bg-[#4AE1A8]/10'], cyan: ['#73E7FF', 'bg-[#73E7FF]/10'], violet: ['#9D8CFF', 'bg-[#9D8CFF]/10'], amber: ['#FFD166', 'bg-[#FFD166]/10'] } as const;
  const [color, background] = palette[tone];
  return <div className={`flex items-center gap-3 rounded-2xl border px-3 py-3.5 ${active ? 'border-[#73E7FF]/35 bg-[#73E7FF]/[.055]' : 'border-[#1B2736] bg-[#0A0E15]'}`}>
    <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl ${background}`}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{active && <span className="absolute inset-0 animate-ping rounded-xl border border-[#73E7FF]/30" />}</span>
    <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{name}</strong><span className="block truncate text-[10px] text-white/30">{copy}</span></div>
    <span className="rounded-full px-2.5 py-1 text-[9px] font-semibold" style={{ color, backgroundColor: `${color}14` }}>{status}</span>
  </div>;
}

function Sidebar({ user, view, projects, mobileOpen, onClose, onNavigate, onProject, onDemo, onSignIn, onSignOut }: { user: AuthUser | null; view: ViewName; projects: Project[]; mobileOpen: boolean; onClose: () => void; onNavigate: (view: ViewName) => void; onProject: (project: Project) => void; onDemo: () => void; onSignIn: () => void; onSignOut: () => void }) {
  const nav = [
    { id: 'dashboard' as ViewName, label: 'لوحة المشاريع', icon: LayoutDashboard },
    { id: 'new' as ViewName, label: 'مشروع جديد', icon: Plus },
    { id: 'sources' as ViewName, label: 'مصادر السورس', icon: BookOpen }
  ];
  return <><div onClick={onClose} className={`fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden ${mobileOpen ? 'block' : 'hidden'}`} />
    <aside className={`fixed right-0 top-0 z-50 flex h-screen w-72 flex-col border-l border-[#1B2736] bg-[#070A0F] p-5 transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between"><button onClick={() => onNavigate('landing')} className="flex items-center gap-3"><BrandMark /><span className="text-right"><strong className="block text-sm">نَسَق</strong><small className="text-[9px] tracking-[.14em] text-white/25">NASQ AI</small></span></button><button onClick={onClose} className="rounded-lg p-2 lg:hidden"><X className="h-5 w-5" /></button></div>
      <nav className="space-y-2">{nav.map(item => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} onClick={() => { if (item.id === 'new' && !user) { onSignIn(); return; } onNavigate(item.id); onClose(); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active ? 'bg-[#73E7FF]/10 text-[#BDF5FF]' : 'text-white/48 hover:bg-white/[.035] hover:text-white'}`}><Icon className={`h-4 w-4 ${active ? 'text-[#73E7FF]' : ''}`} />{item.label}</button>; })}
        <button onClick={onDemo} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/48 hover:bg-white/[.035] hover:text-white"><Sparkles className="h-4 w-4 text-[#9D8CFF]" />المشروع التجريبي</button>
      </nav>
      <div className="mt-8 min-h-0 flex-1"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-white/25">مشاريعك</span><span className="text-[10px] text-white/20">{projects.length}</span></div><div className="custom-scroll max-h-[42vh] space-y-1 overflow-y-auto">{projects.map(project => <button key={project.id} onClick={() => onProject(project)} className="w-full rounded-xl px-3 py-2.5 text-right transition hover:bg-white/[.035]"><span className="block truncate text-sm text-white/62">{project.name}</span><span className="text-[10px] text-white/25">{project.status === 'approved' ? 'معتمد' : project.status === 'running' ? `${project.progress}%` : 'آخر تحديث'}</span></button>)}</div></div>
      <div className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-3">{user ? <button onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-white/45 hover:text-white"><LogOut className="h-4 w-4" />تسجيل الخروج</button> : <button onClick={onSignIn} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#73E7FF] px-3 py-3 text-sm font-bold text-[#05070B]"><LogIn className="h-4 w-4" />تسجيل الدخول</button>}</div>
    </aside>
  </>;
}

function Dashboard({ projects, user, onNew, onProject, onDemo, onSignIn, authError }: { projects: Project[]; user: AuthUser | null; onNew: () => void; onProject: (project: Project) => void; onDemo: () => void; onSignIn: () => void; authError: string }) {
  const approved = projects.filter(project => project.status === 'approved').length;
  const running = projects.filter(project => project.status === 'running').length;
  const review = projects.filter(project => project.status === 'review' || project.status === 'needs_revision').length;
  if (!user) return <ProtectedDashboard authError={authError} onSignIn={onSignIn} onDemo={onDemo} />;
  return <div className="mx-auto max-w-7xl">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="text-xs font-bold tracking-[.2em] text-[#73E7FF]/70">WORKSPACE</span><h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">هلا، {user.name?.split(' ')[0] || 'محمد'}.</h2><p className="mt-3 text-[#768496]">هنا تشوف مشاريعك اللي شغالة واللي تنتظر قرارك.</p></div><button onClick={onNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#73E7FF] px-6 py-3 font-bold text-[#05070B] transition hover:-translate-y-0.5 hover:bg-white"><Plus className="h-4 w-4" />مشروع جديد</button></div>
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['إجمالي المشاريع', projects.length, Layers3, '#73E7FF'], ['تعمل الآن', running, RefreshCw, '#9D8CFF'], ['جاهزة للعميل', approved, Check, '#4AE1A8'], ['تحتاج قرارك', review, UserCheck, '#FFD166']
    ].map(([label, value, Icon, color]) => { const MetricIcon = Icon as typeof Layers3; return <div key={label as string} className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-5"><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ color: color as string, backgroundColor: `${color}14` }}><MetricIcon className="h-5 w-5" /></span><strong className="mt-6 block text-3xl">{value as number}</strong><span className="text-xs text-[#768496]">{label as string}</span></div>; })}</div>
    <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_320px]">
      <section><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">المشاريع الأخيرة</h3><button onClick={onDemo} className="text-xs font-semibold text-[#73E7FF]">فتح مثال حي</button></div>{projects.length === 0 ? <EmptyProjects onNew={onNew} /> : <div className="grid gap-3 md:grid-cols-2">{projects.map(project => <ProjectCard key={project.id} project={project} onOpen={() => onProject(project)} />)}</div>}</section>
      <aside className="space-y-4"><div className="overflow-hidden rounded-[1.5rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#0A0E15] p-5"><span className="rounded-full bg-[#73E7FF]/10 px-3 py-1 text-[9px] font-bold tracking-[.16em] text-[#73E7FF]">QUICK START</span><h3 className="mt-5 text-xl font-bold">ابدأ من فكرة فقط.</h3><p className="mt-2 text-sm leading-6 text-[#768496]">أنشئ موجزًا، ثم دع الفريق يحوله إلى قرار ومعاينة.</p><button onClick={onNew} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#73E7FF] px-4 py-3 text-sm font-bold text-[#05070B]"><Zap className="h-4 w-4" />بدء مشروع</button></div><div className="rounded-[1.5rem] border border-[#1B2736] bg-[#0A0E15] p-5"><h3 className="font-bold">كيف يعمل؟</h3><div className="mt-4 space-y-3">{['اكتب الموجز', 'تابع الوكلاء', 'راجع القرار', 'شارك المعاينة'].map((item, index) => <div key={item} className="flex items-center gap-3 text-sm text-white/50"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#73E7FF]/10 text-[10px] font-bold text-[#73E7FF]">{index + 1}</span>{item}</div>)}</div></div></aside>
    </div>
  </div>;
}

function ProtectedDashboard({ authError, onSignIn, onDemo }: { authError: string; onSignIn: () => void; onDemo: () => void }) {
  return <div className="mx-auto max-w-3xl py-16 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#73E7FF]/20 bg-[#73E7FF]/10"><LogIn className="h-7 w-7 text-[#73E7FF]" /></span><h2 className="mt-6 text-3xl font-extrabold">سجّل دخولك وكمل من هنا</h2><p className="mx-auto mt-4 max-w-lg text-[#768496]">عشان نشغّل الوكلاء الحقيقيين ونحفظ مشاريعك وقراراتك، سجّل دخولك. وتقدر تشوف المشروع التجريبي بدون حساب.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button onClick={onSignIn} className="rounded-xl bg-[#73E7FF] px-6 py-3 font-bold text-[#05070B]">تسجيل الدخول</button><button onClick={onDemo} className="rounded-xl border border-[#2B3B4E] bg-[#0A0E15] px-6 py-3 text-white/65">عرض التجربة</button></div>{authError && <p className="mt-4 text-sm text-[#FF9CAF]">{authError}</p>}</div>;
}

function EmptyProjects({ onNew }: { onNew: () => void }) {
  return <div className="rounded-[2rem] border border-dashed border-[#2B3B4E] bg-[#0A0E15]/60 p-12 text-center"><Bot className="mx-auto h-10 w-10 text-[#73E7FF]/40" /><h3 className="mt-5 font-bold">ابدأ أول مشروع</h3><p className="mt-2 text-sm text-[#768496]">سيظهر هنا تقدم الوكلاء والنتائج وروابط المعاينة.</p><button onClick={onNew} className="mt-5 rounded-xl bg-[#73E7FF] px-5 py-2.5 text-sm font-bold text-[#05070B]">إنشاء مشروع</button></div>;
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const tone = project.status === 'approved' ? '#4AE1A8' : project.status === 'running' ? '#73E7FF' : project.status === 'review' ? '#FFD166' : '#768496';
  const label = project.status === 'approved' ? 'معتمد' : project.status === 'running' ? `${project.progress}%` : project.status === 'review' ? 'ينتظر قرارك' : 'مشروع';
  return <button onClick={onOpen} className="group rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-5 text-right transition hover:-translate-y-1 hover:border-[#73E7FF]/30"><div className="flex items-center justify-between"><span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ color: tone, backgroundColor: `${tone}14` }}>{label}</span><ArrowLeft className="h-4 w-4 text-white/20 transition group-hover:-translate-x-1 group-hover:text-[#73E7FF]" /></div><h4 className="mt-7 text-lg font-bold">{project.name}</h4><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#768496]">{project.brief}</p><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#1B2736]"><div className="h-full rounded-full" style={{ width: `${project.progress}%`, backgroundColor: tone }} /></div><div className="mt-4 flex items-center gap-2 text-[10px] text-white/25"><Clock3 className="h-3 w-3" />{new Date(project.updatedAt).toLocaleDateString('ar-SA')}</div></button>;
}

function ManagerComposer({ idea, setIdea, status, busy, showAdvanced, setShowAdvanced, autoRunAfterAnalysis, setAutoRunAfterAnalysis, onStart }: { idea: string; setIdea: (value: string) => void; status: string; busy: boolean; showAdvanced: boolean; setShowAdvanced: (value: boolean) => void; autoRunAfterAnalysis: boolean; setAutoRunAfterAnalysis: (value: boolean) => void; onStart: () => void }) {
  const examples = ['أبي موقع لحضانة أطفال يساعد الأهالي يعرفون البرامج ويحجزون زيارة', 'منصة تعرض خدماتي في تصميم المواقع وتجيب لي عملاء', 'متجر سعودي لمنتجات العناية بهوية فاخرة وسهلة على الجوال'];
  return <section className="overflow-hidden rounded-[2rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#080B11] shadow-2xl"><div className="flex items-center gap-4 border-b border-[#1B2736] p-5 sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#73E7FF] to-[#9D8CFF] text-[#05070B]"><MessageSquareText className="h-6 w-6" /></span><div><span className="text-[10px] font-bold tracking-[.16em] text-[#73E7FF]/70">مدير نَسَق</span><h2 className="mt-1 text-xl font-bold">قل لي الفكرة ببساطة، والباقي علينا.</h2></div></div><div className="p-5 sm:p-7"><div className="max-w-3xl rounded-2xl rounded-tr-md border border-[#1B2736] bg-[#070A0F] p-4 text-sm leading-7 text-[#C4D0DC]">{status}</div><textarea value={idea} onChange={event => setIdea(event.target.value)} placeholder="مثال: أبي موقع لمغسلة سيارات يوضح الباقات ويخلي العميل يحجز بسهولة..." className="mt-5 min-h-36 w-full rounded-2xl border border-[#2B3B4E] bg-[#05070B] p-5 text-base leading-8 outline-none placeholder:text-white/20 focus:border-[#73E7FF]/55" /><div className="mt-3 flex flex-wrap gap-2">{examples.map(example => <button type="button" key={example} onClick={() => setIdea(example)} className="rounded-full border border-[#1B2736] bg-[#070A0F] px-3 py-2 text-[10px] text-white/40 hover:border-[#73E7FF]/30 hover:text-white/70">{example}</button>)}</div><div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="rounded-xl border border-[#73E7FF]/15 bg-[#73E7FF]/[.045] p-4 text-xs leading-6 text-[#9CC3CF]">المدير يستخرج اسم المشروع والجمهور والهدف والطابع البصري والموجز والروابط الموجودة في كلامك، ثم يعرض النتيجة عليك لتعديلها قبل توزيع المهام على 9 وكلاء وتحسين درجة القبول حتى 85/100 قدر الإمكان.</div><button type="button" onClick={onStart} disabled={busy} className="rounded-xl bg-[#73E7FF] px-7 py-4 font-bold text-[#05070B] disabled:opacity-50">{busy ? 'جاري تحليل الفكرة...' : 'حلّل الفكرة'}</button></div>{showAdvanced && <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#1B2736] bg-[#070A0F] p-4"><input type="checkbox" checked={autoRunAfterAnalysis} onChange={event => setAutoRunAfterAnalysis(event.target.checked)} className="mt-1 h-4 w-4 accent-[#73E7FF]" /><span><strong className="block text-sm text-[#D8E3EE]">تشغيل الفريق تلقائيًا بعد التحليل</strong><small className="mt-1 block leading-5 text-white/35">عند إيقافه، يعرض مدير نَسَق الموجز لتراجعه وتعدله قبل بدء الوكلاء. هذا هو الوضع الافتراضي.</small></span></label>}<button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="mt-5 inline-flex items-center gap-2 text-xs text-white/40 hover:text-white"><ChevronDown className={`h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />{showAdvanced ? 'إخفاء التفاصيل المتقدمة' : 'أبي أكتب التفاصيل بنفسي'}</button></div></section>;
}

function NewProject({ idea, setIdea, managerStatus, form, setForm, busy, showAdvanced, setShowAdvanced, managedDraft, autoRunAfterAnalysis, setAutoRunAfterAnalysis, onManagedStart, onConfirm, onSubmit }: { idea: string; setIdea: (value: string) => void; managerStatus: string; form: any; setForm: (value: any) => void; busy: boolean; showAdvanced: boolean; setShowAdvanced: (value: boolean) => void; managedDraft: Project | null; autoRunAfterAnalysis: boolean; setAutoRunAfterAnalysis: (value: boolean) => void; onManagedStart: () => void; onConfirm: (event: FormEvent) => void; onSubmit: (event: FormEvent) => void }) {
  const field = (key: string, label: string, placeholder: string) => <label className="block"><span className="mb-2 block text-sm font-semibold text-[#D8E3EE]">{label}</span><input value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} className="w-full rounded-xl border border-[#1B2736] bg-[#070A0F] px-4 py-3.5 text-white outline-none placeholder:text-white/20 focus:border-[#73E7FF]/50 focus:ring-4 focus:ring-[#73E7FF]/[.06]" /></label>;
  return <div className="mx-auto max-w-5xl"><ManagerComposer idea={idea} setIdea={setIdea} status={managerStatus} busy={busy} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} autoRunAfterAnalysis={autoRunAfterAnalysis} setAutoRunAfterAnalysis={setAutoRunAfterAnalysis} onStart={onManagedStart} /><form onSubmit={managedDraft ? onConfirm : onSubmit} className={`${showAdvanced || managedDraft ? 'block' : 'hidden'} mt-6`}>
    <div className="mb-8">{managedDraft && <div className="mb-5 rounded-2xl border border-[#FFD166]/25 bg-[#FFD166]/[.055] p-4 text-sm leading-7 text-[#FFE6A3]"><strong className="block">نتيجة تحليل مدير نَسَق جاهزة للمراجعة</strong><span className="text-white/45">عدّل أي حقل تحتاجه. لن يبدأ أي وكيل حتى تضغط اعتماد الموجز وتشغيل الفريق.</span></div>}<div className="flex items-center gap-2 text-xs font-bold tracking-[.18em] text-[#73E7FF]/70"><Sparkles className="h-4 w-4" />{managedDraft ? 'MANAGER REVIEW' : 'NEW PROJECT'}</div><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">{managedDraft ? 'راجع التحليل قبل بدء التنفيذ.' : 'عط الفريق فكرة واضحة عن مشروعك.'}</h2><p className="mt-3 max-w-2xl text-[#768496]">{managedDraft ? 'تأكد من الاسم والجمهور والهدف والطابع والموجز والروابط، ثم اعتمد النسخة النهائية.' : 'اكتب الأساسيات، والباقي علينا: بحث وتجربة مستخدم وواجهة وفحص جودة ثم معاينة موقع جاهزة.'}</p></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="rounded-[2rem] border border-[#1B2736] bg-[#0A0E15] p-5 sm:p-8"><div className="grid gap-5 md:grid-cols-2">{field('name', 'اسم المشروع', 'مثال: منصة شحن للمتاجر')}{field('audience', 'الجمهور المستهدف', 'مثال: أصحاب المتاجر في السعودية')}{field('goal', 'الهدف التجاري', 'مثال: زيادة طلبات الشحن')}{field('style', 'الطابع البصري', 'مثال: تقني، سريع، موثوق')}</div><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold text-[#D8E3EE]">موجز المشروع</span><textarea value={form.brief} onChange={event => setForm({ ...form, brief: event.target.value })} placeholder="صف المنتج، المشكلة، ما الذي تريد أن يفعله الزائر، وأي قيود أو محتوى مهم..." className="min-h-48 w-full resize-none rounded-xl border border-[#1B2736] bg-[#070A0F] p-4 leading-7 outline-none placeholder:text-white/20 focus:border-[#73E7FF]/50 focus:ring-4 focus:ring-[#73E7FF]/[.06]" /></label><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold text-[#D8E3EE]">روابط مرجعية <small className="font-normal text-white/25">رابط في كل سطر</small></span><textarea value={form.references} onChange={event => setForm({ ...form, references: event.target.value })} placeholder="https://example.com" className="min-h-28 w-full resize-none rounded-xl border border-[#1B2736] bg-[#070A0F] p-4 outline-none placeholder:text-white/20 focus:border-[#73E7FF]/50" /></label></div>
      <aside className="space-y-4"><div className="rounded-[1.5rem] border border-[#1B2736] bg-[#0A0E15] p-5"><h3 className="font-bold">عمق الجولة</h3><p className="mt-2 text-xs leading-5 text-[#768496]">يمكن تغييره في كل جولة جديدة.</p><div className="mt-4 space-y-2">{[
        ['economy', 'اقتصادي', 'أسرع للطلبات البسيطة'], ['balanced', 'متوازن', 'الأنسب لمعظم المشاريع'], ['deep', 'عميق', 'للقرارات المعقدة']
      ].map(([id, title, copy]) => <button type="button" key={id} onClick={() => setForm({ ...form, mode: id })} className={`w-full rounded-xl border p-3 text-right transition ${form.mode === id ? 'border-[#73E7FF]/40 bg-[#73E7FF]/[.07]' : 'border-[#1B2736] bg-[#070A0F]'}`}><strong className="text-sm">{title}</strong><span className="mt-1 block text-[10px] text-[#768496]">{copy}</span></button>)}</div></div><div className="rounded-[1.5rem] border border-[#9D8CFF]/20 bg-[#9D8CFF]/[.055] p-5"><h3 className="text-sm font-bold text-[#C9C2FF]">ما الذي ستحصل عليه؟</h3><ul className="mt-4 space-y-3 text-xs text-white/45">{['9 مخرجات مستقلة', 'قرار تصميم موحّد', 'درجة جودة مفسرة', 'رابط معاينة عام'].map(item => <li key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#9D8CFF]" />{item}</li>)}</ul></div><button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#73E7FF] px-6 py-3.5 font-bold text-[#05070B] disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}{managedDraft ? 'اعتماد الموجز وتشغيل الفريق' : 'إنشاء المشروع'}</button></aside>
    </div>
  </form></div>;
}

function ProjectView({ project, statusLabel, busy, expandedAgent, setExpandedAgent, feedback, setFeedback, onRun, onFinalize, onApprove, onRevise, onConcept, onBuildPreview, onExport, onDelete }: { project: Project; statusLabel: string; busy: boolean; expandedAgent: string | null; setExpandedAgent: (id: string | null) => void; feedback: string; setFeedback: (value: string) => void; onRun: () => void; onFinalize: () => void; onApprove: () => void; onRevise: () => void; onConcept: () => void; onBuildPreview: () => void; onExport: () => void; onDelete: () => void }) {
  const [clock, setClock] = useState(Date.now());
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  useEffect(() => {
    if (project.progress !== 95) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [project.progress, project.updatedAt]);

  const finalizingElapsed = Math.max(0, clock - project.updatedAt);
  const finalizingStalled = project.progress === 95 && finalizingElapsed >= 15000;
  const finalizingSeconds = Math.floor(finalizingElapsed / 1000);
  const isDemo = project.id === 'demo';
  const recoverablePartial = (project.status === 'running' || project.status === 'error') && project.agentOutputs.length < 9;
  const running = project.status === 'running' && !recoverablePartial;
  const canReview = project.status === 'review' || project.status === 'needs_revision';
  const needsFinalize = !isDemo && project.agentOutputs.length === 9 && !project.synthesis && (project.status === 'running' || project.status === 'error');
  const completeAgents = project.scoreBreakdown?.completeAgents ?? project.agentOutputs.filter(agent => agent.status === 'complete').length;
  const degradedAgents = project.scoreBreakdown?.degradedAgents ?? project.agentOutputs.filter(agent => agent.status === 'degraded').length;
  const averageConfidence = project.scoreBreakdown?.averageConfidence ?? (project.agentOutputs.length ? Math.round(project.agentOutputs.reduce((sum, agent) => sum + agent.confidence, 0) / project.agentOutputs.length) : 0);
  const previewUrl = project.previewPath ? (() => { const url = new URL(window.location.href); url.hash = project.previewPath.replace(/^#/, ''); return url.toString(); })() : '';
  const activeAgentIndex = Math.min(project.agentOutputs.length, 8);

  return <div className="mx-auto max-w-7xl">
    <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start"><div><div className="flex flex-wrap items-center gap-2"><StatusPill label={statusLabel} tone={project.status === 'approved' ? 'green' : running ? 'cyan' : project.status === 'review' ? 'amber' : 'muted'} /><span className="rounded-full border border-[#1B2736] bg-[#0A0E15] px-3 py-1 text-xs text-white/35">{project.mode === 'deep' ? 'عميق' : project.mode === 'economy' ? 'اقتصادي' : 'متوازن'}</span>{isDemo && <StatusPill label="عرض تجريبي" tone="violet" />}</div><h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">{project.name}</h2><p className="mt-3 max-w-3xl leading-7 text-[#768496]">{project.brief}</p></div><div className="flex flex-wrap gap-2">{!isDemo && <button onClick={onDelete} className="rounded-xl border border-[#1B2736] bg-[#0A0E15] p-3 text-white/35 hover:border-[#FF7A91]/30 hover:text-[#FF9CAF]" aria-label="حذف المشروع"><Trash2 className="h-4 w-4" /></button>}<button onClick={onExport} disabled={!project.synthesis} className="inline-flex items-center gap-2 rounded-xl border border-[#1B2736] bg-[#0A0E15] px-4 py-3 text-sm text-white/55 disabled:opacity-30"><Download className="h-4 w-4" />تصدير التقرير</button>{needsFinalize && <button onClick={onFinalize} disabled={busy || (project.progress === 95 && !finalizingStalled)} className="inline-flex items-center gap-2 rounded-xl border border-[#FFD166]/30 bg-[#FFD166]/[.07] px-5 py-3 text-sm font-bold text-[#FFE6A3] disabled:opacity-50">{project.progress === 95 && !finalizingStalled ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{project.progress === 95 && !finalizingStalled ? 'يجري تجميع النتيجة' : 'استكمال النتيجة'}</button>}{!isDemo && <button onClick={onRun} disabled={busy || running} className="inline-flex items-center gap-2 rounded-xl bg-[#73E7FF] px-5 py-3 text-sm font-bold text-[#05070B] disabled:opacity-50">{running || busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}{recoverablePartial ? 'استكمال التشغيل' : project.agentOutputs.length ? 'تشغيل جولة جديدة' : 'تشغيل الوكلاء'}</button>}</div></div>

    {project.managerBrief && <ManagerBriefPanel project={project} />}
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#080B11] p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] sm:p-7">
      <div className="grid gap-7 xl:grid-cols-[1fr_320px]">
        <div><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold tracking-[.18em] text-[#73E7FF]/70">LIVE DESIGN COUNCIL</span><h3 className="mt-2 text-2xl font-bold">{project.progress < 100 ? 'الوكلاء يعملون على مشروعك' : 'اكتملت الجولة وأصبحت جاهزة للمراجعة'}</h3><p className="mt-2 text-sm text-[#768496]">{project.agentOutputs.length}/9 وكلاء أنهوا مخرجاتهم.</p></div><strong className="text-4xl text-[#73E7FF]">{project.progress}%</strong></div>
          <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-[#1B2736]"><div className="agent-scan h-full rounded-full bg-gradient-to-l from-[#73E7FF] to-[#9D8CFF] transition-all duration-700" style={{ width: `${project.progress}%` }} /></div>
          <div className="mt-5 grid grid-cols-3 gap-2">{waveNames.map((name, index) => <div key={name} className={`rounded-xl border p-3 text-center text-[10px] ${project.currentWave >= index + 1 ? 'border-[#73E7FF]/25 bg-[#73E7FF]/[.055] text-[#BDF5FF]' : 'border-[#1B2736] bg-[#0A0E15] text-white/25'}`}>{name}</div>)}</div>
          {project.progress === 95 && <p className={`mt-5 rounded-xl border p-3 text-xs leading-6 ${finalizingStalled ? 'border-[#FFD166]/20 bg-[#FFD166]/[.055] text-[#FFE6A3]' : 'border-[#73E7FF]/20 bg-[#73E7FF]/[.055] text-[#BDF5FF]'}`}>{finalizingStalled ? 'الدمج تأخر قليلًا؛ النظام يحاول إنقاذه تلقائيًا، وتقدر تضغط «استكمال النتيجة» بدون إعادة الوكلاء.' : `يجري دمج نتائج 9/9 تلقائيًا. المدة المعتادة 5–30 ثانية (${finalizingSeconds} ثانية).`}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 xl:grid-cols-3">{Array.from({ length: 9 }).map((_, index) => { const Icon = sourceIcons[index]; const output = project.agentOutputs[index]; const active = running && index === activeAgentIndex; return <div key={index} className={`relative grid min-h-24 place-items-center rounded-2xl border text-center transition ${output ? output.status === 'degraded' ? 'border-[#FF7A91]/25 bg-[#FF7A91]/[.055]' : 'border-[#4AE1A8]/20 bg-[#4AE1A8]/[.045]' : active ? 'border-[#73E7FF]/40 bg-[#73E7FF]/[.07]' : 'border-[#1B2736] bg-[#0A0E15]'}`}><Icon className={`h-5 w-5 ${output ? output.status === 'degraded' ? 'text-[#FF9CAF]' : 'text-[#6EF0BC]' : active ? 'text-[#73E7FF]' : 'text-white/18'}`} /><span className="mt-1 block text-[9px] text-white/30">0{index + 1}</span>{active && <span className="absolute inset-1 animate-pulse rounded-xl border border-[#73E7FF]/30" />}</div>; })}</div>
      </div>
    </section>

    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-[1.75rem] border border-[#1B2736] bg-[#0A0E15] p-5 sm:p-6"><div className="flex items-center justify-between"><div><span className="text-xs text-white/30">تفسير الدرجة</span><h3 className="mt-1 font-bold">جودة وثقة المخرجات</h3></div><ShieldCheck className="h-6 w-6 text-[#73E7FF]" /></div><p className="mt-4 text-sm leading-6 text-[#768496]">الدرجة ليست نسبة اكتمال. تجمع متوسط ثقة الوكلاء وعدد المخرجات التي اكتملت دون استخدام نتيجة احتياطية.</p><div className="mt-5 grid grid-cols-3 gap-2 text-center"><MetricMini value={completeAgents} label="سليم" tone="green" /><MetricMini value={degradedAgents} label="منخفض" tone="red" /><MetricMini value={`${averageConfidence}%`} label="متوسط الثقة" tone="cyan" /></div></section>
      <section className="rounded-[1.75rem] border border-[#1B2736] bg-[#0A0E15] p-5"><span className="text-xs text-white/30">الدرجة الحالية</span><div className="mt-3 flex items-end gap-2"><strong className={`text-6xl ${(project.score ?? 100) < 50 ? 'text-[#FF9CAF]' : 'text-[#73E7FF]'}`}>{project.score ?? '—'}</strong><span className="pb-2 text-sm text-white/25">/100</span></div><span className="mt-3 inline-block rounded-full bg-white/[.04] px-3 py-1 text-xs text-white/45">{project.scoreBreakdown?.label || (project.score ? 'جولة مقاسة' : 'تظهر بعد الدمج')}</span></section>
    </div>

    <section className="mt-10"><div className="mb-5 flex items-end justify-between"><div><span className="text-xs font-bold tracking-[.18em] text-[#9D8CFF]/70">NINE INDEPENDENT OUTPUTS</span><h3 className="mt-2 text-2xl font-bold">مخرجات الوكلاء</h3></div><span className="text-xs text-white/30">{project.agentOutputs.length}/9 مكتمل</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }).map((_, index) => <AgentCard key={index} index={index} agent={project.agentOutputs[index]} open={Boolean(project.agentOutputs[index] && expandedAgent === project.agentOutputs[index].agentId)} onToggle={() => { const agent = project.agentOutputs[index]; if (agent) setExpandedAgent(expandedAgent === agent.agentId ? null : agent.agentId); }} />)}</div></section>

    {project.synthesis && <SynthesisSection project={project} isDemo={isDemo} busy={busy} onConcept={onConcept} />}
    {project.synthesis && <PreviewTheater project={project} isDemo={isDemo} busy={busy} device={previewDevice} setDevice={setPreviewDevice} previewUrl={previewUrl} onBuild={onBuildPreview} />}
    {canReview && !isDemo && <DecisionSection feedback={feedback} setFeedback={setFeedback} busy={busy} onApprove={onApprove} onRevise={onRevise} />}
    <Timeline timeline={project.timeline} />
  </div>;
}

function ManagerBriefPanel({ project }: { project: Project }) {
  const brief = project.managerBrief!;
  return <section className="mt-8 rounded-[2rem] border border-[#73E7FF]/20 bg-[#73E7FF]/[.035] p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><span className="text-[10px] font-bold tracking-[.16em] text-[#73E7FF]/70">موجز مدير نَسَق</span><h3 className="mt-2 text-2xl font-bold">من فكرة قصيرة إلى خطة تنفيذ كاملة</h3><p className="mt-3 max-w-3xl text-sm leading-7 text-[#9AAABA]">{brief.summary}</p></div><div className="rounded-2xl border border-[#73E7FF]/15 bg-[#05070B]/60 px-5 py-4 text-center"><span className="text-xs text-white/35">هدف القبول</span><strong className="mt-1 block text-3xl text-[#73E7FF]">{project.acceptanceTarget || 85}/100</strong></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><SummaryBox title="الجمهور" text={project.audience} tone="cyan" /><SummaryBox title="الهدف" text={project.goal} tone="cyan" /><SummaryBox title="الطابع البصري" text={project.style} tone="violet" /></div>{brief.references.length > 0 && <div className="mt-5 rounded-xl border border-[#1B2736] bg-[#070A0F] p-4"><span className="text-[10px] text-white/30">الروابط المرجعية</span><div className="mt-2 flex flex-wrap gap-2">{brief.references.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-full border border-[#73E7FF]/15 px-3 py-1.5 text-[10px] text-[#9AF0FF]">{url}</a>)}</div></div>}<div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{brief.taskPlan.map((task, index) => <div key={task.agentId} className="rounded-xl border border-[#1B2736] bg-[#070A0F] p-3"><span className="text-[10px] text-[#73E7FF]">0{index + 1}</span><strong className="mr-2 text-xs">{task.agentName}</strong><p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/35">{task.task}</p></div>)}</div></section>;
}

function StatusPill({ label, tone }: { label: string; tone: 'cyan' | 'green' | 'amber' | 'violet' | 'muted' }) {
  const classes = { cyan: 'bg-[#73E7FF]/10 text-[#9AF0FF]', green: 'bg-[#4AE1A8]/10 text-[#6EF0BC]', amber: 'bg-[#FFD166]/10 text-[#FFE6A3]', violet: 'bg-[#9D8CFF]/10 text-[#C9C2FF]', muted: 'bg-white/[.04] text-white/40' };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[tone]}`}>{label}</span>;
}

function MetricMini({ value, label, tone }: { value: string | number; label: string; tone: 'green' | 'red' | 'cyan' }) {
  const colors = { green: 'text-[#6EF0BC] bg-[#4AE1A8]/[.055]', red: 'text-[#FF9CAF] bg-[#FF7A91]/[.055]', cyan: 'text-[#9AF0FF] bg-[#73E7FF]/[.055]' };
  return <div className={`rounded-xl p-3 ${colors[tone]}`}><strong className="block text-lg">{value}</strong><span className="text-[9px] text-white/35">{label}</span></div>;
}

function AgentCard({ index, agent, open, onToggle }: { index: number; agent?: AgentOutput; open: boolean; onToggle: () => void }) {
  const Icon = sourceIcons[index];
  return <article className={`rounded-2xl border transition ${agent ? agent.status === 'degraded' ? 'border-[#FF7A91]/20 bg-[#FF7A91]/[.035]' : 'border-[#1B2736] bg-[#0A0E15]' : 'border-[#1B2736] bg-white/[.01]'}`}>
    <button disabled={!agent} onClick={onToggle} className="w-full p-5 text-right"><div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${agent ? 'bg-[#73E7FF]/10 text-[#73E7FF]' : 'bg-white/[.035] text-white/15'}`}><Icon className="h-5 w-5" /></span><span className="font-mono text-[10px] text-white/20">0{index + 1}</span></div><h4 className={`mt-5 font-bold ${agent ? 'text-white' : 'text-white/20'}`}>{agent?.name || 'بانتظار الدور'}</h4><p className="mt-1 text-xs text-white/25">{agent?.workshop || agentBlueprints[index][3]}</p>{agent && <><p className="mt-4 line-clamp-3 text-sm leading-6 text-[#768496]">{agent.summary}</p><div className="mt-4 flex items-center justify-between border-t border-[#1B2736] pt-3"><span className={`text-[10px] ${agent.status === 'degraded' ? 'text-[#FF9CAF]' : 'text-[#6EF0BC]'}`}>{agent.status === 'degraded' ? 'يحتاج مراجعة' : 'مكتمل'}</span><span className="text-[10px] text-white/25">ثقة {agent.confidence}%</span></div></>}</button>
    {open && agent && <div className="border-t border-[#1B2736] px-5 pb-5 pt-4"><DetailList title="النتائج" items={agent.findings} /><DetailList title="القرارات" items={agent.decisions} /><div className="mt-4 rounded-xl bg-[#070A0F] p-3"><span className="text-[10px] text-white/25">التسليم</span><p className="mt-1 text-sm leading-6 text-white/55">{agent.deliverable}</p></div></div>}
  </article>;
}

function SynthesisSection({ project, isDemo, busy, onConcept }: { project: Project; isDemo: boolean; busy: boolean; onConcept: () => void }) {
  const synthesis = project.synthesis;
  return <section className="mt-12"><div className="mb-5"><span className="text-xs font-bold tracking-[.18em] text-[#73E7FF]/70">FINAL SYNTHESIS</span><h3 className="mt-2 text-2xl font-bold sm:text-3xl">القرار التصميمي النهائي</h3></div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
    <div className="rounded-[2rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#0A0E15] p-6 sm:p-8"><p className="text-lg leading-8 text-[#D8E3EE]">{synthesis.executiveSummary}</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><SummaryBox title="التموضع" text={synthesis.positioning} tone="cyan" /><SummaryBox title="الاتجاه البصري" text={synthesis.designDirection} tone="violet" /></div><div className="mt-7"><h4 className="mb-3 font-bold">الصفحات المقترحة</h4><div className="grid gap-2 sm:grid-cols-2">{(synthesis.pages || []).map((page: any, index: number) => <div key={`${page.name}-${index}`} className="rounded-xl border border-[#1B2736] bg-[#070A0F] p-4"><span className="text-[9px] font-bold text-[#73E7FF]">0{index + 1}</span><strong className="mt-3 block text-sm">{page.name}</strong><p className="mt-1 text-xs leading-5 text-[#768496]">{page.purpose}</p></div>)}</div></div></div>
    <div className="space-y-4"><div className="rounded-[1.75rem] border border-[#1B2736] bg-[#0A0E15] p-6"><h4 className="font-bold">رحلة المستخدم</h4><div className="mt-5 space-y-3">{(synthesis.primaryJourney || []).map((step: string, index: number) => <div key={`${step}-${index}`} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#73E7FF]/10 text-[10px] font-bold text-[#73E7FF]">{index + 1}</span><span className="pt-1 text-sm text-white/48">{step}</span></div>)}</div></div><div className="rounded-[1.75rem] border border-[#1B2736] bg-[#0A0E15] p-5"><div className="flex items-center justify-between"><h4 className="font-bold">لوحة الاتجاه المرئي</h4><Image className="h-5 w-5 text-[#9D8CFF]" /></div>{project.conceptImageUrl ? <img src={project.conceptImageUrl} alt="لوحة الاتجاه البصري" className="mt-4 aspect-video w-full rounded-xl object-cover" /> : <div className="mt-4 grid aspect-video place-items-center rounded-xl border border-dashed border-[#2B3B4E] bg-[#070A0F] text-center text-xs text-white/20">لم تُولّد لوحة بعد</div>}{!isDemo && <button onClick={onConcept} disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2B3B4E] px-4 py-3 text-sm text-white/60 hover:border-[#9D8CFF]/40"><Palette className="h-4 w-4" />توليد لوحة بصرية</button>}</div></div>
  </div></section>;
}

function SummaryBox({ title, text, tone }: { title: string; text: string; tone: 'cyan' | 'violet' }) {
  const classes = tone === 'cyan' ? 'border-[#73E7FF]/15 bg-[#73E7FF]/[.04]' : 'border-[#9D8CFF]/15 bg-[#9D8CFF]/[.04]';
  return <div className={`rounded-xl border p-4 ${classes}`}><span className="text-[10px] text-white/30">{title}</span><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>;
}

function PreviewTheater({ project, isDemo, busy, device, setDevice, previewUrl, onBuild }: { project: Project; isDemo: boolean; busy: boolean; device: 'desktop' | 'mobile'; setDevice: (device: 'desktop' | 'mobile') => void; previewUrl: string; onBuild: () => void }) {
  return <section className="mt-12 overflow-hidden rounded-[2rem] border border-[#2B3B4E] bg-[#080B11]">
    <div className="flex flex-col justify-between gap-4 border-b border-[#1B2736] p-5 sm:flex-row sm:items-center sm:p-6"><div><div className="flex items-center gap-2"><Monitor className="h-5 w-5 text-[#73E7FF]" /><h3 className="text-xl font-bold">معاينة الموقع الكاملة</h3></div><p className="mt-2 text-sm leading-6 text-[#768496]">موقع حقيقي متجاوب يمكنك فتحه ومشاركته، وليس صورة ثابتة.</p></div><div className="flex flex-wrap gap-2">{project.previewPath && <div className="flex rounded-xl border border-[#1B2736] bg-[#0A0E15] p-1"><button onClick={() => setDevice('desktop')} className={`rounded-lg px-3 py-2 text-xs ${device === 'desktop' ? 'bg-[#73E7FF]/10 text-[#73E7FF]' : 'text-white/35'}`}>كمبيوتر</button><button onClick={() => setDevice('mobile')} className={`rounded-lg px-3 py-2 text-xs ${device === 'mobile' ? 'bg-[#73E7FF]/10 text-[#73E7FF]' : 'text-white/35'}`}>جوال</button></div>}{!project.previewPath && !isDemo && <button onClick={onBuild} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#73E7FF] px-5 py-3 text-sm font-bold text-[#05070B] disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4" />}بناء معاينة موقع كاملة</button>}</div></div>
    {project.previewPath ? <><div className="preview-stage flex min-h-[620px] items-start justify-center overflow-auto bg-[#030508] p-3 sm:p-6"><div className={`overflow-hidden rounded-2xl border border-[#2B3B4E] bg-white shadow-[0_30px_80px_rgba(0,0,0,.55)] transition-all duration-500 ${device === 'mobile' ? 'w-[390px] max-w-full' : 'w-full'}`}><iframe src={previewUrl} title={`معاينة ${project.name}`} sandbox="allow-scripts allow-forms allow-popups" className="h-[590px] w-full bg-white" /></div></div><div className="flex flex-col gap-3 border-t border-[#1B2736] p-4 lg:flex-row"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#1B2736] bg-[#0A0E15] px-3"><input readOnly value={previewUrl} className="min-w-0 flex-1 bg-transparent py-3 text-left text-xs text-white/40 outline-none" dir="ltr" /><button onClick={() => navigator.clipboard?.writeText(previewUrl)} className="p-2 text-white/35 hover:text-white" title="نسخ الرابط"><Copy className="h-4 w-4" /></button></div><button onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#73E7FF] px-5 py-3 text-sm font-bold text-[#05070B]"><ExternalLink className="h-4 w-4" />فتح الرابط الكامل</button>{!isDemo && <button onClick={onBuild} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B3B4E] px-5 py-3 text-sm text-white/55 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />إعادة البناء</button>}</div></> : <div className="grid min-h-72 place-items-center p-8 text-center"><div><Monitor className="mx-auto h-10 w-10 text-white/15" /><h4 className="mt-4 font-bold">القرار جاهز، والمعاينة لم تُبنَ بعد</h4><p className="mt-2 text-sm text-[#768496]">اضغط بناء المعاينة ليحوّل النظام القرار إلى موقع متجاوب.</p></div></div>}
  </section>;
}

function DecisionSection({ feedback, setFeedback, busy, onApprove, onRevise }: { feedback: string; setFeedback: (value: string) => void; busy: boolean; onApprove: () => void; onRevise: () => void }) {
  return <section className="mt-10 rounded-[2rem] border border-[#FFD166]/20 bg-[#FFD166]/[.04] p-6 sm:p-8"><div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><div><UserCheck className="h-7 w-7 text-[#FFD166]" /><h3 className="mt-4 text-2xl font-bold">القرار بيدك.</h3><p className="mt-3 leading-7 text-white/42">لا تتحول الجولة إلى ذاكرة معتمدة حتى توافق عليها. ملاحظاتك ستصبح سياقًا للجولة التالية.</p></div><div><textarea value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="اكتب ملاحظات الاعتماد أو التعديل..." className="min-h-28 w-full resize-none rounded-xl border border-[#2B3B4E] bg-[#070A0F] p-4 outline-none placeholder:text-white/20 focus:border-[#FFD166]/40" /><div className="mt-3 grid gap-3 sm:grid-cols-2"><button onClick={onRevise} disabled={busy} className="rounded-xl border border-[#2B3B4E] px-5 py-3 font-bold text-white/60">طلب تعديلات</button><button onClick={onApprove} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD166] px-5 py-3 font-bold text-[#05070B]"><Check className="h-4 w-4" />اعتماد وحفظ الذاكرة</button></div></div></div></section>;
}

function Timeline({ timeline }: { timeline: Project['timeline'] }) {
  return <section className="mt-10"><h3 className="mb-4 font-bold">سجل التشغيل</h3><div className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-5"><div className="space-y-5">{[...timeline].reverse().map((item, index) => <div key={`${item.at}-${index}`} className="flex gap-4"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#73E7FF] shadow-[0_0_15px_rgba(115,231,255,.5)]" /><div><strong className="text-sm">{item.label}</strong><p className="mt-1 text-xs leading-5 text-[#768496]">{item.detail}</p><span className="mt-1 block text-[10px] text-white/18">{new Date(item.at).toLocaleString('ar-SA')}</span></div></div>)}</div></div></section>;
}

function Sources({ agents }: { agents: MethodAgent[] }) {
  return <div className="mx-auto max-w-6xl"><div className="max-w-3xl"><span className="text-xs font-bold tracking-[.2em] text-[#9D8CFF]/70">SOURCE MAP</span><h2 className="mt-3 text-4xl font-extrabold">كيف تحولت ورش GitHub إلى منتج.</h2><p className="mt-4 leading-7 text-[#768496]">كل ورشة أصبحت وظيفة حقيقية داخل الاستوديو: بحث، تقسيم، ذاكرة، اختيار عمق، تقييم، مراجعة بشرية وسجل تشغيل.</p></div><div className="mt-9 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{agents.map((agent, index) => { const Icon = sourceIcons[index] || Bot; return <article key={agent.id} className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-6"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#73E7FF]/10 text-[#73E7FF]"><Icon className="h-5 w-5" /></span><span className="font-mono text-xs text-white/20">0{index + 1}</span></div><span className="mt-7 block text-xs text-[#9D8CFF]/70">{agent.workshop}</span><h3 className="mt-2 text-lg font-bold">{agent.name}</h3><p className="mt-2 text-sm text-white/38">{agent.title}</p><p className="mt-5 border-t border-[#1B2736] pt-4 text-xs leading-6 text-[#768496]">{agent.mission}</p></article>; })}</div></div>;
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return <div className="mt-3"><span className="text-[10px] font-bold text-white/25">{title}</span><ul className="mt-2 space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-white/45"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#73E7FF]" />{item}</li>)}</ul></div>;
}

export default Studio;
