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
import { fetchClasses, fetchUserProfile, recordAuditLog } from '../services/firestoreService';
import { doc, setDoc } from 'firebase/firestore';
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
      if (fbUser) {
        try {
          const profile = await fetchUserProfile(fbUser.uid);
          if (!isMounted) return;
          if (profile) {
            profile.role = normalizeRole(profile.role);
            setUser(profile);
          } else {
            const fallbackProfile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Pengguna',
              role: 'Pemain',
              classId: '',
              className: '',
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', fbUser.uid), fallbackProfile, { merge: true });
            if (isMounted) setUser(fallbackProfile);
          }
        } catch (err) {
          console.warn('Fetch profile error:', err);
        }
      } else {
        setUser(null);
        setActiveClass(null);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const isTeacherRole =
      user.role === 'Guru Pengampu' ||
      user.role === 'Guru Pembina' ||
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
  };

  const loginWithEmail = async (
    email: string,
    pass: string
  ): Promise<{ ok: boolean; message?: string; role?: string }> => {
    setLoading(true);
    try {
      const clean = email.trim();
      const res = await signInWithEmailAndPassword(auth, clean, pass);

      let profile = await fetchUserProfile(res.user.uid);
      if (!profile) {
        profile = {
          uid: res.user.uid,
          email: res.user.email || clean,
          displayName: res.user.displayName || clean.split('@')[0],
          role: 'Pemain',
          classId: '',
          className: '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', res.user.uid), profile, { merge: true });
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
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') message = 'Password salah. Cek kembali kata sandi Anda.';
      else if (code === 'auth/invalid-email') message = 'Format email tidak valid.';
      else if (code === 'auth/too-many-requests') message = 'Terlalu banyak percobaan. Tunggu beberapa menit.';
      else if (code === 'auth/network-request-failed') message = 'Koneksi internet bermasalah.';
      else if (code === 'auth/operation-not-allowed') message = 'Login Email/Password belum diaktifkan oleh admin sistem.';
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
      const res = await createUserWithEmailAndPassword(auth, data.email.trim(), data.pass);
      try {
        await updateProfile(res.user, { displayName: data.displayName.trim() });
      } catch (_) { /* non-fatal */ }

      const { getDivisionFromRole } = await import('./constants');
      const division = isTeacherReg ? null : getDivisionFromRole(data.role || 'Pemain');

      const newProfile: UserProfile = {
        uid: res.user.uid,
        email: data.email.trim(),
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

      return { success: true, message: 'Registrasi berhasil! Akun Anda siap digunakan.' };
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') return { success: false, message: 'Email sudah terdaftar. Silakan login.' };
      if (code === 'auth/weak-password') return { success: false, message: 'Password minimal 6 karakter.' };
      if (code === 'auth/invalid-email') return { success: false, message: 'Format email tidak valid.' };
      if (code === 'auth/operation-not-allowed') return { success: false, message: 'Login Email/Password belum diaktifkan oleh admin sistem.' };
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
  const isGuruPengampu = role === 'Guru Pengampu' || role === 'Guru Pembina';
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

  const canCreateGeneralAttendance = isTeacher || isPimprod || isSekretaris;
  const canCreateRehearsalAttendance = isTeacher || isSutradara || isAsisten;
  const canCreateDivisionAttendance = isTeacher || isKoordinator;
  const canCreateGeneralSchedule = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten;
  const canCreateInternalSchedule = isTeacher || isKoordinator;
  const canCreateTask = isTeacher || isPimprod || isSutradara || isKoordinator;
  const canCreateDeadline = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator;
  const canCreateBroadcast = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator || isBendahara;

  // =========================================================
  // MATRIKS PENILAIAN — SESUAI ROLE FINAL
  // =========================================================
  const canAssessTarget = (target: UserProfile): boolean => {
    if (!user) return false;
    // Tidak bisa menilai diri sendiri
    if (target.uid === user.uid) return false;

    const myRole = user.role;
    const targetRole = target.role;

    // ============================================
    // GURU PENGAMPU & ADMIN
    // Menilai: Sutradara + Pimpinan Produksi
    // ============================================
    if (
      myRole === 'Guru Pengampu' ||
      myRole === 'Guru Pembina' ||
      myRole === 'Admin' ||
      myRole === 'Super Admin'
    ) {
      return targetRole === 'Sutradara' || targetRole === 'Pimpinan Produksi';
    }

    // ============================================
    // PIMPINAN PRODUKSI
    // Menilai: Sekretaris, Bendahara, Koor Perlengkapan, Koor Publikasi
    // ============================================
    if (myRole === 'Pimpinan Produksi') {
      return (
        targetRole === 'Sekretaris' ||
        targetRole === 'Bendahara' ||
        targetRole === 'Koordinator Perlengkapan' ||
        targetRole === 'Koordinator Publikasi'
      );
    }

    // ============================================
    // SEKRETARIS
    // Menilai: Pimpinan Produksi
    // ============================================
    if (myRole === 'Sekretaris') {
      return targetRole === 'Pimpinan Produksi';
    }

    // ============================================
    // BENDAHARA
    // Menilai: Pimpinan Produksi
    // ============================================
    if (myRole === 'Bendahara') {
      return targetRole === 'Pimpinan Produksi';
    }

    // ============================================
    // SUTRADARA
    // Menilai: Pimprod, Asisten, 4 Koor Artistik, Pemain
    // ============================================
    if (myRole === 'Sutradara') {
      return (
        targetRole === 'Pimpinan Produksi' ||
        targetRole === 'Asisten Sutradara' ||
        targetRole === 'Koordinator Tata Panggung' ||
        targetRole === 'Koordinator Tata Busana' ||
        targetRole === 'Koordinator Tata Rias' ||
        targetRole === 'Koordinator Tata Musik' ||
        targetRole === 'Pemain'
      );
    }

    // ============================================
    // ASISTEN SUTRADARA
    // Menilai: Sutradara, Pemain, 4 Koor Artistik
    // ============================================
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

    // ============================================
    // KOORDINATOR PERLENGKAPAN
    // Menilai: Anggota Perlengkapan + Pimpinan Produksi
    // ============================================
    if (myRole === 'Koordinator Perlengkapan') {
      return targetRole === 'Anggota Perlengkapan' || targetRole === 'Pimpinan Produksi';
    }

    // ============================================
    // KOORDINATOR PUBLIKASI
    // Menilai: Anggota Publikasi + Pimpinan Produksi
    // ============================================
    if (myRole === 'Koordinator Publikasi') {
      return targetRole === 'Anggota Publikasi' || targetRole === 'Pimpinan Produksi';
    }

    // ============================================
    // KOORDINATOR TATA PANGGUNG
    // Menilai: Anggota Panggung + Sutradara
    // ============================================
    if (myRole === 'Koordinator Tata Panggung') {
      return targetRole === 'Anggota Tata Panggung' || targetRole === 'Sutradara';
    }

    // ============================================
    // KOORDINATOR TATA BUSANA
    // Menilai: Anggota Busana + Sutradara
    // ============================================
    if (myRole === 'Koordinator Tata Busana') {
      return targetRole === 'Anggota Tata Busana' || targetRole === 'Sutradara';
    }

    // ============================================
    // KOORDINATOR TATA RIAS
    // Menilai: Anggota Rias + Sutradara
    // ============================================
    if (myRole === 'Koordinator Tata Rias') {
      return targetRole === 'Anggota Tata Rias' || targetRole === 'Sutradara';
    }

    // ============================================
    // KOORDINATOR TATA MUSIK
    // Menilai: Anggota Musik + Sutradara
    // ============================================
    if (myRole === 'Koordinator Tata Musik') {
      return targetRole === 'Anggota Tata Musik' || targetRole === 'Sutradara';
    }

    // ============================================
    // ANGGOTA (semua divisi)
    // Menilai: Koordinator divisinya sendiri + Rekan satu divisi
    // ============================================
    if (myRole.startsWith('Anggota ')) {
      const myDivision = user.divisionName || '';
      const targetDivision = target.divisionName || '';

      // Harus satu divisi
      if (!myDivision || targetDivision !== myDivision) return false;

      // Koordinator divisinya atau sesama anggota
      const isMyCoordinator = targetRole.startsWith('Koordinator ');
      const isMyFellowMember = targetRole.startsWith('Anggota ');

      return isMyCoordinator || isMyFellowMember;
    }

    // ============================================
    // PEMAIN
    // Menilai: Sutradara + Asisten Sutradara
    // ============================================
    if (myRole === 'Pemain') {
      return targetRole === 'Sutradara' || targetRole === 'Asisten Sutradara';
    }

    // Default: tidak bisa menilai
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
