// ===================================================
// SERVICE WORKER — SELF DESTRUCT
// ===================================================
// File ini sengaja dibuat untuk MENGHAPUS DIRINYA SENDIRI
// dan membersihkan semua cache. SP-PPT tidak butuh SW.
//
// Cara kerja:
// 1. Unregister dirinya sendiri
// 2. Hapus semua cache spppt-*
// 3. Reload semua tab user
// ===================================================

self.addEventListener('install', (event) => {
  // Skip waiting — langsung aktif
  self.skipWaiting();
});

self.addEventListener('activate', async (event) => {
  event.waitUntil((async () => {
    try {
      // Hapus semua cache
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // Unregister diri sendiri
      const registration = await self.registration.unregister();
      console.log('Service Worker self-destruct:', registration);

      // Reload semua client (tab) yang dikontrol SW ini
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        try {
          client.navigate(client.url);
        } catch (e) {
          // fallback: postMessage
          client.postMessage({ type: 'SW_CLEANED' });
        }
      });
    } catch (err) {
      console.warn('SW self-destruct error:', err);
    }
  })());
});

// Tidak ada fetch handler — biarkan browser ambil langsung dari server
