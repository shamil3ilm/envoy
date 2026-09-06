import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from './logger';
import type {
  EmailAccount,
  SMTPConfig,
  EmailProviderType,
} from '@shared/types';
import { v4 as uuid } from 'uuid';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  html?: boolean;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
  replyTo?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private accounts: Map<string, EmailAccount> = new Map();
  private transporters: Map<string, Transporter> = new Map();
  private defaultAccountId: string | null = null;

  async addAccount(
    name: string,
    type: EmailProviderType,
    fromName: string,
    fromEmail: string,
    config: SMTPConfig,
    isDefault = false
  ): Promise<EmailAccount> {
    const id = uuid();
    const account: EmailAccount = {
      id,
      name,
      type,
      fromName,
      fromEmail,
      config,
      isDefault,
      createdAt: new Date().toISOString(),
    };

    // Create transporter based on type
    const transporter = this.createTransporter(account);

    // Verify the connection
    await transporter.verify();

    this.accounts.set(id, account);
    this.transporters.set(id, transporter);

    if (isDefault || this.accounts.size === 1) {
      this.defaultAccountId = id;
      // Update all other accounts to not be default
      for (const [accId, acc] of this.accounts) {
        if (accId !== id) {
          acc.isDefault = false;
        }
      }
      account.isDefault = true;
    }

    return account;
  }

  private createTransporter(account: EmailAccount): Transporter {
    const config = account.config as SMTPConfig;

    // SMTP configuration
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  async removeAccount(accountId: string): Promise<void> {
    const transporter = this.transporters.get(accountId);
    if (transporter) {
      transporter.close();
    }
    this.transporters.delete(accountId);
    this.accounts.delete(accountId);

    if (this.defaultAccountId === accountId) {
      // Set a new default if available
      const firstAccount = this.accounts.values().next().value;
      this.defaultAccountId = firstAccount?.id || null;
      if (firstAccount) {
        firstAccount.isDefault = true;
      }
    }
  }

  getAccounts(): EmailAccount[] {
    return Array.from(this.accounts.values());
  }

  getAccount(accountId: string): EmailAccount | undefined {
    return this.accounts.get(accountId);
  }

  getDefaultAccount(): EmailAccount | undefined {
    if (this.defaultAccountId) {
      return this.accounts.get(this.defaultAccountId);
    }
    return undefined;
  }

  setDefaultAccount(accountId: string): void {
    if (!this.accounts.has(accountId)) {
      throw new Error('Account not found');
    }

    // Update all accounts
    for (const [id, account] of this.accounts) {
      account.isDefault = id === accountId;
    }
    this.defaultAccountId = accountId;
  }

  async testConnection(accountId: string): Promise<{ success: boolean; error?: string }> {
    const transporter = this.transporters.get(accountId);
    if (!transporter) {
      return { success: false, error: 'Account not found' };
    }

    try {
      await transporter.verify();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendEmail(params: SendEmailParams, accountId?: string): Promise<SendResult> {
    const useAccountId = accountId || this.defaultAccountId;
    if (!useAccountId) {
      return { success: false, error: 'No email account configured' };
    }

    const account = this.accounts.get(useAccountId);
    const transporter = this.transporters.get(useAccountId);

    if (!account || !transporter) {
      return { success: false, error: 'Email account not found' };
    }

    try {
      const recipients = Array.isArray(params.to) ? params.to.join(', ') : params.to;

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${account.fromName}" <${account.fromEmail}>`,
        to: recipients,
        subject: params.subject,
        replyTo: params.replyTo || account.fromEmail,
      };

      if (params.html) {
        mailOptions.html = params.body;
      } else {
        mailOptions.text = params.body;
      }

      if (params.attachments && params.attachments.length > 0) {
        mailOptions.attachments = params.attachments.map((att) => ({
          filename: att.filename,
          path: att.path,
        }));
      }

      const result = await transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  async sendBulkEmail(
    recipients: Array<{ to: string; subject: string; body: string; attachments?: Array<{ filename: string; path: string }> }>,
    accountId?: string,
    delayMs = 1000
  ): Promise<Array<{ to: string; result: SendResult }>> {
    const results: Array<{ to: string; result: SendResult }> = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const result = await this.sendEmail(
        {
          to: recipient.to,
          subject: recipient.subject,
          body: recipient.body,
          attachments: recipient.attachments,
        },
        accountId
      );
      results.push({ to: recipient.to, result });

      // Add delay between sends to avoid rate limiting
      if (i < recipients.length - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  // Load accounts from database
  async loadAccountsFromDB(accounts: EmailAccount[]): Promise<void> {
    for (const account of accounts) {
      try {
        const transporter = this.createTransporter(account);
        this.accounts.set(account.id, account);
        this.transporters.set(account.id, transporter);
        if (account.isDefault) {
          this.defaultAccountId = account.id;
        }
      } catch (err) {
        logger.error(`Failed to load email account ${account.name}:`, err);
      }
    }
  }

  // Serialize accounts for storage (excluding sensitive data option)
  serializeAccounts(includeSensitive = false): EmailAccount[] {
    return Array.from(this.accounts.values()).map((account) => {
      if (includeSensitive) {
        return account;
      }
      // Mask password in config
      const config = account.config as SMTPConfig;
      return {
        ...account,
        config: {
          ...config,
          password: '********',
        },
      };
    });
  }

  close(): void {
    for (const transporter of this.transporters.values()) {
      transporter.close();
    }
    this.transporters.clear();
    this.accounts.clear();
  }
}
