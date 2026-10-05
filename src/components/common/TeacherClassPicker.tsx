import React, { useState } from 'react';
import {
  GraduationCap,
  Plus,
  LogOut,
  Users,
  BookOpen,
  ChevronRight,
  X,
  Sparkles,
  Hash,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { APP_CONFIG } from '../../core/constants';
import { useToast } from './Toast';
import { ClassRoom } from '../../core/types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

export const TeacherClassPicker: React.FC = () => {
  const { user, classes, setActiveClass, reloadClasses, logout } = useAuth();
  const { showToast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [kerabatKerja, setKerabatKerja] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        kerabatKerja: kerabatKerja.trim() || `Produksi Teater ${newName.trim()}`,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={APP_CONFIG.logoSchool} alt="SMPN 10" className="w-11 h-11 object-contain" />
            <img src={APP_CONFIG.logoMapel} alt="Seni Budaya" className="w-11 h-11 object-contain hidden sm:block" />
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">
                SP-PPT SAMARINDA
              </h1>
              <p className="text-[11px] text-slate-500">Sistem Penilaian Proyek Produksi Teater</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right mr-2">
              <p className="text-xs font-bold text-slate-900">{user?.displayName}</p>
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                {user?.role}
              </span>
            </div>
            <button
              onClick={async () => {
                await logout();
                showToast('Logout berhasil.', 'info');
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
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
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Selamat Datang, {user?.displayName?.split(',')[0] || 'Guru'}!
          </h2>
          <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
            Pilih kelas yang ingin Anda kelola untuk memulai aktivitas produksi teater.
          </p>
        </div>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Users className="w-4 h-4 text-amber-600" />
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
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Kelas</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Mulai dengan menambahkan kelas pertama.</p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
            >
              + Tambah Kelas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => handleEnterClass(c)}
                className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-lg transition text-left group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/10 transition" />

                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                    {c.name.replace(/[^0-9A-Z]/gi, '').slice(-2) || 'IX'}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition" />
                </div>

                <h3 className="text-lg font-black text-slate-900 tracking-tight">{c.name}</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  T.A. {c.academicYear}
                </p>

                {c.kerabatKerja && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span className="truncate">{c.kerabatKerja}</span>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-slate-500 font-mono">
                    <Hash className="w-3 h-3" />
                    {c.code}
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <Users className="w-3 h-3" />
                    {c.totalStudents || 0} siswa
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3 max-w-2xl mx-auto">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <strong>Bagikan kode kelas</strong> (yang tertera di setiap kartu) kepada siswa Anda.
            Siswa mendaftar sendiri menggunakan kode tersebut.
          </div>
        </div>
      </main>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" /> Tambah Kelas Baru
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kelas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: IX-G"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kode Kelas <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: IXG-9101"
                    className="w-full px-3.5 py-2 pr-20 rounded-xl border border-slate-200 text-xs font-mono font-semibold text-slate-800 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setNewCode(generateCode())}
                    className="absolute right-2 top-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                  >
                    Acak
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Kode ini yang dibagikan ke siswa untuk mendaftar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Produksi / Kerabat Kerja
                </label>
                <input
                  type="text"
                  value={kerabatKerja}
                  onChange={(e) => setKerabatKerja(e.target.value)}
                  placeholder="Contoh: Gema Senandika Production"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
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
