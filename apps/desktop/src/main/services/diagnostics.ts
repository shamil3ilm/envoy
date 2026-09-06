import fs from 'fs';
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
