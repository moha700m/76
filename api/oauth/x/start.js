import { beginXOAuth } from '../../_lib/x-connect.js';
export default function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('Method Not Allowed'); }
  try { const flow = beginXOAuth(); res.statusCode = 302; res.setHeader('location', flow.url); res.setHeader('set-cookie', flow.cookie); res.setHeader('cache-control', 'no-store'); res.setHeader('x-robots-tag', 'noindex'); res.end('Redirecting…'); }
  catch { res.statusCode = 503; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ error: 'x_not_configured' })); }
}
