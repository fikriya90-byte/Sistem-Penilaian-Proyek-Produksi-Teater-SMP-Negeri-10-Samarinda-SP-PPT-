import React, { useState, useEffect } from 'react';
import { Info, X, Sparkles, BookOpen, AlertCircle } from 'lucide-react';

interface PageGuideProps {
  currentModule: string;
  isTeacher: boolean;
}

const GUIDES: Record<string, { title: string; desc: string; tips: string[] }> = {
  dashboard: {
    title: 'Panduan Beranda',
    desc: 'Ini adalah halaman utama Anda. Di sini terlihat ringkasan aktivitas, tugas terdekat, dan status Anda saat ini.',
    tips: [
      'Perhatikan kotak "Tugas Saya" untuk melihat apa yang harus dikerjakan.',
      'Gunakan menu di samping (atau ikon di bawah untuk HP) untuk pindah ke halaman lain.'
    ]
  },
  absensi: {
    title: 'Panduan Presensi & Absensi',
    desc: 'Halaman ini khusus untuk mengisi kehadiran Anda. Sistem akan menutup absen otomatis jika waktu sudah habis.',
    tips: [
      'Cari sesi presensi yang sesuai dengan nama atau divisi Anda.',
      'Klik tombol "Hadir", "Izin", "Sakit", atau "Alpa" dengan jujur.',
      'Jika ada keterangan (misal: izin karena sakit), isi kolom catatan yang tersedia.'
    ]
  },
  jadwal: {
    title: 'Panduan Jadwal Kegiatan',
    desc: 'Di sini Anda bisa melihat jadwal latihan, rapat, atau gladi. Hanya jadwal yang ditujukan untuk Anda (atau divisi Anda) yang akan muncul.',
    tips: [
      'Klik tombol "Hadir" untuk mengonfirmasi bahwa Anda tahu dan akan datang.',
      'Jadwal buatan Sutradara (Latihan Pemain) berbeda dengan jadwal buatan Pimpinan Produksi (Rapat Pengurus).',
      'Gunakan tampilan "Kalender" untuk melihat jadwal sebulan penuh.'
    ]
  },
  tugas: {
    title: 'Panduan Tugas & Deadline',
    desc: 'Halaman ini berisi daftar tugas dari guru atau ketua divisi. Awasi terus hitung mundur (countdown) waktunya.',
    tips: [
      'Jika tugas sudah selesai, klik "Tandai Selesai".',
      'Khusus tahap PELAKSANAAN, Anda WAJIB mengunggah foto sebagai bukti.',
      'Jangan menunda, tugas yang terlambat akan memengaruhi nilai Anda.'
    ]
  },
  'nilai-saya': {
    title: 'Panduan Rapor & Nilai',
    desc: 'Ini adalah rapor digital Anda. Nilai akan otomatis muncul di sini setelah semua proses penilaian selesai.',
    tips: [
      'Jika nilai Anda terkunci (ada ikon gembok), artinya Anda belum menilai rekan kerja Anda. Selesaikan penilaian di menu "Penilaian 360".',
      'Anda bisa mengunduh rapor dalam bentuk Excel atau mencetaknya menjadi PDF.'
    ]
  },
  nilai: {
    title: 'Panduan Penilaian 360',
    desc: 'Halaman ini digunakan Anda untuk menilai rekan kerja, bawahan, atau atasan sesuai peran Anda.',
    tips: [
      'Hanya nama yang muncul di layar yang berhak Anda nilai.',
      'Berikan nilai 1-4 dengan jujur. Jika memberi nilai di bawah standar (1 atau 2), Anda WAJIB menuliskan alasannya di kolom komentar.'
    ]
  },
  studio: {
    title: 'Panduan Studio Teater',
    desc: 'Pusat latihan akting dan musik. Anda bisa membaca naskah, melihat posisi panggung, dan merekam suara.',
    tips: [
      'Gunakan fitur "Perekam Suara" untuk melatih intonasi dan hafalan dialog Anda.',
      'Lihat "Blocking Grid 3x3" agar Anda tahu harus berdiri di mana saat di panggung.'
    ]
  },
  booking: {
    title: 'Panduan Peminjaman Alat',
    desc: 'Pinjam alat musik atau properti sekolah di sini. Perhatikan aturan mainnya!',
    tips: [
      'Booking minimal H-2 sebelum hari pemakaian.',
      'Saat mengambil dan mengembalikan alat, Anda WAJIB memotret alat tersebut sebagai bukti.',
      'Kembalikan alat tepat waktu agar tidak dianggap terlambat.'
    ]
  },
  informasi: {
    title: 'Panduan Papan Informasi',
    desc: 'Tempat membaca pengumuman resmi dari Guru, Pimpinan Produksi, atau Sekretaris.',
    tips: [
      'Informasi dengan label "URGENT" atau "DISEMATKAN" adalah hal yang paling penting dan harus segera dibaca.',
      'Terkadang ada link Google Drive atau foto yang dilampirkan di dalam pengumuman.'
    ]
  },
  kas: {
    title: 'Panduan Kas Produksi',
    desc: 'Halaman untuk melihat status pembayaran iuran (kas) kelas Anda.',
    tips: [
      'Lihat tabel untuk memastikan apakah nama Anda sudah dicentang (lunas) atau belum oleh Bendahara.',
      'Jika Anda sudah bayar tapi belum tercentang, segera hubungi Bendahara dengan membawa bukti transfer.'
    ]
  }
};

export const PageGuide: React.FC<PageGuideProps> = ({ currentModule, isTeacher }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Tampilkan panduan otomatis setiap kali pindah halaman (khusus siswa)
  useEffect(() => {
    if (isTeacher) return; // Guru tidak perlu melihat panduan siswa terus-menerus
    if (GUIDES[currentModule]) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [currentModule, isTeacher]);

  if (isTeacher || !isVisible || !GUIDES[currentModule]) return null;

  const guide = GUIDES[currentModule];

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-sm relative animate-in fade-in slide-in-from-top-4">
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-blue-400 hover:bg-blue-100 hover:text-blue-700 transition"
        title="Tutup Panduan"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-3 sm:gap-4">
        <div className="p-2.5 rounded-xl bg-blue-500 text-white shrink-0 shadow-md">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="pr-8">
          <h3 className="text-sm font-black text-blue-950 flex items-center gap-1.5">
            {guide.title} <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </h3>
          <p className="text-xs text-blue-900 mt-1 leading-relaxed font-medium">
            {guide.desc}
          </p>
          
          <div className="mt-3 space-y-1.5 bg-white/60 p-3 rounded-xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Tips Penting:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              {guide.tips.map((tip, idx) => (
                <li key={idx} className="text-[11px] text-blue-800 leading-snug">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
