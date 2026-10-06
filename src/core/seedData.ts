// ============================================================
// SEED DATA — TIDAK ADA DEMO
// Aplikasi murni dimulai dari kosong. Guru membuat kelas sendiri.
// ============================================================

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Flag untuk menandai bahwa aplikasi sudah pernah dibuka (agar tidak ada auto-seed)
const SEED_FLAGS = ['spppt_seed_done_v4', 'spppt_seed_done_v3', 'spppt_seed_done_v2'];

/**
 * Cek apakah perlu seed.
 * Karena tidak ada demo, fungsi ini hanya menyimpan flag "sudah pernah dibuka".
 * Tidak melakukan seeding apapun.
 */
export async function checkAndSeedDatabase() {
  try {
    const flagRef = doc(db, 'systemConfig', 'seedStatus');
    let alreadyChecked = false;

    // 1. Cek flag di Firestore
    try {
      const flagSnap = await getDoc(flagRef);
      if (flagSnap.exists() && flagSnap.data()?.seeded === true) {
        alreadyChecked = true;
      }
    } catch (err) {
      console.warn('Gagal baca flag Firestore:', err);
    }

    // 2. Fallback localStorage
    if (!alreadyChecked) {
      for (const key of SEED_FLAGS) {
        try {
          if (localStorage.getItem(key) === 'done') {
            alreadyChecked = true;
            break;
          }
        } catch { /* ignore */ }
      }
    }

    // 3. Kalau sudah ada flag → cukup return
    if (alreadyChecked) return;

    // 4. Pertama kali dibuka → simpan flag saja (TIDAK SEED APAPUN)
    try {
      await setDoc(flagRef, {
        seeded: true,
        seededAt: new Date().toISOString(),
        reason: 'no-demo mode — aplikasi murni kosong',
      }, { merge: true });
    } catch { /* ignore */ }

    for (const key of SEED_FLAGS) {
      try { localStorage.setItem(key, 'done'); } catch { /* ignore */ }
    }

    console.log('✅ SP-PPT siap digunakan — mode tanpa demo.');
  } catch (error) {
    console.error('checkAndSeedDatabase error:', error);
  }
}

/**
 * Force seed — tidak dipakai lagi.
 * Dibiarkan sebagai no-op agar tidak error saat dipanggil dari Settings.
 */
export async function forceSeedDatabase() {
  console.warn('forceSeedDatabase dipanggil tapi mode no-demo aktif. Tidak ada aksi.');
}
