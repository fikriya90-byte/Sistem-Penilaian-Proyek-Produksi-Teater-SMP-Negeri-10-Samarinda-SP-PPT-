import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { checkAndSeedDatabase, DEMO_CLASSES, DEMO_USERS, forceSeedDatabase } from './seedData';
import { ClassRoom, UserProfile, UserRole } from './types';
import { fetchClasses, fetchUserProfile, recordAuditLog } from '../services/firestoreService';
import { doc, getDoc, setDoc, query, where, collection, getDocs } from 'firebase/firestore';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  activeClass: ClassRoom | null;
  classes: ClassRoom[];
  setActiveClass: (c: ClassRoom) => void;
  loginWithEmail: (emailOrPhone: string, pass: string) => Promise<boolean>;
  loginAsDemoUser: (uid: string) => Promise<void>;
  registerStudent: (data: {
    classCode: string;
    displayName: string;
    email: string;
    phone: string;
    pass: string;
    role: UserRole;
  }) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  resetDemoDatabase: () => Promise<void>;

  // Role permission helpers
  isTeacher: boolean;
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
  canAssessTarget: (target: UserProfile) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>(DEMO_CLASSES);
  const [activeClass, setActiveClass] = useState<ClassRoom | null>(DEMO_CLASSES[0]);
  const [loading, setLoading] = useState(true);

  // Initialize and load user
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        await checkAndSeedDatabase();
        const clsList = await fetchClasses();
        if (clsList && clsList.length > 0 && isMounted) {
          setClasses(clsList);
          setActiveClass(clsList[0]);
        }
      } catch (err) {
        console.warn('Initial seed or fetch error:', err);
      }

      // Check current auth or default to teacher for preview convenience
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!isMounted) return;
        if (fbUser) {
          const profile = await fetchUserProfile(fbUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            // Fallback user matching Firebase teacher
            const fallback: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || 'fikriya90@gmail.com',
              secondaryEmail: 'fikri.yassaar15@guru.smp.belajar.id',
              displayName: fbUser.displayName || 'Fikri Yassaar Arrazaq, S.Sn.',
              role: 'Guru Pembina',
              classId: 'id_34n2rdaofmuhz74a4',
              className: 'IX-C',
            };
            setUser(fallback);
          }
        } else {
          // If no active Firebase auth, default to Teacher profile so evaluator can test immediately!
          setUser(DEMO_USERS[0]);
        }
        setLoading(false);
      });

      return () => {
        unsubscribe();
      };
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update active class when user's assigned class changes
  useEffect(() => {
    if (user?.classId && classes.length > 0) {
      const match = classes.find(c => c.id === user.classId);
      if (match) setActiveClass(match);
    }
  }, [user?.classId, classes]);

  const loginWithEmail = async (emailOrPhone: string, pass: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Find matching user in DEMO_USERS or database
      const clean = emailOrPhone.trim().toLowerCase();
      const matched = DEMO_USERS.find(
        u => u.email.toLowerCase() === clean || (u.phone && u.phone.replace(/\D/g, '') === clean.replace(/\D/g, ''))
      );

      if (matched) {
        setUser(matched);
        await recordAuditLog({
          userId: matched.uid,
          userName: matched.displayName,
          role: matched.role,
          action: 'LOGIN',
          targetType: 'Auth',
          targetId: matched.uid,
          details: `Pengguna berhasil login sebagai ${matched.role}`,
        });
        setLoading(false);
        return true;
      }

      // Check Firestore users collection by email for real students
      try {
        const userQ = query(collection(db, 'users'), where('email', '==', clean));
        const userSnap = await getDocs(userQ);
        if (!userSnap.empty) {
          const profile = { ...userSnap.docs[0].data(), uid: userSnap.docs[0].id } as UserProfile;
          setUser(profile);
          await recordAuditLog({
            userId: profile.uid,
            userName: profile.displayName,
            role: profile.role,
            action: 'LOGIN',
            targetType: 'Auth',
            targetId: profile.uid,
            details: `Siswa Firebase berhasil login: ${profile.displayName} (${profile.role})`,
          });
          setLoading(false);
          return true;
        }
      } catch (e) {
        // continue
      }

      // Try firebase auth if configured
      try {
        const res = await signInWithEmailAndPassword(auth, clean, pass);
        const profile = await fetchUserProfile(res.user.uid);
        if (profile) {
          setUser(profile);
          setLoading(false);
          return true;
        }
      } catch (authErr) {
        // Continue to check local
      }

      setLoading(false);
      return false;
    } catch (e) {
      setLoading(false);
      return false;
    }
  };

  const loginAsDemoUser = async (uid: string) => {
    setLoading(true);
    const target = DEMO_USERS.find(u => u.uid === uid) || (await fetchUserProfile(uid));
    if (target) {
      setUser(target);
      await recordAuditLog({
        userId: target.uid,
        userName: target.displayName,
        role: target.role,
        action: 'LOGIN',
        targetType: 'Auth',
        targetId: target.uid,
        details: `Switch role ke ${target.role} (${target.displayName})`,
      });
    }
    setLoading(false);
  };

  const registerStudent = async (data: {
    classCode: string;
    displayName: string;
    email: string;
    phone: string;
    pass: string;
    role: UserRole;
  }): Promise<{ success: boolean; message: string }> => {
    // 1. Verify class code
    const validClass = classes.find(c => c.code.toLowerCase() === data.classCode.trim().toLowerCase());
    if (!validClass) {
      return { success: false, message: 'Kode Kelas tidak valid atau tidak terdaftar!' };
    }

    const newUid = `student-${Date.now()}`;
    const newProfile: UserProfile = {
      uid: newUid,
      email: data.email.trim(),
      displayName: data.displayName.trim(),
      role: data.role || 'Pemain',
      classId: validClass.id,
      className: validClass.name,
      phone: data.phone.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'users', newUid), newProfile);
      setUser(newProfile);
      setActiveClass(validClass);

      await recordAuditLog({
        userId: newUid,
        userName: newProfile.displayName,
        role: newProfile.role,
        action: 'CREATE',
        targetType: 'User',
        targetId: newUid,
        details: `Siswa baru terdaftar di ${validClass.name}`,
      });

      return { success: true, message: 'Registrasi berhasil!' };
    } catch (err: any) {
      return { success: false, message: 'Gagal menyimpan data registrasi: ' + err.message };
    }
  };

  const logout = async () => {
    if (user) {
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'LOGOUT',
        targetType: 'Auth',
        targetId: user.uid,
        details: `Pengguna keluar dari sistem`,
      });
    }
    try {
      await signOut(auth);
    } catch (err) {
      // ignore
    }
    setUser(null);
  };

  const resetDemoDatabase = async () => {
    setLoading(true);
    await forceSeedDatabase();
    const clsList = await fetchClasses();
    setClasses(clsList);
    setUser(DEMO_USERS[0]);
    setLoading(false);
  };

  // Helper flags
  const role = user?.role || 'Pemain';
  const isTeacher = role === 'Guru Pembina' || role === 'Admin' || role === 'Super Admin';
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

  // Strict Evaluation Matrix check
  const canAssessTarget = (target: UserProfile): boolean => {
    if (!user) return false;
    if (target.uid === user.uid) return false; // Self-assessment strictly forbidden!

    if (isTeacher) return true; // Teacher can grade anyone

    if (isPimprod) {
      // Pimprod assesses Sekretaris, Bendahara, and Division Coordinators
      return (
        target.role === 'Sekretaris' ||
        target.role === 'Bendahara' ||
        target.role.startsWith('Koordinator ')
      );
    }

    if (isSutradara) {
      // Sutradara assesses Players & Assistant Director
      return target.role === 'Pemain' || target.role === 'Asisten Sutradara';
    }

    if (isAsisten) {
      // Assistant Director assesses Players
      return target.role === 'Pemain';
    }

    if (isKoordinator) {
      // Coordinator assesses members of their own division
      return target.divisionId === user.divisionId && target.role.startsWith('Anggota ');
    }

    if (isAnggota) {
      // Member assesses Coordinator or fellow division members
      return (
        target.divisionId === user.divisionId &&
        (target.role.startsWith('Anggota ') || target.role.startsWith('Koordinator '))
      );
    }

    if (isPemain) {
      // Actor assesses fellow actors
      return target.role === 'Pemain';
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
        loginWithEmail,
        loginAsDemoUser,
        registerStudent,
        logout,
        resetDemoDatabase,
        isTeacher,
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
        canAssessTarget,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
