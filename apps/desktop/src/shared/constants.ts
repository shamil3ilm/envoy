// Application constants

export const APP_NAME = 'Envoy';
export const APP_VERSION = '1.0.0';

// Database
export const DATABASE_NAME = 'envoy.db';

// Python engine
export const PYTHON_ENGINE_PATH = 'engine/main.py';
export const PYTHON_STARTUP_TIMEOUT = 10000; // 10 seconds

// Template categories with display names
export const TEMPLATE_CATEGORIES = {
  greeting: { label: 'Greeting', description: 'Seasonal and professional greetings' },
  update: { label: 'Update', description: 'Project status and company news' },
  invitation: { label: 'Invitation', description: 'Meetings and events' },
  followup: { label: 'Follow-up', description: 'Soft nudges and firm reminders' },
  apology: { label: 'Apology', description: 'Delay and error acknowledgments' },
  announcement: { label: 'Announcement', description: 'General announcements' },
  custom: { label: 'Custom', description: 'Custom templates' },
} as const;

// Tone options with descriptions
export const TONE_OPTIONS = {
  formal: { label: 'Formal', description: 'For official and business communications' },
  professional: { label: 'Professional', description: 'Balanced, business-appropriate tone' },
  friendly: { label: 'Friendly', description: 'Warm and approachable tone' },
} as const;

// Document types
export const DOCUMENT_TYPES = {
  letter: { label: 'Letter', description: 'Formal correspondence' },
  invoice: { label: 'Invoice', description: 'Billing documents' },
  agenda: { label: 'Agenda', description: 'Meeting preparation' },
  report: { label: 'Report', description: 'Status updates' },
  custom: { label: 'Custom', description: 'Custom documents' },
} as const;

// Default template placeholders (grouped by category)
export const TEMPLATE_PLACEHOLDERS = [
  { key: 'name', description: 'Recipient full name', group: 'recipient' as const },
  { key: 'first_name', description: 'Recipient first name', group: 'recipient' as const },
  { key: 'last_name', description: 'Recipient last name', group: 'recipient' as const },
  { key: 'company', description: 'Company name', group: 'recipient' as const },
  { key: 'title', description: 'Job title', group: 'recipient' as const },
  { key: 'date', description: 'Current date (formatted)', group: 'date' as const },
  { key: 'time', description: 'Current time', group: 'date' as const },
  { key: 'sender_name', description: 'Your name', group: 'sender' as const },
  { key: 'sender_title', description: 'Your job title', group: 'sender' as const },
  { key: 'signature', description: 'Your signature image', group: 'sender' as const },
] as const;

export const PLACEHOLDER_GROUPS = {
  sender: { label: 'Sender (You)', description: 'Values from your profile' },
  recipient: { label: 'Recipient', description: 'Values from contact data' },
  date: { label: 'Date & Time', description: 'Auto-generated date/time values' },
  custom: { label: 'Custom', description: 'User-defined placeholders' },
} as const;

export const DEFAULT_PLACEHOLDER_DEFAULTS = TEMPLATE_PLACEHOLDERS.map((p) => ({
  key: p.key,
  label: p.description,
  group: p.group,
  defaultValue: '',
  isBuiltIn: true,
}));

// Sensitive data patterns (for Python engine)
export const SENSITIVE_DATA_PATTERNS = {
  currency: /\$[\d,]+(\.\d{2})?|\d+\s*(USD|EUR|GBP|AED)/gi,
  accountNumber: /\b\d{8,17}\b/g,
  phone: /\+?[\d\s\-().]{10,}/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
} as const;

// Email provider configurations
export const EMAIL_PROVIDERS = {
  gmail: {
    name: 'Gmail',
    oauthScopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  },
  outlook: {
    name: 'Outlook',
    oauthScopes: ['Mail.Send', 'Mail.Read', 'User.Read'],
  },
  smtp: {
    name: 'SMTP',
    defaultPort: 587,
    defaultSecure: false,
  },
} as const;

// Pagination defaults
export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

// File paths
export const PATHS = {
  data: 'data',
  generated: 'data/generated',
  templates: 'resources/default-templates',
} as const;
