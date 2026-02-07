import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemeMode, AccentColor, FontSize } from '@envoy/shared';
import { DEFAULT_THEME, ACCENT_COLORS } from '@envoy/shared';

interface ThemeContextValue {
  mode: ThemeMode;
  accentColor: AccentColor;
  fontSize: FontSize;
  isDark: boolean;
  colors: {
    primary: string;
    primaryHover: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME.mode);
  const [accentColor, setAccentColor] = useState<AccentColor>(DEFAULT_THEME.accentColor);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_THEME.fontSize);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const accent = ACCENT_COLORS[accentColor];
  const colors = {
    primary: accent.primary,
    primaryHover: accent.hover,
    background: isDark ? '#111827' : '#ffffff',
    surface: isDark ? '#1f2937' : '#f9fafb',
    text: isDark ? '#f9fafb' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        accentColor,
        fontSize,
        isDark,
        colors,
        setMode,
        setAccentColor,
        setFontSize,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
