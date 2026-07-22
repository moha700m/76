import { configuredEnv } from '../lib/social/env.mjs';
import { json, methodNotAllowed } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const required = [
    'ADMIN_API_TOKEN', 'CRON_SECRET', 'OPENAI_API_KEY',
    'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
    'TIKTOK_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_IG_USER_ID',
    'INSTAGRAM_GRAPH_API_VERSION', 'GITHUB_DISPATCH_TOKEN', 'GITHUB_REPOSITORY'
  ];
  return json(res, 200, {
    ok: true,
    service: 'marsad-tisaa-pro',
    publishMode: process.env.SOCIAL_PUBLISH_MODE || 'dry-run',
    appDeployStudio: 'https://441a4987f6936b832e.v2.appdeploy.ai/',
    configured: configuredEnv(required),
    timestamp: new Date().toISOString()
  });
}
