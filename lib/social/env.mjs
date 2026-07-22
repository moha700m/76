export function getPublishMode(env = process.env) {
  const mode = String(env.SOCIAL_PUBLISH_MODE || 'dry-run').toLowerCase();
  if (!['dry-run', 'live'].includes(mode)) throw new Error('SOCIAL_PUBLISH_MODE must be dry-run or live');
  return mode;
}

export function requireEnv(names, env = process.env) {
  const missing = names.filter(name => !env[name]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return Object.fromEntries(names.map(name => [name, env[name]]));
}

export function configuredEnv(names, env = process.env) {
  return Object.fromEntries(names.map(name => [name, Boolean(env[name])]));
}
