import { ProductionStage, DivisionType, UserRole } from './types';

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  daysFromNow: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  targetType: 'SEMUA' | 'DIVISI' | 'PERAN';
  targetDivision?: DivisionType;
  targetRole?: UserRole;
  reference: string;
}

// =====================================================
// TAHAP 1: PERSIAPAN
// =====================================================
const PERSIAPAN: TaskTemplate[] = [
  // -------- PIMPINAN PRODUKSI --------
  {
    id: 'tp-persiapan-pimpro-1',
    title: 'Menyusun Master Production Schedule',
    description: 'Menyusun Master Production Schedule pada platform web dengan pengesahan resmi dari Guru Pembimbing dan Kepala Sekolah.',
    daysFromNow: 7, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-pimpro-2',
    title: 'Menetapkan Pekan Bebas Ujian & Libur Semester',
    description: 'Menetapkan Pekan Bebas Ujian PAS/SAS Semester 1 (2 Minggu) dan Pekan Bebas Libur Semester (1 Minggu) dalam kalender kerja.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-pimpro-3',
    title: 'Membatasi Latihan Maks 2x/Minggu, 1 Jam, Tanpa Weekend',
    description: 'Membatasi latihan maksimal 2 kali seminggu sebelum 2 minggu menjelang pementasan, durasi maks 1 jam per pertemuan, melarang kegiatan di akhir pekan.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-pimpro-4',
    title: 'Mengontrol Ketercapaian Target Divisi via Dashboard',
    description: 'Mengontrol ketercapaian target awal tiap divisi melalui dashboard web yang diakses real-time oleh semua siswa dan guru.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Perencanaan Pra-Produksi',
  },
  // -------- SEKRETARIS --------
  {
    id: 'tp-persiapan-sekre-1',
    title: 'Mengelola Tata Kelola Administrasi Web',
    description: 'Mengelola tata kelola administrasi berbasis web dan membuat formulir izin les akademik serta bimbingan belajar otomatis di sistem web.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-sekre-2',
    title: 'Unggah Draf Naskah & Dokumen Kerja',
    description: 'Mengunggah draf naskah cetak dan dokumen kerja harian ke repositori web yang dapat diakses real-time oleh semua siswa dan guru.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Perencanaan Pra-Produksi',
  },
  // -------- BENDAHARA --------
  {
    id: 'tp-persiapan-bend-1',
    title: 'Menyusun RAB Produksi via Web',
    description: 'Menyusun Anggaran Pendapatan dan Belanja Produksi terperinci via sistem web berdasarkan kesepakatan kelas tanpa paksaan iuran.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-bend-2',
    title: 'Kebijakan Material Daur Ulang',
    description: 'Menetapkan kebijakan pemanfaatan material daur ulang yang murah dan mudah didapat.',
    daysFromNow: 10, priority: 'MEDIUM', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-bend-3',
    title: 'Sistem Digitalisasi Nota & Pembukuan Kas',
    description: 'Mengatur sistem digitalisasi nota dan pembukuan kas yang dapat diakses real-time oleh semua siswa dan guru serta diaudit Guru Pembimbing secara berkala.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Perencanaan Pra-Produksi',
  },
  // -------- SUTRADARA --------
  {
    id: 'tp-persiapan-sut-1',
    title: 'Menyusun Sistem Latihan Modular (Scene Breakdown)',
    description: 'Menyusun sistem latihan modular berbasis pemecahan adegan Scene Breakdown agar siswa kelas 9 hanya hadir saat adegannya dilatih dan bisa langsung pulang untuk les.',
    daysFromNow: 7, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-sut-2',
    title: 'Unggah Visi Penyutradaraan ke Web',
    description: 'Mengunggah Visi Penyutradaraan ke platform web sebagai panduan kerja bersama.',
    daysFromNow: 7, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Perencanaan Pra-Produksi',
  },
  // -------- ASISTEN SUTRADARA --------
  {
    id: 'tp-persiapan-astrada-1',
    title: 'Menyusun Call Sheet Per Adegan',
    description: 'Menyusun Call Sheet latihan harian terpisah berdasarkan adegan dan menyelaraskannya dengan jadwal les anggota di platform web.',
    daysFromNow: 8, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-astrada-2',
    title: 'Unggah Prompt Book & Cueing',
    description: 'Mengunggah naskah panduan utama prompt book berisi instruksi cueing ke platform web.',
    daysFromNow: 8, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Perencanaan Pra-Produksi',
  },
  // -------- PEMAIN --------
  {
    id: 'tp-persiapan-pemain-1',
    title: 'Mendalami Latar Belakang Tokoh',
    description: 'Mendalami latar belakang tokoh yang diperankan.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-pemain-2',
    title: 'Menyusun Lembar Analisis Karakter',
    description: 'Menyusun lembar analisis karakter di sistem web.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Perencanaan Pra-Produksi',
  },
  {
    id: 'tp-persiapan-pemain-3',
    title: 'Menyerahkan Jadwal Les Pribadi',
    description: 'Menyerahkan jadwal les pribadi melalui sistem web agar penjadwalan latihan tidak bentrok.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Perencanaan Pra-Produksi',
  },
];

// =====================================================
// TAHAP 2: PELAKSANAAN
// =====================================================
const PELAKSANAAN: TaskTemplate[] = [
  // -------- PIMPINAN PRODUKSI --------
  {
    id: 'tp-pelaksanaan-pimpro-1',
    title: 'Ikut Pemanasan Bersama Tim di Awal Latihan',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'MEDIUM', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-pimpro-2',
    title: 'Briefing Singkat & Latihan Tepat 60 Menit',
    description: 'Membuka latihan dengan briefing singkat, memastikan seluruh rangkaian rapat dan latihan selesai tepat 60 menit, serta memantau izin les siswa via web.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-pimpro-3',
    title: 'Hentikan Total Aktivitas Fisik (Pekan Ujian & Libur)',
    description: 'Menghentikan total seluruh aktivitas produksi fisik di sekolah selama 2 minggu pekan Ujian PAS/SAS serta 1 minggu libur semester.',
    daysFromNow: 30, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-pimpro-4',
    title: 'Konsolidasi Ulang & Aktifkan Peran Cadangan',
    description: 'Memimpin konsolidasi ulang seluruh tim pasca-libur semester serta mengaktifkan prosedur peran cadangan jika ada personel yang bentrok dengan jadwal les.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Pelaksanaan',
  },
  // -------- SEKRETARIS --------
  {
    id: 'tp-pelaksanaan-sekre-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-sekre-2',
    title: 'Rekap Presensi Harian & Izin Les',
    description: 'Mengelola rekapitulasi presensi harian serta data izin les akademik siswa di sistem web.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-sekre-3',
    title: 'Bekukan Lalu Lintas Surat & Pengumuman (Ujian & Libur)',
    description: 'Membekukan seluruh lalu lintas surat dan pengumuman grup selama 2 minggu pekan Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-sekre-4',
    title: 'Koordinasi Cetakan Tiket, Nametag, Buku Acara',
    description: 'Berkoordinasi dengan Divisi Dokpub dalam merancang cetakan fisik tiket, nametag panitia, dan buku acara.',
    daysFromNow: 20, priority: 'MEDIUM', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Pelaksanaan',
  },
  // -------- BENDAHARA --------
  {
    id: 'tp-pelaksanaan-bend-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-bend-2',
    title: 'Kelola Arus Kas Harian via Web',
    description: 'Mengelola arus kas harian secara efisien via web agar tidak menyita waktu belajar dan jadwal les.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-bend-3',
    title: 'Stop Transaksi & Penagihan (Ujian & Libur)',
    description: 'Menghentikan seluruh aktivitas transaksi, penagihan kas, dan belanja fisik selama 2 minggu pekan Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Pelaksanaan',
  },
  // -------- SUTRADARA --------
  {
    id: 'tp-pelaksanaan-sut-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-sut-2',
    title: 'Pimpin Latihan Maks 2x/Minggu, 1 Jam',
    description: 'Memimpin latihan maksimal 2 kali seminggu sebelum 2 minggu menjelang pementasan, durasi maks 1 jam per pertemuan (rapat adegan + briefing + latihan).',
    daysFromNow: 14, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-sut-3',
    title: 'Henti Latihan Fisik Total (Ujian & Libur)',
    description: 'Menerapkan instruksi Henti Latihan Fisik Total selama 2 minggu pekan Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-sut-4',
    title: 'Pimpin Gladi Bersih Utuh Pasca-Libur',
    description: 'Memimpin gladi bersih utuh pada minggu pertama setelah masuk sekolah pasca-libur semester.',
    daysFromNow: 32, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Pelaksanaan',
  },
  // -------- ASISTEN SUTRADARA --------
  {
    id: 'tp-pelaksanaan-astrada-1',
    title: 'Pandu Pemanasan & Briefing (Maks 1 Jam)',
    description: 'Memandu pemanasan dan briefing singkat dalam alokasi waktu keseluruhan maksimal 1 jam per pertemuan bersama rapat adegan.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-astrada-2',
    title: 'Kelola Setor Hafalan via Audio/Video Web',
    description: 'Mengelola penyerahan setor hafalan dialog via rekaman audio/video singkat di web di luar pekan ujian dan libur semester.',
    daysFromNow: 14, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-astrada-3',
    title: 'Latih Shadow Player (Pemeran Cadangan)',
    description: 'Melatih Shadow Player (pemeran cadangan) agar siap menggantikan pemain utama jika ada jadwal les yang berhalangan ditinggalkan.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-astrada-4',
    title: 'Kosongkan Jadwal Latihan (Ujian & Libur)',
    description: 'Mengosongkan seluruh jadwal latihan dan koordinasi selama 2 minggu Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Pelaksanaan',
  },
  // -------- PEMAIN --------
  {
    id: 'tp-pelaksanaan-pemain-1',
    title: 'Ikut Pemanasan & Briefing (Maks 1 Jam)',
    description: 'Wajib mengikuti pemanasan dan briefing di awal latihan yang dikemas ringkas dalam total durasi maksimal 1 jam per pertemuan (maks 2 kali seminggu sebelum 2 minggu menjelang pementasan).',
    daysFromNow: 14, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-pemain-2',
    title: 'Setor Hafalan Dialog via Rekaman Video',
    description: 'Menyetorkan latihan hafalan dialog via rekaman video ke platform web secara asinkron dari rumah tanpa mengganggu waktu belajar dan jam les.',
    daysFromNow: 14, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-pemain-3',
    title: 'Hadiri Latihan Fisik Modular & Koordinasi Shadow',
    description: 'Menghadiri latihan fisik modular sesuai adegan yang ditentukan dan berkoordinasi erat dengan Shadow Player pendamping.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-pemain-4',
    title: 'Bebas Latihan Fisik (Ujian & Libur)',
    description: 'Bebas dari kegiatan latihan fisik di sekolah selama 2 minggu pekan PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Pelaksanaan',
  },
];

// =====================================================
// TAHAP 3: PERTUNJUKAN
// =====================================================
const PERTUNJUKAN: TaskTemplate[] = [
  // -------- PIMPINAN PRODUKSI --------
  {
    id: 'tp-pertunjukan-pimpro-1',
    title: 'Rapat Komando Akhir & Alokasi 45 Menit',
    description: 'Memimpin rapat komando akhir dan berkoordinasi dengan pengelola tempat untuk penyelarasan alokasi waktu 45 menit (10 menit persiapan, 30 menit tampil, 5 menit pembongkaran set).',
    daysFromNow: 2, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Show Time',
  },
  {
    id: 'tp-pertunjukan-pimpro-2',
    title: 'Kontrol Sterilisasi Panggung & Pimpin Penilaian',
    description: 'Mengontrol alur sterilisasi panggung bersama Stage Crew serta memimpin penilaian berjenjang melalui borang evaluasi web.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Show Time',
  },
  // -------- SEKRETARIS --------
  {
    id: 'tp-pertunjukan-sekre-1',
    title: 'Zonasi Meja Penerimaan Tamu & Validasi Tiket',
    description: 'Berkoordinasi dengan tim registrasi untuk membagi zonasi meja penerimaan tamu dan penyelarasan validasi tiket digital berbasis web.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Show Time',
  },
  {
    id: 'tp-pertunjukan-sekre-2',
    title: 'Sambut Tamu & Catat Statistik Kehadiran',
    description: 'Menyambut tamu undangan, mengontrol pemindaian tiket digital, serta mencatat statistik kehadiran riil penonton.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Show Time',
  },
  // -------- BENDAHARA --------
  {
    id: 'tp-pertunjukan-bend-1',
    title: 'Koordinasi Logistik & Dana Darurat',
    description: 'Berkoordinasi dengan penanggung jawab logistik untuk pembagian ruang penyimpanan dan penyediaan dana darurat bersama.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Show Time',
  },
  {
    id: 'tp-pertunjukan-bend-2',
    title: 'Alokasi Dana P3K & Konsumsi Tim',
    description: 'Mengalokasikan dana darurat P3K serta teknis cepat, dan berkoordinasi dengan Divisi Konsumsi untuk pasokan makanan tim.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Show Time',
  },
  // -------- SUTRADARA --------
  {
    id: 'tp-pertunjukan-sut-1',
    title: 'Koordinasi Stage Manager — Durasi Tepat 30 Menit',
    description: 'Berkoordinasi ketat dengan Stage Manager terkait instruksi alur adegan agar durasi pertunjukan tepat 30 menit.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Show Time',
  },
  {
    id: 'tp-pertunjukan-sut-2',
    title: 'Motivasi Akhir & Input Nilai Keaktoran',
    description: 'Memberikan motivasi akhir di balik panggung, memantau kestabilan emosi pemain, dan menginput nilai keaktoran ke dalam sistem penilaian berjenjang di web.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Show Time',
  },
  // -------- ASISTEN SUTRADARA --------
  {
    id: 'tp-pertunjukan-astrada-1',
    title: 'Alur Pemanggilan Pemain ke Wing Panggung',
    description: 'Berkoordinasi dengan Floor Manager untuk alur pemanggilan pemain dari ruang tunggu ke area wing panggung.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Show Time',
  },
  {
    id: 'tp-pertunjukan-astrada-2',
    title: 'Pemanasan Vokal & Kontrol Urutan Adegan 30 Menit',
    description: 'Memandu pemanasan vokal singkat, mengontrol urutan adegan agar sesuai alokasi 30 menit tampil, serta siap memegang kendali penyutradaraan jika Sutradara berhalangan.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Show Time',
  },
  // -------- PEMAIN --------
  {
    id: 'tp-pertunjukan-pemain-1',
    title: 'Pemanasan Vokal Fisik & Siap di Wing',
    description: 'Wajib mengikuti pemanasan vokal dan fisik singkat di balik panggung, menjaga ketenangan di ruang tunggu, serta siap di area wing tepat waktu.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Show Time',
  },
  {
    id: 'tp-pertunjukan-pemain-2',
    title: 'Tampil Maksimal 30 Menit & Isi Penilaian Rekan',
    description: 'Tampil maksimal dalam durasi 30 menit dan mengisi lembar penilaian berjenjang antarteman via web pasca-pertunjukan.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Show Time',
  },
];

// =====================================================
// TAHAP 4: PASCA
// =====================================================
const PASCA: TaskTemplate[] = [
  // -------- PIMPINAN PRODUKSI --------
  {
    id: 'tp-pasca-pimpro-1',
    title: 'Pembersihan Total Panggung & Kembalikan Area',
    description: 'Mengoordinasikan pembersihan total panggung bersama seluruh tim dan mengembalikan area kepada pengelola tempat.',
    daysFromNow: 3, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Pasca-Produksi',
  },
  {
    id: 'tp-pasca-pimpro-2',
    title: 'Forum Apresiasi & Susun LPJ Komprehensif',
    description: 'Memimpin forum apresiasi resmi dan menyusun Laporan Pertanggungjawaban Produksi komprehensif berbasis data terintegrasi dari sistem web.',
    daysFromNow: 7, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Pimpinan Produksi',
    reference: 'Job Desc Pimpro § Pasca-Produksi',
  },
  // -------- SEKRETARIS --------
  {
    id: 'tp-pasca-sekre-1',
    title: 'Kompilasi Dokumen & Data Penonton ke Arsip Web',
    description: 'Mengompilasi dokumen produksi, laporan presensi digital, dan data penonton ke dalam direktori arsip web yang terstruktur rapi.',
    daysFromNow: 5, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sekretaris',
    reference: 'Job Desc Sekretaris § Pasca-Produksi',
  },
  // -------- BENDAHARA --------
  {
    id: 'tp-pasca-bend-1',
    title: 'Rekap Nota, LPJ Keuangan & Paparkan Transparansi',
    description: 'Merekapitulasi nota transaksi digital, menyusun Laporan Keuangan Akhir di sistem web, menghitung sisa kas, dan memaparkan transparansi keuangan kepada Guru Pembimbing dan seluruh kelas.',
    daysFromNow: 7, priority: 'CRITICAL', targetType: 'PERAN', targetRole: 'Bendahara',
    reference: 'Job Desc Bendahara § Pasca-Produksi',
  },
  // -------- SUTRADARA --------
  {
    id: 'tp-pasca-sut-1',
    title: 'Analisis Keaktoran Individual via Web',
    description: 'Menyampaikan analisis perkembangan keaktoran harian secara individual via web dan mengonsolidasikan catatan akhir penyutradaraan.',
    daysFromNow: 5, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Sutradara',
    reference: 'Job Desc Sutradara § Pasca-Produksi',
  },
  // -------- ASISTEN SUTRADARA --------
  {
    id: 'tp-pasca-astrada-1',
    title: 'Konsolidasi Catatan Harian Pemain ke Arsip Web',
    description: 'Mengonsolidasikan seluruh catatan perkembangan harian pemain dan mengunggahnya ke dalam arsip evaluasi web.',
    daysFromNow: 5, priority: 'MEDIUM', targetType: 'PERAN', targetRole: 'Asisten Sutradara',
    reference: 'Job Desc Astrada § Pasca-Produksi',
  },
  // -------- PEMAIN --------
  {
    id: 'tp-pasca-pemain-1',
    title: 'Bersihkan Rias & Isi Refleksi Kritis Keaktoran',
    description: 'Membersihkan riasan wajah, merapikan kostum pribadi, dan mengisi lembar refleksi kritis keaktoran di platform web.',
    daysFromNow: 3, priority: 'HIGH', targetType: 'PERAN', targetRole: 'Pemain',
    reference: 'Job Desc Pemain § Pasca-Produksi',
  },
];

// =====================================================
// TAMBAHAN: 6 DIVISI (Kostum, Rias, Properti, Panggung, Dokpub, Musik)
// Digabung dengan array di atas
// =====================================================
const DIVISI_PERSIAPAN: TaskTemplate[] = [
  {
    id: 'tp-persiapan-kostum-1',
    title: 'Moodboard Kostum (boleh pakai AI)',
    description: 'Mengembangkan moodboard kostum memanfaatkan AI, mengunggah rancangan visual ke web.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Perencanaan',
  },
  {
    id: 'tp-persiapan-kostum-2',
    title: 'Data Ukuran Tubuh Pemain',
    description: 'Mendata ukuran tubuh pemain dari data mandiri di web.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Perencanaan',
  },
  {
    id: 'tp-persiapan-rias-1',
    title: 'Face Chart Berbasis Analisis Karakter (boleh AI)',
    description: 'Membuat rancangan face chart berbasis analisis karakter menggunakan AI, mengunggah hasilnya ke platform web.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Perencanaan',
  },
  {
    id: 'tp-persiapan-rias-2',
    title: 'Data Kit Rias Pribadi Higienis',
    description: 'Mendata kit rias pribadi yang higienis.',
    daysFromNow: 10, priority: 'MEDIUM', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Perencanaan',
  },
  {
    id: 'tp-persiapan-rias-3',
    title: 'Alur Jadwal Urutan Merias',
    description: 'Menyusun alur jadwal urutan merias yang ringkas agar tidak menguras stamina pemain sebelum tampil.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Perencanaan',
  },
  {
    id: 'tp-persiapan-properti-1',
    title: 'Breakdown Properti per Adegan',
    description: 'Menyusun breakdown daftar properti per adegan di platform web dengan memprioritaskan barang daur ulang yang mudah didapat tanpa memberatkan biaya.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Perencanaan',
  },
  {
    id: 'tp-persiapan-properti-2',
    title: 'Denah Penataan Properti di Wing',
    description: 'Merancang denah penataan properti di wing panggung bersama Stage Crew.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Perencanaan',
  },
  {
    id: 'tp-persiapan-panggung-1',
    title: 'Sketsa Denah Panggung 2D per Adegan',
    description: 'Merancang sketsa denah panggung dua dimensi per adegan, mengunggah denah ke platform web.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Perencanaan',
  },
  {
    id: 'tp-persiapan-panggung-2',
    title: 'Peta Alur Keluar Masuk Dekorasi',
    description: 'Memetakan alur keluar masuk dekorasi panggung.',
    daysFromNow: 10, priority: 'MEDIUM', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Perencanaan',
  },
  {
    id: 'tp-persiapan-panggung-3',
    title: 'Sistem Cross-Operator (Kru Cadangan)',
    description: 'Menyusun sistem Cross-Operator (kru cadangan) agar tugas panggung tetap berjalan jika ada anggota yang harus mengikuti jadwal les.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Perencanaan',
  },
  {
    id: 'tp-persiapan-dokpub-1',
    title: 'Strategi Publikasi Digital & Kalender Konten',
    description: 'Menyusun strategi publikasi digital berbasis web, merancang kalender konten, serta membuat materi promosi di waktu senggang tanpa mengganggu jam belajar dan les.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Perencanaan',
  },
  {
    id: 'tp-persiapan-musik-1',
    title: 'Inventarisasi Alat Musik',
    description: 'Menginventarisasi alat musik dan mengunggah data ke web.',
    daysFromNow: 10, priority: 'MEDIUM', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Perencanaan',
  },
  {
    id: 'tp-persiapan-musik-2',
    title: 'Sound Cue Sheet ke Web',
    description: 'Mengunggah sound cue sheet ke platform web.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Perencanaan',
  },
  {
    id: 'tp-persiapan-musik-3',
    title: 'Tata Letak Mikrofon Panggung',
    description: 'Merancang tata letak mikrofon panggung bersama Stage Crew.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Perencanaan',
  },
  {
    id: 'tp-persiapan-musik-4',
    title: 'Skema Cross-Operator Penataan Suara',
    description: 'Menerapkan skema Cross-Operator pada penataan suara agar latihan tidak terganggu jika penata musik utama sedang les.',
    daysFromNow: 10, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Perencanaan',
  },
];

const DIVISI_PELAKSANAAN: TaskTemplate[] = [
  {
    id: 'tp-pelaksanaan-kostum-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-kostum-2',
    title: 'Fitting Kostum Bergantian & Modifikasi Pakaian Bekas',
    description: 'Melakukan fitting kostum secara bergantian pada jam kegiatan resmi sekolah (maks 1 jam/sesi), memodifikasi pakaian bekas.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-kostum-3',
    title: 'Latih Simulasi Quick Change',
    description: 'Melatih simulasi quick change (ganti baju cepat).',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-kostum-4',
    title: 'Kunci & Simpan Aset Kostum (Ujian & Libur)',
    description: 'Menghentikan seluruh pengerjaan kostum serta mengunci dan menyimpan seluruh aset kostum dengan aman di sekolah sebelum 2 minggu Ujian PAS/SAS dan 1 minggu libur semester dimulai.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-rias-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-rias-2',
    title: 'Latih Aplikasi Rias Pemain & Shadow Player',
    description: 'Melatih aplikasi rias pada pemain dan Shadow Player dalam alokasi waktu maksimal 1 jam per sesi termasuk briefing di sekolah.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-rias-3',
    title: 'Sterilkan & Amankan Alat Rias (Ujian & Libur)',
    description: 'Mensterilkan, mengemas, dan mengamankan seluruh peralatan rias di sekolah sebelum 2 minggu pekan Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-properti-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-properti-2',
    title: 'Rakit Properti Sederhana di Sekolah (Maks 1 Jam)',
    description: 'Merakit properti sederhana di sekolah hanya pada jam kegiatan resmi (maks 1 jam per pertemuan termasuk rapat teknis), menyusun tata letak properti.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-properti-3',
    title: 'Sediakan Pasokan Air Galon saat Latihan',
    description: 'Menyediakan pasokan air galon saat latihan berlangsung.',
    daysFromNow: 14, priority: 'MEDIUM', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-properti-4',
    title: 'Simpan Properti di Gudang (Ujian & Libur)',
    description: 'Menyimpan seluruh properti panggung di gudang sekolah dalam keadaan terkunci sebelum 2 minggu pekan Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-panggung-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-panggung-2',
    title: 'Pasang Lakban Spotting Posisi Pemain',
    description: 'Memasang lakban penanda spotting posisi pemain di panggung.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-panggung-3',
    title: 'Konstruksi Set Panggung Sederhana',
    description: 'Mengonstruksi set panggung sederhana sesuai desain.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-panggung-4',
    title: 'Simulasi Pemindahan Set (Maks 1 Jam)',
    description: 'Melatih simulasi pemindahan set panggung maksimal 1 jam per sesi termasuk rapat koordinasi.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-panggung-5',
    title: 'Amankan Set Dekorasi (Ujian & Libur)',
    description: 'Menghentikan total aktivitas panggung fisik dan mengamankan seluruh set dekorasi di sekolah sebelum masa 2 minggu Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-dokpub-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-dokpub-2',
    title: 'Dokumentasi BTS dalam Durasi Latihan',
    description: 'Mendokumentasikan proses belakang layar secara ringkas dalam durasi latihan maksimal 1 jam per pertemuan.',
    daysFromNow: 14, priority: 'MEDIUM', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-dokpub-3',
    title: 'Unggah Video Latihan ke Web (Evaluasi Asinkron)',
    description: 'Mengunggah rekaman video latihan ke platform web agar Sutradara dan pemain dapat melakukan evaluasi asinkron dari rumah.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-dokpub-4',
    title: 'Scheduled Posting Promosi (Libur)',
    description: 'Mengaktifkan fitur unggahan otomatis scheduled posting untuk materi promosi ringan di media sosial/web selama 1 minggu libur semester.',
    daysFromNow: 30, priority: 'MEDIUM', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-musik-1',
    title: 'Ikut Pemanasan Bersama Tim',
    description: 'Disarankan mengikuti pemanasan bersama tim di awal latihan.',
    daysFromNow: 14, priority: 'LOW', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-musik-2',
    title: 'Unggah Draf Rekaman Musik Iringan',
    description: 'Mengunggah draf rekaman musik iringan ke platform web agar pemain bisa berlatih hafalan dari rumah secara mandiri.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-musik-3',
    title: 'Latihan Musik Efisien (Maks 1 Jam)',
    description: 'Menggelar latihan musik efisien maksimal 1 jam per pertemuan termasuk rapat penyelarasan adegan.',
    daysFromNow: 14, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Pelaksanaan',
  },
  {
    id: 'tp-pelaksanaan-musik-4',
    title: 'Kunci Alat Musik (Ujian & Libur)',
    description: 'Menuntaskan penyelarasan seluruh musik iringan dan mengunci seluruh alat/instrumen musik di ruang penyimpanan sekolah sebelum 2 minggu Ujian PAS/SAS dan 1 minggu libur semester.',
    daysFromNow: 30, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Pelaksanaan',
  },
];

const DIVISI_PERTUNJUKAN: TaskTemplate[] = [
  {
    id: 'tp-pertunjukan-kostum-1',
    title: 'Bagi Area Rak Gantung Baju di Balik Panggung',
    description: 'Berkoordinasi dengan penata busana kerabat kerja untuk pembagian area rak gantung baju di balik panggung.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Show Time',
  },
  {
    id: 'tp-pertunjukan-kostum-2',
    title: 'Tata Area Ganti & Dampingi Quick Change',
    description: 'Menata area ganti sesuai urutan adegan dan mendampingi proses ganti baju cepat (quick change) pemain secara sigap.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Show Time',
  },
  {
    id: 'tp-pertunjukan-rias-1',
    title: 'Koordinasi Area Cermin & Listrik dengan Kerabat Kerja',
    description: 'Berkoordinasi dengan tim rias kerabat kerja untuk berbagi area cermin dan stopkontak listrik secara bergantian.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Show Time',
  },
  {
    id: 'tp-pertunjukan-rias-2',
    title: 'Eksekusi Tata Rias Sesuai Timeline & Touch-Up',
    description: 'Mengeksekusi tata rias pemain sesuai timeline urutan tampil serta bersiap di belakang panggung untuk touch-up cepat di antara adegan.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Show Time',
  },
  {
    id: 'tp-pertunjukan-properti-1',
    title: 'Bagi Zona Prop Table di Wing Panggung',
    description: 'Berkoordinasi dengan tim logistik kerabat kerja untuk pembagian zona prop table di wing panggung agar tidak tertukar.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Show Time',
  },
  {
    id: 'tp-pertunjukan-properti-2',
    title: 'Tata & Pindah Properti Cepat (10 Menit + 30 Menit)',
    description: 'Mengatur penataan dan pemindahan properti dalam alokasi waktu 10 menit persiapan awal serta mengeksekusi transisi properti secara cepat selama 30 menit pertunjukan.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Show Time',
  },
  {
    id: 'tp-pertunjukan-panggung-1',
    title: 'Pasang Set 10 Menit & Bongkar Set 5 Menit',
    description: 'Berkoordinasi dengan kru panggung kerabat kerja untuk mengeksekusi pasang set dalam waktu 10 menit pertama dan pembongkaran cepat set dalam waktu 5 menit terakhir.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Show Time',
  },
  {
    id: 'tp-pertunjukan-panggung-2',
    title: 'Jaga Sterilitas & Pindah Dekorasi Tanpa Suara',
    description: 'Menjaga sterilitas area samping panggung serta memindahkan dekorasi secara cepat dan tanpa suara selama 30 menit pertunjukan.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Show Time',
  },
  {
    id: 'tp-pertunjukan-dokpub-1',
    title: 'Posisi Tripod & Sudut Kamera',
    description: 'Berkoordinasi dengan tim dokumentasi kerabat kerja untuk pembagian posisi tripod dan sudut pengambilan gambar.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Show Time',
  },
  {
    id: 'tp-pertunjukan-dokpub-2',
    title: 'Rekam Pementasan 30 Menit & Foto Momen',
    description: 'Merekam pementasan utuh berdurasi 30 menit dengan audio jernih dan mengabadikan foto momen panggung serta dinamika penonton.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Show Time',
  },
  {
    id: 'tp-pertunjukan-musik-1',
    title: 'Bagi Channel Mixer & Mikrofon',
    description: 'Berkoordinasi dengan sound engineer kerabat kerja atau pengelola tempat terkait pembagian channel mixer audio dan penggunaan mikrofon.',
    daysFromNow: 1, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Show Time',
  },
  {
    id: 'tp-pertunjukan-musik-2',
    title: 'Check Sound 10 Menit & Mainkan Musik Presisi',
    description: 'Melakukan check sound pada 10 menit alokasi persiapan awal, serta memainkan musik iringan secara presisi mengikuti alur adegan pementasan selama 30 menit tampil.',
    daysFromNow: 1, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Show Time',
  },
];

const DIVISI_PASCA: TaskTemplate[] = [
  {
    id: 'tp-pasca-kostum-1',
    title: 'Cuci, Bersihkan & Kembalikan Aset Kostum',
    description: 'Melakukan pembersihan, pencucian, dan pengembalian seluruh aset kostum pinjaman serta menginput data inventaris akhir ke sistem web.',
    daysFromNow: 5, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Busana',
    reference: 'Job Desc Kostum § Pasca-Produksi',
  },
  {
    id: 'tp-pasca-rias-1',
    title: 'Bersihkan Rias Pemain & Sterilkan Alat',
    description: 'Mendampingi pembersihan riasan pemain menggunakan make-up remover, mensterilkan kembali alat rias, dan mengunggah laporan kerja ke sistem web.',
    daysFromNow: 3, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Rias',
    reference: 'Job Desc Rias § Pasca-Produksi',
  },
  {
    id: 'tp-pasca-properti-1',
    title: 'Bersihkan Area Backstage & Kembalikan Inventaris',
    description: 'Membersihkan area belakang panggung dari sampah, mengembalikan inventaris sekolah, dan memperbarui status barang di sistem web.',
    daysFromNow: 3, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Perlengkapan',
    reference: 'Job Desc Properti § Pasca-Produksi',
  },
  {
    id: 'tp-pasca-panggung-1',
    title: 'Bongkar Set & Kembalikan Panggung ke Semula',
    description: 'Membongkar set dekorasi secara aman, mengembalikan kondisi panggung seperti semula, dan mengisi borang penilaian berjenjang di web.',
    daysFromNow: 3, priority: 'CRITICAL', targetType: 'DIVISI', targetDivision: 'Tata Panggung',
    reference: 'Job Desc Panggung § Pasca-Produksi',
  },
  {
    id: 'tp-pasca-dokpub-1',
    title: 'Sunting Aftermovie & Upload ke Repositori Web',
    description: 'Menyunting video aftermovie sinematik, mengorganisir seluruh file foto dan video ke repositori web yang diakses real-time oleh semua siswa dan guru.',
    daysFromNow: 7, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Publikasi & Dokumentasi',
    reference: 'Job Desc Dokpub § Pasca-Produksi',
  },
  {
    id: 'tp-pasca-musik-1',
    title: 'Rapikan Instrumen & Laporan Teknis Suara',
    description: 'Merapikan, membersihkan, dan mengembalikan seluruh instrumen musik ke tempat penyimpanan serta mengisi laporan evaluasi teknis suara di platform web.',
    daysFromNow: 5, priority: 'HIGH', targetType: 'DIVISI', targetDivision: 'Tata Musik & Suara',
    reference: 'Job Desc Musik § Pasca-Produksi',
  },
];

// =====================================================
// GABUNGKAN SEMUA (peran + divisi)
// =====================================================
export const TASK_TEMPLATES: Record<ProductionStage, TaskTemplate[]> = {
  PERSIAPAN: [...PERSIAPAN, ...DIVISI_PERSIAPAN],
  PELAKSANAAN: [...PELAKSANAAN, ...DIVISI_PELAKSANAAN],
  PERTUNJUKAN: [...PERTUNJUKAN, ...DIVISI_PERTUNJUKAN],
  PASCA: [...PASCA, ...DIVISI_PASCA],
};

export const STAGE_INFO_TASK = {
  PERSIAPAN: { label: 'Tahap 1 — Persiapan', gradient: 'from-amber-600 to-amber-800', desc: 'Riset, naskah, desain, RAB, Master Schedule' },
  PELAKSANAAN: { label: 'Tahap 2 — Pelaksanaan', gradient: 'from-blue-600 to-blue-800', desc: 'Latihan rutin, produksi properti & kostum, dokumentasi' },
  PERTUNJUKAN: { label: 'Tahap 3 — Pertunjukan', gradient: 'from-purple-600 to-purple-800', desc: 'Gladi bersih, pementasan utama, standby' },
  PASCA: { label: 'Tahap 4 — Pasca Produksi', gradient: 'from-emerald-600 to-emerald-800', desc: 'Evaluasi, LPJ, pengembalian aset, aftermovie' },
};

export const STAGE_INFO_TASK = {
  PERSIAPAN: { label: 'Tahap 1 — Persiapan', gradient: 'from-amber-600 to-amber-800', desc: 'Riset, naskah, desain, RAB, Master Schedule' },
  PELAKSANAAN: { label: 'Tahap 2 — Pelaksanaan', gradient: 'from-blue-600 to-blue-800', desc: 'Latihan rutin, produksi properti & kostum, dokumentasi' },
  PERTUNJUKAN: { label: 'Tahap 3 — Pertunjukan', gradient: 'from-purple-600 to-purple-800', desc: 'Gladi bersih, pementasan utama, standby' },
  PASCA: { label: 'Tahap 4 — Pasca Produksi', gradient: 'from-emerald-600 to-emerald-800', desc: 'Evaluasi, LPJ, pengembalian aset, aftermovie' },
};
