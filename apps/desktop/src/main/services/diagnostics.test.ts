import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { appMock, shellMock } = vi.hoisted(() => ({
  appMock: { getPath: vi.fn(), getVersion: vi.fn(() => '1.0.0-test') },
  shellMock: { openPath: vi.fn(async () => '') },
}));

vi.mock('electron', () => ({ app: appMock, shell: shellMock }));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  collectDebugInfo,
  collectStorageStats,
  openBackupsFolder,
  runDatabaseIntegrityCheck,
  runDatabaseVacuum,
} from './diagnostics';

let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envoy-diag-test-'));
  appMock.getPath.mockImplementation(() => userDataDir);
  shellMock.openPath.mockReset();
  shellMock.openPath.mockResolvedValue('');
});

describe('collectStorageStats', () => {
  it('reports zero when nothing exists', () => {
    const stats = collectStorageStats();
    expect(stats.userDataPath).toBe(userDataDir);
    expect(stats.databaseFile).toBeNull();
    expect(stats.databaseBytes).toBeNull();
    expect(stats.backupCount).toBe(0);
    expect(stats.backupsBytes).toBe(0);
    expect(stats.logsBytes).toBe(0);
  });

  it('measures database, backup and log sizes when files exist', () => {
    fs.writeFileSync(path.join(userDataDir, 'envoy.db'), 'x'.repeat(1000));
    const backupsDir = path.join(userDataDir, 'backups');
    fs.mkdirSync(backupsDir);
    fs.writeFileSync(path.join(backupsDir, 'a.json'), 'x'.repeat(500));
    fs.writeFileSync(path.join(backupsDir, 'b.json'), 'x'.repeat(200));
    fs.writeFileSync(path.join(backupsDir, 'c.db'), 'x'.repeat(300));
    fs.writeFileSync(path.join(backupsDir, 'ignore.txt'), 'x'.repeat(50));
    const logsDir = path.join(userDataDir, 'logs');
    fs.mkdirSync(logsDir);
    fs.writeFileSync(path.join(logsDir, 'main.log'), 'x'.repeat(700));

    const stats = collectStorageStats();
    expect(stats.databaseFile).toBe(path.join(userDataDir, 'envoy.db'));
    expect(stats.databaseBytes).toBe(1000);
    expect(stats.backupCount).toBe(3); // ignore.txt excluded
    expect(stats.backupsBytes).toBe(500 + 200 + 300 + 50); // dirSize is total
    expect(stats.logsBytes).toBe(700);
  });
});

describe('runDatabaseIntegrityCheck', () => {
  it('passes through an ok result', async () => {
    const db = {
      checkIntegrity: async () => ({ ok: true, issues: [] }),
    };
    const result = await runDatabaseIntegrityCheck(db as never);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('surfaces the reported issues', async () => {
    const db = {
      checkIntegrity: async () => ({
        ok: false,
        issues: ['row 3 missing from index x_idx', 'wrong page hash'],
      }),
    };
    const result = await runDatabaseIntegrityCheck(db as never);
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it('catches thrown errors and returns them as error', async () => {
    const db = {
      checkIntegrity: async () => {
        throw new Error('database locked');
      },
    };
    const result = await runDatabaseIntegrityCheck(db as never);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('database locked');
  });
});

describe('openBackupsFolder', () => {
  it('creates the directory if missing and asks shell to open it', async () => {
    const result = await openBackupsFolder();
    expect(result.success).toBe(true);
    expect(result.path).toBe(path.join(userDataDir, 'backups'));
    expect(fs.existsSync(result.path)).toBe(true);
    expect(shellMock.openPath).toHaveBeenCalledWith(result.path);
  });

  it('reports failure when shell.openPath returns an error string', async () => {
    shellMock.openPath.mockResolvedValue('No application registered for jsonl');
    const result = await openBackupsFolder();
    expect(result.success).toBe(false);
    expect(result.error).toBe('No application registered for jsonl');
  });
});

describe('runDatabaseVacuum', () => {
  it('returns success with freed byte counts', async () => {
    const db = {
      vacuum: async () => ({ freedBytes: 12345, sizeBefore: 200000, sizeAfter: 187655 }),
    };
    const result = await runDatabaseVacuum(db as never);
    expect(result.success).toBe(true);
    expect(result.freedBytes).toBe(12345);
    expect(result.sizeBefore).toBe(200000);
    expect(result.sizeAfter).toBe(187655);
  });

  it('catches thrown errors and returns them as error', async () => {
    const db = {
      vacuum: async () => {
        throw new Error('database is locked');
      },
    };
    const result = await runDatabaseVacuum(db as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe('database is locked');
  });
});

describe('collectDebugInfo', () => {
  it('assembles a report with headers, integrity, and log tail', async () => {
    const db = {
      checkIntegrity: async () => ({ ok: true, issues: [] }),
    };
    // Seed a fake main.log with more lines than the tail (40) to prove trimming.
    const logsDirPath = path.join(userDataDir, 'logs');
    fs.mkdirSync(logsDirPath);
    const logLines: string[] = [];
    for (let i = 0; i < 100; i++) logLines.push(`line ${i}`);
    fs.writeFileSync(path.join(logsDirPath, 'main.log'), logLines.join('\n'));

    const text = await collectDebugInfo(db as never);
    expect(text).toContain('Envoy Debug Info');
    expect(text).toContain(`Platform: ${process.platform} ${process.arch}`);
    expect(text).toContain('Integrity: OK');
    expect(text).toContain('--- log tail (40 lines) ---');
    // Newest 40 lines should be present, oldest ones dropped.
    expect(text).toContain('line 99');
    expect(text).not.toContain('line 0\n');
  });

  it('reports ISSUES + reason when integrity fails', async () => {
    const db = {
      checkIntegrity: async () => ({ ok: false, issues: ['row 3 bad hash'] }),
    };
    const text = await collectDebugInfo(db as never);
    expect(text).toContain('Integrity: ISSUES');
    expect(text).toContain('row 3 bad hash');
  });

  it('surfaces a thrown integrity check as a captured error', async () => {
    const db = {
      checkIntegrity: async () => {
        throw new Error('DB locked');
      },
    };
    const text = await collectDebugInfo(db as never);
    expect(text).toContain('Integrity: ISSUES (DB locked)');
  });

  it('handles a missing log file gracefully', async () => {
    const db = {
      checkIntegrity: async () => ({ ok: true, issues: [] }),
    };
    const text = await collectDebugInfo(db as never);
    expect(text).toContain('(no log file yet)');
  });
});
