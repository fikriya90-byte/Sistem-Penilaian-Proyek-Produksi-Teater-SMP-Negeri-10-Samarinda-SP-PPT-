// src/services/adminService.ts
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc, setDoc, deleteDoc, getDoc, collection, getDocs, updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile } from '../core/types';

// =====================================================
// 1. BUAT AKUN GURU PENGAMPU BARU
// WAJIB: phone + minimal 1 classId
// Mendukung multi-kelas (classIds array)
// =====================================================
export async function createTeacherAccount(data: {
  email: string;
  password: string;
  displayName: string;
  phone: string;              // ← WAJIB
  classIds: string[];         // ← WAJIB min 1
  classNames?: string[];      // opsional, untuk cache display
}): Promise<{ success: boolean; uid?: string; message: string }> {
  // Validasi
  if (!data.phone || data.phone.replace(/\D/g, '').length < 9) {
    return { success: false, message: 'Nomor WhatsApp wajib diisi (min 9 digit).' };
  }
  if (!Array.isArray(data.classIds) || data.classIds.length === 0) {
    return { success: false, message: 'Guru Pengampu wajib diampu minimal 1 kelas.' };
  }

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

    const classNames = data.classNames && data.classNames.length === data.classIds.length
      ? data.classNames
      : data.classIds;

    const teacherProfile: UserProfile = {
      uid: res.user.uid,
      email: data.email.trim().toLowerCase(),
      displayName: data.displayName.trim(),
      role: 'Guru Pengampu',
      classId: data.classIds[0],               // primary
      classIds: data.classIds,                  // all classes
      className: classNames[0] || '',
      phone: data.phone.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', res.user.uid), teacherProfile);

    // Simpan credentials (untuk fitur "Lihat Pass" — diketahui admin)
    try {
      await setDoc(doc(db, 'userCredentials', res.user.uid), {
        uid: res.user.uid,
        email: data.email.trim().toLowerCase(),
        password: data.password,
        displayName: data.displayName.trim(),
        role: 'Guru Pengampu',
        classIds: data.classIds,
        createdAt: new Date().toISOString(),
      });
    } catch (_) { /* non-fatal */ }

    // Update teacherId di setiap kelas yang diampu
    try {
      for (const classId of data.classIds) {
        await updateDoc(doc(db, 'classes', classId), {
          teacherId: res.user.uid,
          teacherName: data.displayName.trim(),
          updatedAt: new Date().toISOString(),
        }).catch(() => { /* skip if class not exists */ });
      }
    } catch (_) { /* non-fatal */ }

    await signOut(secondaryAuth);

    return {
      success: true,
      uid: res.user.uid,
      message: `Akun guru ${data.email} berhasil dibuat untuk ${data.classIds.length} kelas.`,
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
// 2. RESET PASSWORD VIA EMAIL
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
// 3. RESET PASSWORD SISWA (dari Guru)
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
// 4. HAPUS PROFIL USER
// =====================================================
export async function deleteUserProfile(uid: string): Promise<{ success: boolean; message: string }> {
  try {
    await deleteDoc(doc(db, 'users', uid));
    try { await deleteDoc(doc(db, 'userCredentials', uid)); } catch (_) { /* non-fatal */ }
    return { success: true, message: 'Profil user berhasil dihapus dari Firestore.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menghapus profil.' };
  }
}

// =====================================================
// 5. PERBAIKI PROFIL SETENGAH JADI
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
      classIds: credentials.classId ? [credentials.classId] : [],
      className: credentials.className || '',
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repairedAt: new Date().toISOString(),
      note: 'Profil dipulihkan otomatis dari userCredentials',
    });

    return { success: true, message: `Profil ${credentials.displayName} berhasil dipulihkan.` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal memulihkan profil.' };
  }
}

// =====================================================
// 6. PERBAIKI SEMUA PROFIL YANG HILANG (BULK)
// =====================================================
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
    const credSnap = await getDocs(collection(db, 'userCredentials'));
    if (credSnap.empty) {
      return { success: true, repaired: 0, skipped: 0, errors: [], message: 'Tidak ada credentials tersimpan.' };
    }

    for (const credDoc of credSnap.docs) {
      const cred = credDoc.data();
      const uid = cred.uid || credDoc.id;

      try {
        const profileSnap = await getDoc(doc(db, 'users', uid));
        if (profileSnap.exists()) { skipped++; continue; }

        await setDoc(doc(db, 'users', uid), {
          uid,
          email: cred.email || '',
          displayName: cred.displayName || '(Tanpa Nama)',
          role: cred.role || 'Pemeran',
          classId: cred.classId || '',
          classIds: Array.isArray(cred.classIds) ? cred.classIds : (cred.classId ? [cred.classId] : []),
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
      success: false, repaired, skipped, errors,
      message: 'Gagal: ' + (err?.message || 'Unknown'),
    };
  }
}

// =====================================================
// 7. AMBIL CREDENTIALS
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