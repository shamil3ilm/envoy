import type { IDatabase } from '@envoy/database-core';
import { collectMobileBackup, parseBackupEnvelope, restoreMobileBackup } from './BackupService';

export interface SyncConfig {
  url: string; // e.g. http://192.168.1.42:47828
  token: string;
}

/**
 * Reachability probe — hits the desktop's /ping endpoint which is
 * intentionally unauthenticated so the mobile side can distinguish
 * 'wrong IP / firewall' from 'wrong token'.
 */
export async function pingDesktop(config: SyncConfig): Promise<{
  ok: boolean;
  appVersion?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${trimTrailingSlash(config.url)}/envoy/v1/ping`, {
      method: 'GET',
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = await res.json();
    return { ok: true, appVersion: body?.appVersion };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

/**
 * Pull the desktop's current envelope and merge it locally. Same additive
 * upsert-by-id semantics as the paste-JSON restore — nothing gets deleted.
 */
export async function pullFromDesktop(
  db: IDatabase,
  config: SyncConfig
): Promise<{
  success: boolean;
  totalApplied?: number;
  applied?: Record<string, number>;
  skipped?: Record<string, number>;
  error?: string;
}> {
  try {
    const res = await fetch(`${trimTrailingSlash(config.url)}/envoy/v1/envelope`, {
      method: 'GET',
      headers: { 'X-Envoy-Token': config.token },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status} ${text}` };
    }
    const raw = await res.text();
    const { envelope } = parseBackupEnvelope(raw);
    const result = await restoreMobileBackup(db as never, envelope);
    return {
      success: true,
      totalApplied: result.totalApplied,
      applied: result.applied,
      skipped: result.skipped,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Pull failed' };
  }
}

/**
 * Push the mobile envelope to the desktop for merge. Same shape as manual
 * export: never deletes on the desktop, just upserts by id.
 */
export async function pushToDesktop(
  db: IDatabase,
  appVersion: string,
  config: SyncConfig
): Promise<{
  success: boolean;
  totalApplied?: number;
  applied?: Record<string, number>;
  skipped?: Record<string, number>;
  error?: string;
}> {
  try {
    const envelope = await collectMobileBackup(db, appVersion);
    const res = await fetch(`${trimTrailingSlash(config.url)}/envoy/v1/envelope`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Envoy-Token': config.token,
      },
      body: JSON.stringify(envelope),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status} ${text}` };
    }
    const body = await res.json();
    return {
      success: true,
      totalApplied: body?.totalApplied,
      applied: body?.applied,
      skipped: body?.skipped,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Push failed' };
  }
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
