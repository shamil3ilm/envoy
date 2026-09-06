import { describe, expect, it } from 'vitest';
import {
  buildMailtoUrl,
  isSafeExternalUrl,
  isSafeUwpFamilyName,
  sanitizeEmail,
  sanitizePhone,
} from './security';

describe('isSafeExternalUrl', () => {
  it('accepts http/https', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('accepts mailto/tel/sms', () => {
    expect(isSafeExternalUrl('mailto:a@b.com')).toBe(true);
    expect(isSafeExternalUrl('tel:+15551234567')).toBe(true);
    expect(isSafeExternalUrl('sms:+15551234567')).toBe(true);
  });

  it('rejects unsafe schemes', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeExternalUrl('vbscript:msgbox')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
    expect(isSafeExternalUrl('x'.repeat(5000))).toBe(false);
  });
});

describe('sanitizeEmail', () => {
  it('accepts valid emails', () => {
    expect(sanitizeEmail('alice@example.com')).toBe('alice@example.com');
    expect(sanitizeEmail('  bob@example.co.uk  ')).toBe('bob@example.co.uk');
  });

  it('rejects addresses with shell metacharacters', () => {
    expect(sanitizeEmail("a'; rm -rf /@b.com")).toBeNull();
    expect(sanitizeEmail('a`whoami`@b.com')).toBeNull();
    expect(sanitizeEmail('a$(id)@b.com')).toBeNull();
    expect(sanitizeEmail('a|b@c.com')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(sanitizeEmail('')).toBeNull();
    expect(sanitizeEmail('not-an-email')).toBeNull();
    expect(sanitizeEmail('x'.repeat(400) + '@a.com')).toBeNull();
  });
});

describe('sanitizePhone', () => {
  it('normalizes valid numbers', () => {
    expect(sanitizePhone('+1 555 123 4567')).toBe('+15551234567');
    expect(sanitizePhone('(555) 123-4567')).toBe('5551234567');
    expect(sanitizePhone('+44-20-7946-0958')).toBe('+442079460958');
  });

  it('rejects non-numeric input', () => {
    expect(sanitizePhone('abc')).toBeNull();
    expect(sanitizePhone('+1; rm -rf /')).toBeNull();
    expect(sanitizePhone('')).toBeNull();
  });
});

describe('isSafeUwpFamilyName', () => {
  it('accepts valid family names', () => {
    expect(isSafeUwpFamilyName('microsoft.windowscommunicationsapps_8wekyb3d8bbwe')).toBe(true);
  });

  it('rejects shell metacharacters', () => {
    expect(isSafeUwpFamilyName('foo"!App && calc.exe && echo x')).toBe(false);
    expect(isSafeUwpFamilyName('foo`whoami`')).toBe(false);
    expect(isSafeUwpFamilyName('foo bar')).toBe(false);
  });
});

describe('buildMailtoUrl', () => {
  it('builds valid URL for clean input', () => {
    const url = buildMailtoUrl('a@b.com', 'Hi', 'Hello world');
    expect(url).toContain('mailto:');
    expect(url).toContain('subject=Hi');
    expect(url).toContain('body=Hello%20world');
  });

  it('URL-encodes special characters', () => {
    const url = buildMailtoUrl('a@b.com', 'Q&A: "test"', '<>&');
    expect(url).not.toContain('<');
    expect(url).not.toContain('&A');
  });

  it('rejects invalid recipient', () => {
    expect(buildMailtoUrl('not-an-email', 's', 'b')).toBeNull();
    expect(buildMailtoUrl("a'; DROP TABLE users@x.com", 's', 'b')).toBeNull();
  });
});
