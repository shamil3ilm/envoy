import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { appMock } = vi.hoisted(() => ({
  appMock: {
    getVersion: vi.fn(() => '1.0.0-test'),
  },
}));

vi.mock('electron', () => ({
  app: appMock,
}));

vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { collectBackup, writeBackupFile, type BackupEnvelope } from './backup';

interface StubDb {
  listContacts: () => Promise<unknown[]>;
  listContactGroups: () => Promise<unknown[]>;
  listTemplates: () => Promise<unknown[]>;
  listSnippets: () => Promise<unknown[]>;
  listTasks: () => Promise<unknown[]>;
  listNotes: () => Promise<unknown[]>;
  listNoteGroups: () => Promise<unknown[]>;
  listCalendarEvents: () => Promise<unknown[]>;
  listReminders: () => Promise<unknown[]>;
  listScheduledMessages: () => Promise<unknown[]>;
  listAuditLogs: (filter?: { limit?: number }) => Promise<unknown[]>;
  listExpenses: () => Promise<unknown[]>;
  listRichDocuments: () => Promise<unknown[]>;
  getSettings: () => Promise<unknown>;
}

function makeDb(): StubDb {
  return {
    listContacts: async () => [{ id: '1', name: 'Alice' }],
    listContactGroups: async () => [],
    listTemplates: async () => [{ id: 't1', name: 'Greeting' }, { id: 't2', name: 'Update' }],
    listSnippets: async () => [{ id: 's1', name: 'Sig' }],
    listTasks: async () => [],
    listNotes: async () => [{ id: 'n1', title: 'Notes' }],
    listNoteGroups: async () => [],
    listCalendarEvents: async () => [],
    listReminders: async () => [{ id: 'r1', title: 'Call back' }],
    listScheduledMessages: async () => [],
    listAuditLogs: async () => [],
    listExpenses: async () => [{ id: 'e1', amount: 10 }],
    listRichDocuments: async () => [],
    getSettings: async () => ({ theme: 'dark' }),
  };
}

beforeEach(() => {
  appMock.getVersion.mockReturnValue('1.0.0-test');
});

describe('collectBackup', () => {
  it('rolls every entity list into a single envelope', async () => {
    const envelope = await collectBackup(makeDb() as never);

    expect(envelope.version).toBe(1);
    expect(envelope.appVersion).toBe('1.0.0-test');
    expect(envelope.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(envelope.entities.contacts).toHaveLength(1);
    expect(envelope.entities.templates).toHaveLength(2);
    expect(envelope.entities.settings).toEqual({ theme: 'dark' });
  });

  it('reports per-entity counts including single-object settings', async () => {
    const envelope = await collectBackup(makeDb() as never);
    expect(envelope.counts.contacts).toBe(1);
    expect(envelope.counts.templates).toBe(2);
    expect(envelope.counts.snippets).toBe(1);
    expect(envelope.counts.tasks).toBe(0);
    expect(envelope.counts.settings).toBe(1);
  });

  it('caps audit log limit to avoid unbounded scans', async () => {
    const db = makeDb();
    const spy = vi.spyOn(db, 'listAuditLogs');
    await collectBackup(db as never);
    expect(spy).toHaveBeenCalledWith({ limit: 100_000 });
  });
});

describe('writeBackupFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envoy-backup-test-'));
  });

  it('writes valid JSON to the target path', async () => {
    const envelope: BackupEnvelope = {
      version: 1,
      exportedAt: '2026-09-06T00:00:00Z',
      appVersion: '1.0.0-test',
      entities: {
        contacts: [{ id: 'a' }],
        contactGroups: [],
        templates: [],
        snippets: [],
        tasks: [],
        notes: [],
        noteGroups: [],
        calendarEvents: [],
        reminders: [],
        scheduledMessages: [],
        auditLogs: [],
        expenses: [],
        richDocuments: [],
        settings: {},
      },
      counts: { contacts: 1 },
    };
    const outputPath = path.join(tmpDir, 'backup.json');
    await writeBackupFile(outputPath, envelope);

    expect(fs.existsSync(outputPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(parsed.entities.contacts[0].id).toBe('a');
  });

  it('does not leave the .tmp file behind on success', async () => {
    const outputPath = path.join(tmpDir, 'nested', 'dir', 'backup.json');
    const envelope: BackupEnvelope = {
      version: 1,
      exportedAt: 'x',
      appVersion: 'x',
      entities: {
        contacts: [],
        contactGroups: [],
        templates: [],
        snippets: [],
        tasks: [],
        notes: [],
        noteGroups: [],
        calendarEvents: [],
        reminders: [],
        scheduledMessages: [],
        auditLogs: [],
        expenses: [],
        richDocuments: [],
        settings: null,
      },
      counts: {},
    };
    await writeBackupFile(outputPath, envelope);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.existsSync(outputPath + '.tmp')).toBe(false);
  });
});
