import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AppSettings, PreferencesSettings, Currency } from '@envoy/shared';
import { DEFAULT_SETTINGS } from '@envoy/shared';
import { useDatabase, useDatabaseReady } from './DatabaseContext';

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (partial: Partial<AppSettings>) => void;
  updatePreferences: (partial: Partial<PreferencesSettings>) => void;
  setCurrency: (currency: Currency) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !db) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await db.getSettings();
        if (!cancelled && stored) {
          setSettings((prev) => ({ ...prev, ...stored }));
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, ready]);

  const persist = useCallback(
    (next: AppSettings) => {
      if (!db) return;
      db.setSettings(next).catch((err: unknown) => {
        console.error('Failed to persist settings', err);
      });
    },
    [db]
  );

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updatePreferences = useCallback(
    (partial: Partial<PreferencesSettings>) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          preferences: { ...prev.preferences, ...partial },
        };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setCurrency = useCallback(
    (currency: Currency) => {
      updatePreferences({ currency });
    },
    [updatePreferences]
  );

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
