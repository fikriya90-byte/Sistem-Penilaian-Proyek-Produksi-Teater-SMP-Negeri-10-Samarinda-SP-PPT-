// src/components/modules/ManageStudentModule.tsx
import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Search, RefreshCw, Trash2, X,
  Save, UserCog, Camera, TrendingUp, ArrowLeft, AlertTriangle,
  Mail, Phone, Send, Eye, EyeOff, KeyRound, Copy, Check, Shield,
  Lock, Unlock, User as UserIcon, Users, Crown, Drama, Wallet,
  Film, LayoutGrid, ChevronDown, Package, Palette, Scissors, Music,
  Layers, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { UserProfile, UserRole, DeadlineItem, DeadlineSubmission } from '../../core/types';
import {
  doc, collection, updateDoc, deleteDoc, query, where, onSnapshot, setDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { getDivisionFromRole } from '../../core/constants';
import { PhotoUploadModal } from '../common/PhotoUploadModal';
import { resetStudentPassword, getUserCredentials } from '../../services/adminService';

interface ManageStudentModuleProps {
  onNavigate?: (m: string) => void;
}

// ✅ BARU: Role groups dengan icon (tanpa emoji)
const ROLE_GROUPS: {
  label: string;
  icon: any;
  roles: { value: UserRole; icon: any }[];
}[] = [
  {
    label: 'Pengurus Inti',
    icon: Crown,
    roles: [
      { value: 'Pimpinan Produksi', icon: Crown },
      { value: 'Sekretaris', icon: FileTextIcon },
      { value: 'Bendahara', icon: Wallet },
    ],
  },
  {
    label: 'Pemeran & Penyutradaraan',
    icon: Drama,
    roles: [
      { value: 'Sutradara', icon: Film },
      { value: 'Asisten Sutradara', icon: Sparkles },
      { value: 'Pemeran', icon: Drama },
    ],
  },
  {
    label: 'Koordinator Divisi',
    icon: LayoutGrid,
    roles: [
      { value: 'Koordinator Perlengkapan', icon: Package },
      { value: 'Koordinator Publikasi', icon: Camera },
      { value: 'Koordinator Tata Panggung', icon: Layers },
      { value: 'Koordinator Tata Rias', icon: Palette },
      { value: 'Koordinator Tata Busana', icon: Scissors },
      { value: 'Koordinator Tata Musik', icon: Music },
    ],
  },
  {
    label: 'Anggota Divisi',
    icon: Users,
    roles: [
      { value: 'Anggota Perlengkapan', icon: Package },
      { value: 'Anggota Publikasi', icon: Camera },
      { value: 'Anggota Tata Panggung', icon: Layers },
      { value: 'Anggota Tata Rias', icon: Palette },
      { value: 'Anggota Tata Busana', icon: Scissors },
      { value: 'Anggota Tata Musik', icon: Music },
    ],
  },
];

// Alias untuk FileText (karena sudah import FileText? tidak, buat komponen dummy)
function FileTextIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

interface CredentialModalState {
  open: boolean;
  student: UserProfile | null;
  loading: boolean;
  success: boolean;
  email?: string;
  password?: string;
  displayName?: string;
  message?: string;
}

export const ManageStudentModule: React.FC<ManageStudentModuleProps> = ({ onNavigate }) => {
  const { user, activeClass, classes } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [photoModalStudent, setPhotoModalStudent] = useState<UserProfile | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Pemeran');
  const [editEmail, setEditEmail] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingStudent, setDeletingStudent] = useState(false);

  const [credModal, setCredModal] = useState<CredentialModalState>({
    open: false,
    student: null,
    loading: false,
    success: false,
  });
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);

  useEffect(() => {
    if (activeClass) loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass?.id]);

  useEffect(() => {
    if (!activeClass) return;

    const q1 = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
    const unsub1 = onSnapshot(q1, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as DeadlineItem));
      setDeadlines(list.filter(d => (d as any).status !== 'CANCELLED'));
    });

    const q2 = query(collection(db, 'deadlineSubmissions'), where('classId', '==', activeClass.id));
    const unsub2 = onSnapshot(q2, snap => {
      setSubmissions(snap.docs.map(d => ({ ...d.data(), id: d.id } as DeadlineSubmission)));
    });

    return () => { unsub1(); unsub2(); };
  }, [activeClass]);

  const loadStudents = async () => {
    if (!activeClass) return;
    setLoading(true);
    try {
      const list = await fetchUsersByClass(activeClass.id);
      const filtered = list.filter(u =>
        u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
      );
      setStudents(filtered);
    } catch (err) {
      console.warn('Load students error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isDeadlineForUser = (d: DeadlineItem, u: UserProfile): boolean => {
    const scope = d.targetScope as string;
    const targetUserIds: string[] = (d as any).targetUserIds || [];
    const targetRoles: string[] = (d as any).targetRoles || [];
    const targetDivisions: string[] = (d as any).targetDivisions || [];

    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return (d as any).targetRole === u.role;
    if (scope === 'DIVISI') return (d as any).targetDivision === u.divisionName;
    if (scope === 'CUSTOM') {
      if (targetRoles.length > 0 && targetRoles.includes(u.role)) return true;
      if (targetDivisions.length > 0 && u.divisionName && targetDivisions.includes(u.divisionName)) return true;
      if (targetUserIds.length === 0) return true;
      return targetUserIds.includes(u.uid);
    }
    return false;
  };

  const isSubmissionDone = (sub?: DeadlineSubmission): boolean => {
    if (!sub) return false;
    return sub.status === 'SELESAI' || sub.status === 'TERLAMBAT';
  };

  const getStudentProgress = (s: UserProfile) => {
    const myDeadlines = deadlines.filter(d => isDeadlineForUser(d, s));
    const completed = myDeadlines.filter(d => {
      const sub = submissions.find(x => x.deadlineId === d.id && x.studentId === s.uid);
      return isSubmissionDone(sub);
    }).length;
    const total = myDeadlines.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, pct };
  };

  const classStats = (() => {
    if (students.length === 0) return { avg: 0, mahir: 0, tertinggal: 0, belum: 0 };
    const stats = students.map(getStudentProgress);
    const avg = Math.round(stats.reduce((s, x) => s + x.pct, 0) / stats.length);
    const mahir = stats.filter(x => x.pct >= 80).length;
    const tertinggal = stats.filter(x => x.pct > 0 && x.pct < 50).length;
    const belum = stats.filter(x => x.pct === 0).length;
    return { avg, mahir, tertinggal, belum };
  })();

  const openEditStudent = (s: UserProfile) => {
    setSelectedStudent(s);
    setEditName(s.displayName || '');
    setEditPhone(s.phone || '');
    setEditRole((s.role as UserRole) || 'Pemeran');
    setEditEmail(s.email || '');
    setEditClassId(s.classId || '');
    setIsEditOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;

    const emailChanged = editEmail.trim().toLowerCase() !== (selectedStudent.email || '').toLowerCase();
    if (emailChanged && !editEmail.includes('@')) {
      showToast('Format email tidak valid.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const division = getDivisionFromRole(editRole);
      const updateData: any = {
        displayName: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        divisionId: division.id,
        divisionName: division.name,
        updatedAt: new Date().toISOString(),
      };

      if (emailChanged) updateData.email = editEmail.trim().toLowerCase();

      if (user.role === 'Guru Pengampu' && editClassId && editClassId !== selectedStudent.classId) {
        const targetClass = classes.find(c => c.id === editClassId);
        if (targetClass) {
          const userClassIds = Array.isArray(user.classIds) && user.classIds.length > 0
            ? user.classIds
            : (user.classId ? [user.classId] : []);
          if (!userClassIds.includes(targetClass.id)) {
            showToast(`Anda tidak mengampu kelas ${targetClass.name}.`, 'error');
            setSubmitting(false);
            return;
          }

          updateData.classId = editClassId;
          updateData.className = targetClass.name;

          try {
            await updateDoc(doc(db, 'userCredentials', selectedStudent.uid), {
              classId: editClassId,
              className: targetClass.name,
            });
          } catch { /* non-fatal */ }
        }
      }

      await updateDoc(doc(db, 'users', selectedStudent.uid), updateData);

      if (emailChanged) {
        try {
          await updateDoc(doc(db, 'userCredentials', selectedStudent.uid), {
            email: editEmail.trim().toLowerCase(),
          });
        } catch { /* non-fatal */ }
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'User', targetId: selectedStudent.uid,
        details: `Edit siswa: ${editName} → role: ${editRole}${editClassId !== selectedStudent.classId ? ` → pindah kelas: ${classes.find(c => c.id === editClassId)?.name || editClassId}` : ''}`,
      });

      showToast(`Data ${editName} berhasil diperbarui!`, 'success');
      setIsEditOpen(false);
      setSelectedStudent(null);
      loadStudents();
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSubmitting(false); }
  };

  const handleSaveStudentPhoto = async (photoUrl: string) => {
    if (!photoModalStudent) return;
    try {
      await updateDoc(doc(db, 'users', photoModalStudent.uid), {
        photoURL: photoUrl,
        updatedAt: new Date().toISOString(),
      });
      showToast('Foto siswa diperbarui!', 'success');
      setPhotoModalStudent(null);
      loadStudents();
    } catch (err: any) {
      showToast('Gagal simpan foto: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleDeleteStudent = (s: UserProfile) => {
    setSelectedStudent(s);
    setDeleteConfirmText('');
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!selectedStudent || !user) return;

    if (deleteConfirmText.trim().toLowerCase() !== selectedStudent.displayName.trim().toLowerCase()) {
      showToast('Nama tidak cocok.', 'error');
      return;
    }

    setDeletingStudent(true);
    try {
      await deleteDoc(doc(db, 'users', selectedStudent.uid));
      try { await deleteDoc(doc(db, 'userCredentials', selectedStudent.uid)); } catch { /* ignore */ }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'User', targetId: selectedStudent.uid,
        details: `Hapus profil siswa: ${selectedStudent.displayName}`,
      });

      showToast(`Profil ${selectedStudent.displayName} dihapus.`, 'info');
      setShowDeleteConfirm(false);
      setSelectedStudent(null);
      setDeleteConfirmText('');
      loadStudents();
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleResetPassword = async (s: UserProfile) => {
    if (!confirm(`Kirim link reset password ke ${s.displayName}?\n\nEmail: ${s.email}`)) return;

    setResettingId(s.uid);
    try {
      const res = await resetStudentPassword(s.email);
      if (res.success) {
        showToast(res.message, 'success');
        try {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: s.uid,
            classId: activeClass?.id || '',
            title: 'Reset Password Dikirim',   // ✅ tanpa emoji
            message: `Guru mengirim link reset password ke email ${s.email}.`,
            category: 'Sistem',
            read: false,
            link: 'pengaturan',
            createdAt: new Date().toISOString(),
          });
        } catch { /* non-fatal */ }
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setResettingId(null);
    }
  };

  const handleViewCredentials = async (s: UserProfile) => {
    setCredModal({ open: true, student: s, loading: true, success: false });
    setShowPasswordInModal(false);
    setCopiedField(null);

    try {
      const res = await getUserCredentials(s.uid);
      if (res.success) {
        setCredModal({
          open: true,
          student: s,
          loading: false,
          success: true,
          email: res.email || s.email,
          password: res.password,
          displayName: res.displayName || s.displayName,
        });

        if (user) {
          try {
            await recordAuditLog({
              userId: user.uid, userName: user.displayName, role: user.role,
              action: 'UPDATE', targetType: 'ViewCredentials', targetId: s.uid,
              details: `Lihat kredensial siswa: ${s.displayName}`,
            });
          } catch { /* non-fatal */ }
        }
      } else {
        setCredModal({
          open: true,
          student: s,
          loading: false,
          success: false,
          message: res.message || 'Kredensial tidak tersedia untuk siswa ini.',
        });
      }
    } catch (err: any) {
      setCredModal({
        open: true,
        student: s,
        loading: false,
        success: false,
        message: err?.message || 'Gagal memuat kredensial.',
      });
    }
  };

  const closeCredModal = () => {
    setCredModal({ open: false, student: null, loading: false, success: false });
    setShowPasswordInModal(false);
    setCopiedField(null);
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast(`${field} disalin ke clipboard.`, 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast('Gagal menyalin.', 'error');
    }
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.displayName || '').toLowerCase().includes(q) ||
           (s.email || '').toLowerCase().includes(q) ||
           (s.role || '').toLowerCase().includes(q) ||
           (s.phone || '').includes(q);
  });

  const myClassIds = Array.isArray(user?.classIds) && user.classIds.length > 0
    ? user.classIds
    : (user?.classId ? [user.classId] : []);

  const myClasses = classes.filter(c => myClassIds.includes(c.id));

  // ✅ Helper: cari icon untuk role tertentu
  const getRoleIcon = (role: string): any => {
    for (const group of ROLE_GROUPS) {
      const found = group.roles.find(r => r.value === role);
      if (found) return found.icon;
    }
    return UserIcon;
  };

  if (!activeClass) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Pilih Kelas Dulu</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Kembali ke beranda dan masuk ke kelas untuk mengelola siswa.
        </p>
      </div>
    );
  }

  const CurrentRoleIcon = getRoleIcon(editRole);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 shrink-0">
              <GraduationCap className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Kelola Siswa — Kelas {activeClass.name}
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                {activeClass.name}: {students.length} Siswa
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Progress real-time dari Tugas & Deadline. Klik nama untuk detail.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate?.('dashboard')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard Kelas
            </button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-700 text-white shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Rata-rata</span>
          </div>
          <p className="text-2xl font-black">{classStats.avg}%</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Mahir (&ge;80%)</p>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{classStats.mahir}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Tertinggal (&lt;50%)</p>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-200">{classStats.tertinggal}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300">Belum Mulai</p>
          <p className="text-2xl font-black text-rose-800 dark:text-rose-200">{classStats.belum}</p>
        </div>
      </div>

      {/* SEARCH */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari nama, email, atau role siswa..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
        <button onClick={loadStudents} disabled={loading}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
          {filteredStudents.length} siswa
        </span>
      </div>

      {/* TABEL SISWA */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          Memuat data siswa...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
            {searchQuery ? 'Tidak Ada Hasil' : 'Belum Ada Siswa'}
          </h3>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Nama</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Divisi</th>
                  <th className="py-3.5 px-4 text-center">Progress</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredStudents.map(s => {
                  const prog = getStudentProgress(s);
                  const isResetting = resettingId === s.uid;
                  return (
                    <tr key={s.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            {s.photoURL ? (
                              <img src={s.photoURL} alt={s.displayName}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                {(s.displayName || s.email || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <button onClick={() => setPhotoModalStudent(s)}
                              className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                              title="Ganti foto">
                              <Camera className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">{s.displayName || '(Tanpa Nama)'}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-mono text-[11px]">{s.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40">
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">{s.divisionName || '-'}</td>
                      <td className="py-3.5 px-4">
                        {prog.total === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">-</span>
                        ) : (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full ${
                                prog.pct >= 80 ? 'bg-emerald-500' :
                                prog.pct >= 50 ? 'bg-blue-500' :
                                prog.pct > 0 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} style={{ width: `${prog.pct}%` }} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {prog.completed}/{prog.total}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button onClick={() => handleViewCredentials(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 text-[11px] font-bold transition flex items-center gap-1"
                            title="Lihat Email & Password">
                            <KeyRound className="w-3 h-3" /> Lihat Pass
                          </button>

                          <button onClick={() => handleResetPassword(s)}
                            disabled={isResetting}
                            className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/40 text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50"
                            title="Kirim link reset password">
                            {isResetting ? (
                              <><RefreshCw className="w-3 h-3 animate-spin" /> ...</>
                            ) : (
                              <><Send className="w-3 h-3" /> Reset</>
                            )}
                          </button>

                          <button onClick={() => openEditStudent(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] font-bold transition flex items-center gap-1">
                            <UserCog className="w-3 h-3" /> Edit
                          </button>

                          <button onClick={() => handleDeleteStudent(s)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition"
                            title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL LIHAT PASSWORD */}
      {credModal.open && credModal.student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-purple-200 dark:border-purple-500/40 my-auto overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                    <KeyRound className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                      Kredensial Akun Siswa
                    </p>
                    <h3 className="text-base font-black mt-0.5">
                      {credModal.student.displayName}
                    </h3>
                  </div>
                </div>
                <button onClick={closeCredModal}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {credModal.loading ? (
                <div className="py-8 text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-500" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Memuat kredensial...</p>
                </div>
              ) : credModal.success ? (
                <>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                      <strong>Rahasia!</strong> Jangan bagikan kredensial ini ke orang lain.
                      Hanya untuk membantu siswa yang lupa password.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </p>
                      <button
                        onClick={() => handleCopy(credModal.email || '', 'Email')}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                        {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900 dark:text-white break-all">
                      {credModal.email}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-2 border-purple-200 dark:border-purple-500/40">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Password
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                          className="p-1 rounded-md text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition"
                          title={showPasswordInModal ? 'Sembunyikan' : 'Tampilkan'}>
                          {showPasswordInModal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopy(credModal.password || '', 'Password')}
                          className="p-1 rounded-md text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition">
                          {copiedField === 'Password' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-mono font-black text-purple-900 dark:text-purple-200 break-all">
                      {showPasswordInModal
                        ? credModal.password
                        : '•'.repeat(Math.min((credModal.password || '').length || 8, 20))
                      }
                    </p>
                    {!showPasswordInModal && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                        <EyeOff className="w-2.5 h-2.5" /> Klik ikon mata untuk menampilkan
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                      <strong>Saran:</strong> Minta siswa untuk mengganti password setelah login
                      pertama, agar lebih aman dan mudah diingat.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-200 dark:border-rose-500/40 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-500/20 border-2 border-rose-300 dark:border-rose-500/40 mb-3">
                      <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                    </div>
                    <p className="text-sm font-bold text-rose-900 dark:text-rose-200">
                      Kredensial Tidak Tersedia
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                      {credModal.message || 'Siswa ini mendaftar sebelum fitur kredensial aktif, atau kredensial sudah dihapus.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Alternatif:
                    </p>
                    <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pl-4 list-disc">
                      <li>Klik tombol <strong>Reset</strong> untuk kirim link reset password ke email siswa</li>
                      <li>Siswa buka email → klik link → buat password baru sendiri</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={closeCredModal}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT SISWA */}
      {isEditOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-500" /> Edit Siswa
              </h3>
              <button onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email Siswa
                </label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> No. WhatsApp
                </label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              {/* Selector kelas (guru multi-kelas) */}
              {user?.role === 'Guru Pengampu' && myClasses.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Kelas Siswa
                  </label>
                  <select
                    value={editClassId}
                    onChange={(e) => setEditClassId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                  >
                    {myClasses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.kerabatKerja ? `— ${c.kerabatKerja}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>Anda bisa memindahkan siswa ke kelas lain yang Anda ampu.</span>
                  </p>
                </div>
              )}

              {/* ✅ Role Picker — Custom Dropdown dengan Icon */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Role / Peran <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsRolePickerOpen(true)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-2 hover:border-amber-400 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CurrentRoleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{editRole}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ MODAL ROLE PICKER (Icons only, no emoji) */}
      {isRolePickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col overflow-hidden my-auto">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilih Role</h3>
              </div>
              <button onClick={() => setIsRolePickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {ROLE_GROUPS.map(group => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.label}>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                      <GroupIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.roles.map(r => {
                        const RoleIcon = r.icon;
                        const isSelected = editRole === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => {
                              setEditRole(r.value);
                              setIsRolePickerOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left transition flex items-center gap-2.5 ${
                              isSelected
                                ? 'bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40'
                                : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-300'
                            }`}
                          >
                            <RoleIcon className={`w-4 h-4 shrink-0 ${
                              isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                            }`} />
                            <span className={`text-xs font-bold flex-1 ${
                              isSelected ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {r.value}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HAPUS */}
      {showDeleteConfirm && selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-200 dark:border-rose-500/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-rose-900 dark:text-rose-300 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                Hapus Siswa?
              </h3>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 mb-3">
              <p className="text-xs text-rose-900 dark:text-rose-200 font-bold">
                Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>

            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Ketik nama siswa persis untuk konfirmasi:
            </label>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-2 text-xs font-mono text-slate-700 dark:text-slate-300 select-all">
              {selectedStudent.displayName}
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Ketik nama siswa di sini..."
              autoFocus
              className={`w-full px-3.5 py-2.5 rounded-xl border-2 font-semibold text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 transition ${
                deleteConfirmText.length === 0
                  ? 'border-slate-200 dark:border-slate-700'
                  : deleteConfirmText.trim().toLowerCase() === selectedStudent.displayName.trim().toLowerCase()
                  ? 'border-emerald-500'
                  : 'border-rose-300'
              }`}
            />

            <div className="flex gap-2 pt-4 mt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteStudent}
                disabled={deletingStudent || deleteConfirmText.trim().toLowerCase() !== selectedStudent.displayName.trim().toLowerCase()}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                {deletingStudent ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO MODAL */}
      {photoModalStudent && (
        <PhotoUploadModal
          currentPhotoUrl={photoModalStudent.photoURL}
          userName={photoModalStudent.displayName}
          onSave={handleSaveStudentPhoto}
          onClose={() => setPhotoModalStudent(null)}
        />
      )}
    </div>
  );
};// src/components/modules/ManageStudentModule.tsx
import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Search, RefreshCw, Trash2, X,
  Save, UserCog, Camera, TrendingUp, ArrowLeft, AlertTriangle,
  Mail, Phone, Send, Eye, EyeOff, KeyRound, Copy, Check, Shield,
  Lock, Unlock, User as UserIcon, Users, Crown, Drama, Wallet,
  Film, LayoutGrid, ChevronDown, Package, Palette, Scissors, Music,
  Layers, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { UserProfile, UserRole, DeadlineItem, DeadlineSubmission } from '../../core/types';
import {
  doc, collection, updateDoc, deleteDoc, query, where, onSnapshot, setDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { getDivisionFromRole } from '../../core/constants';
import { PhotoUploadModal } from '../common/PhotoUploadModal';
import { resetStudentPassword, getUserCredentials } from '../../services/adminService';

interface ManageStudentModuleProps {
  onNavigate?: (m: string) => void;
}

// ✅ BARU: Role groups dengan icon (tanpa emoji)
const ROLE_GROUPS: {
  label: string;
  icon: any;
  roles: { value: UserRole; icon: any }[];
}[] = [
  {
    label: 'Pengurus Inti',
    icon: Crown,
    roles: [
      { value: 'Pimpinan Produksi', icon: Crown },
      { value: 'Sekretaris', icon: FileTextIcon },
      { value: 'Bendahara', icon: Wallet },
    ],
  },
  {
    label: 'Pemeran & Penyutradaraan',
    icon: Drama,
    roles: [
      { value: 'Sutradara', icon: Film },
      { value: 'Asisten Sutradara', icon: Sparkles },
      { value: 'Pemeran', icon: Drama },
    ],
  },
  {
    label: 'Koordinator Divisi',
    icon: LayoutGrid,
    roles: [
      { value: 'Koordinator Perlengkapan', icon: Package },
      { value: 'Koordinator Publikasi', icon: Camera },
      { value: 'Koordinator Tata Panggung', icon: Layers },
      { value: 'Koordinator Tata Rias', icon: Palette },
      { value: 'Koordinator Tata Busana', icon: Scissors },
      { value: 'Koordinator Tata Musik', icon: Music },
    ],
  },
  {
    label: 'Anggota Divisi',
    icon: Users,
    roles: [
      { value: 'Anggota Perlengkapan', icon: Package },
      { value: 'Anggota Publikasi', icon: Camera },
      { value: 'Anggota Tata Panggung', icon: Layers },
      { value: 'Anggota Tata Rias', icon: Palette },
      { value: 'Anggota Tata Busana', icon: Scissors },
      { value: 'Anggota Tata Musik', icon: Music },
    ],
  },
];

// Alias untuk FileText (karena sudah import FileText? tidak, buat komponen dummy)
function FileTextIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

interface CredentialModalState {
  open: boolean;
  student: UserProfile | null;
  loading: boolean;
  success: boolean;
  email?: string;
  password?: string;
  displayName?: string;
  message?: string;
}

export const ManageStudentModule: React.FC<ManageStudentModuleProps> = ({ onNavigate }) => {
  const { user, activeClass, classes } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [photoModalStudent, setPhotoModalStudent] = useState<UserProfile | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Pemeran');
  const [editEmail, setEditEmail] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingStudent, setDeletingStudent] = useState(false);

  const [credModal, setCredModal] = useState<CredentialModalState>({
    open: false,
    student: null,
    loading: false,
    success: false,
  });
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);

  useEffect(() => {
    if (activeClass) loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass?.id]);

  useEffect(() => {
    if (!activeClass) return;

    const q1 = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
    const unsub1 = onSnapshot(q1, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as DeadlineItem));
      setDeadlines(list.filter(d => (d as any).status !== 'CANCELLED'));
    });

    const q2 = query(collection(db, 'deadlineSubmissions'), where('classId', '==', activeClass.id));
    const unsub2 = onSnapshot(q2, snap => {
      setSubmissions(snap.docs.map(d => ({ ...d.data(), id: d.id } as DeadlineSubmission)));
    });

    return () => { unsub1(); unsub2(); };
  }, [activeClass]);

  const loadStudents = async () => {
    if (!activeClass) return;
    setLoading(true);
    try {
      const list = await fetchUsersByClass(activeClass.id);
      const filtered = list.filter(u =>
        u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
      );
      setStudents(filtered);
    } catch (err) {
      console.warn('Load students error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isDeadlineForUser = (d: DeadlineItem, u: UserProfile): boolean => {
    const scope = d.targetScope as string;
    const targetUserIds: string[] = (d as any).targetUserIds || [];
    const targetRoles: string[] = (d as any).targetRoles || [];
    const targetDivisions: string[] = (d as any).targetDivisions || [];

    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return (d as any).targetRole === u.role;
    if (scope === 'DIVISI') return (d as any).targetDivision === u.divisionName;
    if (scope === 'CUSTOM') {
      if (targetRoles.length > 0 && targetRoles.includes(u.role)) return true;
      if (targetDivisions.length > 0 && u.divisionName && targetDivisions.includes(u.divisionName)) return true;
      if (targetUserIds.length === 0) return true;
      return targetUserIds.includes(u.uid);
    }
    return false;
  };

  const isSubmissionDone = (sub?: DeadlineSubmission): boolean => {
    if (!sub) return false;
    return sub.status === 'SELESAI' || sub.status === 'TERLAMBAT';
  };

  const getStudentProgress = (s: UserProfile) => {
    const myDeadlines = deadlines.filter(d => isDeadlineForUser(d, s));
    const completed = myDeadlines.filter(d => {
      const sub = submissions.find(x => x.deadlineId === d.id && x.studentId === s.uid);
      return isSubmissionDone(sub);
    }).length;
    const total = myDeadlines.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, pct };
  };

  const classStats = (() => {
    if (students.length === 0) return { avg: 0, mahir: 0, tertinggal: 0, belum: 0 };
    const stats = students.map(getStudentProgress);
    const avg = Math.round(stats.reduce((s, x) => s + x.pct, 0) / stats.length);
    const mahir = stats.filter(x => x.pct >= 80).length;
    const tertinggal = stats.filter(x => x.pct > 0 && x.pct < 50).length;
    const belum = stats.filter(x => x.pct === 0).length;
    return { avg, mahir, tertinggal, belum };
  })();

  const openEditStudent = (s: UserProfile) => {
    setSelectedStudent(s);
    setEditName(s.displayName || '');
    setEditPhone(s.phone || '');
    setEditRole((s.role as UserRole) || 'Pemeran');
    setEditEmail(s.email || '');
    setEditClassId(s.classId || '');
    setIsEditOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;

    const emailChanged = editEmail.trim().toLowerCase() !== (selectedStudent.email || '').toLowerCase();
    if (emailChanged && !editEmail.includes('@')) {
      showToast('Format email tidak valid.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const division = getDivisionFromRole(editRole);
      const updateData: any = {
        displayName: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        divisionId: division.id,
        divisionName: division.name,
        updatedAt: new Date().toISOString(),
      };

      if (emailChanged) updateData.email = editEmail.trim().toLowerCase();

      if (user.role === 'Guru Pengampu' && editClassId && editClassId !== selectedStudent.classId) {
        const targetClass = classes.find(c => c.id === editClassId);
        if (targetClass) {
          const userClassIds = Array.isArray(user.classIds) && user.classIds.length > 0
            ? user.classIds
            : (user.classId ? [user.classId] : []);
          if (!userClassIds.includes(targetClass.id)) {
            showToast(`Anda tidak mengampu kelas ${targetClass.name}.`, 'error');
            setSubmitting(false);
            return;
          }

          updateData.classId = editClassId;
          updateData.className = targetClass.name;

          try {
            await updateDoc(doc(db, 'userCredentials', selectedStudent.uid), {
              classId: editClassId,
              className: targetClass.name,
            });
          } catch { /* non-fatal */ }
        }
      }

      await updateDoc(doc(db, 'users', selectedStudent.uid), updateData);

      if (emailChanged) {
        try {
          await updateDoc(doc(db, 'userCredentials', selectedStudent.uid), {
            email: editEmail.trim().toLowerCase(),
          });
        } catch { /* non-fatal */ }
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'User', targetId: selectedStudent.uid,
        details: `Edit siswa: ${editName} → role: ${editRole}${editClassId !== selectedStudent.classId ? ` → pindah kelas: ${classes.find(c => c.id === editClassId)?.name || editClassId}` : ''}`,
      });

      showToast(`Data ${editName} berhasil diperbarui!`, 'success');
      setIsEditOpen(false);
      setSelectedStudent(null);
      loadStudents();
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSubmitting(false); }
  };

  const handleSaveStudentPhoto = async (photoUrl: string) => {
    if (!photoModalStudent) return;
    try {
      await updateDoc(doc(db, 'users', photoModalStudent.uid), {
        photoURL: photoUrl,
        updatedAt: new Date().toISOString(),
      });
      showToast('Foto siswa diperbarui!', 'success');
      setPhotoModalStudent(null);
      loadStudents();
    } catch (err: any) {
      showToast('Gagal simpan foto: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleDeleteStudent = (s: UserProfile) => {
    setSelectedStudent(s);
    setDeleteConfirmText('');
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!selectedStudent || !user) return;

    if (deleteConfirmText.trim().toLowerCase() !== selectedStudent.displayName.trim().toLowerCase()) {
      showToast('Nama tidak cocok.', 'error');
      return;
    }

    setDeletingStudent(true);
    try {
      await deleteDoc(doc(db, 'users', selectedStudent.uid));
      try { await deleteDoc(doc(db, 'userCredentials', selectedStudent.uid)); } catch { /* ignore */ }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'User', targetId: selectedStudent.uid,
        details: `Hapus profil siswa: ${selectedStudent.displayName}`,
      });

      showToast(`Profil ${selectedStudent.displayName} dihapus.`, 'info');
      setShowDeleteConfirm(false);
      setSelectedStudent(null);
      setDeleteConfirmText('');
      loadStudents();
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleResetPassword = async (s: UserProfile) => {
    if (!confirm(`Kirim link reset password ke ${s.displayName}?\n\nEmail: ${s.email}`)) return;

    setResettingId(s.uid);
    try {
      const res = await resetStudentPassword(s.email);
      if (res.success) {
        showToast(res.message, 'success');
        try {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: s.uid,
            classId: activeClass?.id || '',
            title: 'Reset Password Dikirim',   // ✅ tanpa emoji
            message: `Guru mengirim link reset password ke email ${s.email}.`,
            category: 'Sistem',
            read: false,
            link: 'pengaturan',
            createdAt: new Date().toISOString(),
          });
        } catch { /* non-fatal */ }
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setResettingId(null);
    }
  };

  const handleViewCredentials = async (s: UserProfile) => {
    setCredModal({ open: true, student: s, loading: true, success: false });
    setShowPasswordInModal(false);
    setCopiedField(null);

    try {
      const res = await getUserCredentials(s.uid);
      if (res.success) {
        setCredModal({
          open: true,
          student: s,
          loading: false,
          success: true,
          email: res.email || s.email,
          password: res.password,
          displayName: res.displayName || s.displayName,
        });

        if (user) {
          try {
            await recordAuditLog({
              userId: user.uid, userName: user.displayName, role: user.role,
              action: 'UPDATE', targetType: 'ViewCredentials', targetId: s.uid,
              details: `Lihat kredensial siswa: ${s.displayName}`,
            });
          } catch { /* non-fatal */ }
        }
      } else {
        setCredModal({
          open: true,
          student: s,
          loading: false,
          success: false,
          message: res.message || 'Kredensial tidak tersedia untuk siswa ini.',
        });
      }
    } catch (err: any) {
      setCredModal({
        open: true,
        student: s,
        loading: false,
        success: false,
        message: err?.message || 'Gagal memuat kredensial.',
      });
    }
  };

  const closeCredModal = () => {
    setCredModal({ open: false, student: null, loading: false, success: false });
    setShowPasswordInModal(false);
    setCopiedField(null);
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast(`${field} disalin ke clipboard.`, 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast('Gagal menyalin.', 'error');
    }
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.displayName || '').toLowerCase().includes(q) ||
           (s.email || '').toLowerCase().includes(q) ||
           (s.role || '').toLowerCase().includes(q) ||
           (s.phone || '').includes(q);
  });

  const myClassIds = Array.isArray(user?.classIds) && user.classIds.length > 0
    ? user.classIds
    : (user?.classId ? [user.classId] : []);

  const myClasses = classes.filter(c => myClassIds.includes(c.id));

  // ✅ Helper: cari icon untuk role tertentu
  const getRoleIcon = (role: string): any => {
    for (const group of ROLE_GROUPS) {
      const found = group.roles.find(r => r.value === role);
      if (found) return found.icon;
    }
    return UserIcon;
  };

  if (!activeClass) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Pilih Kelas Dulu</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Kembali ke beranda dan masuk ke kelas untuk mengelola siswa.
        </p>
      </div>
    );
  }

  const CurrentRoleIcon = getRoleIcon(editRole);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 shrink-0">
              <GraduationCap className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Kelola Siswa — Kelas {activeClass.name}
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                {activeClass.name}: {students.length} Siswa
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Progress real-time dari Tugas & Deadline. Klik nama untuk detail.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate?.('dashboard')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard Kelas
            </button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-700 text-white shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Rata-rata</span>
          </div>
          <p className="text-2xl font-black">{classStats.avg}%</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Mahir (&ge;80%)</p>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{classStats.mahir}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Tertinggal (&lt;50%)</p>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-200">{classStats.tertinggal}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300">Belum Mulai</p>
          <p className="text-2xl font-black text-rose-800 dark:text-rose-200">{classStats.belum}</p>
        </div>
      </div>

      {/* SEARCH */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari nama, email, atau role siswa..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
        <button onClick={loadStudents} disabled={loading}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">
          {filteredStudents.length} siswa
        </span>
      </div>

      {/* TABEL SISWA */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          Memuat data siswa...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
            {searchQuery ? 'Tidak Ada Hasil' : 'Belum Ada Siswa'}
          </h3>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Nama</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Divisi</th>
                  <th className="py-3.5 px-4 text-center">Progress</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredStudents.map(s => {
                  const prog = getStudentProgress(s);
                  const isResetting = resettingId === s.uid;
                  return (
                    <tr key={s.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            {s.photoURL ? (
                              <img src={s.photoURL} alt={s.displayName}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                {(s.displayName || s.email || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <button onClick={() => setPhotoModalStudent(s)}
                              className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                              title="Ganti foto">
                              <Camera className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">{s.displayName || '(Tanpa Nama)'}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-mono text-[11px]">{s.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40">
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">{s.divisionName || '-'}</td>
                      <td className="py-3.5 px-4">
                        {prog.total === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">-</span>
                        ) : (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full ${
                                prog.pct >= 80 ? 'bg-emerald-500' :
                                prog.pct >= 50 ? 'bg-blue-500' :
                                prog.pct > 0 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} style={{ width: `${prog.pct}%` }} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {prog.completed}/{prog.total}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button onClick={() => handleViewCredentials(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 text-[11px] font-bold transition flex items-center gap-1"
                            title="Lihat Email & Password">
                            <KeyRound className="w-3 h-3" /> Lihat Pass
                          </button>

                          <button onClick={() => handleResetPassword(s)}
                            disabled={isResetting}
                            className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/40 text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50"
                            title="Kirim link reset password">
                            {isResetting ? (
                              <><RefreshCw className="w-3 h-3 animate-spin" /> ...</>
                            ) : (
                              <><Send className="w-3 h-3" /> Reset</>
                            )}
                          </button>

                          <button onClick={() => openEditStudent(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] font-bold transition flex items-center gap-1">
                            <UserCog className="w-3 h-3" /> Edit
                          </button>

                          <button onClick={() => handleDeleteStudent(s)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition"
                            title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL LIHAT PASSWORD */}
      {credModal.open && credModal.student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-purple-200 dark:border-purple-500/40 my-auto overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                    <KeyRound className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                      Kredensial Akun Siswa
                    </p>
                    <h3 className="text-base font-black mt-0.5">
                      {credModal.student.displayName}
                    </h3>
                  </div>
                </div>
                <button onClick={closeCredModal}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {credModal.loading ? (
                <div className="py-8 text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-500" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Memuat kredensial...</p>
                </div>
              ) : credModal.success ? (
                <>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                      <strong>Rahasia!</strong> Jangan bagikan kredensial ini ke orang lain.
                      Hanya untuk membantu siswa yang lupa password.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </p>
                      <button
                        onClick={() => handleCopy(credModal.email || '', 'Email')}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                        {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900 dark:text-white break-all">
                      {credModal.email}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-2 border-purple-200 dark:border-purple-500/40">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Password
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                          className="p-1 rounded-md text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition"
                          title={showPasswordInModal ? 'Sembunyikan' : 'Tampilkan'}>
                          {showPasswordInModal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopy(credModal.password || '', 'Password')}
                          className="p-1 rounded-md text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition">
                          {copiedField === 'Password' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-mono font-black text-purple-900 dark:text-purple-200 break-all">
                      {showPasswordInModal
                        ? credModal.password
                        : '•'.repeat(Math.min((credModal.password || '').length || 8, 20))
                      }
                    </p>
                    {!showPasswordInModal && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                        <EyeOff className="w-2.5 h-2.5" /> Klik ikon mata untuk menampilkan
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                      <strong>Saran:</strong> Minta siswa untuk mengganti password setelah login
                      pertama, agar lebih aman dan mudah diingat.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-200 dark:border-rose-500/40 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-500/20 border-2 border-rose-300 dark:border-rose-500/40 mb-3">
                      <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                    </div>
                    <p className="text-sm font-bold text-rose-900 dark:text-rose-200">
                      Kredensial Tidak Tersedia
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                      {credModal.message || 'Siswa ini mendaftar sebelum fitur kredensial aktif, atau kredensial sudah dihapus.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Alternatif:
                    </p>
                    <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pl-4 list-disc">
                      <li>Klik tombol <strong>Reset</strong> untuk kirim link reset password ke email siswa</li>
                      <li>Siswa buka email → klik link → buat password baru sendiri</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={closeCredModal}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT SISWA */}
      {isEditOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-500" /> Edit Siswa
              </h3>
              <button onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email Siswa
                </label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> No. WhatsApp
                </label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              {/* Selector kelas (guru multi-kelas) */}
              {user?.role === 'Guru Pengampu' && myClasses.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Kelas Siswa
                  </label>
                  <select
                    value={editClassId}
                    onChange={(e) => setEditClassId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                  >
                    {myClasses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.kerabatKerja ? `— ${c.kerabatKerja}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>Anda bisa memindahkan siswa ke kelas lain yang Anda ampu.</span>
                  </p>
                </div>
              )}

              {/* ✅ Role Picker — Custom Dropdown dengan Icon */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Role / Peran <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsRolePickerOpen(true)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-2 hover:border-amber-400 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CurrentRoleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{editRole}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ MODAL ROLE PICKER (Icons only, no emoji) */}
      {isRolePickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col overflow-hidden my-auto">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilih Role</h3>
              </div>
              <button onClick={() => setIsRolePickerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {ROLE_GROUPS.map(group => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.label}>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                      <GroupIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.roles.map(r => {
                        const RoleIcon = r.icon;
                        const isSelected = editRole === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => {
                              setEditRole(r.value);
                              setIsRolePickerOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left transition flex items-center gap-2.5 ${
                              isSelected
                                ? 'bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40'
                                : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-300'
                            }`}
                          >
                            <RoleIcon className={`w-4 h-4 shrink-0 ${
                              isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                            }`} />
                            <span className={`text-xs font-bold flex-1 ${
                              isSelected ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {r.value}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HAPUS */}
      {showDeleteConfirm && selectedStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-200 dark:border-rose-500/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-rose-900 dark:text-rose-300 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                Hapus Siswa?
              </h3>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 mb-3">
              <p className="text-xs text-rose-900 dark:text-rose-200 font-bold">
                Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>

            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Ketik nama siswa persis untuk konfirmasi:
            </label>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-2 text-xs font-mono text-slate-700 dark:text-slate-300 select-all">
              {selectedStudent.displayName}
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Ketik nama siswa di sini..."
              autoFocus
              className={`w-full px-3.5 py-2.5 rounded-xl border-2 font-semibold text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 transition ${
                deleteConfirmText.length === 0
                  ? 'border-slate-200 dark:border-slate-700'
                  : deleteConfirmText.trim().toLowerCase() === selectedStudent.displayName.trim().toLowerCase()
                  ? 'border-emerald-500'
                  : 'border-rose-300'
              }`}
            />

            <div className="flex gap-2 pt-4 mt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteStudent}
                disabled={deletingStudent || deleteConfirmText.trim().toLowerCase() !== selectedStudent.displayName.trim().toLowerCase()}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                {deletingStudent ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO MODAL */}
      {photoModalStudent && (
        <PhotoUploadModal
          currentPhotoUrl={photoModalStudent.photoURL}
          userName={photoModalStudent.displayName}
          onSave={handleSaveStudentPhoto}
          onClose={() => setPhotoModalStudent(null)}
        />
      )}
    </div>
  );
};