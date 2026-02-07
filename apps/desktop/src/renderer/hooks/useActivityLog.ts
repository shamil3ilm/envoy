import { useCallback } from 'react';
import type { ActivityAction, ActivityCategory, CreateActivityLogInput } from '@shared/types';

export function useActivityLog() {
  const log = useCallback(
    async (
      action: ActivityAction,
      category: ActivityCategory,
      description: string,
      options?: {
        entityId?: string;
        entityName?: string;
        details?: Record<string, unknown>;
      }
    ) => {
      try {
        const input: CreateActivityLogInput = {
          action,
          category,
          description,
          ...options,
        };
        await window.envoy.activity.log(input);
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    },
    []
  );

  // Convenience methods for common actions
  const logTemplateCreated = useCallback(
    (templateId: string, templateName: string) => {
      log('template_created', 'template', `Created template "${templateName}"`, {
        entityId: templateId,
        entityName: templateName,
      });
    },
    [log]
  );

  const logTemplateUpdated = useCallback(
    (templateId: string, templateName: string) => {
      log('template_updated', 'template', `Updated template "${templateName}"`, {
        entityId: templateId,
        entityName: templateName,
      });
    },
    [log]
  );

  const logTemplateDeleted = useCallback(
    (templateId: string, templateName: string) => {
      log('template_deleted', 'template', `Deleted template "${templateName}"`, {
        entityId: templateId,
        entityName: templateName,
      });
    },
    [log]
  );

  const logContactCreated = useCallback(
    (contactId: string, contactName: string) => {
      log('contact_created', 'contact', `Created contact "${contactName}"`, {
        entityId: contactId,
        entityName: contactName,
      });
    },
    [log]
  );

  const logContactUpdated = useCallback(
    (contactId: string, contactName: string) => {
      log('contact_updated', 'contact', `Updated contact "${contactName}"`, {
        entityId: contactId,
        entityName: contactName,
      });
    },
    [log]
  );

  const logContactDeleted = useCallback(
    (contactId: string, contactName: string) => {
      log('contact_deleted', 'contact', `Deleted contact "${contactName}"`, {
        entityId: contactId,
        entityName: contactName,
      });
    },
    [log]
  );

  const logContactImported = useCallback(
    (count: number) => {
      log('contact_imported', 'contact', `Imported ${count} contacts from CSV`, {
        details: { count },
      });
    },
    [log]
  );

  const logEmailSent = useCallback(
    (recipientEmail: string, recipientName: string, templateName?: string) => {
      log(
        'email_sent',
        'email',
        `Sent email to "${recipientName}" (${recipientEmail})${templateName ? ` using "${templateName}"` : ''}`,
        {
          entityName: recipientEmail,
          details: { recipientName, templateName },
        }
      );
    },
    [log]
  );

  const logEmailFailed = useCallback(
    (recipientEmail: string, error: string) => {
      log('email_failed', 'email', `Failed to send email to "${recipientEmail}": ${error}`, {
        entityName: recipientEmail,
        details: { error },
      });
    },
    [log]
  );

  const logEmailAccountAdded = useCallback(
    (accountId: string, accountName: string, accountEmail: string) => {
      log('email_account_added', 'email', `Added email account "${accountName}" (${accountEmail})`, {
        entityId: accountId,
        entityName: accountName,
        details: { email: accountEmail },
      });
    },
    [log]
  );

  const logEmailAccountRemoved = useCallback(
    (accountId: string, accountName: string) => {
      log('email_account_removed', 'email', `Removed email account "${accountName}"`, {
        entityId: accountId,
        entityName: accountName,
      });
    },
    [log]
  );

  const logSettingsUpdated = useCallback(
    (settings: Record<string, unknown>) => {
      log('settings_updated', 'settings', 'Updated application settings', {
        details: settings,
      });
    },
    [log]
  );

  // Document convenience methods
  const logDocumentGenerated = useCallback(
    (docName: string, details?: Record<string, unknown>) => {
      log('document_generated', 'document', `Generated document "${docName}"`, {
        entityName: docName,
        details,
      });
    },
    [log]
  );

  const logDocumentCreated = useCallback(
    (docId: string, docName: string) => {
      log('document_created', 'document', `Created document "${docName}"`, {
        entityId: docId,
        entityName: docName,
      });
    },
    [log]
  );

  const logDocumentUpdated = useCallback(
    (docId: string, docName: string) => {
      log('document_updated', 'document', `Updated document "${docName}"`, {
        entityId: docId,
        entityName: docName,
      });
    },
    [log]
  );

  // Task convenience methods
  const logTaskCreated = useCallback(
    (taskId: string, taskTitle: string) => {
      log('task_created', 'task', `Created task "${taskTitle}"`, {
        entityId: taskId,
        entityName: taskTitle,
      });
    },
    [log]
  );

  const logTaskUpdated = useCallback(
    (taskId: string, taskTitle: string) => {
      log('task_updated', 'task', `Updated task "${taskTitle}"`, {
        entityId: taskId,
        entityName: taskTitle,
      });
    },
    [log]
  );

  const logTaskDeleted = useCallback(
    (taskId: string, taskTitle: string) => {
      log('task_deleted', 'task', `Deleted task "${taskTitle}"`, {
        entityId: taskId,
        entityName: taskTitle,
      });
    },
    [log]
  );

  const logTaskArchived = useCallback(
    (taskId: string, taskTitle: string, archived: boolean) => {
      log('task_archived', 'task', `${archived ? 'Archived' : 'Restored'} task "${taskTitle}"`, {
        entityId: taskId,
        entityName: taskTitle,
        details: { archived },
      });
    },
    [log]
  );

  // Note convenience methods
  const logNoteCreated = useCallback(
    (noteId: string, noteTitle: string) => {
      log('note_created', 'note', `Created note "${noteTitle}"`, {
        entityId: noteId,
        entityName: noteTitle,
      });
    },
    [log]
  );

  const logNoteUpdated = useCallback(
    (noteId: string, noteTitle: string) => {
      log('note_updated', 'note', `Updated note "${noteTitle}"`, {
        entityId: noteId,
        entityName: noteTitle,
      });
    },
    [log]
  );

  const logNoteDeleted = useCallback(
    (noteId: string, noteTitle: string) => {
      log('note_deleted', 'note', `Deleted note "${noteTitle}"`, {
        entityId: noteId,
        entityName: noteTitle,
      });
    },
    [log]
  );

  // Snippet convenience methods
  const logSnippetCreated = useCallback(
    (snippetId: string, snippetName: string) => {
      log('snippet_created', 'snippet', `Created snippet "${snippetName}"`, {
        entityId: snippetId,
        entityName: snippetName,
      });
    },
    [log]
  );

  const logSnippetUpdated = useCallback(
    (snippetId: string, snippetName: string) => {
      log('snippet_updated', 'snippet', `Updated snippet "${snippetName}"`, {
        entityId: snippetId,
        entityName: snippetName,
      });
    },
    [log]
  );

  const logSnippetDeleted = useCallback(
    (snippetId: string, snippetName: string) => {
      log('snippet_deleted', 'snippet', `Deleted snippet "${snippetName}"`, {
        entityId: snippetId,
        entityName: snippetName,
      });
    },
    [log]
  );

  // Expense convenience methods
  const logExpenseCreated = useCallback(
    (expenseId: string, description: string) => {
      log('expense_created', 'expense', `Created expense "${description}"`, {
        entityId: expenseId,
        entityName: description,
      });
    },
    [log]
  );

  const logExpenseDeleted = useCallback(
    (expenseId: string, description: string) => {
      log('expense_deleted', 'expense', `Deleted expense "${description}"`, {
        entityId: expenseId,
        entityName: description,
      });
    },
    [log]
  );

  return {
    log,
    logTemplateCreated,
    logTemplateUpdated,
    logTemplateDeleted,
    logContactCreated,
    logContactUpdated,
    logContactDeleted,
    logContactImported,
    logEmailSent,
    logEmailFailed,
    logEmailAccountAdded,
    logEmailAccountRemoved,
    logSettingsUpdated,
    logDocumentGenerated,
    logDocumentCreated,
    logDocumentUpdated,
    logTaskCreated,
    logTaskUpdated,
    logTaskDeleted,
    logTaskArchived,
    logNoteCreated,
    logNoteUpdated,
    logNoteDeleted,
    logSnippetCreated,
    logSnippetUpdated,
    logSnippetDeleted,
    logExpenseCreated,
    logExpenseDeleted,
  };
}
