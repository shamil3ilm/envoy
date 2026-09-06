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

import {
  collectBackup,
  inspectBackupFile,
  restoreEnvelope,
  writeBackupFile,
  type BackupEnvelope,
} from './backup';

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

function makeEnvelope(overrides: Partial<BackupEnvelope> = {}): BackupEnvelope {
  return {
    version: 1,
    exportedAt: '2026-09-06T00:00:00Z',
    appVersion: '1.0.0-test',
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
      settings: {},
    },
    counts: {},
    ...overrides,
  };
}

describe('inspectBackupFile', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'envoy-inspect-test-'));
  });

  it('returns a summary for a valid envelope', () => {
    const filePath = path.join(tmp, 'valid.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        makeEnvelope({
          entities: {
            ...makeEnvelope().entities,
            contacts: [{ id: 'a' }, { id: 'b' }],
            templates: [{ id: 't1' }],
          },
        })
      )
    );
    const summary = inspectBackupFile(filePath);
    expect(summary.version).toBe(1);
    expect(summary.counts.contacts).toBe(2);
    expect(summary.counts.templates).toBe(1);
    expect(summary.totalRecords).toBe(4); // contacts:2 + templates:1 + settings:1
  });

  it('throws when the file is missing', () => {
    expect(() => inspectBackupFile(path.join(tmp, 'nope.json'))).toThrow(/does not exist/);
  });

  it('throws on non-JSON content', () => {
    const filePath = path.join(tmp, 'garbage.json');
    fs.writeFileSync(filePath, 'not json at all');
    expect(() => inspectBackupFile(filePath)).toThrow(/not valid JSON/);
  });

  it('throws on unsupported version', () => {
    const filePath = path.join(tmp, 'v9.json');
    fs.writeFileSync(filePath, JSON.stringify({ ...makeEnvelope(), version: 9 }));
    expect(() => inspectBackupFile(filePath)).toThrow(/Unsupported backup version/);
  });

  it('throws when entity keys are missing', () => {
    const filePath = path.join(tmp, 'partial.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        version: 1,
        exportedAt: 'x',
        entities: { contacts: [] },
      })
    );
    expect(() => inspectBackupFile(filePath)).toThrow(/missing entity keys/);
  });
});

describe('restoreEnvelope', () => {
  interface CallLog {
    op: 'create' | 'update';
    entity: string;
    id?: string;
    input: Record<string, unknown>;
  }

  function makeDb(existingIds: Record<string, Set<string>> = {}) {
    const log: CallLog[] = [];
    const entity = (name: string) => ({
      get: async (id: string) => (existingIds[name]?.has(id) ? { id } : null),
      create: async (input: Record<string, unknown>) => {
        log.push({ op: 'create', entity: name, input });
        return { id: 'new-' + Math.random().toString(36).slice(2, 8) };
      },
      update: async (id: string, input: Record<string, unknown>) => {
        log.push({ op: 'update', entity: name, id, input });
        return { id };
      },
    });

    const contacts = entity('contacts');
    const templates = entity('templates');
    const snippets = entity('snippets');
    const tasks = entity('tasks');
    const notes = entity('notes');
    const expenses = entity('expenses');
    const docs = entity('docs');
    const reminders = entity('reminders');
    const calendarEvents = entity('calendarEvents');
    const contactGroups = entity('contactGroups');
    const scheduledMessages = entity('scheduledMessages');
    const noteGroups = entity('noteGroups');
    let lastSettings: unknown = undefined;

    return {
      db: {
        getContact: contacts.get,
        createContact: contacts.create,
        updateContact: contacts.update,
        getTemplate: templates.get,
        createTemplate: templates.create,
        updateTemplate: templates.update,
        getSnippet: snippets.get,
        createSnippet: snippets.create,
        updateSnippet: snippets.update,
        getTask: tasks.get,
        createTask: tasks.create,
        updateTask: tasks.update,
        getNote: notes.get,
        createNote: notes.create,
        updateNote: notes.update,
        getExpense: expenses.get,
        createExpense: expenses.create,
        updateExpense: expenses.update,
        getRichDocument: docs.get,
        createRichDocument: docs.create,
        updateRichDocument: docs.update,
        getReminder: reminders.get,
        createReminder: reminders.create,
        updateReminder: reminders.update,
        getCalendarEvent: calendarEvents.get,
        createCalendarEvent: calendarEvents.create,
        updateCalendarEvent: calendarEvents.update,
        getContactGroup: contactGroups.get,
        createContactGroup: contactGroups.create,
        updateContactGroup: contactGroups.update,
        getScheduledMessage: scheduledMessages.get,
        createScheduledMessage: scheduledMessages.create,
        updateScheduledMessage: scheduledMessages.update,
        getNoteGroup: noteGroups.get,
        createNoteGroup: noteGroups.create,
        updateNoteGroup: noteGroups.update,
        setSettings: async (settings: unknown) => {
          lastSettings = settings;
        },
      },
      log,
      getLastSettings: () => lastSettings,
    };
  }

  it('creates new rows when the id is not present', async () => {
    const { db, log } = makeDb();
    const envelope = makeEnvelope({
      entities: {
        ...makeEnvelope().entities,
        contacts: [{ id: 'c1', name: 'Alice' }],
      },
    });
    const result = await restoreEnvelope(db, envelope);
    expect(result.applied.contacts).toBe(1);
    expect(result.totalApplied).toBe(1);
    expect(log[0]).toMatchObject({ op: 'create', entity: 'contacts' });
    expect((log[0].input as any).id).toBeUndefined(); // id is stripped
    expect((log[0].input as any).createdAt).toBeUndefined(); // timestamps stripped
  });

  it('updates existing rows in place', async () => {
    const { db, log } = makeDb({ contacts: new Set(['c1']) });
    const envelope = makeEnvelope({
      entities: {
        ...makeEnvelope().entities,
        contacts: [{ id: 'c1', name: 'Alice v2' }],
      },
    });
    await restoreEnvelope(db, envelope);
    expect(log[0]).toMatchObject({ op: 'update', entity: 'contacts', id: 'c1' });
  });

  it('counts a malformed row as skipped, not applied', async () => {
    const { db } = makeDb();
    const envelope = makeEnvelope({
      entities: {
        ...makeEnvelope().entities,
        contacts: [null as unknown as { id: string }, { id: 'ok', name: 'Bob' }],
      },
    });
    const result = await restoreEnvelope(db, envelope);
    expect(result.applied.contacts).toBe(1);
    expect(result.skipped.contacts).toBe(1);
  });

  it('does not throw when a single row fails; records as skipped', async () => {
    const { db } = makeDb();
    db.createContact = async () => {
      throw new Error('write failed');
    };
    const envelope = makeEnvelope({
      entities: {
        ...makeEnvelope().entities,
        contacts: [{ id: 'x', name: 'boom' }],
      },
    });
    const result = await restoreEnvelope(db, envelope);
    expect(result.applied.contacts).toBe(0);
    expect(result.skipped.contacts).toBe(1);
  });

  it('restores reminders / calendar / contact groups / scheduled messages', async () => {
    const { db, log } = makeDb();
    const envelope = makeEnvelope({
      entities: {
        ...makeEnvelope().entities,
        reminders: [{ id: 'r1', title: 'Call Alice' }],
        calendarEvents: [{ id: 'c1', title: 'Standup' }],
        contactGroups: [{ id: 'g1', name: 'Family' }],
        scheduledMessages: [{ id: 'm1', channel: 'email' }],
      },
    });
    const result = await restoreEnvelope(db, envelope);
    expect(result.applied.reminders).toBe(1);
    expect(result.applied.calendarEvents).toBe(1);
    expect(result.applied.contactGroups).toBe(1);
    expect(result.applied.scheduledMessages).toBe(1);
    expect(log.filter((l) => l.entity === 'reminders')[0]).toMatchObject({ op: 'create' });
    expect(log.filter((l) => l.entity === 'calendarEvents')[0]).toMatchObject({ op: 'create' });
  });

  it('restores note groups and settings', async () => {
    const { db, getLastSettings } = makeDb();
    const envelope = makeEnvelope({
      entities: {
        ...makeEnvelope().entities,
        noteGroups: [{ id: 'ng1', name: 'Ideas' }],
        settings: { theme: 'dark', accentColor: 'blue' },
      },
    });
    const result = await restoreEnvelope(db, envelope);
    expect(result.applied.noteGroups).toBe(1);
    expect(result.applied.settings).toBe(1);
    expect(getLastSettings()).toEqual({ theme: 'dark', accentColor: 'blue' });
  });

  it('counts a settings restore failure as skipped without throwing', async () => {
    const { db } = makeDb();
    db.setSettings = async () => {
      throw new Error('settings write failed');
    };
    const envelope = makeEnvelope({
      entities: {
        ...makeEnvelope().entities,
        settings: { theme: 'dark' },
      },
    });
    const result = await restoreEnvelope(db, envelope);
    expect(result.applied.settings).toBe(0);
    expect(result.skipped.settings).toBe(1);
  });
});
