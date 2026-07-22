import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeRateLimit, resetRateLimitsForTests } from '../../api/_lib/rate-limit.js';

function response() {
  const headers = new Map();
  return { headers, setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); } };
}

test('rate limiter allows configured requests then blocks with retry-after', () => {
  resetRateLimitsForTests();
  const req = { headers: { 'x-forwarded-for': '203.0.113.10' } };
  const first = response();
  const second = response();
  const third = response();
  assert.equal(consumeRateLimit(req, first, { scope: 'test', max: 2, windowMs: 60_000 }), true);
  assert.equal(consumeRateLimit(req, second, { scope: 'test', max: 2, windowMs: 60_000 }), true);
  assert.equal(consumeRateLimit(req, third, { scope: 'test', max: 2, windowMs: 60_000 }), false);
  assert.ok(Number(third.headers.get('retry-after')) >= 1);
});
