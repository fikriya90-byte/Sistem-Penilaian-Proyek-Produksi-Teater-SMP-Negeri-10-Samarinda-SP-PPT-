import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Apply theme AWAL sebelum React render (hindari flash)
(function applyThemeEarly() {
  try {
    const saved = localStorage.getItem('spppt-theme') as 'light' | 'dark' | 'auto' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = saved || 'auto';
    const effective = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.style.colorScheme = effective;
    if (effective === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (_) {}
})();

createRoot(document.getElementById('root')!).render(<App />);

// PWA Service Worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch(() => {});
  });
}
