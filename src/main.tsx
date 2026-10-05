import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// =========================================================
// APPLY THEME SEBELUM RENDER — hindari flash
// Default = AUTO (ikut device)
// =========================================================
(function applyThemeEarly() {
  const STORAGE_KEY = 'spppt-theme-v2';

  let saved: string | null = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) { /* ignore */ }

  const prefersDark = (() => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  })();

  const mode = saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto';
  const effective = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;

  const root = document.documentElement;
  if (effective === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }
})();

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
