import { timingSafeEqual } from 'node:crypto';
import { json, methodNotAllowed, readJson } from './_lib/http.js';
import { consumeRateLimit } from './_lib/rate-limit.js';
import { AgentBridgeError, callOpenAIWave, validateWaveRequest } from './_lib/nasq-agent-bridge.js';
import {
  callOpenAIWave3,
  validateWave3Request,
  callOpenAISynthesis,
  validateSynthesisRequest
} from './_lib/nasq-wave3-split.js';

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

const ACTIONS = {
  wave: {
    scope: 'nasq-agent-bridge',
    max: 60,
    maxBytes: 750_000,
    async run(body) {
      const payload = validateWaveRequest(body);
      const result = await callOpenAIWave(payload);
      return {
        ok: true,
        wave: payload.wave,
        outputs: result.outputs,
        synthesis: result.synthesis,
        model: result.model,
        usage: result.usage
      };
    }
  },
  wave3: {
    scope: 'nasq-agent-wave3',
    max: 60,
    maxBytes: 600_000,
    async run(body) {
      const payload = validateWave3Request(body);
      const result = await callOpenAIWave3(payload);
      return {
        ok: true,
        wave: 3,
        needsFinalize: true,
        outputs: result.outputs,
        model: result.model,
        usage: result.usage
      };
    }
  },
  synthesis: {
    scope: 'nasq-agent-synthesis',
    max: 30,
    maxBytes: 750_000,
    async run(body) {
      const payload = validateSynthesisRequest(body);
      const result = await callOpenAISynthesis(payload);
      return {
        ok: true,
        synthesis: result.synthesis,
        model: result.model,
        usage: result.usage
      };
    }
  }
};

function resolveAction(value) {
  const key = String(value || 'wave').trim().toLowerCase();
  return ACTIONS[key] ? key : null;
}

export default async function handler(req, res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'nasq-agent-bridge',
      actions: Object.keys(ACTIONS),
      authenticated: authorized(req),
      configured: authorized(req) ? Boolean(process.env.OPENAI_API_KEY && process.env.NASQ_AGENT_BRIDGE_SECRET) : undefined
    });
  }
  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  if (!process.env.NASQ_AGENT_BRIDGE_SECRET) return json(res, 503, { error: 'bridge_not_configured' });
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });

  let body;
  try {
    body = await readJson(req, { maxBytes: 750_000 });
  } catch (error) {
    if (error instanceof AgentBridgeError) {
      return json(res, error.status, { error: error.code, message: error.message, retryable: error.retryable });
    }
    return json(res, 400, { error: 'invalid_body', message: 'تعذر قراءة جسم الطلب', retryable: false });
  }

  const actionKey = resolveAction(body?.action);
  if (!actionKey) {
    return json(res, 400, { error: 'invalid_action', message: 'action غير مدعوم', retryable: false });
  }
  const action = ACTIONS[actionKey];

  if (!consumeRateLimit(req, res, { scope: action.scope, max: action.max, windowMs: 60_000 })) {
    return json(res, 429, { error: 'rate_limited', retryable: true });
  }

  try {
    const result = await action.run(body);
    return json(res, 200, result);
  } catch (error) {
    if (error instanceof AgentBridgeError) {
      return json(res, error.status, {
        error: error.code,
        message: error.message,
        retryable: error.retryable,
        providerStatus: error.providerStatus || undefined
      });
    }
    console.error('nasq_agent_bridge_unexpected', actionKey, error instanceof Error ? error.name : 'unknown');
    return json(res, 500, { error: 'internal_error', message: 'تعذر تنفيذ طلب الوكلاء', retryable: false });
  }
}
