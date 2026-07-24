const DEFAULT_MODEL = 'gpt-5-mini';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export const CWC_AGENTS = [
  { id: 'brief-analyst', name: 'محلل الموجز', title: 'تحويل الطلب إلى مواصفات قابلة للتحقق', workshop: 'How We Claude Code', mission: 'حلّل الموجز، اكشف الغموض والتعارضات، وحدد نطاق المنتج ومعايير نجاح واضحة قابلة للقياس.' },
  { id: 'evidence-researcher', name: 'باحث الأدلة', title: 'السوق والمنافسون والمراجع', workshop: 'Research Desk', mission: 'استخرج أنماط السوق واحتياجات الجمهور من الموجز والأدلة المرجعية، وافصل الحقائق عن الافتراضات.' },
  { id: 'product-strategist', name: 'استراتيجي المنتج', title: 'التموضع والقيمة والأولويات', workshop: 'Agent Decomposition', mission: 'قسّم المشكلة إلى أهداف وتجارب ووحدات، وحدد الوعد الأساسي والأولويات وما يجب استبعاده من الإصدار الأول.' },
  { id: 'memory-curator', name: 'أمين ذاكرة العلامة', title: 'استرجاع القرارات السابقة ومنع التكرار', workshop: 'Agents That Remember', mission: 'حوّل الذاكرة والقرارات السابقة إلى قواعد تصميم ونبرة ومخاطر يجب تذكرها.' },
  { id: 'ux-architect', name: 'معماري تجربة المستخدم', title: 'الرحلات والبنية والتدفقات', workshop: 'Production-Ready Agent', mission: 'صمّم رحلة المستخدم وبنية المعلومات والحالات الحرجة وبوابات المراجعة البشرية.' },
  { id: 'ui-director', name: 'مخرج الواجهة', title: 'النظام البصري والمكوّنات', workshop: 'Ship Your First Managed Agent', mission: 'حوّل الاستراتيجية إلى اتجاه واجهة قابل للتنفيذ: تخطيط وتسلسل بصري ومكوّنات وألوان وخط وحركة.' },
  { id: 'efficiency-router', name: 'مهندس الكفاءة', title: 'اختيار عمق التنفيذ وموازنة التكلفة', workshop: 'Picking the Right Model', mission: 'حدّد أين نحتاج عمقًا أكبر وأين تكفي حلول بسيطة مع الحفاظ على الجودة والسرعة والتكلفة.' },
  { id: 'quality-evaluator', name: 'مراجع الجودة', title: 'التقييم وإمكانية الوصول والأداء', workshop: 'Eval-Driven Agent Development', mission: 'أنشئ scorecard وافحص الوصول والتباين والجوال والأداء والاتساق وحالات الخطأ واختبارات القبول.' },
  { id: 'challenger', name: 'الناقد المنافس', title: 'كسر الحل قبل أن يكسره السوق', workshop: 'Agent Battle', mission: 'هاجم الخطة كمنافس وكمستخدم متردد، وحدد نقاط الفشل والبدائل الأقوى والتوصيات الحاسمة.' }
];

const MAX_TEXT = {
  name: 160,
  brief: 7000,
  audience: 900,
  goal: 900,
  style: 900,
  feedback: 2000,
  evidence: 5000,
  memory: 3500,
  prior: 12000
};

export class AgentBridgeError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AgentBridgeError';
    this.code = options.code || 'agent_bridge_error';
    this.status = Number(options.status || 500);
    this.retryable = Boolean(options.retryable);
    this.providerStatus = Number(options.providerStatus || 0);
  }
}

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function array(value, maxItems = 8) {
  return Array.isArray(value) ? value.slice(0, maxItems) : [];
}

export function validateWaveRequest(body) {
  if (!body || typeof body !== 'object') throw new AgentBridgeError('جسم الطلب غير صالح', { code: 'invalid_request', status: 400 });
  const wave = Number(body.wave);
  if (![1, 2, 3].includes(wave)) throw new AgentBridgeError('رقم الموجة يجب أن يكون بين 1 و3', { code: 'invalid_wave', status: 400 });
  const project = body.project && typeof body.project === 'object' ? body.project : {};
  const normalized = {
    name: text(project.name, MAX_TEXT.name),
    brief: text(project.brief, MAX_TEXT.brief),
    audience: text(project.audience, MAX_TEXT.audience),
    goal: text(project.goal, MAX_TEXT.goal),
    style: text(project.style, MAX_TEXT.style),
    feedback: text(project.feedback, MAX_TEXT.feedback),
    references: array(project.references, 5).map(value => text(value, 500)).filter(Boolean),
    evidence: array(project.evidence, 3).map(item => ({
      title: text(item?.title, 300),
      excerpt: text(item?.excerpt ?? item?.text, MAX_TEXT.evidence)
    })).filter(item => item.title || item.excerpt),
    memories: array(project.memories, 8).map(item => ({
      title: text(item?.title, 300),
      content: text(item?.content, MAX_TEXT.memory)
    })).filter(item => item.title || item.content)
  };
  if (!normalized.name || normalized.brief.length < 8) {
    throw new AgentBridgeError('اسم المشروع والموجز مطلوبان', { code: 'invalid_project', status: 400 });
  }
  const previousOutputs = array(body.previousOutputs, 9).map(item => ({
    agentId: text(item?.agentId, 80),
    name: text(item?.name, 120),
    summary: text(item?.summary, 1000),
    findings: array(item?.findings, 5).map(value => text(value, 600)),
    decisions: array(item?.decisions, 4).map(value => text(value, 600)),
    deliverable: text(item?.deliverable, 1200),
    confidence: Math.max(0, Math.min(100, Number(item?.confidence) || 0))
  }));
  const expectedPrevious = (wave - 1) * 3;
  if (previousOutputs.length !== expectedPrevious) {
    throw new AgentBridgeError(`الموجة ${wave} تتطلب ${expectedPrevious} مخرجات سابقة`, { code: 'invalid_previous_outputs', status: 409 });
  }
  return {
    wave,
    project: normalized,
    previousOutputs,
    mode: body.mode === 'deep' ? 'deep' : body.mode === 'economy' ? 'economy' : 'balanced',
    requestId: text(body.requestId, 200) || `wave-${wave}`
  };
}

function outputItemSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      agentId: { type: 'string' },
      summary: { type: 'string' },
      findings: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
      decisions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
      deliverable: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 100 }
    },
    required: ['agentId', 'summary', 'findings', 'decisions', 'deliverable', 'confidence']
  };
}

function publicContentSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      brandName: { type: 'string' },
      navigation: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
      hero: {
        type: 'object',
        additionalProperties: false,
        properties: {
          eyebrow: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' },
          primaryCta: { type: 'string' }, secondaryCta: { type: 'string' }
        },
        required: ['eyebrow', 'title', 'body', 'primaryCta', 'secondaryCta']
      },
      visualMotif: { type: 'string' },
      sections: {
        type: 'array', minItems: 5, maxItems: 7,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            kicker: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' },
            items: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } }
          },
          required: ['kicker', 'title', 'body', 'items']
        }
      },
      closing: {
        type: 'object', additionalProperties: false,
        properties: { title: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' } },
        required: ['title', 'body', 'cta']
      },
      footerLine: { type: 'string' }
    },
    required: ['brandName', 'navigation', 'hero', 'visualMotif', 'sections', 'closing', 'footerLine']
  };
}

function synthesisSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      executiveSummary: { type: 'string' },
      positioning: { type: 'string' },
      designDirection: { type: 'string' },
      primaryJourney: { type: 'array', minItems: 4, maxItems: 7, items: { type: 'string' } },
      pages: {
        type: 'array', minItems: 4, maxItems: 7,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            name: { type: 'string' }, purpose: { type: 'string' },
            sections: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } }
          },
          required: ['name', 'purpose', 'sections']
        }
      },
      designSystem: {
        type: 'object', additionalProperties: false,
        properties: {
          palette: { type: 'array', minItems: 5, maxItems: 6, items: { type: 'string' } },
          typography: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
          components: { type: 'array', minItems: 6, maxItems: 12, items: { type: 'string' } },
          motion: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } }
        },
        required: ['palette', 'typography', 'components', 'motion']
      },
      conversionPlan: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } },
      risks: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
      acceptanceCriteria: { type: 'array', minItems: 6, maxItems: 10, items: { type: 'string' } },
      nextActions: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } },
      publicContent: publicContentSchema()
    },
    required: ['executiveSummary', 'positioning', 'designDirection', 'primaryJourney', 'pages', 'designSystem', 'conversionPlan', 'risks', 'acceptanceCriteria', 'nextActions', 'publicContent']
  };
}

export function responseSchemaForWave(wave) {
  const properties = {
    outputs: { type: 'array', minItems: 3, maxItems: 3, items: outputItemSchema() }
  };
  const required = ['outputs'];
  if (wave === 3) {
    properties.synthesis = synthesisSchema();
    required.push('synthesis');
  }
  return { type: 'object', additionalProperties: false, properties, required };
}

function compactInput(payload) {
  return JSON.stringify({
    project: payload.project,
    priorAgents: payload.previousOutputs.map(item => ({
      agentId: item.agentId,
      summary: item.summary,
      findings: item.findings.slice(0, 3),
      decisions: item.decisions.slice(0, 3),
      deliverable: item.deliverable
    }))
  }).slice(0, 28000);
}

export function createWavePrompt(payload) {
  const start = (payload.wave - 1) * 3;
  const roles = CWC_AGENTS.slice(start, start + 3);
  const waveName = payload.wave === 1
    ? 'الموجة الأولى: المتطلبات والبحث والاستراتيجية'
    : payload.wave === 2
      ? 'الموجة الثانية: الذاكرة وتجربة المستخدم والواجهة'
      : 'الموجة الثالثة: الكفاءة والجودة والنقد والتجميع النهائي';
  const system = [
    'أنت مجلس CWC عربي محترف لبناء منتجات ومواقع حقيقية.',
    'نفّذ الأدوار الثلاثة المحددة باستقلالية، ثم اجعل قرارات كل دور مبنية على المشروع ومخرجات الموجات السابقة.',
    'هذه مخرجات داخلية لفريق التنفيذ؛ لا تكرر كلام المستخدم حرفيًا ولا تخترع أرقامًا أو شهادات أو أسعارًا أو وسائل تواصل.',
    'لا تنشئ مخرج تعافٍ أو نتيجة وهمية. إذا لم تستطع الالتزام، ارفض الطلب بدل الادعاء بالاكتمال.',
    payload.wave === 3
      ? 'في synthesis اجمع الأدوار التسعة. publicContent هو النص الوحيد المسموح بعرضه للعميل: اكتب محتوى تسويقيًا عربيًا جديدًا ومحددًا للقطاع، ولا تذكر الموجز أو الجمهور المستهدف أو الطابع البصري أو الوكلاء أو Mobile First أو التصميم أو المعاينة.'
      : 'لا تنشئ نصوص موقع نهائية في هذه الموجة؛ ركز على التحليل والقرارات والتسليمات.'
  ].join('\n');
  const user = JSON.stringify({
    wave: payload.wave,
    waveName,
    mode: payload.mode,
    roles,
    data: JSON.parse(compactInput(payload))
  });
  return { system, user, roles };
}

export function extractResponseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) return part.text.trim();
      if (part?.type === 'refusal') throw new AgentBridgeError('رفض مزود الذكاء إنشاء الموجة', { code: 'provider_refusal', status: 422 });
    }
  }
  throw new AgentBridgeError('لم يُرجع مزود الذكاء مخرجًا نصيًا', { code: 'provider_empty_output', status: 502, retryable: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after') || 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(15000, retryAfter * 1000);
  return [1200, 3000, 6500][attempt] || 6500;
}

export function isRetryableStatus(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function normalizeOutputs(raw, roles, elapsedMs) {
  const outputs = Array.isArray(raw) ? raw : [];
  if (outputs.length !== roles.length) throw new AgentBridgeError('عدد مخرجات الموجة غير مكتمل', { code: 'invalid_provider_output', status: 502, retryable: true });
  return roles.map((role, index) => {
    const item = outputs.find(value => value?.agentId === role.id) || outputs[index];
    if (!item || item.agentId !== role.id || !item.summary || !item.deliverable || !Array.isArray(item.findings) || !Array.isArray(item.decisions)) {
      throw new AgentBridgeError(`مخرج ${role.name} غير صالح`, { code: 'invalid_provider_output', status: 502, retryable: true });
    }
    return {
      agentId: role.id,
      name: role.name,
      title: role.title,
      workshop: role.workshop,
      status: 'complete',
      summary: text(item.summary, 1800),
      findings: item.findings.map(value => text(value, 900)).filter(Boolean).slice(0, 5),
      decisions: item.decisions.map(value => text(value, 900)).filter(Boolean).slice(0, 4),
      deliverable: text(item.deliverable, 2200),
      confidence: Math.max(55, Math.min(98, Number(item.confidence) || 75)),
      elapsedMs
    };
  });
}

function validateSynthesis(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.pages) || value.pages.length < 4) {
    throw new AgentBridgeError('التجميع النهائي غير مكتمل', { code: 'invalid_provider_output', status: 502, retryable: true });
  }
  if (!value.publicContent || !Array.isArray(value.publicContent.sections) || value.publicContent.sections.length < 5) {
    throw new AgentBridgeError('محتوى الموقع العام غير مكتمل', { code: 'invalid_public_content', status: 502, retryable: true });
  }
  return value;
}

export async function callOpenAIWave(payload, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AgentBridgeError('OPENAI_API_KEY غير مضبوط', { code: 'openai_not_configured', status: 503 });
  const model = options.model || process.env.OPENAI_AGENT_MODEL || DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleepImpl = options.sleepImpl || sleep;
  if (typeof fetchImpl !== 'function') throw new AgentBridgeError('fetch غير متوفر', { code: 'runtime_fetch_unavailable', status: 500 });
  const prompt = createWavePrompt(payload);
  const requestBody = {
    model,
    store: false,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: prompt.system }] },
      { role: 'user', content: [{ type: 'input_text', text: prompt.user }] }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: `nasq_cwc_wave_${payload.wave}`,
        strict: true,
        schema: responseSchemaForWave(payload.wave)
      },
      verbosity: payload.mode === 'economy' ? 'low' : 'medium'
    },
    reasoning: { effort: payload.mode === 'deep' ? 'medium' : 'low' },
    max_output_tokens: payload.wave === 3 ? 6500 : 3200
  };

  let lastError;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetchImpl(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'x-client-request-id': payload.requestId
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const status = Number(response.status || 0);
        const retryable = isRetryableStatus(status);
        const errorBody = await response.text().catch(() => '');
        lastError = new AgentBridgeError(
          status === 429 ? 'معدل استخدام OpenAI مرتفع مؤقتًا' : `فشل مزود الذكاء بالحالة ${status || 'غير معروفة'}`,
          { code: status === 429 ? 'openai_rate_limited' : 'openai_request_failed', status: status === 429 ? 429 : 502, retryable, providerStatus: status }
        );
        // لا نطبع جسم الاستجابة لأنه قد يحتوي تفاصيل غير لازمة. نحتفظ بطوله فقط للتشخيص.
        lastError.providerBodyLength = errorBody.length;
        if (retryable && attempt < 3) {
          await sleepImpl(retryDelay(response, attempt));
          continue;
        }
        throw lastError;
      }
      const data = await response.json();
      const parsed = JSON.parse(extractResponseText(data));
      const elapsedMs = Date.now() - startedAt;
      const outputs = normalizeOutputs(parsed.outputs, prompt.roles, elapsedMs);
      const synthesis = payload.wave === 3 ? validateSynthesis(parsed.synthesis) : undefined;
      return {
        outputs,
        synthesis,
        model,
        usage: data.usage ? {
          inputTokens: Number(data.usage.input_tokens || 0),
          outputTokens: Number(data.usage.output_tokens || 0),
          totalTokens: Number(data.usage.total_tokens || 0)
        } : undefined
      };
    } catch (error) {
      if (error instanceof AgentBridgeError) {
        lastError = error;
        if (error.retryable && attempt < 3 && !error.providerStatus) {
          await sleepImpl([1200, 3000, 6500][attempt] || 6500);
          continue;
        }
        if (!error.retryable || attempt === 3) throw error;
      } else {
        lastError = new AgentBridgeError('تعذر الاتصال بمزود الذكاء', { code: 'openai_network_error', status: 502, retryable: true });
        if (attempt < 3) {
          await sleepImpl([1200, 3000, 6500][attempt] || 6500);
          continue;
        }
      }
    }
  }
  throw lastError || new AgentBridgeError('تعذر إكمال الموجة', { status: 502, retryable: true });
}
