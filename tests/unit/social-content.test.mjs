import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOverallStatus, isDue, remainingPlatforms, validateManifest, withPlatformResult } from '../../lib/social/content.mjs';

function manifest(overrides = {}) {
  return {
    id: 'launch-demo-001',
    status: 'pending',
    scheduledAt: '2026-07-22T16:00:00.000Z',
    approvedAt: '2026-07-22T15:00:00.000Z',
    videoUrl: 'https://cdn.example.com/video.mp4',
    title: 'نَسَق',
    description: 'فيديو تجريبي',
    tags: ['ذكاء اصطناعي'],
    platforms: ['youtube', 'instagram'],
    platformSettings: {},
    results: {},
    ...overrides
  };
}

test('valid manifest passes strict approval validation', () => {
  assert.deepEqual(validateManifest(manifest(), { requireApproval: true }), { ok: true, errors: [] });
});

test('live validation rejects unapproved content', () => {
  const result = validateManifest(manifest({ approvedAt: null }), { requireApproval: true });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /approvedAt/);
});

test('TikTok direct post requires explicit approval flag', () => {
  const result = validateManifest(manifest({
    platforms: ['tiktok'],
    platformSettings: { tiktok: { mode: 'direct', privacyLevel: 'SELF_ONLY' } }
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /userApproved/);
});

test('due calculation respects schedule and status', () => {
  assert.equal(isDue(manifest(), new Date('2026-07-22T17:00:00.000Z')), true);
  assert.equal(isDue(manifest({ status: 'draft' }), new Date('2026-07-22T17:00:00.000Z')), false);
});

test('published platforms are skipped and overall status becomes published', () => {
  let current = withPlatformResult(manifest(), 'youtube', { status: 'published', externalId: 'abc' });
  assert.deepEqual(remainingPlatforms(current), ['instagram']);
  current = withPlatformResult(current, 'instagram', { status: 'published', externalId: 'def' });
  assert.equal(deriveOverallStatus(current), 'published');
});
