// =====================================================
// ADMIN SERVICE
// Fungsi untuk mengelola akun Guru & Siswa:
// - Buat akun Guru baru (dari dalam aplikasi)
// - Reset password via email
// - Hapus profil user dari Firestore
// - Perbaiki profil user yang "setengah jadi"
// =====================================================

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc, setDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile } from '../core/types';

// =====================================================
// 1. BUAT AKUN GURU BARU
// Menggunakan secondary Firebase app agar tidak mengganggu session admin yang sedang login.
// =====================================================
export async function createTeacherAccount(data: {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  classId?: string;
  className?: string;
}): Promise<{ success: boolean; uid?: string; message: string }> {
  const SECONDARY_APP_NAME = 'SecondaryAdminApp';
  let secondaryApp;

  try {
    const existing = getApps().find(app => app.name === SECONDARY_APP_NAME);
    if (existing) {
      await deleteApp(existing).catch(() => {});
    }

    secondaryApp = initializeApp(firebaseConfig as any, SECONDARY_APP_NAME);
    const secondaryAuth = getAuth(secondaryApp);

    const res = await createUserWithEmailAndPassword(
      secondaryAuth,
      data.email.trim().toLowerCase(),
      data.password
    );

    try {
      await updateProfile(res.user, { displayName: data.displayName.trim() });
    } catch (_) { /* non-fatal */ }

    const teacherProfile: UserProfile = {
      uid: res.user.uid,
      email: data.email.trim().toLowerCase(),
      displayName: data.displayName.trim(),
      role: 'Guru Pengampu',
      classId: data.classId || '',
      className: data.className || '',
      phone: data.phone?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', res.user.uid), teacherProfile);

    // Simpan credentials guru juga (agar bisa di-reset bila perlu)
    try {
      await setDoc(doc(db, 'userCredentials', res.user.uid), {
        uid: res.user.uid,
        email: data.email.trim().toLowerCase(),
        password: data.password,
        displayName: data.displayName.trim(),
        role: 'Guru Pengampu',
        createdAt: new Date().toISOString(),
      });
    } catch (_) { /* non-fatal */ }

    await signOut(secondaryAuth);

    return {
      success: true,
      uid: res.user.uid,
      message: `Akun guru ${data.email} berhasil dibuat.`,
    };
  } catch (err: any) {
    const code = err?.code || '';
    let message = 'Gagal membuat akun guru.';
    if (code === 'auth/email-already-in-use') message = 'Email sudah terdaftar.';
    else if (code === 'auth/weak-password') message = 'Password minimal 6 karakter.';
    else if (code === 'auth/invalid-email') message = 'Format email tidak valid.';
    else message = err?.message || message;
    return { success: false, message };
  } finally {
    if (secondaryApp) {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }
}

// =====================================================
// 2. KIRIM EMAIL RESET PASSWORD (untuk login sendiri)
// =====================================================
export async function sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return { success: true, message: `Link reset password dikirim ke ${email}` };
  } catch (err: any) {
    const code = err?.code || '';
    let message = 'Gagal mengirim reset password.';
    if (code === 'auth/user-not-found') message = 'Email tidak terdaftar di sistem.';
    else if (code === 'auth/invalid-email') message = 'Format email tidak valid.';
    else if (code === 'auth/too-many-requests') message = 'Terlalu banyak permintaan. Coba lagi nanti.';
    else if (code === 'auth/network-request-failed') message = 'Koneksi internet bermasalah.';
    else message = err?.message || message;
    return { success: false, message };
  }
}

// =====================================================
// 3. RESET PASSWORD SISWA DARI GURU
// Kirim link reset password ke email siswa.
// Siswa klik link → buat password baru → login ulang.
// =====================================================
export async function resetStudentPassword(email: string): Promise<{ success: boolean; message: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return {
      success: true,
      message: `Link reset password terkirim ke ${email}. Minta siswa cek inbox & klik link untuk buat password baru.`,
    };
  } catch (err: any) {
    const code = err?.code || '';
    let message = 'Gagal mengirim reset.';
    if (code === 'auth/user-not-found') message = 'Email siswa tidak terdaftar di Firebase Auth.';
    else if (code === 'auth/invalid-email') message = 'Format email tidak valid.';
    else if (code === 'auth/too-many-requests') message = 'Terlalu banyak permintaan. Coba lagi nanti.';
    else if (code === 'auth/network-request-failed') message = 'Koneksi internet bermasalah.';
    else message = err?.message || message;
    return { success: false, message };
  }
}

// =====================================================
// 4. HAPUS PROFIL USER DARI FIRESTORE
// Catatan: Firebase Auth user TIDAK ikut terhapus —
// harus dihapus manual di Firebase Console (Authentication → Users).
// =====================================================
export async function deleteUserProfile(uid: string): Promise<{ success: boolean; message: string }> {
  try {
    // Hapus profil utama
    await deleteDoc(doc(db, 'users', uid));

    // Hapus credentials (jika ada)
    try {
      await deleteDoc(doc(db, 'userCredentials', uid));
    } catch (_) { /* non-fatal */ }

    return { success: true, message: 'Profil user berhasil dihapus dari Firestore.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menghapus profil.' };
  }
}

// =====================================================
// 5. PERBAIKI PROFIL USER YANG "SETENGAH JADI"
// Kasus: Firebase Auth ada user tapi Firestore tidak punya profil.
// Fungsi ini membuat profil minimal dari data userCredentials.
// =====================================================
export async function repairUserProfile(
  uid: string,
  credentials: { email: string; displayName: string; password: string; role?: string; classId?: string; className?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const existingSnap = await getDoc(doc(db, 'users', uid));
    if (existingSnap.exists()) {
      return { success: false, message: 'Profil sudah ada, tidak perlu diperbaiki.' };
    }

    await setDoc(doc(db, 'users', uid), {
      uid,
      email: credentials.email.trim().toLowerCase(),
      displayName: credentials.displayName.trim(),
      role: credentials.role || 'Pemeran',
      classId: credentials.classId || '',
      className: credentials.className || '',
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repairedAt: new Date().toISOString(),
      note: 'Profil dipulihkan otomatis dari userCredentials',
    });

    return {
      success: true,
      message: `Profil ${credentials.displayName} berhasil dipulihkan.`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal memulihkan profil.' };
  }
}

// =====================================================
// 6. PERBAIKI SEMUA PROFIL YANG HILANG (BULK)
// Ambil semua userCredentials, cek apakah profil ada.
// Jika tidak ada, buat profil minimal.
// =====================================================
import { collection, getDocs } from 'firebase/firestore';

export async function repairAllMissingProfiles(): Promise<{
  success: boolean;
  repaired: number;
  skipped: number;
  errors: string[];
  message: string;
}> {
  const errors: string[] = [];
  let repaired = 0;
  let skipped = 0;

  try {
    // Ambil semua credentials
    const credSnap = await getDocs(collection(db, 'userCredentials'));
    if (credSnap.empty) {
      return { success: true, repaired: 0, skipped: 0, errors: [], message: 'Tidak ada credentials tersimpan.' };
    }

    for (const credDoc of credSnap.docs) {
      const cred = credDoc.data();
      const uid = cred.uid || credDoc.id;

      try {
        const profileSnap = await getDoc(doc(db, 'users', uid));
        if (profileSnap.exists()) {
          skipped++;
          continue;
        }

        // Profil hilang → buat ulang
        await setDoc(doc(db, 'users', uid), {
          uid,
          email: cred.email || '',
          displayName: cred.displayName || '(Tanpa Nama)',
          role: cred.role || 'Pemeran',
          classId: cred.classId || '',
          className: cred.className || '',
          phone: '',
          createdAt: cred.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          repairedAt: new Date().toISOString(),
          note: 'Profil dipulihkan otomatis dari userCredentials',
        });
        repaired++;
      } catch (err: any) {
        errors.push(`${cred.email || uid}: ${err?.message || 'error'}`);
      }
    }

    return {
      success: true,
      repaired,
      skipped,
      errors,
      message: `Perbaikan selesai. ${repaired} profil dipulihkan, ${skipped} sudah OK${errors.length > 0 ? `, ${errors.length} error` : ''}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      repaired,
      skipped,
      errors,
      message: 'Gagal: ' + (err?.message || 'Unknown'),
    };
  }
}

// =====================================================
// 7. AMBIL CREDENTIALS USER (untuk lihat password)
// =====================================================
export async function getUserCredentials(uid: string): Promise<{
  success: boolean;
  password?: string;
  email?: string;
  displayName?: string;
  message: string;
}> {
  try {
    const snap = await getDoc(doc(db, 'userCredentials', uid));
    if (!snap.exists()) {
      return { success: false, message: 'Kredensial tidak tersedia (siswa mungkin mendaftar sebelum fitur ini aktif).' };
    }
    const data = snap.data();
    return {
      success: true,
      password: data.password,
      email: data.email,
      displayName: data.displayName,
      message: 'OK',
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal memuat kredensial.' };
  }
}
