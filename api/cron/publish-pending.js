import { requireCron } from '../_lib/auth.js';
import { json, methodNotAllowed } from '../_lib/http.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!requireCron(req)) return json(res, 401, { error: 'unauthorized' });
  if (!consumeRateLimit(req, res, { scope: 'cron-publish', max: 5, windowMs: 3600000 })) return json(res, 429, { error: 'rate_limited' });
  const token = process.env.GH_PAT || process.env.GITHUB_DISPATCH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || 'moha700m/76';
  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'social-publish.yml';
  const branch = process.env.GITHUB_DEFAULT_BRANCH || 'main';
  if (!token || !repository) return json(res, 503, { error: 'github_dispatch_not_configured' });

  const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'nasq-ai-cron'
    },
    body: JSON.stringify({ ref: branch, inputs: { source: 'vercel-cron' } })
  });
  if (!response.ok) return json(res, 502, { error: 'github_dispatch_failed', status: response.status, detail: (await response.text()).slice(0, 300) });
  return json(res, 202, { ok: true, dispatched: workflow, branch, timestamp: new Date().toISOString() });
}
