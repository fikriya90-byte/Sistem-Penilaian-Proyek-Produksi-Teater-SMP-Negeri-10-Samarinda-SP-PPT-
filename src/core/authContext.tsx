import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { checkAndSeedDatabase } from './seedData';
import { ClassRoom, UserProfile, UserRole } from './types';
import {
  fetchClasses, fetchUserProfile, recordAuditLog, notifyTeachers,
} from '../services/firestoreService';
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { TEACHER_INVITE_CODE } from './constants';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  activeClass: ClassRoom | null;
  classes: ClassRoom[];
  setActiveClass: (c: ClassRoom | null) => void;
  reloadClasses: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<{ ok: boolean; message?: string; role?: string }>;
  registerUser: (data: {
    classCode: string;
    displayName: string;
    email: string;
    phone: string;
    pass: string;
    role: UserRole;
    isTeacherRegistration?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  resetDemoDatabase: () => Promise<void>;
  updateKerabatKerja: (newName: string) => Promise<{ success: boolean; message: string }>;

  isTeacher: boolean;
  isGuruPengampu: boolean;
  isAdminRole: boolean;
  isPimprod: boolean;
  isSekretaris: boolean;
  isBendahara: boolean;
  isSutradara: boolean;
  isAsisten: boolean;
  isKoordinator: boolean;
  isAnggota: boolean;
  isPemain: boolean;
  canEditKerabatKerja: boolean;

  canCreateGeneralAttendance: boolean;
  canCreateRehearsalAttendance: boolean;
  canCreateDivisionAttendance: boolean;
  canCreateGeneralSchedule: boolean;
  canCreateInternalSchedule: boolean;
  canCreateTask: boolean;
  canCreateDeadline: boolean;
  canCreateBroadcast: boolean;
  canAssessTarget: (target: UserProfile) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeRole = (role: string): UserRole => {
  if (role === 'Guru Pembina') return 'Guru Pengampu';
  return role as UserRole;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [activeClass, setActiveClass] = useState<ClassRoom | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await checkAndSeedDatabase();
        const clsList = await fetchClasses();
        if (isMounted && clsList) setClasses(clsList);
      } catch (err) {
        console.warn('Init error (non-fatal):', err);
      }
    };
    init();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      // Safety timer agar loading tidak stuck
      const safetyTimer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 6000);

      if (fbUser) {
        try {
          const profile = await fetchUserProfile(fbUser.uid);
          if (!isMounted) { clearTimeout(safetyTimer); return; }

          if (profile) {
            profile.role = normalizeRole(profile.role);
            setUser(profile);
          } else {
            // User Firebase ada tapi profil Firestore tidak ada → sign out
            console.warn('Profil tidak ditemukan untuk UID:', fbUser.uid);
            try { await signOut(auth); } catch { /* ignore */ }
            setUser(null);
            setActiveClass(null);
          }
        } catch (err) {
          console.warn('Fetch profile error:', err);
          try { await signOut(auth); } catch { /* ignore */ }
          setUser(null);
          setActiveClass(null);
        }
      } else {
        setUser(null);
        setActiveClass(null);
      }

      clearTimeout(safetyTimer);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const isTeacherRole =
      user.role === 'Guru Pengampu' ||
      user.role === 'Admin' ||
      user.role === 'Super Admin';
    if (isTeacherRole) {
      setActiveClass(null);
      return;
    }
    if (user.classId && classes.length > 0) {
      const match = classes.find(c => c.id === user.classId);
      if (match) setActiveClass(match);
    }
  }, [user, classes]);

  const reloadClasses = async () => {
    const clsList = await fetchClasses();
    setClasses(clsList);
    if (activeClass) {
      const refreshed = clsList.find(c => c.id === activeClass.id);
      if (refreshed) setActiveClass(refreshed);
    }
  };

  const loginWithEmail = async (
    email: string,
    pass: string
  ): Promise<{ ok: boolean; message?: string; role?: string }> => {
    setLoading(true);
    try {
      const clean = email.trim().toLowerCase();
      const res = await signInWithEmailAndPassword(auth, clean, pass);

      let profile = await fetchUserProfile(res.user.uid);
      if (!profile) {
        await signOut(auth);
        return {
          ok: false,
          message: 'Profil tidak ditemukan. Silakan daftar ulang atau hubungi Guru/Admin.',
        };
      }

      profile.role = normalizeRole(profile.role);
      setUser(profile);
      await recordAuditLog({
        userId: profile.uid,
        userName: profile.displayName,
        role: profile.role,
        action: 'LOGIN',
        targetType: 'Auth',
        targetId: profile.uid,
        details: `Login sebagai ${profile.role}`,
      });
      return { ok: true, role: profile.role };
    } catch (err: any) {
      const code = err?.code || '';
      let message = 'Email atau password salah.';
      if (code === 'auth/user-not-found') message = 'Akun tidak ditemukan. Silakan daftar terlebih dahulu.';
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') message = 'Email atau password salah. Cek kembali.';
      else if (code === 'auth/invalid-email') message = 'Format email tidak valid.';
      else if (code === 'auth/too-many-requests') message = 'Terlalu banyak percobaan. Tunggu beberapa menit.';
      else if (code === 'auth/network-request-failed') message = 'Koneksi internet bermasalah.';
      else if (code === 'auth/operation-not-allowed') message = 'Login Email/Password belum diaktifkan.';
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (data: {
    classCode: string;
    displayName: string;
    email: string;
    phone: string;
    pass: string;
    role: UserRole;
    isTeacherRegistration?: boolean;
  }): Promise<{ success: boolean; message: string }> => {
    const isTeacherReg = !!data.isTeacherRegistration &&
      data.classCode.trim().toUpperCase() === TEACHER_INVITE_CODE.toUpperCase();

    if (!isTeacherReg) {
      const cleanPhone = (data.phone || '').replace(/\D/g, '');
      if (cleanPhone.length < 9 || cleanPhone.length > 15) {
        return { success: false, message: 'Nomor WhatsApp wajib diisi dengan format valid (9-15 digit).' };
      }
    }

    let validClass: ClassRoom | undefined;
    if (isTeacherReg) {
      validClass = classes[0];
    } else {
      validClass = classes.find(c => c.code.toLowerCase() === data.classCode.trim().toLowerCase());
    }

    if (!validClass) {
      return {
        success: false,
        message: isTeacherReg
          ? 'Kode Undangan Guru tidak valid.'
          : 'Kode Kelas tidak valid / belum terdaftar. Tanyakan ke Guru Pengampu.',
      };
    }

    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, data.pass);
      try {
        await updateProfile(res.user, { displayName: data.displayName.trim() });
      } catch (_) { /* non-fatal */ }

      const { getDivisionFromRole } = await import('./constants');
      const division = isTeacherReg ? null : getDivisionFromRole(data.role || 'Pemain');

      const newProfile: UserProfile = {
        uid: res.user.uid,
        email: cleanEmail,
        displayName: data.displayName.trim(),
        role: isTeacherReg ? 'Guru Pengampu' : (data.role || 'Pemain'),
        classId: isTeacherReg ? '' : validClass.id,
        className: isTeacherReg ? '' : validClass.name,
        phone: data.phone.trim(),
        divisionId: division?.id,
        divisionName: division?.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', res.user.uid), newProfile);

      // ===== FIX: increment totalStudents =====
      if (!isTeacherReg) {
        try {
          await updateDoc(doc(db, 'classes', validClass.id), {
            totalStudents: increment(1),
          });
        } catch (err) {
          console.warn('Gagal update totalStudents:', err);
        }
      }

      setUser(newProfile);
      if (!isTeacherReg) setActiveClass(validClass);

      await recordAuditLog({
        userId: newProfile.uid,
        userName: newProfile.displayName,
        role: newProfile.role,
        action: 'CREATE',
        targetType: 'User',
        targetId: newProfile.uid,
        details: isTeacherReg
          ? `Guru baru terdaftar: ${newProfile.displayName}`
          : `Siswa baru di ${validClass.name} sebagai ${newProfile.role}`,
      });

      if (!isTeacherReg) {
        await notifyTeachers(validClass.id, {
          title: 'Siswa Baru Mendaftar',
          message: `${newProfile.displayName} baru saja mendaftar di kelas ${validClass.name} sebagai ${newProfile.role}.`,
          category: 'Sistem',
          link: 'kelola-kelas',
          senderName: newProfile.displayName,
        });
      }

      return { success: true, message: 'Registrasi berhasil! Akun Anda siap digunakan.' };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') return { success: false, message: 'Email sudah terdaftar. Silakan login atau hubungi Admin.' };
      if (code === 'auth/weak-password') return { success: false, message: 'Password minimal 6 karakter.' };
      if (code === 'auth/invalid-email') return { success: false, message: 'Format email tidak valid.' };
      if (code === 'auth/operation-not-allowed') return { success: false, message: 'Login Email/Password belum diaktifkan.' };
      return { success: false, message: 'Gagal registrasi: ' + (err?.message || 'Unknown error') };
    }
  };

  const logout = async () => {
    if (user) {
      try {
        await recordAuditLog({
          userId: user.uid,
          userName: user.displayName,
          role: user.role,
          action: 'LOGOUT',
          targetType: 'Auth',
          targetId: user.uid,
          details: 'Logout dari sistem',
        });
      } catch (_) { /* non-fatal */ }
    }
    try { await signOut(auth); } catch (_) { /* ignore */ }
    setUser(null);
    setActiveClass(null);
  };

  const updateKerabatKerja = async (newName: string): Promise<{ success: boolean; message: string }> => {
    if (!activeClass || !user) return { success: false, message: 'Tidak ada kelas aktif.' };
    try {
      await updateDoc(doc(db, 'classes', activeClass.id), {
        kerabatKerja: newName.trim(),
      });
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Class',
        targetId: activeClass.id,
        details: `Ubah nama kerabat kerja menjadi "${newName.trim()}"`,
      });
      setActiveClass({ ...activeClass, kerabatKerja: newName.trim() });
      setClasses(prev => prev.map(c => c.id === activeClass.id ? { ...c, kerabatKerja: newName.trim() } : c));
      return { success: true, message: 'Nama kerabat kerja berhasil diperbarui!' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal memperbarui.' };
    }
  };

  const resetDemoDatabase = async () => {
    setLoading(true);
    const { forceSeedDatabase } = await import('./seedData');
    await forceSeedDatabase();
    const clsList = await fetchClasses();
    setClasses(clsList);
    setActiveClass(null);
    setUser(null);
    setLoading(false);
  };

  const role = user?.role || 'Pemain';
  const isGuruPengampu = role === 'Guru Pengampu';
  const isAdminRole = role === 'Admin' || role === 'Super Admin';
  const isTeacher = isGuruPengampu || isAdminRole;

  const isPimprod = role === 'Pimpinan Produksi';
  const isSekretaris = role === 'Sekretaris';
  const isBendahara = role === 'Bendahara';
  const isSutradara = role === 'Sutradara';
  const isAsisten = role === 'Asisten Sutradara';
  const isKoordinator = role.startsWith('Koordinator ');
  const isAnggota = role.startsWith('Anggota ');
  const isPemain = role === 'Pemain';

  const canEditKerabatKerja = isTeacher || isPimprod;

  const canCreateGeneralAttendance = isTeacher || isPimprod || isSekretaris;
  const canCreateRehearsalAttendance = isTeacher || isSutradara || isAsisten;
  const canCreateDivisionAttendance = isTeacher || isKoordinator;
  const canCreateGeneralSchedule = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten;
  const canCreateInternalSchedule = isTeacher || isKoordinator;
  const canCreateTask = isTeacher || isPimprod || isSutradara || isKoordinator;
  const canCreateDeadline = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator;
  const canCreateBroadcast = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator || isBendahara;

  // =========================================================
  // MATRIKS PENILAIAN
  // =========================================================
  const canAssessTarget = (target: UserProfile): boolean => {
    if (!user) return false;
    if (target.uid === user.uid) return false;

    const myRole = user.role;
    const targetRole = target.role;

    if (isTeacher) {
      return !(
        targetRole === 'Guru Pengampu' ||
        targetRole === 'Admin' ||
        targetRole === 'Super Admin'
      );
    }

    if (myRole === 'Pimpinan Produksi') {
      return (
        targetRole === 'Sekretaris' ||
        targetRole === 'Bendahara' ||
        targetRole.startsWith('Koordinator ')
      );
    }

    if (myRole === 'Sekretaris' || myRole === 'Bendahara') {
      return targetRole === 'Pimpinan Produksi';
    }

    if (myRole === 'Sutradara') {
      return (
        targetRole === 'Asisten Sutradara' ||
        targetRole === 'Pemain' ||
        targetRole === 'Koordinator Tata Panggung' ||
        targetRole === 'Koordinator Tata Busana' ||
        targetRole === 'Koordinator Tata Rias' ||
        targetRole === 'Koordinator Tata Musik'
      );
    }

    if (myRole === 'Asisten Sutradara') {
      return (
        targetRole === 'Sutradara' ||
        targetRole === 'Pemain' ||
        targetRole === 'Koordinator Tata Panggung' ||
        targetRole === 'Koordinator Tata Busana' ||
        targetRole === 'Koordinator Tata Rias' ||
        targetRole === 'Koordinator Tata Musik'
      );
    }

    if (myRole.startsWith('Koordinator ')) {
      const myDiv = user.divisionName || '';
      const targetDiv = target.divisionName || '';
      if (myDiv && targetDiv === myDiv && targetRole.startsWith('Anggota ')) return true;
      return false;
    }

    if (myRole.startsWith('Anggota ')) {
      const myDiv = user.divisionName || '';
      const targetDiv = target.divisionName || '';
      if (!myDiv || targetDiv !== myDiv) return false;
      return targetRole.startsWith('Koordinator ') || targetRole.startsWith('Anggota ');
    }

    if (myRole === 'Pemain') {
      return targetRole === 'Sutradara' || targetRole === 'Asisten Sutradara';
    }

    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeClass,
        classes,
        setActiveClass,
        reloadClasses,
        loginWithEmail,
        registerUser,
        logout,
        resetDemoDatabase,
        updateKerabatKerja,
        isTeacher,
        isGuruPengampu,
        isAdminRole,
        isPimprod,
        isSekretaris,
        isBendahara,
        isSutradara,
        isAsisten,
        isKoordinator,
        isAnggota,
        isPemain,
        canEditKerabatKerja,
        canCreateGeneralAttendance,
        canCreateRehearsalAttendance,
        canCreateDivisionAttendance,
        canCreateGeneralSchedule,
        canCreateInternalSchedule,
        canCreateTask,
        canCreateDeadline,
        canCreateBroadcast,
        canAssessTarget,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
