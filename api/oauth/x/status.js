import { xConnectionStatus } from '../../_lib/x-connect.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('Method Not Allowed'); }
  res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
  try { res.end(JSON.stringify(await xConnectionStatus())); } catch { res.end(JSON.stringify({ configured: true, connected: false, storageReady: false })); }
}
