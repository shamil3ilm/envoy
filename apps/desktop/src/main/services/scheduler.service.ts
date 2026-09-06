import { EventEmitter } from 'events';
import { logger } from './logger';
import type { DatabaseService } from './database';
import type { EmailService } from './email.service';
import type { TeamsService } from './teams.service';
import type { PythonBridge } from '../python-bridge';
import type { ScheduledMessage, Contact, Template } from '../../shared/types';

export interface SchedulerEvents {
  'message:sent': (messageId: string, recipientCount: number) => void;
  'message:failed': (messageId: string, error: string) => void;
  'message:partial': (messageId: string, successCount: number, failCount: number) => void;
}

export class SchedulerService extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
  private teamsService: TeamsService | null = null;

  constructor(
    private database: DatabaseService,
    private emailService: EmailService,
    private pythonBridge: PythonBridge
  ) {
    super();
  }

  /** Set the Teams service reference (can be called after construction). */
  setTeamsService(service: TeamsService): void {
    this.teamsService = service;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Scheduler service started');

    // Initial check
    this.checkAndSendDueMessages();

    // Set up periodic check
    this.checkInterval = setInterval(() => {
      this.checkAndSendDueMessages();
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Scheduler service stopped');
  }

  private async checkAndSendDueMessages(): Promise<void> {
    try {
      const dueMessages = await this.database.getPendingScheduledMessages();

      for (const message of dueMessages) {
        await this.processScheduledMessage(message);
      }
    } catch (error) {
      logger.error('Scheduler check failed:', error);
    }
  }

  private async processScheduledMessage(message: ScheduledMessage): Promise<void> {
    logger.info(`Processing scheduled message: ${message.id}`);

    try {
      // Get template
      const template = await this.database.getTemplate(message.templateId);
      if (!template) {
        await this.markMessageFailed(message.id, 'Template not found');
        return;
      }

      // Get recipients
      const recipients: Contact[] = [];
      for (const recipientId of message.recipientIds) {
        const contact = await this.database.getContact(recipientId);
        if (contact) recipients.push(contact);
      }

      if (recipients.length === 0) {
        await this.markMessageFailed(message.id, 'No valid recipients found');
        return;
      }

      // Send to each recipient
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const recipient of recipients) {
        try {
          const result = await this.sendToRecipient(template, recipient, message);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            errors.push(`${recipient.name}: ${result.error}`);
          }
        } catch (err) {
          failCount++;
          errors.push(`${recipient.name}: ${(err as Error).message}`);
        }
      }

      // Update message status
      if (successCount === recipients.length) {
        await this.database.updateScheduledMessage(message.id, { status: 'sent' });
        this.emit('message:sent', message.id, successCount);
        logger.info(`Scheduled message ${message.id} sent to ${successCount} recipients`);
      } else if (successCount > 0) {
        // Partial success - mark as sent but with error info
        await this.database.updateScheduledMessage(message.id, {
          status: 'sent',
          errorMessage: `Partial: ${successCount} sent, ${failCount} failed`,
        });
        this.emit('message:partial', message.id, successCount, failCount);
        logger.info(`Scheduled message ${message.id} partially sent: ${successCount} success, ${failCount} failed`);
      } else {
        await this.markMessageFailed(message.id, errors.join('; '));
      }
    } catch (error) {
      await this.markMessageFailed(message.id, (error as Error).message);
    }
  }

  private async sendToRecipient(
    template: Template,
    recipient: Contact,
    message: ScheduledMessage
  ): Promise<{ success: boolean; error?: string }> {
    // Prepare data for template rendering
    const data = {
      name: recipient.name,
      first_name: recipient.name.split(' ')[0],
      email: recipient.email || '',
      phone: recipient.phone || '',
      company: recipient.company || '',
      title: recipient.title || '',
      ...recipient.customFields,
    };

    // Render subject
    let renderedSubject = template.subject || '';
    if (renderedSubject) {
      try {
        renderedSubject = await this.pythonBridge.renderTemplate(renderedSubject, data);
      } catch (err) {
        logger.error('Failed to render subject:', err);
      }
    }

    // Render body
    let renderedBody = template.body;
    try {
      renderedBody = await this.pythonBridge.renderTemplate(template.body, data);
    } catch (err) {
      logger.error('Failed to render body:', err);
    }

    // Send based on channel
    if (message.channel === 'email' && recipient.email) {
      const result = await this.emailService.sendEmail({
        to: recipient.email,
        subject: renderedSubject,
        body: renderedBody,
        html: false,
        attachments: message.attachmentPaths?.map((p) => ({
          filename: p.split('/').pop() || p.split('\\').pop() || 'attachment',
          path: p,
        })),
      });

      // Create audit log
      await this.database.createAuditLog({
        channel: 'email',
        templateId: template.id,
        templateName: template.name,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientAddress: recipient.email,
        subject: renderedSubject,
        bodyPreview: renderedBody.substring(0, 200),
        attachments: message.attachmentPaths || [],
        status: result.success ? 'sent' : 'failed',
        errorMessage: result.error,
      });

      return result;
    }

    // WhatsApp channel - not implemented yet
    if (message.channel === 'whatsapp') {
      return { success: false, error: 'WhatsApp sending not yet implemented' };
    }

    // Teams channel — send via Microsoft Graph API
    if (message.channel === 'teams' && recipient.email) {
      if (!this.teamsService) {
        return { success: false, error: 'Teams service not configured' };
      }

      const status = this.teamsService.getStatus();
      if (!status.loggedIn) {
        return { success: false, error: 'Not signed in to Teams' };
      }

      const result = await this.teamsService.sendMessage(recipient.email, renderedBody);

      await this.database.createAuditLog({
        channel: 'teams',
        templateId: template.id,
        templateName: template.name,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientAddress: recipient.email,
        subject: renderedSubject,
        bodyPreview: renderedBody.substring(0, 200),
        attachments: message.attachmentPaths || [],
        status: result.success ? 'sent' : 'failed',
        errorMessage: result.error,
      });

      return result;
    }

    return { success: false, error: 'Unsupported channel or missing contact info' };
  }

  private async markMessageFailed(id: string, error: string): Promise<void> {
    await this.database.updateScheduledMessage(id, {
      status: 'failed',
      errorMessage: error,
    });
    this.emit('message:failed', id, error);
    logger.error(`Scheduled message ${id} failed: ${error}`);
  }
}
