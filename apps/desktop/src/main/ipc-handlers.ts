import type { IpcMain, BrowserWindow as BW } from 'electron';
import { app, dialog, shell, BrowserWindow } from 'electron';
import type { IDatabase } from './services/database.interface';
import type { PythonBridge } from './python-bridge';
import type { EmailService } from './services/email.service';
import type { ReminderService } from './services/reminder.service';
import type { TeamsService } from './services/teams.service';
import { IPC_CHANNELS } from '../shared/types';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './services/logger';
import { buildMailtoUrl, isSafeExternalUrl, isSafeUwpFamilyName, sanitizeEmail } from './services/security';
import { collectBackup, inspectBackupFile, restoreEnvelope, writeBackupFile } from './services/backup';
import { getAutoBackupStatus, newestAutoBackupPath, startAutoBackup } from './services/backup-scheduler';
import { collectStorageStats, openBackupsFolder, runDatabaseIntegrityCheck } from './services/diagnostics';
import {
  csvImportPath,
  csvExportPath,
  soundUploadPath,
  docxUploadInput,
  openDialogOptions,
  saveDialogOptions,
  notificationSoundType,
  validate,
} from './services/ipc-validation';
import type {
  CreateTemplateInput,
  CreateContactInput,
  CreateContactGroupInput,
  CreateSnippetInput,
  AppSettings,
  GenerateDocumentRequest,
  SMTPConfig,
  EmailProviderType,
  CreateActivityLogInput,
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
  ScheduleStatus,
  CreateReminderInput,
  UpdateReminderInput,
  ReminderStatus,
  Contact,
  AuditLog,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  CreateNoteInput,
  UpdateNoteInput,
  CreateNoteGroupInput,
  UpdateNoteGroupInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseCategory,
  CreateDocxTemplateInput,
  UploadedDocxTemplate,
  NotificationSoundType,
  DesktopMailApp,
  CreateRichDocumentInput,
  UpdateRichDocumentInput,
  ExportPdfRequest,
  SavePdfRequest,
  SavedPdfEntry,
  RenderTempPdfRequest,
  CreateRuleInput,
  UpdateRuleInput,
} from '../shared/types';

// ============================================
// CSV UTILITIES
// ============================================

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

function escapeCSVField(field: string | undefined | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(headers: string[], rows: (string | undefined | null)[][]): string {
  const headerLine = headers.map(escapeCSVField).join(',');
  const dataLines = rows.map(row => row.map(escapeCSVField).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export function registerIpcHandlers(
  ipcMain: IpcMain,
  database: IDatabase,
  pythonBridge: PythonBridge,
  emailService: EmailService,
  reminderService?: ReminderService,
  teamsService?: TeamsService
): void {
  // ============================================
  // TEMPLATE HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.TEMPLATE_CREATE, async (_event, input: CreateTemplateInput) => {
    return database.createTemplate(input);
  });

  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_UPDATE,
    async (_event, id: string, input: Partial<CreateTemplateInput>) => {
      return database.updateTemplate(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.TEMPLATE_DELETE, async (_event, id: string) => {
    database.deleteTemplate(id);
  });

  ipcMain.handle(IPC_CHANNELS.TEMPLATE_GET, async (_event, id: string) => {
    return database.getTemplate(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_LIST,
    async (_event, filter?: { category?: string; channel?: string }) => {
      return database.listTemplates(filter);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEMPLATE_RENDER,
    async (_event, templateBody: string, data: Record<string, unknown>) => {
      try {
        const rendered = await pythonBridge.renderTemplate(templateBody, data);
        return { success: true, rendered };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to render template',
        };
      }
    }
  );

  // ============================================
  // CONTACT HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.CONTACT_CREATE, async (_event, input: CreateContactInput) => {
    return database.createContact(input);
  });

  ipcMain.handle(
    IPC_CHANNELS.CONTACT_UPDATE,
    async (_event, id: string, input: Partial<CreateContactInput>) => {
      return database.updateContact(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.CONTACT_DELETE, async (_event, id: string) => {
    database.deleteContact(id);
  });

  ipcMain.handle(IPC_CHANNELS.CONTACT_GET, async (_event, id: string) => {
    return database.getContact(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.CONTACT_LIST,
    async (_event, filter?: { search?: string; tags?: string[] }) => {
      return database.listContacts(filter);
    }
  );

  ipcMain.handle(IPC_CHANNELS.CONTACT_IMPORT, async (_event, csvPath: string) => {
    const check = validate(csvImportPath, csvPath);
    if (!check.ok) {
      logger.warn('CONTACT_IMPORT rejected', { error: check.error });
      return { imported: 0, errors: [check.error] };
    }
    const errors: string[] = [];
    let imported = 0;

    try {
      // Read the CSV file
      const content = fs.readFileSync(check.value, 'utf-8');
      const { headers, rows } = parseCSV(content);

      if (headers.length === 0) {
        return { imported: 0, errors: ['CSV file is empty or invalid'] };
      }

      // Normalize headers for mapping
      const headerMap = new Map<string, number>();
      headers.forEach((h, i) => {
        headerMap.set(h.toLowerCase().trim(), i);
      });

      // Define field mappings (CSV header -> Contact field)
      const fieldMappings: Record<string, string[]> = {
        name: ['name', 'full name', 'fullname', 'contact name', 'contact'],
        email: ['email', 'email address', 'e-mail', 'mail'],
        phone: ['phone', 'phone number', 'telephone', 'mobile', 'cell'],
        company: ['company', 'organization', 'org', 'company name'],
        title: ['title', 'job title', 'position', 'role'],
        timezone: ['timezone', 'time zone', 'tz'],
        tags: ['tags', 'labels', 'categories'],
      };

      // Find column indices for each field
      const columnIndices: Record<string, number> = {};
      for (const [field, aliases] of Object.entries(fieldMappings)) {
        for (const alias of aliases) {
          if (headerMap.has(alias)) {
            columnIndices[field] = headerMap.get(alias)!;
            break;
          }
        }
      }

      // Require at least a name column
      if (columnIndices.name === undefined) {
        return { imported: 0, errors: ['CSV must have a "name" column'] };
      }

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Account for header + 1-indexed

        try {
          const name = row[columnIndices.name]?.trim();
          if (!name) {
            errors.push(`Row ${rowNum}: Missing name, skipped`);
            continue;
          }

          const input: CreateContactInput = {
            name,
            email: columnIndices.email !== undefined ? row[columnIndices.email]?.trim() : undefined,
            phone: columnIndices.phone !== undefined ? row[columnIndices.phone]?.trim() : undefined,
            company: columnIndices.company !== undefined ? row[columnIndices.company]?.trim() : undefined,
            title: columnIndices.title !== undefined ? row[columnIndices.title]?.trim() : undefined,
            timezone: columnIndices.timezone !== undefined ? row[columnIndices.timezone]?.trim() : undefined,
            tags: columnIndices.tags !== undefined
              ? row[columnIndices.tags]?.split(';').map(t => t.trim()).filter(Boolean)
              : [],
            preferredChannel: 'email',
          };

          await database.createContact(input);
          imported++;
        } catch (error) {
          errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { imported, errors };
    } catch (error) {
      return {
        imported: 0,
        errors: [`Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.CONTACT_EXPORT, async (_event, outputPath: string) => {
    const check = validate(csvExportPath, outputPath);
    if (!check.ok) {
      logger.warn('CONTACT_EXPORT rejected', { error: check.error });
      throw new Error(check.error);
    }
    outputPath = check.value;
    try {
      // Get all contacts
      const contacts: Contact[] = await database.listContacts();

      // Define CSV headers
      const headers = [
        'Name',
        'Email',
        'Phone',
        'Company',
        'Title',
        'Timezone',
        'Preferred Channel',
        'Tags',
        'Last Contacted',
        'Created At',
      ];

      // Convert contacts to rows
      const rows = contacts.map(contact => [
        contact.name,
        contact.email,
        contact.phone,
        contact.company,
        contact.title,
        contact.timezone,
        contact.preferredChannel,
        contact.tags?.join(';'),
        contact.lastContacted,
        contact.createdAt,
      ]);

      // Generate CSV content
      const csvContent = generateCSV(headers, rows);

      // Ensure output directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(outputPath, csvContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to export contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // ============================================
  // EMAIL HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.EMAIL_SEND,
    async (
      _event,
      params: {
        accountId?: string;
        to: string | string[];
        subject: string;
        body: string;
        html?: boolean;
        attachments?: Array<{ filename: string; path: string }>;
      }
    ) => {
      const result = await emailService.sendEmail(
        {
          to: params.to,
          subject: params.subject,
          body: params.body,
          html: params.html,
          attachments: params.attachments,
        },
        params.accountId
      );

      // Log to audit
      if (result.success) {
        const account = params.accountId
          ? emailService.getAccount(params.accountId)
          : emailService.getDefaultAccount();

        const recipients = Array.isArray(params.to) ? params.to : [params.to];
        for (const recipient of recipients) {
          await database.createAuditLog({
            channel: 'email',
            templateId: '',
            templateName: 'Direct Send',
            recipientId: '',
            recipientName: recipient,
            recipientAddress: recipient,
            subject: params.subject,
            bodyPreview: params.body.substring(0, 200),
            attachments: params.attachments?.map((a) => a.filename) || [],
            status: 'sent',
            sentAt: new Date().toISOString(),
          });
        }
      }

      return result;
    }
  );

  ipcMain.handle(IPC_CHANNELS.EMAIL_ACCOUNT_LIST, async () => {
    return emailService.serializeAccounts(false);
  });

  ipcMain.handle(
    IPC_CHANNELS.EMAIL_ACCOUNT_ADD,
    async (
      _event,
      params: {
        name: string;
        type: EmailProviderType;
        fromName: string;
        fromEmail: string;
        config: SMTPConfig;
        isDefault?: boolean;
      }
    ) => {
      const account = await emailService.addAccount(
        params.name,
        params.type,
        params.fromName,
        params.fromEmail,
        params.config,
        params.isDefault
      );
      // Store account in database for persistence
      await database.saveEmailAccount(account);
      return account;
    }
  );

  ipcMain.handle(IPC_CHANNELS.EMAIL_ACCOUNT_REMOVE, async (_event, id: string) => {
    await emailService.removeAccount(id);
    await database.deleteEmailAccount(id);
  });

  ipcMain.handle(IPC_CHANNELS.EMAIL_ACCOUNT_TEST, async (_event, id: string) => {
    return emailService.testConnection(id);
  });

  // ============================================
  // DOCUMENT HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.DOCUMENT_GENERATE, async (_event, request: GenerateDocumentRequest) => {
    try {
      const { templateId, format, data, outputPath } = request;

      // Get template content (for now, use templateId as path)
      let filePath: string;

      if (format === 'pdf') {
        filePath = await pythonBridge.generatePdf(templateId, data, outputPath || '');
      } else {
        filePath = await pythonBridge.generateDocx(templateId, data, outputPath || '');
      }

      return { success: true, filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate document',
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENT_PREVIEW,
    async (_event, request: Omit<GenerateDocumentRequest, 'outputPath'>) => {
      try {
        // For preview, render to HTML
        const htmlTemplate = `<html><body>{{ content }}</body></html>`;
        const rendered = await pythonBridge.renderTemplate(htmlTemplate, request.data);
        return rendered;
      } catch (error) {
        throw error;
      }
    }
  );

  // ============================================
  // AUDIT HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.AUDIT_LIST,
    async (
      _event,
      filter?: {
        channel?: string;
        status?: string;
        fromDate?: string;
        toDate?: string;
        search?: string;
      }
    ) => {
      return database.listAuditLogs(filter);
    }
  );

  ipcMain.handle(IPC_CHANNELS.AUDIT_GET, async (_event, id: string) => {
    return database.getAuditLog(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.AUDIT_EXPORT,
    async (
      _event,
      outputPath: string,
      filter?: {
        channel?: string;
        status?: string;
        fromDate?: string;
        toDate?: string;
        search?: string;
      }
    ) => {
      try {
        // Get audit logs with filter
        const auditLogs: AuditLog[] = await database.listAuditLogs(filter);

        // Define CSV headers
        const headers = [
          'ID',
          'Channel',
          'Template Name',
          'Recipient Name',
          'Recipient Address',
          'Subject',
          'Body Preview',
          'Attachments',
          'Status',
          'Sent At',
          'Delivered At',
          'Error Message',
        ];

        // Convert audit logs to rows
        const rows = auditLogs.map(log => [
          log.id,
          log.channel,
          log.templateName,
          log.recipientName,
          log.recipientAddress,
          log.subject,
          log.bodyPreview,
          log.attachments?.join(';'),
          log.status,
          log.sentAt,
          log.deliveredAt,
          log.errorMessage,
        ]);

        // Generate CSV content
        const csvContent = generateCSV(headers, rows);

        // Ensure output directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write to file
        fs.writeFileSync(outputPath, csvContent, 'utf-8');
      } catch (error) {
        throw new Error(`Failed to export audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // ============================================
  // SETTINGS HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    const settings = await database.getSettings();
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings: Partial<AppSettings>) => {
    const result = await database.setSettings(settings);

    // Re-configure Teams service if client ID changed
    if (settings.teamsClientId !== undefined && teamsService) {
      if (settings.teamsClientId) {
        teamsService.configure(settings.teamsClientId);
      } else {
        teamsService.logout();
      }
    }

    return result;
  });

  // ============================================
  // PYTHON BRIDGE HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.PYTHON_STATUS, async () => {
    const running = pythonBridge.isRunning();
    if (running) {
      try {
        const version = await pythonBridge.getVersion();
        return { running: true, version: version.python };
      } catch {
        return { running: true };
      }
    }
    return { running: false };
  });

  ipcMain.handle(IPC_CHANNELS.PYTHON_RESTART, async () => {
    pythonBridge.stop();
    await pythonBridge.start();
  });

  // ============================================
  // ACTIVITY LOG HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.ACTIVITY_LOG_CREATE,
    async (_event, input: CreateActivityLogInput) => {
      return database.createActivityLog(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ACTIVITY_LOG_LIST,
    async (
      _event,
      filter?: {
        action?: string;
        category?: string;
        entityId?: string;
        fromDate?: string;
        toDate?: string;
        search?: string;
        limit?: number;
        offset?: number;
      }
    ) => {
      return database.listActivityLogs(filter);
    }
  );

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_LOG_GET, async (_event, id: string) => {
    return database.getActivityLog(id);
  });

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_LOG_CLEAR, async (_event, beforeDate?: string) => {
    return database.clearActivityLogs(beforeDate);
  });

  ipcMain.handle(IPC_CHANNELS.ACTIVITY_LOG_EXPORT, async () => {
    const { logs } = await database.listActivityLogs({ limit: 10000 });
    return logs;
  });

  // ============================================
  // SCHEDULED MESSAGE HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.SCHEDULE_CREATE,
    async (_event, input: CreateScheduledMessageInput) => {
      return database.createScheduledMessage(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SCHEDULE_UPDATE,
    async (_event, id: string, input: UpdateScheduledMessageInput) => {
      return database.updateScheduledMessage(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.SCHEDULE_DELETE, async (_event, id: string) => {
    return database.deleteScheduledMessage(id);
  });

  ipcMain.handle(IPC_CHANNELS.SCHEDULE_GET, async (_event, id: string) => {
    return database.getScheduledMessage(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.SCHEDULE_LIST,
    async (_event, filter?: { status?: ScheduleStatus; fromDate?: string; toDate?: string }) => {
      return database.listScheduledMessages(filter);
    }
  );

  ipcMain.handle(IPC_CHANNELS.SCHEDULE_CANCEL, async (_event, id: string) => {
    return database.updateScheduledMessage(id, { status: 'cancelled' });
  });

  // ============================================
  // REMINDER HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.REMINDER_CREATE,
    async (_event, input: CreateReminderInput) => {
      return database.createReminder(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REMINDER_UPDATE,
    async (_event, id: string, input: UpdateReminderInput) => {
      return database.updateReminder(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.REMINDER_DELETE, async (_event, id: string) => {
    return database.deleteReminder(id);
  });

  ipcMain.handle(IPC_CHANNELS.REMINDER_GET, async (_event, id: string) => {
    return database.getReminder(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.REMINDER_LIST,
    async (_event, filter?: { status?: ReminderStatus; type?: string; fromDate?: string; toDate?: string }) => {
      return database.listReminders(filter);
    }
  );

  ipcMain.handle(IPC_CHANNELS.REMINDER_SNOOZE, async (_event, id: string, minutes: number) => {
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    return database.updateReminder(id, { status: 'snoozed', snoozedUntil });
  });

  ipcMain.handle(IPC_CHANNELS.REMINDER_COMPLETE, async (_event, id: string) => {
    if (reminderService) {
      return reminderService.complete(id);
    }
    return database.updateReminder(id, { status: 'completed' });
  });

  ipcMain.handle(IPC_CHANNELS.REMINDER_DISMISS, async (_event, id: string) => {
    if (reminderService) {
      return reminderService.dismiss(id);
    }
    return database.updateReminder(id, { status: 'dismissed' });
  });

  // ============================================
  // SOUND HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.SOUND_UPLOAD, async (_event, type: NotificationSoundType) => {
    const typeCheck = validate(notificationSoundType, type);
    if (!typeCheck.ok) {
      logger.warn('SOUND_UPLOAD rejected — invalid type', { error: typeCheck.error });
      return null;
    }

    const result = await dialog.showOpenDialog({
      title: 'Select Notification Sound',
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const pathCheck = validate(soundUploadPath, result.filePaths[0]);
    if (!pathCheck.ok) {
      logger.warn('SOUND_UPLOAD rejected — invalid source', { error: pathCheck.error });
      return null;
    }
    const sourcePath = pathCheck.value;
    const soundsDir = path.join(app.getPath('userData'), 'sounds');

    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }

    const ext = path.extname(sourcePath);
    const destPath = path.join(soundsDir, `${typeCheck.value}${ext}`);

    fs.copyFileSync(sourcePath, destPath);
    return destPath;
  });

  ipcMain.handle(IPC_CHANNELS.SOUND_GET_PATH, async (_event, type: NotificationSoundType) => {
    const soundsDir = path.join(app.getPath('userData'), 'sounds');
    const extensions = ['mp3', 'wav', 'ogg'];

    for (const ext of extensions) {
      const filePath = path.join(soundsDir, `${type}.${ext}`);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }

    return null;
  });

  // ============================================
  // DIALOG HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FILE,
    async (
      _event,
      options: {
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        defaultPath?: string;
      }
    ) => {
      const check = validate(openDialogOptions, options ?? {});
      if (!check.ok) {
        logger.warn('DIALOG_OPEN_FILE rejected', { error: check.error });
        return null;
      }
      const safe = check.value;
      const result = await dialog.showOpenDialog({
        title: safe.title || 'Select File',
        filters: safe.filters || [{ name: 'All Files', extensions: ['*'] }],
        defaultPath: safe.defaultPath,
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SAVE_FILE,
    async (
      _event,
      options: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }
    ) => {
      const check = validate(saveDialogOptions, options ?? {});
      if (!check.ok) {
        logger.warn('DIALOG_SAVE_FILE rejected', { error: check.error });
        return null;
      }
      const safe = check.value;
      const result = await dialog.showSaveDialog({
        title: safe.title || 'Save File',
        defaultPath: safe.defaultPath,
        filters: safe.filters || [{ name: 'All Files', extensions: ['*'] }],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      return result.filePath;
    }
  );

  // ============================================
  // WHATSAPP HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.WHATSAPP_STATUS, async () => {
    // WhatsApp Web integration status
    // For now, we just indicate it's available via browser
    return { available: true, method: 'web' };
  });

  ipcMain.handle(
    IPC_CHANNELS.WHATSAPP_SEND,
    async (
      _event,
      params: {
        phone: string;
        message: string;
      }
    ) => {
      const { sanitizePhone } = require('./services/security');
      const cleanPhone = sanitizePhone(params.phone);
      if (!cleanPhone) {
        return { success: false, method: 'web', url: '', error: 'Invalid phone number' };
      }
      const encodedMessage = encodeURIComponent(String(params.message ?? '').slice(0, 4000));
      const whatsappUrl = `https://wa.me/${encodeURIComponent(cleanPhone)}?text=${encodedMessage}`;
      await shell.openExternal(whatsappUrl);
      return { success: true, method: 'web', url: whatsappUrl };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.WHATSAPP_OPEN_CHAT,
    async (
      _event,
      params: {
        phone: string;
      }
    ) => {
      const { sanitizePhone } = require('./services/security');
      const cleanPhone = sanitizePhone(params.phone);
      if (!cleanPhone) {
        return { success: false, url: '', error: 'Invalid phone number' };
      }
      const whatsappUrl = `https://wa.me/${encodeURIComponent(cleanPhone)}`;
      await shell.openExternal(whatsappUrl);
      return { success: true, url: whatsappUrl };
    }
  );

  // ============================================
  // TEAMS HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.TEAMS_STATUS, async () => {
    if (teamsService) {
      return teamsService.getStatus();
    }
    return { configured: false, loggedIn: false, email: null };
  });

  ipcMain.handle(
    IPC_CHANNELS.TEAMS_LOGIN,
    async () => {
      if (!teamsService) {
        return { success: false, error: 'Teams service not available' };
      }
      return teamsService.login();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEAMS_LOGOUT,
    async () => {
      if (teamsService) {
        teamsService.logout();
      }
      return { success: true };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEAMS_SEND,
    async (
      _event,
      params: {
        email: string;
        message: string;
      }
    ) => {
      if (!teamsService) {
        return { success: false, error: 'Teams service not available' };
      }
      return teamsService.sendMessage(params.email, params.message);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TEAMS_OPEN_CHAT,
    async (
      _event,
      params: {
        email: string;
      }
    ) => {
      const safeEmail = sanitizeEmail(params.email);
      if (!safeEmail) {
        return { success: false, url: '', error: 'Invalid email address' };
      }
      const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(safeEmail)}`;
      await shell.openExternal(teamsUrl);
      return { success: true, url: teamsUrl };
    }
  );

  // ============================================
  // SHELL HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
    async (_event, url: string) => {
      if (!isSafeExternalUrl(url)) {
        logger.warn('Blocked shell.openExternal with unsafe URL', { url });
        return { success: false, error: 'Invalid URL' };
      }
      await shell.openExternal(url);
      return { success: true };
    }
  );

  // Detect installed desktop mail apps
  ipcMain.handle(
    IPC_CHANNELS.DETECT_DESKTOP_MAIL_APPS,
    async (): Promise<DesktopMailApp[]> => {
      const apps: DesktopMailApp[] = [];
      const platform = process.platform;

      // Helper: run a shell command and return stdout
      const runCmd = (cmd: string, args: string[]): Promise<string | null> => {
        return new Promise((resolve) => {
          const { execFile: ef } = require('child_process');
          ef(cmd, args, { timeout: 5000 }, (err: Error | null, stdout: string) => {
            if (err || !stdout.trim()) return resolve(null);
            resolve(stdout.trim());
          });
        });
      };

      // Helper: check if a command is available via `where` (Windows) or `which` (Unix)
      const findExe = (name: string): Promise<string | null> => {
        const cmd = platform === 'win32' ? 'where' : 'which';
        return runCmd(cmd, [name]).then(out => out ? out.split(/\r?\n/)[0] : null);
      };

      // Helper: check multiple filesystem paths
      const findPath = (paths: string[]): string | null => {
        for (const p of paths) {
          try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
        }
        return null;
      };

      // Helper: detect Windows Store (UWP/MSIX) apps via PowerShell Get-AppxPackage
      const findUwpApp = (packageNamePattern: string): Promise<string | null> => {
        if (platform !== 'win32') return Promise.resolve(null);
        const script = `Get-AppxPackage -Name '${packageNamePattern}' | Select-Object -ExpandProperty PackageFamilyName -First 1`;
        return runCmd('powershell', ['-NoProfile', '-Command', script]);
      };

      if (platform === 'win32') {
        const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
        const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        const localApp = process.env['LOCALAPPDATA'] || '';

        // Microsoft Outlook - classic desktop install
        const outlookPath = findPath([
          path.join(pf, 'Microsoft Office', 'root', 'Office16', 'OUTLOOK.EXE'),
          path.join(pf86, 'Microsoft Office', 'root', 'Office16', 'OUTLOOK.EXE'),
          path.join(pf, 'Microsoft Office', 'root', 'Office15', 'OUTLOOK.EXE'),
          path.join(pf86, 'Microsoft Office', 'root', 'Office15', 'OUTLOOK.EXE'),
          path.join(pf, 'Microsoft Office', 'Office16', 'OUTLOOK.EXE'),
          path.join(pf86, 'Microsoft Office', 'Office16', 'OUTLOOK.EXE'),
        ]) || await findExe('OUTLOOK.EXE');

        if (outlookPath) {
          apps.push({ id: 'outlook-desktop', name: 'Outlook', path: outlookPath });
        } else {
          // Check for New Outlook (Windows Store / UWP app)
          const uwpFamily = await findUwpApp('Microsoft.OutlookForWindows');
          if (uwpFamily) {
            apps.push({ id: 'outlook-uwp', name: 'Outlook (New)', path: `uwp:${uwpFamily}` });
          }
        }

        // Mozilla Thunderbird
        const tbPath = findPath([
          path.join(pf, 'Mozilla Thunderbird', 'thunderbird.exe'),
          path.join(pf86, 'Mozilla Thunderbird', 'thunderbird.exe'),
        ]) || await findExe('thunderbird.exe');
        if (tbPath) {
          apps.push({ id: 'thunderbird', name: 'Thunderbird', path: tbPath });
        }

        // eM Client
        const emPath = findPath([
          path.join(pf, 'eM Client', 'MailClient.exe'),
          path.join(pf86, 'eM Client', 'MailClient.exe'),
          path.join(localApp, 'eM Client', 'MailClient.exe'),
        ]);
        if (emPath) {
          apps.push({ id: 'emclient', name: 'eM Client', path: emPath });
        }

        // Mailbird
        const mailbirdPath = findPath([
          path.join(localApp, 'Mailbird', 'Mailbird.exe'),
          path.join(pf, 'Mailbird', 'Mailbird.exe'),
        ]);
        if (mailbirdPath) {
          apps.push({ id: 'mailbird', name: 'Mailbird', path: mailbirdPath });
        }

        // Windows Mail (built-in UWP app)
        const winMailFamily = await findUwpApp('microsoft.windowscommunicationsapps');
        if (winMailFamily) {
          apps.push({ id: 'windows-mail', name: 'Windows Mail', path: `uwp:${winMailFamily}` });
        }
      } else if (platform === 'darwin') {
        if (fs.existsSync('/Applications/Mail.app')) {
          apps.push({ id: 'apple-mail', name: 'Apple Mail', path: '/Applications/Mail.app' });
        }
        if (fs.existsSync('/Applications/Microsoft Outlook.app')) {
          apps.push({ id: 'outlook-desktop', name: 'Outlook', path: '/Applications/Microsoft Outlook.app' });
        }
        if (fs.existsSync('/Applications/Thunderbird.app')) {
          apps.push({ id: 'thunderbird', name: 'Thunderbird', path: '/Applications/Thunderbird.app' });
        }
      }

      return apps;
    }
  );

  // Open compose in a desktop mail app.
  // All user-controlled strings pass through sanitizers before hitting execFile or shell.openExternal;
  // no shell-string concatenation, no `{ shell: true }`.
  ipcMain.handle(
    IPC_CHANNELS.OPEN_IN_DESKTOP_MAIL_APP,
    async (
      _event,
      params: { appId: string; appPath: string; to: string; subject: string; body: string }
    ): Promise<{ success: boolean; error?: string }> => {
      const { appId, appPath, to, subject, body } = params;
      const mailto = buildMailtoUrl(to, subject, body);
      if (!mailto) {
        return { success: false, error: 'Invalid recipient' };
      }

      try {
        if (appPath.startsWith('uwp:')) {
          const familyName = appPath.slice('uwp:'.length);
          if (!isSafeUwpFamilyName(familyName)) {
            logger.warn('Rejected unsafe UWP family name', { familyName });
            return { success: false, error: 'Invalid app identifier' };
          }
          // All UWP mail apps we care about (New Outlook, Windows Mail) register mailto:;
          // routing via the default handler is safer than shelling out.
          await shell.openExternal(mailto);
        } else if (appId === 'outlook-desktop') {
          const { execFile } = require('child_process');
          const safeSubject = String(subject ?? '').slice(0, 998);
          const safeBody = String(body ?? '').slice(0, 20000);
          const safeTo = sanitizeEmail(to);
          if (!safeTo) return { success: false, error: 'Invalid recipient' };
          const mailtoArg = `${safeTo}?subject=${encodeURIComponent(safeSubject)}&body=${encodeURIComponent(safeBody)}`;
          execFile(appPath, ['/c', 'ipm.note', '/m', mailtoArg]);
        } else {
          // Thunderbird, Apple Mail, and everything else: mailto: via the OS handler.
          // Thunderbird's -compose flag has a string-parsing format that cannot be safely
          // built from user-supplied strings, so we route through the mailto: handler instead.
          await shell.openExternal(mailto);
        }

        return { success: true };
      } catch (err) {
        logger.error('OPEN_IN_DESKTOP_MAIL_APP failed', err);
        return { success: false, error: 'Failed to open mail app' };
      }
    }
  );

  // ============================================
  // CONTACT GROUP HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.GROUP_CREATE,
    async (_event, input: CreateContactGroupInput) => {
      return database.createContactGroup(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GROUP_UPDATE,
    async (_event, id: string, input: Partial<CreateContactGroupInput>) => {
      return database.updateContactGroup(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GROUP_DELETE, async (_event, id: string) => {
    return database.deleteContactGroup(id);
  });

  ipcMain.handle(IPC_CHANNELS.GROUP_GET, async (_event, id: string) => {
    return database.getContactGroup(id);
  });

  ipcMain.handle(IPC_CHANNELS.GROUP_LIST, async () => {
    return database.listContactGroups();
  });

  ipcMain.handle(
    IPC_CHANNELS.GROUP_ADD_CONTACT,
    async (_event, groupId: string, contactId: string) => {
      return database.addContactToGroup(groupId, contactId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GROUP_REMOVE_CONTACT,
    async (_event, groupId: string, contactId: string) => {
      return database.removeContactFromGroup(groupId, contactId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GROUP_REORDER,
    async (_event, orderedIds: string[]) => {
      return database.reorderContactGroups(orderedIds);
    }
  );

  // ============================================
  // SNIPPET HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.SNIPPET_CREATE,
    async (_event, input: CreateSnippetInput) => {
      return database.createSnippet(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SNIPPET_UPDATE,
    async (_event, id: string, input: Partial<CreateSnippetInput>) => {
      return database.updateSnippet(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.SNIPPET_DELETE, async (_event, id: string) => {
    return database.deleteSnippet(id);
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPET_GET, async (_event, id: string) => {
    return database.getSnippet(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.SNIPPET_LIST,
    async (_event, filter?: { category?: string; search?: string }) => {
      return database.listSnippets(filter);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SNIPPET_INCREMENT_USAGE,
    async (_event, id: string) => {
      return database.incrementSnippetUsage(id);
    }
  );

  // ============================================
  // CALENDAR EVENT HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_CREATE,
    async (_event, input: CreateCalendarEventInput) => {
      return database.createCalendarEvent(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_UPDATE,
    async (_event, id: string, input: UpdateCalendarEventInput) => {
      return database.updateCalendarEvent(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.CALENDAR_DELETE, async (_event, id: string) => {
    return database.deleteCalendarEvent(id);
  });

  ipcMain.handle(IPC_CHANNELS.CALENDAR_GET, async (_event, id: string) => {
    return database.getCalendarEvent(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_LIST,
    async (_event, filter?: { fromDate?: string; toDate?: string; relatedContactId?: string }) => {
      return database.listCalendarEvents(filter);
    }
  );

  // ============================================
  // TASK HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.TASK_CREATE,
    async (_event, input: CreateTaskInput) => {
      return database.createTask(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASK_UPDATE,
    async (_event, id: string, input: UpdateTaskInput) => {
      return database.updateTask(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, async (_event, id: string) => {
    return database.deleteTask(id);
  });

  ipcMain.handle(IPC_CHANNELS.TASK_GET, async (_event, id: string) => {
    return database.getTask(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.TASK_LIST,
    async (_event, filter?: { status?: TaskStatus; priority?: string; search?: string }) => {
      return database.listTasks(filter);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASK_REORDER,
    async (_event, taskOrders: { id: string; order: number; status: TaskStatus }[]) => {
      return database.reorderTasks(taskOrders);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.TASK_COMPLETE_RECURRING,
    async (_event, id: string) => {
      const task = await database.getTask(id);
      if (!task) throw new Error('Task not found');

      await database.updateTask(id, { status: 'done' });

      let nextTask: Task | null = null;
      if (task.recurrence) {
        nextTask = await database.createNextTaskOccurrence(task);
      }

      return { completedTask: await database.getTask(id), nextTask };
    }
  );

  // ============================================
  // NOTE HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.NOTE_CREATE,
    async (_event, input: CreateNoteInput) => {
      return database.createNote(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.NOTE_UPDATE,
    async (_event, id: string, input: UpdateNoteInput) => {
      return database.updateNote(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.NOTE_DELETE, async (_event, id: string) => {
    return database.deleteNote(id);
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_GET, async (_event, id: string) => {
    return database.getNote(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.NOTE_LIST,
    async (_event, filter?: { search?: string; isPinned?: boolean; groupId?: string | null }) => {
      return database.listNotes(filter);
    }
  );

  // ============================================
  // NOTE GROUP HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.NOTE_GROUP_CREATE,
    async (_event, input: CreateNoteGroupInput) => {
      return database.createNoteGroup(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.NOTE_GROUP_UPDATE,
    async (_event, id: string, input: UpdateNoteGroupInput) => {
      return database.updateNoteGroup(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.NOTE_GROUP_DELETE, async (_event, id: string) => {
    return database.deleteNoteGroup(id);
  });

  ipcMain.handle(IPC_CHANNELS.NOTE_GROUP_LIST, async () => {
    return database.listNoteGroups();
  });

  // ============================================
  // EXPENSE HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.EXPENSE_CREATE,
    async (_event, input: CreateExpenseInput) => {
      return database.createExpense(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPENSE_UPDATE,
    async (_event, id: string, input: UpdateExpenseInput) => {
      return database.updateExpense(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.EXPENSE_DELETE, async (_event, id: string) => {
    return database.deleteExpense(id);
  });

  ipcMain.handle(IPC_CHANNELS.EXPENSE_GET, async (_event, id: string) => {
    return database.getExpense(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.EXPENSE_LIST,
    async (_event, filter?: { category?: ExpenseCategory; fromDate?: string; toDate?: string; search?: string }) => {
      return database.listExpenses(filter);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXPENSE_SUMMARY,
    async (_event, filter?: { fromDate?: string; toDate?: string }) => {
      return database.getExpenseSummary(filter);
    }
  );

  // ============================================
  // DOCX TEMPLATE HANDLERS
  // ============================================

  // Get the templates directory path
  const getTemplatesDir = () => {
    const userDataPath = app.getPath('userData');
    const templatesDir = path.join(userDataPath, 'docx-templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    return templatesDir;
  };

  ipcMain.handle(
    IPC_CHANNELS.DOCX_TEMPLATE_UPLOAD,
    async (
      _event,
      params: {
        sourcePath: string;
        name: string;
      }
    ) => {
      const check = validate(docxUploadInput, params);
      if (!check.ok) {
        logger.warn('DOCX_TEMPLATE_UPLOAD rejected', { error: check.error });
        return { success: false, error: check.error };
      }
      params = check.value;
      try {
        // Validate source file exists
        if (!fs.existsSync(params.sourcePath)) {
          return { success: false, error: 'Source file not found' };
        }

        // Validate the template first
        const validation = await pythonBridge.validateDocxTemplate(params.sourcePath);
        if (!validation.valid) {
          return { success: false, error: validation.errors.join(', ') };
        }

        // Parse the template to extract variables
        const info = await pythonBridge.parseDocxTemplate(params.sourcePath);

        // Generate unique filename
        const originalFileName = path.basename(params.sourcePath);
        const timestamp = Date.now();
        const newFileName = `${timestamp}_${originalFileName}`;
        const destPath = path.join(getTemplatesDir(), newFileName);

        // Copy file to templates directory
        fs.copyFileSync(params.sourcePath, destPath);

        // Save to database
        const template = await database.createDocxTemplate({
          name: params.name,
          originalFileName,
          filePath: destPath,
          variables: info.variables,
          variableDetails: info.variableDetails,
        });

        return { success: true, template };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to upload template',
        };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.DOCX_TEMPLATE_PARSE, async (_event, docxPath: string) => {
    try {
      const info = await pythonBridge.parseDocxTemplate(docxPath);
      return { success: true, info };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse template',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCX_TEMPLATE_VALIDATE, async (_event, docxPath: string) => {
    try {
      return await pythonBridge.validateDocxTemplate(docxPath);
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Failed to validate template'],
        warnings: [],
      };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.DOCX_TEMPLATE_PREVIEW,
    async (
      _event,
      params: {
        templateId: string;
        sampleData: Record<string, unknown>;
      }
    ) => {
      try {
        const template = await database.getDocxTemplate(params.templateId);
        if (!template) {
          return { success: false, error: 'Template not found' };
        }

        const preview = await pythonBridge.previewDocxTemplate(
          template.filePath,
          params.sampleData
        );
        return { success: true, preview };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to preview template',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCX_TEMPLATE_RENDER,
    async (
      _event,
      params: {
        templateId: string;
        data: Record<string, unknown>;
        outputPath?: string;
        format?: 'pdf' | 'docx';
      }
    ) => {
      try {
        const template = await database.getDocxTemplate(params.templateId);
        if (!template) {
          return { success: false, error: 'Template not found' };
        }

        // Generate output path if not provided
        const format = params.format || 'pdf';
        const outputDir = path.join(app.getPath('userData'), 'generated');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath =
          params.outputPath ||
          path.join(outputDir, `${Date.now()}_${template.name}.${format}`);

        const generatedPath = await pythonBridge.renderDocxTemplate(
          template.filePath,
          params.data,
          outputPath,
          format
        );

        return { success: true, path: generatedPath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to render template',
        };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.DOCX_TEMPLATE_LIST, async () => {
    return database.listDocxTemplates();
  });

  ipcMain.handle(IPC_CHANNELS.DOCX_TEMPLATE_GET, async (_event, id: string) => {
    return database.getDocxTemplate(id);
  });

  ipcMain.handle(IPC_CHANNELS.DOCX_TEMPLATE_DELETE, async (_event, id: string) => {
    try {
      // Get template to find file path
      const template = await database.getDocxTemplate(id);
      if (template && fs.existsSync(template.filePath)) {
        // Delete the physical file
        fs.unlinkSync(template.filePath);
      }

      // Delete from database
      await database.deleteDocxTemplate(id);
    } catch (error) {
      throw new Error(
        `Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  // ============================================
  // RICH DOCUMENT HANDLERS
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.RICH_DOC_CREATE,
    async (_event, input: CreateRichDocumentInput) => {
      return database.createRichDocument(input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.RICH_DOC_UPDATE,
    async (_event, id: string, input: UpdateRichDocumentInput) => {
      return database.updateRichDocument(id, input);
    }
  );

  ipcMain.handle(IPC_CHANNELS.RICH_DOC_DELETE, async (_event, id: string) => {
    return database.deleteRichDocument(id);
  });

  ipcMain.handle(IPC_CHANNELS.RICH_DOC_GET, async (_event, id: string) => {
    return database.getRichDocument(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.RICH_DOC_LIST,
    async (_event, filter?: { isTemplate?: boolean }) => {
      return database.listRichDocuments(filter);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.RICH_DOC_EXPORT_PDF,
    async (_event, request: ExportPdfRequest) => {
      let win: BW | null = null;
      try {
        const { htmlContent, pageColor, outputPath } = request;

        // Create a hidden browser window for PDF rendering
        win = new BrowserWindow({
          width: 794,
          height: 1123,
          show: false,
          webPreferences: {
            offscreen: true,
          },
        });

        // Build full HTML document with styles
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 25mm;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: ${pageColor || '#ffffff'};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 24pt; font-weight: 700; margin-bottom: 0.5em; }
  h2 { font-size: 20pt; font-weight: 600; margin-bottom: 0.4em; }
  h3 { font-size: 16pt; font-weight: 600; margin-bottom: 0.3em; }
  p { margin-bottom: 0.8em; }
  ul, ol { margin-bottom: 0.8em; padding-left: 1.5em; }
  li { margin-bottom: 0.2em; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; margin: 0.8em 0; color: #4b5563; }
  code { background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f3f4f6; padding: 1em; border-radius: 6px; margin-bottom: 0.8em; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  [data-placeholder-node] {
    display: inline;
    background: #e0e7ff;
    color: #3730a3;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
</style>
</head>
<body>${htmlContent}</body>
</html>`;

        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

        // Wait for content to fully render
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        // Ensure output directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, pdfBuffer);

        return { success: true, filePath: outputPath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to export PDF',
        };
      } finally {
        if (win) {
          win.destroy();
        }
      }
    }
  );

  // Save PDF internally for use as attachment
  ipcMain.handle(
    IPC_CHANNELS.RICH_DOC_SAVE_PDF,
    async (_event, request: SavePdfRequest) => {
      let win: BW | null = null;
      try {
        const { htmlContent, pageColor, title, docId, templateHtml } = request;

        // Save to app's userData directory
        const pdfDir = path.join(app.getPath('userData'), 'saved-pdfs');
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir, { recursive: true });
        }

        const sanitizedTitle = (title || 'document').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'document';
        const filename = `${sanitizedTitle}.pdf`;
        const outputPath = path.join(pdfDir, `${docId}_${filename}`);

        win = new BrowserWindow({
          width: 794,
          height: 1123,
          show: false,
          webPreferences: { offscreen: true },
        });

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 25mm;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: ${pageColor || '#ffffff'};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 24pt; font-weight: 700; margin-bottom: 0.5em; }
  h2 { font-size: 20pt; font-weight: 600; margin-bottom: 0.4em; }
  h3 { font-size: 16pt; font-weight: 600; margin-bottom: 0.3em; }
  p { margin-bottom: 0.8em; }
  ul, ol { margin-bottom: 0.8em; padding-left: 1.5em; }
  li { margin-bottom: 0.2em; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; margin: 0.8em 0; color: #4b5563; }
  code { background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f3f4f6; padding: 1em; border-radius: 6px; margin-bottom: 0.8em; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  [data-placeholder-node] {
    display: inline;
    background: #e0e7ff;
    color: #3730a3;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
</style>
</head>
<body>${htmlContent}</body>
</html>`;

        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        fs.writeFileSync(outputPath, pdfBuffer);

        // Save HTML template alongside the PDF for per-recipient generation
        if (templateHtml) {
          const templatePath = outputPath.replace(/\.pdf$/, '.template.json');
          const templateData = JSON.stringify({
            html: templateHtml,
            pageColor: pageColor || '#ffffff',
          });
          fs.writeFileSync(templatePath, templateData, 'utf-8');
        }

        return { success: true, filePath: outputPath, filename };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save PDF',
        };
      } finally {
        if (win) {
          win.destroy();
        }
      }
    }
  );

  // List saved PDFs
  ipcMain.handle(IPC_CHANNELS.RICH_DOC_LIST_SAVED_PDFS, async () => {
    try {
      const pdfDir = path.join(app.getPath('userData'), 'saved-pdfs');
      if (!fs.existsSync(pdfDir)) return [];

      const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
      const entries: SavedPdfEntry[] = files.map(f => {
        const fullPath = path.join(pdfDir, f);
        const stat = fs.statSync(fullPath);
        // Extract display filename and docId from: {docId}_{filename}.pdf
        const displayName = f.includes('_') ? f.substring(f.indexOf('_') + 1) : f;
        const docId = f.includes('_') ? f.substring(0, f.indexOf('_')) : undefined;

        // Check if a template exists alongside the PDF
        const templatePath = fullPath.replace(/\.pdf$/, '.template.json');
        const hasTemplate = fs.existsSync(templatePath);
        let placeholders: string[] | undefined;
        if (hasTemplate) {
          try {
            const tmpl = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
            // Extract placeholder keys from template HTML
            const matches = (tmpl.html as string).matchAll(/data-placeholder-node[^>]*>\{\{\s*(.+?)\s*\}\}/g);
            placeholders = [...new Set([...matches].map(m => m[1]))];
          } catch { /* ignore */ }
        }

        return {
          filename: displayName,
          path: fullPath,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          docId,
          hasTemplate,
          placeholders,
        };
      });
      return entries.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    } catch {
      return [];
    }
  });

  // Get template HTML for a saved PDF (for per-recipient generation)
  ipcMain.handle(
    IPC_CHANNELS.RICH_DOC_GET_TEMPLATE,
    async (_event, pdfPath: string) => {
      try {
        const templatePath = pdfPath.replace(/\.pdf$/, '.template.json');
        if (!fs.existsSync(templatePath)) return null;
        const data = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        const matches = (data.html as string).matchAll(/data-placeholder-node[^>]*>\{\{\s*(.+?)\s*\}\}/g);
        const placeholders = [...new Set([...matches].map(m => m[1]))];
        return { html: data.html, pageColor: data.pageColor || '#ffffff', placeholders };
      } catch {
        return null;
      }
    }
  );

  // Render a temporary PDF from HTML (used for per-recipient personalized docs)
  ipcMain.handle(
    IPC_CHANNELS.RICH_DOC_RENDER_TEMP_PDF,
    async (_event, request: RenderTempPdfRequest) => {
      let win: BW | null = null;
      try {
        const { htmlContent, pageColor, filename } = request;

        const tempDir = path.join(app.getPath('userData'), 'saved-pdfs', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const sanitized = (filename || 'document.pdf').replace(/[^a-zA-Z0-9_\-\s.]/g, '').trim();
        const outputPath = path.join(tempDir, sanitized);

        win = new BrowserWindow({
          width: 794,
          height: 1123,
          show: false,
          webPreferences: { offscreen: true },
        });

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 25mm;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: ${pageColor || '#ffffff'};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 24pt; font-weight: 700; margin-bottom: 0.5em; }
  h2 { font-size: 20pt; font-weight: 600; margin-bottom: 0.4em; }
  h3 { font-size: 16pt; font-weight: 600; margin-bottom: 0.3em; }
  p { margin-bottom: 0.8em; }
  ul, ol { margin-bottom: 0.8em; padding-left: 1.5em; }
  li { margin-bottom: 0.2em; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; margin: 0.8em 0; color: #4b5563; }
  code { background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f3f4f6; padding: 1em; border-radius: 6px; margin-bottom: 0.8em; overflow-x: auto; }
  pre code { background: none; padding: 0; }
</style>
</head>
<body>${htmlContent}</body>
</html>`;

        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        fs.writeFileSync(outputPath, pdfBuffer);
        return { success: true, path: outputPath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to render PDF',
        };
      } finally {
        if (win) win.destroy();
      }
    }
  );

  // ============================================
  // AUTOMATION RULE HANDLERS
  // ============================================

  ipcMain.handle(IPC_CHANNELS.RULE_CREATE, async (_event, input: CreateRuleInput) => {
    return database.createRule(input);
  });

  ipcMain.handle(IPC_CHANNELS.RULE_UPDATE, async (_event, id: string, input: UpdateRuleInput) => {
    return database.updateRule(id, input);
  });

  ipcMain.handle(IPC_CHANNELS.RULE_DELETE, async (_event, id: string) => {
    return database.deleteRule(id);
  });

  ipcMain.handle(IPC_CHANNELS.RULE_GET, async (_event, id: string) => {
    return database.getRule(id);
  });

  ipcMain.handle(IPC_CHANNELS.RULE_LIST, async () => {
    return database.listRules();
  });

  // ============================================
  // BACKUP & RESTORE
  // ============================================

  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT, async () => {
    try {
      const defaultName = `envoy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const result = await dialog.showSaveDialog({
        title: 'Export Envoy data',
        defaultPath: defaultName,
        filters: [{ name: 'Envoy backup', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true };
      }

      const envelope = await collectBackup(database);
      await writeBackupFile(result.filePath, envelope);
      return {
        success: true,
        path: result.filePath,
        counts: envelope.counts,
      };
    } catch (err) {
      logger.error('BACKUP_EXPORT failed', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Backup failed',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_INSPECT, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Inspect Envoy backup',
        filters: [{ name: 'Envoy backup', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }
      const filePath = result.filePaths[0];
      const summary = inspectBackupFile(filePath);
      return { success: true, path: filePath, summary };
    } catch (err) {
      logger.error('BACKUP_INSPECT failed', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Inspect failed',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_AUTO_STATUS, async () => {
    return { success: true, ...getAutoBackupStatus() };
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_CHECK_DB, async () => {
    return runDatabaseIntegrityCheck(database);
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_STATS, async () => {
    return { success: true, ...collectStorageStats() };
  });

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_OPEN_BACKUPS_FOLDER, async () => {
    return openBackupsFolder();
  });

  ipcMain.handle(
    IPC_CHANNELS.BACKUP_AUTO_SET,
    async (
      _event,
      params: { enabled: boolean; intervalHours?: number; keepCount?: number }
    ) => {
      try {
        const current = await database.getSettings();
        const next = {
          ...(current as any),
          autoBackup: {
            enabled: !!params.enabled,
            intervalHours: params.intervalHours ?? (current as any).autoBackup?.intervalHours ?? 24,
            keepCount: params.keepCount ?? (current as any).autoBackup?.keepCount ?? 7,
          },
        };
        await database.setSettings(next);
        startAutoBackup(database, next.autoBackup);
        return { success: true, autoBackup: next.autoBackup };
      } catch (err) {
        logger.error('BACKUP_AUTO_SET failed', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Could not update auto-backup',
        };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE_LATEST_AUTO, async () => {
    try {
      const filePath = newestAutoBackupPath();
      if (!filePath) {
        return {
          success: false,
          error: 'No auto-backup files found. Enable auto-backup first.',
        };
      }

      const summary = inspectBackupFile(filePath);
      const confirm = await dialog.showMessageBox({
        type: 'warning',
        title: 'Restore latest auto-backup?',
        message: `Merge ${summary.totalRecords} records from the newest scheduled backup?`,
        detail:
          `Source: ${filePath}\n` +
          `Backup exported: ${summary.exportedAt}\n` +
          `From app version: ${summary.appVersion}\n\n` +
          'Existing entries with the same ID will be updated in place.\n' +
          'Nothing will be deleted. A safety snapshot is written first.',
        buttons: ['Cancel', 'Restore'],
        defaultId: 0,
        cancelId: 0,
      });
      if (confirm.response !== 1) {
        return { success: false, cancelled: true };
      }

      const preRestorePath: string = path.join(
        app.getPath('userData'),
        'backups',
        `envoy-pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );
      try {
        const preRestore = await collectBackup(database);
        await writeBackupFile(preRestorePath, preRestore);
      } catch (err) {
        logger.warn('Pre-restore snapshot failed — aborting', err);
        return { success: false, error: 'Could not write pre-restore snapshot' };
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const envelope = JSON.parse(raw);
      const result = await restoreEnvelope(database as any, envelope);

      logger.info('Latest auto-backup restored', {
        source: filePath,
        totalApplied: result.totalApplied,
        preRestorePath,
      });

      return {
        success: true,
        source: filePath,
        applied: result.applied,
        skipped: result.skipped,
        totalApplied: result.totalApplied,
        preRestorePath,
      };
    } catch (err) {
      logger.error('BACKUP_RESTORE_LATEST_AUTO failed', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Restore failed',
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async () => {
    try {
      const picked = await dialog.showOpenDialog({
        title: 'Restore Envoy backup',
        filters: [{ name: 'Envoy backup', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (picked.canceled || picked.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }
      const filePath = picked.filePaths[0];

      const summary = inspectBackupFile(filePath);
      const confirm = await dialog.showMessageBox({
        type: 'warning',
        title: 'Restore Envoy backup?',
        message: `Merge ${summary.totalRecords} records from this backup into the current database?`,
        detail:
          `Exported: ${summary.exportedAt}\n` +
          `From app version: ${summary.appVersion}\n\n` +
          'Existing entries with the same ID will be updated in place.\n' +
          'Nothing will be deleted. A safety backup is written first.',
        buttons: ['Cancel', 'Restore'],
        defaultId: 0,
        cancelId: 0,
      });
      if (confirm.response !== 1) {
        return { success: false, cancelled: true };
      }

      // Pre-restore snapshot lands in the same backups/ directory as
      // migration snapshots so users can find it later.
      const preRestorePath: string = path.join(
        app.getPath('userData'),
        'backups',
        `envoy-pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );
      try {
        const preRestore = await collectBackup(database);
        await writeBackupFile(preRestorePath, preRestore);
      } catch (err) {
        logger.warn('Pre-restore snapshot failed — aborting restore', err);
        return {
          success: false,
          error: 'Could not write pre-restore snapshot',
        };
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const envelope = JSON.parse(raw);
      const result = await restoreEnvelope(database as any, envelope);

      logger.info('Backup restored', {
        totalApplied: result.totalApplied,
        preRestorePath,
      });

      return {
        success: true,
        applied: result.applied,
        skipped: result.skipped,
        totalApplied: result.totalApplied,
        preRestorePath,
      };
    } catch (err) {
      logger.error('BACKUP_RESTORE failed', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Restore failed',
      };
    }
  });
}
