import React from 'react';
import {
  GraduationCap, Users, Sparkles, ArrowRight, Bell,
  Megaphone, HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';

interface Props {
  onEnterClass: (c: any) => void;
  onNavigate: (m: string) => void;
}

export const StudentWelcomePage: React.FC<Props> = ({ onEnterClass, onNavigate }) => {
  const { user, activeClass } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* HERO */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white shadow-xl border border-amber-500/20">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Beranda Utama
          </span>
          <span className="text-xs text-slate-400">T.A. 2025/2026</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          Selamat datang, {user?.displayName?.split(' ')[0] || 'Sahabat Teater'}!
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl leading-relaxed">
          Anda terdaftar sebagai <strong className="text-amber-300">{user?.role}</strong>
          {user?.divisionName ? ` di divisi ${user.divisionName}` : ''}. Tekan tombol di bawah untuk masuk ke kelas.
        </p>
      </div>

      {/* KARTU KELAS */}
      {activeClass ? (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500/40 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                {activeClass.name.replace(/[^0-9A-Z]/gi, '').slice(-2) || 'IX'}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Kelas Anda
                </p>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{activeClass.name}</h3>
                {activeClass.kerabatKerja && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Sparkles className="w-3 h-3 text-amber-500" /> {activeClass.kerabatKerja}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => onEnterClass(activeClass)}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg transition hover:scale-105">
              Masuk Kelas <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Kelas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hubungi Guru Pengampu untuk didaftarkan ke kelas.
          </p>
        </div>
      )}

      {/* QUICK LINKS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => onNavigate('notifikasi')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition text-left">
          <Bell className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Notifikasi</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Cek pesan & pengumuman</p>
        </button>
        <button onClick={() => onNavigate('informasi')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition text-left">
          <Megaphone className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Papan Info</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Pengumuman tim</p>
        </button>
        <button onClick={() => onNavigate('panduan')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition text-left">
          <HelpCircle className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Panduan</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Cara pakai aplikasi</p>
        </button>
        <button onClick={() => onNavigate('pengaturan')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition text-left">
          <Users className="w-5 h-5 text-purple-500 mb-2" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Profil</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Atur akun Anda</p>
        </button>
      </div>

      {/* TIPS */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <strong>Tips:</strong> Di dalam kelas, Anda akan menemukan semua fitur — Tugas & Deadline, Nilai,
          Presensi, Naskah, Studio, dll. Untuk kembali ke beranda ini, klik tombol <strong>← Kembali</strong> di pojok kiri atas.
        </div>
      </div>
    </div>
  );
};