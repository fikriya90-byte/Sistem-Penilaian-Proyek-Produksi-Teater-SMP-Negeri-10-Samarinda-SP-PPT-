import React, { useState, useEffect } from 'react';
import {
  Plus, Users, BookOpen, Edit3, Trash2, Hash, Sparkles, X,
  ChevronRight, Copy, RefreshCw, AlertTriangle, GraduationCap,
  Search, Save, UserCog, Camera, TrendingUp, ArrowLeft, Check,
  Eye, EyeOff, KeyRound, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { ClassRoom, UserProfile, UserRole } from '../../core/types';
import {
  doc, setDoc, deleteDoc, collection, getDocs, query, where, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass, subscribeTasksByClass } from '../../services/firestoreService';
import { getDivisionFromRole } from '../../core/constants';
import { PhotoUploadModal } from '../common/PhotoUploadModal';

interface ManageClassModuleProps {
  onNavigate?: (module: string) => void;
}

const ROLE_OPTIONS: { group: string; roles: UserRole[] }[] = [
  { group: '👑 Pengurus Inti', roles: ['Pimpinan Produksi', 'Sekretaris', 'Bendahara'] },
  { group: '🎬 Pemeran & Penyutradaraan', roles: ['Sutradara', 'Asisten Sutradara', 'Pemain'] },
  { group: '📋 Koordinator Divisi', roles: ['Koordinator Perlengkapan', 'Koordinator Publikasi', 'Koordinator Tata Panggung', 'Koordinator Tata Rias', 'Koordinator Tata Busana', 'Koordinator Tata Musik'] },
  { group: '🎭 Anggota Divisi', roles: ['Anggota Perlengkapan', 'Anggota Publikasi', 'Anggota Tata Panggung', 'Anggota Tata Rias', 'Anggota Tata Busana', 'Anggota Tata Musik'] },
];

interface CredentialView {
  uid: string;
  displayName: string;
  email: string;
  password: string;
}

export const ManageClassModule: React.FC<ManageClassModuleProps> = ({ onNavigate }) => {
  const { user, activeClass, classes, setActiveClass, reloadClasses } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'kelas' | 'siswa'>('kelas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [photoModalStudent, setPhotoModalStudent] = useState<UserProfile | null>(null);

  // Lihat password modal
  const [passwordModal, setPasswordModal] = useState<CredentialView | null>(null);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Pemain');

  const [tasks, setTasks] = useState<any[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<Record<string, any>>({});
  const [studentCountMap, setStudentCountMap] = useState<Record<string, number>>({});

  // Hitung siswa riil per kelas
  useEffect(() => {
    if (classes.length === 0) return;
    const unsubs: (() => void)[] = [];
    classes.forEach(c => {
      const q = query(collection(db, 'users'), where('classId', '==', c.id));
      const unsub = onSnapshot(q, snap => {
        const count = snap.docs.filter(d => {
          const r = d.data().role;
          return r !== 'Guru Pengampu' && r !== 'Admin' && r !== 'Super Admin';
        }).length;
        setStudentCountMap(prev => ({ ...prev, [c.id]: count }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [classes]);

  useEffect(() => {
    if (activeTab === 'siswa') {
      loadStudents();
      loadCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeClass?.id]);

  useEffect(() => {
    if (!activeClass) return;
    const unsub1 = subscribeTasksByClass(activeClass.id, setTasks);
    let unsub2 = () => {};
    (async () => {
      const q = query(collection(db, 'taskCompletions'), where('classId', '==', activeClass.id));
      unsub2 = onSnapshot(q, (snap: any) => {
        const map: Record<string, any> = {};
        snap.docs.forEach((d: any) => {
          const data = d.data();
          map[`${data.taskId}_${data.studentId}`] = data;
        });
        setTaskCompletions(map);
      });
    })();
    return () => { unsub1(); unsub2(); };
  }, [activeClass]);

  const loadStudents = async () => {
    if (!activeClass) return;
    setLoadingStudents(true);
    try {
      const list = await fetchUsersByClass(activeClass.id);
      const filtered = list.filter(u =>
        u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
        u.role !== 'Admin' && u.role !== 'Super Admin'
      );
      setStudents(filtered);
    } catch (err) {
      console.warn('Load students error:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadCredentials = async () => {
    try {
      const snap = await getDocs(collection(db, 'userCredentials'));
      const map: Record<string, string> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[data.uid] = data.password || '';
      });
      setCredentials(map);
    } catch (err) {
      console.warn('Load credentials error (mungkin diblokir rules):', err);
    }
  };

  const handleViewPassword = (s: UserProfile) => {
    const pwd = credentials[s.uid];
    if (!pwd) {
      showToast('Password tidak tersedia. Siswa mungkin sudah ganti password atau mendaftar sebelum fitur ini aktif.', 'warning');
      return;
    }
    setPasswordModal({
      uid: s.uid,
      displayName: s.displayName,
      email: s.email,
      password: pwd,
    });
  };

  const getStudentProgress = (s: UserProfile) => {
    const myTasks = tasks.filter(t =>
      t.assigneeId === s.uid ||
      (t as any).targetRole === s.role ||
      (t as any).targetDivision === s.divisionName ||
      t.assigneeName === 'Semua Siswa' ||
      t.assigneeName === 'Semua Anggota Divisi'
    );
    const completed = myTasks.filter(t => taskCompletions[`${t.id}_${s.uid}`]?.completed).length;
    const total = myTasks.length;
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

  const generateCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let a = ''; for (let i = 0; i < 4; i++) a += chars.charAt(Math.floor(Math.random() * chars.length));
    let b = ''; for (let i = 0; i < 4; i++) b += chars.charAt(Math.floor(Math.random() * chars.length));
    const prefix = formName.trim().slice(0, 3).toUpperCase() || 'KLS';
    return `${prefix}-${a}${b}`.slice(0, 12);
  };

  const openCreate = () => {
    setEditingClass(null); setFormName(''); setFormCode(''); setIsModalOpen(true);
  };

  const openEdit = (c: ClassRoom) => {
    setEditingClass(c); setFormName(c.name); setFormCode(c.code); setIsModalOpen(true);
  };

  const openEditStudent = (s: UserProfile) => {
    setSelectedStudent(s);
    setEditName(s.displayName || '');
    setEditPhone(s.phone || '');
    setEditRole((s.role as UserRole) || 'Pemain');
    setIsEditStudentOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formName.trim() || !formCode.trim()) {
      showToast('Nama kelas dan kode kelas wajib diisi.', 'warning'); return;
    }
    setSubmitting(true);
    try {
      const classId = editingClass ? editingClass.id : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newClass: ClassRoom = {
        id: classId,
        name: formName.trim().toUpperCase(),
        code: formCode.trim().toUpperCase(),
        academicYear: editingClass?.academicYear || '2025/2026',
        teacherId: user.uid,
        teacherName: user.displayName,
        totalStudents: editingClass?.totalStudents || 0,
        kerabatKerja: editingClass?.kerabatKerja || '',
      };
      await setDoc(doc(db, 'classes', classId), newClass, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editingClass ? 'UPDATE' : 'CREATE', targetType: 'Class', targetId: classId,
        details: `${editingClass ? 'Edit' : 'Buat'} kelas: ${newClass.name} (${newClass.code})`,
      });
      await reloadClasses();
      showToast(`Kelas ${newClass.name} berhasil ${editingClass ? 'diperbarui' : 'dibuat'}!`, 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSubmitting(false); }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;
    setSubmitting(true);
    try {
      const division = getDivisionFromRole(editRole);
      await updateDoc(doc(db, 'users', selectedStudent.uid), {
        displayName: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        divisionId: division.id,
        divisionName: division.name,
        updatedAt: new Date().toISOString(),
      });
      showToast(`Data ${editName} berhasil diperbarui!`, 'success');
      setIsEditStudentOpen(false); setSelectedStudent(null); loadStudents();
    } catch (err: any) {
      showToast('Gagal menyimpan: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSubmitting(false); }
  };

  const handleSaveStudentPhoto = async (photoUrl: string) => {
    if (!photoModalStudent || !user) return;
    try {
      await updateDoc(doc(db, 'users', photoModalStudent.uid), {
        photoURL: photoUrl, updatedAt: new Date().toISOString(),
      });
      showToast('Foto siswa diperbarui!', 'success');
      setPhotoModalStudent(null); loadStudents();
    } catch (err: any) {
      showToast('Gagal simpan foto: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleDeleteStudent = async (s: UserProfile) => {
    if (!confirm(`Hapus profil siswa ${s.displayName}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', s.uid));
      try { await deleteDoc(doc(db, 'userCredentials', s.uid)); } catch { /* ignore */ }
      showToast(`Profil ${s.displayName} dihapus.`, 'info');
      loadStudents();
    } catch (err: any) {
      showToast('Gagal menghapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleDelete = async (c: ClassRoom) => {
    if (!confirm(`Hapus kelas ${c.name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteDoc(doc(db, 'classes', c.id));
      await reloadClasses();
      showToast(`Kelas ${c.name} dihapus.`, 'info');
    } catch (err: any) {
      showToast('Gagal menghapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleEnterClass = (c: ClassRoom) => {
    setActiveClass(c);
    showToast(`Masuk ke kelas ${c.name}`, 'success');
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      showToast(`Kode "${text}" disalin!`, 'success');
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      showToast('Gagal menyalin.', 'error');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reloadClasses();
    if (activeTab === 'siswa') { await loadStudents(); await loadCredentials(); }
    setRefreshing(false);
    showToast('Data diperbarui.', 'info');
  };

  // === TOMBOL KEMBALI ke dashboard ===
  const handleBack = () => {
    if (onNavigate) onNavigate('dashboard');
    else window.location.reload();
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.displayName || '').toLowerCase().includes(q) ||
           (s.email || '').toLowerCase().includes(q) ||
           (s.role || '').toLowerCase().includes(q) ||
           (s.phone || '').includes(q);
  });

  return (
    <div className="space-y-6">
      {/* ============ HEADER ============ */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-900 via-slate-900 to-slate-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={handleBack}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition shrink-0"
              title="Kembali ke Dashboard">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Manajemen
              </span>
              <h2 className="text-xl font-black text-white mt-1">Kelola Kelas & Siswa</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Kelola kelas, kode, akun siswa, lihat password, & progress tugas
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleBack}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </button>
            {activeTab === 'kelas' && (
              <button onClick={openCreate}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
                <Plus className="w-4 h-4" /> Buat Kelas Baru
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('kelas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'kelas' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}>
          <BookOpen className="w-3.5 h-3.5" /> Daftar Kelas ({classes.length})
        </button>
        <button onClick={() => setActiveTab('siswa')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'siswa' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}>
          <GraduationCap className="w-3.5 h-3.5" /> Siswa {activeClass ? `(${activeClass.name})` : ''}
        </button>
        <button onClick={handleRefresh} disabled={refreshing}
          className="ml-auto px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 flex items-center gap-1.5 transition">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* TAB: KELAS */}
      {activeTab === 'kelas' && (
        <>
          {classes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Kelas</h3>
              <button onClick={openCreate}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Buat Kelas Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map(c => {
                const realCount = studentCountMap[c.id] ?? 0;
                const isCopied = copiedCode === c.code;
                return (
                  <div key={c.id} className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12" />
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                        {c.name.replace(/[^0-9A-Z]/gi, '').slice(-2) || 'IX'}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Edit">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Hapus">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{c.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">T.A. {c.academicYear}</p>
                    {c.kerabatKerja && (
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">{c.kerabatKerja}</span>
                      </div>
                    )}

                    <button onClick={() => handleCopy(c.code)}
                      className={`mt-3 w-full p-2.5 rounded-xl border flex items-center justify-between transition ${
                        isCopied ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 hover:bg-amber-50 border-slate-200 hover:border-amber-300'
                      }`}>
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-mono font-bold text-slate-700">{c.code}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isCopied ? (
                          <><Check className="w-3 h-3 text-emerald-600" /><span className="text-[10px] font-bold text-emerald-700">Tersalin!</span></>
                        ) : (
                          <><Copy className="w-3 h-3 text-slate-400" /><span className="text-[10px] font-bold text-slate-500">Salin</span></>
                        )}
                      </div>
                    </button>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Users className="w-3 h-3" /> {realCount} siswa
                      </span>
                      <button onClick={() => handleEnterClass(c)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition">
                        Masuk <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB: SISWA */}
      {activeTab === 'siswa' && (
        <>
          {!activeClass ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700">Pilih Kelas Dulu</h3>
              <button onClick={() => setActiveTab('kelas')}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                Ke Daftar Kelas
              </button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-700 text-white shadow-md">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Rata-rata</span>
                  </div>
                  <p className="text-2xl font-black">{classStats.avg}%</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Mahir (≥80%)</span>
                  <p className="text-2xl font-black text-emerald-800">{classStats.mahir}</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-amber-700">Tertinggal (&lt;50%)</span>
                  <p className="text-2xl font-black text-amber-800">{classStats.tertinggal}</p>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-rose-700">Belum Mulai</span>
                  <p className="text-2xl font-black text-rose-800">{classStats.belum}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input type="text" placeholder="Cari nama, email, atau role siswa..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
                <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                  {filteredStudents.length} siswa
                </span>
              </div>

              {loadingStudents ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
                  Memuat data siswa...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                  <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Siswa</h3>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-3.5 px-4">Nama</th>
                          <th className="py-3.5 px-4">Email</th>
                          <th className="py-3.5 px-4">Role</th>
                          <th className="py-3.5 px-4">Divisi</th>
                          <th className="py-3.5 px-4 text-center">Progress</th>
                          <th className="py-3.5 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map(s => {
                          const prog = getStudentProgress(s);
                          const hasPwd = !!credentials[s.uid];
                          return (
                            <tr key={s.uid} className="hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative">
                                    {s.photoURL ? (
                                      <img src={s.photoURL} alt={s.displayName}
                                        className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                                    ) : (
                                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200">
                                        {(s.displayName || s.email || '?').charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <button onClick={() => setPhotoModalStudent(s)}
                                      className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                                      title="Ganti foto">
                                      <Camera className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                  <p className="font-bold text-slate-900">{s.displayName || '(Tanpa Nama)'}</p>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 font-mono text-[11px]">{s.email}</td>
                              <td className="py-3.5 px-4">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  {s.role}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 text-[11px]">{s.divisionName || '-'}</td>
                              <td className="py-3.5 px-4">
                                {prog.total === 0 ? (
                                  <span className="text-[10px] text-slate-400 italic">-</span>
                                ) : (
                                  <div className="flex items-center gap-2 justify-center">
                                    <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                                      <div className={`h-full ${
                                        prog.pct >= 80 ? 'bg-emerald-500' :
                                        prog.pct >= 50 ? 'bg-blue-500' :
                                        prog.pct > 0 ? 'bg-amber-500' : 'bg-rose-500'
                                      }`} style={{ width: `${prog.pct}%` }} />
                                    </div>
                                    <span className={`text-[11px] font-bold min-w-[50px] ${
                                      prog.pct >= 80 ? 'text-emerald-700' :
                                      prog.pct >= 50 ? 'text-blue-700' :
                                      prog.pct > 0 ? 'text-amber-700' : 'text-rose-700'
                                    }`}>
                                      {prog.completed}/{prog.total}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => handleViewPassword(s)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                      hasPwd
                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                                    title={hasPwd ? 'Lihat password' : 'Password tidak tersedia'}>
                                    <KeyRound className="w-3 h-3" /> Lihat
                                  </button>
                                  <button onClick={() => openEditStudent(s)}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition flex items-center gap-1">
                                    <UserCog className="w-3 h-3" /> Edit
                                  </button>
                                  <button onClick={() => handleDeleteStudent(s)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition" title="Hapus">
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
            </>
          )}
        </>
      )}

      {/* MODAL FORM KELAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                {editingClass ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-amber-500" />}
                {editingClass ? 'Edit Kelas' : 'Buat Kelas Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kelas <span className="text-rose-500">*</span></label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: IX-G"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 uppercase" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Kelas <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input type="text" required value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: IXG-9101"
                    className="w-full px-3.5 py-2 pr-20 rounded-xl border border-slate-200 text-xs font-mono font-semibold text-slate-800 uppercase" />
                  <button type="button" onClick={() => setFormCode(generateCode())}
                    className="absolute right-2 top-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200">
                    Acak
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : (editingClass ? 'Simpan' : 'Buat')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT SISWA */}
      {isEditStudentOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-500" /> Edit Siswa
              </h3>
              <button onClick={() => setIsEditStudentOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap <span className="text-rose-500">*</span></label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="0812..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Peran <span className="text-rose-500">*</span></label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white">
                  {ROLE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditStudentOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
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

      {/* MODAL LIHAT PASSWORD */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-amber-300 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-amber-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Kredensial Siswa
              </h3>
              <button onClick={() => setPasswordModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-relaxed">
                <strong>Peringatan Keamanan:</strong> Jangan bagikan kredensial ini ke pihak lain. Hanya untuk keperluan reset password oleh Guru.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Nama</p>
                <p className="font-bold text-slate-900 mt-0.5">{passwordModal.displayName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Email</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="font-mono text-slate-900 break-all text-[11px]">{passwordModal.email}</p>
                  <button onClick={() => { navigator.clipboard.writeText(passwordModal.email); showToast('Email disalin!', 'info'); }}
                    className="p-1 text-slate-500 hover:text-slate-800 shrink-0">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Password</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="font-mono font-bold text-emerald-900 break-all">{passwordModal.password}</p>
                  <button onClick={() => { navigator.clipboard.writeText(passwordModal.password); showToast('Password disalin!', 'info'); }}
                    className="p-1 text-emerald-600 hover:text-emerald-800 shrink-0">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <button onClick={() => setPasswordModal(null)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs">
              Tutup
            </button>
          </div>
        </div>
      )}

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
