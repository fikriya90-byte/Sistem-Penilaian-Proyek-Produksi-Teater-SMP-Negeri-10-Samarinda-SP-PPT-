// =====================================================
// FORM DEFINITIONS — hanya field yang TIDAK bisa auto
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
  // 1. PROPOSAL — disederhanakan, hanya yang perlu narasi
  // ═══════════════════════════════════════════════════
  proposal: [
    {
      title: 'Identitas Pementasan (Cover & Pengesahan)',
      fields: [
        {
          key: 'judulPementasan',
          label: 'Judul Pementasan',
          type: 'text',
          required: true,
          placeholder: 'Contoh: Mamanda — Petualangan Anak Samarinda',
          help: 'Akan muncul di halaman judul, kop, & lembar pengesahan.',
        },
        {
          key: 'jenisTeaterTradisional',
          label: 'Jenis Teater Tradisional',
          type: 'text',
          required: true,
          placeholder: 'Mamanda / Ketoprak / Lenong / Ludruk / Randai / Dulmuluk / dll.',
        },
        {
          key: 'waliKelasName',
          label: 'Nama Wali Kelas (untuk tanda tangan)',
          type: 'text',
          placeholder: 'Nama lengkap + gelar',
          help: 'Tidak ada di sistem — isi manual.',
        },
        {
          key: 'kepalaSekolahName',
          label: 'Nama Kepala Sekolah (untuk tanda tangan)',
          type: 'text',
          placeholder: 'Nama lengkap + gelar',
          help: 'Tidak ada di sistem — isi manual.',
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
      title: 'BAB I — Pendahuluan',
      fields: [
        {
          key: 'latarBelakang',
          label: 'Latar Belakang',
          type: 'textarea',
          required: true,
          rows: 6,
          placeholder: 'Kegiatan ini menjadi ruang bagi siswa kelas IX untuk mengalami langsung proses produksi teater tradisional, mulai dari membaca naskah, berlatih, hingga tampil...',
          help: 'Tekankan pengalaman belajar: kerja sama, disiplin, kreativitas, apresiasi budaya daerah.',
        },
        {
          key: 'rumusanMasalah',
          label: 'Rumusan Masalah (satu per baris)',
          type: 'list',
          required: true,
          rows: 3,
          placeholder: 'Bagaimana merancang produksi teater tradisional?\nBagaimana melaksanakan pementasan?\nBagaimana mengevaluasi hasil pementasan?',
        },
        {
          key: 'tujuan',
          label: 'Tujuan Kegiatan (satu per baris)',
          type: 'list',
          required: true,
          rows: 5,
          placeholder: 'Memahami ciri & unsur teater tradisional\nMenyusun rancangan produksi\nMelatih kerja sama & disiplin\nMenampilkan pertunjukan teater tradisional\nMengevaluasi hasil pementasan',
          help: 'Gunakan kata kerja operasional, minimal 3 poin.',
        },
        {
          key: 'manfaat',
          label: 'Manfaat Kegiatan',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Bagi siswa: melatih kepercayaan diri & kerja sama.\nBagi sekolah: memperkaya kegiatan seni.\nBagi budaya: ikut melestarikan teater tradisional.',
        },
        {
          key: 'ruangLingkup',
          label: 'Ruang Lingkup',
          type: 'textarea',
          rows: 2,
          placeholder: 'Kegiatan mencakup perencanaan, latihan, gladi resik, pementasan, dan evaluasi.',
        },
        {
          key: 'kataPengantar',
          label: 'Kata Pengantar',
          type: 'textarea',
          rows: 4,
          placeholder: 'Puji syukur kami panjatkan... Proposal ini disusun sebagai rancangan praktik produksi teater tradisional kelas IX...',
        },
      ],
    },
    {
      title: 'BAB II — Narasi Artistik (opsional jika sudah ada di sistem)',
      fields: [
        {
          key: 'sinopsis',
          label: 'Sinopsis Cerita (kosongkan jika pakai dari data Produksi)',
          type: 'textarea',
          rows: 5,
          placeholder: 'Kosongkan jika data Sinopsis sudah ada di menu Produksi. Sistem akan otomatis ambil dari sana.',
          help: 'Sistem otomatis menarik dari collection "productions" — isi manual hanya jika ingin override.',
        },
        {
          key: 'sumberCerita',
          label: 'Sumber Cerita',
          type: 'text',
          placeholder: 'Cerita rakyat Kalimantan Timur — Legenda Putri Junjung Buih',
        },
        {
          key: 'strukturDramatik',
          label: 'Struktur Dramatik',
          type: 'textarea',
          rows: 3,
          placeholder: 'Eksposisi: ...\nKonflik: ...\nKlimaks: ...\nResolusi: ...',
        },
        {
          key: 'konsepArtistik',
          label: 'Konsep Artistik (satu baris per aspek, format: Aspek | Deskripsi)',
          type: 'list',
          rows: 9,
          placeholder: 'Tata Panggung | Panggung sederhana bergaya rumah adat/balai desa\nTata Cahaya | Lampu utama, sorot, dan warna\nTata Suara | Mikrofon, speaker, musik pengiring\nMusik Pengiring | Musik tradisional daerah, gendang, gambang\nKostum | Baju adat daerah, kain, ikat kepala\nRias | Rias karakter tua, muda, lucu\nProperti | Tongkat, kursi, meja, payung, keranjang\nTari/Gerak | Gerak tari daerah pembuka\nBahasa/Dialek | Bahasa Indonesia dengan sentuhan dialek daerah',
          help: 'Pisahkan dengan " | ". Setiap baris = 1 aspek artistik.',
        },
      ],
    },
    {
      title: 'BAB II — Konsep Manajemen',
      fields: [
        {
          key: 'sistemLatihan',
          label: 'Sistem Latihan',
          type: 'textarea',
          rows: 2,
          placeholder: 'Latihan 2 kali seminggu, pukul 14.00–16.00 di panggung terbuka.',
        },
        {
          key: 'publikasiDok',
          label: 'Publikasi & Dokumentasi',
          type: 'textarea',
          rows: 2,
          placeholder: 'Poster, undangan, dokumentasi foto/video, aftermovie.',
        },
        {
          key: 'konsumsiPerlengkapan',
          label: 'Konsumsi & Perlengkapan',
          type: 'textarea',
          rows: 2,
          placeholder: 'Konsumsi latihan & gladi; perlengkapan panggung & properti.',
        },
        {
          key: 'sasaranPenonton',
          label: 'Sasaran Penonton',
          type: 'text',
          placeholder: 'Siswa, guru, orang tua, dan warga sekolah.',
        },
      ],
    },
    {
      title: 'BAB III — RAB & Kas',
      fields: [
        {
          key: 'rabUploadUrl',
          label: 'Link RAB Final Ditandatangani (opsional)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'RAB Digital + estimasi pemasukan dari kas akan OTOMATIS dimuat. Field ini hanya untuk melampirkan file RAB final yang sudah ditandatangani.',
        },
        {
          key: 'rabUploadName',
          label: 'Nama File RAB Final',
          type: 'text',
          placeholder: 'RAB_Final_IX-C.pdf',
        },
        {
          key: 'rabCatatan',
          label: 'Catatan RAB',
          type: 'textarea',
          rows: 2,
          placeholder: 'Anggaran dapat berubah sesuai kesepakatan kelas.',
        },
      ],
    },
    {
      title: 'BAB IV — Penutup',
      fields: [
        {
          key: 'penutup',
          label: 'Kalimat Penutup',
          type: 'textarea',
          required: true,
          rows: 3,
          placeholder: 'Demikian proposal ini kami susun. Kami berharap kegiatan ini dapat berjalan lancar dan memberi pengalaman berharga bagi semua siswa.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 2. SURAT IZIN (sama seperti sebelumnya)
  // ═══════════════════════════════════════════════════
  'surat-izin': [
    {
      fields: [
        { key: 'nomorSurat', label: 'Nomor Surat', type: 'text', required: true,
          placeholder: '001/SP-PPT/SMPN10-SMR/2025' },
        { key: 'namaKegiatan', label: 'Nama Kegiatan', type: 'text', required: true,
          placeholder: 'Gladi Resik & Pementasan Teater' },
        { key: 'hariTanggal', label: 'Hari / Tanggal', type: 'text', required: true,
          placeholder: 'Sabtu, 20 November 2026' },
        { key: 'waktuMulai', label: 'Jam Mulai', type: 'time', required: true },
        { key: 'waktuSelesai', label: 'Jam Selesai', type: 'time', required: true },
        { key: 'tempat', label: 'Tempat Kegiatan', type: 'text', required: true,
          placeholder: 'Aula SMP Negeri 10 Samarinda' },
        { key: 'penanggungJawab', label: 'Penanggung Jawab', type: 'text', required: true,
          placeholder: 'Nama Pimpinan Produksi' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 3. SURAT PERMOHONAN
  // ═══════════════════════════════════════════════════
  'surat-permohonan': [
    {
      fields: [
        { key: 'nomorSurat', label: 'Nomor Surat', type: 'text', required: true,
          placeholder: '002/SP-PPT/SMPN10-SMR/2025' },
        { key: 'namaInstansi', label: 'Nama Instansi / Donatur', type: 'text', required: true,
          placeholder: 'PT Kaltim Kreatif' },
        { key: 'alamatInstansi', label: 'Kota Tujuan', type: 'text', required: true,
          placeholder: 'Samarinda' },
        { key: 'jenisBantuan', label: 'Daftar Bantuan (format: Jenis | Jumlah | Keterangan)',
          type: 'list', required: true, rows: 5,
          placeholder: 'Dana Tunai | Rp 500.000 | Untuk properti\nBahan Kostum | 5 meter | Kain satin putih\nKonsumsi | 20 box | Snack latihan',
          help: 'Satu baris = satu bantuan. Pisahkan dengan " | ".' },
        { key: 'narasiTambahan', label: 'Narasi Tambahan (opsional)', type: 'textarea', rows: 3,
          placeholder: 'Kalimat pengantar khusus untuk donatur...' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 4. LPJ — disederhanakan, hanya yang perlu narasi
  // ═══════════════════════════════════════════════════
  lpj: [
    {
      title: 'Identitas LPJ',
      fields: [
        {
          key: 'judulPementasan',
          label: 'Judul Pementasan',
          type: 'text',
          required: true,
          placeholder: 'Contoh: Mamanda — Petualangan Anak Samarinda',
        },
        {
          key: 'jenisTeaterTradisional',
          label: 'Jenis Teater Tradisional',
          type: 'text',
          required: true,
          placeholder: 'Mamanda / Ketoprak / Lenong / dll.',
        },
        {
          key: 'waliKelasName',
          label: 'Nama Wali Kelas (untuk tanda tangan)',
          type: 'text',
        },
        {
          key: 'kepalaSekolahName',
          label: 'Nama Kepala Sekolah (untuk tanda tangan)',
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
      title: 'BAB I — Pendahuluan',
      fields: [
        {
          key: 'latarBelakang',
          label: 'Latar Belakang LPJ',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Kegiatan pementasan telah dilaksanakan. LPJ ini memuat pelaksanaan, realisasi anggaran, evaluasi, dan refleksi.',
        },
        {
          key: 'dasarPelaksanaan',
          label: 'Dasar Pelaksanaan',
          type: 'textarea',
          rows: 2,
          placeholder: 'Program praktik seni teater kelas IX dan hasil rapat panitia.',
        },
        {
          key: 'tujuanLPJ',
          label: 'Tujuan LPJ',
          type: 'textarea',
          rows: 2,
          placeholder: 'Melaporkan pelaksanaan kegiatan dan pertanggungjawaban anggaran.',
        },
        {
          key: 'ruangLingkup',
          label: 'Ruang Lingkup',
          type: 'textarea',
          rows: 2,
          placeholder: 'Laporan mencakup tahap praproduksi, latihan, gladi resik, pementasan, dan evaluasi.',
        },
        {
          key: 'kataPengantar',
          label: 'Kata Pengantar',
          type: 'textarea',
          rows: 4,
          placeholder: 'Puji syukur kami panjatkan... Laporan ini disusun sebagai bentuk pertanggungjawaban atas pelaksanaan pementasan teater tradisional kelas IX...',
        },
      ],
    },
    {
      title: 'BAB II — Hasil Pelaksanaan',
      fields: [
        {
          key: 'jumlahPenonton',
          label: 'Jumlah Penonton',
          type: 'number',
          placeholder: '150',
        },
        {
          key: 'tahapanPraproduksi',
          label: 'Tahapan — Praproduksi',
          type: 'textarea',
          rows: 2,
          placeholder: 'Rapat panitia, pembagian tugas, penyusunan RAB.',
        },
        {
          key: 'tahapanLatihan',
          label: 'Tahapan — Latihan',
          type: 'textarea',
          rows: 2,
          placeholder: 'Latihan 6 kali: reading, blocking, hafalan, full run-through.',
        },
        {
          key: 'tahapanGladi',
          label: 'Tahapan — Gladi Resik',
          type: 'textarea',
          rows: 2,
          placeholder: 'Gladi resik 1 kali dengan kostum & properti lengkap.',
        },
        {
          key: 'tahapanPementasan',
          label: 'Tahapan — Pementasan',
          type: 'textarea',
          rows: 2,
          placeholder: 'Pementasan utama berjalan lancar, durasi 30 menit.',
        },
        {
          key: 'tahapanEvaluasi',
          label: 'Tahapan — Evaluasi',
          type: 'textarea',
          rows: 2,
          placeholder: 'Rapat evaluasi produksi, penyusunan LPJ, inventarisasi.',
        },
        {
          key: 'hasilPementasan',
          label: 'Hasil Pementasan (narasi)',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Pementasan berjalan lancar. Penonton terdiri atas siswa, guru, dan orang tua. Respons penonton positif...',
        },
        {
          key: 'kendalaSolusi',
          label: 'Kendala & Solusi (format: Kendala | Solusi)',
          type: 'list',
          required: true,
          rows: 4,
          placeholder: 'Waktu latihan terbatas | Latihan ditambah pada hari Sabtu\nSound system error | Diperbaiki oleh tim musik\nKostum belum selesai | Lembur H-2',
          help: 'Pisahkan dengan " | ". Satu baris = satu pasang kendala & solusi.',
        },
      ],
    },
    {
      title: 'BAB III — Realisasi Keuangan',
      fields: [
        {
          key: 'rabUploadUrl',
          label: 'Link RAB Final Ditandatangani (opsional)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'Detail RAB + estimasi pemasukan dari kas akan OTOMATIS dimuat. Field ini hanya untuk melampirkan file RAB final bertanda tangan.',
        },
        {
          key: 'rabUploadName',
          label: 'Nama File RAB Final',
          type: 'text',
          placeholder: 'RAB_Final_IX-C.pdf',
        },
        {
          key: 'realisasiPemasukan',
          label: 'Realisasi Pemasukan per Sumber (format: Sumber | Rencana | Realisasi)',
          type: 'list',
          rows: 5,
          placeholder: 'Kas Kelas | 3000000 | 3100000\nIuran Siswa | 0 | 0\nSponsor/Donatur | 500000 | 500000\nTiket/Undangan | 200000 | 250000',
          help: 'Opsional. Kalau kosong, sistem pakai data kas & RAB otomatis.',
        },
        {
          key: 'realisasiPengeluaran',
          label: 'Realisasi Pengeluaran per Kategori (format: Kategori | Rencana | Realisasi)',
          type: 'list',
          rows: 8,
          placeholder: 'Kostum | 1000000 | 1100000\nRias | 200000 | 180000\nPanggung | 500000 | 450000\nProperti | 300000 | 280000',
          help: 'Opsional. Kalau kosong, sistem pakai data RAB Digital.',
        },
      ],
    },
    {
      title: 'BAB IV — Evaluasi & Refleksi',
      fields: [
        {
          key: 'evaluasiKetercapaian',
          label: 'Evaluasi Ketercapaian',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Sebagian besar tujuan tercapai. Siswa mampu tampil percaya diri dan bekerja sama.',
        },
        {
          key: 'refleksiTim',
          label: 'Refleksi Siswa/Tim',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Kami belajar bahwa pementasan bukan hanya soal akting, tetapi juga kerja sama, disiplin, dan tanggung jawab.',
        },
        {
          key: 'rekomendasi',
          label: 'Rekomendasi',
          type: 'textarea',
          rows: 3,
          placeholder: 'Perlu latihan lebih awal dan pembagian tugas yang lebih jelas.',
        },
      ],
    },
    {
      title: 'BAB V — Penutup & Lampiran',
      fields: [
        {
          key: 'penutup',
          label: 'Kalimat Penutup',
          type: 'textarea',
          required: true,
          rows: 3,
          placeholder: 'Demikian LPJ ini kami susun. Terima kasih kepada semua pihak yang telah mendukung.',
        },
        {
          key: 'lampiran',
          label: 'Daftar Lampiran (satu per baris, kosongkan untuk pakai standar)',
          type: 'list',
          rows: 15,
          placeholder: 'Daftar hadir panitia\nDaftar hadir pemain\nDaftar hadir latihan\nNotula rapat\nJadwal kegiatan\nDokumentasi pementasan\nBukti pengeluaran\nSurat menyurat\nLembar penilaian\nDaftar inventaris\nSusunan acara\nNaskah/skenario\nDesain artistik\nForm evaluasi\nLain-lain',
          help: 'Kalau dibiarkan kosong, sistem akan pakai daftar lampiran standar.',
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
        { key: 'konsep', label: 'Konsep Tata Panggung', type: 'textarea', required: true, rows: 4,
          placeholder: 'Gaya realis/stilir, warna dominan, dan kesan yang ingin dibangun...' },
        { key: 'denahZona', label: 'Denah 9 Zona (format: Kode | Deskripsi Penggunaan)',
          type: 'list', rows: 9,
          placeholder: 'UL | pintu masuk aktor\nUC | singgasana\nUR | backdrop istana\nCL | ruang tunggu\nC | area utama dialog\nCR | meja tamu\nDL | tangga panggung\nDC | area sorot\nDR | area konflik' },
        { key: 'sketsaLink', label: 'Link Sketsa Visual (Google Drive)', type: 'text',
          placeholder: 'https://drive.google.com/...' },
        { key: 'cueLampu', label: 'Cue Lampu (format: Cue | Posisi | Warna | Adegan)',
          type: 'list', rows: 5,
          placeholder: 'CUE-01 | Spotlight kiri | Kuning hangat | Pembukaan\nCUE-02 | Fill center | Biru redup | Konflik' },
        { key: 'urutanPasang', label: 'Urutan Pasang & Bongkar (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Target pasang set: < 10 menit\nTarget strike: < 5 menit\nTim: 8 orang' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 6. PROMPT BOOK
  // ═══════════════════════════════════════════════════
  'prompt-book': [
    {
      title: 'Tim Inti',
      fields: [
        { key: 'sutradara', label: 'Nama Sutradara', type: 'text', required: true },
        { key: 'asisten', label: 'Nama Asisten Sutradara', type: 'text', required: true },
        { key: 'stageManager', label: 'Nama Stage Manager', type: 'text', required: true },
        { key: 'tanggalMulai', label: 'Tanggal Mulai Latihan', type: 'text', required: true,
          placeholder: '1 Agustus 2026' },
      ],
    },
    {
      title: 'Daftar Adegan (format: No | Adegan | Durasi | Pemain | Zona)',
      fields: [
        { key: 'daftarAdegan', label: 'Daftar Adegan', type: 'list', required: true, rows: 6,
          placeholder: '1 | Pembukaan — Prolog | 3 mnt | Narator | DC\n2 | Konflik Pertama | 5 mnt | Ratu + Utusan | C\n3 | Klimaks | 8 mnt | Ensemble | UC' },
      ],
    },
    {
      title: 'Cue Sheet (format: Cue | Trigger | Aksi | Audio | Lampu)',
      fields: [
        { key: 'cueList', label: 'Cue List', type: 'list', required: true, rows: 6,
          placeholder: 'CUE-01 | Opening music mulai | Lampu fade in | Track 01 | Warm spot UC\nCUE-02 | Aktor masuk stage | Spotlight follow | Track 02 | Follow spot' },
      ],
    },
    {
      title: 'Catatan',
      fields: [
        { key: 'catatanBlocking', label: 'Catatan Blocking Penting', type: 'textarea', rows: 5,
          placeholder: 'Contoh: Ratu tidak turun dari singgasana sampai adegan 3...' },
        { key: 'catatanTeknis', label: 'Catatan Teknis (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Standby ASM di sisi panggung kiri\nSound check wajib 30 menit sebelum opening' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 7. CUE SHEET
  // ═══════════════════════════════════════════════════
  'cue-sheet': [
    {
      title: 'Daftar Cue',
      fields: [
        { key: 'cueList', label: 'Cue List (format: Cue | Adegan | Track | In/Out | Durasi | Volume | Link)',
          type: 'list', required: true, rows: 7,
          placeholder: 'CUE-01 | Opening | Overture | In 0:00 | 1:30 | 80% | link1\nCUE-02 | Konflik | Battle Theme | In 0:15 | 2:00 | 75% | link2' },
      ],
    },
    {
      title: 'Operator',
      fields: [
        { key: 'operatorList', label: 'Operator (format: Posisi | Nama)', type: 'list', required: true, rows: 3,
          placeholder: 'Sound Engineer | Nama 1\nMixer Operator | Nama 2' },
      ],
    },
    {
      title: 'Checklist Sound Check',
      fields: [
        { key: 'checklist', label: 'Checklist (satu per baris)', type: 'list', rows: 7,
          placeholder: 'Semua mic on & balance\nBacking track tersedia offline\nMixer preset tersimpan\nMonitor speaker & feedback terkontrol' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 8. PROPERTI
  // ═══════════════════════════════════════════════════
  'properti-breakdown': [
    {
      fields: [
        { key: 'propertiList', label: 'Daftar Properti (format: No | Adegan | Nama Properti | Bahan | Qty | Status | PIC)',
          type: 'list', required: true, rows: 10,
          placeholder: '1 | Babak 1 | Singgasana | Kayu + kain | 1 | PROSES | Nama\n2 | Babak 1 | Tongkat kerajaan | Bambu + cat emas | 1 | SELESAI | Nama' },
        { key: 'catatanPenting', label: 'Catatan Penting (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Semua properti harus aman dipakai di panggung\nUpdate status setiap minggu' },
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
        { key: 'namaKarakter', label: 'Nama Karakter', type: 'text', required: true,
          placeholder: 'Ratu Aji Bidara Putih' },
        { key: 'namaPemain', label: 'Nama Pemain', type: 'text', required: true },
        { key: 'peranKarakter', label: 'Peran', type: 'select', required: true, options: [
          { value: 'Protagonis', label: 'Protagonis' },
          { value: 'Antagonis', label: 'Antagonis' },
          { value: 'Pendukung', label: 'Pendukung' },
        ]},
        { key: 'zaman', label: 'Zaman / Suku', type: 'text', placeholder: 'Kerajaan Kutai, Abad ke-14' },
        { key: 'watak', label: 'Watak Karakter', type: 'text', placeholder: 'Tegas, bijaksana, pemberani' },
      ],
    },
    {
      title: 'Konsep Kostum',
      fields: [
        { key: 'warnaDominan', label: 'Warna Dominan', type: 'text', placeholder: 'Putih gading' },
        { key: 'warnaSekunder', label: 'Warna Sekunder', type: 'text', placeholder: 'Emas' },
        { key: 'tekstur', label: 'Tekstur / Bahan', type: 'text', placeholder: 'Sutra mengkilap' },
        { key: 'siluet', label: 'Siluet', type: 'text', placeholder: 'Gaun panjang A-line' },
        { key: 'ornamen', label: 'Ornamen / Aksesoris', type: 'text', placeholder: 'Mahkota, kalung, gelang' },
      ],
    },
    {
      title: 'Ukuran Pemain (cm)',
      fields: [
        { key: 'ld', label: 'Lingkar Dada (LD)', type: 'text', placeholder: '90' },
        { key: 'lp', label: 'Lingkar Pinggang (LP)', type: 'text', placeholder: '70' },
        { key: 'lpg', label: 'Lingkar Pinggul (LPG)', type: 'text', placeholder: '95' },
        { key: 'pb', label: 'Panjang Baju (PB)', type: 'text', placeholder: '140' },
        { key: 'pc', label: 'Panjang Celana/Rok (PC)', type: 'text', placeholder: '100' },
        { key: 'lebarBahu', label: 'Lebar Bahu', type: 'text', placeholder: '40' },
        { key: 'panjangLengan', label: 'Panjang Lengan', type: 'text', placeholder: '55' },
      ],
    },
    {
      title: 'Bahan & Referensi',
      fields: [
        { key: 'bahanList', label: 'Kebutuhan Bahan (format: Bahan | Jumlah | Warna)', type: 'list', rows: 4,
          placeholder: 'Kain utama | 3 meter | Putih\nKain furing | 2 meter | Krem' },
        { key: 'linkMoodboard', label: 'Link Moodboard', type: 'text' },
        { key: 'linkReferensi', label: 'Link Foto Referensi', type: 'text' },
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
        { key: 'namaPemain', label: 'Nama Pemain', type: 'text', required: true },
        { key: 'namaKarakter', label: 'Nama Karakter', type: 'text', required: true },
        { key: 'jenisRias', label: 'Jenis Rias', type: 'select', required: true, options: [
          { value: 'Korektif', label: 'Korektif' },
          { value: 'Karakter', label: 'Karakter' },
          { value: 'Fantasi', label: 'Fantasi' },
        ]},
        { key: 'tingkatKesulitan', label: 'Tingkat Kesulitan', type: 'select', options: [
          { value: 'Rendah', label: 'Rendah' },
          { value: 'Sedang', label: 'Sedang' },
          { value: 'Tinggi', label: 'Tinggi' },
        ]},
      ],
    },
    {
      title: 'Palet Warna (format: Area | Warna | Produk)',
      fields: [
        { key: 'paletList', label: 'Palet Warna', type: 'list', required: true, rows: 6,
          placeholder: 'Base | Coklat muda | Foundation shade 02\nEyeshadow | Emas + coklat | Palet A\nBlush on | Peach | Blush B' },
      ],
    },
    {
      title: 'Teknik & Urutan',
      fields: [
        { key: 'teknikKhusus', label: 'Teknik Khusus (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Efek luka: bubuk kayu manis + madu\nPenuaan: shading + bedak' },
        { key: 'urutanPengerjaan', label: 'Urutan Pengerjaan (satu per baris)', type: 'list', rows: 9,
          placeholder: 'Bersihkan wajah & aplikasikan primer\nBase & concealer\nKontur & highlight\nMata' },
      ],
    },
    {
      title: 'Referensi & Higienitas',
      fields: [
        { key: 'linkMoodboard', label: 'Link Moodboard', type: 'text' },
        { key: 'linkFaceChart', label: 'Link Face Chart Kosong', type: 'text' },
        { key: 'higienitas', label: 'Catatan Higienitas (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Gunakan spons sekali pakai\nSterilkan kuas sebelum & sesudah\nLakukan tes alergi sebelum hari-H' },
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
