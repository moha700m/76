export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('allow', allowed.join(', '));
  json(res, 405, { error: 'method_not_allowed' });
}

export async function readJson(req, options = {}) {
  const maxBytes = options.maxBytes || 1_000_000;
  const declared = Number(req.headers?.['content-length'] || 0);
  if (declared > maxBytes) throw new Error('request_body_too_large');
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('request_body_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
