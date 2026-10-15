import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  resetToAuto: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ✅ FIX: Bump versi storage biar preferensi lama di-reset ke auto
const STORAGE_KEY = 'spppt-theme-v3';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}
function safeRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function applyHtmlClass(isDark: boolean) {
  try {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
  } catch { /* ignore */ }
}

// ✅ DEFAULT = 'auto' — selalu ikut device kalau belum ada preferensi user
function getInitialTheme(): ThemeMode {
  const saved = safeGet(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  // Hapus preferensi lama v2 supaya user lama kembali ke auto
  safeRemove('spppt-theme-v2');
  safeRemove('spppt-theme');
  return 'auto';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // ✅ Listen perubahan tema device (real-time)
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);

      if (mq.addEventListener) {
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
      } else if ((mq as any).addListener) {
        (mq as any).addListener(handler);
        return () => (mq as any).removeListener(handler);
      }
    } catch { /* ignore */ }
  }, []);

  // Tema efektif: kalau 'auto' → ikut device, kalau 'light'/'dark' → pilihan user
  const effectiveTheme: 'light' | 'dark' =
    theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme;

  // ✅ Apply class ke <html> SETIAP kali tema efektif berubah
  useEffect(() => {
    applyHtmlClass(effectiveTheme === 'dark');
  }, [effectiveTheme]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    safeSet(STORAGE_KEY, t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      // Cycle: auto → light → dark → auto (auto jadi default)
      const order: ThemeMode[] = ['auto', 'light', 'dark'];
      const idx = order.indexOf(prev);
      const next = order[(idx + 1) % order.length];
      safeSet(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const resetToAuto = useCallback(() => {
    setThemeState('auto');
    safeSet(STORAGE_KEY, 'auto');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme, resetToAuto }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
