export const SUPPORTED_PLATFORMS = ['youtube', 'tiktok', 'instagram'];
export const MANIFEST_STATUSES = ['draft', 'pending', 'publishing', 'published', 'partial', 'failed'];

const YOUTUBE_PRIVACY = ['private', 'unlisted', 'public'];
const TIKTOK_PRIVACY = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validIsoDate(value) {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
}

function validateHttpsUrl(value, field, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${field} مطلوب`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') errors.push(`${field} لازم يبدأ بـ https`);
  } catch {
    errors.push(`${field} رابط غير صالح`);
  }
}

export function validateManifest(input, options = {}) {
  const errors = [];
  const manifest = isObject(input) ? input : {};
  const requireApproval = options.requireApproval ?? false;

  if (typeof manifest.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(manifest.id)) {
    errors.push('id لازم يكون 3-80 حرفًا إنجليزيًا صغيرًا أو أرقامًا أو شرطات');
  }
  if (!MANIFEST_STATUSES.includes(manifest.status)) errors.push('status غير صالح');
  if (!validIsoDate(manifest.scheduledAt)) errors.push('scheduledAt لازم يكون تاريخ ISO صالح');
  validateHttpsUrl(manifest.videoUrl, 'videoUrl', errors);

  if (typeof manifest.title !== 'string' || manifest.title.trim().length < 3) errors.push('title قصير أو مفقود');
  if (typeof manifest.description !== 'string') errors.push('description مطلوب');
  if (!Array.isArray(manifest.tags)) errors.push('tags لازم تكون مصفوفة');
  if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0) {
    errors.push('platforms لازم تحتوي منصة واحدة على الأقل');
  } else {
    const unique = new Set(manifest.platforms);
    if (unique.size !== manifest.platforms.length) errors.push('platforms فيها تكرار');
    for (const platform of unique) {
      if (!SUPPORTED_PLATFORMS.includes(platform)) errors.push(`المنصة ${platform} غير مدعومة`);
    }
  }

  if (requireApproval && !validIsoDate(manifest.approvedAt)) {
    errors.push('approvedAt مطلوب قبل النشر الفعلي');
  }

  const settings = isObject(manifest.platformSettings) ? manifest.platformSettings : {};
  const youtube = isObject(settings.youtube) ? settings.youtube : {};
  if (youtube.privacyStatus && !YOUTUBE_PRIVACY.includes(youtube.privacyStatus)) {
    errors.push('YouTube privacyStatus غير صالح');
  }

  const tiktok = isObject(settings.tiktok) ? settings.tiktok : {};
  if (tiktok.privacyLevel && !TIKTOK_PRIVACY.includes(tiktok.privacyLevel)) {
    errors.push('TikTok privacyLevel غير صالح');
  }
  if (tiktok.mode && !['draft', 'direct'].includes(tiktok.mode)) errors.push('TikTok mode غير صالح');
  if (tiktok.mode === 'direct' && tiktok.userApproved !== true) {
    errors.push('TikTok Direct Post يتطلب userApproved=true');
  }

  const instagram = isObject(settings.instagram) ? settings.instagram : {};
  if (instagram.shareToFeed != null && typeof instagram.shareToFeed !== 'boolean') {
    errors.push('Instagram shareToFeed لازم تكون true أو false');
  }

  if (isObject(manifest.results)) {
    for (const [platform, result] of Object.entries(manifest.results)) {
      if (!SUPPORTED_PLATFORMS.includes(platform)) errors.push(`results يحتوي منصة غير مدعومة: ${platform}`);
      if (!isObject(result)) errors.push(`نتيجة ${platform} غير صالحة`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function isDue(manifest, now = new Date()) {
  if (!manifest || !validIsoDate(manifest.scheduledAt)) return false;
  if (!['pending', 'partial', 'failed'].includes(manifest.status)) return false;
  return Date.parse(manifest.scheduledAt) <= now.getTime();
}

export function remainingPlatforms(manifest) {
  const results = isObject(manifest.results) ? manifest.results : {};
  return (manifest.platforms || []).filter(platform => results?.[platform]?.status !== 'published');
}

export function deriveOverallStatus(manifest) {
  const platforms = manifest.platforms || [];
  const results = isObject(manifest.results) ? manifest.results : {};
  const statuses = platforms.map(platform => results?.[platform]?.status || 'pending');
  if (statuses.length && statuses.every(status => status === 'published')) return 'published';
  if (statuses.some(status => status === 'published')) return 'partial';
  if (statuses.some(status => status === 'failed')) return 'failed';
  if (statuses.some(status => status === 'publishing')) return 'publishing';
  return manifest.status || 'pending';
}

export function withPlatformResult(manifest, platform, result) {
  const now = new Date().toISOString();
  const next = {
    ...manifest,
    results: {
      ...(isObject(manifest.results) ? manifest.results : {}),
      [platform]: {
        ...result,
        updatedAt: now
      }
    },
    updatedAt: now
  };
  next.status = deriveOverallStatus(next);
  return next;
}

export function sanitizeForLogs(value) {
  if (Array.isArray(value)) return value.map(sanitizeForLogs);
  if (!isObject(value)) return value;
  const blocked = /token|secret|authorization|client_secret|refresh/i;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blocked.test(key) ? '[REDACTED]' : sanitizeForLogs(item)]));
}
