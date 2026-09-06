import { Platform } from 'react-native';
import type { IDatabase } from '@envoy/database-core';

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Mobile equivalent of the desktop collectDebugInfo. Same shape: a
 * paste-ready text blob for support triage, deliberately free of
 * credentials and user data.
 *
 * No log tail is included because Notifee / Sentry own the platform log
 * pipeline on mobile and there's no equivalent to `main.log` sitting on
 * disk. Users can attach a Sentry trace ID instead when reporting.
 */
export async function collectMobileDebugInfo(
  db: IDatabase,
  appVersion: string
): Promise<string> {
  let integrityText = 'OK';
  try {
    const integrity = await db.checkIntegrity();
    if (!integrity.ok) {
      integrityText = `ISSUES (${integrity.issues.join(', ') || 'unknown'})`;
    }
  } catch (err) {
    integrityText = `ISSUES (${err instanceof Error ? err.message : 'unknown'})`;
  }

  let dbSize: number | null = null;
  try {
    const result = await db.vacuum();
    // vacuum() also runs the compaction — we tolerate that here because the
    // report is meant to be diagnostic. Skip if the caller has already
    // vacuumed recently and doesn't want the side effect.
    dbSize = result.sizeAfter;
  } catch {
    dbSize = null;
  }

  const lines = [
    `Envoy Mobile Debug Info — ${new Date().toISOString()}`,
    '',
    `App version: ${appVersion}`,
    `Platform: ${Platform.OS} ${Platform.Version}`,
    '',
    `Database size: ${formatBytes(dbSize)}`,
    `Integrity: ${integrityText}`,
    '',
    '(Attach a Sentry trace ID separately if reporting a specific error.)',
  ];
  return lines.join('\n');
}

export interface VacuumResult {
  success: boolean;
  freedBytes?: number;
  sizeBefore?: number;
  sizeAfter?: number;
  error?: string;
}

export async function runMobileVacuum(db: IDatabase): Promise<VacuumResult> {
  try {
    const result = await db.vacuum();
    return { success: true, ...result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Vacuum failed',
    };
  }
}
