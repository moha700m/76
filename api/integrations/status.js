import { checkGitHubConnection, checkOpenAIConnection } from '../_lib/integrations.js';
import { json, methodNotAllowed } from '../_lib/http.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!consumeRateLimit(req, res, { scope: 'integration-status', max: 10, windowMs: 60000 })) {
    return json(res, 429, { error: 'rate_limited' });
  }

  const [github, openai] = await Promise.all([
    checkGitHubConnection(),
    checkOpenAIConnection()
  ]);

  return json(res, github.connected && openai.connected ? 200 : 503, {
    ok: github.connected && openai.connected,
    github,
    openai,
    checkedAt: new Date().toISOString()
  });
}
