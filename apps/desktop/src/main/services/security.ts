// The three helpers below (sanitizePhone, sanitizeEmail, buildMailtoUrl)
// duplicate @envoy/shared/sanitize.ts. Both copies are covered by
// security.test.ts. Kept inline here because the main-process tsc build
// enforces rootDir: src and can't emit files that resolve outside it.
// If they drift, security.test.ts fails and both must be updated.

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

const E164_PHONE = /^\+?[0-9]{6,20}$/;

export function sanitizePhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.replace(/[\s\-()]/g, '');
  return E164_PHONE.test(trimmed) ? trimmed : null;
}

const EMAIL = /^[^\s@<>"'`;|&$]+@[^\s@<>"'`;|&$]+\.[^\s@<>"'`;|&$]+$/;

export function sanitizeEmail(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > 320) return null;
  const trimmed = raw.trim();
  return EMAIL.test(trimmed) ? trimmed : null;
}

const UWP_FAMILY_NAME = /^[A-Za-z0-9.\-_]{1,150}$/;

export function isSafeUwpFamilyName(raw: string): boolean {
  return typeof raw === 'string' && UWP_FAMILY_NAME.test(raw);
}

export function buildMailtoUrl(to: string, subject: string, body: string): string | null {
  const safeTo = sanitizeEmail(to);
  if (!safeTo) return null;
  const safeSubject = String(subject ?? '').slice(0, 998);
  const safeBody = String(body ?? '').slice(0, 20000);
  return `mailto:${encodeURIComponent(safeTo)}?subject=${encodeURIComponent(safeSubject)}&body=${encodeURIComponent(safeBody)}`;
}
