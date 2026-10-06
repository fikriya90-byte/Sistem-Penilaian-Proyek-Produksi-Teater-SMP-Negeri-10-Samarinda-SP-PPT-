import React, { useState } from 'react';
import {
  Award, BookOpen, Calendar, CheckCircle, ChevronDown, ChevronRight,
  ClipboardList, HelpCircle, Radio, Sparkles, Users, Megaphone,
  Wallet, Calculator, Star, MessageSquare, Timer, Camera, Music,
  Palette, Scissors, Package, ShieldCheck, Lock, KeyRound, Eye,
  FileText, Briefcase, Layers, TrendingUp, Bell, Info, AlertTriangle,
  ArrowRight, UserCheck, Target, Play,
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
    desc: 'Pengawas tertinggi, pembimbing artistik, penilai 50%',
    steps: [
      'Buka Dashboard untuk melihat ringkasan seluruh aktivitas kelas',
      'Kelola Kelas → buat kelas baru, bagikan kode ke siswa, kelola akun',
      'Lihat & Reset Password siswa jika mereka lupa: Kelola Kelas → tab Siswa → tombol "Lihat"',
      'Kelola Tahapan → atur deadline per tahapan produksi (Persiapan, Pelaksanaan, Pertunjukan, Pasca)',
      'Tugas & Deadline → kirim template tugas ke siswa (bisa multi-template & multi-target)',
      'Nilai & Penilaian → beri nilai Sutradara dan Pimpinan Produksi (bobot Guru 50%)',
      'Moderasi → cek anomali penilaian dari ketua/rekan',
      'Statistik Presensi → lihat rekap kehadiran per siswa & divisi',
      'Backup & Restore → backup data Firestore ke JSON untuk arsip',
      'Panduan ini bisa dibuka berkali-kali kapan pun dibutuhkan',
    ],
  },
  'Pimpinan Produksi': {
    title: 'Pimpinan Produksi (Pimpro)',
    icon: Sparkles,
    color: 'from-blue-800 to-indigo-900',
    desc: 'Manajer proyek, penyusun Master Schedule & LPJ',
    steps: [
      'Dashboard → lihat status keseluruhan produksi & progress 6 divisi',
      'Susun Master Production Schedule & validasi RAB bersama Bendahara',
      'Tugas & Deadline → kirim tugas ke divisi & peran terkait',
      'Presensi → buat sesi absensi pleno (semua siswa) atau lintas divisi',
      'Jadwal & Agenda → tambah jadwal rapat, gladi, dan pementasan',
      'Struktur Kerabat → ubah nama kerabat kerja (opsi Guru & Pimpro)',
      'Broadcast → kirim pengumuman siaran ke semua siswa',
      'Nilai & Penilaian → beri nilai Sekretaris, Bendahara, dan Koor Divisi',
      'Saat Show Time: pimpin Taklimat 10 menit sebelum pintu dibuka',
      'Kendalikan waktu: 10 menit persiapan + 30 menit tampil + 5 menit bongkar',
      'Setelah selesai: susun LPJ & serahkan ke Guru',
    ],
  },
  'Sekretaris': {
    title: 'Sekretaris Administrasi',
    icon: FileText,
    color: 'from-blue-700 to-blue-900',
    desc: 'Presensi harian, arsip dokumen, notulen rapat',
    steps: [
      'Dashboard → lihat sesi presensi aktif & agenda hari ini',
      'Presensi → buat sesi absensi untuk rapat pleno / lintas divisi',
      'Isi Buku Log Produksi (catat kehadiran tiap sesi latihan & hasil rapat)',
      'Jadwal & Agenda → tambah jadwal internal untuk rapat koordinasi',
      'Dokumen & Arsip → unggah draf naskah, notulen, proposal ke arsip web',
      'Broadcast → kirim pengumuman resmi ke tim',
      'Nilai & Penilaian → beri nilai Pimpinan Produksi (feedback ke atasan)',
      'Saat Show Time: bertugas di Front of House (FOH) — arahkan antrean, validasi tiket, bagikan buku acara',
      'Catat statistik riil jumlah penonton',
      'Setelah selesai: susun & distribusikan sertifikat/surat apresiasi, arsipkan semua dokumen',
    ],
  },
  'Bendahara': {
    title: 'Bendahara Keuangan & Logistik',
    icon: Wallet,
    color: 'from-emerald-700 to-green-900',
    desc: 'RAB, kas produksi, buku kas, nota, LPJ keuangan',
    steps: [
      'Dashboard → lihat saldo, pemasukan, pengeluaran, capaian kas',
      'Kas & Buku Kas → aktifkan fitur kas (kesepakatan kelas) dengan nominal & periode',
      'Centang pembayaran siswa per periode. Saldo terakumulasi otomatis',
      'Buku Kas → catat pemasukan (kas siswa, sumbangan) & pengeluaran (beli properti, konsumsi)',
      'Export Excel → 4 sheet: Ringkasan, Pemasukan, Pengeluaran, Rekap Periode',
      'RAB Digital → susun RAB per divisi/peran/umum dengan estimasi biaya',
      'Export RAB ke Word (.doc) untuk ditandatangani Pimpro',
      'Unggah RAB Final yang sudah ditandatangani ke menu RAB',
      'Kirim Reminder santun ke siswa yang belum bayar',
      'Saat Show Time: siapkan Tas Logistik Darurat (P3K, peniti, selotip, air minum)',
      'Setelah selesai: susun tabel Perbandingan Anggaran (estimasi vs realisasi) & LPJ Keuangan',
    ],
  },
  'Sutradara': {
    title: 'Sutradara',
    icon: Star,
    color: 'from-rose-700 to-pink-900',
    desc: 'Visi artistik, casting, penilai utama aktor',
    steps: [
      'Dashboard → lihat 6 kriteria akting pemain & progres latihan',
      'Studio & Naskah → 3x3 blocking grid untuk blocking panggung',
      'Simpan posisi aktor di 9 zona panggung (UL, UC, UR, CL, C, CR, DL, DC, DR)',
      'Editor Cue Sheet untuk instruksi cue musik & lampu',
      'Presensi → buat sesi latihan untuk Pemain + Tata Musik (peserta terkunci)',
      'Nilai & Penilaian → beri nilai Pemain (6 kriteria: Hafalan, Penjiwaan, Suara, Blocking, Interaksi, Disiplin)',
      'Juga nilai Asisten Sutradara & Koor artistik (Busana, Rias, Panggung, Musik)',
      'Saat Show Time: pimpin gladi bersih & pastikan durasi tepat 30 menit',
      'Beri motivasi akhir & input nilai keaktoran saat pementasan',
      'Setelah selesai: tulis analisis perkembangan keaktoran individual via web',
    ],
  },
  'Asisten Sutradara': {
    title: 'Asisten Sutradara (Astrada)',
    icon: Play,
    color: 'from-purple-700 to-indigo-900',
    desc: 'Prompt book, cue sheet, catatan latihan',
    steps: [
      'Dashboard → lihat status pemain & cue berikutnya',
      'Studio → Prompt Book untuk kelola cue sheet audio & lighting',
      'Susun Call Sheet latihan per adegan',
      'Kelola setor hafalan dialog pemain via video/audio',
      'Latih Shadow Player (pemain cadangan)',
      'Presensi → buat absensi latihan Pemain + Musik',
      'Nilai Pemain (aspek teknis: Hafalan, Blocking, Interaksi)',
      'Nilai Sutradara & Koor artistik (feedback ke atasan)',
      'Saat Show Time: panggil pemain ke wing, pandu pemanasan vokal',
      'Kontrol urutan adegan sesuai 30 menit',
      'Siap gantikan Sutradara jika berhalangan',
      'Setelah selesai: konsolidasi catatan perkembangan pemain ke arsip',
    ],
  },
  'Koordinator Perlengkapan': {
    title: 'Koordinator Perlengkapan',
    icon: Package,
    color: 'from-blue-700 to-blue-900',
    desc: 'Properti, bahan daur ulang, inventaris',
    steps: [
      'Dashboard → lihat 6 divisi & progress perlengkapan',
      'Properti → daftar properti per adegan (maks prioritas daur ulang)',
      'Update status properti: BELUM / PROSES / SELESAI / RUSAK',
      'Presensi → buat sesi absensi internal divisi Perlengkapan (peserta terkunci ke anggota)',
      'Jadwal Divisi → tambah jadwal internal divisi',
      'Nilai Anggota → nilai anggota divisi Perlengkapan',
      'Nilai Pimpinan Produksi (feedback ke atasan)',
      'Saat Show Time: bagi zona prop table di wing, eksekusi transisi properti cepat',
      'Setelah selesai: kembalikan inventaris sekolah & update status barang di web',
    ],
  },
  'Koordinator Publikasi': {
    title: 'Koordinator Publikasi & Dokumentasi',
    icon: Camera,
    color: 'from-emerald-700 to-green-900',
    desc: 'Poster, konten, BTS, aftermovie',
    steps: [
      'Dashboard → kelola timeline publikasi & jadwal konten',
      'Jadwal Konten → susun kalender konten (H-30, H-14, H-7, H-1, Hari-H)',
      'Dokumen & Arsip → unggah foto & video Behind the Scene',
      'Presensi internal divisi untuk koordinasi',
      'Nilai Anggota Publikasi & Pimpinan Produksi',
      'Saat Show Time: pasang kamera statis di angle terbaik',
      'Ambil foto candid penonton & rekam pementasan 30 menit utuh',
      'Setelah selesai: sunting aftermovie & arsipkan semua media ke Drive',
    ],
  },
  'Koordinator Tata Panggung': {
    title: 'Koordinator Tata Panggung',
    icon: Layers,
    color: 'from-purple-700 to-purple-900',
    desc: 'Desain panggung, set, cross-operator',
    steps: [
      'Dashboard → lihat progress divisi & tugas terkait',
      'Properti → kelola properti panggung (set, backdrop)',
      'Presensi internal divisi Tata Panggung',
      'Nilai Anggota Panggung & Sutradara',
      'Saat Show Time: eksekusi pasang set 10 menit, bongkar 5 menit',
      'Jaga sterilitas area samping & pindahkan dekorasi tanpa suara',
      'Setelah selesai: bongkar set & kembalikan panggung ke kondisi semula',
    ],
  },
  'Koordinator Tata Rias': {
    title: 'Koordinator Tata Rias',
    icon: Palette,
    color: 'from-pink-700 to-rose-900',
    desc: 'Face chart, rias karakter/fantasi, higienitas',
    steps: [
      'Dashboard → kelola face chart & jadwal urutan merias',
      'Face Chart → buat desain rias per pemain (Korektif / Karakter / Fantasi)',
      'Unggah moodboard & face chart ke web',
      'Presensi internal divisi Tata Rias',
      'Nilai Anggota Rias & Sutradara',
      'Saat Show Time: eksekusi tata rias sesuai timeline',
      'Standby touch-up cepat di antara adegan',
      'Setelah selesai: dampingi pembersihan rias & sterilkan alat',
    ],
  },
  'Koordinator Tata Busana': {
    title: 'Koordinator Tata Busana',
    icon: Scissors,
    color: 'from-indigo-700 to-indigo-900',
    desc: 'Desain kostum, fitting, quick change',
    steps: [
      'Dashboard → kelola desain & status kostum per peran',
      'Kostum → tambah kostum untuk karakter & pemain',
      'Track progress: DESAIN → POTONG → JAHIT → FITTING → SELESAI',
      'Simpan moodboard, ukuran pemain, meter kain yang digunakan',
      'Presensi internal divisi Tata Busana',
      'Nilai Anggota Busana & Sutradara',
      'Saat Show Time: bagi area rak gantung, dampingi quick change pemain',
      'Setelah selesai: cuci, bersihkan, & kembalikan aset kostum',
    ],
  },
  'Koordinator Tata Musik': {
    title: 'Koordinator Tata Musik & Suara',
    icon: Music,
    color: 'from-cyan-700 to-blue-900',
    desc: 'Cue sheet audio, sound check, instrumen',
    steps: [
      'Dashboard → kelola sound cue sheet',
      'Cue Sheet → tambah cue audio: Overture, Penutup, Pergantian Babak, dll',
      'Simpan URL audio, volume, durasi per cue',
      'Presensi internal divisi Tata Musik',
      'Nilai Anggota Musik & Sutradara',
      'Saat Show Time: bagi channel mixer, check sound 10 menit',
      'Mainkan musik iringan presisi mengikuti alur adegan 30 menit',
      'Setelah selesai: rapikan & kembalikan instrumen ke penyimpanan',
    ],
  },
  'Anggota Perlengkapan': {
    title: 'Anggota Divisi Perlengkapan',
    icon: Package,
    color: 'from-blue-600 to-blue-800',
    desc: 'Produksi properti, bahan daur ulang',
    steps: [
      'Dashboard → lihat tugas dari koordinator & progress Anda',
      'Tugas & Deadline → centang tugas yang sudah dikerjakan',
      'Upload bukti pekerjaan (link Google Drive)',
      'Properti → tambah/update properti yang Anda kerjakan',
      'Jadwal Divisi Saya → lihat agenda internal divisi',
      'Presensi → isi kehadiran Anda di setiap sesi',
      'Kas Saya → cek tagihan kas yang harus dibayar',
      'Nilai Rekan → nilai koordinator & sesama anggota divisi',
      'Nilai Saya → lihat rapor pribadi',
    ],
  },
  'Anggota Publikasi': {
    title: 'Anggota Divisi Publikasi & Dokumentasi',
    icon: Camera,
    color: 'from-emerald-600 to-emerald-800',
    desc: 'Foto, video, BTS, media sosial',
    steps: [
      'Dashboard → lihat tugas dokumentasi yang ditugaskan',
      'Tugas & Deadline → centang tugas & upload link media ke Drive',
      'Dokumen & Arsip → unggah foto/video ke arsip digital',
      'Jadwal Konten → lihat kalender publikasi',
      'Presensi → isi kehadiran di setiap sesi',
      'Kas Saya → cek tagihan kas',
      'Nilai Rekan & Nilai Saya',
    ],
  },
  'Anggota Tata Panggung': {
    title: 'Anggota Divisi Tata Panggung',
    icon: Layers,
    color: 'from-purple-600 to-purple-800',
    desc: 'Konstruksi set, spotting, dekorasi',
    steps: [
      'Dashboard → lihat tugas konstruksi set',
      'Tugas & Deadline → centang tugas & upload bukti',
      'Properti → update status pekerjaan konstruksi',
      'Presensi → isi kehadiran',
      'Kas Saya → cek tagihan',
      'Nilai Rekan & Nilai Saya',
    ],
  },
  'Anggota Tata Rias': {
    title: 'Anggota Divisi Tata Rias',
    icon: Palette,
    color: 'from-pink-600 to-rose-800',
    desc: 'Aplikasi rias, higienitas alat',
    steps: [
      'Dashboard → lihat tugas rias yang ditugaskan',
      'Tugas & Deadline → centang tugas',
      'Face Chart → lihat desain rias dari koordinator',
      'Presensi → isi kehadiran',
      'Kas Saya → cek tagihan',
      'Nilai Rekan & Nilai Saya',
    ],
  },
  'Anggota Tata Busana': {
    title: 'Anggota Divisi Tata Busana',
    icon: Scissors,
    color: 'from-indigo-600 to-indigo-800',
    desc: 'Jahit, modifikasi, fitting',
    steps: [
      'Dashboard → lihat tugas busana',
      'Tugas & Deadline → centang tugas',
      'Kostum → update status kostum yang Anda kerjakan',
      'Presensi → isi kehadiran',
      'Kas Saya → cek tagihan',
      'Nilai Rekan & Nilai Saya',
    ],
  },
  'Anggota Tata Musik': {
    title: 'Anggota Divisi Tata Musik & Suara',
    icon: Music,
    color: 'from-cyan-600 to-cyan-800',
    desc: 'Musik, sound, instrumen',
    steps: [
      'Dashboard → lihat cue & tugas musik',
      'Tugas & Deadline → centang tugas',
      'Cue Sheet → lihat & update cue audio',
      'Presensi → isi kehadiran',
      'Kas Saya → cek tagihan',
      'Nilai Rekan & Nilai Saya',
    ],
  },
  'Pemain': {
    title: 'Pemain (Aktor / Aktris)',
    icon: Star,
    color: 'from-rose-600 to-pink-800',
    desc: 'Akting, hafalan dialog, blocking, refleksi',
    steps: [
      'Dashboard → lihat progress latihan & nilai sementara',
      'Naskah & Blocking → baca naskah digital & lihat blocking 3x3',
      'Rekam suara latihan dialog dengan fitur Perekam Suara',
      'Ikuti 10 langkah latihan dialog',
      'Tugas & Deadline → centang tugas & submit hafalan via video',
      'Jadwal Latihan → konfirmasi kehadiran latihan',
      'Presensi → isi kehadiran di setiap sesi',
      'Kas Saya → cek tagihan kas',
      'Nilai Rekan → nilai Sutradara & Asisten (pengarah langsung)',
      'Nilai Saya → lihat rapor 6 kriteria akting',
      'Refleksi Diri → isi refleksi setelah pementasan',
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
    // 1. PANDUAN PERAN ANDA (dinamis berdasarkan login)
    // ============================================
    {
      id: 'my-role',
      title: `📌 Panduan untuk Peran Anda: ${myRole}`,
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
    // 2. PENGANTAR SP-PPT
    // ============================================
    {
      id: 'intro',
      title: '🎭 Pengantar SP-PPT',
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
            secara holistik dari tahap <strong>Pra-Produksi → Pelaksanaan (3 bulan) → Show Time → Pasca-Produksi</strong>.
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/30">
            <p className="text-amber-900 dark:text-amber-200 font-bold text-[11px]">
              💡 Prinsip Utama:
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
    // 3. SEMUA PERAN — untuk lihat semua
    // ============================================
    {
      id: 'all-roles',
      title: '👥 Daftar Semua Peran & Wewenang',
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
            <span>{showAllRoles ? '▲ Sembunyikan Detail Semua Peran' : '▼ Tampilkan Detail Semua Peran'}</span>
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
    // 4. CARA MENDAPATKAN AKUN
    // ============================================
    {
      id: 'register',
      title: '🔐 Cara Mendaftar Akun Baru',
      icon: KeyRound,
      color: 'from-blue-700 to-indigo-900',
      content: (
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <p className="font-bold text-blue-900 dark:text-blue-200 text-[11px] mb-1">
              📋 Yang dibutuhkan:
            </p>
            <ul className="text-[11px] text-blue-800 dark:text-blue-300 space-y-0.5 pl-4 list-disc">
              <li>Kode Kelas (dapat dari Guru Pengampu)</li>
              <li>Nama lengkap sesuai data sekolah</li>
              <li>Email aktif (boleh Gmail/email sekolah)</li>
              <li>Nomor WhatsApp aktif (WAJIB — untuk koordinasi produksi)</li>
              <li>Password minimal 6 karakter</li>
              <li>Peran/Jabatan dalam kepanitiaan</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-slate-900 dark:text-slate-200">Langkah pendaftaran:</p>
            {[
              'Buka halaman login SP-PPT',
              'Pilih tab "Siswa"',
              'Klik "Daftar Siswa" di bawah tombol masuk',
              'Isi kode kelas yang diberikan guru (contoh: IXF-RAC97BK4)',
              'Isi nama lengkap, email, nomor WhatsApp',
              'Buat password & konfirmasi ulang',
              'Pilih peran Anda dari dropdown (Pengurus Inti, Pemeran, Koor, atau Anggota)',
              'Klik "Daftarkan Akun Siswa"',
              'Setelah berhasil, login kembali dengan email & password',
              'Modal verifikasi akan muncul — klik "Ya, Saya Benar" untuk konfirmasi',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                  {i + 1}
                </span>
                <p className="text-slate-700 dark:text-slate-300 pt-0.5">{step}</p>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
              <strong>Perhatian:</strong> Nomor WhatsApp tidak boleh kosong — dipakai untuk koordinasi
              mendadak (mis. perubahan jadwal gladi). Pastikan nomor Anda aktif.
            </p>
          </div>
        </div>
      ),
    },

    // ============================================
    // 5. VERIFIKASI LOGIN
    // ============================================
    {
      id: 'verify-login',
      title: '🛡️ Verifikasi Login & Keamanan',
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
                Klik tombol hijau <strong>"Ya, Saya Benar"</strong> untuk lanjut ke dashboard.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
              <p className="font-bold text-rose-800 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Jika bukan Anda
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
                Klik <strong>"Bukan Saya"</strong> untuk langsung logout & mencegah penyalahgunaan akun.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <p className="font-bold text-blue-900 dark:text-blue-200 text-[11px] mb-1">
              Fitur keamanan tambahan:
            </p>
            <ul className="text-[11px] text-blue-800 dark:text-blue-300 space-y-0.5 pl-4 list-disc">
              <li>Auto-logout jika profil tidak ditemukan</li>
              <li>Konfirmasi logout (Ya/Tidak) untuk mencegah klik tak sengaja</li>
              <li>Kredensial dicatat Guru agar bisa dibantu reset password</li>
              <li>Audit log mencatat semua aktivitas login/logout</li>
            </ul>
          </div>
        </div>
      ),
    },

    // ============================================
    // 6. SISTEM PENILAIAN
    // ============================================
    {
      id: 'grading',
      title: '⭐ Sistem Penilaian Multi-Penilai',
      icon: Award,
      color: 'from-amber-600 to-orange-800',
      content: (
        <div className="space-y-3 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Setiap siswa dinilai secara proporsional dengan formula:
          </p>
          <div className="p-3.5 bg-slate-900 text-amber-300 rounded-xl font-mono text-xs text-center">
            Nilai Akhir = (Guru × 50%) + (Ketua/Pimpro × 30%) + (Rekan × 20%)
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-200 mb-2 text-[11px]">Skala Penilaian:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { label: 'Kurang', score: 40, color: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30' },
                { label: 'Cukup', score: 60, color: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' },
                { label: 'Baik', score: 80, color: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30' },
                { label: 'Sangat Baik', score: 100, color: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' },
              ].map(item => (
                <div key={item.label} className={`p-2 rounded-lg border ${item.color}`}>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200">{item.label}</p>
                  <p className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">Skor: {item.score}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
            <p className="font-bold text-purple-900 dark:text-purple-200 text-[11px] mb-1">
              Predikat Akhir:
            </p>
            <ul className="text-[11px] text-purple-800 dark:text-purple-300 space-y-0.5">
              <li><strong>90–100 = A</strong> (Mahir)</li>
              <li><strong>80–89 = B</strong> (Kompeten)</li>
              <li><strong>70–79 = C</strong> (Memenuhi Standar)</li>
              <li><strong>60–69 = D</strong> (Perlu Perbaikan)</li>
              <li><strong>&lt; 60 = E</strong> (Tidak Memenuhi)</li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Komentar Wajib:</strong> Jika penilai memberi nilai ≤ 2 (Kurang/Cukup),
              sistem mewajibkan pengisian catatan pembinaan agar siswa tahu aspek perbaikan.
            </p>
          </div>
        </div>
      ),
    },

    // ============================================
    // 7. FITUR KAS & RAB (khusus bendahara & viewer)
    // ============================================
    {
      id: 'kas-rab',
      title: '💰 Fitur Kas & RAB Digital',
      icon: Wallet,
      color: 'from-emerald-700 to-green-900',
      content: (
        <div className="space-y-3 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong>Kas</strong> dan <strong>RAB Digital</strong> dikelola oleh <strong>Bendahara</strong>.
            Guru, Pimpro, Sekretaris, dan siswa hanya <strong>melihat</strong> hasilnya.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
              <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-[11px] flex items-center gap-1.5 mb-2">
                <Wallet className="w-4 h-4" /> Kas & Buku Kas
              </h4>
              <ul className="text-[10px] text-emerald-800 dark:text-emerald-300 space-y-1 pl-4 list-disc">
                <li>Aktifkan kas dengan nominal & periode (mingguan/2minggu/10hari/manual)</li>
                <li>Centang per periode untuk siswa yang sudah bayar</li>
                <li>Saldo terakumulasi otomatis</li>
                <li>Kirim reminder santun ke siswa yang belum bayar</li>
                <li>Catat pemasukan & pengeluaran manual</li>
                <li>Export Excel 4 sheet (Ringkasan, Pemasukan, Pengeluaran, Periode)</li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 text-[11px] flex items-center gap-1.5 mb-2">
                <Calculator className="w-4 h-4" /> RAB Digital
              </h4>
              <ul className="text-[10px] text-amber-800 dark:text-amber-300 space-y-1 pl-4 list-disc">
                <li>Input item per Divisi, Peran, atau Umum</li>
                <li>Estimasi biaya otomatis dihitung (Qty × Harga)</li>
                <li>Export ke Word (.doc) untuk tanda tangan fisik</li>
                <li>Unggah RAB Final yang sudah ditandatangani Pimpro & Bendahara</li>
                <li>Tanda tangan digital di sistem</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },

    // ============================================
    // 8. TUGAS & DEADLINE
    // ============================================
    {
      id: 'tasks',
      title: '📋 Tugas & Deadline',
      icon: CheckSquare,
      color: 'from-blue-700 to-indigo-900',
      content: (
        <div className="space-y-3 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Guru dapat mengirim <strong>template tugas</strong> dari dokumen Job Desc resmi (Tim Produksi).
            Siswa akan menerima notifikasi & mencentang tugas yang sudah dikerjakan.
          </p>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <p className="font-bold text-blue-900 dark:text-blue-200 text-[11px] mb-1.5">
              Cara Guru mengirim tugas:
            </p>
            <ol className="text-[11px] text-blue-800 dark:text-blue-300 space-y-1 pl-4 list-decimal">
              <li>Buka menu Tugas & Deadline</li>
              <li>Klik "Kirim Tugas"</li>
              <li>Pilih Tahap Produksi (Persiapan/Pelaksanaan/Pertunjukan/Pasca)</li>
              <li><strong>Centang beberapa template</strong> sekaligus (multi-select)</li>
              <li><strong>Centang beberapa target</strong> (beberapa peran + beberapa divisi sekaligus, atau "Semua Siswa")</li>
              <li>Opsional: Override deadline</li>
              <li>Review jumlah penerima → Kirim</li>
            </ol>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <p className="font-bold text-emerald-900 dark:text-emerald-200 text-[11px] mb-1.5">
              Cara Siswa mencentang tugas:
            </p>
            <ol className="text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1 pl-4 list-decimal">
              <li>Buka menu Tugas & Deadline</li>
              <li>Lihat daftar tugas dengan badge prioritas & countdown</li>
              <li>Klik kotak ceklis jika tugas sudah dikerjakan</li>
              <li>Unggah bukti (link Google Drive) untuk tugas yang butuh bukti</li>
              <li>Guru/koordinator bisa membatalkan centang jika bukti tidak valid</li>
            </ol>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
            <p className="font-bold text-purple-900 dark:text-purple-200 text-[11px] mb-1">
              🎁 Fitur Pengingat Otomatis:
            </p>
            <ul className="text-[11px] text-purple-800 dark:text-purple-300 space-y-0.5 pl-4 list-disc">
              <li>Setiap login/refresh, siswa melihat modal pengingat</li>
              <li>Berisi: tugas belum dikerjakan, tugas selesai, agenda 7 hari, tagihan kas</li>
              <li>Bisa di-dismiss per item agar tetap fokus</li>
              <li>Banner kuning tetap terlihat jika modal ditutup</li>
            </ul>
          </div>
        </div>
      ),
    },

    // ============================================
    // 9. FAQ
    // ============================================
    {
      id: 'faq',
      title: '❓ FAQ & Troubleshooting',
      icon: HelpCircle,
      color: 'from-slate-700 to-slate-900',
      content: (
        <div className="space-y-3 text-xs">
          {[
            {
              q: 'Lupa password, bagaimana?',
              a: 'Hubungi Guru Pengampu atau Admin. Guru bisa buka Kelola Kelas → tab Siswa → klik tombol "Lihat" pada nama Anda untuk melihat kredensial. Jika perlu reset, Admin bisa kirim link reset ke email Anda.',
            },
            {
              q: 'Saat login muncul "Profil tidak ditemukan"?',
              a: 'Akun Anda mungkin terdaftar di Firebase Auth tapi profil Firestore hilang. Silakan daftar ulang dengan kode kelas, atau hubungi Guru untuk didaftarkan manual.',
            },
            {
              q: 'Saat login muncul "Role tidak cocok dengan tab"?',
              a: 'Anda login di tab yang salah. Contoh: akun siswa tapi login di tab Guru. Ikuti tombol "Ganti ke Tab [X]" yang muncul.',
            },
            {
              q: 'Notifikasi tidak muncul di bell?',
              a: 'Cek: (1) koneksi internet, (2) izin notifikasi browser, (3) refresh halaman. Notifikasi real-time dari Firestore biasanya muncul dalam 1-2 detik.',
            },
            {
              q: 'Tidak bisa melihat menu Kas / RAB?',
              a: 'Menu Kas & RAB hanya untuk Bendahara (edit) dan Admin/Guru (view RAB). Siswa hanya melihat "Kas Saya" (tagihan pribadi).',
            },
            {
              q: 'Tugas yang saya kirim ke target mana saja?',
              a: 'Di langkah 3 wizard, sistem menghitung berapa siswa yang match dengan target Anda. Konfirmasi ulang di langkah 4 sebelum kirim.',
            },
            {
              q: 'Kelas lama muncul kembali setelah dihapus?',
              a: 'Sudah diperbaiki. Jika masih terjadi, buka DevTools → Console → ketik: localStorage.clear() lalu refresh.',
            },
            {
              q: 'Bagaimana cara ganti nama kerabat kerja (nama produksi)?',
              a: 'Guru Pengampu & Pimpinan Produksi bisa ubah di menu Struktur Kerabat → klik ikon pensil di samping nama kerabat.',
            },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-900 dark:text-white text-xs flex items-start gap-2">
                <span className="text-amber-500 shrink-0">Q:</span>
                <span>{item.q}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1.5 flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-500 font-bold shrink-0">A:</span>
                <span>{item.a}</span>
              </p>
            </div>
          ))}
        </div>
      ),
    },

    // ============================================
    // 10. TENTANG APLIKASI
    // ============================================
    {
      id: 'about',
      title: 'ℹ️ Tentang SP-PPT',
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

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
              <strong>Tips:</strong> Panduan ini bisa dibuka kapan pun dari menu Panduan & FAQ di sidebar.
              Setiap peran memiliki akses yang berbeda sesuai tugas & tanggung jawabnya.
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
