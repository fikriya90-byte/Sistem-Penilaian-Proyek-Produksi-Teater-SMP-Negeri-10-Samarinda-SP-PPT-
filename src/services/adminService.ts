import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../core/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile } from '../core/types';

/**
 * Buat akun guru baru dari dalam aplikasi admin.
 * Menggunakan secondary Firebase app agar tidak mengganggu session admin yang sedang login.
 */
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
      data.email.trim(),
      data.password
    );

    try {
      await updateProfile(res.user, { displayName: data.displayName.trim() });
    } catch (_) { /* non-fatal */ }

    const teacherProfile: UserProfile = {
      uid: res.user.uid,
      email: data.email.trim(),
      displayName: data.displayName.trim(),
      role: 'Guru Pembina',
      classId: data.classId || '',
      className: data.className || '',
      phone: data.phone?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', res.user.uid), teacherProfile);

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

/**
 * Kirim email reset password untuk guru/siswa tertentu.
 */
export async function sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true, message: `Link reset password dikirim ke ${email}` };
  } catch (err: any) {
    const code = err?.code || '';
    let message = 'Gagal mengirim reset password.';
    if (code === 'auth/user-not-found') message = 'Email tidak terdaftar di sistem.';
    else if (code === 'auth/invalid-email') message = 'Format email tidak valid.';
    return { success: false, message };
  }
}

/**
 * Hapus profil user dari Firestore (tidak menghapus Firebase Auth user — itu harus via Console).
 */
export async function deleteUserProfile(uid: string): Promise<{ success: boolean; message: string }> {
  try {
    await deleteDoc(doc(db, 'users', uid));
    return { success: true, message: 'Profil user berhasil dihapus dari Firestore.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menghapus profil.' };
  }
}
