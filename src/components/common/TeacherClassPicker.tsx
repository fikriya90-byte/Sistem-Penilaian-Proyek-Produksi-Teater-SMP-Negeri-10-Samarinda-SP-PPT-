import React, { useState } from 'react';
import {
  GraduationCap, Plus, LogOut, Users, BookOpen, ChevronRight, X,
  Sparkles, Hash, ShieldCheck, Sun, Moon, Monitor, Copy, Check,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useTheme } from '../../core/themeContext';
import { APP_CONFIG } from '../../core/constants';
import { useToast } from './Toast';
import { ClassRoom } from '../../core/types';
import { doc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

export const TeacherClassPicker: React.FC = () => {
  const { user, classes, setActiveClass, reloadClasses, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [kerabatKerja, setKerabatKerja] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [studentCountMap, setStudentCountMap] = useState<Record<string, number>>({});

  // Hitung jumlah siswa riil per kelas
  React.useEffect(() => {
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

  const handleEnterClass = (c: ClassRoom) => {
    setActiveClass(c);
    showToast(`Masuk ke kelas ${c.name}`, 'success');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let a = '';
    for (let i = 0; i < 4; i++) a += chars.charAt(Math.floor(Math.random() * chars.length));
    let b = '';
    for (let i = 0; i < 4; i++) b += chars.charAt(Math.floor(Math.random() * chars.length));
    const prefix = newName.trim().slice(0, 3).toUpperCase() || 'KLS';
    return `${prefix}-${a}${b}`.slice(0, 12);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast(`Kode "${code}" disalin!`, 'success');
      setTimeout(() => setCopiedCode(null), 2500);
    } catch {
      showToast('Gagal menyalin.', 'error');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newName.trim() || !newCode.trim()) {
      showToast('Nama kelas dan kode kelas wajib diisi.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const newId = `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newClass: ClassRoom = {
        id: newId,
        name: newName.trim().toUpperCase(),
        code: newCode.trim().toUpperCase(),
        academicYear: '2025/2026',
        teacherId: user.uid,
        teacherName: user.displayName,
        totalStudents: 0,
        kerabatKerja: kerabatKerja.trim() || '',
      };

      await setDoc(doc(db, 'classes', newId), newClass);

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Class',
        targetId: newId,
        details: `Membuat kelas baru: ${newClass.name} (${newClass.code})`,
      });

      await reloadClasses();
      showToast(`Kelas ${newClass.name} berhasil dibuat!`, 'success');

      setIsAddOpen(false);
      setNewName('');
      setNewCode('');
      setKerabatKerja('');
    } catch (err: any) {
      showToast('Gagal membuat kelas: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const themeIcon =
    theme === 'light' ? <Sun className="w-5 h-5" /> :
    theme === 'dark' ? <Moon className="w-5 h-5" /> :
    <Monitor className="w-5 h-5" />;
  const themeLabel = theme === 'light' ? 'Terang' : theme === 'dark' ? 'Gelap' : 'Auto';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={APP_CONFIG.logoSchool} alt="SMPN 10" className="w-11 h-11 object-contain" />
            <img src={APP_CONFIG.logoMapel} alt="Seni Budaya" className="w-11 h-11 object-contain hidden sm:block" />
            <div>
              <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight">SP-PPT SAMARINDA</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Sistem Penilaian Proyek Produksi Teater</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Tema */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/30 transition"
              title={`Tema: ${themeLabel} (klik untuk ganti)`}
            >
              {themeIcon}
              <span className="hidden sm:inline text-[11px] font-bold">{themeLabel}</span>
            </button>

            <div className="hidden sm:block text-right mr-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.displayName}</p>
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                {user?.role}
              </span>
            </div>
            <button
              onClick={async () => { await logout(); showToast('Logout berhasil.', 'info'); }}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Selamat Datang, {user?.displayName?.split(',')[0] || 'Guru'}!
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-lg mx-auto">
            Pilih kelas yang ingin Anda kelola untuk memulai aktivitas produksi teater.
          </p>
        </div>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Daftar Kelas ({classes.length})</span>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kelas Baru</span>
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Kelas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Mulai dengan menambahkan kelas pertama.</p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
            >
              Tambah Kelas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(c => {
              const realCount = studentCountMap[c.id] ?? 0;
              const isCopied = copiedCode === c.code;
              return (
                <div
                  key={c.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-lg transition relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/10 transition" />

                  <button onClick={() => handleEnterClass(c)} className="w-full text-left">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                        {c.name.replace(/[^0-9A-Z]/gi, '').slice(-2) || 'IX'}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition" />
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{c.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      T.A. {c.academicYear}
                    </p>

                    {c.kerabatKerja && (
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                        <span className="truncate">{c.kerabatKerja}</span>
                      </div>
                    )}
                  </button>

                  {/* KODE + SALIN */}
                  <button
                    onClick={() => handleCopyCode(c.code)}
                    className={`mt-3 w-full p-2.5 rounded-xl border flex items-center justify-between transition ${
                      isCopied
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/10 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{c.code}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Salin</span>
                        </>
                      )}
                    </div>
                  </button>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Users className="w-3 h-3" /> {realCount} siswa
                    </span>
                    <button
                      onClick={() => handleEnterClass(c)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition"
                    >
                      Masuk <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3 max-w-2xl mx-auto">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <strong>Bagikan kode kelas</strong> (yang tertera di setiap kartu) kepada siswa Anda.
            Siswa mendaftar sendiri menggunakan kode tersebut. Klik kotak kode untuk menyalin.
          </div>
        </div>
      </main>

      {/* Modal Tambah Kelas */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" /> Tambah Kelas Baru
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Kelas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: IX-G"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kode Kelas <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: IXG-9101"
                    className="w-full px-3.5 py-2 pr-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-slate-800 dark:text-white uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setNewCode(generateCode())}
                    className="absolute right-2 top-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Acak
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Kode ini yang dibagikan ke siswa untuk mendaftar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Produksi / Kerabat Kerja
                </label>
                <input
                  type="text"
                  value={kerabatKerja}
                  onChange={(e) => setKerabatKerja(e.target.value)}
                  placeholder="Contoh: Gema Senandika Production"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
