import { getPublishMode } from './env.mjs';
import { publishInstagram } from './instagram.mjs';
import { publishTikTok } from './tiktok.mjs';
import { publishYouTube } from './youtube.mjs';
import { remainingPlatforms, validateManifest, withPlatformResult } from './content.mjs';

const publishers = {
  youtube: publishYouTube,
  tiktok: publishTikTok,
  instagram: publishInstagram
};

export async function publishManifest(input, options = {}) {
  const env = options.env || process.env;
  const mode = options.mode || getPublishMode(env);
  const dryRun = mode !== 'live';
  const validation = validateManifest(input, { requireApproval: !dryRun });
  if (!validation.ok) throw new Error(`Manifest validation failed: ${validation.errors.join(' | ')}`);

  let manifest = { ...input, status: 'publishing', updatedAt: new Date().toISOString() };
  for (const platform of remainingPlatforms(manifest)) {
    try {
      const result = await publishers[platform](manifest, { env, dryRun });
      manifest = withPlatformResult(manifest, platform, result);
    } catch (error) {
      manifest = withPlatformResult(manifest, platform, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
      if (options.stopOnError) throw Object.assign(error instanceof Error ? error : new Error(String(error)), { manifest });
    }
  }
  if (dryRun) {
    manifest = { ...manifest, status: input.status, dryRunAt: new Date().toISOString() };
  }
  return manifest;
}
