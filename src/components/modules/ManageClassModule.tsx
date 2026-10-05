import React, { useState } from 'react';
import {
  Plus, Users, BookOpen, Edit3, Trash2, Hash, Sparkles, X,
  ChevronRight, Copy, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { ClassRoom } from '../../core/types';
import { doc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

export const ManageClassModule: React.FC = () => {
  const { user, classes, setActiveClass, reloadClasses } = useAuth();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formKerabat, setFormKerabat] = useState('');

  const openCreate = () => {
    setEditingClass(null);
    setFormName('');
    setFormCode(generateCode());
    setFormKerabat('');
    setIsModalOpen(true);
  };

  const openEdit = (c: ClassRoom) => {
    setEditingClass(c);
    setFormName(c.name);
    setFormCode(c.code);
    setFormKerabat(c.kerabatKerja || '');
    setIsModalOpen(true);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let a = ''; for (let i = 0; i < 4; i++) a += chars.charAt(Math.floor(Math.random() * chars.length));
    let b = ''; for (let i = 0; i < 4; i++) b += chars.charAt(Math.floor(Math.random() * chars.length));
    return `IX${a.charAt(0)}-${a}${b}`.slice(0, 14);
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
        kerabatKerja: formKerabat.trim() || `Produksi Teater ${formName.trim()}`,
      };

      await setDoc(doc(db, 'classes', classId), newClass, { merge: true });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: editingClass ? 'UPDATE' : 'CREATE',
        targetType: 'Class',
        targetId: classId,
        details: `${editingClass ? 'Edit' : 'Buat'} kelas: ${newClass.name} (${newClass.code})`,
      });

      await reloadClasses();
      showToast(`Kelas ${newClass.name} berhasil ${editingClass ? 'diperbarui' : 'dibuat'}!`, 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: ClassRoom) => {
    if (!confirm(`Hapus kelas ${c.name}?\n\nAkun siswa yang sudah terdaftar di kelas ini TIDAK terhapus, tapi mereka tidak akan bisa akses sampai didaftarkan ke kelas baru.`)) return;

    try {
      // Cek jumlah siswa di kelas
      const q = query(collection(db, 'users'), where('classId', '==', c.id));
      const snap = await getDocs(q);
      if (snap.size > 0) {
        if (!confirm(`Kelas ini memiliki ${snap.size} siswa terdaftar. Tetap hapus kelas?`)) return;
      }

      await deleteDoc(doc(db, 'classes', c.id));

      await recordAuditLog({
        userId: user!.uid,
        userName: user!.displayName,
        role: user!.role,
        action: 'DELETE',
        targetType: 'Class',
        targetId: c.id,
        details: `Hapus kelas: ${c.name}`,
      });

      await reloadClasses();
      showToast(`Kelas ${c.name} dihapus.`, 'info');
    } catch (err: any) {
      showToast('Gagal menghapus: ' + (err?.message || 'Unknown error'), 'error');
    }
  };

  const handleEnterClass = (c: ClassRoom) => {
    setActiveClass(c);
    showToast(`Masuk ke kelas ${c.name}`, 'success');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Kode kelas disalin.', 'info');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reloadClasses();
    setRefreshing(false);
    showToast('Daftar kelas diperbarui.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-900 via-slate-900 to-slate-800 text-white shadow-xl border border-amber-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <BookOpen className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Manajemen Kelas
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Kelola Kelas & Kode Pendaftaran
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Buat, edit, dan kelola kelas produksi teater beserta kode untuk siswa
              </p>
            </div>
          </div>

          <button onClick={openCreate}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition">
            <Plus className="w-4 h-4" />
            <span>Buat Kelas Baru</span>
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Users className="w-4 h-4 text-amber-600" />
          <span>Total: {classes.length} kelas</span>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 flex items-center gap-1.5 transition">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Grid Kelas */}
      {classes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Kelas</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            Mulai dengan membuat kelas pertama untuk produksi teater Anda.
          </p>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Buat Kelas Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(c => (
            <div key={c.id}
              className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/10 transition" />

              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                  {c.name.replace(/[^0-9A-Z]/gi, '').slice(-2) || 'IX'}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(c)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                    title="Edit kelas">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Hapus kelas">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {c.name}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                T.A. {c.academicYear}
              </p>

              {c.kerabatKerja && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="truncate">{c.kerabatKerja}</span>
                </div>
              )}

              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-mono font-bold text-slate-700">{c.code}</span>
                </div>
                <button onClick={() => handleCopy(c.code)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
                  title="Copy kode">
                  <Copy className="w-3 h-3" />
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-500">
                  <Users className="w-3 h-3" />
                  {c.totalStudents || 0} siswa
                </span>
                <button onClick={() => handleEnterClass(c)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition">
                  Masuk <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Bagikan kode kelas</strong> ke siswa agar mereka bisa mendaftar.
          Setiap kelas punya kode unik. Menghapus kelas tidak menghapus akun siswa,
          tetapi mereka perlu didaftarkan ulang ke kelas lain.
        </div>
      </div>

      {/* Modal Form Kelas */}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kelas <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: IX-G"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 uppercase" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode Kelas <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input type="text" required value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: IXG-9101"
                    className="w-full px-3.5 py-2 pr-20 rounded-xl border border-slate-200 text-xs font-mono font-semibold text-slate-800 uppercase" />
                  <button type="button"
                    onClick={() => setFormCode(generateCode())}
                    className="absolute right-2 top-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200">
                    Acak
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Kode ini dibagikan ke siswa untuk mendaftar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Produksi / Kerabat Kerja
                </label>
                <input type="text" value={formKerabat}
                  onChange={(e) => setFormKerabat(e.target.value)}
                  placeholder="Contoh: Gema Senandika Production"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50">
                  {submitting ? 'Menyimpan...' : (editingClass ? 'Simpan Perubahan' : 'Buat Kelas')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
