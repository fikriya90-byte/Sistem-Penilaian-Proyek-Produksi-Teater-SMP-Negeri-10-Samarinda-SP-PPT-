import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// =========================================================
// 1. CLEANUP: Hapus Service Worker lama + cache sebelum render
// Ini menyembuhkan user yang "terjebak" di cache versi lama.
// =========================================================
async function cleanupOldServiceWorkers() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        console.log(`Membersihkan ${registrations.length} service worker lama...`);
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        console.log(`Menghapus ${cacheNames.length} cache lama...`);
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
    }
  } catch (err) {
    console.warn('Cleanup SW error (non-fatal):', err);
  }
}

// =========================================================
// 2. GLOBAL ERROR HANDLER — tampilkan error ke DOM jika React crash
// agar tidak pernah muncul blank page tanpa pesan
// =========================================================
function renderFatalError(message: string, detail?: string) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:16px;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;background:#1e293b;border:2px solid #f43f5e;border-radius:24px;padding:24px;color:#fff;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="display:inline-block;width:60px;height:60px;border-radius:50%;background:rgba(244,63,94,0.15);border:2px solid rgba(244,63,94,0.4);line-height:60px;font-size:28px;">⚠️</div>
          <h2 style="font-size:18px;font-weight:900;margin:12px 0 4px;color:#fda4af;">Aplikasi Gagal Dimuat</h2>
          <p style="font-size:12px;color:#94a3b8;margin:0;">SP-PPT — SMPN 10 Samarinda</p>
        </div>
        <div style="padding:12px;border-radius:12px;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);margin-bottom:12px;">
          <p style="font-size:10px;font-weight:800;color:#fda4af;text-transform:uppercase;margin:0 0 4px;">Error</p>
          <p style="font-size:12px;color:#fee2e2;font-family:monospace;word-break:break-all;margin:0;line-height:1.5;">${message}</p>
        </div>
        ${detail ? `
        <details style="padding:12px;border-radius:12px;background:#0f172a;border:1px solid #334155;margin-bottom:12px;">
          <summary style="font-size:11px;font-weight:700;color:#cbd5e1;cursor:pointer;">Detail Teknis</summary>
          <pre style="font-size:10px;color:#94a3b8;overflow:auto;max-height:150px;white-space:pre-wrap;word-break:break-all;margin:8px 0 0;">${detail}</pre>
        </details>` : ''}
        <div style="padding:12px;border-radius:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);margin-bottom:12px;">
          <p style="font-size:11px;color:#fcd34d;margin:0;line-height:1.5;">
            <strong>Solusi:</strong> Tekan <strong>Hard Reset</strong> di bawah untuk membersihkan cache.
            Ini menyelesaikan masalah setelah update.
          </p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button id="btn-reload" style="padding:12px;border-radius:12px;background:#334155;color:#fff;border:none;font-weight:700;font-size:12px;cursor:pointer;">
            Muat Ulang
          </button>
          <button id="btn-reset" style="padding:12px;border-radius:12px;background:#e11d48;color:#fff;border:none;font-weight:700;font-size:12px;cursor:pointer;">
            Hard Reset
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-reload')?.addEventListener('click', () => {
    window.location.reload();
  });
  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      if ('caches' in window) {
        const names = await caches.keys();
        for (const n of names) await caches.delete(n);
      }
    } catch (e) { /* ignore */ }
    setTimeout(() => {
      window.location.href = window.location.pathname + '?v=' + Date.now();
    }, 500);
  });
}

window.addEventListener('error', (event) => {
  console.error('GLOBAL ERROR:', event.error || event.message);
  renderFatalError(
    event.message || 'Unknown error',
    (event.error && event.error.stack) || ''
  );
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('UNHANDLED PROMISE:', event.reason);
  const msg = event.reason?.message || String(event.reason);
  renderFatalError('Promise Rejection: ' + msg, event.reason?.stack || '');
});

// =========================================================
// 3. APPLY THEME SEBELUM RENDER
// =========================================================
(function applyThemeEarly() {
  const STORAGE_KEY = 'spppt-theme-v2';
  let saved: string | null = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) { /* ignore */ }

  const prefersDark = (() => {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
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

// =========================================================
// 4. BOOTSTRAP — cleanup SW dulu, baru render App
// =========================================================
(async () => {
  // Cleanup dulu
  await cleanupOldServiceWorkers();

  // Render App
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      renderFatalError('Elemen #root tidak ditemukan di HTML', 'Cek index.html');
      return;
    }
    createRoot(rootEl).render(<App />);
    console.log('SP-PPT berhasil dimuat.');
  } catch (err: any) {
    console.error('RENDER ERROR:', err);
    renderFatalError(
      err?.message || 'Gagal render aplikasi',
      err?.stack || ''
    );
  }
})();

// =========================================================
// 5. SERVICE WORKER — DIMATIKAN TOTAL
// =========================================================
// SP-PPT butuh internet untuk Firebase, jadi offline mode tidak berguna.
// Dengan SW dimatikan, TIDAK AKAN PERNAH terjadi blank page karena cache lama.
// Tidak ada registrasi SW di sini.
console.log('Service Worker dimatikan (by design). App selalu load fresh dari server.');
