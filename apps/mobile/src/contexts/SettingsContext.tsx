import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AppSettings, PreferencesSettings, Currency } from '@envoy/shared';
import { DEFAULT_SETTINGS } from '@envoy/shared';

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (partial: Partial<AppSettings>) => void;
  updatePreferences: (partial: Partial<PreferencesSettings>) => void;
  setCurrency: (currency: Currency) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
    // TODO: Persist to database
  }, []);

  const updatePreferences = useCallback((partial: Partial<PreferencesSettings>) => {
    setSettings(prev => ({
      ...prev,
      preferences: { ...prev.preferences, ...partial },
    }));
    // TODO: Persist to database
  }, []);

  const setCurrency = useCallback((currency: Currency) => {
    updatePreferences({ currency });
  }, [updatePreferences]);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, updatePreferences, setCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
