import { useState } from 'react';
import { Bell, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { ReminderStatus } from '@shared/types';
import ReminderPanel from '../components/ReminderPanel';

const TABS: { key: ReminderStatus | 'all'; label: string; icon: typeof Bell }[] = [
  { key: 'pending', label: 'Pending', icon: Bell },
  { key: 'snoozed', label: 'Snoozed', icon: Clock },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'dismissed', label: 'Dismissed', icon: XCircle },
];

export default function Reminders() {
  const [activeTab, setActiveTab] = useState<ReminderStatus | 'all'>('pending');

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Reminders
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your reminders, follow-ups, and medical alerts
        </p>
      </div>

      {/* Filter tabs */}
      <div className="px-4 sm:px-6 md:px-8 mb-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        <ReminderPanel
          maxItems={50}
          statusFilter={activeTab === 'all' ? undefined : activeTab}
        />
      </div>
    </div>
  );
}
