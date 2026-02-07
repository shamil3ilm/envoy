import { EventEmitter } from 'events';
import { Notification, BrowserWindow } from 'electron';
import type { IDatabase } from './database.interface';
import type { Reminder } from '../../shared/types';

export interface ReminderEvents {
  'reminder:due': (reminder: Reminder) => void;
  'reminder:completed': (reminderId: string) => void;
  'reminder:snoozed': (reminderId: string, snoozedUntil: string) => void;
  'reminder:dismissed': (reminderId: string) => void;
}

export class ReminderService extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every 60 seconds

  constructor(private database: IDatabase) {
    super();
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Reminder service started');

    // Initial check
    this.checkDueReminders();

    // Set up periodic check
    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('Reminder service stopped');
  }

  private async checkDueReminders(): Promise<void> {
    try {
      const dueReminders = await this.database.getDueReminders();

      for (const reminder of dueReminders) {
        await this.processReminder(reminder);
      }
    } catch (error) {
      console.error('Reminder check failed:', error);
    }
  }

  private async processReminder(reminder: Reminder): Promise<void> {
    console.log(`Processing due reminder: ${reminder.id} - ${reminder.title}`);

    // Show native notification
    this.showNativeNotification(reminder);

    // Emit event for renderer (in-app notification)
    this.emit('reminder:due', reminder);

    // Send IPC to all renderer windows
    this.notifyRenderers(reminder);

    // Mark as notified
    await this.database.markReminderNotified(reminder.id);
  }

  private showNativeNotification(reminder: Reminder): void {
    if (!Notification.isSupported()) {
      console.warn('Native notifications not supported on this platform');
      return;
    }

    const notification = new Notification({
      title: this.getReminderTitle(reminder),
      body: reminder.description || reminder.title,
      silent: true, // Sound handled by renderer via Web Audio API
      urgency: reminder.type === 'medical' ? 'critical' : 'normal',
    });

    notification.on('click', () => {
      // Focus the main window when notification is clicked
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }

      // Emit event for handling in renderer
      this.emit('reminder:clicked', reminder);
    });

    notification.on('close', () => {
      // Notification was dismissed
    });

    notification.show();
  }

  private getReminderTitle(reminder: Reminder): string {
    switch (reminder.type) {
      case 'follow_up':
        return 'Follow-up Reminder';
      case 'task':
        return 'Task Reminder';
      case 'medical':
        return 'Medical Reminder';
      default:
        return 'Reminder';
    }
  }

  private notifyRenderers(reminder: Reminder): void {
    // Send to all browser windows
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('reminder:due', reminder);
      }
    }
  }

  async snooze(reminderId: string, minutes: number): Promise<Reminder> {
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const updated = await this.database.updateReminder(reminderId, {
      status: 'snoozed',
      snoozedUntil,
    });
    this.emit('reminder:snoozed', reminderId, snoozedUntil);
    console.log(`Reminder ${reminderId} snoozed until ${snoozedUntil}`);
    return updated;
  }

  async complete(reminderId: string): Promise<Reminder> {
    const reminder = await this.database.getReminder(reminderId);
    if (!reminder || reminder.status === 'completed') {
      return reminder!;
    }

    const updated = await this.database.updateReminder(reminderId, {
      status: 'completed',
    });
    this.emit('reminder:completed', reminderId);
    console.log(`Reminder ${reminderId} completed`);

    // Auto-create next occurrence for repeating reminders
    if (reminder.repeatSchedule) {
      const next = await this.database.createNextOccurrence(reminder);
      if (next) {
        console.log(`Created next occurrence: ${next.id} due at ${next.dueAt}`);
      }
    }

    return updated;
  }

  async dismiss(reminderId: string): Promise<Reminder> {
    const reminder = await this.database.getReminder(reminderId);
    if (!reminder || reminder.status === 'dismissed') {
      return reminder!;
    }

    const updated = await this.database.updateReminder(reminderId, {
      status: 'dismissed',
    });
    this.emit('reminder:dismissed', reminderId);
    console.log(`Reminder ${reminderId} dismissed`);

    // Auto-create next occurrence for repeating reminders
    if (reminder.repeatSchedule) {
      const next = await this.database.createNextOccurrence(reminder);
      if (next) {
        console.log(`Created next occurrence: ${next.id} due at ${next.dueAt}`);
      }
    }

    return updated;
  }
}
