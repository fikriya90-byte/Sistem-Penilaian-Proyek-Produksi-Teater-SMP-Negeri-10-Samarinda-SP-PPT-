// =====================================================
// FORM DEFINITIONS — bahasa sederhana untuk siswa
// Revisi: sesuai panduan-form-sp-ppt-revisi.md
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
          placeholder: 'Contoh: 15 November 2026',
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
          placeholder: 'Waktu latihan terbatas | Menambah latihan di hari Sabtu\nSound system error saat gladi | Tim musik langsung memperbaiki\nKostum pemeran utama belum selesai | Lembur 2 hari sebelum pementasan',
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
  // Revisi: tambah denah per adegan, ubah urutan pasang jadi pasang & bongkar per pergantian
  // ═══════════════════════════════════════════════════
  'sketsa-panggung': [
    {
      title: 'Bagian A: Denah Dasar (diisi sekali)',
      fields: [
        {
          key: 'konsep',
          label: 'Konsep Tata Panggung',
          type: 'textarea',
          required: true,
          rows: 4,
          placeholder: 'Contoh: Istana Kutai abad ke-16. Latar kayu ulin cokelat tua, kain tenun merah-emas di belakang singgasana, satu tangga tinggi di sisi kanan.',
          help: '2-4 kalimat. Sebutkan tempat, waktu cerita, bahan utama, dan warna dominan.',
        },
        {
          key: 'denahZona',
          label: 'Denah 9 Zona (kondisi tetap) — format: kode | isi zona',
          type: 'list',
          rows: 9,
          placeholder: 'UL | pintu masuk aktor\nUC | singgasana\nUR | backdrop istana\nC | area utama dialog\nDC | area sorot\nDL | area konflik',
          help: 'Baris atas = belakang panggung (UL, UC, UR), tengah (CL, C, CR), bawah (DL, DC, DR). L=kiri, R=kanan dari posisi aktor. Kosongkan jika sudah diisi di Prompt Book.',
        },
        {
          key: 'sketsaLink',
          label: 'Link Sketsa Visual (Google Drive)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'Akses: "Siapa saja yang memiliki link".',
        },
      ],
    },
    {
      title: 'Bagian B: Denah per Adegan',
      fields: [
        {
          key: 'denahPerAdegan',
          label: 'Denah per Adegan — format: Adegan | Latar | Set masuk | Set keluar | Posisi awal aktor | Cue lampu | Kru bergerak | Waktu ganti',
          type: 'list',
          required: true,
          rows: 6,
          placeholder: 'Adegan 1 | Istana, siang | - | - | UC: Ratu; CR: Dayang | CUE-01 | - | -\nAdegan 2 | Hutan, malam | Pohon besar di DL | Singgasana ke UR | DC: Raja | CUE-02 | Andi: singgasana UC ke UR; Budi: pohon masuk DL | 2 menit\nAdegan 3 | Istana, pagi | Singgasana kembali di UC | Pohon di DL keluar | UC: Ratu | CUE-03 | Budi: pohon keluar DL ke kanan belakang; Andi: singgasana kembali ke UC | 3 menit',
          help: 'Kerjakan berurutan. Tulis hanya yang berubah dari adegan sebelumnya. Kalau tidak ada perubahan, tulis "-". Kode zona harus sama dengan Denah Dasar.',
        },
      ],
    },
    {
      title: 'Bagian C: Pasang dan Bongkar per Pergantian',
      fields: [
        {
          key: 'pasangBongkar',
          label: 'Pasang & Bongkar (satu langkah per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Adegan 1 ke 2: Citra bongkar dua properti kecil (target 1 menit)\nAdegan 1 ke 2: Budi pasang pohon besar di DL (target 2 menit)\nAdegan 2 ke 3: Andi pindahkan singgasana ke UC (target 3 menit)',
          help: 'Format: [Pergantian]: [Nama kru] [aksi] (target [waktu]). Nama kru dari Daftar Kru.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 6. PROMPT BOOK (Revisi Lengkap)
  // Revisi: tambah daftar kru, alat stage manager, daftar adegan
  // ═══════════════════════════════════════════════════
  'prompt-book': [
    {
      title: 'A. Jadwal dan Stage Manager',
      fields: [
        {
          key: 'stageManager',
          label: 'Nama Stage Manager',
          type: 'text',
          required: true,
          placeholder: 'Nama lengkap stage manager',
          help: 'Orang yang memegang jalannya latihan dan pentas di belakang panggung. Dia yang memberi aba-aba cue.',
        },
        {
          key: 'tanggalMulai',
          label: 'Tanggal Mulai Latihan',
          type: 'text',
          required: true,
          placeholder: 'Contoh: 1 November 2026',
          help: 'Tanggal latihan pertama, ditulis lengkap.',
        },
      ],
    },
    {
      title: 'B. Daftar Kru (satu per baris)',
      fields: [
        {
          key: 'daftarKru',
          label: 'Daftar Kru — format: Nama | Divisi | Posisi standby | Jalur gerak saat pergantian | Tugas utama',
          type: 'list',
          required: true,
          rows: 8,
          placeholder: 'Andi | Tata Panggung | Sisi kiri belakang | Kiri belakang ke tengah, lewat jalur bawah | Pasang dan bongkar singgasana\nBudi | Tata Panggung | Sisi kanan belakang | Kanan belakang ke DR | Pasang backdrop dan pohon\nCitra | Tata Busana | Ruang ganti kiri | Ruang ganti ke sisi kiri | Pergantian kostum cepat\nDimas | Tata Musik | Ruang operator | Tetap di tempat | Menjalankan cue audio',
          help: 'Nama sesuai absen. Satu orang boleh lebih dari satu tugas — tulis tugas utamanya saja. Data ini dipakai form Sketsa dan Breakdown Properti.',
        },
      ],
    },
    {
      title: 'C. Alat Stage Manager dan Kru (satu per baris)',
      fields: [
        {
          key: 'alatStageManager',
          label: 'Alat — format: Alat | Jumlah | Dibawa oleh | Fungsi',
          type: 'list',
          rows: 6,
          placeholder: 'Headset intercom | 4 | Stage manager, ASM, dua kru | Komunikasi antar posisi tanpa suara panggung\nWalkie-talkie | 3 | Stage manager, kru pergantian | Komunikasi jarak jauh di belakang panggung\nSenter kecil | 2 | Stage manager, kru bawah | Penerangan jalur gerak saat blackout\nStopwatch | 1 | Stage manager | Menghitung waktu pergantian dan durasi adegan\nLakban warna | 1 rol | Kru properti | Penanda posisi di lantai',
          help: 'Alat yang dibawa bergerak di panggung. Setiap baris wajib ada fungsi.',
        },
      ],
    },
    {
      title: 'D. Daftar Adegan (satu per baris)',
      fields: [
        {
          key: 'daftarAdegan',
          label: 'Daftar Adegan — format: Adegan | Latar | Durasi perkiraan',
          type: 'list',
          required: true,
          rows: 6,
          placeholder: 'Adegan 1 | Istana, siang | 6 menit\nAdegan 2 | Hutan, malam | 4 menit\nAdegan 3 | Istana, pagi | 5 menit',
          help: 'Urutan adegan yang dipakai form Sketsa dan Breakdown Properti. Tulis sekali dengan benar.',
        },
      ],
    },
    {
      title: 'E. Catatan Blocking Penting (satu aturan per baris)',
      fields: [
        {
          key: 'catatanBlocking',
          label: 'Aturan Blocking',
          type: 'list',
          rows: 4,
          placeholder: 'Ratu tidak turun dari singgasana sampai adegan 3.\nDayang selalu masuk dari pintu kiri belakang.',
          help: 'Tulis aturan gerak aktor + sebutkan adegannya. Tidak perlu gerakan tiap detik. Hindari deskripsi umum seperti "aktor bergerak bagus".',
        },
      ],
    },
    {
      title: 'F. Catatan Teknis (satu per baris)',
      fields: [
        {
          key: 'catatanTeknis',
          label: 'Catatan Teknis',
          type: 'list',
          rows: 4,
          placeholder: 'Standby stage manager di sisi panggung kiri\nHeadset semua posisi sudah dicek sebelum latihan\nSound check wajib 30 menit sebelum opening\nCek cue lampu sebelum adegan 1',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 7. CUE SHEET (Revisi)
  // Revisi: format checklist dengan timestamp
  // ═══════════════════════════════════════════════════
  'cue-sheet': [
    {
      title: 'Checklist Persiapan Sound Check',
      fields: [
        {
          key: 'checklist',
          label: 'Checklist Persiapan (satu per baris, urutkan sesuai waktu)',
          type: 'list',
          rows: 8,
          placeholder: 'H-1: Backing track tersedia offline di dua perangkat\nH-1: Mixer preset tersimpan dan sudah diuji\nH-1: Baterai walkie-talkie dan headset intercom terisi penuh\n30 menit sebelum opening: Sound check semua mic dan balance\n30 menit sebelum opening: Monitor speaker dan feedback terkontrol\n30 menit sebelum opening: Semua headset terhubung ke stage manager\nSaat pentas: Lagu darurat siap diputar dari laptop cadangan\nSaat pentas: USB cadangan terpasang',
          help: 'Setiap baris harus bisa dijawab "sudah" atau "belum". Urutkan sesuai waktu pengecekan. Daftar cue musik dan operator otomatis dari menu Cue Sheet Musik.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 8. PROPERTI (Revisi)
  // Revisi: tambah penanggung jawab per adegan
  // ═══════════════════════════════════════════════════
  'properti-breakdown': [
    {
      title: 'Catatan Penting',
      fields: [
        {
          key: 'catatanPenting',
          label: 'Catatan Penting (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Semua properti harus aman dipakai di panggung\nProperti berat harus diikat atau diberi penyangga\nProperti yang dibawa bergerak wajib diberi label nama dan adegan\nUpdate status setiap minggu\nFoto progres tiap selesai pembuatan',
          help: 'Aturan yang bisa dijalankan dan dicek. Hindari aturan umum seperti "rapi ya". Daftar properti otomatis dari menu Properti.',
        },
      ],
    },
    {
      title: 'Penanggung Jawab per Adegan (opsional)',
      fields: [
        {
          key: 'penanggungJawabProperti',
          label: 'Penanggung Jawab Properti — format: Adegan | Properti | Penanggung jawab | Posisi awal properti',
          type: 'list',
          rows: 5,
          placeholder: 'Adegan 1 | Singgasana | Andi | UC\nAdegan 2 | Pohon besar | Budi | DL, disimpan di sisi kanan belakang\nAdegan 3 | Surat kerajaan | Citra | Saku kostum Ratu',
          help: 'Nama dari Daftar Kru Prompt Book. Posisi awal properti pakai kode zona (UL sampai DR).',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 9. KOSTUM (Revisi)
  // Revisi: tambah penanggung jawab kostum
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
          help: 'Nama tokoh sesuai naskah.',
        },
        {
          key: 'namaPemain',
          label: 'Nama Pemeran',
          type: 'text',
          required: true,
          placeholder: 'Nama lengkap siswa sesuai absen',
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
          help: '2-3 sifat yang harus terlihat dari kostum.',
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
          help: 'Satu warna utama, sebutkan namanya. Pilih yang kontras dengan latar panggung.',
        },
        {
          key: 'warnaSekunder',
          label: 'Warna Sekunder',
          type: 'text',
          placeholder: 'Contoh: Emas',
          help: 'Warna pendamping untuk ornamen.',
        },
        {
          key: 'siluet',
          label: 'Bentuk / Siluet',
          type: 'text',
          placeholder: 'Contoh: Gaun panjang A-line, baju kurung, dsb.',
          help: 'Jenis pakaian dan potongannya.',
        },
        {
          key: 'ornamen',
          label: 'Ornamen / Aksesoris',
          type: 'text',
          placeholder: 'Contoh: Mahkota, kalung, gelang, ikat pinggang',
          help: 'Hanya yang benar-benar dipakai di panggung.',
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
          help: 'Boleh dikosongkan jika kostum disewa atau dipinjam dengan ukuran sudah pasti.',
        },
      ],
    },
    {
      title: 'Referensi & Penanggung Jawab',
      fields: [
        {
          key: 'penanggungJawabKostum',
          label: 'Penanggung Jawab Kostum',
          type: 'text',
          placeholder: 'Nama kru busana yang memegang kostum ini',
          help: 'Termasuk yang membantu pergantian cepat. Nama dari Daftar Kru Prompt Book.',
        },
        {
          key: 'linkMoodboard',
          label: 'Link Moodboard (Kumpulan Foto Referensi)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'Folder Drive berisi foto referensi. Akses "Siapa saja yang memiliki link".',
        },
        {
          key: 'linkReferensi',
          label: 'Link Foto Referensi Utama',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'Satu foto yang paling mewakili konsep. Foto ini ikut tercetak.',
        },
        {
          key: 'catatanKostum',
          label: 'Catatan Kostum (Opsional)',
          type: 'textarea',
          rows: 3,
          placeholder: 'Contoh: Sewa di Toko Kostum Melati, pesan 2 minggu sebelumnya. Butuh fitting H-14.',
          help: 'Sumber sewa, tanggal fitting, dan kebutuhan khusus. Kalau ada pergantian kostum di tengah adegan, tulis di sini.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 10. FACE CHART (Revisi)
  // Revisi: format daftar pemeran 6 kolom (tambah Kru rias), Referensi & Higienitas gabung
  // ═══════════════════════════════════════════════════
  'face-chart': [
    {
      title: 'Daftar Pemeran dan Desain Rias',
      fields: [
        {
          key: 'daftarPemain',
          label: 'Daftar Pemeran — format: Pemeran | Karakter | Jenis Rias | Warna Dominan | Palet | Kru rias',
          type: 'list',
          required: true,
          rows: 10,
          placeholder: 'Andi | Ratu Aji | Korektif | Coklat muda | Base: Coklat 02; Eyeshadow: Emas; Lipstik: Merah bata | Citra\nBudi | Raja Tiongkok | Karakter | Kuning keemasan | Base: Kuning 01; Eyeshadow: Emas; Lipstik: Merah tua | Dimas\nCitra | Dayang Istana | Fantasi | Pink pastel | Base: Pink 01; Eyeshadow: Ungu; Lipstik: Pink muda | Andi',
          help: 'Satu baris = satu halaman face chart. Kolom Palet dipisahkan titik koma (;). Kru rias nama dari Daftar Kru Prompt Book. Sistem akan membuat 1 halaman per pemeran secara otomatis.',
        },
        {
          key: 'teknikKhusus',
          label: 'Teknik Khusus (berlaku untuk semua pemeran)',
          type: 'list',
          rows: 4,
          placeholder: 'Efek luka: bubuk kayu manis dan madu\nPenuaan: shading dan bedak\nEfek air mata: glycerin dan air\nAksen glitter: body glitter',
          help: 'Semua bahan harus aman untuk kulit. Dilarang memakai darah asli, bahan tajam, atau bahan yang belum diuji.',
        },
        {
          key: 'urutanPengerjaan',
          label: 'Urutan Pengerjaan Rias (satu langkah per baris)',
          type: 'list',
          rows: 9,
          placeholder: 'Bersihkan wajah dan aplikasikan primer\nBase dan concealer\nKontur dan highlight\nMata (eyeshadow, eyeliner, bulu mata)\nAlis\nBlush on\nBibir\nSetting spray\nTouch-up terakhir',
        },
      ],
    },
    {
      title: 'Referensi & Higienitas (Berlaku untuk Semua Pemeran)',
      fields: [
        {
          key: 'linkMoodboard',
          label: 'Link Moodboard (Kumpulan Foto Referensi)',
          type: 'text',
          placeholder: 'https://drive.google.com/...',
          help: 'Folder Drive berisi referensi tampilan wajah. Akses "Siapa saja yang memiliki link".',
        },
        {
          key: 'higienitas',
          label: 'Catatan Higienitas (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Gunakan spons sekali pakai\nSterilkan kuas sebelum dan sesudah dipakai\nLakukan tes alergi H-1 pada area kecil di lengan\nSediakan makeup remover di ruang rias',
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