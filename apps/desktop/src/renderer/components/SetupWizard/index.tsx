import { useState } from 'react';
import {
  Send,
  FileText,
  Zap,
  Clock,
  History,
  Users,
  Calendar,
  CheckSquare,
  Bell,
  StickyNote,
  FileUp,
  DollarSign,
  Calculator,
  Activity,
  Timer,
  Workflow,
  Check,
  Sparkles,
  ShieldCheck,
  HardDrive,
  WifiOff,
} from 'lucide-react';
import { SETUP_FEATURE_GROUPS } from '@shared/types';
import { useSettings } from '../../contexts/SettingsContext';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Send, FileText, Zap, Clock, History, Users, Calendar,
  CheckSquare, Bell, StickyNote, FileUp, DollarSign,
  Calculator, Activity, Timer, Workflow,
};

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { updateSettings } = useSettings();

  // All features enabled by default
  const allHrefs = SETUP_FEATURE_GROUPS.flatMap(g => g.features.map(f => f.href));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(allHrefs.map(href => [href, true]))
  );

  const toggleFeature = (href: string) => {
    setEnabled(prev => ({ ...prev, [href]: !prev[href] }));
  };

  const toggleGroup = (groupName: string) => {
    const group = SETUP_FEATURE_GROUPS.find(g => g.name === groupName);
    if (!group) return;
    const allEnabled = group.features.every(f => enabled[f.href]);
    const newState = !allEnabled;
    setEnabled(prev => {
      const next = { ...prev };
      group.features.forEach(f => { next[f.href] = newState; });
      return next;
    });
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const handleComplete = async () => {
    try {
      await updateSettings({
        setupComplete: true,
        enabledFeatures: enabled,
      });
      onComplete();
    } catch (error) {
      console.error('Failed to save setup:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-auto">
      <div className="w-full max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 dark:bg-[var(--primary-tint-20)] rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Welcome to Envoy
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-base max-w-lg mx-auto leading-relaxed">
            Your personal executive assistant for managing communications, tasks, documents, and daily workflows — all from one place.
          </p>
        </div>

        {/* Privacy & Security */}
        <div className="mb-8 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Private & Offline</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
            Envoy runs entirely on your device. There are no external connections, cloud services, or third-party servers involved. Your data never leaves your machine.
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <WifiOff className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span>No internet required</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <HardDrive className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span>All data stored locally</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span>No tracking or telemetry</span>
            </div>
          </div>
        </div>

        {/* Feature Selection Header */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Choose your features</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select the features you need. You can always enable or disable features from Settings later.
          </p>
        </div>

        {/* Feature Groups */}
        <div className="space-y-6 mb-10">
          {SETUP_FEATURE_GROUPS.map(group => {
            const allGroupEnabled = group.features.every(f => enabled[f.href]);
            const someGroupEnabled = group.features.some(f => enabled[f.href]);

            return (
              <div key={group.name} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    {group.name}
                  </span>
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                    allGroupEnabled
                      ? 'bg-primary-600 text-white'
                      : someGroupEnabled
                        ? 'bg-primary-200 dark:bg-primary-800 text-primary-600 dark:text-primary-400'
                        : 'border-2 border-gray-300 dark:border-gray-600'
                  }`}>
                    {(allGroupEnabled || someGroupEnabled) && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {/* Features */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {group.features.map(feature => {
                    const Icon = ICON_MAP[feature.icon];
                    const isEnabled = enabled[feature.href];

                    return (
                      <button
                        key={feature.href}
                        onClick={() => toggleFeature(feature.href)}
                        className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
                          isEnabled
                            ? 'bg-white dark:bg-gray-900'
                            : 'bg-gray-50/50 dark:bg-gray-900/50 opacity-60'
                        } hover:bg-gray-50 dark:hover:bg-gray-800/30`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          isEnabled
                            ? 'bg-primary-100 dark:bg-[var(--primary-tint-20)] text-primary-600 dark:text-primary-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                        }`}>
                          {Icon && <Icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {feature.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {feature.description}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          isEnabled
                            ? 'bg-primary-600 text-white'
                            : 'border-2 border-gray-300 dark:border-gray-600'
                        }`}>
                          {isEnabled && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {enabledCount} of {allHrefs.length} features selected
          </p>
          <button
            onClick={handleComplete}
            className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
