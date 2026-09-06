import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { appMock } = vi.hoisted(() => ({
  appMock: { getVersion: vi.fn(() => '1.0.0-test'), getPath: vi.fn() },
}));

vi.mock('electron', () => ({ app: appMock }));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  newestAutoBackupPath,
  rotateOldBackups,
  runAutoBackupIfDue,
  _testExports,
  _testResetState,
} from './backup-scheduler';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'envoy-scheduler-test-'));
}

function makeStubDb() {
  return {
    listContacts: async () => [{ id: 'c1' }],
    listContactGroups: async () => [],
    listTemplates: async () => [],
    listSnippets: async () => [],
    listTasks: async () => [],
    listNotes: async () => [],
    listNoteGroups: async () => [],
    listCalendarEvents: async () => [],
    listReminders: async () => [],
    listScheduledMessages: async () => [],
    listAuditLogs: async () => [],
    listExpenses: async () => [],
    listRichDocuments: async () => [],
    getSettings: async () => ({}),
  };
}

beforeEach(() => {
  _testResetState();
  const dir = makeTempDir();
  appMock.getPath.mockImplementation(() => dir);
});

describe('runAutoBackupIfDue', () => {
  it('does nothing when disabled', async () => {
    const db = makeStubDb();
    const result = await runAutoBackupIfDue(db as never, {
      enabled: false,
      intervalHours: 24,
      keepCount: 7,
    });
    expect(result.ran).toBe(false);
    expect(result.reason).toBe('disabled');
  });

  it('writes a backup on first run', async () => {
    const db = makeStubDb();
    const result = await runAutoBackupIfDue(db as never, {
      enabled: true,
      intervalHours: 24,
      keepCount: 7,
    });
    expect(result.ran).toBe(true);
    expect(result.path).toBeDefined();
    expect(fs.existsSync(result.path!)).toBe(true);
    const contents = JSON.parse(fs.readFileSync(result.path!, 'utf8'));
    expect(contents.entities.contacts).toHaveLength(1);
  });

  it('skips when the interval window has not yet elapsed', async () => {
    const db = makeStubDb();
    // First run: writes the backup
    await runAutoBackupIfDue(db as never, {
      enabled: true,
      intervalHours: 24,
      keepCount: 7,
    });
    // Second immediate run: should be skipped
    const second = await runAutoBackupIfDue(db as never, {
      enabled: true,
      intervalHours: 24,
      keepCount: 7,
    });
    expect(second.ran).toBe(false);
    expect(second.reason).toBe('not yet due');
  });

  it('rotates old backups when count exceeds keepCount', async () => {
    const dir = _testExports.autoBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    // Create 5 fake auto-backup files with distinct timestamps.
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(
        path.join(dir, `auto-2026-01-0${i + 1}-000000-000Z.json`),
        '{}'
      );
    }
    expect(_testExports.listAutoBackups(dir)).toHaveLength(5);
    const removed = rotateOldBackups(dir, 2);
    expect(removed).toBe(3);
    const remaining = _testExports.listAutoBackups(dir);
    expect(remaining).toHaveLength(2);
    // Newest 2 should survive (last in sort order).
    expect(remaining).toEqual([
      'auto-2026-01-04-000000-000Z.json',
      'auto-2026-01-05-000000-000Z.json',
    ]);
  });

  it('rotate is a no-op when file count is within limit', () => {
    const dir = _testExports.autoBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'auto-2026-01-01-000000-000Z.json'), '{}');
    const removed = rotateOldBackups(dir, 7);
    expect(removed).toBe(0);
    expect(_testExports.listAutoBackups(dir)).toHaveLength(1);
  });

  it('rotate is safe when the directory does not exist yet', () => {
    const missing = path.join(os.tmpdir(), 'envoy-nonexistent-' + Date.now());
    const removed = rotateOldBackups(missing, 7);
    expect(removed).toBe(0);
  });
});

describe('newestAutoBackupPath', () => {
  it('returns null when there are no auto-backup files', () => {
    expect(newestAutoBackupPath()).toBeNull();
  });

  it('returns the newest file by lexicographic sort', () => {
    const dir = _testExports.autoBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'auto-2026-01-05-000000-000Z.json'), '{}');
    fs.writeFileSync(path.join(dir, 'auto-2026-01-01-000000-000Z.json'), '{}');
    fs.writeFileSync(path.join(dir, 'auto-2026-01-10-000000-000Z.json'), '{}');
    const newest = newestAutoBackupPath();
    expect(newest).not.toBeNull();
    expect(path.basename(newest!)).toBe('auto-2026-01-10-000000-000Z.json');
  });

  it('ignores non-auto-prefixed files in the same directory', () => {
    const dir = _testExports.autoBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'auto-2026-01-01-000000-000Z.json'), '{}');
    fs.writeFileSync(path.join(dir, 'manual-export.json'), '{}');
    fs.writeFileSync(path.join(dir, 'envoy-pre-restore-anything.json'), '{}');
    expect(path.basename(newestAutoBackupPath()!)).toBe(
      'auto-2026-01-01-000000-000Z.json'
    );
  });
});
