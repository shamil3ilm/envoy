import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted to the very top of the file, so anything it references
// must be defined via vi.hoisted() rather than a plain const.
const { safeStorageMock } = vi.hoisted(() => ({
  safeStorageMock: {
    isEncryptionAvailable: vi.fn<[], boolean>(),
    encryptString: vi.fn<[string], Buffer>(),
    decryptString: vi.fn<[Buffer], string>(),
  },
}));

vi.mock('electron', () => ({
  safeStorage: safeStorageMock,
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { decryptSecret, encryptSecret, isEncrypted } from './secure-storage';

beforeEach(() => {
  safeStorageMock.isEncryptionAvailable.mockReset();
  safeStorageMock.encryptString.mockReset();
  safeStorageMock.decryptString.mockReset();
});

describe('isEncrypted', () => {
  it('detects the enc:v1: prefix', () => {
    expect(isEncrypted('enc:v1:abcdef')).toBe(true);
    expect(isEncrypted('plaintext')).toBe(false);
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
  });
});

describe('encryptSecret', () => {
  it('returns null for empty input', () => {
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret(undefined)).toBeNull();
    expect(encryptSecret('')).toBeNull();
  });

  it('is idempotent when input is already encrypted', () => {
    expect(encryptSecret('enc:v1:abc')).toBe('enc:v1:abc');
  });

  it('wraps plaintext with the enc:v1: prefix using safeStorage', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    safeStorageMock.encryptString.mockReturnValue(Buffer.from('CIPHER'));

    const out = encryptSecret('secret');
    expect(out).toBe('enc:v1:' + Buffer.from('CIPHER').toString('base64'));
    expect(safeStorageMock.encryptString).toHaveBeenCalledWith('secret');
  });

  it('falls back to plaintext + warn when safeStorage is unavailable', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    const out = encryptSecret('secret');
    expect(out).toBe('secret');
    expect(safeStorageMock.encryptString).not.toHaveBeenCalled();
  });
});

describe('decryptSecret', () => {
  it('returns null for empty input', () => {
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    expect(decryptSecret('')).toBeNull();
  });

  it('returns unchanged plaintext when not enc-wrapped', () => {
    expect(decryptSecret('plaintext-value')).toBe('plaintext-value');
  });

  it('decrypts a wrapped value via safeStorage', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    safeStorageMock.decryptString.mockReturnValue('secret');

    const cipherBase64 = Buffer.from('CIPHER').toString('base64');
    const out = decryptSecret('enc:v1:' + cipherBase64);
    expect(out).toBe('secret');
    expect(safeStorageMock.decryptString).toHaveBeenCalledWith(
      Buffer.from(cipherBase64, 'base64')
    );
  });

  it('returns null when safeStorage is unavailable but value is wrapped', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    expect(decryptSecret('enc:v1:abc')).toBeNull();
  });

  it('returns null on decrypt failure without throwing', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    safeStorageMock.decryptString.mockImplementation(() => {
      throw new Error('bad key');
    });
    expect(decryptSecret('enc:v1:abc')).toBeNull();
  });
});

describe('round-trip', () => {
  it('encrypt → decrypt preserves the original secret', () => {
    let capturedBuffer: Buffer | null = null;
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    safeStorageMock.encryptString.mockImplementation((s: string) => {
      capturedBuffer = Buffer.from(`ENC(${s})`);
      return capturedBuffer;
    });
    safeStorageMock.decryptString.mockImplementation((buf: Buffer) => {
      const s = buf.toString();
      return s.replace(/^ENC\((.*)\)$/, '$1');
    });

    const encoded = encryptSecret('my-smtp-password');
    expect(encoded?.startsWith('enc:v1:')).toBe(true);
    const decoded = decryptSecret(encoded);
    expect(decoded).toBe('my-smtp-password');
  });
});
