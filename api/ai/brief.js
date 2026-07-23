import { createOpenAIBrief } from '../_lib/integrations.js';
import { requireAdmin } from '../_lib/auth.js';
import { json, methodNotAllowed, readJson } from '../_lib/http.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireAdmin(req)) return json(res, 401, { error: 'unauthorized' });
  if (!consumeRateLimit(req, res, { scope: 'ai-brief', max: 10, windowMs: 900000 })) {
    return json(res, 429, { error: 'rate_limited' });
  }

  try {
    const body = await readJson(req, { maxBytes: 16000 });
    const result = await createOpenAIBrief(body.brief);
    return json(res, 200, { ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'brief_too_short' ? 400 : message === 'openai_not_configured' ? 503 : 502;
    return json(res, status, { error: message.slice(0, 400) });
  }
}
