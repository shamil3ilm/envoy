import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { ThemeSettings, AccentColor, FontSize, ThemeMode } from '@shared/types';
import { DEFAULT_THEME, ACCENT_COLORS } from '@shared/types';

interface ThemeContextValue {
  theme: ThemeSettings;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
  setReducedMotion: (reduced: boolean) => void;
  setCompactMode: (compact: boolean) => void;
  toggleDarkMode: () => void;
  updateTheme: (settings: Partial<ThemeSettings>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);
  const [isDark, setIsDark] = useState(false);

  // Load theme from settings on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        const settings = await window.envoy.settings.get();
        if (settings?.theme) {
          // Handle both old string format and new object format
          if (typeof settings.theme === 'string') {
            setTheme({ ...DEFAULT_THEME, mode: settings.theme as ThemeMode });
          } else {
            setTheme({ ...DEFAULT_THEME, ...settings.theme });
          }
        }
      } catch (error) {
        console.error('Failed to load theme settings:', error);
      }
    }
    loadTheme();
  }, []);

  // Determine if dark mode should be active
  useEffect(() => {
    const updateDarkMode = () => {
      if (theme.mode === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(prefersDark);
      } else {
        setIsDark(theme.mode === 'dark');
      }
    };

    updateDarkMode();

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme.mode === 'system') {
        updateDarkMode();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme.mode]);

  // Apply theme classes to document
  useEffect(() => {
    const root = document.documentElement;

    // Dark mode
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Accent color
    const accent = ACCENT_COLORS[theme.accentColor];
    root.style.setProperty('--color-primary-500', accent.primary);
    root.style.setProperty('--color-primary-600', accent.hover);
    root.style.setProperty('--color-primary', accent.primary);

    // Font size
    const fontSizes: Record<FontSize, string> = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    root.style.setProperty('--base-font-size', fontSizes[theme.fontSize]);
    root.style.fontSize = fontSizes[theme.fontSize];

    // Reduced motion
    if (theme.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Compact mode
    if (theme.compactMode) {
      root.classList.add('compact');
    } else {
      root.classList.remove('compact');
    }
  }, [isDark, theme]);

  const saveTheme = useCallback(async (newTheme: ThemeSettings) => {
    try {
      await window.envoy.settings.set({ theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme settings:', error);
    }
  }, []);

  const updateTheme = useCallback((updates: Partial<ThemeSettings>) => {
    setTheme((prev) => {
      const newTheme = { ...prev, ...updates };
      saveTheme(newTheme);
      return newTheme;
    });
  }, [saveTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    updateTheme({ mode });
  }, [updateTheme]);

  const setAccentColor = useCallback((accentColor: AccentColor) => {
    updateTheme({ accentColor });
  }, [updateTheme]);

  const setFontSize = useCallback((fontSize: FontSize) => {
    updateTheme({ fontSize });
  }, [updateTheme]);

  const setReducedMotion = useCallback((reducedMotion: boolean) => {
    updateTheme({ reducedMotion });
  }, [updateTheme]);

  const setCompactMode = useCallback((compactMode: boolean) => {
    updateTheme({ compactMode });
  }, [updateTheme]);

  const toggleDarkMode = useCallback(() => {
    const newMode: ThemeMode = isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  }, [isDark, setThemeMode]);

  const value: ThemeContextValue = {
    theme,
    isDark,
    setThemeMode,
    setAccentColor,
    setFontSize,
    setReducedMotion,
    setCompactMode,
    toggleDarkMode,
    updateTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
