import { timingSafeEqual } from 'node:crypto';
import { json, methodNotAllowed, readJson } from './_lib/http.js';
import { consumeRateLimit } from './_lib/rate-limit.js';
import { AgentBridgeError } from './_lib/nasq-agent-bridge.js';
import { callOpenAISynthesis, validateSynthesisRequest } from './_lib/nasq-wave3-split.js';

export const config = { maxDuration: 60 };

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearer(req) {
  const auth = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return auth || String(req.headers?.['x-nasq-agent-secret'] || '').trim();
}

function authorized(req) {
  const expected = process.env.NASQ_AGENT_BRIDGE_SECRET;
  return Boolean(expected) && safeEqual(bearer(req), expected);
}

export default async function handler(req, res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'nasq-agent-synthesis',
      authenticated: authorized(req),
      configured: authorized(req) ? Boolean(process.env.OPENAI_API_KEY && process.env.NASQ_AGENT_BRIDGE_SECRET) : undefined
    });
  }
  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  if (!process.env.NASQ_AGENT_BRIDGE_SECRET) return json(res, 503, { error: 'bridge_not_configured' });
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
  if (!consumeRateLimit(req, res, { scope: 'nasq-agent-synthesis', max: 30, windowMs: 60_000 })) {
    return json(res, 429, { error: 'rate_limited', retryable: true });
  }

  try {
    const body = await readJson(req, { maxBytes: 750_000 });
    const payload = validateSynthesisRequest(body);
    const result = await callOpenAISynthesis(payload);
    return json(res, 200, {
      ok: true,
      synthesis: result.synthesis,
      model: result.model,
      usage: result.usage
    });
  } catch (error) {
    if (error instanceof AgentBridgeError) {
      return json(res, error.status, {
        error: error.code,
        message: error.message,
        retryable: error.retryable,
        providerStatus: error.providerStatus || undefined
      });
    }
    console.error('nasq_agent_synthesis_unexpected', error instanceof Error ? error.name : 'unknown');
    return json(res, 500, { error: 'internal_error', message: 'تعذر إنشاء التجميع النهائي', retryable: false });
  }
}
