import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, auth, ws, type AuthUser, type WsConnection } from '@appdeploy/client';
import {
  ArrowLeft, BookOpen, Bot, Brain, Check, Clock3, Copy, Download,
  ExternalLink, FileText, Gauge, Image, Layers3, LayoutDashboard, LogIn, LogOut,
  ChevronDown, Menu, MessageSquareText, Monitor, Palette, Play, Plus, RefreshCw, Search, ShieldCheck, Sparkles,
  Trash2, UserCheck, X, Zap
} from 'lucide-react';

type AgentOutput = {
  agentId: string; name: string; title: string; workshop: string;
  status: 'complete' | 'degraded'; summary: string; findings: string[];
  decisions: string[]; deliverable: string; confidence: number; elapsedMs: number;
};

type ManagerBrief = {
  idea: string; summary: string; name: string; brief: string; audience: string; goal: string; style: string;
  references: string[]; assumptions: string[]; openQuestions: string[];
  taskPlan: Array<{ agentId: string; agentName: string; task: string }>; generatedAt: number;
};

type Project = {
  id: string; name: string; brief: string; audience: string; goal: string; style: string;
  references: string[]; mode: 'economy' | 'balanced' | 'deep'; status: string;
  progress: number; currentWave: number; agentOutputs: AgentOutput[]; synthesis?: any;
  score?: number; scoreBreakdown?: { completeAgents: number; degradedAgents: number; averageConfidence: number; label: string };
  feedback?: string; conceptImageUrl?: string; previewPath?: string; previewUpdatedAt?: number;
  managerBrief?: ManagerBrief; acceptanceTarget?: number;
  acceptanceHistory?: Array<{ at: number; before: number; after: number; rerunAgents: string[] }>;
  timeline: Array<{ at: number; label: string; detail: string }>; createdAt: number; updatedAt: number;
};

type MethodAgent = { id: string; name: string; title: string; workshop: string; mission: string };
type View = 'landing' | 'dashboard' | 'new' | 'project' | 'sources';

const AGENTS = [
  ['brief-analyst', 'محلل الموجز', 'How We Claude Code'],
  ['evidence-researcher', 'باحث الأدلة', 'Research Desk'],
  ['product-strategist', 'استراتيجي المنتج', 'Agent Decomposition'],
  ['memory-curator', 'أمين ذاكرة العلامة', 'Agents That Remember'],
  ['ux-architect', 'معماري تجربة المستخدم', 'Production-Ready Agent'],
  ['ui-director', 'مخرج الواجهة', 'Ship Your First Managed Agent'],
  ['efficiency-router', 'مهندس الكفاءة', 'Picking the Right Model'],
  ['quality-evaluator', 'مراجع الجودة', 'Eval-Driven Agent Development'],
  ['challenger', 'الناقد المنافس', 'Agent Battle']
] as const;

const icons = [FileText, Search, Layers3, Brain, UserCheck, Bot, Gauge, ShieldCheck, Zap];
const APPDEPLOY_STUDIO_URL = 'https://441a4987f6936b832e.v2.appdeploy.ai/';

function isAppDeployHost() { return window.location.hostname.endsWith('.appdeploy.ai'); }
function openAppDeployStudio() {
  const target = new URL(APPDEPLOY_STUDIO_URL);
  target.searchParams.set('start', '1');
  window.location.assign(target.toString());
}

const demoOutputs: AgentOutput[] = AGENTS.map((agent, index) => ({
  agentId: agent[0], name: agent[1], title: 'مخرج متخصص', workshop: agent[2], status: 'complete',
  summary: 'تم تحليل الجزء المسؤول عنه وربطه بهدف المشروع وتجربة المستخدم.',
  findings: ['الرسالة الرئيسية يجب أن تظهر مبكرًا.', 'الجوال هو نقطة البداية.'],
  decisions: ['مسار رئيسي واحد', 'واجهة RTL أصلية'], deliverable: 'مخرج جاهز للتنسيق النهائي.',
  confidence: 88 + (index % 6), elapsedMs: 1200 + index * 140
}));

const demoProject: Project = {
  id: 'demo', name: 'نَسَق',
  brief: 'منصة عربية تشغّل تسعة وكلاء متخصصين ثم تبني معاينة موقع حقيقية قابلة للمشاركة.',
  audience: 'أصحاب الأعمال والوكالات والمستقلون في السعودية', goal: 'تحويل الفكرة إلى قرار تصميم ورابط عرض واضح',
  style: 'تقني فاخر، حبر داكن، سماوي وبنفسجي، Mobile First', references: [], mode: 'balanced',
  status: 'review', progress: 100, currentWave: 3, agentOutputs: demoOutputs, score: 92,
  scoreBreakdown: { completeAgents: 9, degradedAgents: 0, averageConfidence: 92, label: 'قوي' },
  previewPath: '#/preview/demo',
  synthesis: {
    executiveSummary: 'تجربة تبيع النتيجة بدل المصطلحات: يرى العميل فريق الوكلاء يعمل ثم يفتح موقعًا حقيقيًا قابلًا للمشاركة.',
    positioning: 'تسعة تخصصات تعمل كاستوديو واحد مع مراجعة بشرية.',
    designDirection: 'خلفية حبرية عميقة، سماوي مضيء، بنفسجي بارد، طبقات واضحة وحركة هادئة.',
    primaryJourney: ['فهم الوعد', 'كتابة الموجز', 'متابعة الوكلاء', 'مراجعة القرار', 'فتح المعاينة'],
    pages: [
      { name: 'الرئيسية', purpose: 'بيع الوعد وإظهار القيمة' },
      { name: 'لوحة المشاريع', purpose: 'إدارة الجولات والمعاينات' },
      { name: 'تفاصيل المشروع', purpose: 'متابعة الوكلاء والقرار' }
    ]
  },
  timeline: [{ at: Date.now(), label: 'جاهز للمراجعة', detail: 'اكتملت الجولة بدرجة 92/100.' }],
  createdAt: Date.now(), updatedAt: Date.now()
};

function Brand() {
  return <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#73E7FF] to-[#9D8CFF] text-[#05070B]"><span className="text-base font-black">ن</span></span><span><strong className="block text-sm">نَسَق</strong><small className="text-[9px] tracking-[.16em] text-white/30">NASQ AI</small></span></div>;
}

function Studio() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('landing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [methodology, setMethodology] = useState<MethodAgent[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [managerIdea, setManagerIdea] = useState('');
  const [managerStatus, setManagerStatus] = useState('اكتب فكرتك حتى لو كانت جملة واحدة، وأنا أرتب الباقي وأوزعه على الفريق.');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({ name: '', brief: '', audience: '', goal: '', style: 'تقني فاخر، واضح، Mobile First', references: '', mode: 'balanced' as Project['mode'] });
  const connectionRef = useRef<WsConnection | null>(null);

  const statusLabel = useMemo(() => ({ draft: 'مسودة', running: 'الوكلاء يعملون', review: 'جاهز للمراجعة', approved: 'معتمد', needs_revision: 'يحتاج تعديل', error: 'تعذر التنفيذ' }[selected?.status || 'draft'] || 'مشروع'), [selected?.status]);

  useEffect(() => {
    Promise.all([auth.getUser(), api.get('/api/methodology')])
      .then(([current, method]) => {
        const startRequested = new URLSearchParams(window.location.search).get('start') === '1';
        if (startRequested) {
          window.sessionStorage.setItem('nasq:start-project', '1');
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
        }
        setUser(current); setMethodology(method.data.agents || []);
        if (current) {
          const openNew = startRequested || window.sessionStorage.getItem('nasq:start-project') === '1';
          if (openNew) window.sessionStorage.removeItem('nasq:start-project');
          setView(openNew ? 'new' : 'dashboard'); void loadProjects();
        } else if (startRequested) setErrorText('وصلت للاستوديو الصحيح. سجّل دخولك ثم اكتب فكرتك مباشرة.');
      })
      .catch(() => setErrorText('ما قدرنا نحمّل التطبيق الحين. جرّب مرة ثانية.'))
      .finally(() => setLoading(false));
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
      if (active && connection.connectionId) void api.post('/api/subscriptions', { entity_type: 'project', entity_id: selected.id, connection_id: connection.connectionId });
    });
    return () => {
      active = false;
      if (connection.connectionId) api.post('/api/subscriptions/remove', { entity_type: 'project', entity_id: selected.id, connection_id: connection.connectionId }).catch(() => undefined);
    };
  }, [selected?.id]);

  async function loadProjects() {
    try { const response = await api.get('/api/projects'); setProjects(response.data.projects || []); }
    catch { setErrorText('تعذر تحميل المشاريع.'); }
  }

  async function signIn(destination: 'dashboard' | 'new' = 'dashboard') {
    if (!isAppDeployHost()) { window.sessionStorage.setItem('nasq:start-project', destination === 'new' ? '1' : '0'); openAppDeployStudio(); return; }
    try {
      const result = await auth.signIn({ scope: 'openid email profile offline_access' });
      setUser(result.user); setView(destination); await loadProjects();
    } catch { setErrorText('ما قدرنا نسجّل دخولك. اسمح بالنوافذ المنبثقة وجرّب مرة ثانية.'); }
  }

  function startProject() {
    if (!user) return void signIn('new');
    setSelected(null); setView('new'); setMobileMenu(false);
  }

  async function signOut() { await auth.signOut(); setUser(null); setProjects([]); setSelected(null); setView('landing'); }
  function openProject(project: Project) { setSelected(project); setView('project'); setMobileMenu(false); }

  async function startManagedProject() {
    if (!user) return void signIn('new');
    const idea = managerIdea.trim();
    if (idea.length < 8) return setErrorText('اكتب فكرتك بجملة قصيرة على الأقل.');
    setBusy(true); setErrorText(''); setManagerStatus('مدير نَسَق يفهم الفكرة ويجهز الموجز الاحترافي...');
    try {
      const response = await api.post('/api/projects/from-idea', { idea, mode: form.mode, acceptanceTarget: 85 });
      const project = response.data.project as Project;
      setForm({ name: project.name, brief: project.brief, audience: project.audience, goal: project.goal, style: project.style, references: project.references.join('\n'), mode: project.mode });

      setProjects(items => [project, ...items]);
      setSelected(project); setView('project');
      setManagerStatus('تم توزيع الموجز على 9 وكلاء، وبدأ التنفيذ مع جولة تحسين تلقائية عند انخفاض درجة القبول.');
      const runResponse = await api.post(`/api/projects/${project.id}/run`, {});
      const completed = runResponse.data.project as Project;
      setSelected(completed); setProjects(items => items.map(item => item.id === completed.id ? completed : item));
    } catch {
      setErrorText('تم حفظ ما أمكن، لكن تعذر إكمال تشغيل الفريق الآن. افتح المشروع واضغط تشغيل الوكلاء.');
    } finally { setBusy(false); }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!user) return void signIn();
    if (!form.name.trim() || !form.brief.trim()) return setErrorText('اكتب اسم المشروع وفكرته الأساسية عشان نبدأ.');
    setBusy(true); setErrorText('');
    try {
      const response = await api.post('/api/projects', { ...form, references: form.references.split('\n').map(v => v.trim()).filter(Boolean) });
      const project = response.data.project as Project;
      setProjects(items => [project, ...items]); openProject(project);
    } catch { setErrorText('تعذر إنشاء المشروع.'); } finally { setBusy(false); }
  }

  async function mutate(path: string, body: Record<string, unknown> = {}) {
    if (!selected || selected.id === 'demo') return;
    setBusy(true); setErrorText('');
    try {
      const response = await api.post(`/api/projects/${selected.id}/${path}`, body);
      const project = response.data.project as Project;
      setSelected(project); setProjects(items => items.map(item => item.id === project.id ? project : item));
    } catch { setErrorText('تعذر إكمال العملية الآن. أعد المحاولة بعد قليل.'); } finally { setBusy(false); }
  }

  async function removeProject() {
    if (!selected || selected.id === 'demo' || !window.confirm('حذف المشروع نهائيًا؟')) return;
    await api.delete(`/api/projects/${selected.id}`);
    setProjects(items => items.filter(item => item.id !== selected.id)); setSelected(null); setView('dashboard');
  }

  function exportReport() {
    if (!selected?.synthesis) return;
    const s = selected.synthesis;
    const text = `# ${selected.name}\n\n## الملخص\n${s.executiveSummary || ''}\n\n## التموضع\n${s.positioning || ''}\n\n## الاتجاه\n${s.designDirection || ''}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${selected.name}-design-report.md`; anchor.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#05070B] text-[#73E7FF]">جاري تجهيز الاستوديو...</div>;

  return <main dir="rtl" className="min-h-screen bg-[#05070B] text-[#F7FBFF] selection:bg-[#73E7FF] selection:text-[#05070B]">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(115,231,255,.08),transparent_35%),radial-gradient(circle_at_90%_65%,rgba(157,140,255,.08),transparent_35%)]" />
    {view === 'landing' ? <Landing user={user} onSignIn={() => signIn('dashboard')} onStart={startProject} onDashboard={() => setView('dashboard')} onDemo={() => openProject(demoProject)} onSources={() => setView('sources')} /> : <div className="relative z-10 flex min-h-screen">
      <Sidebar user={user} view={view} projects={projects} open={mobileMenu} onClose={() => setMobileMenu(false)} onView={setView} onProject={openProject} onDemo={() => openProject(demoProject)} onSignIn={() => signIn('dashboard')} onSignOut={signOut} />
      <section className="min-w-0 flex-1 lg:pr-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#1B2736] bg-[#05070B]/90 px-4 backdrop-blur-xl sm:px-7"><button onClick={() => setMobileMenu(true)} className="rounded-xl border border-[#1B2736] p-2 lg:hidden"><Menu className="h-5 w-5" /></button><div><small className="text-[9px] font-bold tracking-[.16em] text-[#73E7FF]/70">NASQ DESIGN STUDIO</small><h1 className="text-sm font-bold">{selected?.name || (view === 'new' ? 'مشروع جديد' : view === 'sources' ? 'مصادر المنهج' : 'لوحة المشاريع')}</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#73E7FF] to-[#9D8CFF] text-xs font-bold text-[#05070B]">{user?.name?.slice(0, 1) || 'ن'}</span></header>
        <div className="p-4 sm:p-7 lg:p-9">{errorText && <div className="mb-5 flex justify-between rounded-2xl border border-[#FF7A91]/25 bg-[#FF7A91]/[.07] p-4 text-sm text-[#FFD5DD]">{errorText}<button onClick={() => setErrorText('')}><X className="h-4 w-4" /></button></div>}
          {view === 'dashboard' && <Dashboard user={user} projects={projects} onNew={startProject} onProject={openProject} onDemo={() => openProject(demoProject)} onSignIn={() => signIn('dashboard')} />}
          {view === 'new' && <NewProject idea={managerIdea} setIdea={setManagerIdea} managerStatus={managerStatus} form={form} setForm={setForm} busy={busy} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} onManagedStart={startManagedProject} onSubmit={createProject} />}
          {view === 'project' && selected && <ProjectView project={selected} statusLabel={statusLabel} busy={busy} feedback={feedback} setFeedback={setFeedback} onRun={() => mutate('run')} onFinalize={() => mutate('finalize')} onApprove={() => mutate('decision', { decision: 'approve', feedback })} onRevise={() => mutate('decision', { decision: 'revise', feedback })} onConcept={() => mutate('concept-image')} onPreview={() => mutate('site-preview')} onExport={exportReport} onDelete={removeProject} />}
          {view === 'sources' && <Sources agents={methodology} />}
        </div>
      </section>
    </div>}
  </main>;
}

function Landing({ user, onSignIn, onStart, onDashboard, onDemo, onSources }: { user: AuthUser | null; onSignIn: () => void; onStart: () => void; onDashboard: () => void; onDemo: () => void; onSources: () => void }) {
  return <div className="relative z-10"><header className="border-b border-[#1B2736] bg-[#05070B]/75 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><button onClick={onDashboard}><Brand /></button><nav className="hidden gap-7 text-sm text-white/45 md:flex"><button onClick={onSources}>المنهج</button><button onClick={onDemo}>مثال حي</button><button onClick={onDashboard}>المشاريع</button></nav><button onClick={user ? onDashboard : onSignIn} className="rounded-xl bg-[#73E7FF] px-5 py-2.5 text-sm font-bold text-[#05070B]">{user ? 'فتح الاستوديو' : 'تسجيل الدخول'}</button></div></header>
    <section className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-2"><div><span className="inline-flex items-center gap-2 rounded-full border border-[#73E7FF]/20 bg-[#73E7FF]/[.06] px-3 py-1.5 text-xs font-semibold text-[#9AF0FF]"><Sparkles className="h-3.5 w-3.5" />9 وكلاء • موقع كامل • رابط مباشر</span><h1 className="mt-7 text-5xl font-extrabold leading-[1.15] sm:text-6xl lg:text-7xl">خل فكرتك تصير موقع جاهز<br /><span className="bg-gradient-to-l from-[#73E7FF] to-[#B2A7FF] bg-clip-text text-transparent">خلال دقائق.</span></h1><p className="mt-7 max-w-2xl text-lg leading-8 text-[#A8B4C3]">اكتب فكرتك وبس. فريق من 9 وكلاء يحلل المشروع ويرتب تجربة المستخدم ويجهز الواجهة والمعاينة قدامك خطوة بخطوة، وبالنهاية تستلم رابط تقدر تفتحه وتشاركه.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={onStart} className="rounded-xl bg-[#73E7FF] px-7 py-3.5 font-bold text-[#05070B]">ابدأ مشروعك الحين</button><button onClick={onDemo} className="rounded-xl border border-[#2B3B4E] bg-[#0A0E15] px-7 py-3.5 text-[#D8E3EE]">شوف مثال شغال</button></div></div>
      <div className="rounded-[2rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#080B11] p-6 shadow-2xl"><div className="flex items-center justify-between"><span className="rounded-full bg-[#73E7FF]/10 px-3 py-1 text-[10px] font-bold text-[#73E7FF]">LIVE</span><strong>مجلس التصميم يعمل الآن</strong></div><div className="mt-5 space-y-3">{['باحث الأدلة', 'معماري التجربة', 'مخرج الواجهة', 'مراجع الجودة'].map((name, index) => <div key={name} className="flex items-center gap-3 rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-4"><span className={`h-3 w-3 rounded-full ${index < 1 ? 'bg-[#4AE1A8]' : index === 1 ? 'animate-pulse bg-[#73E7FF]' : 'bg-white/15'}`} /><div className="flex-1"><strong className="block text-sm">{name}</strong><small className="text-white/30">{index < 1 ? 'مكتمل' : index === 1 ? 'يعمل الآن' : 'بانتظار الدور'}</small></div></div>)}</div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[#1B2736]"><div className="agent-scan h-full w-[42%] rounded-full bg-gradient-to-l from-[#73E7FF] to-[#9D8CFF]" /></div></div>
    </section></div>;
}

function Sidebar({ user, view, projects, open, onClose, onView, onProject, onDemo, onSignIn, onSignOut }: any) {
  const nav = [['dashboard', 'لوحة المشاريع', LayoutDashboard], ['new', 'مشروع جديد', Plus], ['sources', 'مصادر المنهج', BookOpen]] as const;
  return <><div onClick={onClose} className={`fixed inset-0 z-40 bg-black/75 lg:hidden ${open ? 'block' : 'hidden'}`} /><aside className={`fixed right-0 top-0 z-50 flex h-screen w-72 flex-col border-l border-[#1B2736] bg-[#070A0F] p-5 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : 'translate-x-full'}`}><div className="mb-8 flex items-center justify-between"><Brand /><button onClick={onClose} className="lg:hidden"><X className="h-5 w-5" /></button></div><nav className="space-y-2">{nav.map(([id, label, Icon]) => <button key={id} onClick={() => { if (id === 'new' && !user) return onSignIn(); onView(id); onClose(); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${view === id ? 'bg-[#73E7FF]/10 text-[#BDF5FF]' : 'text-white/48 hover:bg-white/[.035]'}`}><Icon className="h-4 w-4" />{label}</button>)}<button onClick={onDemo} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/48"><Sparkles className="h-4 w-4 text-[#9D8CFF]" />المشروع التجريبي</button></nav><div className="mt-8 min-h-0 flex-1 overflow-y-auto"><p className="mb-3 text-xs font-bold text-white/25">مشاريعك</p>{projects.map((project: Project) => <button key={project.id} onClick={() => onProject(project)} className="w-full rounded-xl px-3 py-2.5 text-right hover:bg-white/[.035]"><span className="block truncate text-sm text-white/62">{project.name}</span><small className="text-white/25">{project.progress}%</small></button>)}</div><button onClick={user ? onSignOut : onSignIn} className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#1B2736] p-3 text-sm text-white/55">{user ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{user ? 'تسجيل الخروج' : 'تسجيل الدخول'}</button></aside></>;
}

function Dashboard({ user, projects, onNew, onProject, onDemo, onSignIn }: any) {
  if (!user) return <div className="mx-auto max-w-3xl py-16 text-center"><LogIn className="mx-auto h-10 w-10 text-[#73E7FF]" /><h2 className="mt-6 text-3xl font-extrabold">سجّل دخولك وكمل من هنا</h2><p className="mt-3 text-[#768496]">عشان نشغّل الوكلاء ونحفظ مشاريعك وقراراتك.</p><div className="mt-7 flex justify-center gap-3"><button onClick={onSignIn} className="rounded-xl bg-[#73E7FF] px-6 py-3 font-bold text-[#05070B]">تسجيل الدخول</button><button onClick={onDemo} className="rounded-xl border border-[#2B3B4E] px-6 py-3">عرض التجربة</button></div></div>;
  const metrics = [['إجمالي المشاريع', projects.length], ['تعمل الآن', projects.filter((p: Project) => p.status === 'running').length], ['جاهزة للعميل', projects.filter((p: Project) => p.status === 'approved').length], ['تحتاج قرارك', projects.filter((p: Project) => p.status === 'review').length]];
  return <div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><small className="font-bold tracking-[.2em] text-[#73E7FF]/70">WORKSPACE</small><h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">مرحبًا، {user.name?.split(' ')[0] || 'محمد'}.</h2><p className="mt-3 text-[#768496]">نظرة سريعة على المشاريع التي تعمل وتنتظر قرارك.</p></div><button onClick={onNew} className="rounded-xl bg-[#73E7FF] px-6 py-3 font-bold text-[#05070B]"><Plus className="ml-2 inline h-4 w-4" />مشروع جديد</button></div><div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label as string} className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-5"><strong className="block text-3xl">{value}</strong><span className="text-xs text-[#768496]">{label}</span></div>)}</div><div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{projects.length ? projects.map((project: Project) => <button key={project.id} onClick={() => onProject(project)} className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-5 text-right hover:border-[#73E7FF]/30"><div className="flex justify-between"><span className="rounded-full bg-[#73E7FF]/10 px-3 py-1 text-[10px] text-[#73E7FF]">{project.progress}%</span><ArrowLeft className="h-4 w-4 text-white/20" /></div><h3 className="mt-6 text-lg font-bold">{project.name}</h3><p className="mt-2 line-clamp-2 text-sm text-[#768496]">{project.brief}</p></button>) : <button onClick={onNew} className="rounded-[2rem] border border-dashed border-[#2B3B4E] bg-[#0A0E15] p-12 text-center"><Bot className="mx-auto h-10 w-10 text-[#73E7FF]/40" /><strong className="mt-4 block">ابدأ أول مشروع</strong></button>}</div></div>;
}

function NewProject({ idea, setIdea, managerStatus, form, setForm, busy, showAdvanced, setShowAdvanced, onManagedStart, onSubmit }: any) {
  const examples = ['أبي موقع لحضانة أطفال يساعد الأهالي يعرفون البرامج ويحجزون زيارة', 'منصة تعرض خدماتي في تصميم المواقع وتجيب لي عملاء', 'متجر سعودي لمنتجات العناية بهوية فاخرة وسهلة على الجوال'];
  const input = (key: string, label: string, placeholder: string) => <label><span className="mb-2 block text-sm font-semibold">{label}</span><input value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} className="w-full rounded-xl border border-[#1B2736] bg-[#070A0F] px-4 py-3.5 outline-none focus:border-[#73E7FF]/50" /></label>;
  return <div className="mx-auto max-w-5xl">
    <section className="overflow-hidden rounded-[2rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#080B11] shadow-2xl">
      <div className="flex items-center gap-4 border-b border-[#1B2736] p-5 sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#73E7FF] to-[#9D8CFF] text-[#05070B]"><MessageSquareText className="h-6 w-6" /></span><div><small className="font-bold tracking-[.16em] text-[#73E7FF]/70">مدير نَسَق</small><h2 className="mt-1 text-xl font-bold">قل لي الفكرة ببساطة، والباقي علينا.</h2></div></div>
      <div className="p-5 sm:p-7"><div className="max-w-3xl rounded-2xl rounded-tr-md border border-[#1B2736] bg-[#070A0F] p-4 text-sm leading-7 text-[#C4D0DC]">{managerStatus}</div><textarea value={idea} onChange={event => setIdea(event.target.value)} placeholder="مثال: أبي موقع لمغسلة سيارات يوضح الباقات ويخلي العميل يحجز بسهولة..." className="mt-5 min-h-36 w-full rounded-2xl border border-[#2B3B4E] bg-[#05070B] p-5 text-base leading-8 outline-none placeholder:text-white/20 focus:border-[#73E7FF]/55" />
        <div className="mt-3 flex flex-wrap gap-2">{examples.map(example => <button type="button" key={example} onClick={() => setIdea(example)} className="rounded-full border border-[#1B2736] bg-white/[.025] px-3 py-2 text-[11px] text-white/45 hover:border-[#73E7FF]/30">{example}</button>)}</div>
        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="rounded-xl border border-[#73E7FF]/15 bg-[#73E7FF]/[.045] p-4 text-xs leading-6 text-[#9CC3CF]">المدير يستخرج اسم المشروع والجمهور والهدف والطابع البصري والموجز والروابط الموجودة في كلامك، ثم يوزع مهامًا واضحة على 9 وكلاء ويحسن درجة القبول تلقائيًا حتى 85/100 قدر الإمكان.</div><button type="button" onClick={onManagedStart} disabled={busy} className="rounded-xl bg-[#73E7FF] px-7 py-4 font-bold text-[#05070B] disabled:opacity-50">{busy ? 'جاري إدارة المشروع...' : 'حلّل الفكرة وشغّل الفريق'}</button></div>
      </div>
    </section>

    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="mt-5 flex w-full items-center justify-between rounded-2xl border border-[#1B2736] bg-[#0A0E15] px-5 py-4 text-sm text-white/60"><span>عندي تفاصيل وأبي أكتب الموجز بنفسي</span><ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} /></button>
    {showAdvanced && <form onSubmit={onSubmit} className="mt-4"><div className="grid gap-5 lg:grid-cols-[1fr_300px]"><section className="rounded-[2rem] border border-[#1B2736] bg-[#0A0E15] p-6"><div className="grid gap-5 md:grid-cols-2">{input('name', 'اسم المشروع', 'منصة شحن للمتاجر')}{input('audience', 'الجمهور', 'أصحاب المتاجر')}{input('goal', 'الهدف', 'زيادة الطلبات')}{input('style', 'الطابع البصري', 'تقني وموثوق')}</div><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">موجز المشروع</span><textarea value={form.brief} onChange={event => setForm({ ...form, brief: event.target.value })} className="min-h-48 w-full rounded-xl border border-[#1B2736] bg-[#070A0F] p-4 outline-none" /></label><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">روابط مرجعية</span><textarea value={form.references} onChange={event => setForm({ ...form, references: event.target.value })} className="min-h-24 w-full rounded-xl border border-[#1B2736] bg-[#070A0F] p-4 outline-none" /></label></section><aside className="rounded-[1.5rem] border border-[#1B2736] bg-[#0A0E15] p-5"><h3 className="font-bold">عمق الجولة</h3>{['economy', 'balanced', 'deep'].map(mode => <button type="button" key={mode} onClick={() => setForm({ ...form, mode })} className={`mt-2 w-full rounded-xl border p-3 text-right ${form.mode === mode ? 'border-[#73E7FF]/40 bg-[#73E7FF]/[.07]' : 'border-[#1B2736]'}`}>{mode === 'economy' ? 'اقتصادي' : mode === 'deep' ? 'عميق' : 'متوازن'}</button>)}<button disabled={busy} className="mt-5 w-full rounded-xl bg-[#73E7FF] px-5 py-3 font-bold text-[#05070B] disabled:opacity-50">{busy ? 'جاري الإنشاء...' : 'إنشاء المشروع يدويًا'}</button></aside></div></form>}
  </div>;
}

function ProjectView({ project, statusLabel, busy, feedback, setFeedback, onRun, onFinalize, onApprove, onRevise, onConcept, onPreview, onExport, onDelete }: any) {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { if (project.progress !== 95) return; const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [project.progress]);
  const isDemo = project.id === 'demo'; const stalled = project.progress === 95 && clock - project.updatedAt >= 120000;
  const needsFinalize = !isDemo && project.agentOutputs.length === 9 && !project.synthesis && (project.status === 'running' || project.status === 'error');
  const previewUrl = project.previewPath ? new URL(project.previewPath, `${window.location.origin}/`).toString() : '';
  return <div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 xl:flex-row"><div><span className="rounded-full bg-[#73E7FF]/10 px-3 py-1 text-xs text-[#9AF0FF]">{statusLabel}</span><h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">{project.name}</h2><p className="mt-3 max-w-3xl text-[#768496]">{project.brief}</p></div><div className="flex flex-wrap gap-2">{!isDemo && <button onClick={onDelete} className="rounded-xl border border-[#1B2736] p-3 text-[#FF9CAF]"><Trash2 className="h-4 w-4" /></button>}<button onClick={onExport} disabled={!project.synthesis} className="rounded-xl border border-[#1B2736] px-4 py-3 text-sm disabled:opacity-30"><Download className="ml-2 inline h-4 w-4" />تصدير التقرير</button>{needsFinalize && <button onClick={onFinalize} disabled={busy || (project.progress === 95 && !stalled)} className="rounded-xl bg-[#FFD166] px-5 py-3 font-bold text-[#05070B]">{project.progress === 95 && !stalled ? 'يجري تجميع النتيجة' : 'استكمال النتيجة'}</button>}{!isDemo && <button onClick={onRun} disabled={busy || project.status === 'running'} className="rounded-xl bg-[#73E7FF] px-5 py-3 font-bold text-[#05070B] disabled:opacity-50"><Play className="ml-2 inline h-4 w-4" />{project.agentOutputs.length ? 'تشغيل جولة جديدة' : 'تشغيل الوكلاء'}</button>}</div></div>
    {project.managerBrief && <section className="mt-8 rounded-[2rem] border border-[#73E7FF]/20 bg-[#73E7FF]/[.035] p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><small className="font-bold tracking-[.16em] text-[#73E7FF]/70">موجز مدير نَسَق</small><h3 className="mt-2 text-2xl font-bold">من فكرة قصيرة إلى خطة تنفيذ كاملة</h3><p className="mt-3 max-w-3xl text-sm leading-7 text-[#9AAABA]">{project.managerBrief.summary}</p></div><div className="rounded-2xl border border-[#73E7FF]/15 bg-[#05070B]/60 px-5 py-4 text-center"><span className="text-xs text-white/35">هدف القبول</span><strong className="mt-1 block text-3xl text-[#73E7FF]">{project.acceptanceTarget || 85}/100</strong></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><Summary title="الجمهور" text={project.audience} /><Summary title="الهدف" text={project.goal} /><Summary title="الطابع البصري" text={project.style} /></div><div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{project.managerBrief.taskPlan.map((task: any, index: number) => <div key={task.agentId} className="rounded-xl border border-[#1B2736] bg-[#070A0F] p-3"><span className="text-[10px] text-[#73E7FF]">0{index + 1}</span><strong className="mr-2 text-xs">{task.agentName}</strong><p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/35">{task.task}</p></div>)}</div></section>}
    <section className="mt-8 rounded-[2rem] border border-[#2B3B4E] bg-gradient-to-br from-[#101925] to-[#080B11] p-6"><div className="flex items-start justify-between"><div><small className="font-bold tracking-[.18em] text-[#73E7FF]/70">LIVE DESIGN COUNCIL</small><h3 className="mt-2 text-2xl font-bold">{project.progress < 100 ? 'الوكلاء يعملون على مشروعك' : 'الجولة جاهزة للمراجعة'}</h3><p className="mt-2 text-sm text-[#768496]">{project.agentOutputs.length}/9 وكلاء أنهوا مخرجاتهم.</p></div><strong className="text-4xl text-[#73E7FF]">{project.progress}%</strong></div><div className="mt-6 h-2.5 overflow-hidden rounded-full bg-[#1B2736]"><div className="agent-scan h-full rounded-full bg-gradient-to-l from-[#73E7FF] to-[#9D8CFF]" style={{ width: `${project.progress}%` }} /></div>{project.progress === 95 && <p className="mt-4 rounded-xl border border-[#FFD166]/20 bg-[#FFD166]/[.055] p-3 text-xs text-[#FFE6A3]">{stalled ? 'توقف الدمج أكثر من دقيقتين؛ اضغط استكمال النتيجة.' : 'المنسق يدمج نتائج 9/9. المدة المعتادة 20–90 ثانية.'}</p>}</section>
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]"><section className="rounded-[1.75rem] border border-[#1B2736] bg-[#0A0E15] p-5"><h3 className="font-bold">تفسير الدرجة</h3><p className="mt-3 text-sm text-[#768496]">الدرجة ليست نسبة اكتمال؛ تجمع متوسط الثقة وعدد المخرجات التي اكتملت دون نتيجة احتياطية.</p><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Metric value={project.scoreBreakdown?.completeAgents ?? 0} label="سليم" /><Metric value={project.scoreBreakdown?.degradedAgents ?? 0} label="منخفض" /><Metric value={`${project.scoreBreakdown?.averageConfidence ?? 0}%`} label="الثقة" /></div></section><section className="rounded-[1.75rem] border border-[#1B2736] bg-[#0A0E15] p-5"><span className="text-xs text-white/30">الدرجة الحالية</span><div className="mt-3"><strong className="text-6xl text-[#73E7FF]">{project.score ?? '—'}</strong><span className="text-white/25">/100</span></div></section></div>
    <section className="mt-10"><h3 className="mb-5 text-2xl font-bold">مخرجات الوكلاء</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }).map((_, index) => { const agent = project.agentOutputs[index]; const Icon = icons[index]; return <article key={index} className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-5"><div className="flex justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#73E7FF]/10 text-[#73E7FF]"><Icon className="h-5 w-5" /></span><small className="text-white/20">0{index + 1}</small></div><h4 className="mt-5 font-bold">{agent?.name || 'بانتظار الدور'}</h4><p className="mt-1 text-xs text-white/25">{agent?.workshop || AGENTS[index][2]}</p>{agent && <><p className="mt-4 text-sm leading-6 text-[#768496]">{agent.summary}</p><div className="mt-4 flex justify-between border-t border-[#1B2736] pt-3 text-[10px]"><span className={agent.status === 'degraded' ? 'text-[#FF9CAF]' : 'text-[#6EF0BC]'}>{agent.status === 'degraded' ? 'يحتاج مراجعة' : 'مكتمل'}</span><span className="text-white/25">ثقة {agent.confidence}%</span></div></>}</article>; })}</div></section>
    {project.synthesis && <section className="mt-12"><small className="font-bold tracking-[.18em] text-[#73E7FF]/70">FINAL SYNTHESIS</small><h3 className="mt-2 text-3xl font-bold">القرار التصميمي النهائي</h3><div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="rounded-[2rem] border border-[#2B3B4E] bg-[#0A0E15] p-7"><p className="text-lg leading-8">{project.synthesis.executiveSummary}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><Summary title="التموضع" text={project.synthesis.positioning} /><Summary title="الاتجاه البصري" text={project.synthesis.designDirection} /></div></div><div className="rounded-[1.75rem] border border-[#1B2736] bg-[#0A0E15] p-5"><h4 className="font-bold">لوحة الاتجاه المرئي</h4>{project.conceptImageUrl ? <img src={project.conceptImageUrl} className="mt-4 aspect-video w-full rounded-xl object-cover" /> : <div className="mt-4 grid aspect-video place-items-center rounded-xl border border-dashed border-[#2B3B4E] text-xs text-white/20">لم تُولّد لوحة بعد</div>}{!isDemo && <button onClick={onConcept} disabled={busy} className="mt-4 w-full rounded-xl border border-[#2B3B4E] px-4 py-3 text-sm"><Palette className="ml-2 inline h-4 w-4" />توليد لوحة بصرية</button>}</div></div></section>}
    {project.synthesis && <section className="mt-12 overflow-hidden rounded-[2rem] border border-[#2B3B4E] bg-[#080B11]"><div className="flex flex-col justify-between gap-4 border-b border-[#1B2736] p-6 sm:flex-row"><div><h3 className="text-xl font-bold"><Monitor className="ml-2 inline h-5 w-5 text-[#73E7FF]" />معاينة الموقع الكاملة</h3><p className="mt-2 text-sm text-[#768496]">موقع متجاوب قابل للفتح والمشاركة، وليس صورة ثابتة.</p></div>{!previewUrl && !isDemo && <button onClick={onPreview} disabled={busy} className="rounded-xl bg-[#73E7FF] px-5 py-3 font-bold text-[#05070B]">بناء معاينة موقع كاملة</button>}</div>{previewUrl ? <><iframe src={previewUrl} title={`معاينة ${project.name}`} className="h-[620px] w-full bg-white" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation-by-user-activation" /><div className="flex flex-col gap-3 border-t border-[#1B2736] p-4 lg:flex-row"><input readOnly value={previewUrl} dir="ltr" className="min-w-0 flex-1 rounded-xl border border-[#1B2736] bg-[#0A0E15] px-4 py-3 text-xs text-white/40" /><button onClick={() => navigator.clipboard?.writeText(previewUrl)} className="rounded-xl border border-[#1B2736] px-4"><Copy className="h-4 w-4" /></button><button onClick={() => window.open(previewUrl, '_blank')} className="rounded-xl bg-[#73E7FF] px-5 py-3 font-bold text-[#05070B]"><ExternalLink className="ml-2 inline h-4 w-4" />فتح الرابط</button>{!isDemo && <button onClick={onPreview} className="rounded-xl border border-[#2B3B4E] px-5 py-3"><RefreshCw className="ml-2 inline h-4 w-4" />إعادة البناء</button>}</div></> : <div className="grid min-h-72 place-items-center text-center text-[#768496]">القرار جاهز، والمعاينة لم تُبنَ بعد.</div>}</section>}
    {(project.status === 'review' || project.status === 'needs_revision') && !isDemo && <section className="mt-10 rounded-[2rem] border border-[#FFD166]/20 bg-[#FFD166]/[.04] p-6"><h3 className="text-2xl font-bold">القرار بيدك.</h3><textarea value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="ملاحظات الاعتماد أو التعديل..." className="mt-4 min-h-28 w-full rounded-xl border border-[#2B3B4E] bg-[#070A0F] p-4" /><div className="mt-3 grid gap-3 sm:grid-cols-2"><button onClick={onRevise} className="rounded-xl border border-[#2B3B4E] px-5 py-3">طلب تعديلات</button><button onClick={onApprove} className="rounded-xl bg-[#FFD166] px-5 py-3 font-bold text-[#05070B]"><Check className="ml-2 inline h-4 w-4" />اعتماد وحفظ الذاكرة</button></div></section>}
    <section className="mt-10"><h3 className="mb-4 font-bold">سجل التشغيل</h3><div className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-5">{[...project.timeline].reverse().map((item: any, index: number) => <div key={`${item.at}-${index}`} className="mb-5 flex gap-4 last:mb-0"><span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#73E7FF]" /><div><strong className="text-sm">{item.label}</strong><p className="mt-1 text-xs text-[#768496]">{item.detail}</p><small className="text-white/20">{new Date(item.at).toLocaleString('ar-SA')}</small></div></div>)}</div></section>
  </div>;
}

function Metric({ value, label }: { value: string | number; label: string }) { return <div className="rounded-xl bg-[#73E7FF]/[.055] p-3"><strong className="block text-lg text-[#9AF0FF]">{value}</strong><span className="text-[9px] text-white/35">{label}</span></div>; }
function Summary({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-[#1B2736] p-4"><small className="text-white/30">{title}</small><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>; }
function Sources({ agents }: { agents: MethodAgent[] }) { const list = agents.length ? agents : AGENTS.map((a, i) => ({ id: a[0], name: a[1], title: 'مخرج متخصص', workshop: a[2], mission: 'تحويل منهج الورشة إلى وظيفة عملية داخل المنتج.' })); return <div className="mx-auto max-w-6xl"><h2 className="text-4xl font-extrabold">كيف تحولت ورش GitHub إلى منتج.</h2><p className="mt-4 text-[#768496]">كل ورشة أصبحت وظيفة حقيقية داخل الاستوديو.</p><div className="mt-9 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((agent, index) => { const Icon = icons[index] || Bot; return <article key={agent.id} className="rounded-2xl border border-[#1B2736] bg-[#0A0E15] p-6"><Icon className="h-5 w-5 text-[#73E7FF]" /><small className="mt-6 block text-[#9D8CFF]">{agent.workshop}</small><h3 className="mt-2 text-lg font-bold">{agent.name}</h3><p className="mt-4 text-sm text-[#768496]">{agent.mission}</p></article>; })}</div></div>; }

export default Studio;
