import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { IDatabase } from './database.interface';
import { collectBackup, writeBackupFile } from './backup';
import { logger } from './logger';
import { logBackupEvent } from './backup-audit';

const AUTO_PREFIX = 'auto-';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface SchedulerOptions {
  enabled: boolean;
  intervalHours: number;
  keepCount: number;
}

const DEFAULT_OPTIONS: SchedulerOptions = {
  enabled: false,
  intervalHours: 24,
  keepCount: 7,
};

let timer: NodeJS.Timeout | null = null;
let currentOptions: SchedulerOptions = { ...DEFAULT_OPTIONS };

function autoBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

/**
 * Timestamp shape matches ISO but with `:` and `.` replaced so Windows accepts
 * it as a filename. Sorts lexicographically so the newest is always last.
 */
function timestampFilename(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, '-');
  return `${AUTO_PREFIX}${iso}.json`;
}

function listAutoBackups(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(AUTO_PREFIX) && name.endsWith('.json'))
    .sort();
}

export function rotateOldBackups(dir: string, keepCount: number): number {
  const files = listAutoBackups(dir);
  const toDelete = files.slice(0, Math.max(0, files.length - keepCount));
  let removed = 0;
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, file));
      removed++;
    } catch (err) {
      logger.warn('Backup rotation failed to remove', { file, err });
    }
  }
  return removed;
}

/**
 * Returns the mtime of the newest auto-backup file, or null if none exist.
 * Used to decide whether the interval window has elapsed since last run.
 */
function newestBackupMtime(dir: string): Date | null {
  const files = listAutoBackups(dir);
  if (files.length === 0) return null;
  const newest = files[files.length - 1];
  try {
    return fs.statSync(path.join(dir, newest)).mtime;
  } catch {
    return null;
  }
}

export async function runAutoBackupIfDue(
  db: IDatabase,
  options: SchedulerOptions
): Promise<{ ran: boolean; path?: string; rotated?: number; reason?: string }> {
  if (!options.enabled) return { ran: false, reason: 'disabled' };
  const dir = autoBackupDir();
  const last = newestBackupMtime(dir);
  const now = Date.now();
  const windowMs = Math.max(1, options.intervalHours) * 60 * 60 * 1000;
  if (last && now - last.getTime() < windowMs) {
    return { ran: false, reason: 'not yet due' };
  }

  const envelope = await collectBackup(db);
  const outputPath = path.join(dir, timestampFilename());
  await writeBackupFile(outputPath, envelope);
  const rotated = rotateOldBackups(dir, options.keepCount);
  logger.info('Auto-backup written', { path: outputPath, rotated });
  const total = Object.values(envelope.counts).reduce((sum, n) => sum + n, 0);
  await logBackupEvent(db, {
    action: 'backup_auto_run',
    description: `Auto-backup wrote ${total} records`,
    details: { path: outputPath, rotated, counts: envelope.counts },
  });
  return { ran: true, path: outputPath, rotated };
}

/**
 * Start the auto-backup scheduler. Idempotent — a second call replaces the
 * running timer with the new options (used when the user updates settings).
 */
export function startAutoBackup(db: IDatabase, options: Partial<SchedulerOptions>): void {
  currentOptions = { ...DEFAULT_OPTIONS, ...options };
  stopAutoBackup();

  if (!currentOptions.enabled) {
    logger.info('Auto-backup disabled');
    return;
  }

  logger.info('Auto-backup enabled', currentOptions);

  // Check on start so a long-idle machine catches up.
  runAutoBackupIfDue(db, currentOptions).catch((err) => {
    logger.error('Initial auto-backup failed', err);
  });

  timer = setInterval(() => {
    runAutoBackupIfDue(db, currentOptions).catch((err) => {
      logger.error('Scheduled auto-backup failed', err);
    });
  }, CHECK_INTERVAL_MS);
}

export function stopAutoBackup(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function getAutoBackupStatus(): {
  enabled: boolean;
  intervalHours: number;
  keepCount: number;
  lastRunAt: string | null;
  fileCount: number;
} {
  const dir = autoBackupDir();
  const last = newestBackupMtime(dir);
  return {
    enabled: currentOptions.enabled,
    intervalHours: currentOptions.intervalHours,
    keepCount: currentOptions.keepCount,
    lastRunAt: last ? last.toISOString() : null,
    fileCount: listAutoBackups(dir).length,
  };
}

/**
 * Returns the absolute path to the newest auto-backup file, or null when
 * no auto backups exist yet. Callers can pass this straight to
 * inspectBackupFile / restoreEnvelope for one-click recovery.
 */
export function newestAutoBackupPath(): string | null {
  const dir = autoBackupDir();
  const files = listAutoBackups(dir);
  if (files.length === 0) return null;
  return path.join(dir, files[files.length - 1]);
}

/**
 * Runs a shutdown backup with a hard timeout so app quit is never delayed
 * more than a couple of seconds. Skips when auto-backup is disabled, when
 * a run already happened within the configured interval, or when the
 * timeout fires first. Meant to be awaited in the app's before-quit hook.
 */
export async function runShutdownBackup(
  db: IDatabase,
  timeoutMs = 3000
): Promise<{ ran: boolean; reason?: string }> {
  if (!currentOptions.enabled) return { ran: false, reason: 'disabled' };

  return new Promise((resolve) => {
    let settled = false;
    const finalize = (result: { ran: boolean; reason?: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      logger.warn('Shutdown backup timed out');
      finalize({ ran: false, reason: 'timeout' });
    }, timeoutMs);

    runAutoBackupIfDue(db, currentOptions)
      .then((result) => {
        clearTimeout(timer);
        finalize({ ran: result.ran, reason: result.reason });
      })
      .catch((err) => {
        clearTimeout(timer);
        logger.error('Shutdown backup failed', err);
        finalize({ ran: false, reason: 'error' });
      });
  });
}

export function _testResetState(): void {
  stopAutoBackup();
  currentOptions = { ...DEFAULT_OPTIONS };
}

export const _testExports = {
  listAutoBackups,
  timestampFilename,
  autoBackupDir,
};
