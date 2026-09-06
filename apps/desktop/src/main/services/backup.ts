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
