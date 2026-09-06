import type { IDatabase } from '@envoy/database-core';

/**
 * Version 1 backup envelope. Kept structurally identical to the desktop
 * BackupEnvelope so a file exported from one platform can be inspected on
 * the other. Email credentials are intentionally excluded — the mobile
 * equivalents (Notifee push tokens, OAuth refresh tokens if we add them)
 * are device-scoped and can't be portably re-imported.
 */
export interface MobileBackupEnvelope {
  version: 1;
  exportedAt: string;
  appVersion: string;
  platform: 'mobile';
  entities: {
    contacts: unknown[];
    templates: unknown[];
    snippets: unknown[];
    tasks: unknown[];
    notes: unknown[];
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

export async function collectMobileBackup(
  db: IDatabase,
  appVersion: string
): Promise<MobileBackupEnvelope> {
  const [
    contacts,
    templates,
    snippets,
    tasks,
    notes,
    calendarEvents,
    reminders,
    scheduledMessages,
    auditLogs,
    expenses,
    richDocuments,
    settings,
  ] = await Promise.all([
    db.listContacts(),
    db.listTemplates(),
    db.listSnippets(),
    db.listTasks(),
    db.listNotes(),
    db.listCalendarEvents(),
    db.listReminders(),
    db.listScheduledMessages(),
    db.listAuditLogs({ limit: 100_000 }),
    db.listExpenses(),
    db.listRichDocuments(),
    db.getSettings(),
  ]);

  const entities: MobileBackupEnvelope['entities'] = {
    contacts,
    templates,
    snippets,
    tasks,
    notes,
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
    appVersion,
    platform: 'mobile',
    entities,
    counts,
  };
}

export function summarizeBackup(envelope: MobileBackupEnvelope): string {
  const parts: string[] = [];
  parts.push(`Envoy backup — exported ${new Date(envelope.exportedAt).toLocaleString()}`);
  parts.push(`Records: ${Object.values(envelope.counts).reduce((sum, n) => sum + n, 0)}`);
  return parts.join('\n');
}

// A superset of MobileBackupEnvelope's entities so we accept envelopes exported
// from either desktop or mobile. Desktop adds contactGroups/noteGroups.
interface AnyEnvelope {
  version?: unknown;
  exportedAt?: unknown;
  appVersion?: unknown;
  entities?: Record<string, unknown>;
  counts?: Record<string, number>;
}

export interface ParsedBackupSummary {
  version: number;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  totalRecords: number;
}

const MOBILE_REQUIRED_KEYS = [
  'contacts',
  'templates',
  'snippets',
  'tasks',
  'notes',
  'calendarEvents',
  'reminders',
  'scheduledMessages',
  'auditLogs',
  'expenses',
  'richDocuments',
  'settings',
] as const;

/**
 * Parse and validate a pasted-JSON backup envelope. Accepts both
 * desktop-flavoured and mobile-flavoured exports — desktop's extra
 * contactGroups/noteGroups keys are ignored gracefully.
 */
export function parseBackupEnvelope(raw: string): {
  envelope: AnyEnvelope;
  summary: ParsedBackupSummary;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup envelope is not an object');
  }
  const env = parsed as AnyEnvelope;
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
  for (const key of MOBILE_REQUIRED_KEYS) {
    if (!(key in env.entities)) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(`Backup is missing entity keys: ${missing.join(', ')}`);
  }

  const counts: Record<string, number> = {};
  let totalRecords = 0;
  for (const key of MOBILE_REQUIRED_KEYS) {
    const value = env.entities[key];
    const n = Array.isArray(value) ? value.length : value ? 1 : 0;
    counts[key] = n;
    totalRecords += n;
  }

  return {
    envelope: env,
    summary: {
      version: env.version,
      exportedAt: env.exportedAt,
      appVersion: typeof env.appVersion === 'string' ? env.appVersion : 'unknown',
      counts,
      totalRecords,
    },
  };
}

export interface MobileRestoreResult {
  applied: Record<string, number>;
  skipped: Record<string, number>;
  totalApplied: number;
}

interface RowLike {
  id?: unknown;
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
      const { id: _stripId, createdAt, updatedAt, ...input } = row as any;
      if (id && (await get(id))) {
        await update(id, input);
      } else {
        await create(input);
      }
      applied++;
    } catch (err) {
      console.warn('Restore row failed', { id, err });
      skipped++;
    }
  }
  return { applied, skipped };
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
}

/**
 * Additive merge — nothing gets deleted. Existing rows update in place by id,
 * new rows create fresh. Malformed rows count as skipped so a single bad row
 * can't strand the rest of the restore.
 *
 * Reminders / calendar events / scheduled messages / audit logs are omitted
 * pending create-input adapters (mirroring the desktop restoreEnvelope).
 */
export async function restoreMobileBackup(
  db: RestoreDatabase,
  envelope: AnyEnvelope
): Promise<MobileRestoreResult> {
  const applied: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const entities = envelope.entities ?? {};

  const runSet = async <T extends RowLike>(
    key: string,
    rows: T[],
    get: (id: string) => Promise<unknown>,
    create: (input: any) => Promise<{ id: string }>,
    update: (id: string, input: any) => Promise<unknown>
  ) => {
    const result = await upsertList(rows, get, create, update);
    applied[key] = result.applied;
    skipped[key] = result.skipped;
  };

  await runSet(
    'contacts',
    (entities.contacts as RowLike[]) ?? [],
    db.getContact,
    db.createContact,
    db.updateContact
  );
  await runSet(
    'templates',
    (entities.templates as RowLike[]) ?? [],
    db.getTemplate,
    db.createTemplate,
    db.updateTemplate
  );
  await runSet(
    'snippets',
    (entities.snippets as RowLike[]) ?? [],
    db.getSnippet,
    db.createSnippet,
    db.updateSnippet
  );
  await runSet(
    'tasks',
    (entities.tasks as RowLike[]) ?? [],
    db.getTask,
    db.createTask,
    db.updateTask
  );
  await runSet(
    'notes',
    (entities.notes as RowLike[]) ?? [],
    db.getNote,
    db.createNote,
    db.updateNote
  );
  await runSet(
    'expenses',
    (entities.expenses as RowLike[]) ?? [],
    db.getExpense,
    db.createExpense,
    db.updateExpense
  );
  await runSet(
    'richDocuments',
    (entities.richDocuments as RowLike[]) ?? [],
    db.getRichDocument,
    db.createRichDocument,
    db.updateRichDocument
  );

  const totalApplied = Object.values(applied).reduce((sum, n) => sum + n, 0);
  return { applied, skipped, totalApplied };
}
