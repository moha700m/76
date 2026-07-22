import { publishManifest } from '../../lib/social/publisher.mjs';
import { sanitizeForLogs } from '../../lib/social/content.mjs';
import { requireAdmin } from '../_lib/auth.js';
import { json, methodNotAllowed, readJson } from '../_lib/http.js';
import { consumeRateLimit } from '../_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!requireAdmin(req)) return json(res, 401, { error: 'unauthorized' });
  if (!consumeRateLimit(req, res, { scope: 'social-publish', max: 10, windowMs: 900000 })) return json(res, 429, { error: 'rate_limited' });
  try {
    const body = await readJson(req);
    const mode = body.mode === 'dry-run' ? 'dry-run' : undefined;
    const manifest = await publishManifest(body.manifest, { mode, stopOnError: false });
    console.log('social_publish', JSON.stringify(sanitizeForLogs({ id: manifest.id, status: manifest.status, results: manifest.results })));
    return json(res, 200, { ok: true, manifest });
  } catch (error) {
    console.error('social_publish_failed', error);
    return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}
