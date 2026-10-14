import React, { useState, useEffect } from 'react';
import {
  Users, BookOpen, ChevronRight, X, Sparkles,
  Plus, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from './Toast';
import { ClassRoom } from '../../core/types';
import {
  doc, setDoc, collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface TeacherClassPickerProps {
  onEnterClass?: (c: ClassRoom) => void;
  embedded?: boolean;
}

export const TeacherClassPicker: React.FC<TeacherClassPickerProps> = ({
  onEnterClass, embedded = false,
}) => {
  const { user, classes, setActiveClass, reloadClasses } = useAuth();
  const { showToast } = useToast();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [kerabatKerja, setKerabatKerja] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [studentCountMap, setStudentCountMap] = useState<Record<string, number>>({});

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

  const handleEnterClass = (c: ClassRoom) => {
    if (onEnterClass) onEnterClass(c);
    else { setActiveClass(c); showToast(`Masuk ke ${c.name}`, 'success'); }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let a = ''; for (let i = 0; i < 4; i++) a += chars.charAt(Math.floor(Math.random() * chars.length));
    let b = ''; for (let i = 0; i < 4; i++) b += chars.charAt(Math.floor(Math.random() * chars.length));
    const prefix = newName.trim().slice(0, 3).toUpperCase() || 'KLS';
    return `${prefix}-${a}${b}`.slice(0, 12);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newName.trim() || !newCode.trim()) {
      showToast('Nama & kode wajib diisi.', 'warning'); return;
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
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Class', targetId: newId,
        details: `Buat kelas: ${newClass.name} (${newClass.code})`,
      });
      await reloadClasses();
      showToast(`Kelas ${newClass.name} berhasil dibuat!`, 'success');
      setIsAddOpen(false);
      setNewName(''); setNewCode(''); setKerabatKerja('');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {embedded && (
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white shadow-xl border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Beranda Utama Guru
            </span>
            <span className="text-xs text-slate-400">T.A. 2025/2026</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Selamat datang, {user?.displayName?.split(',')[0] || 'Guru'}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl leading-relaxed">
            Pilih kelas untuk dikelola. Setelah masuk kelas, Anda bisa atur siswa, nilai, tugas, presensi, dan pengaturan kelas.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Pilih Kelas ({classes.length})</span>
        </div>
        <button onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition">
          <Plus className="w-4 h-4" /> Tambah Kelas Baru
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Kelas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Mulai dengan menambahkan kelas pertama Anda.</p>
          <button onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
            Tambah Kelas
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(c => {
            const realCount = studentCountMap[c.id] ?? 0;
            return (
              <button
                key={c.id}
                onClick={() => handleEnterClass(c)}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-lg transition text-left relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/10 transition" />

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-md">
                      {c.name.replace(/[^0-9A-Z]/gi, '').slice(-2) || 'IX'}
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {c.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    T.A. {c.academicYear}
                  </p>

                  {c.kerabatKerja && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">{c.kerabatKerja}</span>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-bold">
                      <Users className="w-3.5 h-3.5" /> {realCount} siswa
                    </span>
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-black text-[11px]">
                      Masuk Kelas <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3 max-w-2xl mx-auto">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Tips:</strong> Klik kartu kelas untuk masuk. Untuk <strong>edit nama/kode kelas</strong> atau <strong>hapus kelas</strong>, buka menu <strong>Kelola Kelas</strong> setelah masuk ke kelas.
        </div>
      </div>

      {/* MODAL TAMBAH KELAS */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" /> Tambah Kelas Baru
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Kelas <span className="text-rose-500">*</span></label>
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: IX-G"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white uppercase" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kode Kelas <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input type="text" required value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: IXG-9101"
                    className="w-full px-3.5 py-2 pr-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-slate-800 dark:text-white uppercase" />
                  <button type="button" onClick={() => setNewCode(generateCode())}
                    className="absolute right-2 top-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    Acak
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Produksi / Kerabat Kerja</label>
                <input type="text" value={kerabatKerja} onChange={(e) => setKerabatKerja(e.target.value)}
                  placeholder="Contoh: Gema Senandika Production"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">
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