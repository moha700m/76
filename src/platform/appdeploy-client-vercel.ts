export type AuthUser = { userId?: string; name?: string; email?: string };

export type WsConnection = {
  connectionId: string | null;
  ready: Promise<void>;
  onMessage(callback: (message: unknown) => void): void;
  onOpen(callback: () => void): void;
  onClose(callback: () => void): void;
  onError(callback: (error: unknown) => void): void;
  disconnect(): void;
};

const APPDEPLOY_STUDIO_URL = 'https://441a4987f6936b832e.v2.appdeploy.ai/';

const methodology = [
  { id: 'brief-analyst', name: 'محلل الموجز', title: 'محلل المتطلبات', workshop: 'How We Claude Code', mission: 'يحوّل فكرة المشروع إلى متطلبات واضحة قابلة للتنفيذ.' },
  { id: 'evidence-researcher', name: 'باحث الأدلة', title: 'باحث السوق', workshop: 'Research Desk', mission: 'يجمع الأدلة والمراجع ويستخرج الأنماط المفيدة.' },
  { id: 'product-strategist', name: 'استراتيجي المنتج', title: 'استراتيجي المنتج', workshop: 'Agent Decomposition', mission: 'يرتب الأولويات ويحدد القيمة والمسار الرئيسي.' },
  { id: 'memory-curator', name: 'أمين ذاكرة العلامة', title: 'أمين الذاكرة', workshop: 'Agents That Remember', mission: 'يحافظ على القرارات المعتمدة واتساق العلامة.' },
  { id: 'ux-architect', name: 'معماري تجربة المستخدم', title: 'معماري UX', workshop: 'Production-Ready Agent', mission: 'يبني رحلة المستخدم وهيكل الصفحات.' },
  { id: 'ui-director', name: 'مخرج الواجهة', title: 'مخرج UI', workshop: 'Ship Your First Managed Agent', mission: 'يحدد الاتجاه البصري والمكوّنات.' },
  { id: 'efficiency-router', name: 'مهندس الكفاءة', title: 'مهندس النماذج', workshop: 'Picking the Right Model', mission: 'يوجه كل مهمة للنموذج المناسب بأقل تكلفة.' },
  { id: 'quality-evaluator', name: 'مراجع الجودة', title: 'مراجع الجودة', workshop: 'Eval-Driven Agent Development', mission: 'يفحص النتيجة وفق معايير قابلة للقياس.' },
  { id: 'challenger', name: 'الناقد المنافس', title: 'الناقد المنافس', workshop: 'Agent Battle', mission: 'يتحدى القرارات ويكشف نقاط الضعف قبل التسليم.' }
];

function redirectToAppDeploy(): never {
  const target = new URL(APPDEPLOY_STUDIO_URL);
  target.searchParams.set('start', '1');
  window.location.assign(target.toString());
  throw new Error('redirecting_to_appdeploy');
}

export const api = {
  async get(path: string): Promise<{ data: any }> {
    if (path === '/api/methodology') return { data: { agents: methodology } };
    throw new Error('هذا المسار يعمل داخل استوديو AppDeploy فقط.');
  },
  async post(): Promise<{ data: any }> {
    throw new Error('هذا المسار يعمل داخل استوديو AppDeploy فقط.');
  },
  async delete(): Promise<{ data: any }> {
    throw new Error('هذا المسار يعمل داخل استوديو AppDeploy فقط.');
  }
};

export const auth = {
  async getUser(): Promise<AuthUser | null> { return null; },
  async signIn(): Promise<{ user: AuthUser }> { return redirectToAppDeploy(); },
  async signOut(): Promise<void> { return; }
};

export const ws = {
  connect(): WsConnection {
    return {
      connectionId: null,
      ready: Promise.resolve(),
      onMessage() { return; },
      onOpen(callback) { queueMicrotask(callback); },
      onClose() { return; },
      onError() { return; },
      disconnect() { return; }
    };
  }
};
