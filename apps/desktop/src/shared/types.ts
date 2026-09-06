// ============================================
// TEMPLATE TYPES
// ============================================

export type TemplateCategory =
  | 'greeting'
  | 'update'
  | 'invitation'
  | 'followup'
  | 'apology'
  | 'announcement'
  | 'custom';

export type Channel = 'email' | 'whatsapp' | 'teams' | 'both';

export type Tone = 'formal' | 'professional' | 'friendly';

export type AttachmentFormat = 'pdf' | 'docx';

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  channel: Channel;
  subject?: string;
  body: string;
  tone: Tone;
  attachmentTemplate?: string;
  attachmentFormat?: AttachmentFormat;
  followUpDays?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  channel: Channel;
  subject?: string;
  body: string;
  tone: Tone;
  attachmentTemplate?: string;
  attachmentFormat?: AttachmentFormat;
  followUpDays?: number;
}

// ============================================
// CONTACT TYPES
// ============================================

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  timezone?: string;
  preferredChannel: Channel;
  customFields: Record<string, string>;
  tags: string[];
  lastContacted?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  timezone?: string;
  preferredChannel?: Channel;
  customFields?: Record<string, string>;
  tags?: string[];
}

// ============================================
// CONTACT GROUP TYPES
// ============================================

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  contactIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactGroupInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  contactIds?: string[];
}

// ============================================
// SNIPPET TYPES
// ============================================

export type SnippetCategory = 'greeting' | 'closing' | 'signature' | 'paragraph' | 'custom';

export interface Snippet {
  id: string;
  name: string;
  shortcut: string;
  content: string;
  category: SnippetCategory;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSnippetInput {
  name: string;
  shortcut: string;
  content: string;
  category?: SnippetCategory;
}

// ============================================
// SCHEDULED MESSAGE TYPES
// ============================================

export type ScheduleStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledMessage {
  id: string;
  templateId: string;
  recipientIds: string[];
  channel: Channel;
  scheduledFor: string;
  timezone: string;
  status: ScheduleStatus;
  attachmentPaths?: string[];
  errorMessage?: string;
  createdAt: string;
}

export interface CreateScheduledMessageInput {
  templateId: string;
  recipientIds: string[];
  channel: Channel;
  scheduledFor: string;
  timezone: string;
  attachmentPaths?: string[];
}

export interface UpdateScheduledMessageInput {
  scheduledFor?: string;
  timezone?: string;
  status?: ScheduleStatus;
  errorMessage?: string;
}

// ============================================
// REMINDER TYPES
// ============================================

export type ReminderType = 'follow_up' | 'task' | 'custom' | 'medical';
export type ReminderStatus = 'pending' | 'completed' | 'snoozed' | 'dismissed';

export type RepeatInterval = 'daily' | 'weekly' | 'monthly' | 'hourly';

export interface RepeatSchedule {
  interval: RepeatInterval;
  every: number;
  endDate?: string;
  occurrencesCompleted?: number;
}

export interface ReminderMetadata {
  dosage?: string;
  instructions?: string;
}

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  description?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'email' | 'scheduled_message' | 'contact';
  dueAt: string;
  timezone: string;
  status: ReminderStatus;
  snoozedUntil?: string;
  notifiedAt?: string;
  repeatSchedule?: RepeatSchedule;
  metadata?: ReminderMetadata;
  parentReminderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  type: ReminderType;
  title: string;
  description?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'email' | 'scheduled_message' | 'contact';
  dueAt: string;
  timezone: string;
  repeatSchedule?: RepeatSchedule;
  metadata?: ReminderMetadata;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string;
  dueAt?: string;
  timezone?: string;
  status?: ReminderStatus;
  snoozedUntil?: string;
  repeatSchedule?: RepeatSchedule;
  metadata?: ReminderMetadata;
}

// Notification sound types
export type NotificationSoundType = 'reminders' | 'medical' | 'scheduled';
export type NotificationSound = 'default' | 'chime' | 'alert' | 'alarm' | 'gentle' | 'silent' | 'custom';
export type NotificationSoundSettings = Record<NotificationSoundType, NotificationSound>;

// Vibration pattern types (for mobile/tablet devices)
export type VibrationPattern = 'default' | 'short' | 'long' | 'double' | 'urgent' | 'off';
export type NotificationVibrationSettings = Record<NotificationSoundType, VibrationPattern>;

export const VIBRATION_OPTIONS: { value: VibrationPattern; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Standard vibration' },
  { value: 'short', label: 'Short', description: 'Quick single buzz' },
  { value: 'long', label: 'Long', description: 'Extended vibration' },
  { value: 'double', label: 'Double', description: 'Two short pulses' },
  { value: 'urgent', label: 'Urgent', description: 'Repeated pattern' },
  { value: 'off', label: 'Off', description: 'No vibration' },
];

// Medical reminder presets
export interface MedicalReminderPreset {
  label: string;
  icon: string;
  defaultRepeat?: RepeatSchedule;
  defaultMetadata?: ReminderMetadata;
}

export const MEDICAL_REMINDER_PRESETS: MedicalReminderPreset[] = [
  {
    label: 'Morning medication',
    icon: 'Pill',
    defaultRepeat: { interval: 'daily', every: 1 },
    defaultMetadata: { instructions: 'Take with breakfast' },
  },
  {
    label: 'Evening medication',
    icon: 'Pill',
    defaultRepeat: { interval: 'daily', every: 1 },
    defaultMetadata: { instructions: 'Take after dinner' },
  },
  {
    label: 'Doctor appointment',
    icon: 'Stethoscope',
  },
  {
    label: 'Lab test',
    icon: 'Stethoscope',
  },
  {
    label: 'Refill prescription',
    icon: 'Pill',
    defaultRepeat: { interval: 'monthly', every: 1 },
  },
];

// ============================================
// AUDIT LOG TYPES
// ============================================

export type AuditStatus = 'sent' | 'delivered' | 'failed' | 'pending';

export interface AuditLog {
  id: string;
  channel: Channel;
  templateId: string;
  templateName: string;
  recipientId: string;
  recipientName: string;
  recipientAddress: string;
  subject?: string;
  bodyPreview: string;
  attachments: string[];
  status: AuditStatus;
  sentAt: string;
  deliveredAt?: string;
  errorMessage?: string;
}

// ============================================
// EMAIL ACCOUNT TYPES
// ============================================

export type EmailProviderType = 'gmail' | 'outlook' | 'smtp';

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface OAuthConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface EmailAccount {
  id: string;
  name: string;
  type: EmailProviderType;
  fromName: string;
  fromEmail: string;
  config: SMTPConfig | OAuthConfig;
  isDefault: boolean;
  createdAt: string;
}

// ============================================
// DOCUMENT TYPES
// ============================================

export type DocumentType = 'letter' | 'invoice' | 'agenda' | 'report' | 'custom';

export interface DocumentTemplate {
  id: string;
  name: string;
  type: DocumentType;
  format: AttachmentFormat;
  templateContent: string;
  styleConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateDocumentRequest {
  templateId: string;
  format: AttachmentFormat;
  data: Record<string, unknown>;
  outputPath?: string;
}

export interface GenerateDocumentResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

// ============================================
// DOCX TEMPLATE TYPES
// ============================================

export interface DocxTemplateVariableDetail {
  name: string;
  occurrences: number;
  contexts: string[];
}

export interface DocxTemplateInfo {
  variables: string[];
  variableDetails: DocxTemplateVariableDetail[];
  hasTables: boolean;
  hasControlStructures: boolean;
  pageCount: number;
}

export interface DocxTemplateValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DocxTemplatePreview {
  html: string;
  text: string;
  variables: string[];
}

export interface UploadedDocxTemplate {
  id: string;
  name: string;
  originalFileName: string;
  filePath: string;
  variables: string[];
  variableDetails: DocxTemplateVariableDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocxTemplateInput {
  name: string;
  originalFileName: string;
  filePath: string;
  variables: string[];
  variableDetails?: DocxTemplateVariableDetail[];
}

export interface RenderDocxTemplateRequest {
  templateId: string;
  data: Record<string, unknown>;
  outputPath?: string;
  format?: 'pdf' | 'docx';
}

export interface RenderDocxTemplateResponse {
  success: boolean;
  path?: string;
  error?: string;
}

// ============================================
// PYTHON BRIDGE TYPES (JSON-RPC)
// ============================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface RenderTemplateRequest {
  template: string;
  data: Record<string, unknown>;
}

export interface RenderTemplateResponse {
  success: boolean;
  rendered?: string;
  error?: string;
}

export interface SensitiveDataCheck {
  hasSensitiveData: boolean;
  findings: Array<{
    type: 'currency' | 'account_number' | 'personal_data' | 'phone' | 'email';
    value: string;
    position: { start: number; end: number };
  }>;
}

// ============================================
// IPC CHANNEL NAMES
// ============================================

export const IPC_CHANNELS = {
  // Template operations
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_UPDATE: 'template:update',
  TEMPLATE_DELETE: 'template:delete',
  TEMPLATE_GET: 'template:get',
  TEMPLATE_LIST: 'template:list',
  TEMPLATE_RENDER: 'template:render',

  // Contact operations
  CONTACT_CREATE: 'contact:create',
  CONTACT_UPDATE: 'contact:update',
  CONTACT_DELETE: 'contact:delete',
  CONTACT_GET: 'contact:get',
  CONTACT_LIST: 'contact:list',
  CONTACT_IMPORT: 'contact:import',
  CONTACT_EXPORT: 'contact:export',

  // Email operations
  EMAIL_SEND: 'email:send',
  EMAIL_ACCOUNT_ADD: 'email:account:add',
  EMAIL_ACCOUNT_REMOVE: 'email:account:remove',
  EMAIL_ACCOUNT_LIST: 'email:account:list',
  EMAIL_ACCOUNT_TEST: 'email:account:test',

  // Document operations
  DOCUMENT_GENERATE: 'document:generate',
  DOCUMENT_PREVIEW: 'document:preview',

  // Audit operations
  AUDIT_LIST: 'audit:list',
  AUDIT_GET: 'audit:get',
  AUDIT_EXPORT: 'audit:export',

  // Settings operations
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Python bridge
  PYTHON_STATUS: 'python:status',
  PYTHON_RESTART: 'python:restart',

  // Activity log operations
  ACTIVITY_LOG_CREATE: 'activity:create',
  ACTIVITY_LOG_LIST: 'activity:list',
  ACTIVITY_LOG_GET: 'activity:get',
  ACTIVITY_LOG_CLEAR: 'activity:clear',
  ACTIVITY_LOG_EXPORT: 'activity:export',

  // Scheduled message operations
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_DELETE: 'schedule:delete',
  SCHEDULE_GET: 'schedule:get',
  SCHEDULE_LIST: 'schedule:list',
  SCHEDULE_CANCEL: 'schedule:cancel',

  // Reminder operations
  REMINDER_CREATE: 'reminder:create',
  REMINDER_UPDATE: 'reminder:update',
  REMINDER_DELETE: 'reminder:delete',
  REMINDER_GET: 'reminder:get',
  REMINDER_LIST: 'reminder:list',
  REMINDER_SNOOZE: 'reminder:snooze',
  REMINDER_COMPLETE: 'reminder:complete',
  REMINDER_DISMISS: 'reminder:dismiss',

  // Sound operations
  SOUND_UPLOAD: 'sound:upload',
  SOUND_GET_PATH: 'sound:getPath',

  // Dialog operations
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',

  // WhatsApp operations
  WHATSAPP_STATUS: 'whatsapp:status',
  WHATSAPP_SEND: 'whatsapp:send',
  WHATSAPP_OPEN_CHAT: 'whatsapp:openChat',

  // Teams operations
  TEAMS_STATUS: 'teams:status',
  TEAMS_LOGIN: 'teams:login',
  TEAMS_LOGOUT: 'teams:logout',
  TEAMS_SEND: 'teams:send',
  TEAMS_OPEN_CHAT: 'teams:openChat',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  DETECT_DESKTOP_MAIL_APPS: 'shell:detectDesktopMailApps',
  OPEN_IN_DESKTOP_MAIL_APP: 'shell:openInDesktopMailApp',

  // Contact Group operations
  GROUP_CREATE: 'group:create',
  GROUP_UPDATE: 'group:update',
  GROUP_DELETE: 'group:delete',
  GROUP_GET: 'group:get',
  GROUP_LIST: 'group:list',
  GROUP_ADD_CONTACT: 'group:addContact',
  GROUP_REMOVE_CONTACT: 'group:removeContact',
  GROUP_REORDER: 'group:reorder',

  // Snippet operations
  SNIPPET_CREATE: 'snippet:create',
  SNIPPET_UPDATE: 'snippet:update',
  SNIPPET_DELETE: 'snippet:delete',
  SNIPPET_GET: 'snippet:get',
  SNIPPET_LIST: 'snippet:list',
  SNIPPET_INCREMENT_USAGE: 'snippet:incrementUsage',

  // Calendar operations
  CALENDAR_CREATE: 'calendar:create',
  CALENDAR_UPDATE: 'calendar:update',
  CALENDAR_DELETE: 'calendar:delete',
  CALENDAR_GET: 'calendar:get',
  CALENDAR_LIST: 'calendar:list',

  // Task operations
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_GET: 'task:get',
  TASK_LIST: 'task:list',
  TASK_REORDER: 'task:reorder',
  TASK_COMPLETE_RECURRING: 'task:completeRecurring',

  // Note group operations
  NOTE_GROUP_CREATE: 'note-group:create',
  NOTE_GROUP_UPDATE: 'note-group:update',
  NOTE_GROUP_DELETE: 'note-group:delete',
  NOTE_GROUP_LIST: 'note-group:list',

  // Note operations
  NOTE_CREATE: 'note:create',
  NOTE_UPDATE: 'note:update',
  NOTE_DELETE: 'note:delete',
  NOTE_GET: 'note:get',
  NOTE_LIST: 'note:list',

  // Expense operations
  EXPENSE_CREATE: 'expense:create',
  EXPENSE_UPDATE: 'expense:update',
  EXPENSE_DELETE: 'expense:delete',
  EXPENSE_GET: 'expense:get',
  EXPENSE_LIST: 'expense:list',
  EXPENSE_SUMMARY: 'expense:summary',

  // DOCX Template operations
  DOCX_TEMPLATE_UPLOAD: 'docx-template:upload',
  DOCX_TEMPLATE_PARSE: 'docx-template:parse',
  DOCX_TEMPLATE_VALIDATE: 'docx-template:validate',
  DOCX_TEMPLATE_PREVIEW: 'docx-template:preview',
  DOCX_TEMPLATE_RENDER: 'docx-template:render',
  DOCX_TEMPLATE_LIST: 'docx-template:list',
  DOCX_TEMPLATE_GET: 'docx-template:get',
  DOCX_TEMPLATE_DELETE: 'docx-template:delete',

  // Rich Document operations
  RICH_DOC_CREATE: 'rich-doc:create',
  RICH_DOC_UPDATE: 'rich-doc:update',
  RICH_DOC_DELETE: 'rich-doc:delete',
  RICH_DOC_GET: 'rich-doc:get',
  RICH_DOC_LIST: 'rich-doc:list',
  RICH_DOC_EXPORT_PDF: 'rich-doc:exportPdf',
  RICH_DOC_SAVE_PDF: 'rich-doc:savePdf',
  RICH_DOC_LIST_SAVED_PDFS: 'rich-doc:listSavedPdfs',
  RICH_DOC_GET_TEMPLATE: 'rich-doc:getTemplate',
  RICH_DOC_RENDER_TEMP_PDF: 'rich-doc:renderTempPdf',

  // Automation Rule operations
  RULE_CREATE: 'rule:create',
  RULE_UPDATE: 'rule:update',
  RULE_DELETE: 'rule:delete',
  RULE_GET: 'rule:get',
  RULE_LIST: 'rule:list',

  // Data backup & restore
  BACKUP_EXPORT: 'backup:export',
  BACKUP_INSPECT: 'backup:inspect',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_AUTO_STATUS: 'backup:autoStatus',
  BACKUP_AUTO_SET: 'backup:autoSet',
  BACKUP_RESTORE_LATEST_AUTO: 'backup:restoreLatestAuto',

  // Diagnostics
  DIAGNOSTICS_CHECK_DB: 'diagnostics:checkDb',
  DIAGNOSTICS_STATS: 'diagnostics:stats',
  DIAGNOSTICS_OPEN_BACKUPS_FOLDER: 'diagnostics:openBackupsFolder',
  DIAGNOSTICS_VACUUM: 'diagnostics:vacuum',
} as const;

// ============================================
// RICH DOCUMENT TYPES
// ============================================

export interface RichDocument {
  id: string;
  title: string;
  content: string;
  pageColor: string;
  isTemplate: boolean;
  placeholders: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRichDocumentInput {
  title: string;
  content?: string;
  pageColor?: string;
  isTemplate?: boolean;
  placeholders?: string[];
}

export interface UpdateRichDocumentInput {
  title?: string;
  content?: string;
  pageColor?: string;
  isTemplate?: boolean;
  placeholders?: string[];
}

export interface ExportPdfRequest {
  htmlContent: string;
  pageColor: string;
  outputPath: string;
}

export interface ExportPdfResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface SavePdfRequest {
  htmlContent: string;
  pageColor: string;
  title: string;
  docId: string;
  /** Original HTML with placeholders intact (saved as template for per-recipient generation) */
  templateHtml?: string;
}

export interface SavePdfResponse {
  success: boolean;
  filePath?: string;
  filename?: string;
  error?: string;
}

export interface SavedPdfEntry {
  filename: string;
  path: string;
  size: number;
  modifiedAt: string;
  docId?: string;
  hasTemplate?: boolean;
  placeholders?: string[];
}

export interface GetTemplateResponse {
  html: string;
  pageColor: string;
  placeholders: string[];
}

export interface RenderTempPdfRequest {
  htmlContent: string;
  pageColor: string;
  filename: string;
}

export interface RenderTempPdfResponse {
  success: boolean;
  path?: string;
  error?: string;
}

// ============================================
// SETTINGS TYPES
// ============================================

export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'teal';

export type FontSize = 'small' | 'medium' | 'large';

export interface ThemeSettings {
  mode: ThemeMode;
  accentColor: AccentColor;
  fontSize: FontSize;
  reducedMotion: boolean;
  compactMode: boolean;
}

export interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface ProfileSettings {
  name: string;
  showNameInGreeting: boolean;
  signatureDataUrl?: string; // legacy single signature
  signatures?: SavedSignature[];
  defaultSignatureId?: string;
}

export interface SidebarGroup {
  id: string;
  name: string;
  items: string[]; // hrefs
  isOpen: boolean;
}

export const DASHBOARD_WIDGET_IDS = [
  'stats', 'mainAction', 'forYou', 'quickLinks', 'upcoming',
  'tasks', 'events', 'reminders', 'recentActivity',
] as const;

export type DashboardWidgetId = typeof DASHBOARD_WIDGET_IDS[number];

export type WidgetSpan = 1 | 2 | 3;

export const DEFAULT_WIDGET_SPANS: Partial<Record<DashboardWidgetId, WidgetSpan>> = {
  stats: 3,
  mainAction: 3,
  forYou: 3,
  recentActivity: 2,
  quickLinks: 2,
};

export interface DashboardSettings {
  favoritePages: string[];
  showQuickLinks: boolean;
  showUpcoming: boolean;
  showRecentActivity: boolean;
  showUpcomingTasks: boolean;
  showUpcomingEvents: boolean;
  showReminders: boolean;
  sidebarGroups?: SidebarGroup[];
  widgetOrder?: DashboardWidgetId[];
  widgetSpans?: Partial<Record<DashboardWidgetId, WidgetSpan>>;
}

// USA, India, and GCC currencies
export type Currency = 'USD' | 'INR' | 'AED' | 'SAR' | 'BHD' | 'OMR' | 'QAR' | 'KWD';
export type TimeFormat = 'system' | '12h' | '24h';
export type DateFormat = 'system' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type WeekStart = 'system' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
export type TasksViewMode = 'kanban' | 'list';
export type NotesViewMode = 'grid' | 'list';
export interface WebMailService {
  id: string;
  name: string;
  composeUrl: string; // URL template with {to}, {subject}, {body} placeholders
}

export const DEFAULT_WEB_MAIL_SERVICES: WebMailService[] = [
  { id: 'gmail', name: 'Gmail', composeUrl: 'https://mail.google.com/mail/?view=cm&to={to}&su={subject}&body={body}' },
  { id: 'outlook', name: 'Outlook', composeUrl: 'https://outlook.live.com/mail/0/deeplink/compose?to={to}&subject={subject}&body={body}' },
  { id: 'yahoo', name: 'Yahoo Mail', composeUrl: 'https://compose.mail.yahoo.com/?to={to}&subject={subject}&body={body}' },
  { id: 'zoho', name: 'Zoho Mail', composeUrl: 'https://mail.zoho.com/zm/#compose?to={to}&subject={subject}&body={body}' },
  { id: 'protonmail', name: 'ProtonMail', composeUrl: 'https://mail.proton.me/u/0/#compose?to={to}&subject={subject}&body={body}' },
  { id: 'aol', name: 'AOL Mail', composeUrl: 'https://compose.mail.aol.com/?to={to}&subject={subject}&body={body}' },
  { id: 'icloud', name: 'iCloud Mail', composeUrl: 'https://www.icloud.com/mail/#compose?to={to}&subject={subject}&body={body}' },
];

export interface DesktopMailApp {
  id: string;
  name: string;
  path: string;
}

// ============================================
// USER PROFILE TYPES
// ============================================

export type UserProfileCategory =
  | 'student'
  | 'worker'
  | 'elder'
  | 'freelancer'
  | 'business_owner'
  | 'homemaker'
  | 'parent';

export interface UserProfileMeta {
  label: string;
  icon: string;
  color: string;
  description: string;
  expenseCategories: Record<string, { label: string; icon: string; color: string }>;
  taskTags: string[];
  templateSuggestions: string[];
  snippetSuggestions: { name: string; shortcut: string; content: string }[];
}

export type PlaceholderGroup = 'sender' | 'recipient' | 'date' | 'custom';

export interface PlaceholderDefault {
  key: string;
  label: string;
  group: PlaceholderGroup;
  defaultValue: string;
  isBuiltIn: boolean; // true for system placeholders, false for user-created
}

export interface PlaceholderSettings {
  defaults: PlaceholderDefault[];
  promptOnCompose: boolean; // Ask user to fill in values while composing
}

export interface PreferencesSettings {
  currency: Currency;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  weekStart: WeekStart;
  // View preferences
  defaultTasksView?: TasksViewMode;
  defaultNotesView?: NotesViewMode;
  // User profile categories
  userProfiles?: UserProfileCategory[];
  // Medical reminders
  medicalReminders?: boolean;
  // Notification sounds
  notificationSounds?: NotificationSoundSettings;
  customSoundPaths?: Partial<Record<NotificationSoundType, string>>;
  // Vibration settings (mobile/tablet only)
  notificationVibration?: NotificationVibrationSettings;
  // Configured web mail services for compose
  webMailServices?: WebMailService[];
  // Template placeholder defaults
  placeholders?: PlaceholderSettings;
  // Custom expense categories
  customExpenseCategories?: Record<string, { label: string; icon: string; color: string }>;
}

export interface AppSettings {
  theme: ThemeSettings;
  profile: ProfileSettings;
  dashboard: DashboardSettings;
  preferences: PreferencesSettings;
  defaultEmailAccount?: string;
  confirmBeforeSend: boolean;
  confirmBulkSend: boolean;
  bulkSendThreshold: number;
  sensitiveDataDetection: boolean;
  autoSaveInterval: number;
  sidebarCollapsed: boolean;
  teamsClientId?: string;
  setupComplete?: boolean;
  enabledFeatures?: Record<string, boolean>;
}

export const SETUP_FEATURE_GROUPS = [
  {
    name: 'Communication',
    features: [
      { href: '/compose', name: 'Compose', description: 'Create and send messages', icon: 'Send' },
      { href: '/templates', name: 'Templates', description: 'Message templates', icon: 'FileText' },
      { href: '/snippets', name: 'Snippets', description: 'Reusable text blocks', icon: 'Zap' },
      { href: '/scheduled', name: 'Scheduled', description: 'Schedule messages', icon: 'Clock' },
      { href: '/history', name: 'History', description: 'Sent messages log', icon: 'History' },
    ],
  },
  {
    name: 'Organization',
    features: [
      { href: '/contacts', name: 'Contacts', description: 'Contact management', icon: 'Users' },
      { href: '/calendar', name: 'Calendar', description: 'Events and scheduling', icon: 'Calendar' },
      { href: '/tasks', name: 'Tasks', description: 'Task management board', icon: 'CheckSquare' },
      { href: '/reminders', name: 'Reminders', description: 'Reminders and alerts', icon: 'Bell' },
    ],
  },
  {
    name: 'Tools',
    features: [
      { href: '/notes', name: 'Notes', description: 'Quick notes', icon: 'StickyNote' },
      { href: '/documents', name: 'Documents', description: 'Rich document editor', icon: 'FileUp' },
      { href: '/expenses', name: 'Expenses', description: 'Expense tracking', icon: 'DollarSign' },
      { href: '/calculator', name: 'Calculator', description: 'Calculator', icon: 'Calculator' },
      { href: '/activity', name: 'Activity Log', description: 'Activity history', icon: 'Activity' },
      { href: '/focus', name: 'Focus Timer', description: 'Pomodoro timer', icon: 'Timer' },
      { href: '/automations', name: 'Automations', description: 'If-then automation rules', icon: 'Workflow' },
    ],
  },
];

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  accentColor: 'blue',
  fontSize: 'medium',
  reducedMotion: false,
  compactMode: false,
};

export const DEFAULT_PROFILE: ProfileSettings = {
  name: '',
  showNameInGreeting: true,
};

export const DEFAULT_DASHBOARD: DashboardSettings = {
  favoritePages: [],
  showQuickLinks: true,
  showUpcoming: true,
  showRecentActivity: true,
  showUpcomingTasks: true,
  showUpcomingEvents: true,
  showReminders: true,
};

export const DEFAULT_PREFERENCES: PreferencesSettings = {
  currency: 'USD',
  timeFormat: 'system',
  dateFormat: 'system',
  weekStart: 'system',
  defaultTasksView: 'kanban',
  defaultNotesView: 'grid',
  userProfiles: [],
  medicalReminders: false,
  notificationSounds: { reminders: 'default', medical: 'alarm', scheduled: 'default' },
  notificationVibration: { reminders: 'default', medical: 'urgent', scheduled: 'short' },
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_THEME,
  profile: DEFAULT_PROFILE,
  dashboard: DEFAULT_DASHBOARD,
  preferences: DEFAULT_PREFERENCES,
  confirmBeforeSend: true,
  confirmBulkSend: true,
  bulkSendThreshold: 5,
  sensitiveDataDetection: true,
  autoSaveInterval: 30000,
  sidebarCollapsed: false,
};

export const CURRENCIES: Record<Currency, { flag: string; name: string }> = {
  // USA
  USD: { flag: '🇺🇸', name: 'US Dollar' },
  // India
  INR: { flag: '🇮🇳', name: 'Indian Rupee' },
  // GCC Countries
  AED: { flag: '🇦🇪', name: 'UAE Dirham' },
  SAR: { flag: '🇸🇦', name: 'Saudi Riyal' },
  BHD: { flag: '🇧🇭', name: 'Bahraini Dinar' },
  OMR: { flag: '🇴🇲', name: 'Omani Rial' },
  QAR: { flag: '🇶🇦', name: 'Qatari Riyal' },
  KWD: { flag: '🇰🇼', name: 'Kuwaiti Dinar' },
};

export const USER_PROFILES: Record<UserProfileCategory, UserProfileMeta> = {
  student: {
    label: 'Student',
    icon: 'GraduationCap',
    color: '#3b82f6',
    description: 'Courses, assignments & campus life',
    expenseCategories: {
      tuition: { label: 'Tuition & Fees', icon: 'GraduationCap', color: '#3b82f6' },
      books_supplies: { label: 'Books & Supplies', icon: 'BookOpen', color: '#8b5cf6' },
      campus: { label: 'Campus & Housing', icon: 'Building', color: '#06b6d4' },
    },
    taskTags: ['assignment', 'exam', 'study', 'project', 'lab', 'lecture'],
    templateSuggestions: ['Professor email', 'Assignment submission', 'Study group invitation', 'Leave of absence'],
    snippetSuggestions: [
      { name: 'Professor greeting', shortcut: 'prof', content: 'Dear Professor {{name}},\n\nI hope this email finds you well. I am writing regarding...' },
      { name: 'Assignment submission', shortcut: 'submit', content: 'Please find attached my submission for {{assignment_name}}. I have reviewed the requirements and ensured all criteria are met.' },
    ],
  },
  worker: {
    label: 'Employee',
    icon: 'Briefcase',
    color: '#6366f1',
    description: 'Office work, meetings & reimbursements',
    expenseCategories: {
      professional_dev: { label: 'Professional Development', icon: 'TrendingUp', color: '#6366f1' },
      work_meals: { label: 'Work Meals', icon: 'Coffee', color: '#f97316' },
      commute: { label: 'Commute', icon: 'Train', color: '#14b8a6' },
      reimbursable: { label: 'Reimbursable', icon: 'Receipt', color: '#22c55e' },
    },
    taskTags: ['meeting', 'deadline', 'review', 'presentation', 'report'],
    templateSuggestions: ['Meeting follow-up', 'Leave request', 'Status update', 'Reimbursement request'],
    snippetSuggestions: [
      { name: 'Meeting follow-up', shortcut: 'meetup', content: 'Thank you for your time in today\'s meeting. Here is a summary of the key points discussed:\n\n1. \n2. \n3. ' },
      { name: 'Status update', shortcut: 'status', content: 'Here is my status update for {{period}}:\n\nCompleted:\n- \n\nIn Progress:\n- \n\nBlockers:\n- ' },
    ],
  },
  elder: {
    label: 'Senior',
    icon: 'HeartPulse',
    color: '#ef4444',
    description: 'Health tracking, medication & wellness',
    expenseCategories: {
      medication: { label: 'Medication', icon: 'Pill', color: '#ef4444' },
      medical_visits: { label: 'Medical Visits', icon: 'Stethoscope', color: '#f43f5e' },
      home_care: { label: 'Home Care', icon: 'Home', color: '#f97316' },
    },
    taskTags: ['appointment', 'medication', 'checkup', 'exercise'],
    templateSuggestions: ['Doctor appointment reminder', 'Family update', 'Thank you note'],
    snippetSuggestions: [
      { name: 'Appointment booking', shortcut: 'appt', content: 'I would like to schedule an appointment with Dr. {{doctor_name}} for {{reason}}. Please let me know available dates.' },
    ],
  },
  freelancer: {
    label: 'Freelancer',
    icon: 'Laptop',
    color: '#10b981',
    description: 'Clients, invoices & project delivery',
    expenseCategories: {
      software_tools: { label: 'Software & Tools', icon: 'Code', color: '#10b981' },
      client_expenses: { label: 'Client Expenses', icon: 'Users', color: '#3b82f6' },
      coworking: { label: 'Coworking', icon: 'Building2', color: '#f59e0b' },
      marketing: { label: 'Marketing', icon: 'Megaphone', color: '#ec4899' },
    },
    taskTags: ['client', 'invoice', 'proposal', 'milestone', 'payment'],
    templateSuggestions: ['Client proposal', 'Invoice reminder', 'Project update', 'Payment receipt'],
    snippetSuggestions: [
      { name: 'Invoice reminder', shortcut: 'invoice', content: 'This is a friendly reminder that Invoice #{{invoice_number}} for {{amount}} is due on {{due_date}}. Please let me know if you have any questions.' },
      { name: 'Project proposal', shortcut: 'proposal', content: 'Thank you for considering me for this project. Based on our discussion, here is my proposal:\n\nScope:\n\nTimeline:\n\nBudget:' },
    ],
  },
  business_owner: {
    label: 'Entrepreneur',
    icon: 'Building2',
    color: '#f59e0b',
    description: 'Operations, payroll & growth strategy',
    expenseCategories: {
      payroll: { label: 'Payroll', icon: 'Users', color: '#f59e0b' },
      office_supplies: { label: 'Office Supplies', icon: 'Package', color: '#6366f1' },
      business_travel: { label: 'Business Travel', icon: 'Plane', color: '#06b6d4' },
      equipment: { label: 'Equipment', icon: 'Monitor', color: '#8b5cf6' },
    },
    taskTags: ['client', 'vendor', 'quarterly', 'hiring', 'strategy', 'budget'],
    templateSuggestions: ['Client onboarding', 'Vendor agreement', 'Business proposal', 'Payment confirmation'],
    snippetSuggestions: [
      { name: 'Business proposal', shortcut: 'bizprop', content: 'We are pleased to present our proposal for {{project_name}}. Our company brings extensive experience in this domain.\n\nObjective:\n\nApproach:\n\nInvestment:' },
    ],
  },
  homemaker: {
    label: 'Home Manager',
    icon: 'Home',
    color: '#ec4899',
    description: 'Groceries, household & meal planning',
    expenseCategories: {
      groceries: { label: 'Groceries', icon: 'ShoppingCart', color: '#22c55e' },
      household: { label: 'Household Items', icon: 'Home', color: '#6366f1' },
      cleaning: { label: 'Cleaning & Maintenance', icon: 'Sparkles', color: '#06b6d4' },
    },
    taskTags: ['chore', 'grocery', 'meal', 'cleaning', 'maintenance', 'budget'],
    templateSuggestions: ['Grocery list', 'Maintenance reminder', 'Family invitation'],
    snippetSuggestions: [
      { name: 'Weekly grocery', shortcut: 'grocery', content: 'Weekly Grocery List:\n\nFruits & Vegetables:\n- \n\nDairy:\n- \n\nMeat & Fish:\n- \n\nPantry:\n- ' },
    ],
  },
  parent: {
    label: 'Parent',
    icon: 'Baby',
    color: '#8b5cf6',
    description: 'Schooling, childcare & family schedules',
    expenseCategories: {
      school_fees: { label: 'School Fees', icon: 'GraduationCap', color: '#3b82f6' },
      childcare: { label: 'Childcare', icon: 'Baby', color: '#8b5cf6' },
      kids_activities: { label: 'Kids Activities', icon: 'Palette', color: '#f59e0b' },
      kids_health: { label: 'Kids Health', icon: 'Heart', color: '#ef4444' },
    },
    taskTags: ['school', 'activity', 'appointment', 'birthday', 'sports', 'homework'],
    templateSuggestions: ['School absence note', 'Parent-teacher meeting', 'Birthday invitation', 'Activity signup'],
    snippetSuggestions: [
      { name: 'School absence', shortcut: 'absent', content: 'Dear {{teacher_name}},\n\nI am writing to inform you that my child, {{child_name}}, will be absent on {{date}} due to {{reason}}.\n\nThank you for your understanding.' },
    ],
  },
};

export const ACCENT_COLORS: Record<AccentColor, { name: string; primary: string; hover: string }> = {
  blue: { name: 'Blue', primary: '#3b82f6', hover: '#2563eb' },
  purple: { name: 'Purple', primary: '#8b5cf6', hover: '#7c3aed' },
  green: { name: 'Green', primary: '#10b981', hover: '#059669' },
  orange: { name: 'Orange', primary: '#f97316', hover: '#ea580c' },
  pink: { name: 'Pink', primary: '#ec4899', hover: '#db2777' },
  teal: { name: 'Teal', primary: '#14b8a6', hover: '#0d9488' },
};

// ============================================
// USER ACTIVITY LOG TYPES
// ============================================

export type ActivityAction =
  | 'template_created'
  | 'template_updated'
  | 'template_deleted'
  | 'contact_created'
  | 'contact_updated'
  | 'contact_deleted'
  | 'contact_imported'
  | 'email_sent'
  | 'email_failed'
  | 'email_account_added'
  | 'email_account_removed'
  | 'whatsapp_sent'
  | 'whatsapp_failed'
  | 'teams_sent'
  | 'teams_failed'
  | 'document_generated'
  | 'document_created'
  | 'document_updated'
  | 'document_deleted'
  | 'settings_updated'
  | 'app_started'
  | 'app_closed'
  | 'message_scheduled'
  | 'message_schedule_cancelled'
  | 'message_schedule_sent'
  | 'message_schedule_failed'
  | 'reminder_created'
  | 'reminder_completed'
  | 'reminder_snoozed'
  | 'reminder_dismissed'
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_archived'
  | 'note_created'
  | 'note_updated'
  | 'note_deleted'
  | 'snippet_created'
  | 'snippet_updated'
  | 'snippet_deleted'
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'backup_exported'
  | 'backup_restored'
  | 'backup_auto_run'
  | 'backup_auto_enabled'
  | 'backup_auto_disabled';

export type ActivityCategory = 'template' | 'contact' | 'email' | 'document' | 'settings' | 'system' | 'schedule' | 'reminder' | 'task' | 'note' | 'snippet' | 'expense';

export interface UserActivityLog {
  id: string;
  action: ActivityAction;
  category: ActivityCategory;
  description: string;
  details?: Record<string, unknown>;
  entityId?: string;
  entityName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface CreateActivityLogInput {
  action: ActivityAction;
  category: ActivityCategory;
  description: string;
  details?: Record<string, unknown>;
  entityId?: string;
  entityName?: string;
}

// ============================================
// CALENDAR EVENT TYPES
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  color?: string;
  remindAt?: string;
  relatedContactId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  allDay?: boolean;
  color?: string;
  remindAt?: string;
  relatedContactId?: string;
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  color?: string;
  remindAt?: string;
  relatedContactId?: string;
}

// ============================================
// TASK TYPES
// ============================================

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';
export type RecurrenceRule = 'daily' | 'weekly' | 'monthly';

export interface TaskRecurrence {
  rule: RecurrenceRule;
  interval: number;
  endDate?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  tags: string[];
  order: number;
  recurrence?: TaskRecurrence;
  parentTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  tags?: string[];
  recurrence?: TaskRecurrence;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  tags?: string[];
  order?: number;
  recurrence?: TaskRecurrence;
}

// ============================================
// NOTE GROUP TYPES
// ============================================

export interface NoteGroup {
  id: string;
  name: string;
  color: string;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteGroupInput {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateNoteGroupInput {
  name?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

// ============================================
// NOTE TYPES
// ============================================

export interface Note {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  color?: string;
  tags: string[];
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
  isPinned?: boolean;
  color?: string;
  tags?: string[];
  groupId?: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  isPinned?: boolean;
  color?: string;
  tags?: string[];
  groupId?: string;
}

// ============================================
// EXPENSE TYPES
// ============================================

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'utilities'
  | 'entertainment'
  | 'shopping'
  | 'health'
  | 'education'
  | 'travel'
  | 'other';

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  food: { label: 'Food & Dining', icon: 'Utensils', color: '#f97316' },
  transport: { label: 'Transportation', icon: 'Car', color: '#3b82f6' },
  utilities: { label: 'Utilities', icon: 'Zap', color: '#eab308' },
  entertainment: { label: 'Entertainment', icon: 'Tv', color: '#8b5cf6' },
  shopping: { label: 'Shopping', icon: 'ShoppingBag', color: '#ec4899' },
  health: { label: 'Health', icon: 'Heart', color: '#ef4444' },
  education: { label: 'Education', icon: 'Book', color: '#10b981' },
  travel: { label: 'Travel', icon: 'Plane', color: '#06b6d4' },
  other: { label: 'Other', icon: 'MoreHorizontal', color: '#6b7280' },
};

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  tags: string[];
  receiptPath?: string;
  createdAt: string;
}

export interface CreateExpenseInput {
  amount: number;
  currency?: string;
  category: string;
  description: string;
  date: string;
  tags?: string[];
  receiptPath?: string;
}

export interface UpdateExpenseInput {
  amount?: number;
  currency?: string;
  category?: string;
  description?: string;
  date?: string;
  tags?: string[];
  receiptPath?: string;
}

export interface ExpenseSummary {
  total: number;
  byCategory: Record<string, number>;
  byMonth: Record<string, number>;
}

// ============================================
// AUTOMATION RULE TYPES
// ============================================

export type RuleTrigger =
  | 'task_completed'
  | 'contact_created'
  | 'message_sent'
  | 'message_scheduled'
  | 'reminder_due'
  | 'expense_created';

export type RuleActionType =
  | 'create_task'
  | 'create_reminder'
  | 'compose_message'
  | 'log_activity'
  | 'show_notification';

export interface RuleAction {
  type: RuleActionType;
  config: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: RuleTrigger;
  triggerConditions?: Record<string, any>;
  actions: RuleAction[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleInput {
  name: string;
  trigger: RuleTrigger;
  triggerConditions?: Record<string, any>;
  actions: RuleAction[];
  enabled?: boolean;
}

export interface UpdateRuleInput {
  name?: string;
  trigger?: RuleTrigger;
  triggerConditions?: Record<string, any>;
  actions?: RuleAction[];
  enabled?: boolean;
}
