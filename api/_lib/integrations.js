const DEFAULT_GITHUB_REPOSITORY = 'moha700m/76';
const DEFAULT_OPENAI_MODEL = 'gpt-5-nano';

function cleanText(value, maxLength = 300) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

async function responseDetail(response) {
  try {
    const payload = await response.json();
    return cleanText(payload?.error?.message || payload?.message || response.statusText);
  } catch {
    try { return cleanText(await response.text()); }
    catch { return cleanText(response.statusText); }
  }
}

export function getGitHubToken(env = process.env) {
  return String(env.GH_PAT || env.GITHUB_DISPATCH_TOKEN || '');
}

export function getGitHubRepository(env = process.env) {
  return String(env.GITHUB_REPOSITORY || DEFAULT_GITHUB_REPOSITORY);
}

export function getOpenAIModel(env = process.env) {
  return String(env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
}

export async function checkGitHubConnection(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const token = getGitHubToken(env);
  const repository = getGitHubRepository(env);
  if (!token) return { configured: false, connected: false };

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'nasq-ai-server'
      }
    });
    if (!response.ok) {
      return {
        configured: true,
        connected: false,
        status: response.status,
        detail: await responseDetail(response)
      };
    }
    const data = await response.json();
    return {
      configured: true,
      connected: true,
      repository: data.full_name || repository,
      defaultBranch: data.default_branch || null,
      canRead: Boolean(data.permissions?.pull ?? true),
      canWrite: Boolean(data.permissions?.push)
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      status: 0,
      detail: cleanText(error instanceof Error ? error.message : error)
    };
  }
}

export async function checkOpenAIConnection(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const apiKey = String(env.OPENAI_API_KEY || '');
  const model = getOpenAIModel(env);
  if (!apiKey) return { configured: false, connected: false, model };

  try {
    const response = await fetchImpl('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        'user-agent': 'nasq-ai-server'
      }
    });
    if (!response.ok) {
      return {
        configured: true,
        connected: false,
        model,
        status: response.status,
        detail: await responseDetail(response)
      };
    }
    const data = await response.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    return {
      configured: true,
      connected: true,
      model,
      modelAvailable: models.some(item => item?.id === model)
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      model,
      status: 0,
      detail: cleanText(error instanceof Error ? error.message : error)
    };
  }
}

export async function createOpenAIBrief(input, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const apiKey = String(env.OPENAI_API_KEY || '');
  const model = getOpenAIModel(env);
  if (!apiKey) throw new Error('openai_not_configured');

  const brief = cleanText(input, 6000);
  if (brief.length < 10) throw new Error('brief_too_short');

  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': 'nasq-ai-server'
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 350,
      input: [
        {
          role: 'system',
          content: [{
            type: 'input_text',
            text: 'أنت محرر موجز مشاريع سعودي. حسّن النص دون اختراع معلومات. أعد موجزًا عربيًا واضحًا ومختصرًا يتضمن الهدف والجمهور والنتيجة المطلوبة ونبرة التصميم.'
          }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: brief }]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await responseDetail(response);
    throw new Error(`openai_request_failed_${response.status}:${detail}`);
  }

  const data = await response.json();
  const outputText = cleanText(
    data?.output_text ||
    data?.output?.flatMap(item => item?.content || []).find(item => item?.type === 'output_text')?.text,
    4000
  );
  if (!outputText) throw new Error('openai_empty_response');
  return { text: outputText, model };
}
