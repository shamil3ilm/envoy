import { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle, X, AlarmClock, AlertCircle, HeartPulse, Repeat, Plus } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Reminder, ReminderStatus, NotificationSoundType, RepeatInterval } from '@shared/types';
import { useToast } from '../../contexts/ToastContext';
import { useSettings } from '../../contexts/SettingsContext';
import { playNotificationSound } from '../../utils/notificationSounds';

interface ReminderPanelProps {
  compact?: boolean;
  maxItems?: number;
  statusFilter?: ReminderStatus;
}

export default function ReminderPanel({ compact = false, maxItems = 5, statusFilter }: ReminderPanelProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSnooze, setActiveSnooze] = useState<string | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderFormType, setReminderFormType] = useState<'custom' | 'medical'>('custom');
  const [customForm, setCustomForm] = useState({
    title: '',
    description: '',
    dateTime: '',
    dosage: '',
    instructions: '',
    repeatEnabled: false,
    repeatInterval: 'daily' as RepeatInterval,
    repeatEvery: 1,
  });
  const [customSaving, setCustomSaving] = useState(false);
  const toast = useToast();
  const { preferences } = useSettings();

  useEffect(() => {
    loadReminders();

    // Subscribe to due reminders
    const unsubscribe = window.envoy.reminders.onDue((reminder) => {
      toast.info('Reminder', reminder.title);
      loadReminders();

      // Play notification sound based on type
      const soundType: NotificationSoundType =
        reminder.type === 'medical' ? 'medical' : 'reminders';
      const sound = preferences.notificationSounds?.[soundType] || 'default';
      const customPath = sound === 'custom' ? preferences.customSoundPaths?.[soundType] : undefined;
      playNotificationSound(sound, customPath);
    });

    return () => unsubscribe();
  }, [preferences.notificationSounds, preferences.customSoundPaths]);

  useEffect(() => {
    loadReminders();
  }, [statusFilter]);

  async function loadReminders() {
    try {
      const filter: { status?: ReminderStatus; type?: string } = {};
      if (statusFilter) filter.status = statusFilter;
      else filter.status = 'pending';
      const data = await window.envoy.reminders.list(filter);
      const sorted = data.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
      setReminders(maxItems ? sorted.slice(0, maxItems) : sorted);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(id: string) {
    try {
      await window.envoy.reminders.complete(id);
      toast.success('Completed', 'Reminder marked as complete');
      loadReminders();
    } catch (error) {
      console.error('Failed to complete reminder:', error);
      toast.error('Failed', 'Could not complete reminder');
    }
  }

  async function handleDismiss(id: string) {
    try {
      await window.envoy.reminders.dismiss(id);
      loadReminders();
    } catch (error) {
      console.error('Failed to dismiss reminder:', error);
      toast.error('Failed', 'Could not dismiss reminder');
    }
  }

  async function handleSnooze(id: string, minutes: number) {
    try {
      await window.envoy.reminders.snooze(id, minutes);
      toast.success('Snoozed', `Reminder snoozed for ${minutes} minutes`);
      setActiveSnooze(null);
      loadReminders();
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
      toast.error('Failed', 'Could not snooze reminder');
    }
  }

  function openReminderForm(type: 'custom' | 'medical') {
    setReminderFormType(type);
    setCustomForm({
      title: '',
      description: '',
      dateTime: '',
      dosage: '',
      instructions: '',
      repeatEnabled: false,
      repeatInterval: 'daily',
      repeatEvery: 1,
    });
    setShowReminderForm(true);
  }

  async function handleReminderSave() {
    if (!customForm.title.trim() || !customForm.dateTime) return;

    setCustomSaving(true);
    try {
      await window.envoy.reminders.create({
        type: reminderFormType,
        title: customForm.title.trim(),
        description: reminderFormType === 'medical'
          ? (customForm.instructions || undefined)
          : (customForm.description || undefined),
        dueAt: new Date(customForm.dateTime).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        repeatSchedule: customForm.repeatEnabled
          ? { interval: customForm.repeatInterval, every: customForm.repeatEvery }
          : undefined,
        metadata: reminderFormType === 'medical'
          ? {
              dosage: customForm.dosage || undefined,
              instructions: customForm.instructions || undefined,
            }
          : undefined,
      });
      toast.success('Reminder created', customForm.title.trim());
      setShowReminderForm(false);
      loadReminders();
    } catch (error) {
      console.error('Failed to create reminder:', error);
      toast.error('Failed', 'Could not create reminder');
    } finally {
      setCustomSaving(false);
    }
  }

  const getReminderIcon = (type: string) => {
    switch (type) {
      case 'follow_up':
        return <Bell className="w-4 h-4 text-blue-500" />;
      case 'task':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'medical':
        return <HeartPulse className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const isOverdue = (dueAt: string) => new Date(dueAt) < new Date();

  if (loading) {
    return (
      <div className={`${compact ? 'p-3' : 'card p-4'}`}>
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm">Loading reminders...</div>
      </div>
    );
  }

  if (reminders.length === 0 && !preferences.medicalReminders) {
    return (
      <div className={`${compact ? 'p-3' : 'card p-4'}`}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Bell className="w-4 h-4" />
          <span className="text-sm">No pending reminders</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? '' : 'card'}`}>
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Reminders
          </h3>
          {reminders.length > 0 && (
            <span className="text-xs bg-primary-100 text-primary-700 dark:bg-[var(--primary-tint-30)] dark:text-primary-400 px-2 py-0.5 rounded-full">
              {reminders.length}
            </span>
          )}
        </div>
      )}

      {/* Add reminder buttons */}
      {!compact && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            onClick={() => openReminderForm('custom')}
            className="flex-1 px-3 py-2 text-sm bg-primary-50 dark:bg-[var(--primary-tint-10)] text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-[var(--primary-tint-20)] transition-colors flex items-center justify-center gap-2 border border-dashed border-primary-300 dark:border-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Reminder
          </button>
          {preferences.medicalReminders && (
            <button
              onClick={() => openReminderForm('medical')}
              className="flex-1 px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2 border border-dashed border-red-300 dark:border-red-700"
            >
              <HeartPulse className="w-4 h-4" />
              Medical Reminder
            </button>
          )}
        </div>
      )}

      {/* Info banner if medical reminders exist but preference is disabled */}
      {!preferences.medicalReminders && reminders.some(r => r.type === 'medical') && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10 text-xs text-yellow-700 dark:text-yellow-400 border-b border-yellow-200 dark:border-yellow-800">
          You have active medical reminders. Enable Medical Reminders in Settings to add new ones.
        </div>
      )}

      {reminders.length === 0 ? (
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <Bell className="w-4 h-4" />
            <span className="text-sm">No pending reminders</span>
          </div>
        </div>
      ) : (
        <div className={`${compact ? 'space-y-2' : 'divide-y divide-gray-200 dark:divide-gray-700'}`}>
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`${compact ? 'p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50' : 'p-4'} relative`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getReminderIcon(reminder.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {reminder.title}
                    {reminder.repeatSchedule && (
                      <Repeat className="inline w-3 h-3 ml-1 text-gray-400" title="Recurring" />
                    )}
                  </p>
                  {reminder.description && !compact && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {reminder.description}
                    </p>
                  )}
                  {/* Medical metadata */}
                  {reminder.type === 'medical' && reminder.metadata && !compact && (
                    <div className="flex items-center gap-2 mt-1">
                      {reminder.metadata.dosage && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
                          {reminder.metadata.dosage}
                        </span>
                      )}
                      {reminder.metadata.instructions && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">{reminder.metadata.instructions}</span>
                      )}
                    </div>
                  )}
                  <div className={`flex items-center gap-1 mt-1 text-xs ${isOverdue(reminder.dueAt) ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    <Clock className="w-3 h-3" />
                    <span>
                      {isOverdue(reminder.dueAt)
                        ? `Overdue by ${formatDistanceToNow(new Date(reminder.dueAt))}`
                        : formatDistanceToNow(new Date(reminder.dueAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleComplete(reminder.id)}
                    className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                    title="Complete"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSnooze(activeSnooze === reminder.id ? null : reminder.id)}
                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
                    title="Snooze"
                  >
                    <AlarmClock className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDismiss(reminder.id)}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Snooze Options */}
              {activeSnooze === reminder.id && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {[
                    { label: '5 min', value: 5 },
                    { label: '15 min', value: 15 },
                    { label: '30 min', value: 30 },
                    { label: '1 hour', value: 60 },
                    { label: '4 hours', value: 240 },
                    { label: 'Tomorrow', value: 1440 },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSnooze(reminder.id, option.value)}
                      className="px-2 py-1 text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!compact && reminders.length >= maxItems && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-center">
          <button className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
            View all reminders
          </button>
        </div>
      )}

      {/* Create Reminder Modal */}
      {showReminderForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {reminderFormType === 'medical' ? (
                  <HeartPulse className="w-5 h-5 text-red-500" />
                ) : (
                  <Bell className="w-5 h-5 text-primary-500" />
                )}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {reminderFormType === 'medical' ? 'Medical Reminder' : 'New Reminder'}
                </h2>
              </div>
              <button
                onClick={() => setShowReminderForm(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={customForm.title}
                  onChange={(e) => setCustomForm({ ...customForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={reminderFormType === 'medical' ? 'e.g. Blood pressure medication' : 'e.g. Call John about project'}
                />
              </div>

              {reminderFormType !== 'medical' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={customForm.description}
                    onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    placeholder="Optional details..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={customForm.dateTime}
                  onChange={(e) => setCustomForm({ ...customForm, dateTime: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {reminderFormType === 'medical' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Dosage
                    </label>
                    <input
                      type="text"
                      value={customForm.dosage}
                      onChange={(e) => setCustomForm({ ...customForm, dosage: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g. 500mg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Instructions
                    </label>
                    <input
                      type="text"
                      value={customForm.instructions}
                      onChange={(e) => setCustomForm({ ...customForm, instructions: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g. Take with food"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customForm.repeatEnabled}
                    onChange={(e) => setCustomForm({ ...customForm, repeatEnabled: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Repeat
                </label>
                {customForm.repeatEnabled && (
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Every</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={customForm.repeatEvery}
                      onChange={(e) => setCustomForm({ ...customForm, repeatEvery: parseInt(e.target.value) || 1 })}
                      className="w-16 px-2 py-1.5 text-sm text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <select
                      value={customForm.repeatInterval}
                      onChange={(e) => setCustomForm({ ...customForm, repeatInterval: e.target.value as RepeatInterval })}
                      className="px-2 py-1.5 text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="hourly">hour(s)</option>
                      <option value="daily">day(s)</option>
                      <option value="weekly">week(s)</option>
                      <option value="monthly">month(s)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowReminderForm(false)}
                disabled={customSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReminderSave}
                disabled={customSaving || !customForm.title.trim() || !customForm.dateTime}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  reminderFormType === 'medical'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {reminderFormType === 'medical' ? (
                  <HeartPulse className="w-4 h-4" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {customSaving ? 'Creating...' : 'Create Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
