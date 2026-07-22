import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin, requireCron } from '../../api/_lib/auth.js';

function withEnv(name, value, fn) {
  const previous = process.env[name];
  process.env[name] = value;
  try { return fn(); }
  finally {
    if (previous == null) delete process.env[name];
    else process.env[name] = previous;
  }
}

test('admin endpoint requires exact bearer token', () => {
  withEnv('ADMIN_API_TOKEN', 'a'.repeat(64), () => {
    assert.equal(requireAdmin({ headers: { authorization: `Bearer ${'a'.repeat(64)}` } }), true);
    assert.equal(requireAdmin({ headers: { authorization: `Bearer ${'b'.repeat(64)}` } }), false);
    assert.equal(requireAdmin({ headers: {} }), false);
  });
});

test('cron endpoint rejects missing or incorrect secret', () => {
  withEnv('CRON_SECRET', 'c'.repeat(64), () => {
    assert.equal(requireCron({ headers: { authorization: `Bearer ${'c'.repeat(64)}` } }), true);
    assert.equal(requireCron({ headers: { authorization: 'Bearer wrong' } }), false);
  });
});
