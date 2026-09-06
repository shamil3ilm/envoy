/**
 * Cross-app sanitizers.
 *
 * Kept intentionally dependency-free so both the Electron main process and
 * React Native runtime can import them. Do NOT add Node built-ins here.
 */

const E164_PHONE = /^\+?[0-9]{6,20}$/;
const EMAIL = /^[^\s@<>"'`;|&$]+@[^\s@<>"'`;|&$]+\.[^\s@<>"'`;|&$]+$/;

/**
 * Normalize a phone number by stripping spaces/dashes/parentheses, then
 * verify it matches the loose E.164 shape (optional `+`, 6-20 digits).
 * Returns the normalized digits or null when the input is not a plausible number.
 */
export function sanitizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.replace(/[\s\-()]/g, '');
  return E164_PHONE.test(trimmed) ? trimmed : null;
}

/**
 * Return the trimmed email if it passes a conservative regex that rejects
 * shell metacharacters (angle brackets, quotes, backticks, semicolons,
 * pipes, ampersands, dollar signs). Returns null when the address is
 * malformed or over 320 chars.
 */
export function sanitizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 320) return null;
  const trimmed = raw.trim();
  return EMAIL.test(trimmed) ? trimmed : null;
}

/**
 * Build an RFC 6068 mailto: URL from user-provided parts. Length-caps the
 * subject and body to keep the URL under practical handler limits, and
 * URL-encodes every segment. Returns null when the recipient is invalid.
 */
export function buildMailtoUrl(
  to: unknown,
  subject: unknown,
  body: unknown
): string | null {
  const safeTo = sanitizeEmail(to);
  if (!safeTo) return null;
  const safeSubject = String(subject ?? '').slice(0, 998);
  const safeBody = String(body ?? '').slice(0, 20_000);
  return `mailto:${encodeURIComponent(safeTo)}?subject=${encodeURIComponent(
    safeSubject
  )}&body=${encodeURIComponent(safeBody)}`;
}
