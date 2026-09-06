import { safeStorage } from 'electron';
import { logger } from './logger';

const ENCRYPTED_PREFIX = 'enc:v1:';

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }
  if (isEncrypted(plaintext)) {
    return plaintext;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    logger.warn('safeStorage unavailable — secret stored in plaintext');
    return plaintext;
  }
  const buf = safeStorage.encryptString(plaintext);
  return ENCRYPTED_PREFIX + buf.toString('base64');
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') {
    return null;
  }
  if (!isEncrypted(stored)) {
    return stored;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    logger.error('safeStorage unavailable — cannot decrypt secret');
    return null;
  }
  try {
    const b64 = stored.slice(ENCRYPTED_PREFIX.length);
    return safeStorage.decryptString(Buffer.from(b64, 'base64'));
  } catch (err) {
    logger.error('Failed to decrypt secret', err);
    return null;
  }
}
