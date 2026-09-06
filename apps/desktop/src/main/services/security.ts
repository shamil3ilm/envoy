// Cross-app helpers (sanitizePhone, sanitizeEmail, buildMailtoUrl) live in
// @envoy/shared/sanitize so mobile and desktop stay bit-for-bit identical.
export { sanitizePhone, sanitizeEmail, buildMailtoUrl } from '@envoy/shared';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'tel:',
  'sms:',
  'whatsapp:',
  'msteams:',
]);

export function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 4096) {
      return false;
    }
    const parsed = new URL(rawUrl);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

const UWP_FAMILY_NAME = /^[A-Za-z0-9.\-_]{1,150}$/;

export function isSafeUwpFamilyName(raw: string): boolean {
  return typeof raw === 'string' && UWP_FAMILY_NAME.test(raw);
}
