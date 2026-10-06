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
// TEMPLATE DEADLINE — BERDASARKAN DOKUMEN JOB DESC RESMI
// =========================================================
export const DEADLINE_TEMPLATES: Record<ProductionStage, DeadlineTemplate[]> = {

  // ============================================
  // TAHAP 1: PRA-PRODUKSI (PERSIAPAN)
  // ============================================
  PERSIAPAN: [
    // ---------- A. TIM PRODUKSI ----------
    // Pimpinan Produksi
    {
      id: 'persiapan-pimpro-1',
      title: 'Menyusun Jadwal Induk (Master Schedule) & Persetujuan Tertulis',
      description: 'Menyusun Jadwal Induk (Master Schedule) seluruh kegiatan produksi teater dan mengamankan persetujuan tertulis dari Guru Pembimbing.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pra-Produksi',
    },
    {
      id: 'persiapan-pimpro-2',
      title: 'Menetapkan Jadwal Larangan Aktivitas Fisik (Ujian & Libur)',
      description: 'Menetapkan jadwal larangan aktivitas fisik pada pekan ujian (PAS/SAS) dan libur semester ke dalam kalender kerja produksi.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pra-Produksi',
    },
    {
      id: 'persiapan-pimpro-3',
      title: 'Memvalidasi & Menandatangani RAB Bersama Bendahara',
      description: 'Memvalidasi dan menandatangani Rencana Anggaran Biaya (RAB) bersama Bendahara pada platform web.',
      daysFromNow: 10,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pra-Produksi',
    },

    // Sekretaris
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
      description: 'Memantau dan mendata jadwal ketidakhadiran anggota (jadwal les atau sakit) untuk dilaporkan berkala kepada Sutradara.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pra-Produksi',
    },

    // Bendahara
    {
      id: 'persiapan-bend-1',
      title: 'Menyusun RAB Divisi dengan Prioritas Bahan Daur Ulang',
      description: 'Menyusun RAB setiap divisi dengan memprioritaskan pemanfaatan bahan bekas atau daur ulang untuk efisiensi anggaran.',
      daysFromNow: 10,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pra-Produksi',
    },
    {
      id: 'persiapan-bend-2',
      title: 'Menyiapkan Buku Kas & Lembaran Kuitansi Kosong',
      description: 'Menyiapkan pencatatan buku kas produksi serta lembaran kuitansi kosong untuk transaksi keuangan.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pra-Produksi',
    },

    // Dokpub
    {
      id: 'persiapan-dokpub-1',
      title: 'Mendesain 1 Poster Utama Pementasan',
      description: 'Mendesain 1 Poster Utama pementasan teater yang komunikatif dan menarik sebagai identitas visual produksi.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pra-Produksi',
    },
    {
      id: 'persiapan-dokpub-2',
      title: 'Menyusun Timeline Publikasi',
      description: 'Menyusun Timeline Publikasi untuk jadwal rilis poster dan materi promosi di media sosial atau platform digital sekolah.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pra-Produksi',
    },

    // ---------- B. TIM ARTISTIK ----------
    // Sutradara
    {
      id: 'persiapan-sut-1',
      title: 'Menyusun Visi Penyutradaraan & Membedah Naskah',
      description: 'Menyusun dokumen Visi Penyutradaraan serta membedah alur cerita dan pesan naskah secara mendalam.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pra-Produksi',
    },
    {
      id: 'persiapan-sut-2',
      title: 'Menentukan Kriteria Karakter & Audisi (Casting)',
      description: 'Menentukan kriteria karakter dan memimpin proses audisi/pembacaan naskah awal (casting) untuk seluruh calon pemain.',
      daysFromNow: 10,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pra-Produksi',
    },
    {
      id: 'persiapan-sut-3',
      title: 'Membuat Scene Breakdown (Pemecahan Adegan)',
      description: 'Membuat Scene Breakdown (Pemecahan Adegan) untuk menyusun jadwal latihan aktor secara modular dan efisien.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pra-Produksi',
    },

    // Asisten Sutradara
    {
      id: 'persiapan-astrada-1',
      title: 'Menyusun Prompt Book (Isyarat Lampu, Musik, Kemunculan Aktor)',
      description: 'Menyusun dan memberi tanda khusus pada Prompt Book — buku naskah panduan utama berisi isyarat lampu, musik, dan kemunculan aktor.',
      daysFromNow: 8,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pra-Produksi',
    },
    {
      id: 'persiapan-astrada-2',
      title: 'Membantu Sutradara Menyusun Jadwal Latihan Harian',
      description: 'Membantu Sutradara menyusun jadwal latihan harian agar sinkron dengan jadwal les akademik anggota.',
      daysFromNow: 8,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pra-Produksi',
    },

    // Pemain
    {
      id: 'persiapan-pemain-1',
      title: 'Menulis Dokumen Analisis Karakter Tokoh',
      description: 'Menulis dokumen Analisis Karakter — mencatat latar belakang, sifat, usia, dan tujuan tokoh yang dimainkan di platform web.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pra-Produksi',
    },
    {
      id: 'persiapan-pemain-2',
      title: 'Membaca & Memahami Naskah Secara Mendalam',
      description: 'Membaca dan memahami naskah secara mendalam untuk mempelajari alur cerita, tema, dan pesan utama lakon.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pra-Produksi',
    },

    // Properti
    {
      id: 'persiapan-properti-1',
      title: 'Merancang Sketsa Denah Panggung (Layout Set)',
      description: 'Merancang sketsa Denah Panggung (Layout Set) yang menggambarkan posisi dekorasi, furnitur, dan latar panggung.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pra-Produksi',
    },
    {
      id: 'persiapan-properti-2',
      title: 'Mengumpulkan Bahan Baku Daur Ulang',
      description: 'Mengumpulkan bahan baku daur ulang/bekas seperti kardus, kertas mache, kayu, kain, atau bambu untuk pembuatan properti.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pra-Produksi',
    },

    // Tata Panggung
    {
      id: 'persiapan-panggung-1',
      title: 'Menyusun Sketsa Denah Panggung 2D per Adegan',
      description: 'Merancang sketsa denah panggung 2D per adegan dan mengunggahnya ke platform web sebagai panduan tata panggung.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Panggung § Pra-Produksi',
    },
    {
      id: 'persiapan-panggung-2',
      title: 'Menyusun Sistem Cross-Operator (Kru Cadangan)',
      description: 'Menyusun sistem Cross-Operator agar tugas panggung tetap berjalan jika ada anggota yang berhalangan.',
      daysFromNow: 10,
      priority: 'MEDIUM',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Panggung § Pra-Produksi',
    },
    {
      id: 'persiapan-panggung-3',
      title: 'Lighting Plot & Inventaris Peralatan Lampu',
      description: 'Menyusun lembar Lighting Plot untuk menentukan titik sorot panggung dan menginventarisasi peralatan lampu, kabel, dan saklar.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Pencahayaan § Pra-Produksi',
    },

    // Kostum
    {
      id: 'persiapan-busana-1',
      title: 'Menentukan Konsep Busana Sesuai Naskah',
      description: 'Menentukan konsep busana (harian, sejarah, tradisional, atau fantasi) sesuai tuntutan naskah dan visi artistik.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pra-Produksi',
    },
    {
      id: 'persiapan-busana-2',
      title: 'Mencatat Ukuran Badan, Lingkar Kepala & Sepatu Pemain',
      description: 'Melakukan pencatatan ukuran badan, lingkar kepala, dan ukuran sepatu seluruh pemain untuk keperluan pembuatan kostum.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pra-Produksi',
    },

    // Rias
    {
      id: 'persiapan-rias-1',
      title: 'Merancang Konsep Tata Rias (Korektif / Karakter / Fantasi)',
      description: 'Merancang konsep tata rias yang sesuai dengan tokoh dalam naskah — Rias Korektif, Rias Karakter, atau Rias Fantasi.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pra-Produksi',
    },
    {
      id: 'persiapan-rias-2',
      title: 'Mendata Perlengkapan Rias & Pastikan Higienis',
      description: 'Mendata perlengkapan rias dan memastikan spons serta kuas yang digunakan higienis untuk tiap aktor.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pra-Produksi',
    },

    // Musik
    {
      id: 'persiapan-musik-1',
      title: 'Membedah Naskah untuk Kebutuhan Musik',
      description: 'Membedah naskah untuk menentukan kebutuhan musik: Pembuka/Overture, Penutup, Pergantian Babak, Ilustrasi, Sound Track, Theme Song, Penokohan, Aksentuasi, Setting, atau Pelebur Emosi.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Pra-Produksi',
    },
    {
      id: 'persiapan-musik-2',
      title: 'Merancang Sound Cue Sheet & Mengunduh Berkas Audio',
      description: 'Merancang Sound Cue Sheet (daftar antrean lagu) dan mengunduh berkas audio yang dibutuhkan untuk pementasan.',
      daysFromNow: 10,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Pra-Produksi',
    },
  ],

  // ============================================
  // TAHAP 2: PELAKSANAAN (PROSES ~3 BULAN)
  // ============================================
  PELAKSANAAN: [
    // ---------- Pimpinan Produksi ----------
    {
      id: 'pelaksanaan-pimpro-b1',
      title: 'Bulan ke-1: Kontrol Administrasi Awal & Target Perencanaan',
      description: 'Mengontrol penyelesaian administrasi awal, pembagian naskah, dan ketercapaian target perencanaan tiap divisi.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-pimpro-b2',
      title: 'Bulan ke-2: Monitoring Target Fisik Mingguan Tiap Divisi',
      description: 'Melakukan monitoring berkala terhadap ketercapaian target fisik mingguan tiap divisi (pembuatan properti, modifikasi kostum, kelengkapan alat rias).',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-pimpro-b3',
      title: 'Bulan ke-3: Mengawasi Latihan Gabungan (Rehearsal)',
      description: 'Mengawasi pelaksanaan Latihan Gabungan yang melibatkan aktor, tim musik, tata cahaya, dan tata panggung agar berjalan lancar tanpa bentrok jadwal.',
      daysFromNow: 90,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pelaksanaan Bulan 3',
    },

    // ---------- Sekretaris ----------
    {
      id: 'pelaksanaan-sekre-b1',
      title: 'Bulan ke-1: Mengisi Buku Log Produksi',
      description: 'Mengatur dan mengisi Buku Log Produksi dengan mencatat kehadiran sesi latihan harian dan hasil rapat.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-sekre-b2',
      title: 'Bulan ke-2: Meneruskan Catatan Revisi Dialog dari Sutradara',
      description: 'Meneruskan catatan revisi dialog atau petunjuk khusus dari Sutradara kepada divisi Kostum, Musik, Rias, atau Properti.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-sekre-b3',
      title: 'Bulan ke-3: Koordinasi Cetak Nametag & Tiket Penonton',
      description: 'Berkoordinasi dengan divisi Publikasi dalam menyiapkan cetakan nametag panitia dan tiket penonton.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pelaksanaan Bulan 3',
    },

    // ---------- Bendahara ----------
    {
      id: 'pelaksanaan-bend-b1',
      title: 'Bulan ke-1: Membuka Pembukuan Kas & Alokasi Dana Divisi',
      description: 'Membuka pembukuan kas awal dan mengatur alokasi dana belanja bahan/perlengkapan tiap divisi.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-bend-b2',
      title: 'Bulan ke-2: Audit Arus Kas & Catat Bukti Nota Fisik',
      description: 'Melakukan audit berkala dan mencatat arus kas masuk-keluar berdasarkan bukti nota belanja fisik dari setiap divisi.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-bend-b3',
      title: 'Bulan ke-3: Membekukan Pengeluaran Dana Saat Pekan Ujian',
      description: 'Membekukan pengeluaran dana dan penagihan kas selama pekan ujian sekolah berlangsung.',
      daysFromNow: 90,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pelaksanaan Bulan 3',
    },

    // ---------- Dokpub ----------
    {
      id: 'pelaksanaan-dokpub-b1',
      title: 'Bulan 1-2: Ambil Foto & Video Behind The Scene',
      description: 'Mengambil foto dan rekaman video Behind The Scene (proses latihan dialog, pembuatan dekorasi, dan fitting kostum).',
      daysFromNow: 60,
      priority: 'MEDIUM',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pelaksanaan Bulan 1-2',
    },
    {
      id: 'pelaksanaan-dokpub-b2',
      title: 'Bulan 2-3: Publikasi Materi Promosi Berkala',
      description: 'Mempublikasikan materi promosi secara berkala pada media sosial atau platform digital sekolah.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pelaksanaan Bulan 2-3',
    },

    // ---------- Sutradara ----------
    {
      id: 'pelaksanaan-sut-b1',
      title: 'Bulan ke-1: Reading & Charactering (Pembacaan & Pemahaman Karakter)',
      description: 'Melatih pembacaan naskah bersama, pemahaman karakter (latar belakang, tujuan, emosi), dan penekanan frasa/intonasi vokal.',
      daysFromNow: 30,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-sut-b2',
      title: 'Bulan ke-2: Blocking & Acting',
      description: 'Melatih pola blocking panggung (simetri, asimetri, grup, pergerakan linier/vertikal) dan ekspresi emosi aktor.',
      daysFromNow: 60,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-sut-b3',
      title: 'Bulan ke-3: Rehearsal & Run-Through (Latihan Gabungan)',
      description: 'Memimpin Latihan Gabungan (Run-through) yang menggabungkan pergerakan aktor, iringan musik, pencahayaan, dan properti panggung.',
      daysFromNow: 90,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pelaksanaan Bulan 3',
    },

    // ---------- Asisten Sutradara ----------
    {
      id: 'pelaksanaan-astrada-1',
      title: 'Pimpin Pemanasan Fisik & Vokal 10 Menit Sebelum Latihan',
      description: 'Memimpin sesi pemanasan fisik dan vokal wajib selama 10 menit sebelum setiap latihan akting dimulai.',
      daysFromNow: 30,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pelaksanaan Bulan 1-3',
    },
    {
      id: 'pelaksanaan-astrada-2',
      title: 'Melatih Shadow Player (Pemeran Pengganti)',
      description: 'Melatih Shadow Player (pemeran pengganti) untuk mengantisipasi jika ada pemain utama yang berhalangan hadir.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pelaksanaan Bulan 1-3',
    },
    {
      id: 'pelaksanaan-astrada-3',
      title: 'Mencatat Perubahan Blocking/Revisi Dialog di Prompt Book',
      description: 'Mencatat setiap perubahan blocking atau revisi dialog dalam Prompt Book sebagai arsip produksi.',
      daysFromNow: 60,
      priority: 'MEDIUM',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pelaksanaan Bulan 2-3',
    },

    // ---------- Pemain ----------
    {
      id: 'pelaksanaan-pemain-b1',
      title: 'Bulan ke-1: Latihan Vokal, Penghayatan & Hafalan Dialog',
      description: 'Melatih vokal (intonasi, tekanan frasa, artikulasi), penghayatan dialog, dan menghafal seluruh dialog tanpa teks (lepas naskah).',
      daysFromNow: 30,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pelaksanaan Bulan 1',
    },
    {
      id: 'pelaksanaan-pemain-b2',
      title: 'Bulan ke-2: Latihan Gerakan, Ekspresi & Blocking',
      description: 'Melatih gerakan tubuh, ekspresi wajah, pola blocking panggung, serta merespons dialog lawan main secara natural.',
      daysFromNow: 60,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pelaksanaan Bulan 2',
    },
    {
      id: 'pelaksanaan-pemain-b3',
      title: 'Bulan ke-3: Dress Rehearsal (Gladi Bersih Penuh)',
      description: 'Mengikuti Dress Rehearsal — gladi bersih penuh dengan tata rias, kostum, iringan musik, dan lampu panggung.',
      daysFromNow: 90,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pelaksanaan Bulan 3',
    },

    // ---------- Properti ----------
    {
      id: 'pelaksanaan-properti-b1',
      title: 'Bulan 1-2: Ukur, Potong, Rakit & Cat Properti Panggung',
      description: 'Melakukan pengukuran, pemotongan, perakitan, dan pengecatan properti panggung sesuai sketsa desain.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pelaksanaan Bulan 1-2',
    },
    {
      id: 'pelaksanaan-properti-b2',
      title: 'Bulan 2-3: Spotting Lantai & Latihan Transisi Properti',
      description: 'Memasang lakban penanda posisi barang di lantai panggung (Spotting) dan melatih transisi memindahkan properti masuk-keluar panggung secara senyap dan cepat.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pelaksanaan Bulan 2-3',
    },

    // ---------- Tata Panggung & Lighting ----------
    {
      id: 'pelaksanaan-panggung-b1',
      title: 'Bulan 1-2: Pelajari Pengoperasian Saklar & Papan Kontrol Lampu',
      description: 'Mempelajari pengoperasian saklar dan papan kontrol lampu panggung untuk keperluan pementasan.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Pencahayaan § Pelaksanaan Bulan 1-2',
    },
    {
      id: 'pelaksanaan-panggung-b2',
      title: 'Bulan 2-3: Latih Warna & Intensitas Cahaya + Sinkron Aba-aba Astrada',
      description: 'Berlatih menyesuaikan warna dan intensitas cahaya (redup/terang) serta mencocokkan aba-aba dengan Astrada saat Latihan Gabungan.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Pencahayaan § Pelaksanaan Bulan 2-3',
    },

    // ---------- Kostum ----------
    {
      id: 'pelaksanaan-busana-b1',
      title: 'Bulan 1-2: Modifikasi atau Membuat Pakaian Panggung',
      description: 'Memodifikasi atau membuat pakaian panggung dari bahan yang tersedia sesuai konsep desain yang telah ditetapkan.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pelaksanaan Bulan 1-2',
    },
    {
      id: 'pelaksanaan-busana-b2',
      title: 'Bulan 2-3: Sesi Fitting (Uji Coba Pakaian Saat Latihan)',
      description: 'Melakukan sesi Fitting — uji coba pakaian saat pemain latihan berakting untuk memastikan gerak dan kenyamanan aktor tidak terganggu.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pelaksanaan Bulan 2-3',
    },

    // ---------- Rias ----------
    {
      id: 'pelaksanaan-rias-b1',
      title: 'Bulan 1-2: Latih Aplikasi Tata Rias Wajah Aktor',
      description: 'Berlatih mengaplikasikan tata rias wajah aktor dengan target waktu yang efisien sesuai jadwal urutan merias.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pelaksanaan Bulan 1-2',
    },
    {
      id: 'pelaksanaan-rias-b2',
      title: 'Bulan 2-3: Uji Ketahanan Riasan terhadap Keringat & Lampu',
      description: 'Melakukan uji coba ketahanan riasan terhadap keringat dan pencahayaan panggung untuk memastikan tampilan tetap prima.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pelaksanaan Bulan 2-3',
    },

    // ---------- Musik ----------
    {
      id: 'pelaksanaan-musik-b1',
      title: 'Bulan 1-2: Urutkan, Potong & Susun Berkas Audio ke Playlist',
      description: 'Mengurutkan, memotong, dan menyusun berkas audio ke dalam satu playlist pada perangkat pemutar untuk pementasan.',
      daysFromNow: 60,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Pelaksanaan Bulan 1-2',
    },
    {
      id: 'pelaksanaan-musik-b2',
      title: 'Bulan 2-3: Latihan Gabungan Ketepatan Waktu (Timing) Musik',
      description: 'Mengikuti Latihan Gabungan untuk melatih ketepatan waktu (timing) antara efek suara/musik dengan gerakan dan dialog aktor.',
      daysFromNow: 90,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Pelaksanaan Bulan 2-3',
    },
  ],

  // ============================================
  // TAHAP 3: SHOW TIME (PERTUNJUKAN UTAMA)
  // ============================================
  PERTUNJUKAN: [
    // ---------- Pimpinan Produksi ----------
    {
      id: 'pertunjukan-pimpro-1',
      title: 'Pimpin Taklimat Akhir 10 Menit Sebelum Pintu Dibuka',
      description: 'Memimpin Taklimat Akhir (Final Briefing) 10 menit sebelum pintu aula/panggung dibuka untuk penonton.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Show Time',
    },
    {
      id: 'pertunjukan-pimpro-2',
      title: 'Kontrol Waktu: 10 Menit Persiapan + 30 Menit Tampil + 5 Menit Bongkar',
      description: 'Bertindak sebagai kontroler waktu pementasan: mengawasi 10 menit persiapan awal panggung, 30 menit durasi pementasan, dan 5 menit pembongkaran agar tepat waktu.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Show Time',
    },

    // ---------- Sekretaris ----------
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
      description: 'Mencatat statistik riil jumlah penonton yang hadir di dalam ruangan pementasan.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Show Time',
    },

    // ---------- Bendahara ----------
    {
      id: 'pertunjukan-bend-1',
      title: 'Sediakan Tas Logistik Darurat di Belakang Panggung',
      description: 'Menyediakan Tas Logistik Darurat di belakang panggung yang berisi perlengkapan P3K dasar, peniti, selotip, dan air minum tambahan.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Show Time',
    },
    {
      id: 'pertunjukan-bend-2',
      title: 'Jaga & Catat Uang Kas dari Pengelolaan Tiket di FOH',
      description: 'Menjaga dan mencatat uang kas dari hasil pengelolaan tiket di area FOH (Front of House).',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Show Time',
    },

    // ---------- Dokpub ----------
    {
      id: 'pertunjukan-dokpub-1',
      title: 'Pasang Kamera Statis di Sudut (Angle) Terbaik',
      description: 'Memasang kamera statis di sudut (angle) terbaik yang mampu merekam seluruh panggung utuh tanpa mengganggu penonton.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Show Time',
    },
    {
      id: 'pertunjukan-dokpub-2',
      title: 'Ambil Foto Candid Reaksi & Ekspresi Penonton',
      description: 'Mengambil foto candid reaksi dan ekspresi penonton saat menyaksikan pertunjukan.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Show Time',
    },

    // ---------- Sutradara ----------
    {
      id: 'pertunjukan-sut-1',
      title: 'Arahan & Motivasi Emosional Terakhir di Ruang Ganti',
      description: 'Memberikan arahan dan motivasi emosional terakhir kepada seluruh pemain di ruang ganti sebelum pementasan dimulai.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Show Time',
    },
    {
      id: 'pertunjukan-sut-2',
      title: 'Amati & Nilai Jalannya Pementasan dari Bangku Kontrol',
      description: 'Mengamati dan menilai keseluruhan jalannya pementasan dari bangku kontrol penonton untuk keperluan evaluasi.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Show Time',
    },

    // ---------- Asisten Sutradara ----------
    {
      id: 'pertunjukan-astrada-1',
      title: 'Siaga di Sayap Panggung (Wing) untuk Atur Alur Pemain',
      description: 'Berdiri siaga di Sayap Panggung (Wing) untuk mengatur alur keluar-masuk pemain selama pementasan.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Show Time',
    },
    {
      id: 'pertunjukan-astrada-2',
      title: 'Beri Aba-aba (Cueing) ke Aktor, Operator Musik & Lampu',
      description: 'Memberi aba-aba (cueing) kepada aktor serta operator musik dan lampu sesuai catatan Prompt Book.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Show Time',
    },

    // ---------- Pemain ----------
    {
      id: 'pertunjukan-pemain-1',
      title: 'Pemanasan Vokal & Peregangan Fisik Mandiri di Belakang Panggung',
      description: 'Melakukan pemanasan vokal dan peregangan fisik secara mandiri di belakang panggung sebelum tampil.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Show Time',
    },
    {
      id: 'pertunjukan-pemain-2',
      title: 'Hidupkan Karakter & Jaga Kestabilan Emosi Selama 30 Menit',
      description: 'Menghidupkan karakter secara utuh serta menjaga kestabilan emosi selama durasi pementasan (30 menit).',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Show Time',
    },

    // ---------- Properti ----------
    {
      id: 'pertunjukan-properti-1',
      title: 'Tata Set Panggung Lengkap dalam 10 Menit Persiapan',
      description: 'Menata set panggung lengkap dalam alokasi waktu 10 menit persiapan sebelum pertunjukan dimulai.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Show Time',
    },
    {
      id: 'pertunjukan-properti-2',
      title: 'Pindah Properti Antar-Adegan Senyap & Cepat',
      description: 'Memindahkan properti antar-adegan di dalam ruang panggung dengan tenang dan tanpa suara.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Show Time',
    },

    // ---------- Tata Panggung & Lighting ----------
    {
      id: 'pertunjukan-panggung-1',
      title: 'Eksekusi Perubahan Pencahayaan Tepat Waktu Sesuai Prompt Book',
      description: 'Mengeksekusi perubahan pencahayaan secara halus dan tepat waktu sesuai instruksi Prompt Book dari Astrada.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Pencahayaan § Show Time',
    },
    {
      id: 'pertunjukan-panggung-2',
      title: 'Pastikan Sorotan Lampu Selalu Fokus pada Area Aktif Aktor',
      description: 'Memastikan sorotan lampu selalu fokus pada area aktif aktor di panggung sepanjang pementasan.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Pencahayaan § Show Time',
    },

    // ---------- Kostum ----------
    {
      id: 'pertunjukan-busana-1',
      title: 'Tata Susunan Kostum di Ruang Ganti Sesuai Urutan Adegan',
      description: 'Menata susunan kostum di ruang ganti sesuai urutan kemunculan adegan untuk memudahkan quick change.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Show Time',
    },
    {
      id: 'pertunjukan-busana-2',
      title: 'Siaga di Belakang Panggung Bantu Quick Change Aktor',
      description: 'Bersiaga di belakang panggung untuk membantu penggantian baju kilat (Quick Change) pada aktor.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Show Time',
    },

    // ---------- Rias ----------
    {
      id: 'pertunjukan-rias-1',
      title: 'Selesaikan Tata Rias Seluruh Pemain Sebelum Pementasan',
      description: 'Menyelesaikan tata rias seluruh pemain sebelum pementasan dimulai sesuai timeline yang telah ditetapkan.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Show Time',
    },
    {
      id: 'pertunjukan-rias-2',
      title: 'Siaga di Wing Panggung untuk Touch-Up Kilat',
      description: 'Bersiaga di wing panggung membawa bedak dan tisu untuk perbaikan riasan kilat (touch-up) di antara adegan.',
      daysFromNow: 1,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Show Time',
    },

    // ---------- Musik ----------
    {
      id: 'pertunjukan-musik-1',
      title: 'Play/Pause Musik & Efek Suara Presisi Mengikuti Dinamika Panggung',
      description: 'Memutar dan mematikan (play/pause) musik atau efek suara secara presisi mengikuti dinamika di panggung.',
      daysFromNow: 1,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Musik & Suara',
      reference: 'Job Desc Musik § Show Time',
    },
  ],

  // ============================================
  // TAHAP 4: PASCA-PRODUKSI (EVALUASI & LAPORAN)
  // ============================================
  PASCA: [
    // ---------- Pimpinan Produksi ----------
    {
      id: 'pasca-pimpro-1',
      title: 'Pimpin Kerja Bakti Sterilisasi & Pembersihan Lokasi',
      description: 'Memimpin kerja bakti sterilisasi dan pembersihan lokasi pertunjukan teater bersama seluruh tim.',
      daysFromNow: 3,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pasca-Produksi',
    },
    {
      id: 'pasca-pimpro-2',
      title: 'Menyusun & Menyerahkan LPJ Produksi ke Guru Pembimbing',
      description: 'Menyusun dan menyerahkan dokumen Laporan Pertanggungjawaban (LPJ) produksi kepada Guru Pembimbing.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Pimpinan Produksi',
      reference: 'Job Desc Pimpro § Pasca-Produksi',
    },

    // ---------- Sekretaris ----------
    {
      id: 'pasca-sekre-1',
      title: 'Susun & Distribusikan Sertifikat / Surat Apresiasi',
      description: 'Menyusun dan mendistribusikan sertifikat atau surat apresiasi kepada seluruh panitia dan pemain.',
      daysFromNow: 5,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pasca-Produksi',
    },
    {
      id: 'pasca-sekre-2',
      title: 'Rapikan & Arsipkan Seluruh Dokumen Administrasi Pementasan',
      description: 'Merapikan dan mengarsipkan seluruh dokumen administrasi pementasan ke repositori arsip digital.',
      daysFromNow: 7,
      priority: 'MEDIUM',
      targetType: 'PERAN',
      targetRole: 'Sekretaris',
      reference: 'Job Desc Sekretaris § Pasca-Produksi',
    },

    // ---------- Bendahara ----------
    {
      id: 'pasca-bend-1',
      title: 'Kumpulkan & Rekap Seluruh Bukti Nota Pembelian Fisik',
      description: 'Mengumpulkan dan merekap seluruh bukti nota pembelian fisik dari setiap divisi untuk pelaporan keuangan.',
      daysFromNow: 5,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pasca-Produksi',
    },
    {
      id: 'pasca-bend-2',
      title: 'Susun Tabel Perbandingan Anggaran (Estimasi vs Realisasi)',
      description: 'Menyusun tabel Perbandingan Anggaran yang menampilkan estimasi biaya awal dibandingkan dengan realisasi pengeluaran akhir.',
      daysFromNow: 7,
      priority: 'CRITICAL',
      targetType: 'PERAN',
      targetRole: 'Bendahara',
      reference: 'Job Desc Bendahara § Pasca-Produksi',
    },

    // ---------- Dokpub ----------
    {
      id: 'pasca-dokpub-1',
      title: 'Sunting Video Aftermovie Kompilasi Pertunjukan',
      description: 'Menyunting (editing) video kompilasi kegiatan pertunjukan (Aftermovie) sebagai dokumentasi sinematik.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pasca-Produksi',
    },
    {
      id: 'pasca-dokpub-2',
      title: 'Arsipkan & Unggah Foto/Video ke Penyimpanan Digital Sekolah',
      description: 'Mengarsipkan dan mengunggah seluruh berkas foto dan video pertunjukan ke penyimpanan digital sekolah.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Publikasi & Dokumentasi',
      reference: 'Job Desc Dokpub § Pasca-Produksi',
    },

    // ---------- Sutradara ----------
    {
      id: 'pasca-sut-1',
      title: 'Susun Catatan Evaluasi Kinerja Artistik Setiap Aktor',
      description: 'Menyusun catatan evaluasi kinerja artistik (pujian dan masukan membangun) untuk setiap aktor sebagai feedback pribadi.',
      daysFromNow: 5,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Sutradara',
      reference: 'Job Desc Sutradara § Pasca-Produksi',
    },

    // ---------- Asisten Sutradara ----------
    {
      id: 'pasca-astrada-1',
      title: 'Rapikan Dokumen Prompt Book Asli untuk Arsip Produksi',
      description: 'Merapikan dokumen Prompt Book asli untuk disimpan sebagai arsip produksi teater sekolah.',
      daysFromNow: 5,
      priority: 'MEDIUM',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pasca-Produksi',
    },
    {
      id: 'pasca-astrada-2',
      title: 'Catat Poin Hasil Evaluasi Pementasan dari Sutradara',
      description: 'Mencatat poin-poin hasil evaluasi pementasan yang disampaikan Sutradara untuk keperluan pembelajaran.',
      daysFromNow: 5,
      priority: 'MEDIUM',
      targetType: 'PERAN',
      targetRole: 'Asisten Sutradara',
      reference: 'Job Desc Astrada § Pasca-Produksi',
    },

    // ---------- Pemain ----------
    {
      id: 'pasca-pemain-1',
      title: 'Bersihkan Tata Rias Wajah Sendiri dengan Pembersih Rias',
      description: 'Membersihkan tata rias wajah sendiri menggunakan pembersih rias (make-up remover) setelah pementasan selesai.',
      daysFromNow: 3,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pasca-Produksi',
    },
    {
      id: 'pasca-pemain-2',
      title: 'Lipat & Rapikan Kostum Pribadi Sebelum Diserahkan',
      description: 'Melipat dan merapikan kostum pribadi sebelum diserahkan kembali kepada tim Busana dalam kondisi bersih.',
      daysFromNow: 3,
      priority: 'HIGH',
      targetType: 'PERAN',
      targetRole: 'Pemain',
      reference: 'Job Desc Pemain § Pasca-Produksi',
    },

    // ---------- Properti ----------
    {
      id: 'pasca-properti-1',
      title: 'Bongkar Dekorasi & Cabut Seluruh Lakban Penanda Lantai',
      description: 'Membongkar dekorasi panggung dan mencabut seluruh lakban penanda (spotting) di lantai panggung.',
      daysFromNow: 3,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pasca-Produksi',
    },
    {
      id: 'pasca-properti-2',
      title: 'Angkut Barang & Bersihkan Area Panggung dari Sampah Produksi',
      description: 'Mengangkut barang dan membersihkan area panggung dari sisa sampah produksi hingga kembali ke kondisi semula.',
      daysFromNow: 3,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Perlengkapan',
      reference: 'Job Desc Properti § Pasca-Produksi',
    },

    // ---------- Tata Panggung & Lighting ----------
    {
      id: 'pasca-panggung-1',
      title: 'Matikan Seluruh Saklar Pencahayaan & Rapikan Kabel',
      description: 'Memastikan seluruh saklar pencahayaan dikembalikan ke posisi mati dan merapikan kembali kabel serta papan kontrol.',
      daysFromNow: 3,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Pencahayaan § Pasca-Produksi',
    },
    {
      id: 'pasca-panggung-2',
      title: 'Bongkar Set & Kembalikan Panggung ke Kondisi Semula',
      description: 'Membongkar set panggung dan mengembalikan area panggung ke kondisi semula sesuai standar kerapian sekolah.',
      daysFromNow: 3,
      priority: 'CRITICAL',
      targetType: 'DIVISI',
      targetDivision: 'Tata Panggung',
      reference: 'Job Desc Panggung § Pasca-Produksi',
    },

    // ---------- Kostum ----------
    {
      id: 'pasca-busana-1',
      title: 'Cuci, Setrika & Rapikan Seluruh Kostum Pertunjukan',
      description: 'Mencuci, menyetrika, dan merapikan seluruh kostum pertunjukan agar siap dikembalikan dalam kondisi utuh dan bersih.',
      daysFromNow: 5,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pasca-Produksi',
    },
    {
      id: 'pasca-busana-2',
      title: 'Kembalikan Semua Pakaian & Aksesori Pertunjukan',
      description: 'Mengembalikan semua pakaian dan aksesori pertunjukan dalam kondisi utuh dan bersih kepada pemilik/pihak sekolah.',
      daysFromNow: 7,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Busana',
      reference: 'Job Desc Kostum § Pasca-Produksi',
    },

    // ---------- Rias ----------
    {
      id: 'pasca-rias-1',
      title: 'Sediakan Pembersih Wajah & Awasi Pembersihan Riasan Aktor',
      description: 'Menyediakan pembersih wajah (make-up remover) dan mengawasi pembersihan riasan aktor pasca pementasan.',
      daysFromNow: 3,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pasca-Produksi',
    },
    {
      id: 'pasca-rias-2',
      title: 'Cuci Steril Seluruh Kuas & Spons Rias',
      description: 'Mencuci steril seluruh kuas dan spons rias yang telah digunakan agar tetap higienis untuk produksi berikutnya.',
      daysFromNow: 3,
      priority: 'HIGH',
      targetType: 'DIVISI',
      targetDivision: 'Tata Rias',
      reference: 'Job Desc Rias § Pasca-Produksi',
    },

    // ---------- Musik ----------
    {
      id: 'pasca-musik-1',
      title: 'Amankan Berkas Audio Pementasan & Rapikan Perangkat Audio',
      description: 'Mengamankan berkas audio pementasan dan merapikan kembali perangkat audio yang digunakan ke tempat penyimpanan.',
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
    desc: 'Master Schedule, RAB, casting, poster, prompt book, desain konsep',
  },
  PELAKSANAAN: {
    label: 'Tahap 2 — Pelaksanaan (3 Bulan)',
    color: 'blue',
    gradient: 'from-blue-600 to-blue-800',
    desc: 'Bulan 1: Reading, Bulan 2: Blocking, Bulan 3: Rehearsal + produksi fisik',
  },
  PERTUNJUKAN: {
    label: 'Tahap 3 — Show Time',
    color: 'purple',
    gradient: 'from-purple-600 to-purple-800',
    desc: '10 menit persiapan + 30 menit tampil + 5 menit bongkar — presisi!',
  },
  PASCA: {
    label: 'Tahap 4 — Pasca-Produksi',
    color: 'emerald',
    gradient: 'from-emerald-600 to-emerald-800',
    desc: 'Bongkar set, LPJ, sertifikat, aftermovie, tabel perbandingan anggaran',
  },
};
