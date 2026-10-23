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
    desc: 'Halaman ini khusus untuk mengisi kehadiran Anda. Sistem akan menutup absen otomatis jika waktu yang ditentukan sudah habis.',
    tips: [
      'Cari sesi presensi yang sesuai dengan nama atau divisi Anda.',
      'Klik tombol "Hadir", "Izin", "Sakit", atau "Alpa" dengan jujur.',
      'Jika ada keterangan (misal: izin karena sakit), isi kolom catatan yang tersedia.'
    ]
  },
  jadwal: {
    title: 'Panduan Kalender Kegiatan',
    desc: 'Di sini Anda bisa melihat agenda rapat atau gladi besar. Hanya jadwal yang ditujukan untuk Anda (atau divisi Anda) yang akan muncul.',
    tips: [
      'Klik tombol "Hadir" untuk mengonfirmasi bahwa Anda tahu dan akan datang.',
      'Untuk jadwal latihan rutin khusus divisi Anda, silakan cek menu "Jadwal Divisi".',
      'Gunakan tampilan "Kalender" untuk melihat jadwal sebulan penuh.'
    ]
  },
  'division-schedule': {
    title: 'Panduan Jadwal Internal Divisi',
    desc: 'Ini adalah jadwal khusus untuk divisi Anda (dibuat oleh Koordinator Divisi Anda).',
    tips: [
      'Hanya anggota divisi yang bisa melihat jadwal ini.',
      'Jika Anda Koordinator, Anda bisa menambah dan menghapus jadwal di sini.'
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
  'progress-tugas': {
    title: 'Panduan Progress Tugas',
    desc: 'Lihat seberapa jauh Anda dan teman-teman satu kelas telah menyelesaikan tugas-tugas yang diberikan.',
    tips: [
      'Gunakan grafik dan tabel untuk melihat siapa yang sudah selesai dan belum.',
      'Jika progress Anda rendah, segera hubungi koordinator divisi Anda untuk bantuan.'
    ]
  },
  'nilai-saya': {
    title: 'Panduan Rapor & Nilai',
    desc: 'Ini adalah rapor digital Anda. Nilai akan otomatis muncul di sini setelah proses penilaian selesai.',
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
  },
  properti: {
    title: 'Panduan Manajemen Properti',
    desc: 'Halaman ini digunakan Divisi Perlengkapan untuk mendata barang, set panggung, dan properti yang dipakai.',
    tips: [
      'Update status pembuatan properti (Belum, Proses, Selesai) secara berkala.',
      'Pastikan barang yang dicatat sesuai dengan kebutuhan adegan di naskah.'
    ]
  },
  rias: {
    title: 'Panduan Tata Rias & Face Chart',
    desc: 'Divisi Tata Rias menggunakan halaman ini untuk merancang desain makeup (Face Chart) tiap pemain.',
    tips: [
      'Unggah foto referensi (moodboard) agar memudahkan saat merias di hari-H.',
      'Bagi tugas per pemain (siapa merias siapa) agar tidak menumpuk di satu orang.'
    ]
  },
  busana: {
    title: 'Panduan Tata Busana & Kostum',
    desc: 'Halaman untuk melacak proses pembuatan kostum, dari desain, potong kain, jahit, hingga fitting.',
    tips: [
      'Isi ukuran badan pemain (LD, LP, dll) agar kostum pas dan tidak perlu bolak-balik revisi.',
      'Catat jumlah kain (meteran) yang dibutuhkan agar Bendahara bisa menyiapkan dana.'
    ]
  },
  musik: {
    title: 'Panduan Musik & Cue Sheet',
    desc: 'Halaman untuk mendata lagu apa saja yang diputar, kapan diputar (Cue), dan berapa volumenya.',
    tips: [
      'Gunakan link YouTube atau Google Drive agar file mudah diakses oleh operator.',
      'Selalu lakukan "Sound Check" sebelum pementasan dimulai.'
    ]
  },
  aduan: {
    title: 'Panduan Aduan & Konseling',
    desc: 'Gunakan fitur ini JIKA Anda mengalami masalah serius (Bullying, Kekerasan, dsb) yang butuh bantuan Guru segera.',
    tips: [
      'Tulis kronologi kejadian dengan jelas dan lengkap.',
      'Aduan akan langsung diteruskan ke WhatsApp Guru. Jangan takut, identitas Anda dirahasiakan.'
    ]
  },
  dokumen: {
    title: 'Panduan Arsip Dokumen',
    desc: 'Pusat penyimpanan file naskah, proposal, LPJ, dan dokumentasi foto/video.',
    tips: [
      'Gunakan Google Drive untuk menyimpan file, lalu tempel link-nya di sini.',
      'Beri nama file yang rapi (contoh: Naskah_Babak1.pdf) agar mudah dicari.'
    ]
  },
  struktur: {
    title: 'Panduan Kerabat Kerja',
    desc: 'Lihat siapa saja yang terlibat dalam produksi ini beserta peran dan kontak WhatsApp mereka.',
    tips: [
      'Klik tombol "Chat WA" jika Anda perlu menghubungi koordinator atau teman satu tim.',
      'Jika ada nomor WA yang kosong, minta mereka mengisinya di menu Pengaturan.'
    ]
  }
};

export const PageGuide: React.FC<PageGuideProps> = ({ currentModule, isTeacher }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isTeacher) return; // Panduan hanya untuk siswa
    if (GUIDES[currentModule]) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [currentModule, isTeacher]);

  if (isTeacher || !isVisible || !GUIDES[currentModule]) return null;

  const guide = GUIDES[currentModule];

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-sm relative animate-in fade-in slide-in-from-top-4 print:hidden">
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
