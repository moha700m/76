import { requireEnv } from './env.mjs';

async function graphRequest(url, init, label) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(`${label} failed (${response.status}): ${data.error?.message || 'unknown error'}`);
  return data;
}

function graphBase(env) {
  const version = env.INSTAGRAM_GRAPH_API_VERSION;
  if (!version) throw new Error('Missing environment variable: INSTAGRAM_GRAPH_API_VERSION');
  return `https://graph.facebook.com/${version}`;
}

export async function fetchInstagramContainerStatus(containerId, options = {}) {
  const env = options.env || process.env;
  const { INSTAGRAM_ACCESS_TOKEN } = requireEnv(['INSTAGRAM_ACCESS_TOKEN'], env);
  const url = new URL(`${graphBase(env)}/${containerId}`);
  url.searchParams.set('fields', 'status_code,status');
  url.searchParams.set('access_token', INSTAGRAM_ACCESS_TOKEN);
  return graphRequest(url, { method: 'GET' }, 'Instagram container status');
}

async function waitForContainer(containerId, env, options = {}) {
  const attempts = options.attempts || 12;
  const delayMs = options.delayMs || 5000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await fetchInstagramContainerStatus(containerId, { env });
    if (status.status_code === 'FINISHED') return status;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram container failed: ${status.status || status.status_code}`);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Instagram container processing timed out');
}

export async function publishInstagram(manifest, options = {}) {
  const env = options.env || process.env;
  const settings = manifest.platformSettings?.instagram || {};
  if (options.dryRun) {
    return { status: 'validated', provider: 'instagram', shareToFeed: settings.shareToFeed !== false };
  }

  const { INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_IG_USER_ID } = requireEnv([
    'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_IG_USER_ID'
  ], env);
  const base = graphBase(env);
  const createUrl = new URL(`${base}/${INSTAGRAM_IG_USER_ID}/media`);
  createUrl.searchParams.set('media_type', 'REELS');
  createUrl.searchParams.set('video_url', manifest.videoUrl);
  createUrl.searchParams.set('caption', `${manifest.title}\n\n${manifest.description}`.slice(0, 2200));
  createUrl.searchParams.set('share_to_feed', String(settings.shareToFeed !== false));
  createUrl.searchParams.set('access_token', INSTAGRAM_ACCESS_TOKEN);
  const container = await graphRequest(createUrl, { method: 'POST' }, 'Instagram create Reel container');
  if (!container.id) throw new Error('Instagram did not return a container id');

  await waitForContainer(container.id, env, options);
  const publishUrl = new URL(`${base}/${INSTAGRAM_IG_USER_ID}/media_publish`);
  publishUrl.searchParams.set('creation_id', container.id);
  publishUrl.searchParams.set('access_token', INSTAGRAM_ACCESS_TOKEN);
  const published = await graphRequest(publishUrl, { method: 'POST' }, 'Instagram publish Reel');
  return { status: 'published', provider: 'instagram', containerId: container.id, externalId: published.id };
}
