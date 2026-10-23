// src/components/modules/BookingGuideModal.tsx
import React, { useState } from 'react';
import {
  X, BookOpen, CheckCircle, Camera, RotateCcw, AlertTriangle,
  Clock, Users, ChevronRight, ChevronLeft, Sparkles,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    icon: BookOpen,
    title: 'Selamat Datang di Booking Alat',
    body: (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>Fitur ini untuk meminjam alat sekolah (musik, properti, perlengkapan) untuk kegiatan produksi teater kelas Anda.</p>
        <p className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px]">
          <strong>Aturan utama:</strong> Booking minimal <strong>H-2</strong> (2 hari sebelum peminjaman). Maksimal <strong>1 jam</strong> per sesi.
        </p>
      </div>
    ),
  },
  {
    icon: Sparkles,
    title: 'Booking Banyak Alat Sekaligus',
    body: (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>Anda bisa memilih <strong>beberapa alat dalam satu sesi booking</strong>. Checklist alat yang dibutuhkan, isi tanggal, jam, dan keperluan.</p>
        <p>Sistem akan membuat <strong>satu sesi</strong> dengan beberapa alat. Guru akan memverifikasi <strong>per alat</strong> di dashboard mereka.</p>
      </div>
    ),
  },
  {
    icon: Camera,
    title: 'Lapor Pengambilan (Wajib Foto)',
    body: (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>Setelah booking <strong>disetujui guru</strong>, saat mau memakai alat:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Buka menu <strong>Booking Saya</strong></li>
          <li>Klik tombol <strong>Lapor Pengambilan</strong></li>
          <li>Foto alatnya (pastikan jelas)</li>
          <li>Submit — alat tercatat sudah diambil</li>
        </ol>
      </div>
    ),
  },
  {
    icon: RotateCcw,
    title: 'Lapor Pengembalian',
    body: (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>Setelah selesai pakai, klik <strong>Lapor Pengembalian</strong>. Foto alat + pilih kondisi (Baik / Rusak Ringan / Rusak Berat).</p>
        <p className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-200 text-[11px]">
          <strong>Serah terima antar kelas:</strong> Jika ada kelas lain pinjam alat yang sama di jam berikutnya, saat Anda serahkan = otomatis tercatat sebagai pengembalian untuk Anda, dan kelas berikutnya otomatis dinotifikasi.
        </p>
      </div>
    ),
  },
  {
    icon: Clock,
    title: 'Toleransi & Keterlambatan',
    body: (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>Anda punya toleransi <strong>10 menit</strong> setelah jam selesai untuk lapor pengembalian.</p>
        <p>Jika lewat dari 10 menit, status dianggap <strong>terlambat</strong>. Guru akan menerima notifikasi otomatis dan bisa mengirim WA pengingat ke Anda.</p>
      </div>
    ),
  },
  {
    icon: AlertTriangle,
    title: 'Batalkan Booking',
    body: (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>Anda bisa membatalkan booking selama belum disetujui (atau sudah disetujui tapi belum diambil).</p>
        <p className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-200 text-[11px]">
          <strong>Penting:</strong> Setelah dibatalkan, kelas Anda <strong>tidak bisa memesan slot yang sama</strong> untuk alat yang sama di tanggal & jam yang sama. Ini mencegah pembatalan berulang. Kelas lain tetap bisa.
        </p>
      </div>
    ),
  },
  {
    icon: Users,
    title: 'Koordinasi Lintas Kelas',
    body: (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>Jika ada serah terima alat antar kelas, gunakan fitur <strong>Koordinasi Lintas Kelas</strong> di menu utama untuk berkoordinasi dengan kelas berikutnya.</p>
        <p className="text-[11px] italic text-slate-500 dark:text-slate-400">
          Contoh: IX-A selesai pakai Gambus jam 16:00, IX-B pakai jam 16:00-17:00. IX-A serahkan ke IX-B — koordinasi via menu Koordinasi Lintas Kelas.
        </p>
      </div>
    ),
  },
];

export const BookingGuideModal: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const CurrentIcon = STEPS[step].icon;
  const isLast = step === STEPS.length - 1;

  const handleFinish = () => {
    try { localStorage.setItem('spppt-booking-guide-read', 'done'); } catch { /* ignore */ }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                <BookOpen className="w-5 h-5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Panduan</p>
                <h2 className="text-base font-black">Cara Booking Alat</h2>
              </div>
            </div>
            <button onClick={handleFinish} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition ${
                  i <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3 min-h-[280px]">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shrink-0">
              <CurrentIcon className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                Langkah {step + 1} dari {STEPS.length}
              </p>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {STEPS[step].title}
              </h3>
            </div>
          </div>
          <div className="pt-2">{STEPS[step].body}</div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Kembali
          </button>

          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition ${
                  i === step ? 'bg-indigo-600 w-4' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={handleFinish}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" /> Saya Paham
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
            >
              Lanjut <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};