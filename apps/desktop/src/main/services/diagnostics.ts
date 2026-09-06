import fs from 'fs';
import os from 'os';
import path from 'path';
import { app, shell } from 'electron';
import type { IDatabase } from './database.interface';
import { logger } from './logger';

export interface StorageStats {
  userDataPath: string;
  databaseFile: string | null;
  databaseBytes: number | null;
  backupsPath: string;
  backupCount: number;
  backupsBytes: number;
  logsPath: string;
  logsBytes: number;
}

function dirSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(full);
        } else {
          total += fs.statSync(full).size;
        }
      } catch {
        // Best-effort — an in-flight rename can vanish under us.
      }
    }
  }
  return total;
}

function backupsDir(): string {
  return path.join(app.getPath('userData'), 'backups');
}

function logsDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function collectStorageStats(): StorageStats {
  const userDataPath = app.getPath('userData');
  const dbFile = path.join(userDataPath, 'envoy.db');
  const backups = backupsDir();
  const logs = logsDir();

  let backupCount = 0;
  if (fs.existsSync(backups)) {
    try {
      backupCount = fs
        .readdirSync(backups)
        .filter((name) => name.endsWith('.json') || name.endsWith('.db'))
        .length;
    } catch {
      backupCount = 0;
    }
  }

  const databaseExists = fs.existsSync(dbFile);
  return {
    userDataPath,
    databaseFile: databaseExists ? dbFile : null,
    databaseBytes: databaseExists ? safeSize(dbFile) : null,
    backupsPath: backups,
    backupCount,
    backupsBytes: dirSize(backups),
    logsPath: logs,
    logsBytes: dirSize(logs),
  };
}

function safeSize(file: string): number | null {
  try {
    return fs.statSync(file).size;
  } catch {
    return null;
  }
}

export async function runDatabaseVacuum(
  db: IDatabase
): Promise<{ success: boolean; freedBytes?: number; sizeBefore?: number; sizeAfter?: number; error?: string }> {
  try {
    const result = await db.vacuum();
    logger.info('Database VACUUM ran', result);
    return { success: true, ...result };
  } catch (err) {
    logger.error('Database VACUUM failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Vacuum failed',
    };
  }
}

export async function runDatabaseIntegrityCheck(
  db: IDatabase
): Promise<{ ok: boolean; issues: string[]; error?: string }> {
  try {
    const result = await db.checkIntegrity();
    if (result.ok) {
      logger.info('DB integrity check OK');
    } else {
      logger.warn('DB integrity check flagged issues', { issues: result.issues });
    }
    return result;
  } catch (err) {
    logger.error('DB integrity check failed', err);
    return {
      ok: false,
      issues: [],
      error: err instanceof Error ? err.message : 'Integrity check failed',
    };
  }
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function tailLogFile(filePath: string, lines: number): string {
  try {
    if (!fs.existsSync(filePath)) return '(no log file yet)';
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split(/\r?\n/).slice(-lines).join('\n');
  } catch (err) {
    return `(unable to read log: ${err instanceof Error ? err.message : 'unknown'})`;
  }
}

/**
 * Collects a support-ready debug report — version, platform, storage sizes,
 * integrity status, and the tail of main.log — into a single copy-pasteable
 * text blob. Used by the 'Copy Debug Info' Command Palette action.
 *
 * Sensitive content is deliberately excluded: no credentials, no backup file
 * contents, no user data. The tail of the log is included on the assumption
 * that logger.warn/error already avoid sensitive fields.
 */
export async function collectDebugInfo(db: IDatabase): Promise<string> {
  const stats = collectStorageStats();
  let integrity: { ok: boolean; issues: string[]; error?: string };
  try {
    integrity = await db.checkIntegrity();
  } catch (err) {
    integrity = { ok: false, issues: [], error: err instanceof Error ? err.message : 'unknown' };
  }

  const logsPath = path.join(app.getPath('userData'), 'logs', 'main.log');
  const logTail = tailLogFile(logsPath, 40);

  const lines = [
    `Envoy Debug Info — ${new Date().toISOString()}`,
    '',
    `App version: ${app.getVersion()}`,
    `Platform: ${process.platform} ${process.arch}`,
    `OS: ${os.release()}`,
    `Node: ${process.versions.node}`,
    `Electron: ${process.versions.electron ?? 'n/a'}`,
    `Chrome: ${process.versions.chrome ?? 'n/a'}`,
    '',
    `User data: ${stats.userDataPath}`,
    `Database: ${stats.databaseFile ?? '(none)'} — ${formatBytes(stats.databaseBytes)}`,
    `Backups: ${stats.backupCount} file(s) — ${formatBytes(stats.backupsBytes)} in ${stats.backupsPath}`,
    `Logs: ${formatBytes(stats.logsBytes)} in ${stats.logsPath}`,
    '',
    `Integrity: ${integrity.ok ? 'OK' : `ISSUES (${integrity.error ?? integrity.issues.join(', ')})`}`,
    '',
    '--- log tail (40 lines) ---',
    logTail,
  ];
  return lines.join('\n');
}

/**
 * Open the userData/backups directory in the OS file manager. Returns the
 * path that was opened so the caller can surface it in a toast.
 */
export async function openBackupsFolder(): Promise<{ success: boolean; path: string; error?: string }> {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const errMsg = await shell.openPath(dir);
  if (errMsg) {
    logger.warn('openBackupsFolder failed', { errMsg });
    return { success: false, path: dir, error: errMsg };
  }
  return { success: true, path: dir };
}
