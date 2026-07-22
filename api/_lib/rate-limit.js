const STORE_KEY = '__marsad_tisaa_rate_limit_store__';
const store = globalThis[STORE_KEY] || new Map();
globalThis[STORE_KEY] = store;

function requestIdentity(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

function prune(now) {
  if (store.size < 1000) return;
  for (const [key, value] of store) {
    if (value.resetAt <= now) store.delete(key);
  }
}

export function consumeRateLimit(req, res, options = {}) {
  const now = Date.now();
  const windowMs = options.windowMs || 60_000;
  const max = options.max || 30;
  const scope = options.scope || 'api';
  const key = `${scope}:${requestIdentity(req)}`;
  prune(now);

  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  store.set(key, bucket);

  const remaining = Math.max(0, max - bucket.count);
  res.setHeader('x-ratelimit-limit', String(max));
  res.setHeader('x-ratelimit-remaining', String(remaining));
  res.setHeader('x-ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count <= max) return true;
  res.setHeader('retry-after', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
  return false;
}

export function resetRateLimitsForTests() {
  store.clear();
}
