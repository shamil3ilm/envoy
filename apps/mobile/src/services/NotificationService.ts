import notifee, { AndroidImportance, TriggerType, TimestampTrigger } from '@notifee/react-native';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'envoy-reminders';

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: 'Reminders',
      importance: AndroidImportance.HIGH,
    });
  }
  channelReady = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus > 0;
}

export async function scheduleReminderNotification(params: {
  reminderId: string;
  title: string;
  description?: string;
  fireAtIso: string;
}): Promise<boolean> {
  const timestamp = Date.parse(params.fireAtIso);
  if (isNaN(timestamp) || timestamp <= Date.now()) return false;

  await ensureChannel();

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp,
  };

  await notifee.createTriggerNotification(
    {
      id: params.reminderId,
      title: params.title,
      body: params.description ?? 'Reminder due',
      android: {
        channelId: REMINDER_CHANNEL_ID,
        pressAction: { id: 'default' },
      },
      ios: {
        sound: 'default',
      },
    },
    trigger
  );

  return true;
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(reminderId);
  } catch {
    // ignore — notification may never have been scheduled
  }
}
