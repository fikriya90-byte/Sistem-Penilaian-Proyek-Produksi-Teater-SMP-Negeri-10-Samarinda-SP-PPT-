import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Radio,
  Sparkles,
  Users
} from 'lucide-react';
import { APP_CONFIG } from '../../core/constants';

export const GuideModule: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const SECTIONS = [
    {
      id: 'intro',
      title: '1. Pengantar SP-PPT SMPN 10 Samarinda',
      icon: BookOpen,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
          <p>
            <strong>SP-PPT (Sistem Penilaian & Manajemen Proyek Produksi Teater)</strong> adalah platform web resmi pembelajaran Seni Budaya (Seni Teater) Kelas IX di SMP Negeri 10 Samarinda.
          </p>
          <p>
            Sistem ini dirancang untuk mendokumentasikan, mengelola alur kerja, dan menilai proses produksi teater secara holistik dari tahap perencanaan hingga evaluasi pementasan.
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <strong>Prinsip Utama:</strong> Penilaian tidak hanya melihat hari-H pertunjukan di panggung, tetapi menghargai setiap tetes keringat proses latihan, koordinasi divisi, dan kedisiplinan kerja tim.
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      title: '2. Wewenang & Pembagian 21 Peran Teater',
      icon: Users,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
          <p>Sistem membedakan hak akses secara ketat berdasarkan hierarki kepanitiaan produksi:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Guru Pembina:</strong> Pengawas tertinggi, pembimbing artistik, penilai dengan bobot 50%, dan pemegang hak kunci penilaian.</li>
            <li><strong>Pimpinan Produksi (Pimprod):</strong> Manajer proyek produksi, memantau kemajuan 7 divisi, memimpin rapat pleno, dan membuat laporan LPJ.</li>
            <li><strong>Sekretaris:</strong> Bertanggung jawab atas presensi digital, notulen, arsip proposal, dan kompilasi naskah.</li>
            <li><strong>Bendahara:</strong> Mengelola Rencana Anggaran Biaya (RAB), kas produksi, dan pencatatan nota pengeluaran.</li>
            <li><strong>Sutradara:</strong> Penanggung jawab visi artistik, casting pemain, pembuat sesi presensi latihan (peserta terkunci: Pemain + Musik), dan penilai utama aktor.</li>
            <li><strong>Asisten Sutradara:</strong> Pengelola prompt book 3x3 blocking, catatan latihan harian, dan standby cue pementasan.</li>
            <li><strong>Koordinator 6 Divisi:</strong> Membagi tugas anggota divisi, membuat jadwal dan absensi internal khusus divisinya, serta menilai kontribusi anggota.</li>
            <li><strong>Pemeran (Aktor/Aktris):</strong> Menghafal dialog, latihan blocking, rekaman vokal mandiri, dan refleksi diri.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'grading',
      title: '3. Rumus Penilaian Multi-Penilai & Predikat',
      icon: Award,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
          <p>Setiap siswa dinilai secara proporsional dengan formula:</p>
          <div className="p-3.5 bg-slate-900 text-amber-300 rounded-xl font-mono text-xs">
            Nilai Akhir = (Guru × 50%) + (Ketua/Pimpinan × 30%) + (Rekan Sejawat × 20%)
          </div>
          <p>Skala penilaian dasar menggunakan 4 poin yang dikonversi ke skala 100:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
              <span className="font-bold block">1 = Kurang</span>
              <span className="font-mono text-slate-500">Skor: 40</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="font-bold block">2 = Cukup</span>
              <span className="font-mono text-slate-500">Skor: 60</span>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
              <span className="font-bold block">3 = Baik</span>
              <span className="font-mono text-slate-500">Skor: 80</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="font-bold block">4 = Sangat Baik</span>
              <span className="font-mono text-slate-500">Skor: 100</span>
            </div>
          </div>
          <p>
            <strong>Wajib Komentar:</strong> Jika penilai memberikan nilai ≤ 2 (Kurang atau Cukup), sistem mewajibkan pengisian catatan pembinaan agar siswa mengetahui aspek perbaikan.
          </p>
        </div>
      ),
    },
    {
      id: 'attendance',
      title: '4. Aturan Ketat Pembuatan Absensi & Presensi',
      icon: ClipboardList,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
          <p>Untuk menjaga kedisiplinan dan relevansi data, hak pembuatan absensi dikunci secara otomatis:</p>
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
              <strong>Pimprod & Sekretaris:</strong> Membuat sesi rapat umum, konsolidasi, dan lintas divisi.
            </div>
            <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50">
              <strong>Sutradara & Asisten:</strong> Membuat sesi latihan akting dan gladi resik. <em>Peserta terkunci otomatis hanya untuk Pemeran dan Tata Musik & Suara.</em>
            </div>
            <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50">
              <strong>Koordinator Divisi:</strong> Membuat sesi produksi internal. <em>Peserta terkunci otomatis hanya untuk anggota divisinya sendiri.</em>
            </div>
          </div>
          <p>Pemain, Anggota, dan Bendahara bertindak sebagai pengisi kehadiran (Hadir, Izin, Sakit, Alpa).</p>
        </div>
      ),
    },
    {
      id: 'studio',
      title: '5. Studio Digital & Editor Blocking 3x3',
      icon: Sparkles,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-700">
          <p>Menu Studio menyediakan alat bantu latihan panggung digital:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>3×3 Stage Grid:</strong> Penempatan simbol aktor pada 9 zona panggung (Upstage, Center, Downstage).</li>
            <li><strong>Perekam Audio Mandiri:</strong> Menggunakan MediaRecorder peramban untuk merekam intonasi dialog dan evaluasi vokal.</li>
            <li><strong>10 Langkah Dialog:</strong> Alur sistematis mulai dari bedah naskah hingga run-through penuh.</li>
            <li><strong>Simulasi Quick Change:</strong> Latihan ganti kostum cepat dengan target &lt; 2 menit.</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <HelpCircle className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Pusat Panduan & Buku Pedoman SP-PPT
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Pedoman resmi alur kerja, standar penilaian, dan petunjuk operasional aplikasi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {SECTIONS.map(sec => {
          const isOpen = activeSection === sec.id;
          const Icon = sec.icon;

          return (
            <div
              key={sec.id}
              className="rounded-3xl bg-white border border-slate-200/80 shadow-xs overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => setActiveSection(isOpen ? '' : sec.id)}
                className="w-full p-5 text-left flex items-center justify-between hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">{sec.title}</h3>
                </div>

                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-amber-600' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 animate-in fade-in">
                  {sec.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
