import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const REDIRECT = process.env.X_REDIRECT_URI || 'https://marsad-tisaa-pro.vercel.app/api/oauth/x/callback';
const EXPECTED = (process.env.X_EXPECTED_USERNAME || 'agentsworks4u').replace(/^@/, '').toLowerCase();
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];
const BRANCH = process.env.X_VAULT_BRANCH || 'system/social-state';
const PATH = process.env.X_VAULT_PATH || '.nasq/social/x-token.enc.json';
const REPO = process.env.GITHUB_REPOSITORY || 'moha700m/76';
const COOKIE = 'nasq_x_oauth';
const b64 = value => Buffer.from(value).toString('base64url');
const key = purpose => {
  if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) throw new Error('x_not_configured');
  return createHash('sha256').update(`nasq:${purpose}:v1\0${process.env.X_CLIENT_ID}\0${process.env.X_CLIENT_SECRET}`).digest();
};
const seal = (value, purpose) => {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(purpose), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return JSON.stringify({ v: 1, iv: b64(iv), tag: b64(cipher.getAuthTag()), data: b64(data) });
};
const open = (value, purpose) => {
  const box = JSON.parse(value), decipher = createDecipheriv('aes-256-gcm', key(purpose), Buffer.from(box.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(box.tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.data, 'base64url')), decipher.final()]).toString());
};
const equal = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && timingSafeEqual(x, y); };
const cookies = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2));
const gh = async (path, init = {}) => {
  const token = process.env.GH_PAT || process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) throw new Error('github_not_configured');
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json', 'user-agent': 'nasq-x-vault', ...(init.headers || {}) } });
  const text = await response.text(); let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 200) }; }
  if (!response.ok) { const error = new Error(`github_${response.status}:${data.message || 'failed'}`); error.status = response.status; throw error; }
  return data;
};
const ensureBranch = async () => {
  try { await gh(`/git/ref/heads/${BRANCH}`); return; } catch (error) { if (error.status !== 404) throw error; }
  const repo = await gh(''), base = await gh(`/git/ref/heads/${repo.default_branch || 'main'}`);
  try { await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: base.object.sha }) }); } catch (error) { if (error.status !== 422) throw error; }
};
const readVaultFile = async () => {
  try {
    const file = await gh(`/contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
    return { sha: file.sha, text: Buffer.from(String(file.content || '').replace(/\s/g, ''), 'base64').toString() };
  } catch (error) { if (error.status === 404) return null; throw error; }
};
const writeVault = async value => {
  await ensureBranch(); const current = await readVaultFile();
  const body = { message: 'chore(state): update encrypted X connection', branch: BRANCH, content: Buffer.from(seal(value, 'vault')).toString('base64') };
  if (current?.sha) body.sha = current.sha;
  await gh(`/contents/${PATH}`, { method: 'PUT', body: JSON.stringify(body) });
};
export function beginXOAuth() {
  const state = b64(randomBytes(24)), verifier = b64(randomBytes(48));
  const challenge = b64(createHash('sha256').update(verifier).digest());
  const params = new URLSearchParams({ response_type: 'code', client_id: process.env.X_CLIENT_ID, redirect_uri: REDIRECT, scope: SCOPES.join(' '), state, code_challenge: challenge, code_challenge_method: 'S256' });
  return { url: `https://x.com/i/oauth2/authorize?${params}`, cookie: `${COOKIE}=${encodeURIComponent(seal({ state, verifier, at: Date.now() }, 'cookie'))}; Path=/api/oauth/x; HttpOnly; Secure; SameSite=Lax; Max-Age=600` };
}
export function clearXCookie() { return `${COOKIE}=; Path=/api/oauth/x; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export async function finishXOAuth(req, code, state) {
  const raw = cookies(req)[COOKIE]; if (!raw) throw new Error('oauth_cookie_missing');
  const saved = open(raw, 'cookie'); if (Date.now() - saved.at > 600000 || !equal(state, saved.state)) throw new Error('oauth_state_invalid');
  const form = new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT, code_verifier: saved.verifier });
  const auth = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64');
  const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form });
  const token = await tokenResponse.json(); if (!tokenResponse.ok || !token.access_token || !token.refresh_token) throw new Error('token_exchange_failed');
  const userResponse = await fetch('https://api.x.com/2/users/me', { headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' } });
  const user = (await userResponse.json())?.data; if (!userResponse.ok || !user?.id) throw new Error('user_lookup_failed');
  if (String(user.username).toLowerCase() !== EXPECTED) throw new Error('wrong_x_account');
  const scopes = String(token.scope || '').split(/\s+/).filter(Boolean); if (SCOPES.some(scope => !scopes.includes(scope))) throw new Error('missing_x_scopes');
  const now = Date.now();
  await writeVault({ username: user.username, userId: user.id, name: user.name || '', scopes, accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: now + (Number(token.expires_in || 7200) - 60) * 1000, connectedAt: now, updatedAt: now });
  return { username: user.username };
}
export async function xConnectionStatus() {
  if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) return { configured: false, connected: false };
  const file = await readVaultFile(); if (!file) return { configured: true, connected: false };
  const value = open(file.text, 'vault');
  return { configured: true, connected: true, account: { username: value.username, userId: value.userId, name: value.name, scopes: value.scopes, connectedAt: value.connectedAt } };
}
