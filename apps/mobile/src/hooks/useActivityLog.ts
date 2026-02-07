import { useCallback } from 'react';
import type { ActivityAction, ActivityCategory, CreateActivityLogInput } from '@envoy/shared';
import { useDatabase } from '../contexts/DatabaseContext';

export function useActivityLog() {
  const db = useDatabase();

  const log = useCallback(
    async (
      action: ActivityAction,
      category: ActivityCategory,
      description: string,
      options?: { entityId?: string; entityName?: string; details?: Record<string, unknown> }
    ) => {
      if (!db) return;
      const input: CreateActivityLogInput = {
        action,
        category,
        description,
        ...options,
      };
      try {
        await db.createActivityLog(input);
      } catch (error) {
        console.warn('Failed to log activity:', error);
      }
    },
    [db]
  );

  return {
    log,
    // Template shortcuts
    logTemplateCreated: (id: string, name: string) => log('template_created', 'template', `Created template "${name}"`, { entityId: id, entityName: name }),
    logTemplateUpdated: (id: string, name: string) => log('template_updated', 'template', `Updated template "${name}"`, { entityId: id, entityName: name }),
    logTemplateDeleted: (id: string, name: string) => log('template_deleted', 'template', `Deleted template "${name}"`, { entityId: id, entityName: name }),
    // Contact shortcuts
    logContactCreated: (id: string, name: string) => log('contact_created', 'contact', `Created contact "${name}"`, { entityId: id, entityName: name }),
    logContactUpdated: (id: string, name: string) => log('contact_updated', 'contact', `Updated contact "${name}"`, { entityId: id, entityName: name }),
    logContactDeleted: (id: string, name: string) => log('contact_deleted', 'contact', `Deleted contact "${name}"`, { entityId: id, entityName: name }),
    // Email shortcuts
    logEmailSent: (id: string, recipient: string) => log('email_sent', 'email', `Sent email to "${recipient}"`, { entityId: id, entityName: recipient }),
    logEmailFailed: (id: string, recipient: string, error: string) => log('email_failed', 'email', `Failed to send email to "${recipient}": ${error}`, { entityId: id, entityName: recipient }),
    // Task shortcuts
    logTaskCreated: (id: string, title: string) => log('task_created', 'task', `Created task "${title}"`, { entityId: id, entityName: title }),
    logTaskUpdated: (id: string, title: string) => log('task_updated', 'task', `Updated task "${title}"`, { entityId: id, entityName: title }),
    logTaskDeleted: (id: string, title: string) => log('task_deleted', 'task', `Deleted task "${title}"`, { entityId: id, entityName: title }),
    // Note shortcuts
    logNoteCreated: (id: string, title: string) => log('note_created', 'note', `Created note "${title}"`, { entityId: id, entityName: title }),
    logNoteUpdated: (id: string, title: string) => log('note_updated', 'note', `Updated note "${title}"`, { entityId: id, entityName: title }),
    logNoteDeleted: (id: string, title: string) => log('note_deleted', 'note', `Deleted note "${title}"`, { entityId: id, entityName: title }),
    // Expense shortcuts
    logExpenseCreated: (id: string, desc: string) => log('expense_created', 'expense', `Created expense "${desc}"`, { entityId: id, entityName: desc }),
    logExpenseDeleted: (id: string, desc: string) => log('expense_deleted', 'expense', `Deleted expense "${desc}"`, { entityId: id, entityName: desc }),
    // Snippet shortcuts
    logSnippetCreated: (id: string, name: string) => log('snippet_created', 'snippet', `Created snippet "${name}"`, { entityId: id, entityName: name }),
    logSnippetUpdated: (id: string, name: string) => log('snippet_updated', 'snippet', `Updated snippet "${name}"`, { entityId: id, entityName: name }),
    logSnippetDeleted: (id: string, name: string) => log('snippet_deleted', 'snippet', `Deleted snippet "${name}"`, { entityId: id, entityName: name }),
  };
}
