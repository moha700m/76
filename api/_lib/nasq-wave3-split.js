import { AgentBridgeError, CWC_AGENTS, extractResponseText, isRetryableStatus } from './nasq-agent-bridge.js';

const DEFAULT_MODEL = 'gpt-5-mini';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function array(value, maxItems = 8) {
  return Array.isArray(value) ? value.slice(0, maxItems) : [];
}

function normalizeProject(value) {
  const project = value && typeof value === 'object' ? value : {};
  const normalized = {
    name: text(project.name, 160),
    brief: text(project.brief, 7000),
    audience: text(project.audience, 900),
    goal: text(project.goal, 900),
    style: text(project.style, 900),
    feedback: text(project.feedback, 2000),
    references: array(project.references, 5).map(item => text(item, 500)).filter(Boolean),
    evidence: array(project.evidence, 3).map(item => ({
      title: text(item?.title, 300),
      excerpt: text(item?.excerpt ?? item?.text, 3000)
    })).filter(item => item.title || item.excerpt),
    memories: array(project.memories, 8).map(item => ({
      title: text(item?.title, 300),
      content: text(item?.content, 2200)
    })).filter(item => item.title || item.content)
  };
  if (!normalized.name || normalized.brief.length < 8) {
    throw new AgentBridgeError('اسم المشروع والموجز مطلوبان', { code: 'invalid_project', status: 400 });
  }
  return normalized;
}

function normalizePrevious(value, expected) {
  const outputs = array(value, 9).map(item => ({
    agentId: text(item?.agentId, 80),
    name: text(item?.name, 120),
    summary: text(item?.summary, 850),
    findings: array(item?.findings, 4).map(entry => text(entry, 420)),
    decisions: array(item?.decisions, 3).map(entry => text(entry, 420)),
    deliverable: text(item?.deliverable, 850),
    confidence: Math.max(0, Math.min(100, Number(item?.confidence) || 0))
  }));
  if (outputs.length !== expected) {
    throw new AgentBridgeError(`الطلب يتطلب ${expected} مخرجات سابقة`, { code: 'invalid_previous_outputs', status: 409 });
  }
  return outputs;
}

function normalizeMode(value) {
  return value === 'deep' ? 'deep' : value === 'economy' ? 'economy' : 'balanced';
}

export function validateWave3Request(body) {
  if (!body || typeof body !== 'object') {
    throw new AgentBridgeError('جسم الطلب غير صالح', { code: 'invalid_request', status: 400 });
  }
  return {
    project: normalizeProject(body.project),
    previousOutputs: normalizePrevious(body.previousOutputs, 6),
    mode: normalizeMode(body.mode),
    requestId: text(body.requestId, 200) || 'wave-3-agents'
  };
}

export function validateSynthesisRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new AgentBridgeError('جسم الطلب غير صالح', { code: 'invalid_request', status: 400 });
  }
  return {
    project: normalizeProject(body.project),
    previousOutputs: normalizePrevious(body.previousOutputs, 9),
    mode: normalizeMode(body.mode),
    requestId: text(body.requestId, 200) || 'final-synthesis'
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
          eyebrow: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          primaryCta: { type: 'string' },
          secondaryCta: { type: 'string' }
        },
        required: ['eyebrow', 'title', 'body', 'primaryCta', 'secondaryCta']
      },
      visualMotif: { type: 'string' },
      sections: {
        type: 'array',
        minItems: 5,
        maxItems: 7,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kicker: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            items: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } }
          },
          required: ['kicker', 'title', 'body', 'items']
        }
      },
      closing: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          cta: { type: 'string' }
        },
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
        type: 'array',
        minItems: 4,
        maxItems: 7,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            purpose: { type: 'string' },
            sections: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } }
          },
          required: ['name', 'purpose', 'sections']
        }
      },
      designSystem: {
        type: 'object',
        additionalProperties: false,
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

function compactProjectInput(payload, maxLength) {
  return JSON.stringify({
    project: payload.project,
    priorAgents: payload.previousOutputs.map(item => ({
      agentId: item.agentId,
      summary: item.summary,
      findings: item.findings.slice(0, 3),
      decisions: item.decisions.slice(0, 3),
      deliverable: item.deliverable
    }))
  }).slice(0, maxLength);
}

function wave3Prompt(payload) {
  const roles = CWC_AGENTS.slice(6, 9);
  return {
    roles,
    system: [
      'أنت الموجة الثالثة من مجلس CWC العربي لبناء منتجات ومواقع حقيقية.',
      'نفّذ الأدوار الثلاثة المحددة باستقلالية: الكفاءة، الجودة، والنقد المنافس.',
      'ابنِ قراراتك على المشروع ومخرجات الوكلاء الستة السابقة.',
      'لا تنشئ التجميع النهائي ولا محتوى الموقع في هذا الطلب؛ أعد فقط مخرجات الوكلاء الثلاثة.',
      'لا تكرر كلام المستخدم حرفيًا، ولا تخترع أرقامًا أو شهادات أو أسعارًا أو وسائل تواصل.',
      'لا تنشئ نتيجة وهمية أو تعافيًا مصطنعًا.'
    ].join('\n'),
    user: JSON.stringify({
      wave: 3,
      waveName: 'الموجة الثالثة: الكفاءة والجودة والنقد',
      roles,
      data: JSON.parse(compactProjectInput(payload, 18000))
    })
  };
}

function synthesisPrompt(payload) {
  return {
    system: [
      'أنت المنسق النهائي لمجلس CWC العربي.',
      'اجمع مخرجات الوكلاء التسعة في خطة تنفيذ واحدة متماسكة ومحددة للمشروع.',
      'publicContent هو النص الوحيد المسموح بعرضه لعميل الموقع.',
      'اكتب محتوى تسويقيًا عربيًا جديدًا ومحددًا للقطاع، ولا تذكر الموجز أو الجمهور المستهدف أو الطابع البصري أو الوكلاء أو Mobile First أو التصميم أو المعاينة.',
      'لا تخترع أسعارًا أو أرقامًا أو شهادات أو بيانات تواصل غير موجودة.',
      'التزم بالمخطط واختصر دون فقد القرارات الأساسية.'
    ].join('\n'),
    user: JSON.stringify({
      task: 'final-synthesis',
      data: JSON.parse(compactProjectInput(payload, 22000))
    })
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after') || 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(12000, retryAfter * 1000);
  return [900, 2200, 4500][attempt] || 4500;
}

async function requestStructured(options) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AgentBridgeError('OPENAI_API_KEY غير مضبوط', { code: 'openai_not_configured', status: 503 });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleepImpl = options.sleepImpl || sleep;
  if (typeof fetchImpl !== 'function') throw new AgentBridgeError('fetch غير متوفر', { code: 'runtime_fetch_unavailable', status: 500 });

  const requestBody = {
    model: options.model || process.env.OPENAI_AGENT_MODEL || DEFAULT_MODEL,
    store: false,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: options.system }] },
      { role: 'user', content: [{ type: 'input_text', text: options.user }] }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: options.schemaName,
        strict: true,
        schema: options.schema
      },
      verbosity: 'low'
    },
    reasoning: { effort: options.reasoningEffort || 'low' },
    max_output_tokens: options.maxOutputTokens
  };

  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetchImpl(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'x-client-request-id': options.requestId
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const status = Number(response.status || 0);
        const retryable = isRetryableStatus(status);
        const responseText = await response.text().catch(() => '');
        lastError = new AgentBridgeError(
          status === 429 ? 'معدل استخدام OpenAI مرتفع مؤقتًا' : `فشل مزود الذكاء بالحالة ${status || 'غير معروفة'}`,
          {
            code: status === 429 ? 'openai_rate_limited' : 'openai_request_failed',
            status: status === 429 ? 429 : 502,
            retryable,
            providerStatus: status
          }
        );
        lastError.providerBodyLength = responseText.length;
        if (retryable && attempt < 3) {
          await sleepImpl(retryDelay(response, attempt));
          continue;
        }
        throw lastError;
      }
      const data = await response.json();
      return {
        parsed: JSON.parse(extractResponseText(data)),
        model: requestBody.model,
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
          await sleepImpl([900, 2200, 4500][attempt] || 4500);
          continue;
        }
        if (!error.retryable || attempt === 3) throw error;
      } else {
        lastError = new AgentBridgeError('تعذر الاتصال بمزود الذكاء', { code: 'openai_network_error', status: 502, retryable: true });
        if (attempt < 3) {
          await sleepImpl([900, 2200, 4500][attempt] || 4500);
          continue;
        }
      }
    }
  }
  throw lastError || new AgentBridgeError('تعذر إكمال الطلب', { status: 502, retryable: true });
}

function normalizeWave3Outputs(raw, roles, elapsedMs) {
  const outputs = Array.isArray(raw) ? raw : [];
  if (outputs.length !== roles.length) {
    throw new AgentBridgeError('عدد مخرجات الموجة الثالثة غير مكتمل', { code: 'invalid_provider_output', status: 502, retryable: true });
  }
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
      summary: text(item.summary, 1600),
      findings: item.findings.map(value => text(value, 700)).filter(Boolean).slice(0, 5),
      decisions: item.decisions.map(value => text(value, 700)).filter(Boolean).slice(0, 4),
      deliverable: text(item.deliverable, 1800),
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

export async function callOpenAIWave3(payload, options = {}) {
  const prompt = wave3Prompt(payload);
  const startedAt = Date.now();
  const result = await requestStructured({
    ...options,
    requestId: payload.requestId,
    system: prompt.system,
    user: prompt.user,
    schemaName: 'nasq_cwc_wave_3_agents',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        outputs: { type: 'array', minItems: 3, maxItems: 3, items: outputItemSchema() }
      },
      required: ['outputs']
    },
    maxOutputTokens: 3000,
    reasoningEffort: payload.mode === 'deep' ? 'medium' : 'low'
  });
  return {
    outputs: normalizeWave3Outputs(result.parsed.outputs, prompt.roles, Date.now() - startedAt),
    model: result.model,
    usage: result.usage
  };
}

export async function callOpenAISynthesis(payload, options = {}) {
  const prompt = synthesisPrompt(payload);
  const result = await requestStructured({
    ...options,
    requestId: payload.requestId,
    system: prompt.system,
    user: prompt.user,
    schemaName: 'nasq_cwc_final_synthesis',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { synthesis: synthesisSchema() },
      required: ['synthesis']
    },
    maxOutputTokens: 4200,
    reasoningEffort: 'low'
  });
  return {
    synthesis: validateSynthesis(result.parsed.synthesis),
    model: result.model,
    usage: result.usage
  };
}
