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
          placeholder: 'Contoh: Kami memilih pementasan ini karena ingin memperkenalkan cerita rakyat Kalimantan Timur kepada teman-teman, sekaligus belajar bekerja sama dalam tim produksi.',
          help: 'Jelaskan dengan bahasa sendiri. Cukup 3-5 kalimat.',
        },
        {
          key: 'tujuan',
          label: 'Apa yang Ingin Dicapai? (satu per baris)',
          type: 'list',
          required: true,
          rows: 5,
          placeholder: 'Mengasah kemampuan akting dan menghafal naskah\nMemperkenalkan cerita rakyat daerah\nMelatih kerja sama dan disiplin\nMenumbuhkan keberanian tampil di depan umum\nBelajar mengatur waktu antara latihan dan pelajaran',
          help: 'Tuliskan minimal 3 tujuan. Setiap baris = 1 tujuan.',
        },
        {
          key: 'manfaat',
          label: 'Apa Manfaatnya?',
          type: 'textarea',
          required: true,
          rows: 5,
          placeholder: 'Untuk siswa: melatih keberanian, disiplin, dan kerja sama.\nUntuk sekolah: menambah kegiatan seni dan budaya.\nUntuk budaya daerah: ikut melestarikan cerita rakyat.',
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
          placeholder: 'Contoh: Pementasan akan berlangsung selama 30 menit dengan gaya tradisional Mamanda. Panggung dihias dengan latar rumah adat Kalimantan.',
          help: 'Ceritakan pementasan yang kalian bayangkan. Kalau Sutradara sudah isi Visi di menu Produksi, biarkan kosong — akan diambil otomatis.',
        },
        {
          key: 'alurCerita',
          label: 'Alur Cerita Singkat (Opsional)',
          type: 'textarea',
          rows: 4,
          placeholder: 'Contoh:\nAwal: Seorang pemuda diperkenalkan di desanya.\nKonflik: Ia gagal melewati ujian dari tetua adat.\nPuncak: Ia harus memilih antara menyerah atau mencoba lagi.\nAkhir: Ia belajar dari kesalahannya dan berhasil.',
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
          help: 'Setelah dipilih, sistem akan mengisi bagian Konsep Artistik secara otomatis.',
        },
        {
          key: 'kataPengantar',
          label: 'Kata Pengantar',
          type: 'textarea',
          rows: 4,
          placeholder: 'Contoh: Puji syukur kami panjatkan kepada Tuhan Yang Maha Esa. Proposal ini kami susun sebagai rancangan pementasan teater kelas IX...',
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
          placeholder: 'Contoh: Pementasan akan dilaksanakan di Aula SMP Negeri 10 Samarinda pada hari Sabtu, 20 November 2026, pukul 09.00 WITA.',
          help: 'Lokasi, tanggal, dan jam pementasan bisa diambil dari menu Jadwal jika sudah diisi di sana.',
        },
        {
          key: 'rabUploadUrl',
          label: 'Link RAB Final yang Sudah Ditandatangani (Opsional)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'RAB detail akan muncul OTOMATIS dari menu RAB Digital. Isi field ini hanya jika ingin melampirkan file RAB yang sudah ditandatangani.',
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
        { key: 'nomorSurat', label: 'Nomor Surat', type: 'text', required: true, placeholder: '001/SP-PPT/SMPN10-SMR/2025' },
        { key: 'namaKegiatan', label: 'Nama Kegiatan', type: 'text', required: true, placeholder: 'Gladi Resik & Pementasan Teater' },
        { key: 'hariTanggal', label: 'Hari / Tanggal', type: 'text', required: true, placeholder: 'Sabtu, 20 November 2026' },
        { key: 'waktuMulai', label: 'Jam Mulai', type: 'time', required: true },
        { key: 'waktuSelesai', label: 'Jam Selesai', type: 'time', required: true },
        { key: 'tempat', label: 'Tempat Kegiatan', type: 'text', required: true, placeholder: 'Aula SMP Negeri 10 Samarinda' },
        { key: 'penanggungJawab', label: 'Penanggung Jawab', type: 'text', required: true, placeholder: 'Nama Pimpinan Produksi' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 3. SURAT PERMOHONAN
  // ═══════════════════════════════════════════════════
  'surat-permohonan': [
    {
      fields: [
        { key: 'nomorSurat', label: 'Nomor Surat', type: 'text', required: true, placeholder: '002/SP-PPT/SMPN10-SMR/2025' },
        { key: 'namaInstansi', label: 'Nama Instansi / Donatur', type: 'text', required: true, placeholder: 'PT Kaltim Kreatif' },
        { key: 'alamatInstansi', label: 'Kota Tujuan', type: 'text', required: true, placeholder: 'Samarinda' },
        {
          key: 'jenisBantuan',
          label: 'Daftar Bantuan (format: Jenis | Jumlah | Keterangan)',
          type: 'list',
          required: true,
          rows: 5,
          placeholder: 'Dana Tunai | Rp 500.000 | Untuk properti\nBahan Kostum | 5 meter | Kain satin putih\nKonsumsi | 20 box | Snack latihan',
          help: 'Satu baris = satu bantuan. Pisahkan dengan " | ".',
        },
        { key: 'narasiTambahan', label: 'Narasi Tambahan (opsional)', type: 'textarea', rows: 3, placeholder: 'Kalimat pengantar khusus untuk donatur...' },
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
        { key: 'judulPementasan', label: 'Judul Pementasan', type: 'text', required: true, placeholder: 'Contoh: Mamanda — Petualangan Anak Samarinda', help: 'Kosongkan jika ingin pakai judul dari data Produksi.' },
        { key: 'jenisTeaterTradisional', label: 'Jenis Teater Tradisional', type: 'text', required: true, placeholder: 'Mamanda / Ketoprak / Lenong / dll.' },
        { key: 'namaWaliKelas', label: 'Nama Wali Kelas', type: 'text', placeholder: 'Akan muncul di lembar tanda tangan pengesahan.' },
        { key: 'namaKepalaSekolah', label: 'Nama Kepala Sekolah', type: 'text' },
        { key: 'tanggalPengesahan', label: 'Tanggal Pengesahan', type: 'text' },
      ],
    },
    {
      title: 'Bagian Pembuka',
      fields: [
        { key: 'kataPengantar', label: 'Kata Pengantar', type: 'textarea', rows: 4, placeholder: 'Contoh: Puji syukur kami panjatkan. Laporan ini kami susun sebagai bentuk pertanggungjawaban atas pementasan teater yang telah dilaksanakan...' },
        {
          key: 'latarBelakang',
          label: 'Mengapa LPJ Ini Dibuat?',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Pementasan sudah selesai dilaksanakan. LPJ ini dibuat untuk melaporkan seluruh kegiatan, penggunaan dana, dan hasil evaluasi.',
          help: 'Cukup 2-3 kalimat dengan bahasa sendiri.',
        },
      ],
    },
    {
      title: 'Hasil Pementasan',
      fields: [
        { key: 'jumlahPenonton', label: 'Jumlah Penonton', type: 'number', placeholder: 'Contoh: 150' },
        {
          key: 'hasilPementasan',
          label: 'Bagaimana Pementasan Berjalan?',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Pementasan berjalan lancar meskipun ada sedikit kendala teknis. Penonton yang hadir sekitar 150 orang, terdiri dari siswa, guru, dan orang tua.',
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
          help: 'Daftar hadir, bukti pengeluaran, inventaris, notula rapat, dan dokumentasi diambil OTOMATIS dari sistem.',
        },
        { key: 'rabUploadName', label: 'Nama File RAB', type: 'text', placeholder: 'RAB_Final_IX-C.pdf' },
        {
          key: 'realisasiPengeluaran',
          label: 'Realisasi Pengeluaran (Opsional — biarkan kosong jika tidak ada perubahan)',
          type: 'list',
          rows: 8,
          placeholder: 'Kostum | 1000000 | 1100000\nRias | 200000 | 180000\nPanggung | 500000 | 450000',
          help: 'Kosongkan untuk pakai data RAB Digital otomatis.',
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
          placeholder: 'Contoh: Sebagian besar tujuan berhasil dicapai. Siswa mampu tampil dengan percaya diri dan bekerja sama dengan baik.',
        },
        {
          key: 'refleksiTim',
          label: 'Apa Pelajaran yang Didapat?',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Kami belajar bahwa pementasan bukan hanya soal akting, tetapi juga kerja sama tim, disiplin waktu, dan tanggung jawab.',
        },
        { key: 'rekomendasi', label: 'Saran untuk Kegiatan Berikutnya', type: 'textarea', rows: 3, placeholder: 'Contoh: Perlu latihan lebih awal, pembagian tugas yang lebih jelas.' },
      ],
    },
    {
      title: 'Penutup',
      fields: [
        { key: 'penutup', label: 'Kalimat Penutup', type: 'textarea', required: true, rows: 3, placeholder: 'Demikian LPJ ini kami susun. Terima kasih kepada semua pihak yang telah mendukung.' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 5. SKETSA PANGGUNG
  // ═══════════════════════════════════════════════════
  'sketsa-panggung': [
    {
      fields: [
        { key: 'konsep', label: 'Konsep Tata Panggung', type: 'textarea', required: true, rows: 4, placeholder: 'Contoh: Panggung bergaya rumah adat Kalimantan dengan latar belakang kayu dan kain warna cerah.' },
        {
          key: 'denahZona',
          label: 'Denah 9 Zona (Opsional — otomatis dari Prompt Book)',
          type: 'list',
          rows: 9,
          placeholder: 'UL | pintu masuk aktor\nUC | singgasana\nUR | backdrop istana\nCL | ruang tunggu\nC | area utama dialog\nCR | meja tamu\nDL | tangga panggung\nDC | area sorot\nDR | area konflik',
          help: 'Kosongkan jika sudah ada data grid di Prompt Book.',
        },
        { key: 'sketsaLink', label: 'Link Sketsa Visual (Google Drive)', type: 'text', placeholder: 'https://drive.google.com/...' },
        {
          key: 'cueLampu',
          label: 'Cue Lampu (Opsional — otomatis dari Prompt Book)',
          type: 'list',
          rows: 5,
          placeholder: 'CUE-01 | Spotlight kiri | Kuning hangat | Pembukaan\nCUE-02 | Fill center | Biru redup | Konflik',
        },
        { key: 'urutanPasang', label: 'Urutan Pasang & Bongkar (satu per baris)', type: 'list', rows: 5, placeholder: 'Target pasang set: < 10 menit\nTarget strike: < 5 menit\nTim: 8 orang' },
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
        { key: 'stageManager', label: 'Nama Stage Manager', type: 'text', placeholder: 'Nama lengkap stage manager' },
        { key: 'tanggalMulai', label: 'Tanggal Mulai Latihan', type: 'text', placeholder: '1 Agustus 2026' },
        { key: 'catatanBlocking', label: 'Catatan Blocking Penting', type: 'textarea', rows: 5, placeholder: 'Contoh: Ratu tidak turun dari singgasana sampai adegan 3.' },
        { key: 'catatanTeknis', label: 'Catatan Teknis (satu per baris)', type: 'list', rows: 5, placeholder: 'Standby ASM di sisi panggung kiri\nSound check wajib 30 menit sebelum opening\nCek cue lampu sebelum adegan 1' },
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
  // 9. KOSTUM — SIMPLE TANPA UKURAN DETAIL
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
          placeholder: 'Contoh: Ratu Aji Bidara Putih',
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
          key: 'watakKarakter',
          label: 'Watak Karakter',
          type: 'text',
          placeholder: 'Contoh: Tegas, bijaksana, pemberani',
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
          placeholder: 'Contoh: Putih gading',
        },
        {
          key: 'warnaSekunder',
          label: 'Warna Sekunder',
          type: 'text',
          placeholder: 'Contoh: Emas',
        },
        {
          key: 'siluet',
          label: 'Bentuk / Siluet',
          type: 'text',
          placeholder: 'Contoh: Gaun panjang A-line, baju kurung, dsb.',
        },
        {
          key: 'ornamen',
          label: 'Ornamen / Aksesoris',
          type: 'text',
          placeholder: 'Contoh: Mahkota, kalung, gelang, ikat pinggang',
        },
        {
          key: 'perkiraanUkuran',
          label: 'Perkiraan Ukuran (Opsional)',
          type: 'select',
          options: [
            { value: '', label: '-- Boleh dikosongkan --' },
            { value: 'S', label: 'S (Small)' },
            { value: 'M', label: 'M (Medium)' },
            { value: 'L', label: 'L (Large)' },
            { value: 'XL', label: 'XL (Extra Large)' },
            { value: 'XXL', label: 'XXL (Double XL)' },
            { value: 'custom', label: 'Custom / Di luar standar' },
          ],
          help: 'Boleh dikosongkan jika kostum disewa atau dipinjam. Hanya untuk informasi tambahan.',
        },
      ],
    },
    {
      title: 'Referensi Visual',
      fields: [
        {
          key: 'linkMoodboard',
          label: 'Link Moodboard (Kumpulan Foto Referensi)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
        },
        {
          key: 'linkReferensi',
          label: 'Link Foto Referensi Utama',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
        },
        {
          key: 'catatanKostum',
          label: 'Catatan Kostum (Opsional)',
          type: 'textarea',
          rows: 3,
          placeholder: 'Contoh: Sewa di Toko Kostum Melati, pesan 2 minggu sebelumnya. Butuh fitting H-14.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 10. FACE CHART — MULTI PEMAIN
  // ═══════════════════════════════════════════════════
  'face-chart': [
    {
      title: 'Daftar Pemain dan Desain Rias',
      fields: [
        {
          key: 'daftarPemain',
          label: 'Daftar Pemain (format: Pemain | Karakter | Jenis Rias | Warna Dominan | Palet)',
          type: 'list',
          required: true,
          rows: 10,
          placeholder: 'Andi | Ratu Aji | Korektif | Coklat muda | Base: Coklat 02; Eyeshadow: Emas; Lipstik: Merah bata\nBudi | Raja Tiongkok | Karakter | Kuning keemasan | Base: Kuning 01; Eyeshadow: Emas; Lipstik: Merah tua\nCitra | Dayang Istana | Fantasi | Pink pastel | Base: Pink 01; Eyeshadow: Ungu; Lipstik: Pink muda',
          help: 'Isi 1 baris per pemain. Pisahkan kolom utama dengan " | ". Untuk palet warna, pisahkan item dengan ";". Sistem akan membuat 1 halaman face chart per pemain secara otomatis.',
        },
        {
          key: 'teknikKhusus',
          label: 'Teknik Khusus (berlaku untuk semua pemain, satu per baris)',
          type: 'list',
          rows: 4,
          placeholder: 'Efek luka: bubuk kayu manis dan madu\nPenuaan: shading dan bedak\nEfek air mata: glycerin dan air\nAksen glitter: body glitter',
        },
        {
          key: 'urutanPengerjaan',
          label: 'Urutan Pengerjaan Rias (satu per baris)',
          type: 'list',
          rows: 9,
          placeholder: 'Bersihkan wajah dan aplikasikan primer\nBase dan concealer\nKontur dan highlight\nMata (eyeshadow, eyeliner, bulu mata)\nAlis\nBlush on\nBibir\nSetting spray\nTouch-up terakhir',
        },
      ],
    },
    {
      title: 'Referensi & Higienitas (Berlaku untuk Semua Pemain)',
      fields: [
        {
          key: 'linkMoodboard',
          label: 'Link Moodboard (Kumpulan Foto Referensi)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
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
