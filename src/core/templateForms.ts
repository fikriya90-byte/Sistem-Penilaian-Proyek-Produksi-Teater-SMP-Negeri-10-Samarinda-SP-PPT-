// =====================================================
// FORM DEFINITIONS per template
// Setiap template punya field yang siswa isi dulu di sistem
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

// ═══════════════════════════════════════════════════════
// HELPERS — parse "list" jadi array / tabel
// ═══════════════════════════════════════════════════════
export function parseList(value: any): string[] {
  if (!value) return [];
  return String(value).split('\n').map(l => l.trim()).filter(Boolean);
}

/**
 * Parse list menjadi tabel (rows × cols).
 * Setiap baris di-split dengan " | ".
 * Contoh input:
 *   Dana Tunai | Rp 500.000 | Untuk properti
 *   Bahan kostum | 5 meter | Kain satin
 */
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

// ═══════════════════════════════════════════════════════
// DEFINISI FORM PER TEMPLATE
// ═══════════════════════════════════════════════════════
export const TEMPLATE_FORMS: Record<string, FormSection[]> = {

  // ─── 1. PROPOSAL ─────────────────────────────────
  proposal: [
    {
      title: 'Bagian Naratif',
      fields: [
        { key: 'latarBelakang', label: 'Latar Belakang', type: 'textarea', required: true, rows: 5,
          placeholder: 'Contoh: Teater sebagai media pembelajaran karakter...',
          help: 'Jelaskan mengapa produksi ini penting & relevan dengan pembelajaran.' },
        { key: 'tujuan', label: 'Tujuan (satu per baris)', type: 'list', required: true, rows: 4,
          placeholder: 'Mengasah kemampuan akting siswa\nMemperkenalkan folklor Kalimantan Timur\nMembangun kerja sama tim',
          help: 'Isi minimal 3 tujuan. Setiap baris = 1 tujuan.' },
        { key: 'visiMisi', label: 'Visi & Misi Artistik', type: 'textarea', required: true, rows: 4,
          placeholder: 'Contoh: Penyutradaraan bertumpu pada perpaduan tari tradisi Kutai dengan pencahayaan dramatik...' },
        { key: 'sinopsis', label: 'Sinopsis Lakon', type: 'textarea', required: true, rows: 6,
          placeholder: 'Ringkasan cerita lakon 2-3 paragraf...' },
      ],
    },
    {
      title: 'Data Produksi',
      fields: [
        { key: 'rabTotal', label: 'Total Estimasi RAB', type: 'text', required: true,
          placeholder: 'Contoh: Rp 5.500.000',
          help: 'Lihat total di menu RAB Digital.' },
        { key: 'publikasi', label: 'Rencana Publikasi (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Poster resmi produksi (H-30)\nTeaser video (H-14)\nLiputan hari-H' },
        { key: 'penutup', label: 'Kalimat Penutup', type: 'textarea', rows: 3, required: true,
          placeholder: 'Demikian proposal ini kami susun sebagai acuan pelaksanaan produksi...' },
      ],
    },
  ],

  // ─── 2. SURAT IZIN ───────────────────────────────
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

  // ─── 3. SURAT PERMOHONAN ─────────────────────────
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

  // ─── 4. LPJ ──────────────────────────────────────
  lpj: [
    {
      title: 'Data Pelaksanaan',
      fields: [
        { key: 'tanggalPementasan', label: 'Tanggal Pementasan', type: 'text', required: true,
          placeholder: '20 November 2026' },
        { key: 'tempatPementasan', label: 'Tempat Pementasan', type: 'text', required: true,
          placeholder: 'Aula SMP Negeri 10 Samarinda' },
        { key: 'jumlahPenonton', label: 'Jumlah Penonton', type: 'number', required: true,
          placeholder: '150' },
        { key: 'picName', label: 'PIC / Pimpinan Produksi', type: 'text', required: true,
          placeholder: 'Nama lengkap' },
      ],
    },
    {
      title: 'Laporan Divisi',
      fields: [
        { key: 'laporanDivisi', label: 'Capaian per Divisi (satu baris per divisi)',
          type: 'list', required: true, rows: 7,
          placeholder: 'Pengurus Inti: koordinasi berjalan lancar\nPerlengkapan: semua properti selesai H-3\nPublikasi: poster & teaser rilis tepat waktu\nTata Panggung: set selesai gladi\nTata Rias: face chart diaplikasikan sesuai desain\nTata Busana: fitting akhir selesai H-2\nTata Musik: cue sheet final lengkap',
          help: 'Format bebas, satu baris = satu divisi.' },
      ],
    },
    {
      title: 'Laporan Keuangan (format: Komponen | Estimasi | Realisasi)',
      fields: [
        { key: 'keuangan', label: 'Data Keuangan', type: 'list', required: true, rows: 7,
          placeholder: 'Pemasukan Kas | 3000000 | 3100000\nSumbangan | 500000 | 500000\nProperti | 800000 | 750000\nKostum | 1200000 | 1350000\nKonsumsi | 600000 | 580000\nLain-lain | 400000 | 300000',
          help: 'Satu baris = satu komponen. Format: nama | estimasi | realisasi' },
      ],
    },
    {
      title: 'Evaluasi',
      fields: [
        { key: 'halBerhasil', label: 'Hal yang Berhasil', type: 'textarea', required: true, rows: 4,
          placeholder: 'Contoh: kerja sama tim solid, gladi resik berjalan tepat waktu...' },
        { key: 'kendalaSolusi', label: 'Kendala & Solusi', type: 'textarea', required: true, rows: 4,
          placeholder: 'Contoh: sound system sempat error, diatasi dengan...' },
        { key: 'rekomendasi', label: 'Rekomendasi untuk Produksi Berikutnya', type: 'textarea', rows: 3,
          placeholder: 'Saran perbaikan...' },
        { key: 'lampiran', label: 'Daftar Lampiran (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Dokumentasi foto & video pementasan\nNaskah final\nPrompt book final\nBuku kas & nota-nota\nSertifikat/piagam apresiasi' },
      ],
    },
  ],

  // ─── 5. SKETSA PANGGUNG ──────────────────────────
  'sketsa-panggung': [
    {
      fields: [
        { key: 'konsep', label: 'Konsep Tata Panggung', type: 'textarea', required: true, rows: 4,
          placeholder: 'Gaya realis/stilir, warna dominan, dan kesan yang ingin dibangun...' },
        { key: 'denahZona', label: 'Denah 9 Zona (format: Kode | Deskripsi Penggunaan)',
          type: 'list', rows: 9,
          placeholder: 'UL | pintu masuk aktor\nUC | singgasana\nUR | backdrop istana\nCL | ruang tunggu\nC | area utama dialog\nCR | meja tamu\nDL | tangga panggung\nDC | area sorot\nDR | area konflik',
          help: 'Isi 9 baris sesuai grid 3×3.' },
        { key: 'sketsaLink', label: 'Link Sketsa Visual (Google Drive)', type: 'text',
          placeholder: 'https://drive.google.com/...' },
        { key: 'cueLampu', label: 'Cue Lampu (format: Cue | Posisi | Warna | Adegan)',
          type: 'list', rows: 5,
          placeholder: 'CUE-01 | Spotlight kiri | Kuning hangat | Pembukaan\nCUE-02 | Fill center | Biru redup | Konflik\nCUE-03 | Back light | Putih terang | Resolusi' },
        { key: 'urutanPasang', label: 'Urutan Pasang & Bongkar (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Target pasang set: < 10 menit\nTarget strike: < 5 menit\nTim: 8 orang\nAlat: palu, bor, tangga' },
      ],
    },
  ],

  // ─── 6. PROMPT BOOK ──────────────────────────────
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
          placeholder: '1 | Pembukaan — Prolog | 3 mnt | Narator | DC\n2 | Konflik Pertama | 5 mnt | Ratu + Utusan | C\n3 | Klimaks | 8 mnt | Ensemble | UC\n4 | Resolusi | 6 mnt | Ratu + Rakyat | CL\n5 | Penutup — Epilog | 2 mnt | Ensemble | C' },
      ],
    },
    {
      title: 'Cue Sheet (format: Cue | Trigger | Aksi | Audio | Lampu)',
      fields: [
        { key: 'cueList', label: 'Cue List', type: 'list', required: true, rows: 6,
          placeholder: 'CUE-01 | Opening music mulai | Lampu fade in | Track 01 | Warm spot UC\nCUE-02 | Aktor masuk stage | Spotlight follow | Track 02 | Follow spot\nCUE-03 | Adegan konflik | Lampu merah | Track 03 | Red wash' },
      ],
    },
    {
      title: 'Catatan',
      fields: [
        { key: 'catatanBlocking', label: 'Catatan Blocking Penting', type: 'textarea', rows: 5,
          placeholder: 'Contoh: Ratu tidak turun dari singgasana sampai adegan 3...' },
        { key: 'catatanTeknis', label: 'Catatan Teknis (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Standby ASM di sisi panggung kiri\nSound check wajib 30 menit sebelum opening\nCek cue lampu sebelum adegan 1\nKomunikasi via headset' },
      ],
    },
  ],

  // ─── 7. CUE SHEET MUSIK ──────────────────────────
  'cue-sheet': [
    {
      title: 'Daftar Cue',
      fields: [
        { key: 'cueList', label: 'Cue List (format: Cue | Adegan | Track | In/Out | Durasi | Volume | Link)',
          type: 'list', required: true, rows: 7,
          placeholder: 'CUE-01 | Opening | Overture | In 0:00 | 1:30 | 80% | link1\nCUE-02 | Konflik | Battle Theme | In 0:15 | 2:00 | 75% | link2\nCUE-03 | Penutup | Sape Melankolis | In 0:00 | 2:00 | 70% | link3',
          help: 'Isi baris sesuai urutan adegan. Setiap baris = 1 cue.' },
      ],
    },
    {
      title: 'Operator',
      fields: [
        { key: 'operatorList', label: 'Operator (format: Posisi | Nama)', type: 'list', required: true, rows: 3,
          placeholder: 'Sound Engineer | Nama 1\nMixer Operator | Nama 2\nBackup Operator | Nama 3' },
      ],
    },
    {
      title: 'Checklist Sound Check',
      fields: [
        { key: 'checklist', label: 'Checklist (satu per baris)', type: 'list', rows: 7,
          placeholder: 'Semua mic on & balance\nBacking track tersedia offline\nMixer preset tersimpan\nMonitor speaker & feedback terkontrol\nBackup laptop + USB\nLagu darurat siap\nSound check 30 menit sebelum opening' },
      ],
    },
  ],

  // ─── 8. BREAKDOWN PROPERTI ───────────────────────
  'properti-breakdown': [
    {
      fields: [
        { key: 'propertiList', label: 'Daftar Properti (format: No | Adegan | Nama Properti | Bahan | Qty | Status | PIC)',
          type: 'list', required: true, rows: 10,
          placeholder: '1 | Babak 1 | Singgasana | Kayu + kain | 1 | PROSES | Nama\n2 | Babak 1 | Tongkat kerajaan | Bambu + cat emas | 1 | SELESAI | Nama\n3 | Babak 2 | Keris pusaka | Karton + foil | 1 | BELUM | Nama',
          help: 'Isi semua properti. Status: BELUM / PROSES / SELESAI / RUSAK.' },
        { key: 'catatanPenting', label: 'Catatan Penting (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Semua properti harus aman dipakai di panggung\nUpdate status setiap minggu\nSimpan dengan label per adegan\nFoto progress tiap selesai pembuatan' },
      ],
    },
  ],

  // ─── 9. KOSTUM ───────────────────────────────────
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
          placeholder: 'Kain utama | 3 meter | Putih\nKain furing | 2 meter | Krem\nKancing | 6 pcs | Emas' },
        { key: 'linkMoodboard', label: 'Link Moodboard', type: 'text',
          placeholder: 'https://drive.google.com/...' },
        { key: 'linkReferensi', label: 'Link Foto Referensi', type: 'text' },
      ],
    },
  ],

  // ─── 10. FACE CHART ──────────────────────────────
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
          placeholder: 'Base | Coklat muda | Foundation shade 02\nEyeshadow | Emas + coklat | Palet A\nBlush on | Peach | Blush B\nLipstik | Merah bata | Matte lipstick\nKontur | Coklat tua | Contour stick\nHighlight | Gold shimmer | Highlighter C' },
      ],
    },
    {
      title: 'Teknik & Urutan',
      fields: [
        { key: 'teknikKhusus', label: 'Teknik Khusus (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Efek luka: bubuk kayu manis + madu\nPenuaan: shading + bedak\nEfek air mata: glycerin + air\nAksen glitter: body glitter' },
        { key: 'urutanPengerjaan', label: 'Urutan Pengerjaan (satu per baris)', type: 'list', rows: 9,
          placeholder: 'Bersihkan wajah & aplikasikan primer\nBase & concealer\nKontur & highlight\nMata (eyeshadow, eyeliner, bulu mata)\nAlis\nBlush on\nBibir\nSetting spray\nTouch-up terakhir' },
      ],
    },
    {
      title: 'Referensi & Higienitas',
      fields: [
        { key: 'linkMoodboard', label: 'Link Moodboard', type: 'text' },
        { key: 'linkFaceChart', label: 'Link Face Chart Kosong', type: 'text' },
        { key: 'higienitas', label: 'Catatan Higienitas (satu per baris)', type: 'list', rows: 5,
          placeholder: 'Gunakan spons sekali pakai\nSterilkan kuas sebelum & sesudah\nLakukan tes alergi sebelum hari-H\nSediakan makeup remover di ruang rias' },
      ],
    },
  ],
};

export function getTemplateForm(templateId: string): FormSection[] {
  return TEMPLATE_FORMS[templateId] || [];
}

/**
 * Auto-fill field default dari data kelas yang sudah ada.
 */
export function getDefaultData(_templateId: string): Record<string, any> {
  return {};
}
