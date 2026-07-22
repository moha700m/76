import test from 'node:test';
import assert from 'node:assert/strict';
import { publishManifest } from '../../lib/social/publisher.mjs';

const manifest = {
  id: 'dry-run-001',
  status: 'draft',
  scheduledAt: '2026-07-24T16:00:00.000Z',
  approvedAt: null,
  videoUrl: 'https://cdn.example.com/video.mp4',
  title: 'تجربة نشر آمنة',
  description: 'تجربة تحقق لا ترسل الفيديو فعليًا.',
  tags: ['اختبار'],
  platforms: ['youtube', 'instagram', 'tiktok'],
  platformSettings: {
    youtube: { privacyStatus: 'private' },
    instagram: { shareToFeed: false },
    tiktok: { mode: 'draft', privacyLevel: 'SELF_ONLY', userApproved: false }
  }
};

test('dry run validates all platforms without approval or network publishing', async () => {
  const result = await publishManifest(manifest, { mode: 'dry-run' });
  assert.equal(result.status, 'draft');
  assert.ok(result.dryRunAt);
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.results).map(([platform, value]) => [platform, value.status])),
    { youtube: 'validated', instagram: 'validated', tiktok: 'validated' }
  );
});

test('live mode refuses unapproved content before provider calls', async () => {
  await assert.rejects(
    publishManifest(manifest, { mode: 'live' }),
    /approvedAt مطلوب قبل النشر الفعلي/
  );
});
