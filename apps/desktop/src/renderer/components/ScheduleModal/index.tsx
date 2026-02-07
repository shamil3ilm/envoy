import { useState } from 'react';
import { X, Clock, Calendar, Globe } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledFor: string, timezone: string) => void;
  recipientCount: number;
  templateName: string;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

const QUICK_OPTIONS = [
  { label: 'Tomorrow 9 AM', days: 1, hour: 9, minute: 0 },
  { label: 'Tomorrow 2 PM', days: 1, hour: 14, minute: 0 },
  { label: 'In 2 days', days: 2, hour: 9, minute: 0 },
  { label: 'Next week', days: 7, hour: 9, minute: 0 },
];

export default function ScheduleModal({
  isOpen,
  onClose,
  onSchedule,
  recipientCount,
  templateName,
}: ScheduleModalProps) {
  const [date, setDate] = useState<string>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>('09:00');
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const handleQuickSelect = (option: typeof QUICK_OPTIONS[0]) => {
    const newDate = addDays(new Date(), option.days);
    setDate(format(newDate, 'yyyy-MM-dd'));
    setTime(`${option.hour.toString().padStart(2, '0')}:${option.minute.toString().padStart(2, '0')}`);
    setError(null);
  };

  const handleSchedule = () => {
    if (scheduling) return;

    // Parse date and time
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);

    // Create date in local time
    const scheduledDate = new Date(year, month - 1, day, hour, minute);

    // Validate date is in the future
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }

    // Validate date is not too far in the future (90 days max)
    const maxDate = addDays(new Date(), 90);
    if (scheduledDate > maxDate) {
      setError('Cannot schedule more than 90 days in advance');
      return;
    }

    setScheduling(true);

    // Convert to ISO string for storage
    const isoString = scheduledDate.toISOString();

    onSchedule(isoString, timezone);
  };

  if (!isOpen) return null;

  // Find selected timezone label
  const selectedTzLabel = TIMEZONES.find(tz => tz.value === timezone)?.label || timezone;

  // Format preview date
  const previewDate = (() => {
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);
      const scheduledDate = new Date(year, month - 1, day, hour, minute);
      return format(scheduledDate, 'MMMM d, yyyy \'at\' h:mm a');
    } catch {
      return 'Invalid date';
    }
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Schedule Message
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Schedule{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                "{templateName}"
              </span>{' '}
              to{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {recipientCount}
              </span>{' '}
              recipient{recipientCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Quick Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Select
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handleQuickSelect(option)}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setError(null);
                  }}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  max={format(addDays(new Date(), 90), 'yyyy-MM-dd')}
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    setError(null);
                  }}
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timezone
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input pl-10"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-primary-50 dark:bg-[var(--primary-tint-20)] rounded-lg p-3">
            <p className="text-sm text-primary-700 dark:text-primary-400">
              <span className="font-medium">Scheduled for:</span> {previewDate}{' '}
              <span className="text-primary-500">({selectedTzLabel})</span>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button onClick={onClose} disabled={scheduling} className="btn btn-secondary disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSchedule} disabled={scheduling} className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Clock className={`w-4 h-4 ${scheduling ? 'animate-pulse' : ''}`} />
            {scheduling ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
