import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// =========================================================
// APPLY THEME SEBELUM RENDER — hindari flash
// Default = AUTO (ikut device)
// =========================================================
(function applyThemeEarly() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('spppt-theme');
  } catch (_) { /* ignore */ }

  const prefersDark = (() => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  })();

  // Default = auto
  const mode = saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto';
  const effective = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;

  const root = document.documentElement;
  if (effective === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
})();

createRoot(document.getElementById('root')!).render(<App />);

// Register Service Worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
