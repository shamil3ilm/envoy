import type {
  Template,
  CreateTemplateInput,
  Contact,
  CreateContactInput,
  ContactGroup,
  CreateContactGroupInput,
  Snippet,
  CreateSnippetInput,
  AuditLog,
  AppSettings,
  EmailAccount,
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
  NoteGroup,
  CreateNoteGroupInput,
  UpdateNoteGroupInput,
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseCategory,
  ExpenseSummary,
  UploadedDocxTemplate,
  CreateDocxTemplateInput,
  RichDocument,
  CreateRichDocumentInput,
  UpdateRichDocumentInput,
  AutomationRule,
  CreateRuleInput,
  UpdateRuleInput,
} from '../../shared/types';

/**
 * Common database interface implemented by both SQLite and MySQL services
 */
export interface IDatabase {
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Diagnostics
  checkIntegrity(): Promise<{ ok: boolean; issues: string[] }>;

  // Templates
  createTemplate(input: CreateTemplateInput): Promise<Template>;
  getTemplate(id: string): Promise<Template | null>;
  listTemplates(filter?: { category?: string; channel?: string }): Promise<Template[]>;
  updateTemplate(id: string, input: Partial<CreateTemplateInput>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  // Contacts
  createContact(input: CreateContactInput): Promise<Contact>;
  getContact(id: string): Promise<Contact | null>;
  listContacts(filter?: { search?: string; tags?: string[] }): Promise<Contact[]>;
  updateContact(id: string, input: Partial<CreateContactInput>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  updateContactLastContacted(id: string): Promise<void>;

  // Contact Groups
  createContactGroup(input: CreateContactGroupInput): Promise<ContactGroup>;
  getContactGroup(id: string): Promise<ContactGroup | null>;
  listContactGroups(): Promise<ContactGroup[]>;
  updateContactGroup(id: string, input: Partial<CreateContactGroupInput>): Promise<ContactGroup>;
  deleteContactGroup(id: string): Promise<void>;
  addContactToGroup(groupId: string, contactId: string): Promise<void>;
  removeContactFromGroup(groupId: string, contactId: string): Promise<void>;
  getContactGroups(contactId: string): Promise<ContactGroup[]>;
  reorderContactGroups(orderedIds: string[]): Promise<void>;

  // Snippets
  createSnippet(input: CreateSnippetInput): Promise<Snippet>;
  getSnippet(id: string): Promise<Snippet | null>;
  getSnippetByShortcut(shortcut: string): Promise<Snippet | null>;
  listSnippets(filter?: { category?: string; search?: string }): Promise<Snippet[]>;
  updateSnippet(id: string, input: Partial<CreateSnippetInput>): Promise<Snippet>;
  deleteSnippet(id: string): Promise<void>;
  incrementSnippetUsage(id: string): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  setSettings(settings: Partial<AppSettings>): Promise<void>;

  // Email Accounts
  createEmailAccount(account: Omit<EmailAccount, 'id' | 'createdAt'>): Promise<EmailAccount>;
  saveEmailAccount(account: Omit<EmailAccount, 'id' | 'createdAt'>): Promise<EmailAccount>;
  getEmailAccount(id: string): Promise<EmailAccount | null>;
  getDefaultEmailAccount(): Promise<EmailAccount | null>;
  listEmailAccounts(): Promise<EmailAccount[]>;
  updateEmailAccount(id: string, update: Partial<EmailAccount>): Promise<EmailAccount>;
  deleteEmailAccount(id: string): Promise<void>;

  // Audit Logs
  createAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog>;
  getAuditLog(id: string): Promise<AuditLog | null>;
  listAuditLogs(filter?: {
    status?: string;
    channel?: string;
    recipientId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;

  // Activity Logs
  createActivityLog(input: CreateActivityLogInput): Promise<UserActivityLog>;
  getActivityLog(id: string): Promise<UserActivityLog | null>;
  listActivityLogs(filter?: {
    type?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: UserActivityLog[]; total: number }>;
  clearActivityLogs(beforeDate?: string): Promise<void>;

  // Scheduled Messages
  createScheduledMessage(input: CreateScheduledMessageInput): Promise<ScheduledMessage>;
  getScheduledMessage(id: string): Promise<ScheduledMessage | null>;
  listScheduledMessages(filter?: { status?: ScheduleStatus }): Promise<ScheduledMessage[]>;
  updateScheduledMessage(id: string, input: UpdateScheduledMessageInput): Promise<ScheduledMessage>;
  deleteScheduledMessage(id: string): Promise<void>;
  getPendingScheduledMessages(): Promise<ScheduledMessage[]>;

  // Reminders
  createReminder(input: CreateReminderInput): Promise<Reminder>;
  getReminder(id: string): Promise<Reminder | null>;
  listReminders(filter?: { status?: ReminderStatus }): Promise<Reminder[]>;
  updateReminder(id: string, input: UpdateReminderInput): Promise<Reminder>;
  deleteReminder(id: string): Promise<void>;
  getDueReminders(): Promise<Reminder[]>;
  markReminderNotified(id: string): Promise<void>;
  createNextOccurrence(parentReminder: Reminder): Promise<Reminder | null>;

  // Calendar Events
  createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent>;
  getCalendarEvent(id: string): Promise<CalendarEvent | null>;
  listCalendarEvents(filter?: {
    fromDate?: string;
    toDate?: string;
    relatedContactId?: string;
  }): Promise<CalendarEvent[]>;
  updateCalendarEvent(id: string, input: UpdateCalendarEventInput): Promise<CalendarEvent>;
  deleteCalendarEvent(id: string): Promise<void>;

  // Tasks
  createTask(input: CreateTaskInput): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  listTasks(filter?: {
    status?: TaskStatus;
    priority?: string;
    search?: string;
  }): Promise<Task[]>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  reorderTasks(taskOrders: { id: string; order: number; status: TaskStatus }[]): Promise<void>;
  createNextTaskOccurrence(task: Task): Promise<Task | null>;

  // Note Groups
  createNoteGroup(input: CreateNoteGroupInput): Promise<NoteGroup>;
  listNoteGroups(): Promise<NoteGroup[]>;
  updateNoteGroup(id: string, input: UpdateNoteGroupInput): Promise<NoteGroup>;
  deleteNoteGroup(id: string): Promise<void>;

  // Notes
  createNote(input: CreateNoteInput): Promise<Note>;
  getNote(id: string): Promise<Note | null>;
  listNotes(filter?: { search?: string; isPinned?: boolean; groupId?: string | null }): Promise<Note[]>;
  updateNote(id: string, input: UpdateNoteInput): Promise<Note>;
  deleteNote(id: string): Promise<void>;

  // Expenses
  createExpense(input: CreateExpenseInput): Promise<Expense>;
  getExpense(id: string): Promise<Expense | null>;
  listExpenses(filter?: {
    category?: ExpenseCategory;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }): Promise<Expense[]>;
  updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  getExpenseSummary(filter?: { fromDate?: string; toDate?: string }): Promise<ExpenseSummary>;

  // DOCX Templates
  createDocxTemplate(input: CreateDocxTemplateInput): Promise<UploadedDocxTemplate>;
  getDocxTemplate(id: string): Promise<UploadedDocxTemplate | null>;
  listDocxTemplates(): Promise<UploadedDocxTemplate[]>;
  deleteDocxTemplate(id: string): Promise<void>;

  // Rich Documents
  createRichDocument(input: CreateRichDocumentInput): Promise<RichDocument>;
  getRichDocument(id: string): Promise<RichDocument | null>;
  listRichDocuments(filter?: { isTemplate?: boolean }): Promise<RichDocument[]>;
  updateRichDocument(id: string, input: UpdateRichDocumentInput): Promise<RichDocument>;
  deleteRichDocument(id: string): Promise<void>;

  // Automation Rules
  createRule(input: CreateRuleInput): Promise<AutomationRule>;
  updateRule(id: string, input: UpdateRuleInput): Promise<AutomationRule>;
  deleteRule(id: string): Promise<void>;
  getRule(id: string): Promise<AutomationRule | null>;
  listRules(): Promise<AutomationRule[]>;
}
