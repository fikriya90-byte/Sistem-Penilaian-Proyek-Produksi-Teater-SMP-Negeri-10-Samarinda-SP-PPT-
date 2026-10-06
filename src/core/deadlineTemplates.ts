import { ProductionStage, DivisionType, UserRole } from './types';

export interface DeadlineTemplate {
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

// =========================================================
// TEMPLATE BERDASARKAN DOKUMEN "A. TIM PRODUKSI"
// =========================================================
export const DEADLINE_TEMPLATES: Record<ProductionStage, DeadlineTemplate[]> = {

  // ============================================
  // TAHAP 1: PRA-PRODUKSI (PERSIAPAN)
  // ============================================
  PERSIAPAN: [
    // ---------- PIMPINAN PRODUKSI ----------
    {
      id: 'persiapan-pimpro-1',
      title: 'Menyusun Jadwal Induk (Master Schedule) + Persetujuan Guru',
      description: 'Menyusun Master Schedule seluruh kegiatan produksi teater dan mengamankan persetujuan tertulis dari Guru Pembimbing.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pra-Produksi',
    },
    {
      id: 'persiapan-pimpro-2',
      title: 'Menetapkan Larangan Aktivitas Fisik Saat Ujian & Libur',
      description: 'Menetapkan jadwal larangan aktivitas fisik pada pekan ujian (PAS/SAS) dan libur semester ke dalam kalender kerja.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pra-Produksi',
    },
    {
      id: 'persiapan-pimpro-3',
      title: 'Memvalidasi & Menandatangani RAB Bersama Bendahara',
      description: 'Memvalidasi dan menandatangani Rencana Anggaran Biaya (RAB) bersama Bendahara di platform web.',
      daysFromNow: 10,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pra-Produksi',
    },

    // ---------- SEKRETARIS ----------
    {
      id: 'persiapan-sekre-1',
      title: 'Mencetak & Membagikan Salinan Naskah Drama',
      description: 'Mencetak dan membagikan salinan naskah drama (script) kepada seluruh panitia dan pemain.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pra-Produksi',
    },
    {
      id: 'persiapan-sekre-2',
      title: 'Mendata Jadwal Ketidakhadiran Anggota',
      description: 'Memantau dan mendata jadwal ketidakhadiran anggota (jadwal les/sakit) untuk dilaporkan berkala kepada Sutradara.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pra-Produksi',
    },

    // ---------- BENDAHARA ----------
    {
      id: 'persiapan-bend-1',
      title: 'Menyusun RAB Prioritaskan Bahan Daur Ulang',
      description: 'Menyusun RAB setiap divisi dengan memprioritaskan pemanfaatan bahan bekas atau daur ulang.',
      daysFromNow: 10,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pra-Produksi',
    },
    {
      id: 'persiapan-bend-2',
      title: 'Menyiapkan Buku Kas & Lembar Kuitansi Kosong',
      description: 'Menyiapkan buku kas serta lembar kuitansi kosong untuk pembukuan produksi.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pra-Produksi',
    },

    // ---------- DOKPUB ----------
    {
      id: 'persiapan-dokpub-1',
      title: 'Mendesain Poster Utama Pementasan',
      description: 'Mendesain satu Poster Utama pementasan teater yang komunikatif dan menarik.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pra-Produksi',
    },
    {
      id: 'persiapan-dokpub-2',
      title: 'Menyusun Timeline Publikasi Promosi',
      description: 'Menyusun Timeline Publikasi untuk jadwal rilis poster dan materi promosi.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pra-Produksi',
    },

    // ---------- SUTRADARA (pelengkap dari alur baru) ----------
    {
      id: 'persiapan-sut-1',
      title: 'Menyusun Scene Breakdown & Visi Penyutradaraan',
      description: 'Menyusun sistem latihan modular berbasis Scene Breakdown dan mengunggah Visi Penyutradaraan ke web.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pra-Produksi',
    },
    {
      id: 'persiapan-sut-2',
      title: 'Casting Pemain & Uji Baca Naskah',
      description: 'Melakukan casting pemain dan uji baca naskah untuk menentukan pemeran utama dan pendukung.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pra-Produksi',
    },

    // ---------- ASISTEN SUTRADARA ----------
    {
      id: 'persiapan-astrada-1',
      title: 'Menyusun Call Sheet Per Adegan',
      description: 'Menyusun Call Sheet latihan per adegan dan menyelaraskan dengan jadwal les anggota.',
      daysFromNow: 8,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pra-Produksi',
    },
    {
      id: 'persiapan-astrada-2',
      title: 'Mengunggah Prompt Book Berisi Instruksi Cueing',
      description: 'Mengunggah naskah panduan utama prompt book berisi instruksi cueing ke web.',
      daysFromNow: 8,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pra-Produksi',
    },

    // ---------- PEMAIN ----------
    {
      id: 'persiapan-pemain-1',
      title: 'Mendalami Latar Belakang Tokoh & Lembar Analisis',
      description: 'Mendalami latar belakang tokoh yang diperankan dan menyusun lembar analisis karakter di web.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pra-Produksi',
    },
    {
      id: 'persiapan-pemain-2',
      title: 'Menyerahkan Jadwal Les Pribadi via Web',
      description: 'Menyerahkan jadwal les pribadi melalui sistem web untuk sinkronisasi dengan jadwal latihan.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pra-Produksi',
    },

    // ---------- KOORDINATOR DIVISI (Breakdown Konsep) ----------
    {
      id: 'persiapan-koor-busana-1',
      title: 'Moodboard Kostum & Data Ukuran Tubuh Pemain',
      description: 'Mengembangkan moodboard kostum (boleh pakai AI), upload rancangan visual, dan mendata ukuran tubuh pemain.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pra-Produksi',
    },
    {
      id: 'persiapan-koor-rias-1',
      title: 'Face Chart & Jadwal Urutan Rias',
      description: 'Membuat face chart berbasis analisis karakter, upload ke web, dan menyusun jadwal urutan merias yang ringkas.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pra-Produksi',
    },
    {
      id: 'persiapan-koor-properti-1',
      title: 'Breakdown Properti & Denah Wing Panggung',
      description: 'Menyusun breakdown daftar properti per adegan (prioritas daur ulang) dan merancang denah penataan properti di wing.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pra-Produksi',
    },
    {
      id: 'persiapan-koor-panggung-1',
      title: 'Sketsa Denah Panggung 2D & Cross-Operator',
      description: 'Merancang sketsa denah panggung 2D per adegan, upload ke web, dan menyusun sistem Cross-Operator.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Panggung § Pra-Produksi',
    },
    {
      id: 'persiapan-koor-musik-1',
      title: 'Sound Cue Sheet & Tata Letak Mikrofon',
      description: 'Menginventarisasi alat musik, upload sound cue sheet, dan merancang tata letak mikrofon bersama Stage Crew.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Pra-Produksi',
    },
  ],

  // ============================================
  // TAHAP 2: PELAKSANAAN (PROSES ±3 BULAN)
  // ============================================
  PELAKSANAAN: [
    // ---------- PIMPINAN PRODUKSI ----------
    {
      id: 'pelaksanaan-pimpro-b1',
      title: 'Bulan 1: Kontrol Administrasi Awal & Target Divisi',
      description: 'Mengontrol penyelesaian administrasi awal, pembagian naskah, dan ketercapaian target perencanaan setiap divisi.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-pimpro-b2',
      title: 'Bulan 2: Monitoring Target Fisik Mingguan',
      description: 'Melakukan monitoring berkala terhadap ketercapaian target fisik mingguan setiap divisi (properti, kostum, alat rias).',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-pimpro-b3',
      title: 'Bulan 3: Awasi Latihan Gabungan (Rehearsal)',
      description: 'Mengawasi pelaksanaan Latihan Gabungan (aktor, musik, tata cahaya, tata panggung) agar berjalan lancar tanpa bentrok jadwal.',
      daysFromNow: 90,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pelaksanaan Bulan 3',
    },

    // ---------- SEKRETARIS ----------
    {
      id: 'pelaksanaan-sekre-b1',
      title: 'Bulan 1: Mengisi Buku Log Produksi',
      description: 'Mengatur dan mengisi Buku Log Produksi dengan mencatat kehadiran setiap sesi latihan dan hasil rapat.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-sekre-b2',
      title: 'Bulan 2: Meneruskan Catatan Revisi Sutradara',
      description: 'Meneruskan catatan revisi dialog atau petunjuk khusus dari Sutradara kepada divisi Kostum, Musik, Rias, atau Properti.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-sekre-b3',
      title: 'Bulan 3: Koordinasi Cetak Nametag & Tiket Penonton',
      description: 'Berkoordinasi dengan divisi Publikasi dalam menyiapkan cetakan nametag panitia dan tiket penonton.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pelaksanaan Bulan 3',
    },

    // ---------- BENDAHARA ----------
    {
      id: 'pelaksanaan-bend-b1',
      title: 'Bulan 1: Buka Pembukuan Kas & Alokasi Dana Divisi',
      description: 'Membuka pembukuan kas awal dan mengatur alokasi dana belanja bahan/perlengkapan setiap divisi.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-bend-b2',
      title: 'Bulan 2: Audit Arus Kas & Bukti Nota Fisik',
      description: 'Melakukan audit berkala dan mencatat arus kas masuk-keluar berdasarkan bukti nota belanja fisik dari setiap divisi.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-bend-b3',
      title: 'Bulan 3: Bekukan Pengeluaran Dana Saat Ujian',
      description: 'Membekukan pengeluaran dana dan penagihan kas selama pekan ujian sekolah berlangsung.',
      daysFromNow: 90,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pelaksanaan Bulan 3',
    },

    // ---------- DOKPUB ----------
    {
      id: 'pelaksanaan-dokpub-b1',
      title: 'Bulan 1-2: Dokumentasi BTS Latihan & Dekorasi',
      description: 'Mengambil foto dan rekaman video Behind the Scene selama proses latihan dialog, pembuatan dekorasi, dan fitting kostum.',
      daysFromNow: 60,
      priority: 'MEDIUM',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pelaksanaan Bulan 1-2',
    },
    {
      id: 'pelaksanaan-dokpub-b2',
      title: 'Bulan 2-3: Publikasi Berkala via Media Sosial',
      description: 'Mempublikasikan materi promosi secara berkala melalui media sosial atau platform digital sekolah.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pelaksanaan Bulan 2-3',
    },

    // ---------- LAIN-LAIN (SEMUA DIVISI) ----------
    {
      id: 'pelaksanaan-semua-1',
      title: 'Ikut Pemanasan Bersama & Briefing (Maks 1 Jam)',
      description: 'Seluruh divisi mengikuti pemanasan bersama dan briefing singkat. Total latihan maks 1 jam/pertemuan, maks 2x/minggu sebelum H-14. Dilarang latihan di akhir pekan.',
      daysFromNow: 14,
      priority: 'HIGH',
      targetType: 'SEMUA',
      reference: 'Job Desc Semua Divisi § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-pemain-1',
      title: 'Setor Hafalan Dialog via Video Asinkron',
      description: 'Pemain menyetorkan latihan hafalan dialog via rekaman video ke platform web secara asinkron dari rumah tanpa mengganggu waktu belajar & les.',
      daysFromNow: 21,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-astrada-1',
      title: 'Kelola Setor Hafalan Dialog & Latih Shadow Player',
      description: 'Mengelola penyerahan setor hafalan dialog via audio/video di web dan melatih Shadow Player sebagai cadangan.',
      daysFromNow: 21,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-semua-2',
      title: 'Henti Total Aktivitas Fisik (Ujian PAS/SAS & Libur)',
      description: 'SEMUA divisi WAJIB menghentikan aktivitas fisik selama 2 minggu pekan Ujian PAS/SAS dan 1 minggu libur semester. Aset dikunci & diamankan.',
      daysFromNow: 90,
      priority: 'CRITICAL',
      targetType: 'SEMUA',
      reference: 'Job Desc Semua Peran § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-koor-busana-1',
      title: 'Fitting Kostum Bergantian & Simulasi Quick Change',
      description: 'Fitting kostum bergantian (maks 1 jam/sesi), modifikasi pakaian bekas, dan melatih simulasi quick change.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-koor-rias-1',
      title: 'Latihan Aplikasi Rias & Shadow Player',
      description: 'Melatih aplikasi rias pada pemain dan Shadow Player (maks 1 jam/sesi termasuk briefing di sekolah).',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-koor-properti-1',
      title: 'Merakit Properti & Sediakan Air Minum Latihan',
      description: 'Merakit properti sederhana di sekolah (maks 1 jam/pertemuan) dan menyediakan pasokan air minum saat latihan.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-koor-panggung-1',
      title: 'Pasang Lakban Spotting & Konstruksi Set Sederhana',
      description: 'Memasang lakban penanda spotting posisi pemain, konstruksi set panggung, dan simulasi pemindahan set (maks 1 jam/sesi).',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Panggung § Pelaksanaan',
    },
    {
      id: 'pelaksanaan-koor-musik-1',
      title: 'Unggah Draf Rekaman Musik Iringan ke Web',
      description: 'Mengunggah draf rekaman musik iringan ke web agar pemain bisa berlatih hafalan dari rumah secara mandiri.',
      daysFromNow: 21,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Pelaksanaan',
    },
  ],

  // ============================================
  // TAHAP 3: SHOW TIME (PERTUNJUKAN UTAMA)
  // ============================================
  PERTUNJUKAN: [
    // ---------- PIMPINAN PRODUKSI ----------
    {
      id: 'pertunjukan-pimpro-1',
      title: 'Taklimat Akhir 10 Menit Sebelum Pintu Dibuka',
      description: 'Memimpin Taklimat Akhir (Final Briefing) 10 menit sebelum pintu aula/panggung dibuka untuk penonton.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Show Time',
    },
    {
      id: 'pertunjukan-pimpro-2',
      title: 'Kendali Waktu: 10 Menit Persiapan + 30 Menit Tampil + 5 Menit Bongkar',
      description: 'Bertindak sebagai pengendali waktu pementasan dengan mengawasi 10 menit persiapan awal panggung, 30 menit durasi pementasan, dan 5 menit pembongkaran agar seluruh rangkaian tepat waktu.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Show Time',
    },

    // ---------- SEKRETARIS (FOH) ----------
    {
      id: 'pertunjukan-sekre-1',
      title: 'FOH: Arahkan Antrean, Validasi Tiket, Bagikan Buku Acara',
      description: 'Bertugas di area Front of House (FOH) untuk mengarahkan antrean penonton, memvalidasi tiket, dan membagikan buku acara.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Show Time',
    },
    {
      id: 'pertunjukan-sekre-2',
      title: 'Catat Statistik Riil Jumlah Penonton',
      description: 'Mencatat statistik riil jumlah penonton yang hadir di ruang pementasan.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Show Time',
    },

    // ---------- BENDAHARA ----------
    {
      id: 'pertunjukan-bend-1',
      title: 'Sediakan Tas Logistik Darurat di Belakang Panggung',
      description: 'Menyediakan Tas Logistik Darurat di belakang panggung: perlengkapan P3K dasar, peniti, selotip, dan air minum tambahan.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Show Time',
    },
    {
      id: 'pertunjukan-bend-2',
      title: 'Jaga & Catat Uang Kas Hasil Tiket di FOH',
      description: 'Menjaga dan mencatat uang kas dari hasil pengelolaan tiket di area FOH.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Show Time',
    },

    // ---------- DOKPUB ----------
    {
      id: 'pertunjukan-dokpub-1',
      title: 'Pasang Kamera Statis di Angle Terbaik (Rekam Panggung Utuh)',
      description: 'Memasang kamera statis pada sudut (angle) terbaik yang mampu merekam seluruh panggung secara utuh tanpa mengganggu penonton.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Show Time',
    },
    {
      id: 'pertunjukan-dokpub-2',
      title: 'Foto Candid Reaksi & Ekspresi Penonton',
      description: 'Mengambil foto candid yang merekam reaksi dan ekspresi penonton saat menyaksikan pertunjukan.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Show Time',
    },

    // ---------- SUTRADARA ----------
    {
      id: 'pertunjukan-sut-1',
      title: 'Koordinasi Stage Manager — Durasi Tepat 30 Menit',
      description: 'Berkoordinasi ketat dengan Stage Manager agar durasi pertunjukan tepat 30 menit.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Show Time',
    },
    {
      id: 'pertunjukan-sut-2',
      title: 'Motivasi Akhir & Input Nilai Keaktoran',
      description: 'Memberikan motivasi akhir, memantau kestabilan emosi pemain, dan input nilai keaktoran di web.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Show Time',
    },

    // ---------- ASISTEN SUTRADARA ----------
    {
      id: 'pertunjukan-astrada-1',
      title: 'Alur Pemanggilan Pemain ke Wing via Floor Manager',
      description: 'Berkoordinasi dengan Floor Manager untuk alur pemanggilan pemain ke area wing panggung.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Show Time',
    },
    {
      id: 'pertunjukan-astrada-2',
      title: 'Pandu Pemanasan Vokal & Kontrol Urutan 30 Menit',
      description: 'Memandu pemanasan vokal singkat, kontrol urutan adegan sesuai 30 menit, siap gantikan Sutradara jika berhalangan.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Show Time',
    },

    // ---------- PEMAIN ----------
    {
      id: 'pertunjukan-pemain-1',
      title: 'Pemanasan Vokal & Fisik, Standby di Wing Tepat Waktu',
      description: 'Semua pemain WAJIB mengikuti pemanasan vokal dan fisik singkat di balik panggung, menjaga ketenangan di ruang tunggu, dan siap di area wing tepat waktu.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Show Time',
    },

    // ---------- DIVISI SPESIFIK ----------
    {
      id: 'pertunjukan-koor-busana-1',
      title: 'Tata Area Ganti & Dampingi Quick Change',
      description: 'Membagi area rak gantung, menata area ganti sesuai urutan adegan, dan mendampingi quick change pemain.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Show Time',
    },
    {
      id: 'pertunjukan-koor-rias-1',
      title: 'Eksekusi Tata Rias Sesuai Timeline & Touch-Up Cepat',
      description: 'Berbagi area cermin & listrik, eksekusi tata rias sesuai timeline, dan standby touch-up cepat di antara adegan.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Show Time',
    },
    {
      id: 'pertunjukan-koor-properti-1',
      title: 'Tata Prop Table & Transisi Properti Cepat',
      description: 'Membagi zona prop table, menata properti dalam 10 menit persiapan, dan eksekusi transisi properti cepat selama 30 menit.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Show Time',
    },
    {
      id: 'pertunjukan-koor-panggung-1',
      title: 'Pasang Set 10 Menit & Bongkar Set 5 Menit',
      description: 'Eksekusi pasang set dalam 10 menit dan pembongkaran cepat dalam 5 menit terakhir. Jaga sterilitas area samping.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Panggung § Show Time',
    },
    {
      id: 'pertunjukan-koor-musik-1',
      title: 'Check Sound 10 Menit & Musik Iringan Presisi',
      description: 'Berbagi channel mixer, check sound 10 menit persiapan awal, dan memainkan musik iringan presisi mengikuti alur adegan 30 menit.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Show Time',
    },
  ],

  // ============================================
  // TAHAP 4: PASCA-PRODUKSI
  // ============================================
  PASCA: [
    // ---------- PIMPINAN PRODUKSI ----------
    {
      id: 'pasca-pimpro-1',
      title: 'Kerja Bakti Sterilisasi & Pembersihan Lokasi',
      description: 'Memimpin kerja bakti sterilisasi dan pembersihan lokasi pertunjukan teater.',
      daysFromNow: 3,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pasca-Produksi',
    },
    {
      id: 'pasca-pimpro-2',
      title: 'Menyusun & Menyerahkan LPJ Produksi ke Guru',
      description: 'Menyusun dan menyerahkan dokumen Laporan Pertanggungjawaban (LPJ) produksi kepada Guru Pembimbing.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pasca-Produksi',
    },

    // ---------- SEKRETARIS ----------
    {
      id: 'pasca-sekre-1',
      title: 'Distribusi Sertifikat / Surat Apresiasi',
      description: 'Menyusun dan mendistribusikan sertifikat atau surat apresiasi kepada seluruh panitia dan pemain.',
      daysFromNow: 5,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pasca-Produksi',
    },
    {
      id: 'pasca-sekre-2',
      title: 'Merapikan & Mengarsipkan Dokumen Administrasi',
      description: 'Merapikan dan mengarsipkan seluruh dokumen administrasi pementasan.',
      daysFromNow: 7,
      priority: 'MEDIUM',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pasca-Produksi',
    },

    // ---------- BENDAHARA ----------
    {
      id: 'pasca-bend-1',
      title: 'Kumpulkan & Rekap Seluruh Bukti Nota Fisik Divisi',
      description: 'Mengumpulkan dan merekap seluruh bukti nota pembelian fisik dari setiap divisi.',
      daysFromNow: 5,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pasca-Produksi',
    },
    {
      id: 'pasca-bend-2',
      title: 'Tabel Perbandingan Anggaran (Estimasi vs Realisasi)',
      description: 'Menyusun tabel Perbandingan Anggaran yang menampilkan estimasi biaya awal dibandingkan dengan realisasi pengeluaran akhir.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pasca-Produksi',
    },

    // ---------- DOKPUB ----------
    {
      id: 'pasca-dokpub-1',
      title: 'Sunting Video Aftermovie Sinematik',
      description: 'Menyunting (editing) video kompilasi kegiatan pertunjukan (aftermovie).',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pasca-Produksi',
    },
    {
      id: 'pasca-dokpub-2',
      title: 'Arsipkan Foto & Video ke Penyimpanan Digital Sekolah',
      description: 'Mengarsipkan dan mengunggah seluruh berkas foto dan video pertunjukan ke penyimpanan digital sekolah.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pasca-Produksi',
    },

    // ---------- SUTRADARA ----------
    {
      id: 'pasca-sut-1',
      title: 'Analisis Perkembangan Keaktoran Individual via Web',
      description: 'Menyampaikan analisis perkembangan keaktoran harian secara individual via web dan mengonsolidasikan catatan akhir penyutradaraan.',
      daysFromNow: 5,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pasca-Produksi',
    },

    // ---------- ASISTEN SUTRADARA ----------
    {
      id: 'pasca-astrada-1',
      title: 'Konsolidasi Catatan Perkembangan Pemain ke Arsip Web',
      description: 'Mengonsolidasikan seluruh catatan perkembangan harian pemain dan mengunggahnya ke dalam arsip evaluasi web.',
      daysFromNow: 5,
      priority: 'MEDIUM',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pasca-Produksi',
    },

    // ---------- PEMAIN ----------
    {
      id: 'pasca-pemain-1',
      title: 'Bersihkan Rias, Rapikan Kostum & Refleksi Kritis',
      description: 'Membersihkan riasan wajah, merapikan kostum pribadi, dan mengisi lembar refleksi kritis keaktoran di platform web.',
      daysFromNow: 3,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pasca-Produksi',
    },

    // ---------- DIVISI SPESIFIK ----------
    {
      id: 'pasca-koor-busana-1',
      title: 'Cuci & Kembalikan Aset Kostum Pinjaman',
      description: 'Pembersihan, pencucian, dan pengembalian seluruh aset kostum pinjaman serta input data inventaris akhir ke sistem web.',
      daysFromNow: 5,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pasca-Produksi',
    },
    {
      id: 'pasca-koor-rias-1',
      title: 'Bersihkan Rias & Sterilkan Alat',
      description: 'Dampingi pembersihan riasan pemain dengan make-up remover, sterilkan kembali alat rias, dan unggah laporan kerja ke sistem web.',
      daysFromNow: 3,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pasca-Produksi',
    },
    {
      id: 'pasca-koor-properti-1',
      title: 'Kembalikan Inventaris & Update Status Barang di Web',
      description: 'Bersihkan area belakang panggung, kembalikan inventaris sekolah, dan perbarui status barang di sistem web.',
      daysFromNow: 3,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pasca-Produksi',
    },
    {
      id: 'pasca-koor-panggung-1',
      title: 'Bongkar Set & Kembalikan Panggung ke Kondisi Semula',
      description: 'Membongkar set dekorasi secara aman, mengembalikan kondisi panggung seperti semula, dan mengisi borang penilaian berjenjang di web.',
      daysFromNow: 3,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Panggung § Pasca-Produksi',
    },
    {
      id: 'pasca-koor-musik-1',
      title: 'Rapikan Instrumen & Laporan Evaluasi Teknis Suara',
      description: 'Rapikan, bersihkan, dan kembalikan seluruh instrumen musik ke tempat penyimpanan serta isi laporan evaluasi teknis suara di web.',
      daysFromNow: 5,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Pasca-Produksi',
    },
  ],
};

// =========================================================
// INFO TAHAP — untuk UI
// =========================================================
export const STAGE_INFO: Record<ProductionStage, {
  label: string;
  color: string;
  gradient: string;
  desc: string;
}> = {
  PERSIAPAN: {
    label: 'Tahap 1 — Pra-Produksi',
    color: 'amber',
    gradient: 'from-amber-600 to-amber-800',
    desc: 'Master Schedule, RAB, naskah, casting, desain konsep, poster utama',
  },
  PELAKSANAAN: {
    label: 'Tahap 2 — Pelaksanaan (3 Bulan)',
    color: 'blue',
    gradient: 'from-blue-600 to-blue-800',
    desc: 'Bulan 1-3: target fisik, latihan, BTS, fitting, produksi properti',
  },
  PERTUNJUKAN: {
    label: 'Tahap 3 — Show Time',
    color: 'purple',
    gradient: 'from-purple-600 to-purple-800',
    desc: 'Taklimat akhir, 10+30+5 menit, FOH, tas logistik darurat, aftermovie',
  },
  PASCA: {
    label: 'Tahap 4 — Pasca-Produksi',
    color: 'emerald',
    gradient: 'from-emerald-600 to-emerald-800',
    desc: 'Kerja bakti, LPJ, sertifikat, tabel perbandingan anggaran, arsip digital',
  },
};
