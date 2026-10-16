// =====================================================
// ADMIN BOOTSTRAP — Auto-create akun Admin di Firebase Auth + Firestore
// Dijalankan sekali saat app load (idempotent, aman diulang).
// =====================================================

import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

// ═══════════════════════════════════════════════════════
// 🔧 KREDENSIAL ADMIN — GANTI DI SINI KALAU PERLU
// ═══════════════════════════════════════════════════════
export const ADMIN_CREDENTIALS = {
  email: 'admin.spppt@gmail.com',
  password: 'AdminSPPPT2026!',
  displayName: 'Administrator SP-PPT',
  role: 'Super Admin' as const,
};

const SECONDARY_APP_NAME = 'AdminBootstrapApp';
const BOOTSTRAP_FLAG_KEY = 'spppt_admin_bootstrapped_v1';

function isBootstrapped(): boolean {
  try { return localStorage.getItem(BOOTSTRAP_FLAG_KEY) === 'done'; }
  catch { return false; }
}

function markBootstrapped(): void {
  try { localStorage.setItem(BOOTSTRAP_FLAG_KEY, 'done'); }
  catch { /* ignore */ }
}

export interface AdminBootstrapResult {
  success: boolean;
  action: 'created' | 'exists' | 'restored' | 'skipped' | 'error';
  uid?: string;
  message: string;
}

/**
 * Pastikan akun Admin ada di Firebase Auth + Firestore `users/{uid}`.
 * Aman dipanggil berkali-kali (idempotent).
 */
export async function ensureAdminAccount(): Promise<AdminBootstrapResult> {
  // Skip cepat kalau sudah pernah bootstrap di device ini
  if (isBootstrapped()) {
    return { success: true, action: 'skipped', message: 'Admin sudah di-bootstrap di device ini.' };
  }

  let secondaryApp: FirebaseApp | undefined;
  try {
    // Bersihkan secondary app lama kalau ada
    const existing = getApps().find(a => a.name === SECONDARY_APP_NAME);
    if (existing) await deleteApp(existing).catch(() => {});

    secondaryApp = initializeApp(firebaseConfig as any, SECONDARY_APP_NAME);
    const secondaryAuth = getAuth(secondaryApp);

    let uid: string | null = null;
    let action: 'created' | 'exists' | 'restored' = 'exists';

    // ═══ 1. Coba buat akun Auth baru ═══
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        ADMIN_CREDENTIALS.email,
        ADMIN_CREDENTIALS.password
      );
      uid = cred.user.uid;
      action = 'created';

      try {
        await updateProfile(cred.user, { displayName: ADMIN_CREDENTIALS.displayName });
      } catch { /* non-fatal */ }

      console.log('🆕 Admin Auth user created:', uid);
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        // Sudah ada — coba sign in untuk dapat UID
        try {
          const cred = await signInWithEmailAndPassword(
            secondaryAuth,
            ADMIN_CREDENTIALS.email,
            ADMIN_CREDENTIALS.password
          );
          uid = cred.user.uid;
          action = 'exists';
          console.log('✓ Admin Auth user sudah ada:', uid);
        } catch (signInErr: any) {
          // Password beda → kemungkinan admin sudah diganti manual
          if (
            signInErr?.code === 'auth/wrong-password' ||
            signInErr?.code === 'auth/invalid-credential'
          ) {
            console.warn('⚠️ Admin sudah ada tapi password berbeda. Bootstrap dilewati.');
            await signOut(secondaryAuth).catch(() => {});
            await deleteApp(secondaryApp).catch(() => {});
            markBootstrapped();
            return {
              success: false,
              action: 'skipped',
              message: 'Admin sudah ada dengan password berbeda. Reset manual di Firebase Console.',
            };
          }
          throw signInErr;
        }
      } else if (err?.code === 'auth/weak-password') {
        await deleteApp(secondaryApp).catch(() => {});
        return { success: false, action: 'error', message: 'Password admin minimal 6 karakter.' };
      } else if (err?.code === 'auth/invalid-email') {
        await deleteApp(secondaryApp).catch(() => {});
        return { success: false, action: 'error', message: 'Format email admin tidak valid.' };
      } else if (err?.code === 'auth/operation-not-allowed') {
        await deleteApp(secondaryApp).catch(() => {});
        return {
          success: false,
          action: 'error',
          message: 'Login Email/Password belum aktif di Firebase Console (Authentication → Sign-in method).',
        };
      } else {
        throw err;
      }
    }

    if (!uid) {
      await deleteApp(secondaryApp).catch(() => {});
      return { success: false, action: 'error', message: 'Gagal mendapatkan UID admin.' };
    }

    // ═══ 2. Pastikan profil Firestore ada ═══
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        email: ADMIN_CREDENTIALS.email,
        displayName: ADMIN_CREDENTIALS.displayName,
        role: ADMIN_CREDENTIALS.role,
        classId: '',
        className: '',
        phone: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (action === 'exists') action = 'restored';
      console.log('🆕 Profil Firestore admin dibuat/restore:', uid);
    } else {
      const data = snap.data();
      if (data.role !== 'Super Admin' && data.role !== 'Admin') {
        await updateDoc(userRef, {
          role: 'Super Admin',
          updatedAt: new Date().toISOString(),
        });
        console.log('↑ Role admin di-upgrade ke Super Admin');
      }
    }

    // ═══ 3. Simpan kredensial untuk fitur "Lihat Pass" (opsional) ═══
    try {
      await setDoc(doc(db, 'userCredentials', uid), {
        uid,
        email: ADMIN_CREDENTIALS.email,
        password: ADMIN_CREDENTIALS.password,
        displayName: ADMIN_CREDENTIALS.displayName,
        role: 'Super Admin',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Non-fatal: gagal simpan kredensial admin:', err);
    }

    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
    markBootstrapped();

    return {
      success: true,
      action,
      uid,
      message:
        action === 'created'
          ? `✅ Admin baru dibuat: ${ADMIN_CREDENTIALS.email}`
          : action === 'restored'
          ? `✅ Profil admin dipulihkan: ${ADMIN_CREDENTIALS.email}`
          : `✅ Admin siap: ${ADMIN_CREDENTIALS.email}`,
    };
  } catch (err: any) {
    if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
    console.error('Admin bootstrap error:', err);
    return {
      success: false,
      action: 'error',
      message: err?.message || 'Gagal bootstrap admin.',
    };
  }
}

/** Reset flag bootstrap (untuk development / ganti kredensial). */
export function resetAdminBootstrapFlag(): void {
  try { localStorage.removeItem(BOOTSTRAP_FLAG_KEY); }
  catch { /* ignore */ }
}

/** Info kredensial admin (untuk ditampilkan di UI kalau perlu). */
export function getAdminInfo() {
  return {
    email: ADMIN_CREDENTIALS.email,
    displayName: ADMIN_CREDENTIALS.displayName,
    // password tidak di-expose di sini
  };
}