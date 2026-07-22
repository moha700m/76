import { randomBytes } from 'node:crypto';

const command = process.argv[2] || 'url';
const value = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const clientKey = process.env.TIKTOK_CLIENT_KEY;
const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
const redirectUri = process.env.TIKTOK_REDIRECT_URI;
if (!clientKey) throw new Error('TIKTOK_CLIENT_KEY is required');

if (command === 'url') {
  if (!redirectUri) throw new Error('TIKTOK_REDIRECT_URI is required');
  const state = value('state') || randomBytes(24).toString('hex');
  const scopes = process.env.TIKTOK_SCOPES || 'user.info.basic,video.upload,video.publish';
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  console.log(JSON.stringify({ state, url: url.toString() }, null, 2));
} else if (command === 'exchange') {
  const code = value('code');
  if (!clientSecret || !redirectUri || !code) throw new Error('TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI and --code are required');
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  console.log(JSON.stringify(data, null, 2));
} else if (command === 'refresh') {
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;
  if (!clientSecret || !refreshToken) throw new Error('TIKTOK_CLIENT_SECRET and TIKTOK_REFRESH_TOKEN are required');
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  console.log(JSON.stringify(data, null, 2));
} else {
  throw new Error('Use: url | exchange --code=CODE | refresh');
}
