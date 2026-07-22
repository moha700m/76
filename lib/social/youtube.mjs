import { requireEnv } from './env.mjs';

async function parseJson(response, label) {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${data.error?.message || data.error_description || text.slice(0, 300)}`);
  return data;
}

async function getAccessToken(env) {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = requireEnv([
    'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'
  ], env);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      refresh_token: YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await parseJson(response, 'YouTube OAuth refresh');
  if (!data.access_token) throw new Error('YouTube OAuth response did not include access_token');
  return data.access_token;
}

async function openVideoStream(videoUrl) {
  const response = await fetch(videoUrl, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Could not read videoUrl (${response.status})`);
  const length = response.headers.get('content-length');
  if (!length) throw new Error('videoUrl must return Content-Length for YouTube server-side upload');
  const contentType = response.headers.get('content-type') || 'video/mp4';
  return { body: response.body, length, contentType };
}

export async function publishYouTube(manifest, options = {}) {
  const env = options.env || process.env;
  if (options.dryRun) {
    return { status: 'validated', provider: 'youtube', privacyStatus: manifest.platformSettings?.youtube?.privacyStatus || 'private' };
  }

  const accessToken = await getAccessToken(env);
  const media = await openVideoStream(manifest.videoUrl);
  const settings = manifest.platformSettings?.youtube || {};
  const metadata = {
    snippet: {
      title: manifest.title.slice(0, 100),
      description: manifest.description.slice(0, 5000),
      tags: (manifest.tags || []).slice(0, 50),
      categoryId: String(settings.categoryId || '28')
    },
    status: {
      privacyStatus: settings.privacyStatus || 'private',
      selfDeclaredMadeForKids: Boolean(settings.madeForKids)
    }
  };

  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': media.length,
      'x-upload-content-type': media.contentType
    },
    body: JSON.stringify(metadata)
  });
  if (!init.ok) await parseJson(init, 'YouTube resumable upload initialization');
  const uploadUrl = init.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL');

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': media.contentType,
      'content-length': media.length
    },
    body: media.body,
    duplex: 'half'
  });
  const data = await parseJson(upload, 'YouTube video upload');
  return {
    status: 'published',
    provider: 'youtube',
    externalId: data.id,
    url: data.id ? `https://youtu.be/${data.id}` : undefined,
    privacyStatus: metadata.status.privacyStatus
  };
}
