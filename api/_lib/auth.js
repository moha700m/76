import { timingSafeEqual } from 'node:crypto';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function requireAdmin(req) {
  const expected = process.env.ADMIN_API_TOKEN;
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return Boolean(expected) && safeEqual(provided, expected);
}

export function requireCron(req) {
  const expected = process.env.CRON_SECRET;
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return Boolean(expected) && safeEqual(provided, expected);
}
