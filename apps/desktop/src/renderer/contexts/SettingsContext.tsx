import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { AppSettings, PreferencesSettings, Currency, TasksViewMode, NotesViewMode } from '@shared/types';
import { DEFAULT_SETTINGS, DEFAULT_PREFERENCES } from '@shared/types';

interface SettingsContextValue {
  settings: AppSettings;
  preferences: PreferencesSettings;
  loading: boolean;
  // Update functions
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  updatePreferences: (updates: Partial<PreferencesSettings>) => Promise<void>;
  // Convenience setters for preferences
  setCurrency: (currency: Currency) => Promise<void>;
  setDefaultTasksView: (view: TasksViewMode) => Promise<void>;
  setDefaultNotesView: (view: NotesViewMode) => Promise<void>;
  // Refresh settings from database
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Load settings from database on mount
  const loadSettings = useCallback(async () => {
    try {
      const data = await window.envoy.settings.get();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      await window.envoy.settings.set(updates);
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Revert on failure
      await loadSettings();
      throw error;
    }
  }, [settings, loadSettings]);

  const updatePreferences = useCallback(async (updates: Partial<PreferencesSettings>) => {
    const newPreferences = {
      ...(settings.preferences || DEFAULT_PREFERENCES),
      ...updates,
    };
    await updateSettings({ preferences: newPreferences });
  }, [settings.preferences, updateSettings]);

  const setCurrency = useCallback(async (currency: Currency) => {
    await updatePreferences({ currency });
  }, [updatePreferences]);

  const setDefaultTasksView = useCallback(async (defaultTasksView: TasksViewMode) => {
    await updatePreferences({ defaultTasksView });
  }, [updatePreferences]);

  const setDefaultNotesView = useCallback(async (defaultNotesView: NotesViewMode) => {
    await updatePreferences({ defaultNotesView });
  }, [updatePreferences]);

  const preferences = settings.preferences || DEFAULT_PREFERENCES;

  const value: SettingsContextValue = {
    settings,
    preferences,
    loading,
    updateSettings,
    updatePreferences,
    setCurrency,
    setDefaultTasksView,
    setDefaultNotesView,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
