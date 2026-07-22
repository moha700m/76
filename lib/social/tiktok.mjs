import { requireEnv } from './env.mjs';

async function tiktokRequest(path, accessToken, body) {
  const response = await fetch(`https://open.tiktokapis.com${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error?.code !== 'ok') {
    throw new Error(`TikTok request failed (${response.status}): ${data.error?.code || 'unknown'} ${data.error?.message || ''}`.trim());
  }
  return data.data || {};
}

export async function publishTikTok(manifest, options = {}) {
  const env = options.env || process.env;
  const settings = manifest.platformSettings?.tiktok || {};
  const mode = settings.mode || env.TIKTOK_POST_MODE || 'draft';
  if (mode === 'direct' && settings.userApproved !== true) throw new Error('TikTok direct posting requires explicit userApproved=true');
  if (options.dryRun) {
    return { status: 'validated', provider: 'tiktok', mode, privacyLevel: settings.privacyLevel || 'SELF_ONLY' };
  }

  const { TIKTOK_ACCESS_TOKEN } = requireEnv(['TIKTOK_ACCESS_TOKEN'], env);
  if (mode === 'draft') {
    const data = await tiktokRequest('/v2/post/publish/inbox/video/init/', TIKTOK_ACCESS_TOKEN, {
      source_info: { source: 'PULL_FROM_URL', video_url: manifest.videoUrl }
    });
    return { status: 'published', provider: 'tiktok', mode: 'draft', publishId: data.publish_id, note: 'Draft sent to TikTok inbox for final review' };
  }

  const creator = await tiktokRequest('/v2/post/publish/creator_info/query/', TIKTOK_ACCESS_TOKEN, {});
  const privacy = settings.privacyLevel || 'SELF_ONLY';
  if (Array.isArray(creator.privacy_level_options) && !creator.privacy_level_options.includes(privacy)) {
    throw new Error(`TikTok privacy level ${privacy} is not available for this creator`);
  }

  const data = await tiktokRequest('/v2/post/publish/video/init/', TIKTOK_ACCESS_TOKEN, {
    post_info: {
      title: `${manifest.title}\n${manifest.description}`.slice(0, 2200),
      privacy_level: privacy,
      disable_duet: Boolean(settings.disableDuet),
      disable_comment: Boolean(settings.disableComment),
      disable_stitch: Boolean(settings.disableStitch),
      brand_organic_toggle: Boolean(settings.brandOrganic),
      is_aigc: Boolean(manifest.isAigc)
    },
    source_info: { source: 'PULL_FROM_URL', video_url: manifest.videoUrl }
  });
  return { status: 'published', provider: 'tiktok', mode: 'direct', publishId: data.publish_id, privacyLevel: privacy };
}

export async function fetchTikTokStatus(publishId, options = {}) {
  const env = options.env || process.env;
  const { TIKTOK_ACCESS_TOKEN } = requireEnv(['TIKTOK_ACCESS_TOKEN'], env);
  return tiktokRequest('/v2/post/publish/status/fetch/', TIKTOK_ACCESS_TOKEN, { publish_id: publishId });
}
