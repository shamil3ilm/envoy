import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import type {
  Template,
  CreateTemplateInput,
  Contact,
  CreateContactInput,
  ContactGroup,
  CreateContactGroupInput,
  Snippet,
  CreateSnippetInput,
  SnippetCategory,
  AuditLog,
  EmailAccount,
  AppSettings,
  RenderTemplateResponse,
  GenerateDocumentRequest,
  GenerateDocumentResponse,
  UserActivityLog,
  CreateActivityLogInput,
  ScheduledMessage,
  CreateScheduledMessageInput,
  UpdateScheduledMessageInput,
  ScheduleStatus,
  Reminder,
  CreateReminderInput,
  UpdateReminderInput,
  ReminderStatus,
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  NoteGroup,
  CreateNoteGroupInput,
  UpdateNoteGroupInput,
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseCategory,
  ExpenseSummary,
  UploadedDocxTemplate,
  DocxTemplateInfo,
  DocxTemplateValidation,
  DocxTemplatePreview,
  NotificationSoundType,
  DesktopMailApp,
  RichDocument,
  CreateRichDocumentInput,
  UpdateRichDocumentInput,
  ExportPdfRequest,
  ExportPdfResponse,
  SavePdfRequest,
  SavePdfResponse,
  SavedPdfEntry,
  GetTemplateResponse,
  RenderTempPdfRequest,
  RenderTempPdfResponse,
  AutomationRule,
  CreateRuleInput,
  UpdateRuleInput,
} from '../shared/types';

// Type-safe API exposed to renderer
const api = {
  // Template operations
  templates: {
    create: (input: CreateTemplateInput): Promise<Template> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_CREATE, input),
    update: (id: string, input: Partial<CreateTemplateInput>): Promise<Template> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_DELETE, id),
    get: (id: string): Promise<Template | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_GET, id),
    list: (filter?: { category?: string; channel?: string }): Promise<Template[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_LIST, filter),
    render: (templateBody: string, data: Record<string, unknown>): Promise<RenderTemplateResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_RENDER, templateBody, data),
  },

  // Contact operations
  contacts: {
    create: (input: CreateContactInput): Promise<Contact> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONTACT_CREATE, input),
    update: (id: string, input: Partial<CreateContactInput>): Promise<Contact> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONTACT_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONTACT_DELETE, id),
    get: (id: string): Promise<Contact | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONTACT_GET, id),
    list: (filter?: { search?: string; tags?: string[] }): Promise<Contact[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONTACT_LIST, filter),
    import: (csvPath: string): Promise<{ imported: number; errors: string[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONTACT_IMPORT, csvPath),
    export: (outputPath: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONTACT_EXPORT, outputPath),
  },

  // Email operations
  email: {
    send: (params: {
      accountId?: string;
      to: string | string[];
      subject: string;
      body: string;
      html?: boolean;
      attachments?: Array<{ filename: string; path: string }>;
    }): Promise<{ success: boolean; messageId?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAIL_SEND, params),
    accounts: {
      add: (params: {
        name: string;
        type: 'smtp' | 'gmail' | 'outlook';
        fromName: string;
        fromEmail: string;
        config: {
          host: string;
          port: number;
          secure: boolean;
          user: string;
          password: string;
        };
        isDefault?: boolean;
      }): Promise<EmailAccount> =>
        ipcRenderer.invoke(IPC_CHANNELS.EMAIL_ACCOUNT_ADD, params),
      remove: (id: string): Promise<void> =>
        ipcRenderer.invoke(IPC_CHANNELS.EMAIL_ACCOUNT_REMOVE, id),
      list: (): Promise<EmailAccount[]> =>
        ipcRenderer.invoke(IPC_CHANNELS.EMAIL_ACCOUNT_LIST),
      test: (id: string): Promise<{ success: boolean; error?: string }> =>
        ipcRenderer.invoke(IPC_CHANNELS.EMAIL_ACCOUNT_TEST, id),
    },
  },

  // Document operations
  documents: {
    generate: (request: GenerateDocumentRequest): Promise<GenerateDocumentResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENT_GENERATE, request),
    preview: (request: Omit<GenerateDocumentRequest, 'outputPath'>): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENT_PREVIEW, request),
  },

  // Audit operations
  audit: {
    list: (filter?: {
      channel?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
      search?: string;
    }): Promise<AuditLog[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIT_LIST, filter),
    get: (id: string): Promise<AuditLog | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIT_GET, id),
    export: (outputPath: string, filter?: Record<string, unknown>): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIT_EXPORT, outputPath, filter),
  },

  // Settings operations
  settings: {
    get: (): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (settings: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  },

  // Python bridge status
  python: {
    status: (): Promise<{ running: boolean; version?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PYTHON_STATUS),
    restart: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PYTHON_RESTART),
  },

  // Activity log operations
  activity: {
    log: (input: CreateActivityLogInput): Promise<UserActivityLog> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_LOG_CREATE, input),
    list: (filter?: {
      action?: string;
      category?: string;
      entityId?: string;
      fromDate?: string;
      toDate?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ logs: UserActivityLog[]; total: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_LOG_LIST, filter),
    get: (id: string): Promise<UserActivityLog | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_LOG_GET, id),
    clear: (beforeDate?: string): Promise<number> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_LOG_CLEAR, beforeDate),
    export: (): Promise<UserActivityLog[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY_LOG_EXPORT),
  },

  // Scheduled message operations
  schedule: {
    create: (input: CreateScheduledMessageInput): Promise<ScheduledMessage> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_CREATE, input),
    update: (id: string, input: UpdateScheduledMessageInput): Promise<ScheduledMessage> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_DELETE, id),
    get: (id: string): Promise<ScheduledMessage | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_GET, id),
    list: (filter?: { status?: ScheduleStatus; fromDate?: string; toDate?: string }): Promise<ScheduledMessage[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_LIST, filter),
    cancel: (id: string): Promise<ScheduledMessage> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCHEDULE_CANCEL, id),
  },

  // Reminder operations
  reminders: {
    create: (input: CreateReminderInput): Promise<Reminder> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_CREATE, input),
    update: (id: string, input: UpdateReminderInput): Promise<Reminder> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_DELETE, id),
    get: (id: string): Promise<Reminder | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_GET, id),
    list: (filter?: { status?: ReminderStatus; type?: string; fromDate?: string; toDate?: string }): Promise<Reminder[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_LIST, filter),
    snooze: (id: string, minutes: number): Promise<Reminder> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_SNOOZE, id, minutes),
    complete: (id: string): Promise<Reminder> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_COMPLETE, id),
    dismiss: (id: string): Promise<Reminder> =>
      ipcRenderer.invoke(IPC_CHANNELS.REMINDER_DISMISS, id),
    onDue: (callback: (reminder: Reminder) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, reminder: Reminder) => callback(reminder);
      ipcRenderer.on('reminder:due', handler);
      // Return unsubscribe function
      return () => ipcRenderer.removeListener('reminder:due', handler);
    },
  },

  // Sound operations
  sounds: {
    upload: (type: NotificationSoundType): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SOUND_UPLOAD, type),
    getPath: (type: NotificationSoundType): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SOUND_GET_PATH, type),
  },

  // Dialog operations
  dialog: {
    openFile: (options?: {
      title?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      defaultPath?: string;
    }): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options || {}),
    saveFile: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, options || {}),
  },

  // WhatsApp operations
  whatsapp: {
    status: (): Promise<{ available: boolean; method: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_STATUS),
    send: (params: { phone: string; message: string }): Promise<{ success: boolean; method: string; url: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_SEND, params),
    openChat: (params: { phone: string }): Promise<{ success: boolean; url: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_OPEN_CHAT, params),
  },

  // Teams operations
  teams: {
    status: (): Promise<{ configured: boolean; loggedIn: boolean; email: string | null }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEAMS_STATUS),
    login: (): Promise<{ success: boolean; email?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEAMS_LOGIN),
    logout: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEAMS_LOGOUT),
    send: (params: { email: string; message: string }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEAMS_SEND, params),
    openChat: (params: { email: string }): Promise<{ success: boolean; url: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TEAMS_OPEN_CHAT, params),
  },

  // Shell
  shell: {
    openExternal: (url: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
    detectDesktopMailApps: (): Promise<DesktopMailApp[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DETECT_DESKTOP_MAIL_APPS),
    openInDesktopMailApp: (params: { appId: string; appPath: string; to: string; subject: string; body: string }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.OPEN_IN_DESKTOP_MAIL_APP, params),
  },

  // Contact Group operations
  groups: {
    create: (input: CreateContactGroupInput): Promise<ContactGroup> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_CREATE, input),
    update: (id: string, input: Partial<CreateContactGroupInput>): Promise<ContactGroup> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_DELETE, id),
    get: (id: string): Promise<ContactGroup | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_GET, id),
    list: (): Promise<ContactGroup[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_LIST),
    addContact: (groupId: string, contactId: string): Promise<ContactGroup> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_ADD_CONTACT, groupId, contactId),
    removeContact: (groupId: string, contactId: string): Promise<ContactGroup> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_REMOVE_CONTACT, groupId, contactId),
    reorder: (orderedIds: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.GROUP_REORDER, orderedIds),
  },

  // Snippet operations
  snippets: {
    create: (input: CreateSnippetInput): Promise<Snippet> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPET_CREATE, input),
    update: (id: string, input: Partial<CreateSnippetInput>): Promise<Snippet> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPET_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPET_DELETE, id),
    get: (id: string): Promise<Snippet | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPET_GET, id),
    list: (filter?: { category?: SnippetCategory; search?: string }): Promise<Snippet[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPET_LIST, filter),
    incrementUsage: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPET_INCREMENT_USAGE, id),
  },

  // Calendar operations
  calendar: {
    create: (input: CreateCalendarEventInput): Promise<CalendarEvent> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_CREATE, input),
    update: (id: string, input: UpdateCalendarEventInput): Promise<CalendarEvent> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_DELETE, id),
    get: (id: string): Promise<CalendarEvent | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_GET, id),
    list: (filter?: { fromDate?: string; toDate?: string; relatedContactId?: string }): Promise<CalendarEvent[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CALENDAR_LIST, filter),
  },

  // Task operations
  tasks: {
    create: (input: CreateTaskInput): Promise<Task> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, input),
    update: (id: string, input: UpdateTaskInput): Promise<Task> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, id),
    get: (id: string): Promise<Task | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_GET, id),
    list: (filter?: { status?: TaskStatus; priority?: string; search?: string }): Promise<Task[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST, filter),
    reorder: (taskOrders: { id: string; order: number; status: TaskStatus }[]): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_REORDER, taskOrders),
    completeRecurring: (id: string): Promise<{ completedTask: Task; nextTask: Task | null }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_COMPLETE_RECURRING, id),
  },

  // Note operations
  notes: {
    create: (input: CreateNoteInput): Promise<Note> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_CREATE, input),
    update: (id: string, input: UpdateNoteInput): Promise<Note> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_DELETE, id),
    get: (id: string): Promise<Note | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_GET, id),
    list: (filter?: { search?: string; isPinned?: boolean; groupId?: string | null }): Promise<Note[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_LIST, filter),
  },

  // Note group operations
  noteGroups: {
    create: (input: CreateNoteGroupInput): Promise<NoteGroup> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_GROUP_CREATE, input),
    update: (id: string, input: UpdateNoteGroupInput): Promise<NoteGroup> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_GROUP_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_GROUP_DELETE, id),
    list: (): Promise<NoteGroup[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTE_GROUP_LIST),
  },

  // Expense operations
  expenses: {
    create: (input: CreateExpenseInput): Promise<Expense> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPENSE_CREATE, input),
    update: (id: string, input: UpdateExpenseInput): Promise<Expense> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPENSE_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPENSE_DELETE, id),
    get: (id: string): Promise<Expense | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPENSE_GET, id),
    list: (filter?: { category?: ExpenseCategory; fromDate?: string; toDate?: string; search?: string }): Promise<Expense[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPENSE_LIST, filter),
    summary: (filter?: { fromDate?: string; toDate?: string }): Promise<ExpenseSummary> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPENSE_SUMMARY, filter),
  },

  // DOCX Template operations
  docxTemplates: {
    upload: (sourcePath: string, name: string): Promise<{ success: boolean; template?: UploadedDocxTemplate; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_UPLOAD, { sourcePath, name }),
    parse: (docxPath: string): Promise<{ success: boolean; info?: DocxTemplateInfo; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_PARSE, docxPath),
    validate: (docxPath: string): Promise<DocxTemplateValidation> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_VALIDATE, docxPath),
    preview: (templateId: string, sampleData: Record<string, unknown>): Promise<{ success: boolean; preview?: DocxTemplatePreview; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_PREVIEW, { templateId, sampleData }),
    render: (params: {
      templateId: string;
      data: Record<string, unknown>;
      outputPath?: string;
      format?: 'pdf' | 'docx';
    }): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_RENDER, params),
    list: (): Promise<UploadedDocxTemplate[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_LIST),
    get: (id: string): Promise<UploadedDocxTemplate | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_GET, id),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCX_TEMPLATE_DELETE, id),
  },

  // Rich Document operations
  richDocuments: {
    create: (input: CreateRichDocumentInput): Promise<RichDocument> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_CREATE, input),
    update: (id: string, input: UpdateRichDocumentInput): Promise<RichDocument> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_DELETE, id),
    get: (id: string): Promise<RichDocument | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_GET, id),
    list: (filter?: { isTemplate?: boolean }): Promise<RichDocument[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_LIST, filter),
    exportPdf: (request: ExportPdfRequest): Promise<ExportPdfResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_EXPORT_PDF, request),
    savePdf: (request: SavePdfRequest): Promise<SavePdfResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_SAVE_PDF, request),
    listSavedPdfs: (): Promise<SavedPdfEntry[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_LIST_SAVED_PDFS),
    getTemplate: (pdfPath: string): Promise<GetTemplateResponse | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_GET_TEMPLATE, pdfPath),
    renderTempPdf: (request: RenderTempPdfRequest): Promise<RenderTempPdfResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.RICH_DOC_RENDER_TEMP_PDF, request),
  },

  // Backup & restore
  backup: {
    export: (): Promise<
      | { success: true; path: string; counts: Record<string, number> }
      | { success: false; cancelled?: boolean; error?: string }
    > => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT),

    inspect: (): Promise<
      | {
          success: true;
          path: string;
          summary: {
            version: number;
            exportedAt: string;
            appVersion: string;
            counts: Record<string, number>;
            totalRecords: number;
          };
        }
      | { success: false; cancelled?: boolean; error?: string }
    > => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_INSPECT),

    restore: (): Promise<
      | {
          success: true;
          applied: Record<string, number>;
          skipped: Record<string, number>;
          totalApplied: number;
          preRestorePath?: string;
        }
      | { success: false; cancelled?: boolean; error?: string }
    > => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE),

    autoStatus: (): Promise<{
      success: boolean;
      enabled: boolean;
      intervalHours: number;
      keepCount: number;
      lastRunAt: string | null;
      fileCount: number;
    }> => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_AUTO_STATUS),

    autoSet: (params: {
      enabled: boolean;
      intervalHours?: number;
      keepCount?: number;
    }): Promise<
      | {
          success: true;
          autoBackup: { enabled: boolean; intervalHours: number; keepCount: number };
        }
      | { success: false; error?: string }
    > => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_AUTO_SET, params),

    restoreLatestAuto: (): Promise<
      | {
          success: true;
          source: string;
          applied: Record<string, number>;
          skipped: Record<string, number>;
          totalApplied: number;
          preRestorePath?: string;
        }
      | { success: false; cancelled?: boolean; error?: string }
    > => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE_LATEST_AUTO),
  },

  // Diagnostics
  diagnostics: {
    checkDb: (): Promise<{ ok: boolean; issues: string[]; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_CHECK_DB),

    stats: (): Promise<{
      success: boolean;
      userDataPath: string;
      databaseFile: string | null;
      databaseBytes: number | null;
      backupsPath: string;
      backupCount: number;
      backupsBytes: number;
      logsPath: string;
      logsBytes: number;
    }> => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_STATS),

    openBackupsFolder: (): Promise<{ success: boolean; path: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_OPEN_BACKUPS_FOLDER),

    vacuum: (): Promise<{
      success: boolean;
      freedBytes?: number;
      sizeBefore?: number;
      sizeAfter?: number;
      error?: string;
    }> => ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_VACUUM),

    debugInfo: (): Promise<{ success: boolean; text?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_DEBUG_INFO),
  },

  // LAN sync (desktop hosts, mobile pulls/pushes)
  sync: {
    status: (): Promise<{
      success: boolean;
      enabled: boolean;
      port: number;
      addresses: string[];
      hasToken: boolean;
      token: string;
    }> => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STATUS),

    enable: (): Promise<{
      success: boolean;
      token?: string;
      port?: number;
      addresses?: string[];
      error?: string;
    }> => ipcRenderer.invoke(IPC_CHANNELS.SYNC_ENABLE),

    disable: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_DISABLE),

    regenerateToken: (): Promise<{ success: boolean; token?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_REGENERATE_TOKEN),
  },

  // Automation Rules
  rules: {
    create: (input: CreateRuleInput): Promise<AutomationRule> =>
      ipcRenderer.invoke(IPC_CHANNELS.RULE_CREATE, input),
    update: (id: string, input: UpdateRuleInput): Promise<AutomationRule> =>
      ipcRenderer.invoke(IPC_CHANNELS.RULE_UPDATE, id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.RULE_DELETE, id),
    get: (id: string): Promise<AutomationRule | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.RULE_GET, id),
    list: (): Promise<AutomationRule[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.RULE_LIST),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('envoy', api);

// Type declaration for renderer
export type EnvoyAPI = typeof api;
