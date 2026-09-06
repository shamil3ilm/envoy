import Database from 'better-sqlite3';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';
import { encryptSecret, decryptSecret, isEncrypted } from './secure-storage';
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
  CreateDocxTemplateInput,
  RichDocument,
  CreateRichDocumentInput,
  UpdateRichDocumentInput,
  AutomationRule,
  CreateRuleInput,
  UpdateRuleInput,
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

/**
 * SQLite Database Service - Local-first storage
 *
 * Data is stored in the user's app data directory:
 * - Windows: %APPDATA%/envoy/envoy.db
 * - macOS: ~/Library/Application Support/envoy/envoy.db
 * - Linux: ~/.config/envoy/envoy.db
 *
 * Attachments and media stored in:
 * - Windows: %APPDATA%/envoy/files/
 * - macOS: ~/Library/Application Support/envoy/files/
 * - Linux: ~/.config/envoy/files/
 */
export class SQLiteDatabaseService {
  private db: Database.Database | null = null;
  private dataPath: string;
  private filesPath: string;

  constructor() {
    // Use app.getPath in production, fallback for dev
    try {
      this.dataPath = path.join(app.getPath('userData'), 'envoy.db');
      this.filesPath = path.join(app.getPath('userData'), 'files');
    } catch {
      // Fallback for development/testing
      this.dataPath = path.join(process.cwd(), 'data', 'envoy.db');
      this.filesPath = path.join(process.cwd(), 'data', 'files');
    }
  }

  async initialize(): Promise<void> {
    // Ensure directories exist
    const dbDir = path.dirname(this.dataPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(this.filesPath)) {
      fs.mkdirSync(this.filesPath, { recursive: true });
    }

    // Open SQLite database
    this.db = new Database(this.dataPath);

    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    await this.runMigrations();

    logger.info(`Database initialized at: ${this.dataPath}`);
    logger.info(`Files stored at: ${this.filesPath}`);
  }

  getFilesPath(): string {
    return this.filesPath;
  }

  getDataPath(): string {
    return this.dataPath;
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create migrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = [
      {
        name: '001_initial_schema',
        statements: [
          // Templates table
          `CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            channel TEXT NOT NULL DEFAULT 'email',
            subject TEXT,
            body TEXT NOT NULL,
            tone TEXT NOT NULL DEFAULT 'professional',
            attachment_template TEXT,
            attachment_format TEXT,
            follow_up_days INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)`,
          `CREATE INDEX IF NOT EXISTS idx_templates_channel ON templates(channel)`,

          // Contacts table
          `CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            company TEXT,
            title TEXT,
            timezone TEXT,
            preferred_channel TEXT DEFAULT 'email',
            custom_fields TEXT DEFAULT '{}',
            tags TEXT DEFAULT '[]',
            last_contacted TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`,
          `CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)`,

          // Audit logs table
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            channel TEXT NOT NULL,
            template_id TEXT,
            template_name TEXT,
            recipient_id TEXT,
            recipient_address TEXT NOT NULL,
            subject TEXT,
            body_preview TEXT,
            attachments TEXT DEFAULT '[]',
            status TEXT NOT NULL,
            sent_at TEXT,
            error_message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status)`,
          `CREATE INDEX IF NOT EXISTS idx_audit_sent_at ON audit_logs(sent_at)`,

          // Settings table
          `CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL DEFAULT '{}'
          )`,

          // Email accounts table
          `CREATE TABLE IF NOT EXISTS email_accounts (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            provider TEXT NOT NULL,
            display_name TEXT,
            is_default INTEGER DEFAULT 0,
            smtp_host TEXT,
            smtp_port INTEGER,
            smtp_secure INTEGER DEFAULT 1,
            smtp_user TEXT,
            smtp_pass TEXT,
            oauth_tokens TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
        ],
      },
      {
        name: '002_activity_logs',
        statements: [
          `CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            entity_name TEXT,
            description TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_logs(type)`,
          `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at)`,
        ],
      },
      {
        name: '003_scheduled_messages',
        statements: [
          `CREATE TABLE IF NOT EXISTS scheduled_messages (
            id TEXT PRIMARY KEY,
            template_id TEXT,
            recipient_ids TEXT NOT NULL DEFAULT '[]',
            channel TEXT NOT NULL DEFAULT 'email',
            subject TEXT,
            body TEXT,
            scheduled_for TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            status TEXT NOT NULL DEFAULT 'pending',
            sent_at TEXT,
            error_message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_messages(status)`,
          `CREATE INDEX IF NOT EXISTS idx_scheduled_for ON scheduled_messages(scheduled_for)`,

          `CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            related_entity_id TEXT,
            related_entity_type TEXT,
            due_at TEXT NOT NULL,
            timezone TEXT NOT NULL DEFAULT 'UTC',
            status TEXT NOT NULL DEFAULT 'pending',
            snoozed_until TEXT,
            notified_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)`,
          `CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at)`,
        ],
      },
      {
        name: '004_contact_groups_snippets',
        statements: [
          `CREATE TABLE IF NOT EXISTS contact_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT DEFAULT '#3b82f6',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,

          `CREATE TABLE IF NOT EXISTS contact_group_members (
            group_id TEXT NOT NULL,
            contact_id TEXT NOT NULL,
            added_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, contact_id),
            FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
          )`,

          `CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            shortcut TEXT UNIQUE,
            content TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'general',
            usage_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_snippet_shortcut ON snippets(shortcut)`,
          `CREATE INDEX IF NOT EXISTS idx_snippet_category ON snippets(category)`,
        ],
      },
      {
        name: '005_productivity_suite',
        statements: [
          // Calendar Events table
          `CREATE TABLE IF NOT EXISTS calendar_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            start_date TEXT NOT NULL,
            end_date TEXT,
            all_day INTEGER DEFAULT 0,
            color TEXT,
            remind_at TEXT,
            related_contact_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_date)`,
          `CREATE INDEX IF NOT EXISTS idx_calendar_end ON calendar_events(end_date)`,

          // Tasks table
          `CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'todo',
            priority TEXT NOT NULL DEFAULT 'medium',
            due_date TEXT,
            tags TEXT DEFAULT '[]',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
          `CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`,
          `CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(sort_order)`,

          // Notes table
          `CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            is_pinned INTEGER DEFAULT 0,
            color TEXT,
            tags TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned)`,

          // Expenses table
          `CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'USD',
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            receipt_path TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`,
          `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`,
        ],
      },
      {
        name: '009_note_groups',
        statements: [
          // Note groups table
          `CREATE TABLE IF NOT EXISTS note_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#3b82f6',
            icon TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          // Add group_id to notes table
          `ALTER TABLE notes ADD COLUMN group_id TEXT REFERENCES note_groups(id)`,
          `CREATE INDEX IF NOT EXISTS idx_notes_group ON notes(group_id)`,
        ],
      },
      {
        name: '010_docx_templates',
        statements: [
          // DOCX Templates table for uploaded document templates
          `CREATE TABLE IF NOT EXISTS docx_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            original_file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            variables TEXT DEFAULT '[]',
            variable_details TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_docx_templates_name ON docx_templates(name)`,
        ],
      },
      {
        name: '011_medical_reminders',
        statements: [
          `ALTER TABLE reminders ADD COLUMN repeat_schedule TEXT`,
          `ALTER TABLE reminders ADD COLUMN metadata TEXT`,
          `ALTER TABLE reminders ADD COLUMN parent_reminder_id TEXT`,
          `CREATE INDEX IF NOT EXISTS idx_reminders_parent ON reminders(parent_reminder_id)`,
        ],
      },
      {
        name: '012_rich_documents',
        statements: [
          `CREATE TABLE IF NOT EXISTS rich_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            page_color TEXT DEFAULT '#ffffff',
            is_template INTEGER DEFAULT 0,
            placeholders TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE INDEX IF NOT EXISTS idx_rich_docs_template ON rich_documents(is_template)`,
          `CREATE INDEX IF NOT EXISTS idx_rich_docs_updated ON rich_documents(updated_at)`,
        ],
      },
      {
        name: '013_recurring_tasks',
        statements: [
          `ALTER TABLE tasks ADD COLUMN recurrence TEXT`,
          `ALTER TABLE tasks ADD COLUMN parent_task_id TEXT`,
        ],
      },
      {
        name: '014_automation_rules',
        statements: [
          `CREATE TABLE IF NOT EXISTS automation_rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            trigger TEXT NOT NULL,
            trigger_conditions TEXT,
            actions TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )`,
        ],
      },
    ];

    const appliedMigrations = this.db
      .prepare('SELECT name FROM migrations')
      .all()
      .map((row: any) => row.name);

    const pending = migrations.filter((m) => !appliedMigrations.includes(m.name));

    if (pending.length > 0) {
      const backupPath = await this.backupDatabaseFile('pre-migration');
      logger.info('Pending migrations detected', { count: pending.length, backupPath });

      for (const migration of pending) {
        logger.info('Applying migration', { name: migration.name });
        try {
          const transaction = this.db.transaction(() => {
            for (const statement of migration.statements) {
              this.db!.exec(statement);
            }
            this.db!
              .prepare('INSERT INTO migrations (name) VALUES (?)')
              .run(migration.name);
          });
          transaction();
          logger.info('Migration applied', { name: migration.name });
        } catch (err) {
          logger.error('Migration failed', { name: migration.name, backupPath, err });
          throw new Error(
            `Migration "${migration.name}" failed. Database was backed up to ${backupPath} before this run. Restore that file to recover.`
          );
        }
      }
    }

    // Opportunistically re-encrypt any legacy plaintext credentials.
    // Idempotent — isEncrypted() short-circuits already-encrypted rows.
    try {
      this.encryptLegacyEmailCredentials();
    } catch (err) {
      logger.error('Legacy credential upgrade failed', err);
    }
  }

  private async backupDatabaseFile(tag: string): Promise<string> {
    const backupDir = path.join(path.dirname(this.dataPath), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `envoy-${tag}-${stamp}.db`);
    fs.copyFileSync(this.dataPath, backupPath);
    return backupPath;
  }

  private encryptLegacyEmailCredentials(): void {
    if (!this.db) return;
    const rows = this.db
      .prepare('SELECT id, smtp_pass, oauth_tokens FROM email_accounts')
      .all() as Array<{ id: string; smtp_pass: string | null; oauth_tokens: string | null }>;

    const update = this.db.prepare(
      'UPDATE email_accounts SET smtp_pass = COALESCE(?, smtp_pass), oauth_tokens = COALESCE(?, oauth_tokens) WHERE id = ?'
    );

    for (const row of rows) {
      const needSmtp = row.smtp_pass && !isEncrypted(row.smtp_pass);
      const needOauth = row.oauth_tokens && !isEncrypted(row.oauth_tokens);
      if (!needSmtp && !needOauth) continue;
      update.run(
        needSmtp ? encryptSecret(row.smtp_pass) : null,
        needOauth ? encryptSecret(row.oauth_tokens) : null,
        row.id
      );
      logger.info('Encrypted legacy email credential row', { id: row.id });
    }
  }

  // ============================================
  // TEMPLATE OPERATIONS
  // ============================================

  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO templates (
        id, name, category, channel, subject, body, tone,
        attachment_template, attachment_format, follow_up_days,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.category,
      input.channel || 'email',
      input.subject || null,
      input.body,
      input.tone || 'professional',
      input.attachmentTemplate || null,
      input.attachmentFormat || null,
      input.followUpDays || null,
      now,
      now
    );

    return (await this.getTemplate(id))!;
  }

  async getTemplate(id: string): Promise<Template | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    return row ? this.mapTemplate(row) : null;
  }

  async listTemplates(filter?: { category?: string; channel?: string }): Promise<Template[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM templates WHERE 1=1';
    const params: any[] = [];

    if (filter?.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.channel) {
      sql += ' AND channel = ?';
      params.push(filter.channel);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapTemplate(row));
  }

  async updateTemplate(id: string, input: Partial<CreateTemplateInput>): Promise<Template> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
    if (input.category !== undefined) { updates.push('category = ?'); values.push(input.category); }
    if (input.channel !== undefined) { updates.push('channel = ?'); values.push(input.channel); }
    if (input.subject !== undefined) { updates.push('subject = ?'); values.push(input.subject); }
    if (input.body !== undefined) { updates.push('body = ?'); values.push(input.body); }
    if (input.tone !== undefined) { updates.push('tone = ?'); values.push(input.tone); }
    if (input.attachmentTemplate !== undefined) { updates.push('attachment_template = ?'); values.push(input.attachmentTemplate); }
    if (input.attachmentFormat !== undefined) { updates.push('attachment_format = ?'); values.push(input.attachmentFormat); }
    if (input.followUpDays !== undefined) { updates.push('follow_up_days = ?'); values.push(input.followUpDays); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getTemplate(id))!;
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  }

  private mapTemplate(row: any): Template {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      channel: row.channel,
      subject: row.subject || undefined,
      body: row.body,
      tone: row.tone,
      attachmentTemplate: row.attachment_template || undefined,
      attachmentFormat: row.attachment_format || undefined,
      followUpDays: row.follow_up_days || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // CONTACT OPERATIONS
  // ============================================

  async createContact(input: CreateContactInput): Promise<Contact> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO contacts (
        id, name, email, phone, company, title, timezone,
        preferred_channel, custom_fields, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.email || null,
      input.phone || null,
      input.company || null,
      input.title || null,
      input.timezone || null,
      input.preferredChannel || 'email',
      JSON.stringify(input.customFields || {}),
      JSON.stringify(input.tags || []),
      now,
      now
    );

    return (await this.getContact(id))!;
  }

  async getContact(id: string): Promise<Contact | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as any;
    return row ? this.mapContact(row) : null;
  }

  async listContacts(filter?: { search?: string; tags?: string[] }): Promise<Contact[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params: any[] = [];

    if (filter?.search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY name ASC';

    let rows = this.db.prepare(sql).all(...params) as any[];

    // Filter by tags in JavaScript (SQLite JSON support is limited)
    if (filter?.tags && filter.tags.length > 0) {
      rows = rows.filter((row) => {
        const contactTags = JSON.parse(row.tags || '[]');
        return filter.tags!.some((tag) => contactTags.includes(tag));
      });
    }

    return rows.map((row) => this.mapContact(row));
  }

  async updateContact(id: string, input: Partial<CreateContactInput>): Promise<Contact> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
    if (input.email !== undefined) { updates.push('email = ?'); values.push(input.email); }
    if (input.phone !== undefined) { updates.push('phone = ?'); values.push(input.phone); }
    if (input.company !== undefined) { updates.push('company = ?'); values.push(input.company); }
    if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
    if (input.timezone !== undefined) { updates.push('timezone = ?'); values.push(input.timezone); }
    if (input.preferredChannel !== undefined) { updates.push('preferred_channel = ?'); values.push(input.preferredChannel); }
    if (input.customFields !== undefined) { updates.push('custom_fields = ?'); values.push(JSON.stringify(input.customFields)); }
    if (input.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(input.tags)); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getContact(id))!;
  }

  async deleteContact(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  }

  async updateContactLastContacted(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('UPDATE contacts SET last_contacted = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
  }

  private mapContact(row: any): Contact {
    return {
      id: row.id,
      name: row.name,
      email: row.email || undefined,
      phone: row.phone || undefined,
      company: row.company || undefined,
      title: row.title || undefined,
      timezone: row.timezone || undefined,
      preferredChannel: row.preferred_channel,
      customFields: JSON.parse(row.custom_fields || '{}'),
      tags: JSON.parse(row.tags || '[]'),
      lastContacted: row.last_contacted || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // CONTACT GROUP OPERATIONS
  // ============================================

  async createContactGroup(input: CreateContactGroupInput): Promise<ContactGroup> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO contact_groups (id, name, description, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.description || null, input.color || '#3b82f6', now, now);

    return (await this.getContactGroup(id))!;
  }

  async getContactGroup(id: string): Promise<ContactGroup | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM contact_groups WHERE id = ?').get(id) as any;
    if (!row) return null;

    const memberRows = this.db.prepare(
      'SELECT contact_id FROM contact_group_members WHERE group_id = ?'
    ).all(id) as any[];

    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      color: row.color,
      icon: row.icon || undefined,
      contactIds: memberRows.map((m) => m.contact_id),
      sortOrder: row.sort_order || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listContactGroups(): Promise<ContactGroup[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM contact_groups ORDER BY name ASC').all() as any[];
    const groups: ContactGroup[] = [];

    for (const row of rows) {
      const memberRows = this.db.prepare(
        'SELECT contact_id FROM contact_group_members WHERE group_id = ?'
      ).all(row.id) as any[];

      groups.push({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        color: row.color,
        icon: row.icon || undefined,
        contactIds: memberRows.map((m) => m.contact_id),
        sortOrder: row.sort_order || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return groups;
  }

  async updateContactGroup(id: string, input: Partial<CreateContactGroupInput>): Promise<ContactGroup> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
    if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
    if (input.color !== undefined) { updates.push('color = ?'); values.push(input.color); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE contact_groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getContactGroup(id))!;
  }

  async deleteContactGroup(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM contact_groups WHERE id = ?').run(id);
  }

  async addContactToGroup(groupId: string, contactId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(`
      INSERT OR IGNORE INTO contact_group_members (group_id, contact_id)
      VALUES (?, ?)
    `).run(groupId, contactId);
  }

  async removeContactFromGroup(groupId: string, contactId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM contact_group_members WHERE group_id = ? AND contact_id = ?')
      .run(groupId, contactId);
  }

  async getContactGroups(contactId: string): Promise<ContactGroup[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare(`
      SELECT g.* FROM contact_groups g
      INNER JOIN contact_group_members m ON g.id = m.group_id
      WHERE m.contact_id = ?
      ORDER BY g.name ASC
    `).all(contactId) as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      color: row.color,
      icon: row.icon || undefined,
      contactIds: [],
      sortOrder: row.sort_order || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // ============================================
  // SNIPPET OPERATIONS
  // ============================================

  async createSnippet(input: CreateSnippetInput): Promise<Snippet> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO snippets (id, name, shortcut, content, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.shortcut || null, input.content, input.category || 'general', now, now);

    return (await this.getSnippet(id))!;
  }

  async getSnippet(id: string): Promise<Snippet | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM snippets WHERE id = ?').get(id) as any;
    return row ? this.mapSnippet(row) : null;
  }

  async getSnippetByShortcut(shortcut: string): Promise<Snippet | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM snippets WHERE shortcut = ?').get(shortcut) as any;
    return row ? this.mapSnippet(row) : null;
  }

  async listSnippets(filter?: { category?: string; search?: string }): Promise<Snippet[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM snippets WHERE 1=1';
    const params: any[] = [];

    if (filter?.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.search) {
      sql += ' AND (name LIKE ? OR content LIKE ? OR shortcut LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY usage_count DESC, name ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapSnippet(row));
  }

  async updateSnippet(id: string, input: Partial<CreateSnippetInput>): Promise<Snippet> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
    if (input.shortcut !== undefined) { updates.push('shortcut = ?'); values.push(input.shortcut); }
    if (input.content !== undefined) { updates.push('content = ?'); values.push(input.content); }
    if (input.category !== undefined) { updates.push('category = ?'); values.push(input.category); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE snippets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getSnippet(id))!;
  }

  async deleteSnippet(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM snippets WHERE id = ?').run(id);
  }

  async incrementSnippetUsage(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('UPDATE snippets SET usage_count = usage_count + 1 WHERE id = ?').run(id);
  }

  private mapSnippet(row: any): Snippet {
    return {
      id: row.id,
      name: row.name,
      shortcut: row.shortcut || undefined,
      content: row.content,
      category: row.category,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // SETTINGS OPERATIONS
  // ============================================

  async getSettings(): Promise<AppSettings> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT data FROM settings WHERE id = 1').get() as any;
    if (!row) {
      await this.saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(row.data);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      INSERT INTO settings (id, data) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data
    `).run(JSON.stringify(settings));
  }

  async setSettings(updates: Partial<AppSettings>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Get existing settings
    const current = await this.getSettings();

    // Deep merge for nested objects like preferences and dashboard
    const merged: AppSettings = { ...current };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Deep merge for objects
        (merged as any)[key] = { ...(current as any)[key], ...value };
      } else {
        (merged as any)[key] = value;
      }
    }

    await this.saveSettings(merged);
  }

  // ============================================
  // EMAIL ACCOUNT OPERATIONS
  // ============================================

  async createEmailAccount(account: Omit<EmailAccount, 'id' | 'createdAt'>): Promise<EmailAccount> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    // If this is the first account or marked as default, unset other defaults
    if (account.isDefault) {
      this.db.prepare('UPDATE email_accounts SET is_default = 0').run();
    }

    const cfg = (account.config as any) || {};
    const encryptedPassword = encryptSecret(cfg.password || null);
    const encryptedOauth = cfg.accessToken ? encryptSecret(JSON.stringify(cfg)) : null;

    this.db.prepare(`
      INSERT INTO email_accounts (
        id, email, provider, display_name, is_default,
        smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
        oauth_tokens, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      account.fromEmail,
      account.type,
      account.fromName || account.name,
      account.isDefault ? 1 : 0,
      cfg.host || null,
      cfg.port || null,
      cfg.secure ? 1 : 0,
      cfg.user || null,
      encryptedPassword,
      encryptedOauth,
      now
    );

    return (await this.getEmailAccount(id))!;
  }

  async getEmailAccount(id: string): Promise<EmailAccount | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM email_accounts WHERE id = ?').get(id) as any;
    return row ? this.mapEmailAccount(row) : null;
  }

  async getDefaultEmailAccount(): Promise<EmailAccount | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM email_accounts WHERE is_default = 1').get() as any;
    return row ? this.mapEmailAccount(row) : null;
  }

  async listEmailAccounts(): Promise<EmailAccount[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM email_accounts ORDER BY is_default DESC, email ASC').all() as any[];
    return rows.map((row) => this.mapEmailAccount(row));
  }

  async updateEmailAccount(id: string, update: Partial<EmailAccount>): Promise<EmailAccount> {
    if (!this.db) throw new Error('Database not initialized');

    if (update.isDefault) {
      this.db.prepare('UPDATE email_accounts SET is_default = 0').run();
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (update.fromEmail !== undefined) { updates.push('email = ?'); values.push(update.fromEmail); }
    if (update.type !== undefined) { updates.push('provider = ?'); values.push(update.type); }
    if (update.fromName !== undefined) { updates.push('display_name = ?'); values.push(update.fromName); }
    if (update.isDefault !== undefined) { updates.push('is_default = ?'); values.push(update.isDefault ? 1 : 0); }
    if (update.config !== undefined) {
      const cfg = update.config as any;
      if (cfg.host) {
        updates.push('smtp_host = ?', 'smtp_port = ?', 'smtp_secure = ?', 'smtp_user = ?', 'smtp_pass = ?');
        values.push(cfg.host, cfg.port, cfg.secure ? 1 : 0, cfg.user, encryptSecret(cfg.password || null));
      } else if (cfg.accessToken) {
        updates.push('oauth_tokens = ?');
        values.push(encryptSecret(JSON.stringify(cfg)));
      }
    }

    if (updates.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE email_accounts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getEmailAccount(id))!;
  }

  async deleteEmailAccount(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM email_accounts WHERE id = ?').run(id);
  }

  private mapEmailAccount(row: any): EmailAccount {
    let config: any;
    if (row.smtp_host) {
      config = {
        host: row.smtp_host,
        port: row.smtp_port,
        secure: Boolean(row.smtp_secure),
        user: row.smtp_user,
        password: decryptSecret(row.smtp_pass),
      };
    } else if (row.oauth_tokens) {
      const decrypted = decryptSecret(row.oauth_tokens);
      try {
        config = decrypted ? JSON.parse(decrypted) : {};
      } catch (err) {
        logger.error('Failed to parse oauth_tokens', { id: row.id, err });
        config = {};
      }
    }

    if (row.smtp_pass && !isEncrypted(row.smtp_pass)) {
      // Lazy re-encrypt legacy plaintext row on next write; log the drift.
      logger.warn('Email account has plaintext smtp_pass — will be re-encrypted on next save', { id: row.id });
    }

    return {
      id: row.id,
      name: row.display_name || row.email,
      type: row.provider,
      fromName: row.display_name || '',
      fromEmail: row.email,
      config: config,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
    };
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  async createAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO audit_logs (
        id, channel, template_id, template_name, recipient_id, recipient_address,
        subject, body_preview, attachments, status, sent_at, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      log.channel,
      log.templateId || null,
      log.templateName || null,
      log.recipientId || null,
      log.recipientAddress,
      log.subject || null,
      log.bodyPreview || null,
      JSON.stringify(log.attachments || []),
      log.status,
      log.sentAt || null,
      log.errorMessage || null,
      now
    );

    return (await this.getAuditLog(id))!;
  }

  async getAuditLog(id: string): Promise<AuditLog | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as any;
    return row ? this.mapAuditLog(row) : null;
  }

  async listAuditLogs(filter?: {
    status?: string;
    channel?: string;
    recipientId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status); }
    if (filter?.channel) { sql += ' AND channel = ?'; params.push(filter.channel); }
    if (filter?.recipientId) { sql += ' AND recipient_id = ?'; params.push(filter.recipientId); }
    if (filter?.fromDate) { sql += ' AND sent_at >= ?'; params.push(filter.fromDate); }
    if (filter?.toDate) { sql += ' AND sent_at <= ?'; params.push(filter.toDate); }

    sql += ' ORDER BY created_at DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    if (filter?.offset) {
      sql += ' OFFSET ?';
      params.push(filter.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapAuditLog(row));
  }

  private mapAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      channel: row.channel,
      templateId: row.template_id,
      templateName: row.template_name || '',
      recipientId: row.recipient_id,
      recipientName: row.recipient_name || '',
      recipientAddress: row.recipient_address,
      subject: row.subject || undefined,
      bodyPreview: row.body_preview || '',
      attachments: JSON.parse(row.attachments || '[]'),
      status: row.status,
      sentAt: row.sent_at || new Date().toISOString(),
      deliveredAt: row.delivered_at || undefined,
      errorMessage: row.error_message || undefined,
    };
  }

  // ============================================
  // ACTIVITY LOG OPERATIONS
  // ============================================

  async createActivityLog(input: CreateActivityLogInput): Promise<UserActivityLog> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO activity_logs (
        id, type, action, entity_type, entity_id, entity_name, description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.category,
      input.action,
      input.category,
      input.entityId || null,
      input.entityName || null,
      input.description,
      JSON.stringify(input.details || {}),
      now
    );

    return (await this.getActivityLog(id))!;
  }

  async getActivityLog(id: string): Promise<UserActivityLog | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(id) as any;
    return row ? this.mapActivityLog(row) : null;
  }

  async listActivityLogs(filter?: {
    type?: string;
    category?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: UserActivityLog[]; total: number }> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM activity_logs WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM activity_logs WHERE 1=1';
    const params: any[] = [];

    // Support both 'type' and 'category' filter names (column is 'type')
    const categoryValue = filter?.category || filter?.type;
    if (categoryValue) { sql += ' AND type = ?'; countSql += ' AND type = ?'; params.push(categoryValue); }
    if (filter?.entityType) { sql += ' AND entity_type = ?'; countSql += ' AND entity_type = ?'; params.push(filter.entityType); }
    if (filter?.entityId) { sql += ' AND entity_id = ?'; countSql += ' AND entity_id = ?'; params.push(filter.entityId); }
    if (filter?.action) { sql += ' AND action = ?'; countSql += ' AND action = ?'; params.push(filter.action); }
    if (filter?.search) {
      const clause = ' AND (description LIKE ? OR entity_name LIKE ? OR action LIKE ?)';
      sql += clause; countSql += clause;
      const searchParam = `%${filter.search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    if (filter?.fromDate) { sql += ' AND created_at >= ?'; countSql += ' AND created_at >= ?'; params.push(filter.fromDate); }
    if (filter?.toDate) { sql += ' AND created_at <= ?'; countSql += ' AND created_at <= ?'; params.push(filter.toDate); }

    const countRow = this.db.prepare(countSql).get(...params) as any;
    const total = countRow.count;

    sql += ' ORDER BY created_at DESC';

    const limitParams = [...params];
    if (filter?.limit) {
      sql += ' LIMIT ?';
      limitParams.push(filter.limit);
    }
    if (filter?.offset) {
      sql += ' OFFSET ?';
      limitParams.push(filter.offset);
    }

    const rows = this.db.prepare(sql).all(...limitParams) as any[];
    return { logs: rows.map((row) => this.mapActivityLog(row)), total };
  }

  private mapActivityLog(row: any): UserActivityLog {
    return {
      id: row.id,
      action: row.action,
      category: row.type || row.entity_type,
      description: row.description,
      details: JSON.parse(row.metadata || '{}'),
      entityId: row.entity_id || undefined,
      entityName: row.entity_name || undefined,
      createdAt: row.created_at,
    };
  }

  // ============================================
  // SCHEDULED MESSAGE OPERATIONS
  // ============================================

  async createScheduledMessage(input: CreateScheduledMessageInput): Promise<ScheduledMessage> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO scheduled_messages (
        id, template_id, recipient_ids, channel, subject, body,
        scheduled_for, timezone, status, attachment_paths, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.templateId || null,
      JSON.stringify(input.recipientIds),
      input.channel || 'email',
      null,
      null,
      input.scheduledFor,
      input.timezone || 'UTC',
      'pending',
      JSON.stringify(input.attachmentPaths || []),
      now,
      now
    );

    return (await this.getScheduledMessage(id))!;
  }

  async getScheduledMessage(id: string): Promise<ScheduledMessage | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id) as any;
    return row ? this.mapScheduledMessage(row) : null;
  }

  async listScheduledMessages(filter?: { status?: ScheduleStatus }): Promise<ScheduledMessage[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM scheduled_messages WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY scheduled_for ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapScheduledMessage(row));
  }

  async updateScheduledMessage(id: string, input: UpdateScheduledMessageInput): Promise<ScheduledMessage> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.scheduledFor !== undefined) { updates.push('scheduled_for = ?'); values.push(input.scheduledFor); }
    if (input.timezone !== undefined) { updates.push('timezone = ?'); values.push(input.timezone); }
    if (input.status !== undefined) { updates.push('status = ?'); values.push(input.status); }
    if (input.errorMessage !== undefined) { updates.push('error_message = ?'); values.push(input.errorMessage); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE scheduled_messages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getScheduledMessage(id))!;
  }

  async deleteScheduledMessage(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id);
  }

  async getPendingScheduledMessages(): Promise<ScheduledMessage[]> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const rows = this.db.prepare(`
      SELECT * FROM scheduled_messages
      WHERE status = 'pending' AND scheduled_for <= ?
      ORDER BY scheduled_for ASC
    `).all(now) as any[];

    return rows.map((row) => this.mapScheduledMessage(row));
  }

  private mapScheduledMessage(row: any): ScheduledMessage {
    return {
      id: row.id,
      templateId: row.template_id,
      recipientIds: JSON.parse(row.recipient_ids || '[]'),
      channel: row.channel,
      scheduledFor: row.scheduled_for,
      timezone: row.timezone,
      status: row.status,
      attachmentPaths: row.attachment_paths ? JSON.parse(row.attachment_paths) : undefined,
      errorMessage: row.error_message || undefined,
      createdAt: row.created_at,
    };
  }

  // ============================================
  // REMINDER OPERATIONS
  // ============================================

  async createReminder(input: CreateReminderInput): Promise<Reminder> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO reminders (
        id, type, title, description, related_entity_id, related_entity_type,
        due_at, timezone, status, repeat_schedule, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.type,
      input.title,
      input.description || null,
      input.relatedEntityId || null,
      input.relatedEntityType || null,
      input.dueAt,
      input.timezone || 'UTC',
      'pending',
      input.repeatSchedule ? JSON.stringify(input.repeatSchedule) : null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now
    );

    return (await this.getReminder(id))!;
  }

  async getReminder(id: string): Promise<Reminder | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as any;
    return row ? this.mapReminder(row) : null;
  }

  async listReminders(filter?: { status?: ReminderStatus }): Promise<Reminder[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM reminders WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY due_at ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapReminder(row));
  }

  async updateReminder(id: string, input: UpdateReminderInput): Promise<Reminder> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
    if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
    if (input.dueAt !== undefined) { updates.push('due_at = ?'); values.push(input.dueAt); }
    if (input.timezone !== undefined) { updates.push('timezone = ?'); values.push(input.timezone); }
    if (input.status !== undefined) { updates.push('status = ?'); values.push(input.status); }
    if (input.snoozedUntil !== undefined) { updates.push('snoozed_until = ?'); values.push(input.snoozedUntil); }
    if (input.repeatSchedule !== undefined) { updates.push('repeat_schedule = ?'); values.push(input.repeatSchedule ? JSON.stringify(input.repeatSchedule) : null); }
    if (input.metadata !== undefined) { updates.push('metadata = ?'); values.push(input.metadata ? JSON.stringify(input.metadata) : null); }

    if (updates.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getReminder(id))!;
  }

  async deleteReminder(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  }

  async getDueReminders(): Promise<Reminder[]> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const rows = this.db.prepare(`
      SELECT * FROM reminders
      WHERE (status = 'pending' AND due_at <= ? AND notified_at IS NULL)
         OR (status = 'snoozed' AND snoozed_until <= ?)
      ORDER BY due_at ASC
    `).all(now, now) as any[];

    return rows.map((row) => this.mapReminder(row));
  }

  async markReminderNotified(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.prepare('UPDATE reminders SET notified_at = ? WHERE id = ?').run(now, id);
  }

  private mapReminder(row: any): Reminder {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description || undefined,
      relatedEntityId: row.related_entity_id || undefined,
      relatedEntityType: row.related_entity_type || undefined,
      dueAt: row.due_at,
      timezone: row.timezone,
      status: row.status,
      snoozedUntil: row.snoozed_until || undefined,
      notifiedAt: row.notified_at || undefined,
      repeatSchedule: row.repeat_schedule ? JSON.parse(row.repeat_schedule) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      parentReminderId: row.parent_reminder_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    };
  }

  async createNextOccurrence(parentReminder: Reminder): Promise<Reminder | null> {
    if (!this.db || !parentReminder.repeatSchedule) return null;

    const schedule = parentReminder.repeatSchedule;
    const currentDue = new Date(parentReminder.dueAt);
    let nextDue: Date;

    switch (schedule.interval) {
      case 'hourly':
        nextDue = new Date(currentDue.getTime() + schedule.every * 60 * 60 * 1000);
        break;
      case 'daily':
        nextDue = new Date(currentDue);
        nextDue.setDate(nextDue.getDate() + schedule.every);
        break;
      case 'weekly':
        nextDue = new Date(currentDue);
        nextDue.setDate(nextDue.getDate() + schedule.every * 7);
        break;
      case 'monthly':
        nextDue = new Date(currentDue);
        nextDue.setMonth(nextDue.getMonth() + schedule.every);
        break;
      default:
        return null;
    }

    // Check end date
    if (schedule.endDate && nextDue > new Date(schedule.endDate)) {
      return null;
    }

    // Skip forward if next occurrence is in the past
    const now = new Date();
    while (nextDue < now) {
      switch (schedule.interval) {
        case 'hourly':
          nextDue = new Date(nextDue.getTime() + schedule.every * 60 * 60 * 1000);
          break;
        case 'daily':
          nextDue.setDate(nextDue.getDate() + schedule.every);
          break;
        case 'weekly':
          nextDue.setDate(nextDue.getDate() + schedule.every * 7);
          break;
        case 'monthly':
          nextDue.setMonth(nextDue.getMonth() + schedule.every);
          break;
      }
      if (schedule.endDate && nextDue > new Date(schedule.endDate)) {
        return null;
      }
    }

    const updatedSchedule = {
      ...schedule,
      occurrencesCompleted: (schedule.occurrencesCompleted || 0) + 1,
    };

    const id = uuidv4();
    const createdNow = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO reminders (
        id, type, title, description, related_entity_id, related_entity_type,
        due_at, timezone, status, repeat_schedule, metadata, parent_reminder_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      parentReminder.type,
      parentReminder.title,
      parentReminder.description || null,
      parentReminder.relatedEntityId || null,
      parentReminder.relatedEntityType || null,
      nextDue.toISOString(),
      parentReminder.timezone,
      'pending',
      JSON.stringify(updatedSchedule),
      parentReminder.metadata ? JSON.stringify(parentReminder.metadata) : null,
      parentReminder.id,
      createdNow
    );

    return (await this.getReminder(id))!;
  }

  // ============================================
  // CALENDAR EVENT OPERATIONS
  // ============================================

  async createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO calendar_events (
        id, title, description, start_date, end_date, all_day,
        color, remind_at, related_contact_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.title,
      input.description || null,
      input.startDate,
      input.endDate || null,
      input.allDay ? 1 : 0,
      input.color || null,
      input.remindAt || null,
      input.relatedContactId || null,
      now,
      now
    );

    return (await this.getCalendarEvent(id))!;
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id) as any;
    return row ? this.mapCalendarEvent(row) : null;
  }

  async listCalendarEvents(filter?: {
    fromDate?: string;
    toDate?: string;
    relatedContactId?: string;
  }): Promise<CalendarEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM calendar_events WHERE 1=1';
    const params: any[] = [];

    if (filter?.fromDate) { sql += ' AND start_date >= ?'; params.push(filter.fromDate); }
    if (filter?.toDate) { sql += ' AND start_date <= ?'; params.push(filter.toDate); }
    if (filter?.relatedContactId) { sql += ' AND related_contact_id = ?'; params.push(filter.relatedContactId); }

    sql += ' ORDER BY start_date ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapCalendarEvent(row));
  }

  async updateCalendarEvent(id: string, input: UpdateCalendarEventInput): Promise<CalendarEvent> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
    if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
    if (input.startDate !== undefined) { updates.push('start_date = ?'); values.push(input.startDate); }
    if (input.endDate !== undefined) { updates.push('end_date = ?'); values.push(input.endDate); }
    if (input.allDay !== undefined) { updates.push('all_day = ?'); values.push(input.allDay ? 1 : 0); }
    if (input.color !== undefined) { updates.push('color = ?'); values.push(input.color); }
    if (input.remindAt !== undefined) { updates.push('remind_at = ?'); values.push(input.remindAt); }
    if (input.relatedContactId !== undefined) { updates.push('related_contact_id = ?'); values.push(input.relatedContactId); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getCalendarEvent(id))!;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
  }

  private mapCalendarEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      startDate: row.start_date,
      endDate: row.end_date || undefined,
      allDay: Boolean(row.all_day),
      color: row.color || undefined,
      remindAt: row.remind_at || undefined,
      relatedContactId: row.related_contact_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  async createTask(input: CreateTaskInput): Promise<Task> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    // Get next sort order
    const maxRow = this.db.prepare(
      'SELECT MAX(sort_order) as max_order FROM tasks WHERE status = ?'
    ).get(input.status || 'todo') as any;
    const nextOrder = (maxRow?.max_order || 0) + 1;

    this.db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, due_date,
        tags, sort_order, recurrence, parent_task_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.title,
      input.description || null,
      input.status || 'todo',
      input.priority || 'medium',
      input.dueDate || null,
      JSON.stringify(input.tags || []),
      nextOrder,
      input.recurrence ? JSON.stringify(input.recurrence) : null,
      (input as any).parentTaskId || null,
      now,
      now
    );

    return (await this.getTask(id))!;
  }

  async getTask(id: string): Promise<Task | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    return row ? this.mapTask(row) : null;
  }

  async listTasks(filter?: {
    status?: TaskStatus;
    priority?: string;
    search?: string;
  }): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) { sql += ' AND status = ?'; params.push(filter.status); }
    if (filter?.priority) { sql += ' AND priority = ?'; params.push(filter.priority); }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY sort_order ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapTask(row));
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
    if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
    if (input.status !== undefined) { updates.push('status = ?'); values.push(input.status); }
    if (input.priority !== undefined) { updates.push('priority = ?'); values.push(input.priority); }
    if (input.dueDate !== undefined) { updates.push('due_date = ?'); values.push(input.dueDate); }
    if (input.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(input.tags)); }
    if (input.order !== undefined) { updates.push('sort_order = ?'); values.push(input.order); }
    if (input.recurrence !== undefined) { updates.push('recurrence = ?'); values.push(input.recurrence ? JSON.stringify(input.recurrence) : null); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getTask(id))!;
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  async reorderTasks(taskOrders: { id: string; order: number; status: TaskStatus }[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('UPDATE tasks SET sort_order = ?, status = ? WHERE id = ?');
    const transaction = this.db.transaction(() => {
      for (const task of taskOrders) {
        stmt.run(task.order, task.status, task.id);
      }
    });
    transaction();
  }

  private mapTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date || undefined,
      tags: JSON.parse(row.tags || '[]'),
      order: row.sort_order,
      recurrence: row.recurrence ? JSON.parse(row.recurrence) : undefined,
      parentTaskId: row.parent_task_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createNextTaskOccurrence(task: Task): Promise<Task | null> {
    if (!task.recurrence || !task.dueDate) return null;

    const currentDue = new Date(task.dueDate);
    let nextDue: Date;

    switch (task.recurrence.rule) {
      case 'daily':
        nextDue = new Date(currentDue);
        nextDue.setDate(nextDue.getDate() + task.recurrence.interval);
        break;
      case 'weekly':
        nextDue = new Date(currentDue);
        nextDue.setDate(nextDue.getDate() + task.recurrence.interval * 7);
        break;
      case 'monthly':
        nextDue = new Date(currentDue);
        nextDue.setMonth(nextDue.getMonth() + task.recurrence.interval);
        break;
      default:
        return null;
    }

    // Check end date
    if (task.recurrence.endDate && nextDue > new Date(task.recurrence.endDate)) {
      return null;
    }

    return this.createTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      tags: task.tags,
      dueDate: nextDue.toISOString(),
      recurrence: task.recurrence,
      parentTaskId: task.parentTaskId || task.id,
    } as any);
  }

  // ============================================
  // NOTE GROUP OPERATIONS
  // ============================================

  async createNoteGroup(input: CreateNoteGroupInput): Promise<NoteGroup> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    // Get max sort order
    const maxOrder = (this.db.prepare('SELECT MAX(sort_order) as max FROM note_groups').get() as any)?.max || 0;

    this.db.prepare(`
      INSERT INTO note_groups (id, name, color, icon, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.color || '#3b82f6', input.icon || null, maxOrder + 1, now, now);

    const row = this.db.prepare('SELECT * FROM note_groups WHERE id = ?').get(id) as any;
    return this.mapNoteGroup(row);
  }

  async listNoteGroups(): Promise<NoteGroup[]> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = this.db.prepare('SELECT * FROM note_groups ORDER BY sort_order ASC').all() as any[];
    return rows.map((row) => this.mapNoteGroup(row));
  }

  async updateNoteGroup(id: string, input: UpdateNoteGroupInput): Promise<NoteGroup> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
    if (input.color !== undefined) { updates.push('color = ?'); values.push(input.color); }
    if (input.icon !== undefined) { updates.push('icon = ?'); values.push(input.icon); }
    if (input.sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(input.sortOrder); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE note_groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const row = this.db.prepare('SELECT * FROM note_groups WHERE id = ?').get(id) as any;
    return this.mapNoteGroup(row);
  }

  async deleteNoteGroup(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    // Set notes in this group to null group
    this.db.prepare('UPDATE notes SET group_id = NULL WHERE group_id = ?').run(id);
    this.db.prepare('DELETE FROM note_groups WHERE id = ?').run(id);
  }

  private mapNoteGroup(row: any): NoteGroup {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon || undefined,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // NOTE OPERATIONS
  // ============================================

  async createNote(input: CreateNoteInput): Promise<Note> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO notes (
        id, title, content, is_pinned, color, tags, group_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.title,
      input.content || '',
      input.isPinned ? 1 : 0,
      input.color || null,
      JSON.stringify(input.tags || []),
      input.groupId || null,
      now,
      now
    );

    return (await this.getNote(id))!;
  }

  async getNote(id: string): Promise<Note | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    return row ? this.mapNote(row) : null;
  }

  async listNotes(filter?: { search?: string; isPinned?: boolean; groupId?: string | null }): Promise<Note[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM notes WHERE 1=1';
    const params: any[] = [];

    if (filter?.search) {
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern);
    }
    if (filter?.isPinned !== undefined) {
      sql += ' AND is_pinned = ?';
      params.push(filter.isPinned ? 1 : 0);
    }
    if (filter?.groupId !== undefined) {
      if (filter.groupId === null) {
        sql += ' AND group_id IS NULL';
      } else {
        sql += ' AND group_id = ?';
        params.push(filter.groupId);
      }
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapNote(row));
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
    if (input.content !== undefined) { updates.push('content = ?'); values.push(input.content); }
    if (input.isPinned !== undefined) { updates.push('is_pinned = ?'); values.push(input.isPinned ? 1 : 0); }
    if (input.color !== undefined) { updates.push('color = ?'); values.push(input.color); }
    if (input.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(input.tags)); }
    if (input.groupId !== undefined) { updates.push('group_id = ?'); values.push(input.groupId); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getNote(id))!;
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  private mapNote(row: any): Note {
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      isPinned: Boolean(row.is_pinned),
      color: row.color || undefined,
      tags: JSON.parse(row.tags || '[]'),
      groupId: row.group_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // EXPENSE OPERATIONS
  // ============================================

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO expenses (
        id, amount, currency, category, description, date,
        tags, receipt_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.amount,
      input.currency || 'USD',
      input.category,
      input.description,
      input.date,
      JSON.stringify(input.tags || []),
      input.receiptPath || null,
      now
    );

    return (await this.getExpense(id))!;
  }

  async getExpense(id: string): Promise<Expense | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any;
    return row ? this.mapExpense(row) : null;
  }

  async listExpenses(filter?: {
    category?: ExpenseCategory;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }): Promise<Expense[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params: any[] = [];

    if (filter?.category) { sql += ' AND category = ?'; params.push(filter.category); }
    if (filter?.fromDate) { sql += ' AND date >= ?'; params.push(filter.fromDate); }
    if (filter?.toDate) { sql += ' AND date <= ?'; params.push(filter.toDate); }
    if (filter?.search) { sql += ' AND description LIKE ?'; params.push(`%${filter.search}%`); }

    sql += ' ORDER BY date DESC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapExpense(row));
  }

  async updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.amount !== undefined) { updates.push('amount = ?'); values.push(input.amount); }
    if (input.currency !== undefined) { updates.push('currency = ?'); values.push(input.currency); }
    if (input.category !== undefined) { updates.push('category = ?'); values.push(input.category); }
    if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
    if (input.date !== undefined) { updates.push('date = ?'); values.push(input.date); }
    if (input.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(input.tags)); }
    if (input.receiptPath !== undefined) { updates.push('receipt_path = ?'); values.push(input.receiptPath); }

    if (updates.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getExpense(id))!;
  }

  async deleteExpense(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  }

  async getExpenseSummary(filter?: { fromDate?: string; toDate?: string }): Promise<ExpenseSummary> {
    if (!this.db) throw new Error('Database not initialized');

    let whereClause = '1=1';
    const params: any[] = [];

    if (filter?.fromDate) { whereClause += ' AND date >= ?'; params.push(filter.fromDate); }
    if (filter?.toDate) { whereClause += ' AND date <= ?'; params.push(filter.toDate); }

    // Total
    const totalRow = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${whereClause}`
    ).get(...params) as any;

    // By category
    const categoryRows = this.db.prepare(
      `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${whereClause} GROUP BY category`
    ).all(...params) as any[];

    // By month
    const monthRows = this.db.prepare(
      `SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${whereClause} GROUP BY month ORDER BY month DESC`
    ).all(...params) as any[];

    const byCategory: Record<ExpenseCategory, number> = {
      food: 0, transport: 0, utilities: 0, entertainment: 0,
      shopping: 0, health: 0, education: 0, travel: 0, other: 0,
    };

    for (const row of categoryRows) {
      byCategory[row.category as ExpenseCategory] = row.total;
    }

    const byMonth: Record<string, number> = {};
    for (const row of monthRows) {
      byMonth[row.month] = row.total;
    }

    return {
      total: totalRow.total,
      byCategory,
      byMonth,
    };
  }

  private mapExpense(row: any): Expense {
    return {
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      category: row.category,
      description: row.description,
      date: row.date,
      tags: JSON.parse(row.tags || '[]'),
      receiptPath: row.receipt_path || undefined,
      createdAt: row.created_at,
    };
  }

  // ============================================
  // DOCX TEMPLATE OPERATIONS
  // ============================================

  async createDocxTemplate(input: CreateDocxTemplateInput): Promise<UploadedDocxTemplate> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO docx_templates (
        id, name, original_file_name, file_path, variables, variable_details,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.originalFileName,
      input.filePath,
      JSON.stringify(input.variables),
      JSON.stringify(input.variableDetails || []),
      now,
      now
    );

    return (await this.getDocxTemplate(id))!;
  }

  async getDocxTemplate(id: string): Promise<UploadedDocxTemplate | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM docx_templates WHERE id = ?').get(id) as any;
    return row ? this.mapDocxTemplate(row) : null;
  }

  async listDocxTemplates(): Promise<UploadedDocxTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare(
      'SELECT * FROM docx_templates ORDER BY updated_at DESC'
    ).all() as any[];

    return rows.map((row) => this.mapDocxTemplate(row));
  }

  async deleteDocxTemplate(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM docx_templates WHERE id = ?').run(id);
  }

  private mapDocxTemplate(row: any): UploadedDocxTemplate {
    return {
      id: row.id,
      name: row.name,
      originalFileName: row.original_file_name,
      filePath: row.file_path,
      variables: JSON.parse(row.variables || '[]'),
      variableDetails: JSON.parse(row.variable_details || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // RICH DOCUMENT OPERATIONS
  // ============================================

  async createRichDocument(input: CreateRichDocumentInput): Promise<RichDocument> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO rich_documents (
        id, title, content, page_color, is_template, placeholders,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.title,
      input.content || '',
      input.pageColor || '#ffffff',
      input.isTemplate ? 1 : 0,
      JSON.stringify(input.placeholders || []),
      now,
      now
    );

    return (await this.getRichDocument(id))!;
  }

  async getRichDocument(id: string): Promise<RichDocument | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM rich_documents WHERE id = ?').get(id) as any;
    return row ? this.mapRichDocument(row) : null;
  }

  async listRichDocuments(filter?: { isTemplate?: boolean }): Promise<RichDocument[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM rich_documents WHERE 1=1';
    const params: any[] = [];

    if (filter?.isTemplate !== undefined) {
      sql += ' AND is_template = ?';
      params.push(filter.isTemplate ? 1 : 0);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.mapRichDocument(row));
  }

  async updateRichDocument(id: string, input: UpdateRichDocumentInput): Promise<RichDocument> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) { updates.push('title = ?'); values.push(input.title); }
    if (input.content !== undefined) { updates.push('content = ?'); values.push(input.content); }
    if (input.pageColor !== undefined) { updates.push('page_color = ?'); values.push(input.pageColor); }
    if (input.isTemplate !== undefined) { updates.push('is_template = ?'); values.push(input.isTemplate ? 1 : 0); }
    if (input.placeholders !== undefined) { updates.push('placeholders = ?'); values.push(JSON.stringify(input.placeholders)); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE rich_documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getRichDocument(id))!;
  }

  async deleteRichDocument(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM rich_documents WHERE id = ?').run(id);
  }

  private mapRichDocument(row: any): RichDocument {
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      pageColor: row.page_color || '#ffffff',
      isTemplate: Boolean(row.is_template),
      placeholders: JSON.parse(row.placeholders || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // AUTOMATION RULES OPERATIONS
  // ============================================

  private mapRule(row: any): AutomationRule {
    return {
      id: row.id,
      name: row.name,
      trigger: row.trigger,
      triggerConditions: row.trigger_conditions ? JSON.parse(row.trigger_conditions) : undefined,
      actions: JSON.parse(row.actions),
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createRule(input: CreateRuleInput): Promise<AutomationRule> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO automation_rules (
        id, name, trigger, trigger_conditions, actions, enabled,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.trigger,
      input.triggerConditions ? JSON.stringify(input.triggerConditions) : null,
      JSON.stringify(input.actions),
      input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1,
      now,
      now
    );

    return (await this.getRule(id))!;
  }

  async getRule(id: string): Promise<AutomationRule | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id) as any;
    return row ? this.mapRule(row) : null;
  }

  async listRules(): Promise<AutomationRule[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare('SELECT * FROM automation_rules ORDER BY created_at DESC').all() as any[];
    return rows.map((row) => this.mapRule(row));
  }

  async updateRule(id: string, input: UpdateRuleInput): Promise<AutomationRule> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
    if (input.trigger !== undefined) { updates.push('trigger = ?'); values.push(input.trigger); }
    if (input.triggerConditions !== undefined) { updates.push('trigger_conditions = ?'); values.push(JSON.stringify(input.triggerConditions)); }
    if (input.actions !== undefined) { updates.push('actions = ?'); values.push(JSON.stringify(input.actions)); }
    if (input.enabled !== undefined) { updates.push('enabled = ?'); values.push(input.enabled ? 1 : 0); }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      this.db.prepare(`UPDATE automation_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return (await this.getRule(id))!;
  }

  async deleteRule(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM automation_rules WHERE id = ?').run(id);
  }

  // ============================================
  // FILE STORAGE UTILITIES
  // ============================================

  /**
   * Save a file to local storage (like WhatsApp media)
   * Returns the path where the file was saved
   */
  async saveFile(buffer: Buffer, filename: string, subfolder?: string): Promise<string> {
    const targetDir = subfolder
      ? path.join(this.filesPath, subfolder)
      : this.filesPath;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const uniqueName = `${basename}_${Date.now()}${ext}`;
    const filePath = path.join(targetDir, uniqueName);

    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  /**
   * Delete a file from local storage
   */
  async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Get all files in a subfolder
   */
  async listFiles(subfolder?: string): Promise<string[]> {
    const targetDir = subfolder
      ? path.join(this.filesPath, subfolder)
      : this.filesPath;

    if (!fs.existsSync(targetDir)) {
      return [];
    }

    return fs.readdirSync(targetDir).map((f) => path.join(targetDir, f));
  }

  // ============================================
  // DATABASE UTILITIES
  // ============================================

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async backup(backupPath: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Use SQLite's backup API
    await this.db.backup(backupPath);
    logger.info(`Database backed up to: ${backupPath}`);
  }

  async getDatabaseSize(): Promise<number> {
    if (!fs.existsSync(this.dataPath)) return 0;
    const stats = fs.statSync(this.dataPath);
    return stats.size;
  }
}
