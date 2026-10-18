// =====================================================
// FORM DEFINITIONS — bahasa sederhana untuk siswa
// =====================================================

export type FieldType = 'text' | 'textarea' | 'date' | 'time' | 'number' | 'select' | 'list' | 'table';

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  rows?: number;
  // Untuk tipe 'table'
  columns?: string[]; 
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
        { key: 'judulPementasan', label: 'Judul Pementasan', type: 'text', required: true, placeholder: 'Contoh: Mamanda — Petualangan Anak Samarinda', help: 'Judul yang akan ditampilkan di poster dan panggung.' },
        { key: 'jenisTeaterTradisional', label: 'Jenis Teater Tradisional', type: 'text', required: true, placeholder: 'Contoh: Mamanda, Ketoprak, Lenong, atau Ludruk', help: 'Pilih salah satu jenis teater daerah yang akan dipentaskan.' },
        { key: 'namaWaliKelas', label: 'Nama Wali Kelas', type: 'text', placeholder: 'Contoh: Ibu Siti Aminah, S.Pd.', help: 'Akan muncul di lembar tanda tangan pengesahan.' },
        { key: 'namaKepalaSekolah', label: 'Nama Kepala Sekolah', type: 'text', placeholder: 'Contoh: Bapak Drs. Ahmad Yusuf, M.Pd.' },
        { key: 'tanggalPengesahan', label: 'Tanggal Pengesahan', type: 'text', placeholder: 'Contoh: 15 November 2026' },
      ],
    },
    {
      title: 'Alasan dan Tujuan Pementasan',
      fields: [
        { key: 'latarBelakang', label: 'Mengapa Pementasan Ini Penting?', type: 'textarea', required: true, rows: 6, placeholder: 'Contoh: Kami memilih pementasan ini karena ingin memperkenalkan cerita rakyat Kalimantan Timur kepada teman-teman, sekaligus belajar bekerja sama dalam tim produksi.', help: 'Jelaskan dengan bahasa sendiri. Cukup 3-5 kalimat.' },
        { key: 'tujuan', label: 'Apa yang Ingin Dicapai?', type: 'list', required: true, rows: 5, placeholder: 'Mengasah kemampuan akting dan menghafal naskah\nMemperkenalkan cerita rakyat daerah\nMelatih kerja sama dan disiplin', help: 'Tuliskan minimal 3 tujuan. Setiap baris = 1 tujuan.' },
        { key: 'manfaat', label: 'Apa Manfaatnya?', type: 'textarea', required: true, rows: 5, placeholder: 'Untuk siswa: melatih keberanian, disiplin, dan kerja sama.\nUntuk sekolah: menambah kegiatan seni dan budaya.', help: 'Bisa ditulis dari sisi siswa, sekolah, dan pelestarian budaya.' },
      ],
    },
    {
      title: 'Gambaran Pementasan',
      fields: [
        { key: 'gambaranPementasan', label: 'Pementasan Ini Akan Seperti Apa?', type: 'textarea', rows: 5, placeholder: 'Contoh: Pementasan akan berlangsung selama 30 menit dengan gaya tradisional Mamanda.', help: 'Ceritakan pementasan yang kalian bayangkan. Kalau Sutradara sudah isi Visi di menu Produksi, biarkan kosong — akan diambil otomatis.' },
        { key: 'alurCerita', label: 'Alur Cerita Singkat (Opsional)', type: 'textarea', rows: 4, placeholder: 'Awal: ...\nKonflik: ...\nPuncak: ...\nAkhir: ...' },
        { key: 'konsepSederhana', label: 'Pilih Gaya Pementasan', type: 'select', options: [{ value: 'sederhana', label: 'Sederhana' }, { value: 'sedang', label: 'Sedang' }, { value: 'meriah', label: 'Meriah' }], help: 'Setelah dipilih, sistem akan mengisi bagian Konsep Artistik secara otomatis.' },
        { key: 'kataPengantar', label: 'Kata Pengantar', type: 'textarea', rows: 4, placeholder: 'Contoh: Puji syukur kami panjatkan...' },
      ],
    },
    {
      title: 'Catatan Tambahan',
      fields: [
        { key: 'catatanPementasan', label: 'Informasi Pementasan (Opsional)', type: 'textarea', rows: 3, placeholder: 'Contoh: Pementasan akan dilaksanakan di Aula...' },
        { key: 'rabUploadUrl', label: 'Link RAB Final yang Sudah Ditandatangani (Opsional)', type: 'text', placeholder: 'https://drive.google.com/...' },
        { key: 'rabUploadName', label: 'Nama File RAB', type: 'text', placeholder: 'RAB_Final_IX-C.pdf' },
      ],
    },
    {
      title: 'Penutup',
      fields: [
        { key: 'penutup', label: 'Kalimat Penutup', type: 'textarea', required: true, rows: 3, placeholder: 'Demikian proposal ini kami susun...' },
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
          label: 'Daftar Bantuan',
          type: 'table',
          columns: ['Jenis Bantuan', 'Jumlah', 'Keterangan'],
          required: true,
          help: 'Tambahkan baris sesuai bantuan yang diajukan.',
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
        { key: 'kataPengantar', label: 'Kata Pengantar', type: 'textarea', rows: 4, placeholder: 'Contoh: Puji syukur kami panjatkan...' },
        { key: 'latarBelakang', label: 'Mengapa LPJ Ini Dibuat?', type: 'textarea', required: true, rows: 4, placeholder: 'Contoh: Pementasan sudah selesai dilaksanakan...' },
      ],
    },
    {
      title: 'Hasil Pementasan',
      fields: [
        { key: 'jumlahPenonton', label: 'Jumlah Penonton', type: 'number', placeholder: 'Contoh: 150' },
        { key: 'hasilPementasan', label: 'Bagaimana Pementasan Berjalan?', type: 'textarea', required: true, rows: 4, placeholder: 'Contoh: Pementasan berjalan lancar...' },
        {
          key: 'kendalaSolusi',
          label: 'Kendala yang Dihadapi dan Cara Mengatasinya',
          type: 'table',
          columns: ['Kendala', 'Solusi'],
          required: true,
          help: 'Tambahkan baris sesuai kendala yang dihadapi.',
        },
      ],
    },
    {
      title: 'Keuangan (Semua Data Otomatis dari Sistem)',
      fields: [
        { key: 'rabUploadUrl', label: 'Link RAB Final yang Sudah Ditandatangani (Opsional)', type: 'text', placeholder: 'https://drive.google.com/...' },
        { key: 'rabUploadName', label: 'Nama File RAB', type: 'text', placeholder: 'RAB_Final_IX-C.pdf' },
        {
          key: 'realisasiPengeluaran',
          label: 'Realisasi Pengeluaran (Opsional)',
          type: 'table',
          columns: ['Kebutuhan', 'Rencana (Rp)', 'Realisasi (Rp)'],
          help: 'Kosongkan untuk pakai data RAB Digital otomatis.',
        },
      ],
    },
    {
      title: 'Evaluasi & Pembelajaran',
      fields: [
        { key: 'evaluasiKetercapaian', label: 'Apa yang Sudah Berhasil?', type: 'textarea', required: true, rows: 4 },
        { key: 'refleksiTim', label: 'Apa Pelajaran yang Didapat?', type: 'textarea', required: true, rows: 4 },
        { key: 'rekomendasi', label: 'Saran untuk Kegiatan Berikutnya', type: 'textarea', rows: 3 },
      ],
    },
    {
      title: 'Penutup',
      fields: [
        { key: 'penutup', label: 'Kalimat Penutup', type: 'textarea', required: true, rows: 3 },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 5. SKETSA PANGGUNG
  // ═══════════════════════════════════════════════════
  'sketsa-panggung': [
    {
      title: 'Bagian A: Denah Dasar (diisi sekali)',
      fields: [
        { key: 'konsep', label: 'Konsep Tata Panggung', type: 'textarea', required: true, rows: 4, help: '2-4 kalimat. Sebutkan tempat, waktu cerita, bahan utama, dan warna dominan.' },
        {
          key: 'denahZona',
          label: 'Denah 9 Zona (kondisi tetap)',
          type: 'table',
          columns: ['Kode Zona', 'Isi Zona'],
          help: 'Baris atas = belakang panggung (UL, UC, UR), tengah (CL, C, CR), bawah (DL, DC, DR). Kosongkan jika sudah diisi di Prompt Book.',
        },
        { key: 'sketsaLink', label: 'Link Sketsa Visual (Google Drive)', type: 'text', help: 'Akses: "Siapa saja yang memiliki link".' },
      ],
    },
    {
      title: 'Bagian B: Denah per Adegan',
      fields: [
        {
          key: 'denahPerAdegan',
          label: 'Denah per Adegan',
          type: 'table',
          columns: ['Adegan', 'Latar', 'Set Masuk', 'Set Keluar', 'Posisi Awal Aktor', 'Cue Lampu', 'Kru Bergerak', 'Waktu Ganti'],
          required: true,
          help: 'Kerjakan berurutan. Tulis hanya yang berubah dari adegan sebelumnya. Kalau tidak ada perubahan, tulis "-".',
        },
      ],
    },
    {
      title: 'Bagian C: Pasang dan Bongkar per Pergantian',
      fields: [
        {
          key: 'pasangBongkar',
          label: 'Pasang & Bongkar',
          type: 'table',
          columns: ['Pergantian', 'Nama Kru', 'Aksi', 'Target Waktu'],
          help: 'Contoh: Adegan 1 ke 2 | Citra | Bongkar dua properti kecil | 1 menit',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 6. PROMPT BOOK
  // ═══════════════════════════════════════════════════
  'prompt-book': [
    {
      title: 'A. Jadwal dan Stage Manager',
      fields: [
        { key: 'stageManager', label: 'Nama Stage Manager', type: 'text', required: true, help: 'Orang yang memegang jalannya latihan dan pentas di belakang panggung.' },
        { key: 'tanggalMulai', label: 'Tanggal Mulai Latihan', type: 'text', required: true, placeholder: 'Contoh: 1 November 2026' },
      ],
    },
    {
      title: 'B. Daftar Kru',
      fields: [
        {
          key: 'daftarKru',
          label: 'Daftar Kru',
          type: 'table',
          columns: ['Nama', 'Divisi', 'Posisi Standby', 'Jalur Gerak', 'Tugas Utama'],
          required: true,
          help: 'Nama sesuai absen. Satu orang boleh lebih dari satu tugas.',
        },
      ],
    },
    {
      title: 'C. Alat Stage Manager dan Kru',
      fields: [
        {
          key: 'alatStageManager',
          label: 'Alat',
          type: 'table',
          columns: ['Alat', 'Jumlah', 'Dibawa oleh', 'Fungsi'],
          help: 'Alat yang dibawa bergerak di panggung. Setiap baris wajib ada fungsi.',
        },
      ],
    },
    {
      title: 'D. Daftar Adegan',
      fields: [
        {
          key: 'daftarAdegan',
          label: 'Daftar Adegan',
          type: 'table',
          columns: ['Adegan', 'Latar', 'Durasi Perkiraan'],
          required: true,
          help: 'Urutan adegan yang dipakai form Sketsa dan Breakdown Properti.',
        },
      ],
    },
    {
      title: 'E. Catatan Blocking Penting',
      fields: [
        { key: 'catatanBlocking', label: 'Aturan Blocking (satu aturan per baris)', type: 'list', rows: 4, placeholder: 'Ratu tidak turun dari singgasana sampai adegan 3.\nDayang selalu masuk dari pintu kiri belakang.' },
      ],
    },
    {
      title: 'F. Catatan Teknis',
      fields: [
        { key: 'catatanTeknis', label: 'Catatan Teknis (satu per baris)', type: 'list', rows: 4, placeholder: 'Standby stage manager di sisi panggung kiri\nSound check wajib 30 menit sebelum opening' },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 7. CUE SHEET
  // ═══════════════════════════════════════════════════
  'cue-sheet': [
    {
      title: 'Checklist Persiapan Sound Check',
      fields: [
        {
          key: 'checklist',
          label: 'Checklist Persiapan (satu per baris)',
          type: 'list',
          rows: 8,
          placeholder: 'H-1: Backing track tersedia offline di dua perangkat\n30 menit sebelum opening: Sound check semua mic dan balance\nSaat pentas: Lagu darurat siap diputar dari laptop cadangan',
          help: 'Setiap baris harus bisa dijawab "sudah" atau "belum". Urutkan sesuai waktu pengecekan.',
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 8. PROPERTI
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
          placeholder: 'Semua properti harus aman dipakai di panggung\nProperti berat harus diikat atau diberi penyangga',
          help: 'Aturan yang bisa dijalankan dan dicek.',
        },
      ],
    },
    {
      title: 'Penanggung Jawab per Adegan (opsional)',
      fields: [
        {
          key: 'penanggungJawabProperti',
          label: 'Penanggung Jawab Properti',
          type: 'table',
          columns: ['Adegan', 'Properti', 'Penanggung Jawab', 'Posisi Awal'],
          help: 'Nama dari Daftar Kru Prompt Book. Posisi awal properti pakai kode zona (UL sampai DR).',
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
        { key: 'namaKarakter', label: 'Nama Karakter', type: 'text', required: true, placeholder: 'Contoh: Ratu Aji Bidara Putih' },
        { key: 'namaPemain', label: 'Nama Pemeran', type: 'text', required: true, placeholder: 'Nama lengkap siswa sesuai absen' },
        { key: 'peranKarakter', label: 'Peran', type: 'select', required: true, options: [{ value: 'Protagonis', label: 'Protagonis' }, { value: 'Antagonis', label: 'Antagonis' }, { value: 'Pendukung', label: 'Pendukung' }] },
        { key: 'watakKarakter', label: 'Watak Karakter', type: 'text', placeholder: 'Contoh: Tegas, bijaksana, pemberani' },
      ],
    },
    {
      title: 'Konsep Kostum',
      fields: [
        { key: 'warnaDominan', label: 'Warna Dominan', type: 'text', placeholder: 'Contoh: Putih gading' },
        { key: 'warnaSekunder', label: 'Warna Sekunder', type: 'text', placeholder: 'Contoh: Emas' },
        { key: 'siluet', label: 'Bentuk / Siluet', type: 'text', placeholder: 'Contoh: Gaun panjang A-line' },
        { key: 'ornamen', label: 'Ornamen / Aksesoris', type: 'text', placeholder: 'Contoh: Mahkota, kalung' },
        { key: 'perkiraanUkuran', label: 'Perkiraan Ukuran (Opsional)', type: 'select', options: [{ value: '', label: '-- Boleh dikosongkan --' }, { value: 'S', label: 'S' }, { value: 'M', label: 'M' }, { value: 'L', label: 'L' }, { value: 'XL', label: 'XL' }] },
      ],
    },
    {
      title: 'Referensi & Penanggung Jawab',
      fields: [
        { key: 'penanggungJawabKostum', label: 'Penanggung Jawab Kostum', type: 'text', placeholder: 'Nama kru busana' },
        { key: 'linkMoodboard', label: 'Link Moodboard (Google Drive)', type: 'text' },
        { key: 'linkReferensi', label: 'Link Foto Referensi Utama', type: 'text' },
        { key: 'catatanKostum', label: 'Catatan Kostum (Opsional)', type: 'textarea', rows: 3 },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════
  // 10. FACE CHART
  // ═══════════════════════════════════════════════════
  'face-chart': [
    {
      title: 'Daftar Pemeran dan Desain Rias',
      fields: [
        {
          key: 'daftarPemain',
          label: 'Daftar Pemeran',
          type: 'table',
          columns: ['Pemeran', 'Karakter', 'Jenis Rias', 'Warna Dominan', 'Palet', 'Kru rias'],
          required: true,
          help: 'Palet dipisahkan titik koma (;). Kru rias nama dari Daftar Kru Prompt Book.',
        },
        {
          key: 'teknikKhusus',
          label: 'Teknik Khusus (berlaku untuk semua pemeran)',
          type: 'list',
          rows: 4,
          placeholder: 'Efek luka: bubuk kayu manis dan madu\nPenuaan: shading dan bedak',
        },
        {
          key: 'urutanPengerjaan',
          label: 'Urutan Pengerjaan Rias (satu langkah per baris)',
          type: 'list',
          rows: 9,
          placeholder: 'Bersihkan wajah dan aplikasikan primer\nBase dan concealer\nKontur dan highlight\nMata\nAlis\nBlush on\nBibir\nSetting spray\nTouch-up terakhir',
        },
      ],
    },
    {
      title: 'Referensi & Higienitas (Berlaku untuk Semua Pemeran)',
      fields: [
        { key: 'linkMoodboard', label: 'Link Moodboard', type: 'text' },
        {
          key: 'higienitas',
          label: 'Catatan Higienitas (satu per baris)',
          type: 'list',
          rows: 5,
          placeholder: 'Gunakan spons sekali pakai\nSterilkan kuas sebelum dan sesudah dipakai',
        },
      ],
    },
  ],
};

export function getTemplateForm(templateId: string): FormSection[] {
  return TEMPLATE_FORMS[templateId] || [];
}