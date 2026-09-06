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
