import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
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
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseCategory,
  ExpenseSummary,
  AutomationRule,
  CreateRuleInput,
  UpdateRuleInput,
} from '../../shared/types';
import { DEFAULT_SETTINGS, DEFAULT_PREFERENCES } from '../../shared/types';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'envoy',
};

export class DatabaseService {
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    // First, connect without database to create it if needed
    const tempPool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      waitForConnections: true,
      connectionLimit: 10,
    });

    // Create database if not exists
    await tempPool.execute(
      `CREATE DATABASE IF NOT EXISTS \`${this.config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await tempPool.end();

    // Now connect to the database
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });

    // Run migrations
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    // Create migrations table
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = [
      {
        name: '001_initial_schema',
        statements: [
          // Templates table
          `CREATE TABLE IF NOT EXISTS templates (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(50) NOT NULL,
            channel VARCHAR(20) NOT NULL DEFAULT 'email',
            subject TEXT,
            body TEXT NOT NULL,
            tone VARCHAR(20) NOT NULL DEFAULT 'professional',
            attachment_template VARCHAR(255),
            attachment_format VARCHAR(10),
            follow_up_days INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_category (category),
            INDEX idx_channel (channel)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Contacts table
          `CREATE TABLE IF NOT EXISTS contacts (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            company VARCHAR(255),
            title VARCHAR(255),
            timezone VARCHAR(50),
            preferred_channel VARCHAR(20) DEFAULT 'email',
            custom_fields JSON,
            tags JSON,
            last_contacted TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_name (name)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Email accounts table
          `CREATE TABLE IF NOT EXISTS email_accounts (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(20) NOT NULL,
            from_name VARCHAR(255) NOT NULL,
            from_email VARCHAR(255) NOT NULL,
            config JSON NOT NULL,
            is_default TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Audit logs table
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id VARCHAR(36) PRIMARY KEY,
            channel VARCHAR(20) NOT NULL,
            template_id VARCHAR(36),
            template_name VARCHAR(255) NOT NULL,
            recipient_id VARCHAR(36),
            recipient_name VARCHAR(255) NOT NULL,
            recipient_address VARCHAR(255) NOT NULL,
            subject TEXT,
            body_preview TEXT NOT NULL,
            attachments JSON,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            delivered_at TIMESTAMP NULL,
            error_message TEXT,
            INDEX idx_channel (channel),
            INDEX idx_status (status),
            INDEX idx_sent_at (sent_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Scheduled messages table
          `CREATE TABLE IF NOT EXISTS scheduled_messages (
            id VARCHAR(36) PRIMARY KEY,
            template_id VARCHAR(36) NOT NULL,
            recipient_ids JSON NOT NULL,
            channel VARCHAR(20) NOT NULL,
            scheduled_for TIMESTAMP NOT NULL,
            timezone VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            attachment_paths JSON,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_scheduled_for (scheduled_for)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Settings table
          `CREATE TABLE IF NOT EXISTS settings (
            \`key\` VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        ],
      },
      {
        name: '002_activity_logs',
        statements: [
          // User activity logs table
          `CREATE TABLE IF NOT EXISTS activity_logs (
            id VARCHAR(36) PRIMARY KEY,
            action VARCHAR(50) NOT NULL,
            category VARCHAR(30) NOT NULL,
            description TEXT NOT NULL,
            details JSON,
            entity_id VARCHAR(36),
            entity_name VARCHAR(255),
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_action (action),
            INDEX idx_category (category),
            INDEX idx_created_at (created_at),
            INDEX idx_entity_id (entity_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        ],
      },
      {
        name: '003_reminders_and_schedule_updates',
        statements: [
          // Reminders table
          `CREATE TABLE IF NOT EXISTS reminders (
            id VARCHAR(36) PRIMARY KEY,
            type VARCHAR(20) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            related_entity_id VARCHAR(36),
            related_entity_type VARCHAR(30),
            due_at TIMESTAMP NOT NULL,
            timezone VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            snoozed_until TIMESTAMP NULL,
            notified_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_due_at (due_at),
            INDEX idx_related_entity (related_entity_id, related_entity_type)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        ],
      },
      {
        name: '004_contact_groups_and_snippets',
        statements: [
          // Contact Groups table
          `CREATE TABLE IF NOT EXISTS contact_groups (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
            icon VARCHAR(50),
            contact_ids JSON,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sort_order (sort_order)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Snippets table
          `CREATE TABLE IF NOT EXISTS snippets (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            shortcut VARCHAR(50) NOT NULL UNIQUE,
            content TEXT NOT NULL,
            category VARCHAR(30) NOT NULL DEFAULT 'custom',
            usage_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_shortcut (shortcut),
            INDEX idx_category (category)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        ],
      },
      {
        name: '005_productivity_suite',
        statements: [
          // Calendar Events table
          `CREATE TABLE IF NOT EXISTS calendar_events (
            id VARCHAR(36) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP NULL,
            all_day TINYINT(1) DEFAULT 0,
            color VARCHAR(20),
            remind_at TIMESTAMP NULL,
            related_contact_id VARCHAR(36),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_start_date (start_date),
            INDEX idx_end_date (end_date)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Tasks table
          `CREATE TABLE IF NOT EXISTS tasks (
            id VARCHAR(36) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'todo',
            priority VARCHAR(20) NOT NULL DEFAULT 'medium',
            due_date TIMESTAMP NULL,
            tags JSON,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_priority (priority),
            INDEX idx_due_date (due_date),
            INDEX idx_sort_order (sort_order)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Notes table
          `CREATE TABLE IF NOT EXISTS notes (
            id VARCHAR(36) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            is_pinned TINYINT(1) DEFAULT 0,
            color VARCHAR(20),
            tags JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_is_pinned (is_pinned)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

          // Expenses table
          `CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(36) PRIMARY KEY,
            amount DECIMAL(15, 2) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'USD',
            category VARCHAR(30) NOT NULL,
            description VARCHAR(255),
            date DATE NOT NULL,
            tags JSON,
            receipt_path VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_category (category),
            INDEX idx_date (date)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        ],
      },
      {
        name: '006_automation_rules',
        statements: [
          `CREATE TABLE IF NOT EXISTS automation_rules (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            \`trigger\` VARCHAR(50) NOT NULL,
            trigger_conditions TEXT,
            actions TEXT NOT NULL,
            enabled TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        ],
      },
    ];

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT name FROM migrations'
    );
    const appliedMigrations = rows.map((row) => row.name);

    for (const migration of migrations) {
      if (!appliedMigrations.includes(migration.name)) {
        console.log(`Applying migration: ${migration.name}`);
        for (const statement of migration.statements) {
          await this.pool.execute(statement);
        }
        await this.pool.execute('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
      }
    }

    // Safe column additions for existing databases (catches duplicate column errors)
    await this.safeAddColumn('scheduled_messages', 'error_message', 'TEXT');
  }

  private async safeAddColumn(table: string, column: string, type: string): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (error: unknown) {
      // Ignore "duplicate column" error (1060)
      if ((error as { errno?: number }).errno !== 1060) {
        throw error;
      }
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  // ============================================
  // TEMPLATE OPERATIONS
  // ============================================

  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO templates (
        id, name, category, channel, subject, body, tone,
        attachment_template, attachment_format, follow_up_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.category,
        input.channel,
        input.subject || null,
        input.body,
        input.tone,
        input.attachmentTemplate || null,
        input.attachmentFormat || null,
        input.followUpDays || null,
      ]
    );

    return (await this.getTemplate(id))!;
  }

  async updateTemplate(id: string, input: Partial<CreateTemplateInput>): Promise<Template> {
    if (!this.pool) throw new Error('Database not initialized');

    const existing = await this.getTemplate(id);
    if (!existing) throw new Error('Template not found');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.category !== undefined) {
      updates.push('category = ?');
      values.push(input.category);
    }
    if (input.channel !== undefined) {
      updates.push('channel = ?');
      values.push(input.channel);
    }
    if (input.subject !== undefined) {
      updates.push('subject = ?');
      values.push(input.subject);
    }
    if (input.body !== undefined) {
      updates.push('body = ?');
      values.push(input.body);
    }
    if (input.tone !== undefined) {
      updates.push('tone = ?');
      values.push(input.tone);
    }
    if (input.attachmentTemplate !== undefined) {
      updates.push('attachment_template = ?');
      values.push(input.attachmentTemplate);
    }
    if (input.attachmentFormat !== undefined) {
      updates.push('attachment_format = ?');
      values.push(input.attachmentFormat);
    }
    if (input.followUpDays !== undefined) {
      updates.push('follow_up_days = ?');
      values.push(input.followUpDays);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE templates SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getTemplate(id))!;
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM templates WHERE id = ?', [id]);
  }

  async getTemplate(id: string): Promise<Template | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM templates WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapTemplate(rows[0]) : null;
  }

  async listTemplates(filter?: { category?: string; channel?: string }): Promise<Template[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM templates WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.channel) {
      sql += ' AND (channel = ? OR channel = ?)';
      params.push(filter.channel, 'both');
    }

    sql += ' ORDER BY updated_at DESC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapTemplate(row));
  }

  private mapTemplate(row: mysql.RowDataPacket): Template {
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
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // CONTACT OPERATIONS
  // ============================================

  async createContact(input: CreateContactInput): Promise<Contact> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO contacts (
        id, name, email, phone, company, title, timezone,
        preferred_channel, custom_fields, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );

    return (await this.getContact(id))!;
  }

  async updateContact(id: string, input: Partial<CreateContactInput>): Promise<Contact> {
    if (!this.pool) throw new Error('Database not initialized');

    const existing = await this.getContact(id);
    if (!existing) throw new Error('Contact not found');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.email !== undefined) {
      updates.push('email = ?');
      values.push(input.email);
    }
    if (input.phone !== undefined) {
      updates.push('phone = ?');
      values.push(input.phone);
    }
    if (input.company !== undefined) {
      updates.push('company = ?');
      values.push(input.company);
    }
    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(input.timezone);
    }
    if (input.preferredChannel !== undefined) {
      updates.push('preferred_channel = ?');
      values.push(input.preferredChannel);
    }
    if (input.customFields !== undefined) {
      updates.push('custom_fields = ?');
      values.push(JSON.stringify(input.customFields));
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(input.tags));
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getContact(id))!;
  }

  async deleteContact(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM contacts WHERE id = ?', [id]);
  }

  async getContact(id: string): Promise<Contact | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM contacts WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapContact(rows[0]) : null;
  }

  async listContacts(filter?: { search?: string; tags?: string[] }): Promise<Contact[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (filter?.tags && filter.tags.length > 0) {
      // MySQL JSON contains check
      const tagConditions = filter.tags.map(() => 'JSON_CONTAINS(tags, ?)').join(' OR ');
      sql += ` AND (${tagConditions})`;
      filter.tags.forEach((tag) => params.push(JSON.stringify(tag)));
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapContact(row));
  }

  private mapContact(row: mysql.RowDataPacket): Contact {
    return {
      id: row.id,
      name: row.name,
      email: row.email || undefined,
      phone: row.phone || undefined,
      company: row.company || undefined,
      title: row.title || undefined,
      timezone: row.timezone || undefined,
      preferredChannel: row.preferred_channel || 'email',
      customFields: typeof row.custom_fields === 'string'
        ? JSON.parse(row.custom_fields)
        : row.custom_fields || {},
      tags: typeof row.tags === 'string'
        ? JSON.parse(row.tags)
        : row.tags || [],
      lastContacted: row.last_contacted?.toISOString() || undefined,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  async createAuditLog(log: Omit<AuditLog, 'id' | 'sentAt'>): Promise<AuditLog> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO audit_logs (
        id, channel, template_id, template_name, recipient_id,
        recipient_name, recipient_address, subject, body_preview,
        attachments, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        log.channel,
        log.templateId,
        log.templateName,
        log.recipientId,
        log.recipientName,
        log.recipientAddress,
        log.subject || null,
        log.bodyPreview,
        JSON.stringify(log.attachments),
        log.status,
        log.errorMessage || null,
      ]
    );

    return (await this.getAuditLog(id))!;
  }

  async getAuditLog(id: string): Promise<AuditLog | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM audit_logs WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapAuditLog(rows[0]) : null;
  }

  async listAuditLogs(filter?: {
    channel?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }): Promise<AuditLog[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.channel) {
      sql += ' AND channel = ?';
      params.push(filter.channel);
    }
    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.fromDate) {
      sql += ' AND sent_at >= ?';
      params.push(filter.fromDate);
    }
    if (filter?.toDate) {
      sql += ' AND sent_at <= ?';
      params.push(filter.toDate);
    }
    if (filter?.search) {
      sql += ' AND (recipient_name LIKE ? OR recipient_address LIKE ? OR subject LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY sent_at DESC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapAuditLog(row));
  }

  async updateAuditLogStatus(id: string, status: AuditLog['status'], errorMessage?: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    if (status === 'delivered') {
      await this.pool.execute(
        'UPDATE audit_logs SET status = ?, delivered_at = NOW() WHERE id = ?',
        [status, id]
      );
    } else if (status === 'failed') {
      await this.pool.execute(
        'UPDATE audit_logs SET status = ?, error_message = ? WHERE id = ?',
        [status, errorMessage || null, id]
      );
    } else {
      await this.pool.execute('UPDATE audit_logs SET status = ? WHERE id = ?', [status, id]);
    }
  }

  private mapAuditLog(row: mysql.RowDataPacket): AuditLog {
    return {
      id: row.id,
      channel: row.channel,
      templateId: row.template_id,
      templateName: row.template_name,
      recipientId: row.recipient_id,
      recipientName: row.recipient_name,
      recipientAddress: row.recipient_address,
      subject: row.subject || undefined,
      bodyPreview: row.body_preview,
      attachments: typeof row.attachments === 'string'
        ? JSON.parse(row.attachments)
        : row.attachments || [],
      status: row.status,
      sentAt: row.sent_at?.toISOString() || new Date().toISOString(),
      deliveredAt: row.delivered_at?.toISOString() || undefined,
      errorMessage: row.error_message || undefined,
    };
  }

  // ============================================
  // EMAIL ACCOUNT OPERATIONS
  // ============================================

  async saveEmailAccount(account: EmailAccount): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    await this.pool.execute(
      `INSERT INTO email_accounts (id, name, type, from_name, from_email, config, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         type = VALUES(type),
         from_name = VALUES(from_name),
         from_email = VALUES(from_email),
         config = VALUES(config),
         is_default = VALUES(is_default)`,
      [
        account.id,
        account.name,
        account.type,
        account.fromName,
        account.fromEmail,
        JSON.stringify(account.config),
        account.isDefault ? 1 : 0,
        account.createdAt,
      ]
    );
  }

  async getEmailAccounts(): Promise<EmailAccount[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM email_accounts ORDER BY is_default DESC, created_at DESC'
    );

    return rows.map((row) => this.mapEmailAccount(row));
  }

  // Alias for interface compatibility
  async listEmailAccounts(): Promise<EmailAccount[]> {
    return this.getEmailAccounts();
  }

  async getEmailAccount(id: string): Promise<EmailAccount | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM email_accounts WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapEmailAccount(rows[0]) : null;
  }

  async deleteEmailAccount(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM email_accounts WHERE id = ?', [id]);
  }

  private mapEmailAccount(row: mysql.RowDataPacket): EmailAccount {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      fromName: row.from_name,
      fromEmail: row.from_email,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // SETTINGS OPERATIONS
  // ============================================

  async getSettings(): Promise<AppSettings> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT `key`, value FROM settings'
    );

    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    // Deep merge preferences to preserve all default values
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    if (settings.preferences && typeof settings.preferences === 'object') {
      mergedSettings.preferences = {
        ...DEFAULT_PREFERENCES,
        ...(settings.preferences as Record<string, unknown>),
      };
    }

    return mergedSettings as AppSettings;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

    await this.pool.execute(
      'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [key, valueStr, valueStr]
    );
  }

  async setSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    try {
      for (const [key, value] of Object.entries(settings)) {
        console.log(`[Database] Saving setting: ${key} =`, JSON.stringify(value).substring(0, 100));
        await this.setSetting(key, value);
      }
      const result = await this.getSettings();
      console.log('[Database] Settings saved successfully. Preferences:', result.preferences);
      return result;
    } catch (error) {
      console.error('[Database] Error saving settings:', error);
      throw error;
    }
  }

  // ============================================
  // USER ACTIVITY LOG OPERATIONS
  // ============================================

  async createActivityLog(input: CreateActivityLogInput): Promise<UserActivityLog> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO activity_logs (
        id, action, category, description, details, entity_id, entity_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.action,
        input.category,
        input.description,
        input.details ? JSON.stringify(input.details) : null,
        input.entityId || null,
        input.entityName || null,
      ]
    );

    return (await this.getActivityLog(id))!;
  }

  async getActivityLog(id: string): Promise<UserActivityLog | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM activity_logs WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapActivityLog(rows[0]) : null;
  }

  async listActivityLogs(filter?: {
    action?: string;
    category?: string;
    entityId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: UserActivityLog[]; total: number }> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM activity_logs WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM activity_logs WHERE 1=1';
    const params: unknown[] = [];
    const countParams: unknown[] = [];

    if (filter?.action) {
      sql += ' AND action = ?';
      countSql += ' AND action = ?';
      params.push(filter.action);
      countParams.push(filter.action);
    }
    if (filter?.category) {
      sql += ' AND category = ?';
      countSql += ' AND category = ?';
      params.push(filter.category);
      countParams.push(filter.category);
    }
    if (filter?.entityId) {
      sql += ' AND entity_id = ?';
      countSql += ' AND entity_id = ?';
      params.push(filter.entityId);
      countParams.push(filter.entityId);
    }
    if (filter?.fromDate) {
      sql += ' AND created_at >= ?';
      countSql += ' AND created_at >= ?';
      params.push(filter.fromDate);
      countParams.push(filter.fromDate);
    }
    if (filter?.toDate) {
      sql += ' AND created_at <= ?';
      countSql += ' AND created_at <= ?';
      params.push(filter.toDate);
      countParams.push(filter.toDate);
    }
    if (filter?.search) {
      sql += ' AND (description LIKE ? OR entity_name LIKE ?)';
      countSql += ' AND (description LIKE ? OR entity_name LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY created_at DESC';

    // LIMIT/OFFSET must be integers and are safe to interpolate directly
    if (filter?.limit) {
      const limit = Math.max(1, Math.floor(Number(filter.limit) || 100));
      const offset = Math.max(0, Math.floor(Number(filter.offset) || 0));
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    const [countRows] = await this.pool.execute<mysql.RowDataPacket[]>(countSql, countParams);

    return {
      logs: rows.map((row) => this.mapActivityLog(row)),
      total: countRows[0]?.total || 0,
    };
  }

  async clearActivityLogs(beforeDate?: string): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'DELETE FROM activity_logs';
    const params: unknown[] = [];

    if (beforeDate) {
      sql += ' WHERE created_at < ?';
      params.push(beforeDate);
    }

    const [result] = await this.pool.execute<mysql.ResultSetHeader>(sql, params);
    return result.affectedRows;
  }

  async getActivityStats(): Promise<{
    totalLogs: number;
    todayLogs: number;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
  }> {
    if (!this.pool) throw new Error('Database not initialized');

    // Total logs
    const [totalRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM activity_logs'
    );

    // Today's logs
    const [todayRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM activity_logs WHERE DATE(created_at) = CURDATE()'
    );

    // By category
    const [categoryRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT category, COUNT(*) as count FROM activity_logs GROUP BY category'
    );

    // By action
    const [actionRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT action, COUNT(*) as count FROM activity_logs GROUP BY action ORDER BY count DESC LIMIT 10'
    );

    const byCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      byCategory[row.category] = row.count;
    }

    const byAction: Record<string, number> = {};
    for (const row of actionRows) {
      byAction[row.action] = row.count;
    }

    return {
      totalLogs: totalRows[0]?.total || 0,
      todayLogs: todayRows[0]?.total || 0,
      byCategory,
      byAction,
    };
  }

  private mapActivityLog(row: mysql.RowDataPacket): UserActivityLog {
    return {
      id: row.id,
      action: row.action,
      category: row.category,
      description: row.description,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details || undefined,
      entityId: row.entity_id || undefined,
      entityName: row.entity_name || undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // SCHEDULED MESSAGE OPERATIONS
  // ============================================

  async createScheduledMessage(input: CreateScheduledMessageInput): Promise<ScheduledMessage> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO scheduled_messages (
        id, template_id, recipient_ids, channel, scheduled_for, timezone, status, attachment_paths
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        input.templateId,
        JSON.stringify(input.recipientIds),
        input.channel,
        input.scheduledFor,
        input.timezone,
        JSON.stringify(input.attachmentPaths || []),
      ]
    );

    return (await this.getScheduledMessage(id))!;
  }

  async getScheduledMessage(id: string): Promise<ScheduledMessage | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM scheduled_messages WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapScheduledMessage(rows[0]) : null;
  }

  async listScheduledMessages(filter?: {
    status?: ScheduleStatus;
    fromDate?: string;
    toDate?: string;
  }): Promise<ScheduledMessage[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM scheduled_messages WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.fromDate) {
      sql += ' AND scheduled_for >= ?';
      params.push(filter.fromDate);
    }
    if (filter?.toDate) {
      sql += ' AND scheduled_for <= ?';
      params.push(filter.toDate);
    }

    sql += ' ORDER BY scheduled_for ASC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapScheduledMessage(row));
  }

  async updateScheduledMessage(id: string, input: UpdateScheduledMessageInput): Promise<ScheduledMessage> {
    if (!this.pool) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.scheduledFor !== undefined) {
      updates.push('scheduled_for = ?');
      values.push(input.scheduledFor);
    }
    if (input.timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(input.timezone);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.errorMessage !== undefined) {
      updates.push('error_message = ?');
      values.push(input.errorMessage);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE scheduled_messages SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getScheduledMessage(id))!;
  }

  async deleteScheduledMessage(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM scheduled_messages WHERE id = ?', [id]);
  }

  async getPendingScheduledMessages(): Promise<ScheduledMessage[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM scheduled_messages
       WHERE status = 'pending' AND scheduled_for <= NOW()
       ORDER BY scheduled_for ASC`
    );

    return rows.map((row) => this.mapScheduledMessage(row));
  }

  private mapScheduledMessage(row: mysql.RowDataPacket): ScheduledMessage {
    return {
      id: row.id,
      templateId: row.template_id,
      recipientIds: typeof row.recipient_ids === 'string'
        ? JSON.parse(row.recipient_ids)
        : row.recipient_ids || [],
      channel: row.channel,
      scheduledFor: row.scheduled_for?.toISOString() || new Date().toISOString(),
      timezone: row.timezone,
      status: row.status,
      attachmentPaths: typeof row.attachment_paths === 'string'
        ? JSON.parse(row.attachment_paths)
        : row.attachment_paths || undefined,
      errorMessage: row.error_message || undefined,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // REMINDER OPERATIONS
  // ============================================

  async createReminder(input: CreateReminderInput): Promise<Reminder> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO reminders (
        id, type, title, description, related_entity_id, related_entity_type,
        due_at, timezone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        input.type,
        input.title,
        input.description || null,
        input.relatedEntityId || null,
        input.relatedEntityType || null,
        input.dueAt,
        input.timezone,
      ]
    );

    return (await this.getReminder(id))!;
  }

  async getReminder(id: string): Promise<Reminder | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM reminders WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapReminder(rows[0]) : null;
  }

  async listReminders(filter?: {
    status?: ReminderStatus;
    type?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<Reminder[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM reminders WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter?.fromDate) {
      sql += ' AND due_at >= ?';
      params.push(filter.fromDate);
    }
    if (filter?.toDate) {
      sql += ' AND due_at <= ?';
      params.push(filter.toDate);
    }

    sql += ' ORDER BY due_at ASC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapReminder(row));
  }

  async updateReminder(id: string, input: UpdateReminderInput): Promise<Reminder> {
    if (!this.pool) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.dueAt !== undefined) {
      updates.push('due_at = ?');
      values.push(input.dueAt);
    }
    if (input.timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(input.timezone);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.snoozedUntil !== undefined) {
      updates.push('snoozed_until = ?');
      values.push(input.snoozedUntil);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getReminder(id))!;
  }

  async deleteReminder(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM reminders WHERE id = ?', [id]);
  }

  async getDueReminders(): Promise<Reminder[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM reminders
       WHERE (status = 'pending' AND due_at <= NOW())
          OR (status = 'snoozed' AND snoozed_until <= NOW())
       ORDER BY due_at ASC`
    );

    return rows.map((row) => this.mapReminder(row));
  }

  async markReminderNotified(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    await this.pool.execute(
      'UPDATE reminders SET notified_at = NOW() WHERE id = ?',
      [id]
    );
  }

  private mapReminder(row: mysql.RowDataPacket): Reminder {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description || undefined,
      relatedEntityId: row.related_entity_id || undefined,
      relatedEntityType: row.related_entity_type || undefined,
      dueAt: row.due_at?.toISOString() || new Date().toISOString(),
      timezone: row.timezone,
      status: row.status,
      snoozedUntil: row.snoozed_until?.toISOString() || undefined,
      notifiedAt: row.notified_at?.toISOString() || undefined,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // CONTACT GROUP OPERATIONS
  // ============================================

  async createContactGroup(input: CreateContactGroupInput): Promise<ContactGroup> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    // Get next sort order
    const [maxRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT MAX(sort_order) as max_order FROM contact_groups'
    );
    const nextOrder = (maxRows[0]?.max_order || 0) + 1;

    await this.pool.execute(
      `INSERT INTO contact_groups (
        id, name, description, color, icon, contact_ids, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.description || null,
        input.color || '#3B82F6',
        input.icon || null,
        JSON.stringify(input.contactIds || []),
        nextOrder,
      ]
    );

    return (await this.getContactGroup(id))!;
  }

  async getContactGroup(id: string): Promise<ContactGroup | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM contact_groups WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapContactGroup(rows[0]) : null;
  }

  async listContactGroups(): Promise<ContactGroup[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM contact_groups ORDER BY sort_order ASC'
    );

    return rows.map((row) => this.mapContactGroup(row));
  }

  async updateContactGroup(id: string, input: Partial<CreateContactGroupInput>): Promise<ContactGroup> {
    if (!this.pool) throw new Error('Database not initialized');

    const existing = await this.getContactGroup(id);
    if (!existing) throw new Error('Contact group not found');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      values.push(input.color);
    }
    if (input.icon !== undefined) {
      updates.push('icon = ?');
      values.push(input.icon);
    }
    if (input.contactIds !== undefined) {
      updates.push('contact_ids = ?');
      values.push(JSON.stringify(input.contactIds));
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE contact_groups SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getContactGroup(id))!;
  }

  async deleteContactGroup(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM contact_groups WHERE id = ?', [id]);
  }

  async reorderContactGroups(orderedIds: string[]): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    for (let i = 0; i < orderedIds.length; i++) {
      await this.pool.execute(
        'UPDATE contact_groups SET sort_order = ? WHERE id = ?',
        [i, orderedIds[i]]
      );
    }
  }

  async addContactToGroup(groupId: string, contactId: string): Promise<ContactGroup> {
    const group = await this.getContactGroup(groupId);
    if (!group) throw new Error('Contact group not found');

    if (!group.contactIds.includes(contactId)) {
      const newContactIds = [...group.contactIds, contactId];
      return this.updateContactGroup(groupId, { contactIds: newContactIds });
    }

    return group;
  }

  async removeContactFromGroup(groupId: string, contactId: string): Promise<ContactGroup> {
    const group = await this.getContactGroup(groupId);
    if (!group) throw new Error('Contact group not found');

    const newContactIds = group.contactIds.filter((id) => id !== contactId);
    return this.updateContactGroup(groupId, { contactIds: newContactIds });
  }

  private mapContactGroup(row: mysql.RowDataPacket): ContactGroup {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      color: row.color,
      icon: row.icon || undefined,
      contactIds: typeof row.contact_ids === 'string'
        ? JSON.parse(row.contact_ids)
        : row.contact_ids || [],
      sortOrder: row.sort_order,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // SNIPPET OPERATIONS
  // ============================================

  async createSnippet(input: CreateSnippetInput): Promise<Snippet> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO snippets (
        id, name, shortcut, content, category
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.shortcut,
        input.content,
        input.category || 'custom',
      ]
    );

    return (await this.getSnippet(id))!;
  }

  async getSnippet(id: string): Promise<Snippet | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM snippets WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapSnippet(rows[0]) : null;
  }

  async getSnippetByShortcut(shortcut: string): Promise<Snippet | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM snippets WHERE shortcut = ?',
      [shortcut]
    );

    return rows.length > 0 ? this.mapSnippet(rows[0]) : null;
  }

  async listSnippets(filter?: { category?: string; search?: string }): Promise<Snippet[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM snippets WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.search) {
      sql += ' AND (name LIKE ? OR shortcut LIKE ? OR content LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY usage_count DESC, name ASC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapSnippet(row));
  }

  async updateSnippet(id: string, input: Partial<CreateSnippetInput>): Promise<Snippet> {
    if (!this.pool) throw new Error('Database not initialized');

    const existing = await this.getSnippet(id);
    if (!existing) throw new Error('Snippet not found');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.shortcut !== undefined) {
      updates.push('shortcut = ?');
      values.push(input.shortcut);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
    }
    if (input.category !== undefined) {
      updates.push('category = ?');
      values.push(input.category);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE snippets SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getSnippet(id))!;
  }

  async deleteSnippet(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM snippets WHERE id = ?', [id]);
  }

  async incrementSnippetUsage(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    await this.pool.execute(
      'UPDATE snippets SET usage_count = usage_count + 1 WHERE id = ?',
      [id]
    );
  }

  private mapSnippet(row: mysql.RowDataPacket): Snippet {
    return {
      id: row.id,
      name: row.name,
      shortcut: row.shortcut,
      content: row.content,
      category: row.category,
      usageCount: row.usage_count,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // CALENDAR EVENT OPERATIONS
  // ============================================

  async createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO calendar_events (
        id, title, description, start_date, end_date, all_day, color, remind_at, related_contact_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.title,
        input.description || null,
        input.startDate,
        input.endDate || null,
        input.allDay ? 1 : 0,
        input.color || null,
        input.remindAt || null,
        input.relatedContactId || null,
      ]
    );

    return (await this.getCalendarEvent(id))!;
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM calendar_events WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapCalendarEvent(rows[0]) : null;
  }

  async listCalendarEvents(filter?: {
    fromDate?: string;
    toDate?: string;
    relatedContactId?: string;
  }): Promise<CalendarEvent[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM calendar_events WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.fromDate) {
      sql += ' AND start_date >= ?';
      params.push(filter.fromDate);
    }
    if (filter?.toDate) {
      sql += ' AND start_date <= ?';
      params.push(filter.toDate);
    }
    if (filter?.relatedContactId) {
      sql += ' AND related_contact_id = ?';
      params.push(filter.relatedContactId);
    }

    sql += ' ORDER BY start_date ASC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapCalendarEvent(row));
  }

  async updateCalendarEvent(id: string, input: UpdateCalendarEventInput): Promise<CalendarEvent> {
    if (!this.pool) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.startDate !== undefined) {
      updates.push('start_date = ?');
      values.push(input.startDate);
    }
    if (input.endDate !== undefined) {
      updates.push('end_date = ?');
      values.push(input.endDate);
    }
    if (input.allDay !== undefined) {
      updates.push('all_day = ?');
      values.push(input.allDay ? 1 : 0);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      values.push(input.color);
    }
    if (input.remindAt !== undefined) {
      updates.push('remind_at = ?');
      values.push(input.remindAt);
    }
    if (input.relatedContactId !== undefined) {
      updates.push('related_contact_id = ?');
      values.push(input.relatedContactId);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getCalendarEvent(id))!;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM calendar_events WHERE id = ?', [id]);
  }

  private mapCalendarEvent(row: mysql.RowDataPacket): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      startDate: row.start_date?.toISOString() || new Date().toISOString(),
      endDate: row.end_date?.toISOString() || undefined,
      allDay: Boolean(row.all_day),
      color: row.color || undefined,
      remindAt: row.remind_at?.toISOString() || undefined,
      relatedContactId: row.related_contact_id || undefined,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  async createTask(input: CreateTaskInput): Promise<Task> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    // Get next sort order for the status
    const [maxRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT MAX(sort_order) as max_order FROM tasks WHERE status = ?',
      [input.status || 'todo']
    );
    const nextOrder = (maxRows[0]?.max_order || 0) + 1;

    await this.pool.execute(
      `INSERT INTO tasks (
        id, title, description, status, priority, due_date, tags, sort_order, recurrence, parent_task_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );

    return (await this.getTask(id))!;
  }

  async getTask(id: string): Promise<Task | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM tasks WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapTask(rows[0]) : null;
  }

  async listTasks(filter?: {
    status?: TaskStatus;
    priority?: string;
    search?: string;
  }): Promise<Task[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.priority) {
      sql += ' AND priority = ?';
      params.push(filter.priority);
    }
    if (filter?.search) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY sort_order ASC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapTask(row));
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    if (!this.pool) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      values.push(input.priority);
    }
    if (input.dueDate !== undefined) {
      updates.push('due_date = ?');
      values.push(input.dueDate);
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(input.tags));
    }
    if (input.order !== undefined) {
      updates.push('sort_order = ?');
      values.push(input.order);
    }
    if (input.recurrence !== undefined) {
      updates.push('recurrence = ?');
      values.push(input.recurrence ? JSON.stringify(input.recurrence) : null);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getTask(id))!;
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
  }

  async reorderTasks(taskOrders: { id: string; order: number; status: TaskStatus }[]): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    for (const task of taskOrders) {
      await this.pool.execute(
        'UPDATE tasks SET sort_order = ?, status = ? WHERE id = ?',
        [task.order, task.status, task.id]
      );
    }
  }

  private mapTask(row: mysql.RowDataPacket): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date?.toISOString() || undefined,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      order: row.sort_order,
      recurrence: row.recurrence ? (typeof row.recurrence === 'string' ? JSON.parse(row.recurrence) : row.recurrence) : undefined,
      parentTaskId: row.parent_task_id || undefined,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
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
  // NOTE OPERATIONS
  // ============================================

  async createNote(input: CreateNoteInput): Promise<Note> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO notes (
        id, title, content, is_pinned, color, tags
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.title,
        input.content || '',
        input.isPinned ? 1 : 0,
        input.color || null,
        JSON.stringify(input.tags || []),
      ]
    );

    return (await this.getNote(id))!;
  }

  async getNote(id: string): Promise<Note | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM notes WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapNote(rows[0]) : null;
  }

  async listNotes(filter?: { search?: string; isPinned?: boolean }): Promise<Note[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM notes WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.search) {
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern);
    }
    if (filter?.isPinned !== undefined) {
      sql += ' AND is_pinned = ?';
      params.push(filter.isPinned ? 1 : 0);
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapNote(row));
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
    if (!this.pool) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
    }
    if (input.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(input.isPinned ? 1 : 0);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      values.push(input.color);
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(input.tags));
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getNote(id))!;
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM notes WHERE id = ?', [id]);
  }

  private mapNote(row: mysql.RowDataPacket): Note {
    return {
      id: row.id,
      title: row.title,
      content: row.content || '',
      isPinned: Boolean(row.is_pinned),
      color: row.color || undefined,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // EXPENSE OPERATIONS
  // ============================================

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO expenses (
        id, amount, currency, category, description, date, tags, receipt_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.amount,
        input.currency || 'USD',
        input.category,
        input.description,
        input.date,
        JSON.stringify(input.tags || []),
        input.receiptPath || null,
      ]
    );

    return (await this.getExpense(id))!;
  }

  async getExpense(id: string): Promise<Expense | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM expenses WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapExpense(rows[0]) : null;
  }

  async listExpenses(filter?: {
    category?: ExpenseCategory;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }): Promise<Expense[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter?.fromDate) {
      sql += ' AND date >= ?';
      params.push(filter.fromDate);
    }
    if (filter?.toDate) {
      sql += ' AND date <= ?';
      params.push(filter.toDate);
    }
    if (filter?.search) {
      sql += ' AND description LIKE ?';
      params.push(`%${filter.search}%`);
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(sql, params);
    return rows.map((row) => this.mapExpense(row));
  }

  async updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense> {
    if (!this.pool) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.amount !== undefined) {
      updates.push('amount = ?');
      values.push(input.amount);
    }
    if (input.currency !== undefined) {
      updates.push('currency = ?');
      values.push(input.currency);
    }
    if (input.category !== undefined) {
      updates.push('category = ?');
      values.push(input.category);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.date !== undefined) {
      updates.push('date = ?');
      values.push(input.date);
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(input.tags));
    }
    if (input.receiptPath !== undefined) {
      updates.push('receipt_path = ?');
      values.push(input.receiptPath);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getExpense(id))!;
  }

  async deleteExpense(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM expenses WHERE id = ?', [id]);
  }

  async getExpenseSummary(filter?: { fromDate?: string; toDate?: string }): Promise<ExpenseSummary> {
    if (!this.pool) throw new Error('Database not initialized');

    let whereClause = '1=1';
    const params: unknown[] = [];

    if (filter?.fromDate) {
      whereClause += ' AND date >= ?';
      params.push(filter.fromDate);
    }
    if (filter?.toDate) {
      whereClause += ' AND date <= ?';
      params.push(filter.toDate);
    }

    // Total
    const [totalRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${whereClause}`,
      params
    );

    // By category
    const [categoryRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${whereClause} GROUP BY category`,
      params
    );

    // By month
    const [monthRows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT DATE_FORMAT(date, '%Y-%m') as month, COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${whereClause} GROUP BY month ORDER BY month DESC`,
      params
    );

    const byCategory: Record<ExpenseCategory, number> = {
      food: 0,
      transport: 0,
      utilities: 0,
      entertainment: 0,
      shopping: 0,
      health: 0,
      education: 0,
      travel: 0,
      other: 0,
    };

    for (const row of categoryRows) {
      byCategory[row.category as ExpenseCategory] = parseFloat(row.total);
    }

    const byMonth: Record<string, number> = {};
    for (const row of monthRows) {
      byMonth[row.month] = parseFloat(row.total);
    }

    return {
      total: parseFloat(totalRows[0]?.total || '0'),
      byCategory,
      byMonth,
    };
  }

  private mapExpense(row: mysql.RowDataPacket): Expense {
    return {
      id: row.id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      category: row.category,
      description: row.description,
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : row.date,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      receiptPath: row.receipt_path || undefined,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    };
  }

  // ============================================
  // AUTOMATION RULE OPERATIONS
  // ============================================

  async createRule(input: CreateRuleInput): Promise<AutomationRule> {
    if (!this.pool) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.pool.execute(
      `INSERT INTO automation_rules (
        id, name, \`trigger\`, trigger_conditions, actions, enabled
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.trigger,
        input.triggerConditions ? JSON.stringify(input.triggerConditions) : null,
        JSON.stringify(input.actions),
        input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1,
      ]
    );

    return (await this.getRule(id))!;
  }

  async updateRule(id: string, input: UpdateRuleInput): Promise<AutomationRule> {
    if (!this.pool) throw new Error('Database not initialized');

    const existing = await this.getRule(id);
    if (!existing) throw new Error('Automation rule not found');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.trigger !== undefined) {
      updates.push('`trigger` = ?');
      values.push(input.trigger);
    }
    if (input.triggerConditions !== undefined) {
      updates.push('trigger_conditions = ?');
      values.push(JSON.stringify(input.triggerConditions));
    }
    if (input.actions !== undefined) {
      updates.push('actions = ?');
      values.push(JSON.stringify(input.actions));
    }
    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(input.enabled ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.pool.execute(
        `UPDATE automation_rules SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    return (await this.getRule(id))!;
  }

  async deleteRule(id: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    await this.pool.execute('DELETE FROM automation_rules WHERE id = ?', [id]);
  }

  async getRule(id: string): Promise<AutomationRule | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM automation_rules WHERE id = ?',
      [id]
    );

    return rows.length > 0 ? this.mapRule(rows[0]) : null;
  }

  async listRules(): Promise<AutomationRule[]> {
    if (!this.pool) throw new Error('Database not initialized');

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      'SELECT * FROM automation_rules ORDER BY created_at DESC'
    );

    return rows.map((row) => this.mapRule(row));
  }

  private mapRule(row: mysql.RowDataPacket): AutomationRule {
    return {
      id: row.id,
      name: row.name,
      trigger: row.trigger,
      triggerConditions: row.trigger_conditions
        ? (typeof row.trigger_conditions === 'string'
          ? JSON.parse(row.trigger_conditions)
          : row.trigger_conditions)
        : undefined,
      actions: typeof row.actions === 'string'
        ? JSON.parse(row.actions)
        : row.actions || [],
      enabled: Boolean(row.enabled),
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at || new Date().toISOString(),
    };
  }
}
