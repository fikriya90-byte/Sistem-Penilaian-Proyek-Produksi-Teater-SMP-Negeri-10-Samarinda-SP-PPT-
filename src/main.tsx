import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Terapkan tema dari localStorage SEBELUM render (hindari flash)
(function applyThemeEarly() {
  const saved = localStorage.getItem('spppt-theme') as 'light' | 'dark' | 'auto' | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective = saved === 'auto' ? (prefersDark ? 'dark' : 'light') : (saved || 'light');
  if (effective === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
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
