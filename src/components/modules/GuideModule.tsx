import React, { useState } from 'react';
import {
  Award, BookOpen, Calendar, CheckCircle, ChevronDown, ChevronRight,
  ClipboardList, HelpCircle, Radio, Sparkles, Users, Megaphone,
  Wallet, Calculator, Star, MessageSquare, Timer, Camera, Music,
  Palette, Scissors, Package, ShieldCheck, Lock, KeyRound, Eye,
  FileText, Briefcase, Layers, TrendingUp, Bell, Info, AlertTriangle,
  ArrowRight, UserCheck, Target, Play,
  CheckSquare, ShieldAlert,
} from 'lucide-react';
import { APP_CONFIG } from '../../core/constants';
import { useAuth } from '../../core/authContext';

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  color: string;
  content: React.ReactNode;
}

// =====================================================
// PANDUAN PER PERAN
// =====================================================
const ROLE_GUIDES: Record<string, { title: string; icon: any; color: string; desc: string; steps: string[] }> = {
  'Guru Pengampu': {
    title: 'Guru Pengampu / Pembina',
    icon: ShieldCheck,
    color: 'from-amber-700 to-orange-800',
    desc: 'Pengawas tertinggi, pembimbing artistik, penilai utama',
    steps: [
      'Buka Dashboard untuk melihat ringkasan seluruh aktivitas kelas',
      'Kelola Kelas → buat kelas baru, bagikan kode ke siswa, kelola akun',
      'Kelola Siswa → klik "Lihat Pass" untuk melihat email & password siswa, atau "Reset" untuk mengirim link reset password',
      'Kelola Tahapan → atur tahap aktif dan deadline pengerjaan tugas',
      'Jadwal Penilaian → atur kapan siswa boleh mengisi nilai (buka/tutup jadwal)',
      'Tugas & Deadline → kirim tugas dari template ke siswa',
      'Nilai & Penilaian → beri nilai siswa sesuai matriks. Guru bisa mengedit nilai yang diberikan oleh siswa lain (intervensi)',
      'Nilai & Penilaian → cek panel "Perlu Klarifikasi" untuk mendeteksi nilai anomali',
      'Moderasi → tinjau penilaian dari ketua dan rekan',
      'Statistik Presensi → lihat rekap kehadiran per siswa & divisi',
      'Backup & Restore → backup data Firestore ke JSON untuk arsip',
    ],
  },
  'Pimpinan Produksi': {
    title: 'Pimpinan Produksi (Pimpro)',
    icon: Sparkles,
    color: 'from-blue-800 to-indigo-900',
    desc: 'Manajer proyek, penyusun Master Schedule & LPJ',
    steps: [
      'Dashboard → lihat status keseluruhan produksi & progress 6 divisi',
      'Tugas & Deadline → kirim tugas ke divisi & peran terkait',
      'Presensi → buat sesi absensi pleno (semua siswa)',
      'Jadwal & Agenda → tambah jadwal rapat, gladi, dan pementasan',
      'Broadcast → kirim pengumuman siaran ke semua siswa',
      'Nilai & Penilaian → beri nilai Sekretaris, Bendahara, dan Koordinator Divisi',
      'Setelah selesai: susun LPJ & serahkan ke Guru',
    ],
  },
  'Sekretaris': {
    title: 'Sekretaris Administrasi',
    icon: FileText,
    color: 'from-blue-700 to-blue-900',
    desc: 'Presensi harian, arsip dokumen, notulen rapat',
    steps: [
      'Presensi → buat sesi absensi untuk rapat pleno / lintas divisi',
      'Jadwal & Agenda → tambah jadwal internal untuk rapat koordinasi',
      'Dokumen & Arsip → unggah draf naskah, notulen, proposal ke arsip web',
      'Broadcast → kirim pengumuman resmi ke tim',
      'Nilai & Penilaian → beri nilai Pimpinan Produksi (sebagai feedback ke atasan)',
      'Setelah selesai: susun & distribusikan sertifikat/surat apresiasi',
    ],
  },
  'Bendahara': {
    title: 'Bendahara Keuangan & Logistik',
    icon: Wallet,
    color: 'from-emerald-700 to-green-900',
    desc: 'RAB, kas produksi, buku kas, nota, LPJ keuangan',
    steps: [
      'Kas & Buku Kas → aktifkan fitur kas, centang pembayaran siswa per periode',
      'Buku Kas → catat pemasukan & pengeluaran',
      'Export Excel → 4 sheet: Ringkasan, Pemasukan, Pengeluaran, Rekap Periode',
      'RAB Digital → susun RAB per divisi/peran/umum dengan estimasi biaya',
      'Unggah RAB Final yang sudah ditandatangani ke menu RAB',
      'Nilai & Penilaian → beri nilai Pimpinan Produksi',
      'Setelah selesai: susun tabel Perbandingan Anggaran & LPJ Keuangan',
    ],
  },
  'Sutradara': {
    title: 'Sutradara',
    icon: Star,
    color: 'from-rose-700 to-pink-900',
    desc: 'Visi artistik, casting, penilai utama aktor',
    steps: [
      'Studio & Naskah → 3x3 blocking grid untuk blocking panggung',
      'Simpan posisi aktor di 9 zona panggung',
      'Editor Cue Sheet untuk instruksi cue musik & lampu',
      'Presensi → buat sesi latihan untuk Pemain + Tata Musik',
      'Nilai & Penilaian → beri nilai Asisten Sutradara, Pemain, dan Koordinator Artistik',
      'Setelah selesai: tulis analisis perkembangan keaktoran individual via web',
    ],
  },
  'Asisten Sutradara': {
    title: 'Asisten Sutradara (Astrada)',
    icon: Play,
    color: 'from-purple-700 to-indigo-900',
    desc: 'Prompt book, cue sheet, catatan latihan',
    steps: [
      'Studio → Prompt Book untuk kelola cue sheet audio & lighting',
      'Susun Call Sheet latihan per adegan',
      'Presensi → buat absensi latihan Pemain + Musik',
      'Nilai & Penilaian → beri nilai Pemain (bawahan) & Sutradara (feedback)',
      'Setelah selesai: konsolidasi catatan perkembangan pemain ke arsip',
    ],
  },
  'Koordinator Perlengkapan': {
    title: 'Koordinator Perlengkapan',
    icon: Package,
    color: 'from-blue-700 to-blue-900',
    desc: 'Properti, bahan daur ulang, inventaris',
    steps: [
      'Properti → daftar properti per adegan, update status properti',
      'Presensi → buat sesi absensi internal divisi',
      'Jadwal Divisi → tambah jadwal internal divisi',
      'Nilai & Penilaian → beri nilai Anggota Perlengkapan & Pimpinan Produksi',
      'Setelah selesai: kembalikan inventaris sekolah & update status barang',
    ],
  },
  'Koordinator Publikasi': {
    title: 'Koordinator Publikasi & Dokumentasi',
    icon: Camera,
    color: 'from-emerald-700 to-green-900',
    desc: 'Poster, konten, BTS, aftermovie',
    steps: [
      'Jadwal Konten → susun kalender konten (H-30, H-14, H-7, H-1, Hari-H)',
      'Dokumen & Arsip → unggah foto & video Behind the Scene',
      'Nilai & Penilaian → beri nilai Anggota Publikasi & Pimpinan Produksi',
      'Setelah selesai: sunting aftermovie & arsipkan semua media ke Drive',
    ],
  },
  'Koordinator Tata Panggung': {
    title: 'Koordinator Tata Panggung',
    icon: Layers,
    color: 'from-purple-700 to-purple-900',
    desc: 'Desain panggung, set, cross-operator',
    steps: [
      'Properti → kelola properti panggung (set, backdrop)',
      'Presensi internal divisi Tata Panggung',
      'Nilai & Penilaian → beri nilai Anggota Panggung & Sutradara',
      'Setelah selesai: bongkar set & kembalikan panggung ke kondisi semula',
    ],
  },
  'Koordinator Tata Rias': {
    title: 'Koordinator Tata Rias',
    icon: Palette,
    color: 'from-pink-700 to-rose-900',
    desc: 'Face chart, rias karakter/fantasi, higienitas',
    steps: [
      'Face Chart → buat desain rias per pemain (Korektif / Karakter / Fantasi)',
      'Unggah moodboard & face chart ke web',
      'Nilai & Penilaian → beri nilai Anggota Rias & Sutradara',
      'Setelah selesai: dampingi pembersihan rias & sterilkan alat',
    ],
  },
  'Koordinator Tata Busana': {
    title: 'Koordinator Tata Busana',
    icon: Scissors,
    color: 'from-indigo-700 to-indigo-900',
    desc: 'Desain kostum, fitting, quick change',
    steps: [
      'Kostum → tambah kostum untuk karakter & pemain',
      'Track progress: DESAIN → POTONG → JAHIT → FITTING → SELESAI',
      'Nilai & Penilaian → beri nilai Anggota Busana & Sutradara',
      'Setelah selesai: cuci, bersihkan, & kembalikan aset kostum',
    ],
  },
  'Koordinator Tata Musik': {
    title: 'Koordinator Tata Musik & Suara',
    icon: Music,
    color: 'from-cyan-700 to-blue-900',
    desc: 'Cue sheet audio, sound check, instrumen',
    steps: [
      'Cue Sheet → tambah cue audio: Overture, Penutup, Pergantian Babak, dll',
      'Simpan URL audio, volume, durasi per cue',
      'Nilai & Penilaian → beri nilai Anggota Musik & Sutradara',
      'Setelah selesai: rapikan & kembalikan instrumen ke penyimpanan',
    ],
  },
  'Anggota Perlengkapan': {
    title: 'Anggota Divisi Perlengkapan',
    icon: Package,
    color: 'from-blue-600 to-blue-800',
    desc: 'Produksi properti, bahan daur ulang',
    steps: [
      'Tugas & Deadline → tekan "Tandai Selesai" pada tugas yang sudah dikerjakan',
      'Properti → tambah/update properti yang Anda kerjakan',
      'Jadwal Divisi Saya → lihat agenda internal divisi',
      'Presensi → isi kehadiran Anda di setiap sesi',
      'Nilai & Penilaian → beri nilai Koordinator Perlengkapan & sesama Anggota',
      'Nilai Saya → lihat rapor pribadi (jika sudah menilai teman)',
    ],
  },
  'Anggota Publikasi': {
    title: 'Anggota Divisi Publikasi & Dokumentasi',
    icon: Camera,
    color: 'from-emerald-600 to-emerald-800',
    desc: 'Foto, video, BTS, media sosial',
    steps: [
      'Tugas & Deadline → tekan "Tandai Selesai" dan tambahkan link media dari Drive',
      'Dokumen & Arsip → unggah foto/video ke arsip digital',
      'Jadwal Konten → lihat kalender publikasi',
      'Presensi → isi kehadiran di setiap sesi',
      'Nilai & Penilaian → beri nilai Koordinator Publikasi & sesama Anggota',
    ],
  },
  'Anggota Tata Panggung': {
    title: 'Anggota Divisi Tata Panggung',
    icon: Layers,
    color: 'from-purple-600 to-purple-800',
    desc: 'Konstruksi set, spotting, dekorasi',
    steps: [
      'Tugas & Deadline → tekan "Tandai Selesai" dan tambahkan catatan',
      'Properti → update status pekerjaan konstruksi',
      'Presensi → isi kehadiran',
      'Nilai & Penilaian → beri nilai Koor Panggung & sesama Anggota',
    ],
  },
  'Anggota Tata Rias': {
    title: 'Anggota Divisi Tata Rias',
    icon: Palette,
    color: 'from-pink-600 to-rose-800',
    desc: 'Aplikasi rias, higienitas alat',
    steps: [
      'Tugas & Deadline → tekan "Tandai Selesai" pada tugas yang sudah dikerjakan',
      'Face Chart → lihat desain rias dari koordinator',
      'Presensi → isi kehadiran',
      'Nilai & Penilaian → beri nilai Koor Rias & sesama Anggota',
    ],
  },
  'Anggota Tata Busana': {
    title: 'Anggota Divisi Tata Busana',
    icon: Scissors,
    color: 'from-indigo-600 to-indigo-800',
    desc: 'Jahit, modifikasi, fitting',
    steps: [
      'Tugas & Deadline → tekan "Tandai Selesai" pada tugas yang sudah dikerjakan',
      'Kostum → update status kostum yang Anda kerjakan',
      'Presensi → isi kehadiran',
      'Nilai & Penilaian → beri nilai Koor Busana & sesama Anggota',
    ],
  },
  'Anggota Tata Musik': {
    title: 'Anggota Divisi Tata Musik & Suara',
    icon: Music,
    color: 'from-cyan-600 to-cyan-800',
    desc: 'Musik, sound, instrumen',
    steps: [
      'Tugas & Deadline → tekan "Tandai Selesai" pada tugas yang sudah dikerjakan',
      'Cue Sheet → lihat & update cue audio',
      'Presensi → isi kehadiran',
      'Nilai & Penilaian → beri nilai Koor Musik & sesama Anggota',
    ],
  },
  'Pemain': {
    title: 'Pemain (Aktor / Aktris)',
    icon: Star,
    color: 'from-rose-600 to-pink-800',
    desc: 'Akting, hafalan dialog, blocking, refleksi',
    steps: [
      'Naskah & Blocking → baca naskah digital & lihat blocking 3x3',
      'Rekam suara latihan dialog dengan fitur Perekam Suara',
      'Tugas & Deadline → tekan "Tandai Selesai" & kirim hafalan via video',
      'Presensi → isi kehadiran di setiap sesi',
      'Nilai & Penilaian → WAJIB beri nilai Sutradara, Astrada, & sesama Pemain',
      'Nilai Saya → lihat rapor (hanya terbuka jika sudah selesai menilai teman)',
    ],
  },
};

export const GuideModule: React.FC = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('my-role');
  const [showAllRoles, setShowAllRoles] = useState(false);

  const myRole = user?.role || 'Pemain';
  const myGuide = ROLE_GUIDES[myRole];

  const SECTIONS: GuideSection[] = [
    // ============================================
    // 1. PANDUAN PERAN ANDA
    // ============================================
    {
      id: 'my-role',
      title: `Panduan untuk Peran Anda: ${myRole}`,
      icon: myGuide?.icon || UserCheck,
      color: myGuide?.color || 'from-amber-600 to-orange-800',
      content: (
        <div className="space-y-4">
          {myGuide ? (
            <>
              <div className={`p-4 rounded-2xl bg-gradient-to-r ${myGuide.color} text-white`}>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm shrink-0">
                    <myGuide.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{myGuide.title}</h3>
                    <p className="text-xs opacity-90 mt-0.5">{myGuide.desc}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Yang bisa Anda lakukan:
                  </p>
                </div>
                <div className="space-y-2">
                  {myGuide.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-500/20">
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  Panduan ini dapat dibuka berkali-kali kapan pun Anda butuh.
                  Sidebar menu menampilkan fitur sesuai wewenang peran Anda.
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic text-center py-4">
              Panduan untuk peran "{myRole}" belum tersedia.
            </p>
          )}
        </div>
      ),
    },

    // ============================================
    // 2. PANDUAN PENILAIAN 360°
    // ============================================
    {
      id: 'assessment-guide',
      title: 'Panduan Penilaian 360° & Aturan Kunci',
      icon: Award,
      color: 'from-indigo-600 to-purple-800',
      content: (
        <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
            <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" /> 3 Aturan Kunci Sistem
            </h4>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Kunci Nilai Siswa (Peer Gate):</strong> Siswa <strong>TIDAK BISA</strong> melihat nilai mereka jika belum menyelesaikan penilaian ke rekan kerjanya. Jika belum lengkap, halaman "Nilai Saya" akan terkunci.</li>
              <li><strong>Hak Edit Terbatas:</strong> Siswa hanya bisa mengisi nilai untuk teman yang ada di matriks penilaiannya. Siswa <strong>TIDAK BISA</strong> mengedit nilai dirinya sendiri, dan <strong>TIDAK BISA</strong> mengedit nilai yang sudah diisi oleh Guru atau temannya.</li>
              <li><strong>Kunci Waktu:</strong> Guru harus membuka "Jadwal Penilaian". Di luar jadwal tersebut, siswa tidak bisa mengisi nilai.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-200 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Alur Penilaian untuk Siswa
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Buka menu <strong>Penilaian 360</strong>.</li>
              <li>Anda hanya melihat daftar teman yang <strong>memang menjadi jatah Anda untuk dinilai</strong>. Siswa lain tidak akan muncul.</li>
              <li>Klik tombol <strong>Isi</strong>, lalu berikan nilai 1-4.</li>
              <li>Wajib isi komentar jika memberi nilai ≤ 2.</li>
              <li>Setelah semua jatah dinilai, barulah menu <strong>Nilai Saya</strong> bisa dibuka.</li>
            </ol>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
            <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Kendali Penuh Guru
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Bypass Lock:</strong> Guru/Admin tetap bisa menilai meskipun jadwal penilaian sedang ditutup.</li>
              <li><strong>Intervensi Nilai:</strong> Guru bisa mengedit nilai yang diberikan oleh siswa (rekan) melalui tombol "Edit Nilai" di modal detail.</li>
              <li><strong>Reset & Moderasi:</strong> Guru bisa mereset nilai satu tahap atau melihat daftar anomali (nilai seragam/ekstrem).</li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <h4 className="font-bold text-blue-900 dark:text-blue-200 text-[11px] mb-1">Rumus Auto-Score (Sistem):</h4>
            <ul className="list-disc pl-5 text-[11px] space-y-0.5">
              <li><strong>Tanggung Jawab (25%):</strong> Dari % tugas tepat waktu.</li>
              <li><strong>Kehadiran (20%):</strong> Dari % presensi.</li>
              <li><strong>Safety Net:</strong> Jika tidak mengerjakan tugas sama sekali, nilai maksimal 70.</li>
            </ul>
          </div>
        </div>
      ),
    },

    // ============================================
    // 3. PENGANTAR SP-PPT
    // ============================================
    {
      id: 'intro',
      title: 'Pengantar SP-PPT',
      icon: BookOpen,
      color: 'from-slate-700 to-slate-900',
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <p>
            <strong>SP-PPT (Sistem Penilaian & Manajemen Proyek Produksi Teater)</strong> adalah platform
            web resmi pembelajaran Seni Budaya (Seni Teater) Kelas IX di SMP Negeri 10 Samarinda.
          </p>
          <p>
            Sistem ini mendokumentasikan, mengelola alur kerja, dan menilai proses produksi teater
            secara holistik dari tahap <strong>Pra-Produksi → Pelaksanaan → Show Time → Pasca-Produksi</strong>.
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/30">
            <p className="text-amber-900 dark:text-amber-200 font-bold text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Prinsip Utama:
            </p>
            <p className="text-amber-800 dark:text-amber-300 text-[11px] mt-1">
              Penilaian tidak hanya melihat hari-H pertunjukan di panggung, tetapi menghargai setiap
              tetes keringat proses latihan, koordinasi divisi, dan kedisiplinan kerja tim.
            </p>
          </div>
        </div>
      ),
    },

    // ============================================
    // 4. SEMUA PERAN
    // ============================================
    {
      id: 'all-roles',
      title: 'Daftar Semua Peran & Wewenang',
      icon: Users,
      color: 'from-purple-700 to-indigo-900',
      content: (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Sistem membedakan hak akses secara ketat berdasarkan hierarki kepanitiaan produksi.
            Klik peran untuk melihat detail.
          </p>
          <button
            onClick={() => setShowAllRoles(!showAllRoles)}
            className="w-full p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-purple-800 dark:text-purple-300 font-bold text-xs flex items-center justify-between"
          >
            <span>{showAllRoles ? 'Sembunyikan Detail Semua Peran' : 'Tampilkan Detail Semua Peran'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAllRoles ? 'rotate-180' : ''}`} />
          </button>

          {showAllRoles && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(ROLE_GUIDES).map(([roleKey, guide]) => {
                const Icon = guide.icon;
                const isMe = roleKey === myRole;
                return (
                  <div key={roleKey} className={`p-3 rounded-xl border-2 ${
                    isMe ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${guide.color} text-white shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{guide.title}</p>
                          {isMe && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                              Anda
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{guide.desc}</p>
                      </div>
                    </div>
                    <ul className="text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5 pl-4 list-disc">
                      {guide.steps.slice(0, 3).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                      {guide.steps.length > 3 && (
                        <li className="text-slate-400 italic">...dan {guide.steps.length - 3} langkah lain</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },

    // ============================================
    // 5. VERIFIKASI LOGIN
    // ============================================
    {
      id: 'verify-login',
      title: 'Verifikasi Login & Keamanan',
      icon: ShieldCheck,
      color: 'from-emerald-700 to-green-900',
      content: (
        <div className="space-y-3 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Setiap kali berhasil login, sistem akan menampilkan <strong>kartu verifikasi</strong>:
            foto, nama, email, peran, dan kelas Anda.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Jika ini Anda
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Klik tombol hijau <strong>"Ya, Saya Benar"</strong> untuk lanjut.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
              <p className="font-bold text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Jika bukan Anda
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
                Klik <strong>"Bukan Saya"</strong> untuk langsung logout.
              </p>
            </div>
          </div>
        </div>
      ),
    },

    // ============================================
    // 6. FAQ
    // ============================================
    {
      id: 'faq',
      title: 'FAQ & Troubleshooting',
      icon: HelpCircle,
      color: 'from-slate-700 to-slate-900',
      content: (
        <div className="space-y-3 text-xs">
          {[
            {
              q: 'Lupa password, bagaimana?',
              a: 'Hubungi Guru Pengampu. Guru bisa membuka menu Kelola Siswa: tombol "Lihat Pass" menampilkan email dan password Anda, sedangkan tombol "Reset" mengirim link reset password ke email Anda.',
            },
            {
              q: 'Kenapa nilai saya tidak muncul di menu "Nilai Saya"?',
              a: 'Ada dua kemungkinan: (1) Anda belum menyelesaikan penilaian rekan kerja (Peer Assessment). Selesaikan dulu di menu Penilaian 360. (2) Guru belum membuka jadwal penilaian untuk tahap tersebut.',
            },
            {
              q: 'Kenapa tombol "Isi" tidak ada di nama teman saya?',
              a: 'Sistem hanya menampilkan nama teman yang menjadi jatah penilaian Anda sesuai matriks. Jika nama teman tidak muncul, berarti Anda tidak berhak menilainya.',
            },
            {
              q: 'Saat login muncul "Role tidak cocok dengan tab"?',
              a: 'Anda login di tab yang salah. Contoh: akun siswa tapi login di tab Guru. Ikuti tombol "Ganti ke Tab [X]" yang muncul.',
            },
            {
              q: 'Notifikasi tidak muncul di bell?',
              a: 'Cek: (1) koneksi internet, (2) izin notifikasi browser, (3) refresh halaman.',
            },
            {
              q: 'Kenapa tombol Nilai tidak bisa dipakai?',
              a: 'Tahap yang dipilih mungkin sedang nonaktif, penilaian dinonaktifkan, atau waktu penilaian sudah berakhir. Pesan di bagian atas halaman Penilaian 360 akan menjelaskan kondisinya.',
            },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-900 dark:text-white text-xs flex items-start gap-2">
                <span className="text-amber-500 shrink-0">T:</span>
                <span>{item.q}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1.5 flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-500 font-bold shrink-0">J:</span>
                <span>{item.a}</span>
              </p>
            </div>
          ))}
        </div>
      ),
    },

    // ============================================
    // 7. TENTANG APLIKASI
    // ============================================
    {
      id: 'about',
      title: 'Tentang SP-PPT',
      icon: Info,
      color: 'from-slate-700 to-slate-900',
      content: (
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30">
            <p className="font-black text-slate-900 dark:text-white text-sm">{APP_CONFIG.appName}</p>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1">{APP_CONFIG.tagline}</p>
            <div className="mt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <p><strong>Sekolah:</strong> {APP_CONFIG.schoolName}</p>
              <p><strong>Tahun Ajaran:</strong> {APP_CONFIG.academicYear}</p>
              <p><strong>Mata Pelajaran:</strong> Seni Budaya (Seni Teater)</p>
              <p><strong>Kelas:</strong> IX (Sembilan)</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>© 2026 {APP_CONFIG.schoolName}.</strong> Hak cipta dilindungi undang-undang.
              Platform dikembangkan untuk pembelajaran Seni Teater secara terintegrasi.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const toggleSection = (id: string) => {
    setActiveSection(activeSection === id ? '' : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-900 via-slate-900 to-slate-800 text-white shadow-xl border border-amber-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <HelpCircle className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              Panduan Resmi
            </span>
            <h2 className="text-xl font-black text-white mt-1">Panduan Operasional SP-PPT</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Pedoman lengkap untuk setiap peran — dapat dibuka berkali-kali
            </p>
          </div>
        </div>

        {/* Your role badge */}
        {user && (
          <div className="mt-4 p-3 rounded-2xl bg-white/10 border border-white/20 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Login sebagai
              </p>
              <p className="text-sm font-black text-white truncate">
                {user.displayName} — {myRole}
                {user.divisionName && <span className="text-amber-200 font-normal"> • {user.divisionName}</span>}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Accordion Sections */}
      <div className="space-y-3">
        {SECTIONS.map(sec => {
          const isOpen = activeSection === sec.id;
          const Icon = sec.icon;

          return (
            <div
              key={sec.id}
              className={`rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-sm overflow-hidden transition ${
                isOpen
                  ? 'border-amber-300 dark:border-amber-500/50 shadow-md'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSection(sec.id)}
                className="w-full p-5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${sec.color} text-white shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {sec.title}
                  </h3>
                </div>

                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
                    isOpen ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-700 animate-in fade-in">
                  {sec.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Panduan ini dapat dibuka berkali-kali.</strong> Jika ada pertanyaan atau fitur yang belum
          dipahami, hubungi Guru Pengampu atau Pimpinan Produksi kelas Anda.
        </div>
      </div>
    </div>
  );
};