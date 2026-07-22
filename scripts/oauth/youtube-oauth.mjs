const command = process.argv[2] || 'url';
const code = process.argv.find(item => item.startsWith('--code='))?.slice(7);
const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:53682/oauth2callback';
if (!clientId) throw new Error('YOUTUBE_CLIENT_ID is required');

if (command === 'url') {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  console.log(url.toString());
} else if (command === 'exchange') {
  if (!clientSecret || !code) throw new Error('YOUTUBE_CLIENT_SECRET and --code are required');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  console.log(JSON.stringify({
    access_token: data.access_token ? '[received]' : undefined,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope
  }, null, 2));
} else {
  throw new Error('Use: node scripts/oauth/youtube-oauth.mjs url | exchange --code=CODE');
}
