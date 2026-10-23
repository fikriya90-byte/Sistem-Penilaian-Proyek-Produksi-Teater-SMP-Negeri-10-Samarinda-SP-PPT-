import React, { useState } from 'react';
import {
  Award, BookOpen, Calendar, CheckCircle, ChevronDown,
  ClipboardList, HelpCircle, Radio, Sparkles, Users, Megaphone,
  Wallet, Calculator, Star, MessageSquare, Timer, Camera, Music,
  Palette, Scissors, Package, ShieldCheck, Lock, KeyRound, Eye,
  FileText, Briefcase, Layers, TrendingUp, Bell, Info, AlertTriangle,
  UserCheck, Target, Play, CheckSquare, ShieldAlert, Building2
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
      'Buka Dashboard untuk melihat ringkasan seluruh aktivitas kelas.',
      'Kelola Kelas → buat kelas baru, bagikan kode ke siswa, kelola akun.',
      'Jadwal & Agenda → Guru bisa melihat seluruh jadwal lintas kelas yang diampu.',
      'Tugas & Deadline → kirim tugas dari template ke siswa.',
      'Nilai & Penilaian → beri nilai siswa sesuai matriks. Guru bisa mengedit nilai yang diberikan oleh siswa lain (intervensi).',
      'Presensi → Buka sesi presensi. Guru berhak mengedit status kehadiran siswa jika ada kecurangan.',
      'Moderasi → tinjau penilaian dari ketua dan rekan.',
      'Backup & Restore → backup data Firestore ke JSON untuk arsip.',
    ],
  },
  'Pimpinan Produksi': {
    title: 'Pimpinan Produksi (Pimpro)',
    icon: Sparkles,
    color: 'from-blue-800 to-indigo-900',
    desc: 'Manajer proyek, penyusun Master Schedule & LPJ',
    steps: [
      'Dashboard → lihat status keseluruhan produksi & progress 6 divisi.',
      'Kalender Kegiatan → Buat agenda rapat pleno atau gladi umum. Bisa menggunakan sistem checklist (target spesifik).',
      'Presensi → buat sesi absensi pleno (semua siswa) atau khusus pengurus.',
      'Broadcast → kirim pengumuman siaran ke semua siswa.',
      'Nilai & Penilaian → beri nilai Sekretaris, Bendahara, dan Koordinator Divisi.',
      'Setelah selesai: susun LPJ & serahkan ke Guru.',
    ],
  },
  'Sekretaris': {
    title: 'Sekretaris Administrasi',
    icon: FileText,
    color: 'from-blue-700 to-blue-900',
    desc: 'Presensi harian, arsip dokumen, notulen rapat',
    steps: [
      'Kalender Kegiatan → Buat agenda rapat umum bersama Pimpro.',
      'Presensi → buat sesi absensi untuk rapat. Bisa memilih mode "Pengurus Mengabsenkan" agar siswa tidak bisa curang mengisi hadir.',
      'Dokumen & Arsip → unggah draf naskah, notulen, proposal ke arsip web.',
      'Broadcast → kirim pengumuman resmi ke tim.',
      'Nilai & Penilaian → beri nilai Pimpinan Produksi (sebagai feedback ke atasan).',
    ],
  },
  'Sutradara': {
    title: 'Sutradara & Asisten',
    icon: Star,
    color: 'from-rose-700 to-pink-900',
    desc: 'Visi artistik, casting, penilai utama aktor',
    steps: [
      'Studio & Naskah → 3x3 blocking grid untuk blocking panggung.',
      'Kalender Kegiatan → Sutradara HANYA bisa membuat jadwal untuk Tim Artistik (Panggung, Busana, Rias, Musik, Pemeran).',
      'Presensi → buat sesi latihan khusus Pemain + Tata Musik.',
      'Nilai & Penilaian → beri nilai Asisten Sutradara, Pemain, dan Koordinator Artistik.',
      'Setelah selesai: tulis analisis perkembangan keaktoran individual via web.',
    ],
  },
  'Koordinator Perlengkapan': {
    title: 'Koordinator Divisi',
    icon: Package,
    color: 'from-blue-700 to-blue-900',
    desc: 'Mengelola anggota dan jadwal internal divisinya',
    steps: [
      'Properti → daftar properti per adegan, update status properti.',
      'Jadwal Divisi → Buat jadwal kerja khusus anggota divisi Anda.',
      'Presensi → buat sesi absensi internal divisi.',
      'Nilai & Penilaian → beri nilai Anggota Perlengkapan & Pimpinan Produksi.',
    ],
  },
  'Pemain': {
    title: 'Pemain (Aktor / Aktris)',
    icon: Star,
    color: 'from-rose-600 to-pink-800',
    desc: 'Akting, hafalan dialog, blocking, refleksi',
    steps: [
      'Naskah & Blocking → baca naskah digital & lihat blocking 3x3.',
      'Kalender Kegiatan → Klik "Saya Akan Datang" jika diundang rapat/gladi.',
      'Presensi → isi kehadiran Anda di setiap sesi. Ingat, presensi masuk nilai rapor!',
      'Tugas & Deadline → tekan "Tandai Selesai" & kirim hafalan via video.',
      'Nilai & Penilaian → WAJIB beri nilai Sutradara, Astrada, & sesama Pemain.',
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
            </>
          ) : (
            <p className="text-xs text-slate-500 italic text-center py-4">
              Panduan untuk peran "{myRole}" belum tersedia.
            </p>
          )}
        </div>
      ),
    },

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
              <li><strong>Kunci Nilai Siswa (Peer Gate):</strong> Siswa <strong>TIDAK BISA</strong> melihat nilai mereka jika belum menyelesaikan penilaian ke rekan kerjanya.</li>
              <li><strong>Hak Edit Terbatas:</strong> Siswa hanya bisa mengisi nilai untuk teman yang ada di matriks penilaiannya. Siswa <strong>TIDAK BISA</strong> mengedit nilai dirinya sendiri.</li>
              <li><strong>Kunci Waktu:</strong> Guru harus membuka "Jadwal Penilaian". Di luar jadwal tersebut, siswa tidak bisa mengisi nilai.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-200 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Alur Penilaian untuk Siswa
            </h4>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Buka menu <strong>Penilaian 360</strong>.</li>
              <li>Anda hanya melihat daftar teman yang <strong>memang menjadi jatah Anda untuk dinilai</strong>.</li>
              <li>Klik tombol <strong>Isi</strong>, lalu berikan nilai 1-4.</li>
              <li>Wajib isi komentar jika memberi nilai ≤ 2.</li>
              <li>Setelah semua jatah dinilai, barulah menu <strong>Nilai Saya</strong> bisa dibuka.</li>
            </ol>
          </div>
        </div>
      ),
    },

    {
      id: 'faq',
      title: 'FAQ & Troubleshooting',
      icon: HelpCircle,
      color: 'from-slate-700 to-slate-900',
      content: (
        <div className="space-y-3 text-xs">
          {[
            {
              q: 'Apakah presensi masuk dalam nilai rapor?',
              a: 'Ya, sangat mempengaruhi. Persentase kehadiran (Hadir/Izin/Sakit) dan Alpa masuk ke dalam kriteria penilaian "Kehadiran & Kedisiplinan". Jika Anda tidak hadir di Gladi Resik atau Pementasan tanpa keterangan, nilai Anda akan otomatis dibatasi maksimal 70.',
            },
            {
              q: 'Apa bedanya tombol "Saya Akan Datang" di Kalender dengan Presensi?',
              a: 'Tombol di Kalender adalah RSVP (Konfirmasi Rencana). Sedangkan Presensi adalah catatan resmi kehadiran Anda pada hari-H yang akan masuk ke nilai rapor. Jika Anda bilang "Akan Datang" tapi tidak isi presensi, Anda tetap dianggap Alpa.',
            },
            {
              q: 'Kenapa saya tidak bisa mengisi presensi padahal acara sudah mulai?',
              a: 'Presensi hanya bisa diisi saat sesi dibuka (sesuai jam yang ditentukan pembuat) dan akan tertutup otomatis saat waktu habis. Atau, pembuat sesi memilih mode "Pengurus Mengabsenkan" sehingga Anda tidak perlu isi sendiri.',
            },
            {
              q: 'Lupa password, bagaimana?',
              a: 'Hubungi Guru Pengampu. Guru bisa membuka menu Kelola Siswa: tombol "Lihat Pass" menampilkan email dan password Anda, sedangkan tombol "Reset" mengirim link reset password ke email Anda.',
            },
            {
              q: 'Kenapa nilai saya tidak muncul di menu "Nilai Saya"?',
              a: 'Ada dua kemungkinan: (1) Anda belum menyelesaikan penilaian rekan kerja (Peer Assessment). (2) Guru belum membuka jadwal penilaian untuk tahap tersebut.',
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
  ];

  const toggleSection = (id: string) => {
    setActiveSection(activeSection === id ? '' : id);
  };

  return (
    <div className="space-y-6">
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
      </div>

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
