// =====================================================
// TEMPLATE LIBRARY v3 — Form-driven DOCX generation
// =====================================================

import { DOCXBlock, DOCXKopContext, todayLongID } from '../utils/exportDOCX';
import { parseList, parseTable } from './templateForms';

export type TemplateCategory = 'ADMINISTRASI' | 'ARTISTIK' | 'PRODUKSI';

export interface TemplateContext {
  className: string;
  kerabatKerja?: string;
  academicYear: string;
  teacherName: string;
  totalStudents: number;
  schoolName: string;
  schoolAddress: string;
  schoolEmail?: string;
  schoolPhone?: string;
}

export interface TemplateDef {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  color: string;
  allowedRoles: string[];
  withKop: boolean;
  buildBlocks: (ctx: TemplateContext, data: Record<string, any>) => DOCXBlock[];
}

const DEFAULT_SCHOOL_ADDRESS = 'Jl. Pendidikan No. 10, Samarinda, Kalimantan Timur 75123';

const makeKop = (ctx: TemplateContext): DOCXKopContext => ({
  schoolName: ctx.schoolName || 'SMP NEGERI 10 SAMARINDA',
  schoolAddress: ctx.schoolAddress || DEFAULT_SCHOOL_ADDRESS,
  schoolEmail: ctx.schoolEmail || 'info@smpn10samarinda.sch.id',
  schoolPhone: ctx.schoolPhone || '(0541) 123456',
  kerabatKerja: ctx.kerabatKerja,
  className: ctx.className,
  academicYear: ctx.academicYear,
  logoKiriLabel: '[ LOGO SEKOLAH ]',
  logoKananLabel: '[ LOGO KERABAT ]',
});

export const buildKopFor = makeKop;

// Helper: ambil string atau fallback
const v = (data: Record<string, any>, key: string, fallback = '[ ... ]'): string => {
  const val = data?.[key];
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  return String(val);
};

// Helper: list atau fallback
const vList = (data: Record<string, any>, key: string, fallback: string[]): string[] => {
  const arr = parseList(data?.[key]);
  return arr.length > 0 ? arr : fallback;
};

// Helper: table rows
const vTable = (
  data: Record<string, any>,
  key: string,
  colCount: number,
  fallback: string[][]
): string[][] => {
  const rows = parseTable(data?.[key], colCount);
  return rows.length > 0 ? rows : fallback;
};

// ═══════════════════════════════════════════════════════
// 1. PROPOSAL
// ═══════════════════════════════════════════════════════
const buildProposal = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => [
  { type: 'title', text: 'PROPOSAL PRODUKSI SENI TEATER' },
  { type: 'subtitle', text: ctx.kerabatKerja ? `"${ctx.kerabatKerja}"` : '[Nama Produksi]' },
  { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
  { type: 'spacer', count: 2 },

  { type: 'heading', text: 'I. PENDAHULUAN' },
  { type: 'label', text: '1.1  Latar Belakang' },
  { type: 'paragraph', text: v(data, 'latarBelakang') },
  { type: 'spacer' },
  { type: 'label', text: '1.2  Rumusan Tujuan' },
  { type: 'numbered', items: vList(data, 'tujuan', [
    '[Tujuan artistik produksi]',
    '[Tujuan pembelajaran Seni Budaya]',
    '[Tujuan sosial membangun kebersamaan tim]',
  ]) },
  { type: 'spacer' },

  { type: 'heading', text: 'II. VISI & MISI ARTISTIK' },
  { type: 'paragraph', text: v(data, 'visiMisi') },
  { type: 'spacer' },

  { type: 'heading', text: 'III. SINOPSIS LAKON' },
  { type: 'paragraph', text: v(data, 'sinopsis') },
  { type: 'spacer' },

  { type: 'heading', text: 'IV. STRUKTUR KEPANITIAAN' },
  { type: 'paragraph', text: `Produksi ini melibatkan ${ctx.totalStudents} siswa ${ctx.className} yang terbagi dalam 7 divisi kepanitiaan:` },
  { type: 'bullets', items: [
    'Pengurus Inti — Pimpinan Produksi, Sekretaris, Bendahara',
    'Pemeran — Sutradara, Asisten Sutradara, Aktor/Aktris',
    'Perlengkapan — properti & inventaris',
    'Publikasi & Dokumentasi — poster, konten, BTS, aftermovie',
    'Tata Panggung — desain set, tata cahaya, konstruksi',
    'Tata Rias — face chart, karakter, higienitas alat',
    'Tata Busana — desain kostum, fitting, quick change',
    'Tata Musik & Suara — cue sheet, sound system',
  ]},
  { type: 'paragraph', text: 'Bagan struktur organisasi lengkap terlampir di halaman terpisah.' },
  { type: 'spacer' },

  { type: 'heading', text: 'V. RENCANA PRODUKSI' },
  { type: 'label', text: '5.1  Tahapan Produksi' },
  { type: 'table', headers: ['Tahap', 'Deskripsi', 'Durasi', 'Bobot'], rows: [
    ['Persiapan', 'Riset, naskah, casting, desain konsep', '~4 minggu', '20%'],
    ['Pelaksanaan', 'Latihan rutin, produksi properti & kostum', '~8 minggu', '35%'],
    ['Pertunjukan', 'Gladi resik, pementasan utama', '~2 minggu', '30%'],
    ['Pasca', 'Evaluasi, LPJ, dokumentasi akhir', '~2 minggu', '15%'],
  ]},
  { type: 'spacer' },
  { type: 'label', text: '5.2  Master Timeline' },
  { type: 'paragraph', text: '[Lampirkan timeline lengkap dari menu Master Timeline di sistem SP-PPT.]' },
  { type: 'spacer' },

  { type: 'heading', text: 'VI. RENCANA ANGGARAN BIAYA' },
  { type: 'paragraph', text: `Total estimasi anggaran: ${v(data, 'rabTotal')}` },
  { type: 'paragraph', text: '[Lampirkan tabel RAB dari menu RAB Digital di sistem SP-PPT.]' },
  { type: 'spacer' },

  { type: 'heading', text: 'VII. RENCANA PUBLIKASI' },
  { type: 'bullets', items: vList(data, 'publikasi', [
    'Poster resmi produksi (H-30)',
    'Teaser video (H-14)',
    'Liputan hari-H & aftermovie',
  ]) },
  { type: 'spacer' },

  { type: 'heading', text: 'VIII. PENUTUP' },
  { type: 'paragraph', text: v(data, 'penutup') },
  { type: 'spacer', count: 2 },
  { type: 'signature', signatures: [
    { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nGuru Pengampu', name: ctx.teacherName },
    { place: '', date: '', label: 'Dibuat oleh,\nPimpinan Produksi', name: '...........................' },
  ]},
];

// ═══════════════════════════════════════════════════════
// 2. SURAT IZIN
// ═══════════════════════════════════════════════════════
const buildSuratIzin = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => [
  { type: 'paragraph', text: `Samarinda, ${todayLongID()}`, align: 'right' },
  { type: 'spacer' },
  { type: 'label', text: `Nomor       : ${v(data, 'nomorSurat')}` },
  { type: 'label', text: 'Lampiran    : 1 (satu) berkas' },
  { type: 'label', text: 'Perihal     : Permohonan Izin Kegiatan' },
  { type: 'spacer' },
  { type: 'paragraph', text: 'Kepada Yth.' },
  { type: 'paragraph', text: 'Kepala SMP Negeri 10 Samarinda' },
  { type: 'paragraph', text: 'di — Samarinda' },
  { type: 'spacer' },
  { type: 'paragraph', text: 'Dengan hormat,' },
  { type: 'paragraph', text: `Sehubungan dengan pelaksanaan produksi seni teater ${ctx.kerabatKerja ? `"${ctx.kerabatKerja}" ` : ''}siswa-siswi kelas ${ctx.className} SMP Negeri 10 Samarinda, kami mengajukan permohonan izin untuk melaksanakan kegiatan sebagai berikut:` },
  { type: 'spacer' },
  { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
    ['Nama Kegiatan', v(data, 'namaKegiatan')],
    ['Hari / Tanggal', v(data, 'hariTanggal')],
    ['Waktu', `${v(data, 'waktuMulai', '-')} s.d. ${v(data, 'waktuSelesai', '-')} WITA`],
    ['Tempat', v(data, 'tempat')],
    ['Peserta', `Siswa kelas ${ctx.className} (${ctx.totalStudents} orang)`],
    ['Penanggung Jawab', v(data, 'penanggungJawab')],
    ['Pembimbing', ctx.teacherName],
  ]},
  { type: 'spacer' },
  { type: 'paragraph', text: 'Demikian surat permohonan ini kami sampaikan. Atas perhatian dan izin yang diberikan, kami ucapkan terima kasih.' },
  { type: 'spacer', count: 2 },
  { type: 'signature', signatures: [
    { place: '', date: '', label: 'Mengetahui,\nGuru Pengampu', name: ctx.teacherName },
    { place: '', date: '', label: 'Hormat kami,\nPimpinan Produksi', name: '...........................' },
  ]},
];

// ═══════════════════════════════════════════════════════
// 3. SURAT PERMOHONAN
// ═══════════════════════════════════════════════════════
const buildSuratPermohonan = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const bantuanRows = vTable(data, 'jenisBantuan', 3, [
    ['[Jenis bantuan]', '[Jumlah]', '[Keterangan]'],
  ]);

  return [
    { type: 'paragraph', text: `Samarinda, ${todayLongID()}`, align: 'right' },
    { type: 'spacer' },
    { type: 'label', text: `Nomor       : ${v(data, 'nomorSurat')}` },
    { type: 'label', text: 'Lampiran    : 1 (satu) berkas' },
    { type: 'label', text: 'Perihal     : Permohonan Bantuan' },
    { type: 'spacer' },
    { type: 'paragraph', text: 'Kepada Yth.' },
    { type: 'paragraph', text: v(data, 'namaInstansi') },
    { type: 'paragraph', text: `di — ${v(data, 'alamatInstansi', 'Tempat')}` },
    { type: 'spacer' },
    { type: 'paragraph', text: 'Dengan hormat,' },
    { type: 'paragraph', text: `Dalam rangka mendukung kegiatan produksi seni teater siswa kelas ${ctx.className} SMP Negeri 10 Samarinda, kami bermaksud mengajukan permohonan bantuan sebagai berikut:` },
    { type: 'spacer' },
    { type: 'table', headers: ['Jenis Bantuan', 'Jumlah', 'Keterangan'], rows: bantuanRows },
    { type: 'spacer' },
    { type: 'paragraph', text: 'Bantuan dapat disalurkan dalam bentuk apa pun yang Bapak/Ibu anggap sesuai. Kami bersedia memberikan laporan tertulis penggunaan bantuan setelah kegiatan selesai.' },
    ...(data?.narasiTambahan ? [{ type: 'paragraph' as const, text: v(data, 'narasiTambahan') }] : []),
    { type: 'paragraph', text: 'Demikian permohonan ini kami sampaikan. Atas perhatian dan bantuan Bapak/Ibu, kami ucapkan terima kasih.' },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: '', date: '', label: 'Mengetahui,\nGuru Pengampu', name: ctx.teacherName },
      { place: '', date: '', label: 'Hormat kami,\nPimpinan Produksi', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 4. LPJ
// ═══════════════════════════════════════════════════════
const buildLPJ = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const keuanganRows = vTable(data, 'keuangan', 3, [
    ['[Komponen]', '0', '0'],
  ]);
  // tabel keuangan LPJ butuh 4 kolom (Komponen, Estimasi, Realisasi, Selisih)
  const keuanganRows4 = keuanganRows.map(r => {
    const est = Number(r[1]) || 0;
    const real = Number(r[2]) || 0;
    return [r[0], est.toLocaleString('id-ID'), real.toLocaleString('id-ID'), (real - est).toLocaleString('id-ID')];
  });

  return [
    { type: 'title', text: 'LAPORAN PERTANGGUNGJAWABAN (LPJ)' },
    { type: 'subtitle', text: ctx.kerabatKerja ? `"${ctx.kerabatKerja}"` : '[Nama Produksi]' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. RINGKASAN PELAKSANAAN' },
    { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
      ['Nama Produksi', ctx.kerabatKerja || '[Nama Produksi]'],
      ['Kelas', ctx.className],
      ['Tanggal Pementasan', v(data, 'tanggalPementasan')],
      ['Tempat', v(data, 'tempatPementasan')],
      ['Jumlah Penonton', `${v(data, 'jumlahPenonton', '0')} orang`],
      ['PIC', v(data, 'picName')],
    ]},
    { type: 'spacer' },

    { type: 'heading', text: 'B. LAPORAN PER DIVISI' },
    { type: 'bullets', items: vList(data, 'laporanDivisi', [
      'Pengurus Inti: [capaian & kendala]',
      'Perlengkapan: [capaian & kendala]',
      'Publikasi & Dokumentasi: [capaian & kendala]',
      'Tata Panggung: [capaian & kendala]',
      'Tata Rias: [capaian & kendala]',
      'Tata Busana: [capaian & kendala]',
      'Tata Musik & Suara: [capaian & kendala]',
    ]) },
    { type: 'spacer' },

    { type: 'heading', text: 'C. LAPORAN KEUANGAN' },
    { type: 'table', headers: ['Komponen', 'Estimasi (Rp)', 'Realisasi (Rp)', 'Selisih (Rp)'], rows: keuanganRows4 },
    { type: 'spacer' },

    { type: 'heading', text: 'D. EVALUASI & PEMBELAJARAN' },
    { type: 'label', text: 'D.1  Hal yang Berhasil' },
    { type: 'paragraph', text: v(data, 'halBerhasil') },
    { type: 'spacer' },
    { type: 'label', text: 'D.2  Kendala & Solusi' },
    { type: 'paragraph', text: v(data, 'kendalaSolusi') },
    { type: 'spacer' },
    { type: 'label', text: 'D.3  Rekomendasi untuk Produksi Berikutnya' },
    { type: 'paragraph', text: v(data, 'rekomendasi') },
    { type: 'spacer' },

    { type: 'heading', text: 'E. LAMPIRAN' },
    { type: 'numbered', items: vList(data, 'lampiran', [
      'Dokumentasi foto & video pementasan',
      'Naskah final',
      'Prompt book final',
      'Buku kas & nota-nota',
      'Sertifikat/piagam apresiasi',
    ]) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nGuru Pengampu', name: ctx.teacherName },
      { place: '', date: '', label: 'Pimpinan Produksi', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 5. SKETSA PANGGUNG
// ═══════════════════════════════════════════════════════
const buildSketsaPanggung = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const zonaRows = vTable(data, 'denahZona', 2, [
    ['UL', '[Upstage Left]'],
    ['UC', '[Upstage Center]'],
    ['UR', '[Upstage Right]'],
    ['CL', '[Center Left]'],
    ['C',  '[Center]'],
    ['CR', '[Center Right]'],
    ['DL', '[Downstage Left]'],
    ['DC', '[Downstage Center]'],
    ['DR', '[Downstage Right]'],
  ]);
  const cueRows = vTable(data, 'cueLampu', 4, [
    ['CUE-01', '[posisi]', '[warna]', '[adegan]'],
  ]);

  return [
    { type: 'title', text: 'SKETSA & DENAH PANGGUNG' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. KONSEP TATA PANGGUNG' },
    { type: 'paragraph', text: v(data, 'konsep') },
    { type: 'spacer' },

    { type: 'heading', text: 'B. DENAH 9 ZONA PANGGUNG' },
    { type: 'table', headers: ['Kode', 'Deskripsi Penggunaan'], rows: zonaRows },
    { type: 'spacer' },

    { type: 'heading', text: 'C. SKETSA VISUAL PANGGUNG' },
    { type: 'paragraph', text: 'Lampirkan gambar sketsa panggung pada link berikut:' },
    { type: 'paragraph', text: v(data, 'sketsaLink', 'Link sketsa: _________________________') },
    { type: 'spacer' },

    { type: 'heading', text: 'D. TATA CAHAYA' },
    { type: 'table', headers: ['Cue', 'Posisi', 'Warna', 'Adegan'], rows: cueRows },
    { type: 'spacer' },

    { type: 'heading', text: 'E. URUTAN PEMASANGAN & PEMBONGKARAN' },
    { type: 'bullets', items: vList(data, 'urutanPasang', [
      'Target pasang set: < 10 menit',
      'Target strike: < 5 menit',
    ]) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: '...........................' },
      { place: '', date: '', label: 'Koordinator Tata Panggung', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 6. PROMPT BOOK
// ═══════════════════════════════════════════════════════
const buildPromptBook = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const adeganRows = vTable(data, 'daftarAdegan', 5, [
    ['1', '[Adegan]', '[Durasi]', '[Pemain]', '[Zona]'],
  ]);
  const cueRows = vTable(data, 'cueList', 5, [
    ['CUE-01', '[trigger]', '[aksi]', '[audio]', '[lampu]'],
  ]);

  return [
    { type: 'title', text: 'PROMPT BOOK — BUKU SUTRADARA' },
    { type: 'subtitle', text: ctx.kerabatKerja ? `"${ctx.kerabatKerja}"` : '[Nama Produksi]' },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. IDENTITAS' },
    { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
      ['Produksi', ctx.kerabatKerja || '[Nama Produksi]'],
      ['Sutradara', v(data, 'sutradara')],
      ['Asisten Sutradara', v(data, 'asisten')],
      ['Stage Manager', v(data, 'stageManager')],
      ['Tanggal Mulai', v(data, 'tanggalMulai')],
      ['Durasi Target', '30 menit'],
    ]},
    { type: 'spacer' },

    { type: 'heading', text: 'B. DAFTAR ADEGAN' },
    { type: 'table', headers: ['No', 'Adegan', 'Durasi', 'Pemain', 'Zona'], rows: adeganRows },
    { type: 'spacer' },

    { type: 'heading', text: 'C. CUE SHEET — AUDIO & LIGHTING' },
    { type: 'table', headers: ['Cue', 'Trigger', 'Aksi', 'Audio', 'Lampu'], rows: cueRows },
    { type: 'spacer' },

    { type: 'heading', text: 'D. CATATAN BLOCKING PENTING' },
    { type: 'paragraph', text: v(data, 'catatanBlocking') },
    { type: 'spacer' },

    { type: 'heading', text: 'E. CATATAN TEKNIS' },
    { type: 'bullets', items: vList(data, 'catatanTeknis', [
      'Standby ASM di sisi panggung kiri',
      'Sound check 30 menit sebelum opening',
    ]) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Sutradara', name: '...........................' },
      { place: '', date: '', label: 'Asisten Sutradara', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 7. CUE SHEET
// ═══════════════════════════════════════════════════════
const buildCueSheet = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const cueRows = vTable(data, 'cueList', 7, [
    ['CUE-01', '[adegan]', '[track]', '[in/out]', '[durasi]', '[volume]', '[link]'],
  ]);
  const opRows = vTable(data, 'operatorList', 2, [
    ['Sound Engineer', '[Nama]'],
  ]);

  return [
    { type: 'title', text: 'CUE SHEET — TATA MUSIK & SUARA' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. DAFTAR CUE' },
    { type: 'table',
      headers: ['Cue', 'Adegan', 'Track', 'In/Out', 'Durasi', 'Volume', 'Link'],
      rows: cueRows,
      widths: [900, 1400, 1500, 1100, 1000, 1000, 2460],
    },
    { type: 'spacer' },

    { type: 'heading', text: 'B. OPERATOR' },
    { type: 'table', headers: ['Posisi', 'Nama'], rows: opRows },
    { type: 'spacer' },

    { type: 'heading', text: 'C. CHECKLIST SOUND CHECK' },
    { type: 'bullets', items: vList(data, 'checklist', [
      'Semua mic on & balance',
      'Backing track tersedia offline',
    ]) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Sutradara', name: '...........................' },
      { place: '', date: '', label: 'Koordinator Tata Musik', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 8. PROPERTI
// ═══════════════════════════════════════════════════════
const buildProperti = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const rows = vTable(data, 'propertiList', 7, [
    ['1', '[adegan]', '[nama]', '[bahan]', '1', 'BELUM', '[PIC]'],
  ]);

  return [
    { type: 'title', text: 'BREAKDOWN PROPERTI PER ADEGAN' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'table',
      headers: ['No', 'Adegan', 'Nama Properti', 'Bahan', 'Qty', 'Status', 'PIC'],
      rows,
      widths: [500, 1600, 1800, 1600, 600, 1200, 2060],
    },
    { type: 'spacer' },

    { type: 'heading', text: 'CATATAN PENTING' },
    { type: 'bullets', items: vList(data, 'catatanPenting', [
      'Semua properti harus aman dipakai di panggung',
      'Update status properti setiap minggu',
    ]) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nPimpinan Produksi', name: '...........................' },
      { place: '', date: '', label: 'Koordinator Perlengkapan', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 9. KOSTUM
// ═══════════════════════════════════════════════════════
const buildKostum = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const bahanRows = vTable(data, 'bahanList', 3, [
    ['[Bahan]', '[Jumlah]', '[Warna]'],
  ]);

  return [
    { type: 'title', text: 'DESAIN KOSTUM PER KARAKTER' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. IDENTITAS KARAKTER' },
    { type: 'table', headers: ['Field', 'Keterangan'], rows: [
      ['Nama Karakter', v(data, 'namaKarakter')],
      ['Nama Pemain', v(data, 'namaPemain')],
      ['Peran', v(data, 'peranKarakter')],
      ['Zaman/Suku', v(data, 'zaman', '-')],
      ['Watak', v(data, 'watak', '-')],
    ]},
    { type: 'spacer' },

    { type: 'heading', text: 'B. KONSEP KOSTUM' },
    { type: 'table', headers: ['Elemen', 'Deskripsi'], rows: [
      ['Warna Dominan', v(data, 'warnaDominan', '-')],
      ['Warna Sekunder', v(data, 'warnaSekunder', '-')],
      ['Tekstur/Bahan', v(data, 'tekstur', '-')],
      ['Siluet', v(data, 'siluet', '-')],
      ['Ornamen/Aksesoris', v(data, 'ornamen', '-')],
    ]},
    { type: 'spacer' },

    { type: 'heading', text: 'C. UKURAN PEMAKAI (cm)' },
    { type: 'table', headers: ['Bagian', 'Ukuran'], rows: [
      ['Lingkar Dada (LD)', v(data, 'ld', '-')],
      ['Lingkar Pinggang (LP)', v(data, 'lp', '-')],
      ['Lingkar Pinggul (LPG)', v(data, 'lpg', '-')],
      ['Panjang Baju (PB)', v(data, 'pb', '-')],
      ['Panjang Celana/Rok (PC)', v(data, 'pc', '-')],
      ['Lebar Bahu', v(data, 'lebarBahu', '-')],
      ['Panjang Lengan', v(data, 'panjangLengan', '-')],
    ]},
    { type: 'spacer' },

    { type: 'heading', text: 'D. KEBUTUHAN BAHAN' },
    { type: 'table', headers: ['Bahan', 'Jumlah', 'Warna'], rows: bahanRows },
    { type: 'spacer' },

    { type: 'heading', text: 'E. REFERENSI VISUAL' },
    { type: 'paragraph', text: `Moodboard: ${v(data, 'linkMoodboard', '-')}` },
    { type: 'paragraph', text: `Foto referensi: ${v(data, 'linkReferensi', '-')}` },
    { type: 'spacer' },

    { type: 'heading', text: 'F. STATUS PRODUKSI' },
    { type: 'bullets', items: [
      '☐ Desain (belum dikerjakan)', '☐ Potong', '☐ Jahit', '☐ Fitting', '☐ Selesai',
    ]},
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: '...........................' },
      { place: '', date: '', label: 'Koordinator Tata Busana', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 10. FACE CHART
// ═══════════════════════════════════════════════════════
const buildFaceChart = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const paletRows = vTable(data, 'paletList', 3, [
    ['[Area]', '[Warna]', '[Produk]'],
  ]);

  return [
    { type: 'title', text: 'FACE CHART — DESAIN RIAS KARAKTER' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. IDENTITAS' },
    { type: 'table', headers: ['Field', 'Keterangan'], rows: [
      ['Nama Pemain', v(data, 'namaPemain')],
      ['Nama Karakter', v(data, 'namaKarakter')],
      ['Jenis Rias', v(data, 'jenisRias')],
      ['Tingkat Kesulitan', v(data, 'tingkatKesulitan', '-')],
    ]},
    { type: 'spacer' },

    { type: 'heading', text: 'B. PALET WARNA' },
    { type: 'table', headers: ['Area', 'Warna', 'Produk'], rows: paletRows },
    { type: 'spacer' },

    { type: 'heading', text: 'C. TEKNIK KHUSUS' },
    { type: 'bullets', items: vList(data, 'teknikKhusus', ['[Teknik khusus]']) },
    { type: 'spacer' },

    { type: 'heading', text: 'D. URUTAN PENGERJAAN' },
    { type: 'numbered', items: vList(data, 'urutanPengerjaan', [
      'Bersihkan wajah & aplikasikan primer',
      'Base & concealer',
      'Kontur & highlight',
      'Mata (eyeshadow, eyeliner, bulu mata)',
      'Alis',
      'Blush on',
      'Bibir',
      'Setting spray',
      'Touch-up terakhir',
    ]) },
    { type: 'spacer' },

    { type: 'heading', text: 'E. REFERENSI VISUAL' },
    { type: 'paragraph', text: `Moodboard: ${v(data, 'linkMoodboard', '-')}` },
    { type: 'paragraph', text: `Face chart kosong: ${v(data, 'linkFaceChart', '-')}` },
    { type: 'spacer' },

    { type: 'heading', text: 'F. CATATAN HIGIENITAS' },
    { type: 'bullets', items: vList(data, 'higienitas', [
      'Gunakan spons sekali pakai',
      'Sterilkan kuas sebelum & sesudah',
    ]) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: '...........................' },
      { place: '', date: '', label: 'Koordinator Tata Rias', name: '...........................' },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════
export const TEMPLATE_LIBRARY: TemplateDef[] = [
  {
    id: 'proposal',
    title: 'Proposal Produksi Seni Teater',
    shortTitle: 'Proposal',
    description: 'Dokumen pengajuan produksi — latar belakang, visi artistik, sinopsis, struktur, timeline, RAB, penutup. Ada kop surat.',
    category: 'ADMINISTRASI',
    icon: 'FileText',
    color: 'amber',
    allowedRoles: ['Pimpinan Produksi', 'Sekretaris', 'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'],
    withKop: true,
    buildBlocks: buildProposal,
  },
  {
    id: 'surat-izin',
    title: 'Surat Izin Kegiatan',
    shortTitle: 'Surat Izin',
    description: 'Surat permohonan izin resmi ke Kepala Sekolah. Ada kop surat.',
    category: 'ADMINISTRASI',
    icon: 'FileText',
    color: 'blue',
    allowedRoles: ['Sekretaris', 'Pimpinan Produksi', 'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'],
    withKop: true,
    buildBlocks: buildSuratIzin,
  },
  {
    id: 'surat-permohonan',
    title: 'Surat Permohonan Bantuan / Sponsorship',
    shortTitle: 'Surat Bantuan',
    description: 'Surat permohonan bantuan dana/barang/sponsorship ke pihak eksternal. Ada kop surat.',
    category: 'ADMINISTRASI',
    icon: 'FileText',
    color: 'emerald',
    allowedRoles: ['Sekretaris', 'Bendahara', 'Pimpinan Produksi', 'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'],
    withKop: true,
    buildBlocks: buildSuratPermohonan,
  },
  {
    id: 'lpj',
    title: 'Laporan Pertanggungjawaban (LPJ)',
    shortTitle: 'LPJ',
    description: 'LPJ akhir produksi — ringkasan, laporan divisi, keuangan, evaluasi, lampiran. Ada kop surat.',
    category: 'ADMINISTRASI',
    icon: 'FileCheck',
    color: 'purple',
    allowedRoles: ['Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'],
    withKop: true,
    buildBlocks: buildLPJ,
  },
  {
    id: 'sketsa-panggung',
    title: 'Sketsa & Denah Panggung',
    shortTitle: 'Sketsa Panggung',
    description: 'Desain panggung — denah 9 zona, cue lampu, urutan pasang/bongkar.',
    category: 'ARTISTIK',
    icon: 'Layers',
    color: 'purple',
    allowedRoles: ['Koordinator Tata Panggung', 'Anggota Tata Panggung', 'Pimpinan Produksi', 'Guru Pengampu', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildSketsaPanggung,
  },
  {
    id: 'prompt-book',
    title: 'Prompt Book — Buku Sutradara',
    shortTitle: 'Prompt Book',
    description: 'Buku sutradara — daftar adegan, cue sheet, catatan blocking, catatan teknis.',
    category: 'ARTISTIK',
    icon: 'BookOpen',
    color: 'rose',
    allowedRoles: ['Sutradara', 'Asisten Sutradara', 'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildPromptBook,
  },
  {
    id: 'cue-sheet',
    title: 'Cue Sheet — Tata Musik & Suara',
    shortTitle: 'Cue Sheet',
    description: 'Daftar cue audio, operator, dan checklist sound check.',
    category: 'ARTISTIK',
    icon: 'Music',
    color: 'cyan',
    allowedRoles: ['Koordinator Tata Musik', 'Anggota Tata Musik', 'Asisten Sutradara', 'Sutradara', 'Guru Pengampu', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildCueSheet,
  },
  {
    id: 'properti-breakdown',
    title: 'Breakdown Properti per Adegan',
    shortTitle: 'Breakdown Properti',
    description: 'Daftar properti per adegan — bahan, qty, status, PIC.',
    category: 'PRODUKSI',
    icon: 'Package',
    color: 'blue',
    allowedRoles: ['Koordinator Perlengkapan', 'Anggota Perlengkapan', 'Pimpinan Produksi', 'Guru Pengampu', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildProperti,
  },
  {
    id: 'kostum-karakter',
    title: 'Desain Kostum per Karakter',
    shortTitle: 'Desain Kostum',
    description: 'Desain kostum — identitas karakter, ukuran, bahan, referensi.',
    category: 'ARTISTIK',
    icon: 'Scissors',
    color: 'indigo',
    allowedRoles: ['Koordinator Tata Busana', 'Anggota Tata Busana', 'Pimpinan Produksi', 'Guru Pengampu', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildKostum,
  },
  {
    id: 'face-chart',
    title: 'Face Chart — Desain Rias Karakter',
    shortTitle: 'Face Chart',
    description: 'Desain rias — palet warna, teknik khusus, urutan pengerjaan, higienitas.',
    category: 'ARTISTIK',
    icon: 'Palette',
    color: 'pink',
    allowedRoles: ['Koordinator Tata Rias', 'Anggota Tata Rias', 'Pimpinan Produksi', 'Guru Pengampu', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildFaceChart,
  },
];

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; color: string }[] = [
  { id: 'ADMINISTRASI', label: 'Administrasi', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'ARTISTIK',     label: 'Artistik',     color: 'bg-pink-100 text-pink-800 border-pink-300' },
  { id: 'PRODUKSI',     label: 'Produksi',     color: 'bg-blue-100 text-blue-800 border-blue-300' },
];

export function getTemplateById(id: string): TemplateDef | undefined {
  return TEMPLATE_LIBRARY.find(t => t.id === id);
}
