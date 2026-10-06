// ============================================================
// FIX: JANGAN auto-seed ulang kalau sudah pernah seed
// ============================================================
const SEED_FLAGS = ['spppt_seed_done_v4', 'spppt_seed_done_v3', 'spppt_seed_done_v2'];

export async function checkAndSeedDatabase() {
  try {
    const flagRef = doc(db, 'systemConfig', 'seedStatus');
    let alreadySeeded = false;

    // 1. Cek flag di Firestore
    try {
      const flagSnap = await getDoc(flagRef);
      if (flagSnap.exists() && flagSnap.data()?.seeded === true) {
        alreadySeeded = true;
      }
    } catch (err) {
      console.warn('Gagal baca seed flag Firestore:', err);
    }

    // 2. Fallback localStorage (multiple versi)
    if (!alreadySeeded) {
      for (const key of SEED_FLAGS) {
        try {
          if (localStorage.getItem(key) === 'done') {
            alreadySeeded = true;
            break;
          }
        } catch { /* ignore */ }
      }
    }

    // 3. Kalau sudah pernah seed → JANGAN seed ulang
    if (alreadySeeded) return;

    // 4. Cek apakah classes sudah ada isinya
    const classesSnap = await getDocs(collection(db, 'classes'));
    if (classesSnap.size > 0) {
      try {
        await setDoc(flagRef, {
          seeded: true,
          seededAt: new Date().toISOString(),
          reason: 'kelas sudah ada',
        }, { merge: true });
      } catch { /* ignore */ }
      for (const key of SEED_FLAGS) {
        try { localStorage.setItem(key, 'done'); } catch { /* ignore */ }
      }
      return;
    }

    // 5. Benar-benar kosong & belum pernah seed → seed awal
    console.log('🌱 First-time seed...');
    await forceSeedDatabase();

    try {
      await setDoc(flagRef, {
        seeded: true,
        seededAt: new Date().toISOString(),
        reason: 'initial seed',
      }, { merge: true });
    } catch { /* ignore */ }
    for (const key of SEED_FLAGS) {
      try { localStorage.setItem(key, 'done'); } catch { /* ignore */ }
    }
    console.log('✅ Seed selesai — tidak akan seed ulang.');
  } catch (error) {
    console.error('Seed error:', error);
  }
}
