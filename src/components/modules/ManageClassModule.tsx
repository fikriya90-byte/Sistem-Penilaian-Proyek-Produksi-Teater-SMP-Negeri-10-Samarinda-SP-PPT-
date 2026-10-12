import React, { useState, useEffect } from 'react';
import {
  Plus, Users, BookOpen, Edit3, Trash2, Hash, Sparkles, X,
  ChevronRight, Copy, RefreshCw, AlertTriangle, Check,
  ArrowLeft, Camera, Upload,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { ClassRoom } from '../../core/types';
import {
  doc, setDoc, deleteDoc, collection, query, where, getDocs, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';
import { PhotoUploadModal } from '../common/PhotoUploadModal';
import { doc as firestoreDoc, getDoc } from 'firebase/firestore';

interface ManageClassModuleProps {
  embedded?: boolean;
  onEnterClass?: (c: ClassRoom) => void;
}

export const ManageClassModule: React.FC<ManageClassModuleProps> = ({
  embedded = false,
  onEnterClass,
}) => {
  const { user, classes, setActiveClass, reloadClasses } = useAuth();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');

  const [studentCountMap, setStudentCountMap] = useState<Record<string, number>>({});
  const [logoMap, setLogoMap] = useState<Record<string, string>>({});
  const [logoModalClass, setLogoModalClass] = useState<ClassRoom | null>(null);

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

      // Load kerabat logo
      (async () => {
        try {
          const snap = await getDoc(firestoreDoc(db, 'classes', c.id));
          if (snap.exists() && snap.data().kerabatLogo) {
            setLogoMap(prev => ({ ...prev, [c.id]: snap.data().kerabatLogo }));
          }
        } catch { /* ignore */ }
      })();
    });
    return () => unsubs.forEach(u => u());
  }, [classes]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let a = '';
    for (let i = 0; i < 4; i++) a += chars.charAt(Math.floor(Math.random() * chars.length));
    let b = '';
    for (let i = 0; i < 4; i++) b += chars.charAt(Math.floor(Math.random() * chars.length));
    const prefix = formName.trim().slice(0, 3).toUpperCase() || 'KLS';
    return `${prefix}-${a}${b}`.slice(0, 12);
  };

  const openCreate = () => {
    setEditingClass(null);
    setFormName('');
    setFormCode('');
    setIsModalOpen(true);
  };

  const openEdit = (c: ClassRoom) => {
    setEditingClass(c);
    setFormName(c.name);
    setFormCode(c.code);
    setIsModalOpen(true);
  };

  const handleDelete = async (c: ClassRoom) => {
    const userQ = query(collection(db, 'users'), where('classId', '==', c.id));
    const userSnap = await getDocs(userQ);
    const studentCount = userSnap.docs.filter(d => {
      const r = d.data().role;
      return r !== 'Guru Pengampu' && r !== 'Admin' && r !== 'Super Admin';
    }).length;

    if (studentCount > 0) {
      showToast(
        `Kelas ${c.name} masih memiliki ${studentCount} siswa. Pindahkan atau hapus siswa terlebih dahulu.`,
        'warning'
      );
      return;
    }

    const confirmCode = prompt(
      `HAPUS KELAS "${c.name}"?\n\n` +
      `⚠️ Tindakan ini TIDAK BISA DIBATALKAN!\n\n` +
      `Untuk konfirmasi, ketik kode kelas berikut:\n${c.code}`
    );

    if (confirmCode === null) return;

    if (confirmCode.trim().toUpperCase() !== c.code.toUpperCase()) {
      showToast('Kode kelas tidak cocok. Penghapusan dibatalkan.', 'error');
      return;
    }

    try {
      await deleteDoc(doc(db, 'classes', c.id));
      await recordAuditLog({
        userId: user!.uid, userName: user!.displayName, role: user!.role,
        action: 'DELETE', targetType: 'Class', targetId: c.id,
        details: `Menghapus kelas: ${c.name} (${c.code})`,
      });
      await reloadClasses();
      showToast(`Kelas ${c.name} berhasil dihapus.`, 'success');
    } catch (err: any) {
      showToast('Gagal menghapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formName.trim() || !formCode.trim()) {
      showToast('Nama kelas dan kode kelas wajib diisi.', 'warning');
      return;
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
    setRefreshing(false);
    showToast('Data diperbarui.', 'info');
  };

  const handleEnterClass = (c: ClassRoom) => {
    if (onEnterClass) {
      onEnterClass(c);
    } else {
      setActiveClass(c);
      showToast(`Masuk ke kelas ${c.name}`, 'success');
    }
  };

  const handleSaveLogo = async (photoUrl: string) => {
    if (!logoModalClass || !user) return;
    try {
      await setDoc(doc(db, 'classes', logoModalClass.id), {
        kerabatLogo: photoUrl,
      }, { merge: true });
      setLogoMap(prev => ({ ...prev, [logoModalClass.id]: photoUrl }));
      showToast('Logo kerabat diperbarui!', 'success');
      setLogoModalClass(null);
    } catch (err: any) {
      showToast('Gagal simpan logo: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* HERO */}
      {embedded && (
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white shadow-xl border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              Kelola Kelas
            </span>
            <span className="text-xs text-slate-400">T.A. 2025/2026</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Daftar Kelas Anda
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl leading-relaxed">
            Buat, edit, atau hapus kelas. Untuk mengelola siswa, masuk dulu ke kelas lalu pilih "Kelola Siswa".
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Total {classes.length} kelas</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Kelas Baru</span>
          </button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Kelas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Mulai dengan membuat kelas pertama.</p>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Buat Kelas Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(c => {
            const realCount = studentCountMap[c.id] ?? 0;
            const isCopied = copiedCode === c.code;
            const logo = logoMap[c.id];
            return (
              <div key={c.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-md transition relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12" />

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm overflow-hidden">
                        {logo ? (
                          <img src={logo} alt="logo" className="w-full h-full object-cover" />
                        ) : (
                          c.name.replace(/[^0-9A-Z]/gi, '').slice(-2) || 'IX'
                        )}
                      </div>
                      <button
                        onClick={() => setLogoModalClass(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition"
                        title="Ganti logo kerabat"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                        title="Edit kelas">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                        title="Hapus kelas">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{c.name}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">T.A. {c.academicYear}</p>

                  {c.kerabatKerja && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">{c.kerabatKerja}</span>
                    </div>
                  )}

                  <button onClick={() => handleCopy(c.code)}
                    className={`mt-3 w-full p-2.5 rounded-xl border flex items-center justify-between transition ${
                      isCopied
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/10 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                    }`}>
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
                    <button onClick={() => handleEnterClass(c)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition">
                      Masuk & Kelola Siswa <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Tips:</strong> Bagikan kode kelas ke siswa. Untuk mengelola siswa (edit role, reset password, hapus),
          <strong> masuk dulu ke kelas</strong> lalu pilih menu <strong>Kelola Siswa</strong> di sidebar.
        </div>
      </div>

      {/* MODAL FORM KELAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                {editingClass ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-amber-500" />}
                {editingClass ? 'Edit Kelas' : 'Buat Kelas Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Kelas <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: IX-G"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white uppercase" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kode Kelas <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input type="text" required value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: IXG-9101"
                    className="w-full px-3.5 py-2 pr-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-slate-800 dark:text-white uppercase" />
                  <button type="button" onClick={() => setFormCode(generateCode())}
                    className="absolute right-2 top-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600">
                    Acak
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  {submitting ? 'Menyimpan...' : (editingClass ? 'Simpan Perubahan' : 'Buat Kelas')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LOGO */}
      {logoModalClass && (
        <PhotoUploadModal
          currentPhotoUrl={logoMap[logoModalClass.id] || ''}
          userName={logoModalClass.name || 'Kerabat'}
          onSave={handleSaveLogo}
          onClose={() => setLogoModalClass(null)}
        />
      )}
    </div>
  );
};