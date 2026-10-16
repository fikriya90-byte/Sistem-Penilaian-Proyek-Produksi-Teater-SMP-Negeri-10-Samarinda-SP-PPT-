// =====================================================
// FORM DEFINITIONS — bahasa sederhana untuk siswa
// Field yang datanya sudah ada di sistem dihilangkan dari form
// =====================================================

export type FieldType = 'text' | 'textarea' | 'date' | 'time' | 'number' | 'select' | 'list';

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  rows?: number;
}

export interface FormSection {
  title?: string;
  fields: FormField[];
}

export function parseList(value: any): string[] {
  if (!value) return [];
  return String(value).split('\n').map(l => l.trim()).filter(Boolean);
}

export function parseTable(value: any, colCount: number): string[][] {
  if (!value) return [];
  return String(value)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const cols = line.split('|').map(c => c.trim());
      while (cols.length < colCount) cols.push('');
      return cols.slice(0, colCount);
    });
}

export const TEMPLATE_FORMS: Record<string, FormSection[]> = {

  // ═══════════════════════════════════════════════════
  // 1. PROPOSAL
  // ═══════════════════════════════════════════════════
  proposal: [
    {
      title: 'Data Utama Pementasan',
      fields: [
        {
          key: 'judulPementasan',
          label: 'Judul Pementasan',
          type: 'text',
          required: true,
          placeholder: 'Contoh: Mamanda — Petualangan Anak Samarinda',
          help: 'Judul yang akan ditampilkan di poster dan panggung.',
        },
        {
          key: 'jenisTeaterTradisional',
          label: 'Jenis Teater Tradisional',
          type: 'text',
          required: true,
          placeholder: 'Contoh: Mamanda, Ketoprak, Lenong, atau Ludruk',
          help: 'Pilih salah satu jenis teater daerah yang akan dipentaskan.',
        },
        {
          key: 'namaWaliKelas',
          label: 'Nama Wali Kelas',
          type: 'text',
          placeholder: 'Contoh: Ibu Siti Aminah, S.Pd.',
          help: 'Akan muncul di lembar tanda tangan pengesahan.',
        },
        {
          key: 'namaKepalaSekolah',
          label: 'Nama Kepala Sekolah',
          type: 'text',
          placeholder: 'Contoh: Bapak Drs. Ahmad Yusuf, M.Pd.',
        },
        {
          key: 'tanggalPengesahan',
          label: 'Tanggal Pengesahan',
          type: 'text',
          placeholder: 'Contoh: 15 Agustus 2026',
        },
      ],
    },
    {
      title: 'Alasan dan Tujuan Pementasan',
      fields: [
        {
          key: 'latarBelakang',
          label: 'Mengapa Pementasan Ini Penting?',
          type: 'textarea',
          required: true,
          rows: 6,
          placeholder: 'Contoh: Kami memilih pementasan ini karena ingin memperkenalkan cerita rakyat Kalimantan Timur kepada teman-teman, sekaligus belajar bekerja sama dalam tim produksi. Selain itu, kegiatan ini menjadi sarana kami untuk melatih keberanian tampil di depan orang banyak.',
          help: 'Jelaskan dengan bahasa sendiri, tidak perlu formal. Cukup 3-5 kalimat.',
        },
        {
          key: 'tujuan',
          label: 'Apa yang Ingin Dicapai? (satu per baris)',
          type: 'list',
          required: true,
          rows: 5,
          placeholder: 'Mengasah kemampuan akting dan menghafal naskah\nMemperkenalkan cerita rakyat daerah kepada penonton\nMelatih kerja sama dan disiplin dalam tim\nMenumbuhkan keberanian tampil di depan umum\nBelajar mengatur waktu antara latihan dan pelajaran',
          help: 'Tuliskan minimal 3 tujuan. Setiap baris = 1 tujuan.',
        },
        {
          key: 'manfaat',
          label: 'Apa Manfaatnya?',
          type: 'textarea',
          required: true,
          rows: 5,
          placeholder: 'Untuk siswa: melatih keberanian, disiplin, dan kerja sama.\nUntuk sekolah: menambah kegiatan seni dan budaya.\nUntuk budaya daerah: ikut melestarikan cerita rakyat Kalimantan Timur.',
          help: 'Bisa ditulis dari sisi siswa, sekolah, dan pelestarian budaya.',
        },
      ],
    },
    {
      title: 'Gambaran Pementasan (Bisa Dikosongkan Jika Sutradara Sudah Isi di Menu Produksi)',
      fields: [
        {
          key: 'gambaranPementasan',
          label: 'Pementasan Ini Akan Seperti Apa?',
          type: 'textarea',
          rows: 5,
          placeholder: 'Contoh: Pementasan akan berlangsung selama 30 menit dengan gaya tradisional Mamanda. Panggung dihias dengan latar rumah adat Kalimantan. Musik pengiring menggunakan sape, gendang, dan gamelan sederhana. Kostum pemain menggunakan baju adat daerah dengan warna cerah.',
          help: 'Ceritakan pementasan yang kalian bayangkan. Kalau Sutradara sudah isi Visi di menu Produksi, biarkan kosong — akan diambil otomatis.',
        },
        {
          key: 'alurCerita',
          label: 'Alur Cerita Singkat (Opsional)',
          type: 'textarea',
          rows: 4,
          placeholder: 'Contoh:\nAwal: Seorang pemuda diperkenalkan di desanya.\nKonflik: Ia gagal melewati ujian dari tetua adat.\nPuncak: Ia harus memilih antara menyerah atau mencoba lagi.\nAkhir: Ia belajar dari kesalahannya dan berhasil.',
          help: 'Boleh dikosongkan. Cukup garis besar ceritanya saja.',
        },
        {
          key: 'konsepSederhana',
          label: 'Pilih Gaya Pementasan (akan mengisi bagian artistik otomatis)',
          type: 'select',
          options: [
            { value: 'sederhana', label: 'Sederhana — Properti minimalis, fokus akting' },
            { value: 'sedang', label: 'Sedang — Properti lengkap, musik pengiring' },
            { value: 'meriah', label: 'Meriah — Tata panggung megah, banyak properti' },
          ],
          help: 'Setelah dipilih, sistem akan mengisi bagian Konsep Artistik secara otomatis. Bisa diubah nanti di dokumen Word.',
        },
        {
          key: 'kataPengantar',
          label: 'Kata Pengantar',
          type: 'textarea',
          rows: 4,
          placeholder: 'Contoh: Puji syukur kami panjatkan kepada Tuhan Yang Maha Esa. Proposal ini kami susun sebagai rancangan pementasan teater kelas IX SMP Negeri 10 Samarinda. Kami mengucapkan terima kasih kepada guru pembimbing, wali kelas, dan semua pihak yang telah mendukung.',
        },
      ],
    },
    {
      title: 'Catatan Tambahan',
      fields: [
        {
          key: 'catatanPementasan',
          label: 'Informasi Pementasan (Opsional)',
          type: 'textarea',
          rows: 3,
          placeholder: 'Contoh: Pementasan akan dilaksanakan di Aula SMP Negeri 10 Samarinda pada hari Sabtu, 20 November 2026, pukul 09.00 WITA. Sasaran penonton: siswa, guru, dan orang tua.',
          help: 'Lokasi, tanggal, dan jam pementasan bisa diambil dari menu Jadwal jika sudah diisi di sana.',
        },
        {
          key: 'rabUploadUrl',
          label: 'Link RAB Final yang Sudah Ditandatangani (Opsional)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'RAB detail akan muncul OTOMATIS dari menu RAB Digital. Isi field ini hanya jika ingin melampirkan file RAB yang sudah dicetak dan ditandatangani Pimpinan Produksi & Bendahara.',
        },
        {
          key: 'rabUploadName',
          label: 'Nama File RAB',
          type: 'text',
          placeholder: 'RAB_Final_IX-C.pdf',
        },
      ],
    },
    {
      title: 'Penutup',
      fields: [
        {
          key: 'penutup',
          label: 'Kalimat Penutup',
          type: 'textarea',
          required: true,
          rows: 3,
          placeholder: 'Demikian proposal ini kami susun. Kami berharap pementasan ini dapat berjalan lancar dan memberikan pengalaman berharga bagi semua siswa.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 2. SURAT IZIN
  // ═══════════════════════════════════════════════════
  'surat-izin': [
    {
      fields: [
        {
          key: 'nomorSurat',
          label: 'Nomor Surat',
          type: 'text',
          required: true,
          placeholder: '001/SP-PPT/SMPN10-SMR/2025',
        },
        {
          key: 'namaKegiatan',
          label: 'Nama Kegiatan',
          type: 'text',
          required: true,
          placeholder: 'Gladi Resik & Pementasan Teater',
        },
        {
          key: 'hariTanggal',
          label: 'Hari / Tanggal',
          type: 'text',
          required: true,
          placeholder: 'Sabtu, 20 November 2026',
        },
        { key: 'waktuMulai', label: 'Jam Mulai', type: 'time', required: true },
        { key: 'waktuSelesai', label: 'Jam Selesai', type: 'time', required: true },
        {
          key: 'tempat',
          label: 'Tempat Kegiatan',
          type: 'text',
          required: true,
          placeholder: 'Aula SMP Negeri 10 Samarinda',
        },
        {
          key: 'penanggungJawab',
          label: 'Penanggung Jawab',
          type: 'text',
          required: true,
          placeholder: 'Nama Pimpinan Produksi',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 3. SURAT PERMOHONAN
  // ═══════════════════════════════════════════════════
  'surat-permohonan': [
    {
      fields: [
        {
          key: 'nomorSurat',
          label: 'Nomor Surat',
          type: 'text',
          required: true,
          placeholder: '002/SP-PPT/SMPN10-SMR/2025',
        },
        {
          key: 'namaInstansi',
          label: 'Nama Instansi / Donatur',
          type: 'text',
          required: true,
          placeholder: 'PT Kaltim Kreatif',
        },
        {
          key: 'alamatInstansi',
          label: 'Kota Tujuan',
          type: 'text',
          required: true,
          placeholder: 'Samarinda',
        },
        {
          key: 'jenisBantuan',
          label: 'Daftar Bantuan (format: Jenis | Jumlah | Keterangan)',
          type: 'list',
          required: true,
          rows: 5,
          placeholder: 'Dana Tunai | Rp 500.000 | Untuk properti\nBahan Kostum | 5 meter | Kain satin putih\nKonsumsi | 20 box | Snack latihan',
          help: 'Satu baris = satu bantuan. Pisahkan dengan " | ".',
        },
        {
          key: 'narasiTambahan',
          label: 'Narasi Tambahan (opsional)',
          type: 'textarea',
          rows: 3,
          placeholder: 'Kalimat pengantar khusus untuk donatur...',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 4. LPJ
  // ═══════════════════════════════════════════════════
  lpj: [
    {
      title: 'Data Utama LPJ',
      fields: [
        {
          key: 'judulPementasan',
          label: 'Judul Pementasan',
          type: 'text',
          required: true,
          placeholder: 'Contoh: Mamanda — Petualangan Anak Samarinda',
          help: 'Kosongkan jika ingin pakai judul dari data Produksi.',
        },
        {
          key: 'jenisTeaterTradisional',
          label: 'Jenis Teater Tradisional',
          type: 'text',
          required: true,
          placeholder: 'Mamanda / Ketoprak / Lenong / dll.',
        },
        {
          key: 'namaWaliKelas',
          label: 'Nama Wali Kelas',
          type: 'text',
          placeholder: 'Akan muncul di lembar tanda tangan pengesahan.',
        },
        {
          key: 'namaKepalaSekolah',
          label: 'Nama Kepala Sekolah',
          type: 'text',
        },
        {
          key: 'tanggalPengesahan',
          label: 'Tanggal Pengesahan',
          type: 'text',
        },
      ],
    },
    {
      title: 'Bagian Pembuka',
      fields: [
        {
          key: 'kataPengantar',
          label: 'Kata Pengantar',
          type: 'textarea',
          rows: 4,
          placeholder: 'Contoh: Puji syukur kami panjatkan. Laporan ini kami susun sebagai bentuk pertanggungjawaban atas pementasan teater yang telah dilaksanakan...',
        },
        {
          key: 'latarBelakang',
          label: 'Mengapa LPJ Ini Dibuat?',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Pementasan sudah selesai dilaksanakan. LPJ ini dibuat untuk melaporkan seluruh kegiatan, penggunaan dana, dan hasil evaluasi agar dapat dipertanggungjawabkan kepada sekolah dan guru pembimbing.',
          help: 'Cukup 2-3 kalimat dengan bahasa sendiri.',
        },
      ],
    },
    {
      title: 'Hasil Pementasan',
      fields: [
        {
          key: 'jumlahPenonton',
          label: 'Jumlah Penonton',
          type: 'number',
          placeholder: 'Contoh: 150',
        },
        {
          key: 'hasilPementasan',
          label: 'Bagaimana Pementasan Berjalan?',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Pementasan berjalan lancar meskipun ada sedikit kendala teknis. Penonton yang hadir sekitar 150 orang, terdiri dari siswa, guru, dan orang tua. Banyak penonton yang memberikan respons positif dan tepuk tangan meriah di akhir pertunjukan.',
          help: 'Ceritakan suasana pementasan dan tanggapan penonton dengan bahasa sendiri.',
        },
        {
          key: 'kendalaSolusi',
          label: 'Kendala yang Dihadapi dan Cara Mengatasinya',
          type: 'list',
          required: true,
          rows: 4,
          placeholder: 'Waktu latihan terbatas | Menambah latihan di hari Sabtu\nSound system error saat gladi | Tim musik langsung memperbaiki\nKostum pemain utama belum selesai | Lembur 2 hari sebelum pementasan',
          help: 'Format: Kendala | Solusi. Satu baris = satu pasang kendala & solusi.',
        },
      ],
    },
    {
      title: 'Keuangan (Semua Data Otomatis dari Sistem)',
      fields: [
        {
          key: 'rabUploadUrl',
          label: 'Link RAB Final yang Sudah Ditandatangani (Opsional)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'Daftar hadir, bukti pengeluaran, inventaris, notula rapat, dan dokumentasi diambil OTOMATIS dari sistem. Field ini hanya untuk melampirkan file RAB final bertanda tangan.',
        },
        {
          key: 'rabUploadName',
          label: 'Nama File RAB',
          type: 'text',
          placeholder: 'RAB_Final_IX-C.pdf',
        },
        {
          key: 'realisasiPengeluaran',
          label: 'Realisasi Pengeluaran (Opsional — biarkan kosong jika tidak ada perubahan)',
          type: 'list',
          rows: 8,
          placeholder: 'Kostum | 1000000 | 1100000\nRias | 200000 | 180000\nPanggung | 500000 | 450000',
          help: 'Kosongkan untuk pakai data RAB Digital otomatis. Isi hanya jika realisasi berbeda dari rencana. Format: Kategori | Rencana | Realisasi.',
        },
      ],
    },
    {
      title: 'Evaluasi & Pembelajaran',
      fields: [
        {
          key: 'evaluasiKetercapaian',
          label: 'Apa yang Sudah Berhasil?',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Sebagian besar tujuan berhasil dicapai. Siswa mampu tampil dengan percaya diri, bekerja sama dengan baik, dan menghafal naskah dengan lancar. Kerja sama antar divisi juga berjalan solid.',
          help: 'Ceritakan pencapaian dari segi akting, kerja sama, kedisiplinan, dan apresiasi budaya.',
        },
        {
          key: 'refleksiTim',
          label: 'Apa Pelajaran yang Didapat?',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Kami belajar bahwa pementasan bukan hanya soal akting di panggung, tetapi juga kerja sama tim, disiplin waktu, dan tanggung jawab. Kami juga belajar menghargai setiap peran dalam kepanitiaan.',
          help: 'Refleksi pengalaman dan pembelajaran siswa selama proses produksi.',
        },
        {
          key: 'rekomendasi',
          label: 'Saran untuk Kegiatan Berikutnya',
          type: 'textarea',
          rows: 3,
          placeholder: 'Contoh: Perlu latihan lebih awal, pembagian tugas yang lebih jelas, dan persiapan properti lebih matang agar tidak terburu-buru di akhir.',
        },
      ],
    },
    {
      title: 'Penutup',
      fields: [
        {
          key: 'penutup',
          label: 'Kalimat Penutup',
          type: 'textarea',
          required: true,
          rows: 3,
          placeholder: 'Demikian LPJ ini kami susun. Terima kasih kepada semua pihak yang telah mendukung kegiatan pementasan teater kelas IX.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 5. SKETSA PANGGUNG
  // ═══════════════════════════════════════════════════
  'sketsa-panggung': [
    {
      fields: [
        {
          key: 'konsep',
          label: 'Konsep Tata Panggung',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Panggung bergaya rumah adat Kalimantan dengan latar belakang kayu dan kain warna cerah. Menggunakan properti sederhana dari bahan daur ulang.',
        },
        {
          key: 'denahZona',
          label: 'Denah 9 Zona (Opsional — otomatis dari Prompt Book)',
          type: 'list',
          rows: 9,
          placeholder: 'UL | pintu masuk aktor\nUC | singgasana\nUR | backdrop istana\nCL | ruang tunggu\nC | area utama dialog\nCR | meja tamu\nDL | tangga panggung\nDC | area sorot\nDR | area konflik',
          help: 'Kosongkan jika sudah ada data grid di Prompt Book. Sistem akan pakai itu.',
        },
        {
          key: 'sketsaLink',
          label: 'Link Sketsa Visual (Google Drive)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
        },
        {
          key: 'cueLampu',
          label: 'Cue Lampu (Opsional — otomatis dari Prompt Book)',
          type: 'list',
          rows: 5,
          placeholder: 'CUE-01 | Spotlight kiri | Kuning hangat | Pembukaan\nCUE-02 | Fill center | Biru redup | Konflik',
          help: 'Kosongkan jika sudah ada cue di Prompt Book.',
        },
        {
          key: 'urutanPasang',
          label: 'Urutan Pasang & Bongkar (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Target pasang set: < 10 menit\nTarget strike: < 5 menit\nTim: 8 orang',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 6. PROMPT BOOK
  // ═══════════════════════════════════════════════════
  'prompt-book': [
    {
      title: 'Catatan Sutradara',
      fields: [
        {
          key: 'stageManager',
          label: 'Nama Stage Manager',
          type: 'text',
          placeholder: 'Nama lengkap stage manager',
        },
        {
          key: 'tanggalMulai',
          label: 'Tanggal Mulai Latihan',
          type: 'text',
          placeholder: '1 Agustus 2026',
        },
        {
          key: 'catatanBlocking',
          label: 'Catatan Blocking Penting',
          type: 'textarea',
          rows: 5,
          placeholder: 'Contoh: Ratu tidak turun dari singgasana sampai adegan 3. Aktor utama harus masuk dari sisi kanan panggung.',
        },
        {
          key: 'catatanTeknis',
          label: 'Catatan Teknis (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Standby ASM di sisi panggung kiri\nSound check wajib 30 menit sebelum opening\nCek cue lampu sebelum adegan 1',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 7. CUE SHEET MUSIK
  // ═══════════════════════════════════════════════════
  'cue-sheet': [
    {
      title: 'Checklist Sound Check',
      fields: [
        {
          key: 'checklist',
          label: 'Checklist Persiapan (satu per baris)',
          type: 'list',
          rows: 7,
          placeholder: 'Semua mic on dan balance\nBacking track tersedia offline\nMixer preset tersimpan\nMonitor speaker dan feedback terkontrol\nBackup laptop dan USB\nLagu darurat siap\nSound check 30 menit sebelum opening',
          help: 'Daftar cue dan operator diambil otomatis dari menu Cue Sheet Musik.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 8. PROPERTI
  // ═══════════════════════════════════════════════════
  'properti-breakdown': [
    {
      title: 'Catatan Tambahan',
      fields: [
        {
          key: 'catatanPenting',
          label: 'Catatan Penting (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Semua properti harus aman dipakai di panggung\nUpdate status setiap minggu\nSimpan dengan label per adegan\nFoto progress tiap selesai pembuatan',
          help: 'Daftar properti diambil otomatis dari menu Properti.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 9. KOSTUM
  // ═══════════════════════════════════════════════════
  'kostum-karakter': [
    {
      title: 'Identitas Karakter',
      fields: [
        {
          key: 'namaKarakter',
          label: 'Nama Karakter',
          type: 'text',
          required: true,
          placeholder: 'Ratu Aji Bidara Putih',
        },
        {
          key: 'namaPemain',
          label: 'Nama Pemain',
          type: 'text',
          required: true,
          placeholder: 'Nama lengkap pemain',
        },
        {
          key: 'peranKarakter',
          label: 'Peran',
          type: 'select',
          required: true,
          options: [
            { value: 'Protagonis', label: 'Protagonis' },
            { value: 'Antagonis', label: 'Antagonis' },
            { value: 'Pendukung', label: 'Pendukung' },
          ],
        },
        {
          key: 'zaman',
          label: 'Zaman / Suku',
          type: 'text',
          placeholder: 'Kerajaan Kutai, Abad ke-14',
        },
        {
          key: 'watak',
          label: 'Watak Karakter',
          type: 'text',
          placeholder: 'Tegas, bijaksana, pemberani',
        },
      ],
    },
    {
      title: 'Konsep Kostum',
      fields: [
        {
          key: 'warnaDominan',
          label: 'Warna Dominan',
          type: 'text',
          placeholder: 'Putih gading',
        },
        {
          key: 'warnaSekunder',
          label: 'Warna Sekunder',
          type: 'text',
          placeholder: 'Emas',
        },
        {
          key: 'siluet',
          label: 'Siluet',
          type: 'text',
          placeholder: 'Gaun panjang A-line',
        },
      ],
    },
    {
      title: 'Ukuran Pemain (cm)',
      fields: [
        { key: 'ld', label: 'Lingkar Dada (LD)', type: 'text', placeholder: '90' },
        { key: 'lp', label: 'Lingkar Pinggang (LP)', type: 'text', placeholder: '70' },
        { key: 'lpg', label: 'Lingkar Pinggul (LPG)', type: 'text', placeholder: '95' },
        { key: 'pb', label: 'Panjang Baju (PB)', type: 'text', placeholder: '140' },
        { key: 'pc', label: 'Panjang Celana atau Rok (PC)', type: 'text', placeholder: '100' },
        { key: 'lebarBahu', label: 'Lebar Bahu', type: 'text', placeholder: '40' },
        { key: 'panjangLengan', label: 'Panjang Lengan', type: 'text', placeholder: '55' },
      ],
    },
    {
      title: 'Bahan & Referensi',
      fields: [
        {
          key: 'bahanList',
          label: 'Kebutuhan Bahan (format: Bahan | Jumlah | Warna)',
          type: 'list',
          rows: 4,
          placeholder: 'Kain utama | 3 meter | Putih\nKain furing | 2 meter | Krem\nKancing | 6 pcs | Emas',
        },
        {
          key: 'linkMoodboard',
          label: 'Link Moodboard',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
        },
        {
          key: 'linkReferensi',
          label: 'Link Foto Referensi',
          type: 'text',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 10. FACE CHART
  // ═══════════════════════════════════════════════════
  'face-chart': [
    {
      title: 'Identitas',
      fields: [
        {
          key: 'namaPemain',
          label: 'Nama Pemain',
          type: 'text',
          required: true,
          placeholder: 'Nama lengkap pemain',
        },
        {
          key: 'namaKarakter',
          label: 'Nama Karakter',
          type: 'text',
          required: true,
          placeholder: 'Nama karakter yang diperankan',
        },
        {
          key: 'jenisRias',
          label: 'Jenis Rias',
          type: 'select',
          required: true,
          options: [
            { value: 'Korektif', label: 'Korektif' },
            { value: 'Karakter', label: 'Karakter' },
            { value: 'Fantasi', label: 'Fantasi' },
          ],
        },
        {
          key: 'tingkatKesulitan',
          label: 'Tingkat Kesulitan',
          type: 'select',
          options: [
            { value: 'Rendah', label: 'Rendah' },
            { value: 'Sedang', label: 'Sedang' },
            { value: 'Tinggi', label: 'Tinggi' },
          ],
        },
      ],
    },
    {
      title: 'Palet Warna (format: Area | Warna | Produk)',
      fields: [
        {
          key: 'paletList',
          label: 'Palet Warna',
          type: 'list',
          required: true,
          rows: 6,
          placeholder: 'Base | Coklat muda | Foundation shade 02\nEyeshadow | Emas dan coklat | Palet A\nBlush on | Peach | Blush B\nLipstik | Merah bata | Matte lipstick\nKontur | Coklat tua | Contour stick\nHighlight | Gold shimmer | Highlighter C',
        },
      ],
    },
    {
      title: 'Teknik & Urutan',
      fields: [
        {
          key: 'teknikKhusus',
          label: 'Teknik Khusus (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Efek luka: bubuk kayu manis dan madu\nPenuaan: shading dan bedak\nEfek air mata: glycerin dan air\nAksen glitter: body glitter',
        },
        {
          key: 'urutanPengerjaan',
          label: 'Urutan Pengerjaan (satu per baris)',
          type: 'list',
          rows: 9,
          placeholder: 'Bersihkan wajah dan aplikasikan primer\nBase dan concealer\nKontur dan highlight\nMata (eyeshadow, eyeliner, bulu mata)\nAlis\nBlush on\nBibir\nSetting spray\nTouch-up terakhir',
        },
      ],
    },
    {
      title: 'Referensi & Higienitas',
      fields: [
        {
          key: 'linkMoodboard',
          label: 'Link Moodboard',
          type: 'text',
          placeholder: 'Kosongkan jika sudah ada di menu Face Chart.',
        },
        {
          key: 'linkFaceChart',
          label: 'Link Face Chart Kosong',
          type: 'text',
        },
        {
          key: 'higienitas',
          label: 'Catatan Higienitas (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Gunakan spons sekali pakai\nSterilkan kuas sebelum dan sesudah\nLakukan tes alergi sebelum hari-H\nSediakan makeup remover di ruang rias',
        },
      ],
    },
  ],
};

export function getTemplateForm(templateId: string): FormSection[] {
  return TEMPLATE_FORMS[templateId] || [];
}

export function getDefaultData(_templateId: string): Record<string, any> {
  return {};
}
