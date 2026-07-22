import { fetchInstagramContainerStatus } from '../../lib/social/instagram.mjs';
import { fetchTikTokStatus } from '../../lib/social/tiktok.mjs';
import { requireAdmin } from '../_lib/auth.js';
import { json, methodNotAllowed, readJson } from '../_lib/http.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireAdmin(req)) return json(res, 401, { error: 'unauthorized' });
  if (!consumeRateLimit(req, res, { scope: 'social-status', max: 60, windowMs: 60000 })) return json(res, 429, { error: 'rate_limited' });
  try {
    const { platform, publishId, containerId } = await readJson(req);
    if (platform === 'tiktok' && publishId) return json(res, 200, { platform, data: await fetchTikTokStatus(publishId) });
    if (platform === 'instagram' && containerId) return json(res, 200, { platform, data: await fetchInstagramContainerStatus(containerId) });
    return json(res, 400, { error: 'platform and matching publishId/containerId are required' });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}
