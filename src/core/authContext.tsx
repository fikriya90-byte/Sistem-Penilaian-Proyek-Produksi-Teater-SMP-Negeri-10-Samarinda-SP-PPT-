// src/core/authContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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
import {
  TEACHER_INVITE_CODE,
  getDivisionFromRole,
  normalizeUserRole,
  getAssessmentMatrix,
} from './constants';

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
    teacherClassIds?: string[];   // ← BARU: untuk guru multi-kelas
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
  isPemeran: boolean;
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

const ACTIVE_CLASS_KEY = (uid: string) => `spppt-active-class-${uid}`;

// 🔧 Helper: pastikan profile punya divisionId & divisionName
async function autoFillDivision(profile: UserProfile): Promise<UserProfile> {
  if (profile.divisionName && profile.divisionId) return profile;

  try {
    const division = getDivisionFromRole(profile.role);
    if (division && division.id) {
      const fixed: UserProfile = {
        ...profile,
        divisionId: profile.divisionId || division.id,
        divisionName: profile.divisionName || division.name,
      };

      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          divisionId: fixed.divisionId,
          divisionName: fixed.divisionName,
          updatedAt: new Date().toISOString(),
        });
      } catch { /* ignore */ }

      return fixed;
    }
  } catch { /* ignore */ }

  return profile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [activeClass, _setActiveClass] = useState<ClassRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const restoreClassRef = useRef(false);

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

      const safetyTimer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 6000);

      if (fbUser) {
        try {
          const profile = await fetchUserProfile(fbUser.uid);
          if (!isMounted) { clearTimeout(safetyTimer); return; }

          if (profile) {
            const fixedProfile = await autoFillDivision(profile);
            if (!isMounted) { clearTimeout(safetyTimer); return; }
            setUser(fixedProfile);
          } else {
            console.warn('Profil tidak ditemukan untuk UID:', fbUser.uid);
            try { await signOut(auth); } catch { /* ignore */ }
            setUser(null);
            _setActiveClass(null);
          }
        } catch (err) {
          console.warn('Fetch profile error:', err);
          try { await signOut(auth); } catch { /* ignore */ }
          setUser(null);
          _setActiveClass(null);
        }
      } else {
        setUser(null);
        _setActiveClass(null);
      }

      clearTimeout(safetyTimer);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    restoreClassRef.current = false;
  }, [user?.uid]);

  // Auto-set active class
  useEffect(() => {
    if (!user || classes.length === 0) return;
    if (restoreClassRef.current) return;

    const isTeacherRole =
      user.role === 'Guru Pengampu' ||
      user.role === 'Admin' ||
      user.role === 'Super Admin';

    // 1. Saved class di localStorage
    let savedId: string | null = null;
    try { savedId = localStorage.getItem(ACTIVE_CLASS_KEY(user.uid)); } catch { /* ignore */ }

    if (savedId) {
      const match = classes.find(c => c.id === savedId);
      const userClassIds = Array.isArray(user.classIds) && user.classIds.length > 0
        ? user.classIds
        : (user.classId ? [user.classId] : []);
      const hasAccess = isTeacherRole || match?.id === user.classId || userClassIds.includes(match?.id || '');

      if (match && hasAccess) {
        _setActiveClass(match);
        restoreClassRef.current = true;
        return;
      }
      try { localStorage.removeItem(ACTIVE_CLASS_KEY(user.uid)); } catch { /* ignore */ }
    }

    // 2. Match by user.classId (primary)
    if (!isTeacherRole && user.classId) {
      const match = classes.find(c => c.id === user.classId);
      if (match) {
        _setActiveClass(match);
        restoreClassRef.current = true;
        return;
      }

      // 3. Fallback: match by user.className
      if (user.className) {
        const matchByName = classes.find(c =>
          (c.name || '').toLowerCase().trim() === (user.className || '').toLowerCase().trim()
        );
        if (matchByName) {
          _setActiveClass(matchByName);
          restoreClassRef.current = true;
          return;
        }
      }
    }

    // 4. Guru multi-kelas: pakai kelas pertama dari classIds
    if (isTeacherRole) {
      const userClassIds = Array.isArray(user.classIds) && user.classIds.length > 0
        ? user.classIds
        : (user.classId ? [user.classId] : []);
      if (userClassIds.length > 0) {
        const firstMatch = classes.find(c => userClassIds.includes(c.id));
        if (firstMatch) {
          _setActiveClass(firstMatch);
          restoreClassRef.current = true;
          return;
        }
      }
    }

    restoreClassRef.current = true;
  }, [user, classes]);

  const setActiveClass = useCallback((c: ClassRoom | null) => {
    _setActiveClass(c);
    if (user?.uid) {
      try {
        if (c) localStorage.setItem(ACTIVE_CLASS_KEY(user.uid), c.id);
        else localStorage.removeItem(ACTIVE_CLASS_KEY(user.uid));
      } catch { /* ignore */ }
    }
  }, [user?.uid]);

  const reloadClasses = async () => {
    const clsList = await fetchClasses();
    setClasses(clsList);
    if (activeClass) {
      const refreshed = clsList.find(c => c.id === activeClass.id);
      if (refreshed) _setActiveClass(refreshed);
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

      profile = await autoFillDivision(profile);

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

  // =====================================================
  // ✅ REGISTER USER — WA wajib untuk semua (termasuk Guru)
  // Guru support multi-kelas via teacherClassIds
  // =====================================================
  const registerUser = async (data: {
    classCode: string;
    displayName: string;
    email: string;
    phone: string;
    pass: string;
    role: UserRole;
    isTeacherRegistration?: boolean;
    teacherClassIds?: string[];
  }): Promise<{ success: boolean; message: string }> => {
    const isTeacherReg = !!data.isTeacherRegistration &&
      data.classCode.trim().toUpperCase() === TEACHER_INVITE_CODE.toUpperCase();

    // ✅ WAJIB: Nomor WhatsApp untuk SEMUA role (guru & siswa)
    const cleanPhone = (data.phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      return {
        success: false,
        message: isTeacherReg
          ? 'Nomor WhatsApp WAJIB diisi dengan format valid (9-15 digit). Guru akan menerima notifikasi booking via WA ini.'
          : 'Nomor WhatsApp wajib diisi dengan format valid (9-15 digit).',
      };
    }

    // Tentukan kelas
    let validClass: ClassRoom | undefined;
    let teacherClassIds: string[] = [];

    if (isTeacherReg) {
      // Guru: pakai teacherClassIds jika ada, fallback ke classes[0]
      const requestedIds = Array.isArray(data.teacherClassIds) && data.teacherClassIds.length > 0
        ? data.teacherClassIds
        : (classes.length > 0 ? [classes[0].id] : []);

      if (requestedIds.length === 0) {
        return { success: false, message: 'Tidak ada kelas tersedia. Hubungi Admin untuk membuat kelas terlebih dahulu.' };
      }

      // Validasi bahwa kelas yang dipilih ada
      const validClasses = requestedIds
        .map(id => classes.find(c => c.id === id))
        .filter((c): c is ClassRoom => !!c);

      if (validClasses.length === 0) {
        return { success: false, message: 'Kelas yang dipilih tidak ditemukan. Hubungi Admin.' };
      }

      teacherClassIds = validClasses.map(c => c.id);
      validClass = validClasses[0]; // primary class
    } else {
      // Siswa: cari kelas via kode kelas
      validClass = classes.find(c => c.code.toLowerCase() === data.classCode.trim().toLowerCase());
      if (!validClass) {
        return {
          success: false,
          message: 'Kode Kelas tidak valid / belum terdaftar. Tanyakan ke Guru Pengampu.',
        };
      }
    }

    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, data.pass);
      try {
        await updateProfile(res.user, { displayName: data.displayName.trim() });
      } catch (_) { /* non-fatal */ }

      const division = isTeacherReg ? null : getDivisionFromRole(data.role || 'Pemeran');

      const newProfile: UserProfile = {
        uid: res.user.uid,
        email: cleanEmail,
        displayName: data.displayName.trim(),
        role: isTeacherReg ? 'Guru Pengampu' : (data.role || 'Pemeran'),
        classId: validClass.id,
        classIds: isTeacherReg ? teacherClassIds : [validClass.id],
        className: validClass.name,
        phone: data.phone.trim(),
        divisionId: division?.id,
        divisionName: division?.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', res.user.uid), newProfile);

      // ✅ Update teacherId di setiap kelas yang diampu guru
      if (isTeacherReg && teacherClassIds.length > 0) {
        for (const cid of teacherClassIds) {
          try {
            await updateDoc(doc(db, 'classes', cid), {
              teacherId: res.user.uid,
              teacherName: data.displayName.trim(),
              updatedAt: new Date().toISOString(),
            });
          } catch { /* non-fatal */ }
        }
      }

      if (!isTeacherReg) {
        try {
          await setDoc(doc(db, 'userCredentials', res.user.uid), {
            uid: res.user.uid,
            email: cleanEmail,
            password: data.pass,
            displayName: data.displayName.trim(),
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('Gagal simpan credentials:', err);
        }

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
          ? `Guru baru terdaftar: ${newProfile.displayName} (${teacherClassIds.length} kelas)`
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

      return {
        success: true,
        message: isTeacherReg
          ? `Registrasi guru berhasil! Anda mengampu ${teacherClassIds.length} kelas.`
          : 'Registrasi berhasil! Akun Anda siap digunakan.',
      };
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
      try { localStorage.removeItem(ACTIVE_CLASS_KEY(user.uid)); } catch { /* ignore */ }
    }
    try { await signOut(auth); } catch (_) { /* ignore */ }
    setUser(null);
    _setActiveClass(null);
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
      _setActiveClass({ ...activeClass, kerabatKerja: newName.trim() });
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
    _setActiveClass(null);
    setUser(null);
    setLoading(false);
  };

  const role = user?.role || 'Pemeran';
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
  const isPemeran = role === 'Pemeran';

  const canEditKerabatKerja = isTeacher || isPimprod;

  const canCreateGeneralAttendance = isTeacher || isPimprod || isSekretaris;
  const canCreateRehearsalAttendance = isTeacher || isSutradara || isAsisten;
  const canCreateDivisionAttendance = isTeacher || isKoordinator;
  const canCreateGeneralSchedule = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten;
  const canCreateInternalSchedule = isTeacher || isKoordinator;
  const canCreateTask = isTeacher || isPimprod || isSutradara || isKoordinator;
  const canCreateDeadline = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator;
  const canCreateBroadcast = isTeacher || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator || isBendahara;

  const canAssessTarget = (target: UserProfile): boolean => {
    if (!user) return false;
    if (target.uid === user.uid) return false;

    if (isGuruPengampu || isAdminRole) return true;

    const targetRole = normalizeUserRole(target.role);
    const matrix = getAssessmentMatrix(targetRole);

    return matrix.some(rel => rel.roles.includes(user.role));
  };

  return (
    <AuthContext.Provider
      value={{
        user, loading, activeClass, classes,
        setActiveClass, reloadClasses, loginWithEmail, registerUser, logout,
        resetDemoDatabase, updateKerabatKerja,
        isTeacher, isGuruPengampu, isAdminRole, isPimprod, isSekretaris, isBendahara,
        isSutradara, isAsisten, isKoordinator, isAnggota, isPemeran, canEditKerabatKerja,
        canCreateGeneralAttendance, canCreateRehearsalAttendance, canCreateDivisionAttendance,
        canCreateGeneralSchedule, canCreateInternalSchedule, canCreateTask,
        canCreateDeadline, canCreateBroadcast, canAssessTarget,
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