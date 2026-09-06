import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { IDatabase } from './database.interface';
import { logger } from './logger';

export interface BackupEnvelope {
  version: 1;
  exportedAt: string;
  appVersion: string;
  entities: {
    contacts: unknown[];
    contactGroups: unknown[];
    templates: unknown[];
    snippets: unknown[];
    tasks: unknown[];
    notes: unknown[];
    noteGroups: unknown[];
    calendarEvents: unknown[];
    reminders: unknown[];
    scheduledMessages: unknown[];
    auditLogs: unknown[];
    expenses: unknown[];
    richDocuments: unknown[];
    settings: unknown;
  };
  counts: Record<string, number>;
}

export interface BackupSummary {
  version: number;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  totalRecords: number;
}

const REQUIRED_ENTITY_KEYS = [
  'contacts',
  'contactGroups',
  'templates',
  'snippets',
  'tasks',
  'notes',
  'noteGroups',
  'calendarEvents',
  'reminders',
  'scheduledMessages',
  'auditLogs',
  'expenses',
  'richDocuments',
  'settings',
] as const;

/**
 * Read a backup file, verify shape, and return summary metadata. Used for
 * the "before I restore, what's in this file?" preview flow.
 */
export function inspectBackupFile(filePath: string): BackupSummary {
  if (!fs.existsSync(filePath)) {
    throw new Error('File does not exist');
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('File is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup envelope is not an object');
  }
  const env = parsed as Partial<BackupEnvelope>;
  if (env.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(env.version)}`);
  }
  if (typeof env.exportedAt !== 'string' || !env.exportedAt) {
    throw new Error('Missing exportedAt timestamp');
  }
  if (!env.entities || typeof env.entities !== 'object') {
    throw new Error('Missing entities section');
  }
  const missing: string[] = [];
  for (const key of REQUIRED_ENTITY_KEYS) {
    if (!(key in env.entities)) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(`Backup is missing entity keys: ${missing.join(', ')}`);
  }

  const counts: Record<string, number> = {};
  let totalRecords = 0;
  for (const [key, value] of Object.entries(env.entities)) {
    const n = Array.isArray(value) ? value.length : value ? 1 : 0;
    counts[key] = n;
    totalRecords += n;
  }

  return {
    version: env.version,
    exportedAt: env.exportedAt,
    appVersion: env.appVersion ?? 'unknown',
    counts,
    totalRecords,
  };
}

/**
 * Collect every user-owned entity into a single JSON envelope. Kept as a
 * pure function of the database — safe to invoke from either a save-to-disk
 * IPC handler or a future "share sheet" flow.
 *
 * Credentials in email_accounts are intentionally omitted: they are
 * encrypted at rest via safeStorage and cannot be decrypted on a different
 * OS profile anyway. Users must re-add email accounts after restore.
 */
export async function collectBackup(db: IDatabase): Promise<BackupEnvelope> {
  const [
    contacts,
    contactGroups,
    templates,
    snippets,
    tasks,
    notes,
    noteGroups,
    calendarEvents,
    reminders,
    scheduledMessages,
    auditLogs,
    expenses,
    richDocuments,
    settings,
  ] = await Promise.all([
    db.listContacts(),
    db.listContactGroups(),
    db.listTemplates(),
    db.listSnippets(),
    db.listTasks(),
    db.listNotes(),
    db.listNoteGroups(),
    db.listCalendarEvents(),
    db.listReminders(),
    db.listScheduledMessages(),
    db.listAuditLogs({ limit: 100_000 }),
    db.listExpenses(),
    db.listRichDocuments(),
    db.getSettings(),
  ]);

  const entities: BackupEnvelope['entities'] = {
    contacts,
    contactGroups,
    templates,
    snippets,
    tasks,
    notes,
    noteGroups,
    calendarEvents,
    reminders,
    scheduledMessages,
    auditLogs,
    expenses,
    richDocuments,
    settings,
  };

  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(entities)) {
    counts[key] = Array.isArray(value) ? value.length : value ? 1 : 0;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    entities,
    counts,
  };
}

/**
 * Write a backup envelope to disk atomically. Writes to a `.tmp` file first
 * then renames — so a crash mid-write leaves the previous file intact.
 */
export async function writeBackupFile(
  outputPath: string,
  envelope: BackupEnvelope
): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = outputPath + '.tmp';
  const json = JSON.stringify(envelope, null, 2);
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, outputPath);
  logger.info('Backup written', { outputPath, bytes: json.length });
}

export interface RestoreResult {
  applied: Record<string, number>;
  skipped: Record<string, number>;
  totalApplied: number;
}

interface RowLike {
  id?: unknown;
}

interface RestoreDatabase {
  createContact: (input: any) => Promise<{ id: string }>;
  updateContact: (id: string, input: any) => Promise<unknown>;
  getContact: (id: string) => Promise<unknown>;
  createTemplate: (input: any) => Promise<{ id: string }>;
  updateTemplate: (id: string, input: any) => Promise<unknown>;
  getTemplate: (id: string) => Promise<unknown>;
  createSnippet: (input: any) => Promise<{ id: string }>;
  updateSnippet: (id: string, input: any) => Promise<unknown>;
  getSnippet: (id: string) => Promise<unknown>;
  createTask: (input: any) => Promise<{ id: string }>;
  updateTask: (id: string, input: any) => Promise<unknown>;
  getTask: (id: string) => Promise<unknown>;
  createNote: (input: any) => Promise<{ id: string }>;
  updateNote: (id: string, input: any) => Promise<unknown>;
  getNote: (id: string) => Promise<unknown>;
  createExpense: (input: any) => Promise<{ id: string }>;
  updateExpense: (id: string, input: any) => Promise<unknown>;
  getExpense: (id: string) => Promise<unknown>;
  createRichDocument: (input: any) => Promise<{ id: string }>;
  updateRichDocument: (id: string, input: any) => Promise<unknown>;
  getRichDocument: (id: string) => Promise<unknown>;
  createReminder: (input: any) => Promise<{ id: string }>;
  updateReminder: (id: string, input: any) => Promise<unknown>;
  getReminder: (id: string) => Promise<unknown>;
  createCalendarEvent: (input: any) => Promise<{ id: string }>;
  updateCalendarEvent: (id: string, input: any) => Promise<unknown>;
  getCalendarEvent: (id: string) => Promise<unknown>;
  createContactGroup: (input: any) => Promise<{ id: string }>;
  updateContactGroup: (id: string, input: any) => Promise<unknown>;
  getContactGroup: (id: string) => Promise<unknown>;
  createScheduledMessage: (input: any) => Promise<{ id: string }>;
  updateScheduledMessage: (id: string, input: any) => Promise<unknown>;
  getScheduledMessage: (id: string) => Promise<unknown>;
  createNoteGroup: (input: any) => Promise<{ id: string }>;
  updateNoteGroup: (id: string, input: any) => Promise<unknown>;
  getNoteGroup: (id: string) => Promise<unknown>;
  setSettings: (settings: any) => Promise<void>;
}

// Fields that never come from user input and would confuse the DB layer if
// echoed back on create/update. Stripped uniformly across every entity.
const NON_INPUT_FIELDS = ['id', 'createdAt', 'updatedAt'];

function stripNonInputFields<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!NON_INPUT_FIELDS.includes(key)) {
      out[key] = value;
    }
  }
  return out;
}

async function upsertList<T extends RowLike>(
  rows: T[],
  get: (id: string) => Promise<unknown>,
  create: (input: any) => Promise<{ id: string }>,
  update: (id: string, input: any) => Promise<unknown>
): Promise<{ applied: number; skipped: number }> {
  let applied = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      skipped++;
      continue;
    }
    const id = typeof row.id === 'string' ? row.id : null;
    try {
      const input = stripNonInputFields(row as Record<string, unknown>);
      if (id && (await get(id))) {
        await update(id, input);
      } else {
        await create(input);
      }
      applied++;
    } catch (err) {
      logger.warn('Restore row failed', { id, err });
      skipped++;
    }
  }
  return { applied, skipped };
}

/**
 * Merge a backup envelope into the running database. For every entity type
 * with a stable `id`, existing rows update in place and unknown IDs create.
 * Deletions on the source side are NOT propagated — this is a strict
 * additive/upsert merge so the user never loses data they already had.
 *
 * Audit logs, calendar events, contact groups, note groups, scheduled
 * messages, and reminders are skipped for now — their create signatures
 * don't match the shape the export produces without deeper adapters.
 * They'll ship in a follow-up.
 */
export async function restoreEnvelope(
  db: RestoreDatabase,
  envelope: BackupEnvelope
): Promise<RestoreResult> {
  const applied: Record<string, number> = {};
  const skipped: Record<string, number> = {};

  const contacts = await upsertList(
    envelope.entities.contacts as RowLike[],
    (id) => db.getContact(id),
    (input) => db.createContact(input),
    (id, input) => db.updateContact(id, input) as Promise<unknown>
  );
  applied.contacts = contacts.applied;
  skipped.contacts = contacts.skipped;

  const templates = await upsertList(
    envelope.entities.templates as RowLike[],
    (id) => db.getTemplate(id),
    (input) => db.createTemplate(input),
    (id, input) => db.updateTemplate(id, input) as Promise<unknown>
  );
  applied.templates = templates.applied;
  skipped.templates = templates.skipped;

  const snippets = await upsertList(
    envelope.entities.snippets as RowLike[],
    (id) => db.getSnippet(id),
    (input) => db.createSnippet(input),
    (id, input) => db.updateSnippet(id, input) as Promise<unknown>
  );
  applied.snippets = snippets.applied;
  skipped.snippets = snippets.skipped;

  const tasks = await upsertList(
    envelope.entities.tasks as RowLike[],
    (id) => db.getTask(id),
    (input) => db.createTask(input),
    (id, input) => db.updateTask(id, input) as Promise<unknown>
  );
  applied.tasks = tasks.applied;
  skipped.tasks = tasks.skipped;

  const notes = await upsertList(
    envelope.entities.notes as RowLike[],
    (id) => db.getNote(id),
    (input) => db.createNote(input),
    (id, input) => db.updateNote(id, input) as Promise<unknown>
  );
  applied.notes = notes.applied;
  skipped.notes = notes.skipped;

  const expenses = await upsertList(
    envelope.entities.expenses as RowLike[],
    (id) => db.getExpense(id),
    (input) => db.createExpense(input),
    (id, input) => db.updateExpense(id, input) as Promise<unknown>
  );
  applied.expenses = expenses.applied;
  skipped.expenses = expenses.skipped;

  const documents = await upsertList(
    envelope.entities.richDocuments as RowLike[],
    (id) => db.getRichDocument(id),
    (input) => db.createRichDocument(input),
    (id, input) => db.updateRichDocument(id, input) as Promise<unknown>
  );
  applied.richDocuments = documents.applied;
  skipped.richDocuments = documents.skipped;

  const reminders = await upsertList(
    envelope.entities.reminders as RowLike[],
    (id) => db.getReminder(id),
    (input) => db.createReminder(input),
    (id, input) => db.updateReminder(id, input) as Promise<unknown>
  );
  applied.reminders = reminders.applied;
  skipped.reminders = reminders.skipped;

  const calendarEvents = await upsertList(
    envelope.entities.calendarEvents as RowLike[],
    (id) => db.getCalendarEvent(id),
    (input) => db.createCalendarEvent(input),
    (id, input) => db.updateCalendarEvent(id, input) as Promise<unknown>
  );
  applied.calendarEvents = calendarEvents.applied;
  skipped.calendarEvents = calendarEvents.skipped;

  const contactGroups = await upsertList(
    envelope.entities.contactGroups as RowLike[],
    (id) => db.getContactGroup(id),
    (input) => db.createContactGroup(input),
    (id, input) => db.updateContactGroup(id, input) as Promise<unknown>
  );
  applied.contactGroups = contactGroups.applied;
  skipped.contactGroups = contactGroups.skipped;

  const scheduledMessages = await upsertList(
    envelope.entities.scheduledMessages as RowLike[],
    (id) => db.getScheduledMessage(id),
    (input) => db.createScheduledMessage(input),
    (id, input) => db.updateScheduledMessage(id, input) as Promise<unknown>
  );
  applied.scheduledMessages = scheduledMessages.applied;
  skipped.scheduledMessages = scheduledMessages.skipped;

  const noteGroups = await upsertList(
    envelope.entities.noteGroups as RowLike[],
    (id) => db.getNoteGroup(id),
    (input) => db.createNoteGroup(input),
    (id, input) => db.updateNoteGroup(id, input) as Promise<unknown>
  );
  applied.noteGroups = noteGroups.applied;
  skipped.noteGroups = noteGroups.skipped;

  // Settings replace-in-place — one row per install, no id shape to merge on.
  // Skip empty objects: an export from a fresh install will have {} and there's
  // nothing meaningful to write back.
  applied.settings = 0;
  skipped.settings = 0;
  const settings = envelope.entities.settings;
  if (settings && typeof settings === 'object' && Object.keys(settings as object).length > 0) {
    try {
      await db.setSettings(settings);
      applied.settings = 1;
    } catch (err) {
      logger.warn('Settings restore failed', err);
      skipped.settings = 1;
    }
  }

  const totalApplied = Object.values(applied).reduce((sum, n) => sum + n, 0);
  return { applied, skipped, totalApplied };
}
