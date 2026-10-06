// ============================================================
// FIX: JANGAN auto-seed ulang kalau sudah pernah seed.
// Ini mencegah kelas lama muncul kembali setelah dihapus.
// ============================================================
const SEED_FLAG_KEY = 'spppt_seed_done_v3';

export async function checkAndSeedDatabase() {
  try {
    // 1. Cek flag di Firestore
    const flagRef = doc(db, 'systemConfig', 'seedStatus');
    let alreadySeeded = false;
    try {
      const flagSnap = await getDoc(flagRef);
      if (flagSnap.exists() && flagSnap.data()?.seeded === true) {
        alreadySeeded = true;
      }
    } catch (err) {
      console.warn('Gagal baca seed flag:', err);
    }

    // 2. Fallback localStorage
    if (!alreadySeeded) {
      try {
        if (localStorage.getItem(SEED_FLAG_KEY) === 'done') alreadySeeded = true;
      } catch { /* ignore */ }
    }

    // 3. Kalau sudah pernah seed → SELALU return
    if (alreadySeeded) return;

    // 4. Cek apakah classes ada isinya
    const classesSnap = await getDocs(collection(db, 'classes'));
    if (classesSnap.size > 0) {
      // Sudah ada kelas → tandai seed selesai, JANGAN timpa
      try {
        await setDoc(flagRef, {
          seeded: true,
          seededAt: new Date().toISOString(),
          reason: 'kelas sudah ada',
        }, { merge: true });
      } catch { /* ignore */ }
      try { localStorage.setItem(SEED_FLAG_KEY, 'done'); } catch { /* ignore */ }
      return;
    }

    // 5. Benar-benar kosong & belum pernah seed → seed
    console.log('First-time seed...');
    await forceSeedDatabase();

    try {
      await setDoc(flagRef, {
        seeded: true,
        seededAt: new Date().toISOString(),
        reason: 'initial seed',
      }, { merge: true });
    } catch { /* ignore */ }
    try { localStorage.setItem(SEED_FLAG_KEY, 'done'); } catch { /* ignore */ }
    console.log('✅ Seed selesai — tidak akan seed ulang.');
  } catch (error) {
    console.error('Seed error:', error);
  }
}
