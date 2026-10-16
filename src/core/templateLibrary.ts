// =====================================================
// TEMPLATE LIBRARY v4 — Auto-populate dari sistem
// =====================================================

import { DOCXBlock, DOCXKopContext, todayLongID } from '../utils/exportDOCX';
import { parseList, parseTable } from './templateForms';
import { UserProfile } from './types';

export type TemplateCategory = 'ADMINISTRASI' | 'ARTISTIK' | 'PRODUKSI';

export interface RABItemLite {
  category: 'DIVISI' | 'PERAN' | 'UMUM';
  targetName: string;
  itemName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  notes?: string;
}

export interface ProductionLite {
  title?: string;
  synopsis?: string;
  theme?: string;
  directorVision?: string;
  performanceDate?: string;
  startDate?: string;
}

export interface ScheduleLite {
  id: string;
  title: string;
  type: string;
  startAt: string;
  endAt: string;
  location: string;
  participants: string;
  description?: string;
}

export interface KasLite {
  title?: string;
  amount?: number;
  periodType?: string;
  amountPaid?: number;   // jumlah uang dari kas siswa
  totalCollected?: number;
  unpaidCount?: number;
}

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
  // ✅ AUTO-SOURCES
  rabItems?: RABItemLite[];
  members?: UserProfile[];
  production?: ProductionLite;
  schedules?: ScheduleLite[];
  kas?: KasLite;
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

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
const v = (data: Record<string, any>, key: string, fallback = '[ ... ]'): string => {
  const val = data?.[key];
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  return String(val);
};

const vList = (data: Record<string, any>, key: string, fallback: string[]): string[] => {
  const arr = parseList(data?.[key]);
  return arr.length > 0 ? arr : fallback;
};

const vTable = (
  data: Record<string, any>,
  key: string,
  colCount: number,
  fallback: string[][]
): string[][] => {
  const rows = parseTable(data?.[key], colCount);
  return rows.length > 0 ? rows : fallback;
};

const fmtRp = (n: number): string => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const findMemberByRole = (members: UserProfile[] | undefined, ...roles: string[]): string => {
  if (!members) return '...........................';
  for (const r of roles) {
    const m = members.find(x => x.role === r);
    if (m) return m.displayName;
  }
  return '...........................';
};

// ═══════════════════════════════════════════════════════
// AUTO-BUILD: Susunan Panitia (dari members)
// ═══════════════════════════════════════════════════════
const JABATAN_MAP: Array<{ role: string; jabatan: string; tugas: string }> = [
  { role: 'Pimpinan Produksi', jabatan: 'Ketua Panitia / Pimpinan Produksi', tugas: 'Memimpin & mengoordinasikan seluruh produksi' },
  { role: 'Sekretaris', jabatan: 'Sekretaris', tugas: 'Administrasi, notulen, arsip, surat-menyurat' },
  { role: 'Bendahara', jabatan: 'Bendahara', tugas: 'Kas produksi, RAB, nota, LPJ keuangan' },
  { role: 'Sutradara', jabatan: 'Sutradara', tugas: 'Visi artistik, casting, penilaian aktor' },
  { role: 'Asisten Sutradara', jabatan: 'Asisten Sutradara / Stage Manager', tugas: 'Prompt book, cue sheet, standby pertunjukan' },
  { role: 'Koordinator Perlengkapan', jabatan: 'Penata Properti & Perlengkapan', tugas: 'Properti, bahan daur ulang, inventaris' },
  { role: 'Koordinator Publikasi', jabatan: 'Penata Publikasi & Dokumentasi', tugas: 'Poster, konten, BTS, aftermovie' },
  { role: 'Koordinator Tata Panggung', jabatan: 'Penata Panggung & Cahaya', tugas: 'Desain set, tata cahaya, konstruksi' },
  { role: 'Koordinator Tata Rias', jabatan: 'Penata Rias', tugas: 'Face chart, rias karakter, higienitas' },
  { role: 'Koordinator Tata Busana', jabatan: 'Penata Kostum & Busana', tugas: 'Desain kostum, fitting, quick change' },
  { role: 'Koordinator Tata Musik', jabatan: 'Penata Musik & Suara', tugas: 'Cue sheet, sound system, instrumen' },
];

function buildSusunanPanitia(members: UserProfile[] | undefined, guruName: string): (string | number)[][] {
  const rows: (string | number)[][] = [];
  let n = 1;

  // Guru pendamping duluan
  rows.push([
    n++,
    'Penanggung Jawab / Guru Pendamping',
    guruName || '...........................',
    'Membimbing & mengawasi jalannya produksi',
  ]);

  JABATAN_MAP.forEach(({ role, jabatan, tugas }) => {
    const nama = findMemberByRole(members, role);
    if (nama && nama !== '...........................') {
      rows.push([n++, jabatan, nama, tugas]);
    }
  });

  return rows;
}

// ═══════════════════════════════════════════════════════
// AUTO-BUILD: Daftar Pemain (dari members)
// ═══════════════════════════════════════════════════════
function buildDaftarPemain(members: UserProfile[] | undefined): (string | number)[][] {
  if (!members) return [['1', '[Nama]', '-', '[Peran]']];
  const pemeran = members.filter(m => m.role === 'Pemeran');
  if (pemeran.length === 0) return [['1', '[Belum ada pemain terdaftar]', '-', '-']];
  return pemeran.map((p, i) => [
    i + 1,
    p.displayName,
    p.className || '-',
    'Pemeran',
  ]);
}

// ═══════════════════════════════════════════════════════
// AUTO-BUILD: Jadwal Produksi (dari schedules)
// ═══════════════════════════════════════════════════════
function buildJadwalProduksi(schedules: ScheduleLite[] | undefined): (string | number)[][] {
  if (!schedules || schedules.length === 0) {
    return [
      ['Praproduksi', '[Kegiatan]', '[Waktu]', '[Tempat]', '[PIC]'],
      ['Latihan', '[Kegiatan]', '[Waktu]', '[Tempat]', '[PIC]'],
      ['Gladi Resik', '[Kegiatan]', '[Waktu]', '[Tempat]', '[PIC]'],
      ['Pementasan', '[Kegiatan]', '[Waktu]', '[Tempat]', '[PIC]'],
    ];
  }

  const sorted = [...schedules].sort((a, b) =>
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  return sorted.map(s => {
    const d = new Date(s.startAt);
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return [
      s.type || '-',
      s.title,
      `${dateStr}, ${timeStr}`,
      s.location || '-',
      s.participants || '-',
    ];
  });
}

// ═══════════════════════════════════════════════════════
// AUTO-BUILD: RAB Section (dari rabItems)
// ═══════════════════════════════════════════════════════
function groupRAB(items: RABItemLite[]): Array<{ category: string; targetName: string; items: RABItemLite[]; subtotal: number }> {
  const groups: Record<string, { category: string; targetName: string; items: RABItemLite[]; subtotal: number }> = {};
  items.forEach(it => {
    const key = `${it.category}__${it.targetName}`;
    if (!groups[key]) {
      groups[key] = { category: it.category, targetName: it.targetName, items: [], subtotal: 0 };
    }
    groups[key].items.push(it);
    groups[key].subtotal += (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
  });
  return Object.values(groups).sort((a, b) => {
    const order: Record<string, number> = { DIVISI: 1, PERAN: 2, UMUM: 3 };
    return (order[a.category] || 9) - (order[b.category] || 9);
  });
}

function buildRABDetailBlocks(ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] {
  const items = ctx.rabItems || [];

  if (items.length === 0) {
    const blocks: DOCXBlock[] = [
      { type: 'paragraph', text: 'Detail RAB belum tersedia di sistem.' },
      { type: 'paragraph', text: 'Silakan buka menu RAB Digital untuk mengisi item-item anggaran. Setelah terisi, RAB akan otomatis muncul di dokumen ini.' },
    ];
    if (data?.rabUploadUrl) {
      blocks.push({ type: 'spacer' });
      blocks.push({ type: 'label', text: 'Lampiran RAB Final (telah ditandatangani):' });
      blocks.push({ type: 'paragraph', text: data.rabUploadName ? `${data.rabUploadName} — ${data.rabUploadUrl}` : String(data.rabUploadUrl) });
    }
    return blocks;
  }

  const grouped = groupRAB(items);
  const grandTotal = grouped.reduce((s, g) => s + g.subtotal, 0);

  // Tabel detail
  const tableRows: (string | number)[][] = [];
  grouped.forEach(g => {
    g.items.forEach(it => {
      const rowTotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
      tableRows.push([
        `${g.category} - ${g.targetName}`,
        it.itemName,
        `${it.qty} ${it.unit}`,
        fmtRp(it.unitPrice),
        fmtRp(rowTotal),
      ]);
    });
  });

  const blocks: DOCXBlock[] = [
    { type: 'label', text: 'A. Rincian Anggaran per Kategori' },
    {
      type: 'table',
      headers: ['Kategori', 'Item', 'Qty', 'Harga Satuan', 'Total'],
      rows: tableRows,
      widths: [1900, 2860, 900, 1700, 2000],
    },
    { type: 'spacer' },
    { type: 'label', text: 'B. Subtotal per Kategori' },
    {
      type: 'bullets',
      items: grouped.map(g =>
        `${g.category} — ${g.targetName}: ${fmtRp(g.subtotal)} (${g.items.length} item)`
      ),
    },
    { type: 'spacer' },
    { type: 'paragraph', text: `GRAND TOTAL RAB: ${fmtRp(grandTotal)}`, bold: true },
  ];

  if (data?.rabCatatan) {
    blocks.push({ type: 'spacer' });
    blocks.push({ type: 'paragraph', text: `Catatan: ${data.rabCatatan}`, italic: true });
  }

  if (data?.rabUploadUrl) {
    blocks.push({ type: 'spacer' });
    blocks.push({ type: 'label', text: 'C. Lampiran RAB Final (telah ditandatangani):' });
    blocks.push({
      type: 'paragraph',
      text: data.rabUploadName
        ? `${data.rabUploadName} — ${data.rabUploadUrl}`
        : String(data.rabUploadUrl),
    });
  }

  return blocks;
}

// ═══════════════════════════════════════════════════════
// AUTO-BUILD: Estimasi Pemasukan (dari Kas)
// ═══════════════════════════════════════════════════════
function buildPemasukanTable(ctx: TemplateContext): (string | number)[][] {
  const rows: (string | number)[][] = [];
  let total = 0;

  if (ctx.kas && ctx.kas.totalCollected !== undefined) {
    rows.push(['1', `Kas Kelas — ${ctx.kas.title || 'Kas Produksi'}`, fmtRp(ctx.kas.totalCollected)]);
    total += ctx.kas.totalCollected;
  }

  rows.push(['2', 'Iuran Siswa (di luar kas)', '[....]']);
  rows.push(['3', 'Sponsor / Donatur', '[....]']);
  rows.push(['4', 'Tiket / Undangan', '[....]']);
  rows.push(['5', 'Sumber lain', '[....]']);
  rows.push(['', 'Total Estimasi Pemasukan', total > 0 ? fmtRp(total) + ' + sumber lain' : '[....]']);

  return rows;
}

// ═══════════════════════════════════════════════════════
// 1. PROPOSAL — FULL AUTO
// ═══════════════════════════════════════════════════════
const buildProposal = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const judulPementasan = data?.judulPementasan || ctx.production?.title || ctx.kerabatKerja || '[JUDUL PEMENTASAN]';
  const jenisTeater = v(data, 'jenisTeaterTradisional', '[Jenis teater tradisional]');
  const sinopsis = data?.sinopsis || ctx.production?.synopsis || '[Tuliskan sinopsis]';
  const waliKelas = v(data, 'waliKelasName', '...........................');
  const kepalaSekolah = v(data, 'kepalaSekolahName', '...........................');
  const tglSah = v(data, 'tanggalPengesahan', todayLongID());

  const susunanPanitia = buildSusunanPanitia(ctx.members, ctx.teacherName);

  // Konsep artistik dari input user (list "Aspek | Deskripsi")
  const konsepArtistikRows = vTable(data, 'konsepArtistik', 2, [
    ['Tata Panggung', '[....]'],
    ['Tata Cahaya', '[....]'],
    ['Tata Suara', '[....]'],
    ['Musik Pengiring', '[....]'],
    ['Kostum', '[....]'],
    ['Rias', '[....]'],
    ['Properti', '[....]'],
    ['Tari/Gerak', '[....]'],
    ['Bahasa/Dialek', '[....]'],
  ]);

  // Jadwal produksi
  const jadwalRows = buildJadwalProduksi(ctx.schedules);

  // RAB
  const rabBlocks = buildRABDetailBlocks(ctx, data);

  // Pemasukan
  const pemasukanRows = buildPemasukanTable(ctx);

  // Total pengeluaran dari RAB
  const grouped = groupRAB(ctx.rabItems || []);
  const grandTotalRAB = grouped.reduce((s, g) => s + g.subtotal, 0);

  return [
    // ═══ COVER ═══
    { type: 'title', text: 'PROPOSAL PRODUKSI TEATER TRADISIONAL' },
    { type: 'subtitle', text: `"${judulPementasan}"`, italic: true },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Disusun oleh:', align: 'center' },
    { type: 'paragraph', text: `Tim Produksi Kelas ${ctx.className}`, align: 'center' },
    { type: 'spacer', count: 3 },
    { type: 'paragraph', text: ctx.schoolName, align: 'center', bold: true },
    { type: 'paragraph', text: `Tahun Pelajaran ${ctx.academicYear}`, align: 'center' },
    { type: 'paragraph', text: `Jenis Teater: ${jenisTeater}`, align: 'center', italic: true },
    { type: 'pagebreak' },

    // ═══ LEMBAR PENGESAHAN ═══
    { type: 'title', text: 'LEMBAR PENGESAHAN' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Proposal kegiatan produksi teater tradisional dengan judul "${judulPementasan}" telah disetujui dan disahkan untuk dilaksanakan oleh Tim Produksi Kelas ${ctx.className} ${ctx.schoolName} pada Tahun Pelajaran ${ctx.academicYear}.`, align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'spacer' },
    {
      type: 'signature',
      signatures: [
        { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
        { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
      ],
    },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Mengetahui / Menyetujui:', align: 'center' },
    { type: 'spacer' },
    {
      type: 'signature',
      signatures: [
        { place: '', date: '', label: `Wali Kelas ${ctx.className},`, name: waliKelas },
        { place: '', date: '', label: 'Guru Mata Pelajaran Seni Budaya,', name: ctx.teacherName },
      ],
    },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Menyetujui,', align: 'center' },
    { type: 'paragraph', text: 'Kepala SMP Negeri 10 Samarinda', align: 'center' },
    { type: 'spacer', count: 3 },
    { type: 'paragraph', text: kepalaSekolah, align: 'center', bold: true, italic: false },
    { type: 'pagebreak' },

    // ═══ KATA PENGANTAR ═══
    { type: 'title', text: 'KATA PENGANTAR' },
    { type: 'paragraph', text: v(data, 'kataPengantar'), align: 'justify' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'paragraph', text: 'Tim Produksi', align: 'right' },
    { type: 'pagebreak' },

    // ═══ BAB I — PENDAHULUAN ═══
    { type: 'heading', text: 'BAB I — PENDAHULUAN' },
    { type: 'subheading', text: '1.1  Latar Belakang' },
    { type: 'paragraph', text: v(data, 'latarBelakang'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '1.2  Rumusan Masalah' },
    { type: 'numbered', items: vList(data, 'rumusanMasalah', [
      'Bagaimana merancang produksi teater tradisional?',
      'Bagaimana melaksanakan pementasan?',
      'Bagaimana mengevaluasi hasil pementasan?',
    ]) },
    { type: 'spacer' },
    { type: 'subheading', text: '1.3  Tujuan Kegiatan' },
    { type: 'numbered', items: vList(data, 'tujuan', ['[Tujuan kegiatan]']) },
    { type: 'spacer' },
    { type: 'subheading', text: '1.4  Manfaat Kegiatan' },
    { type: 'paragraph', text: v(data, 'manfaat'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '1.5  Ruang Lingkup' },
    { type: 'paragraph', text: v(data, 'ruangLingkup', 'Kegiatan mencakup tahap praproduksi, produksi, pementasan, dan pascaproduksi.'), align: 'justify' },
    { type: 'pagebreak' },

    // ═══ BAB II — DESKRIPSI PRODUKSI ═══
    { type: 'heading', text: 'BAB II — DESKRIPSI PRODUKSI' },
    { type: 'subheading', text: '2.1  Nama Kegiatan' },
    { type: 'paragraph', text: `Pementasan Teater Tradisional Kelas ${ctx.className} — "${judulPementasan}"` },
    { type: 'spacer' },
    { type: 'subheading', text: '2.2  Tema' },
    { type: 'paragraph', text: ctx.production?.theme || '[Tema produksi]' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.3  Jenis Teater Tradisional' },
    { type: 'paragraph', text: jenisTeater },
    { type: 'spacer' },
    { type: 'subheading', text: '2.4  Sumber Cerita' },
    { type: 'paragraph', text: v(data, 'sumberCerita', '[Sumber cerita]') },
    { type: 'spacer' },
    { type: 'subheading', text: '2.5  Sinopsis' },
    { type: 'paragraph', text: sinopsis, align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.6  Tokoh dan Penokohan' },
    { type: 'paragraph', text: 'Daftar pemain diambil otomatis dari data kelas:' },
    {
      type: 'table',
      headers: ['No', 'Nama', 'Kelas', 'Peran'],
      rows: buildDaftarPemain(ctx.members),
    },
    { type: 'spacer' },
    { type: 'subheading', text: '2.7  Struktur Dramatik' },
    { type: 'paragraph', text: v(data, 'strukturDramatik', '[Eksposisi, konflik, klimaks, antiklimaks, resolusi]'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.8  Naskah / Skenario' },
    { type: 'paragraph', text: 'Lampirkan naskah atau ringkasan adegan pada bagian lampiran.', italic: true },
    { type: 'spacer' },
    { type: 'subheading', text: '2.9  Konsep Artistik' },
    { type: 'table', headers: ['Aspek', 'Deskripsi'], rows: konsepArtistikRows },
    { type: 'spacer' },
    { type: 'subheading', text: '2.10  Konsep Manajemen' },
    { type: 'table', headers: ['Aspek', 'Keterangan'], rows: [
      ['Sistem Latihan', v(data, 'sistemLatihan', '[....]')],
      ['Publikasi & Dokumentasi', v(data, 'publikasiDok', '[....]')],
      ['Konsumsi & Perlengkapan', v(data, 'konsumsiPerlengkapan', '[....]')],
      ['Sasaran Penonton', v(data, 'sasaranPenonton', '[....]')],
    ]},
    { type: 'spacer' },
    { type: 'subheading', text: '2.11  Susunan Panitia' },
    { type: 'paragraph', text: 'Disusun otomatis dari struktur kepanitiaan yang terdaftar di sistem:', italic: true },
    {
      type: 'table',
      headers: ['No', 'Jabatan', 'Nama', 'Tugas'],
      rows: susunanPanitia,
      widths: [500, 2400, 2500, 3960],
    },
    { type: 'spacer' },
    { type: 'subheading', text: '2.12  Jadwal Produksi' },
    { type: 'paragraph', text: 'Diambil otomatis dari menu Jadwal & Agenda:', italic: true },
    {
      type: 'table',
      headers: ['Tahap/Jenis', 'Kegiatan', 'Waktu', 'Tempat', 'PIC/Peserta'],
      rows: jadwalRows,
      widths: [1300, 2500, 2200, 1800, 1560],
    },
    { type: 'spacer' },
    { type: 'subheading', text: '2.13  Tempat dan Waktu Pelaksanaan' },
    { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
      ['Tempat', ctx.schedules?.find(s => s.type === 'Pementasan')?.location || '[Tempat pementasan]'],
      ['Hari/Tanggal', ctx.production?.performanceDate
        ? new Date(ctx.production.performanceDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : '[Hari, tanggal]'],
      ['Waktu', ctx.schedules?.find(s => s.type === 'Pementasan')
        ? `${new Date(ctx.schedules.find(s => s.type === 'Pementasan')!.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`
        : '[Waktu]'],
      ['Sasaran Penonton', v(data, 'sasaranPenonton', '[Sasaran penonton]')],
    ]},
    { type: 'pagebreak' },

    // ═══ BAB III — RAB ═══
    { type: 'heading', text: 'BAB III — RENCANA ANGGARAN' },
    { type: 'subheading', text: '3.1  Estimasi Pemasukan' },
    {
      type: 'table',
      headers: ['No', 'Sumber Dana', 'Jumlah'],
      rows: pemasukanRows,
    },
    { type: 'spacer' },
    { type: 'subheading', text: '3.2  Estimasi Pengeluaran' },
    ...rabBlocks,
    { type: 'spacer' },
    { type: 'subheading', text: '3.3  Rekapitulasi Anggaran' },
    { type: 'table', headers: ['Uraian', 'Jumlah'], rows: [
      ['Total Estimasi Pemasukan', ctx.kas?.totalCollected ? fmtRp(ctx.kas.totalCollected) + ' + sumber lain' : '[....]'],
      ['Total Estimasi Pengeluaran', grandTotalRAB > 0 ? fmtRp(grandTotalRAB) : '[....]'],
      ['Saldo', grandTotalRAB > 0 && ctx.kas?.totalCollected ? fmtRp(ctx.kas.totalCollected - grandTotalRAB) : '[....]'],
    ]},
    { type: 'pagebreak' },

    // ═══ BAB IV — PENUTUP ═══
    { type: 'heading', text: 'BAB IV — PENUTUP' },
    { type: 'paragraph', text: v(data, 'penutup'), align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    {
      type: 'signature',
      signatures: [
        { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
        { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
      ],
    },
    { type: 'pagebreak' },

    // ═══ LAMPIRAN ═══
    { type: 'heading', text: 'LAMPIRAN PROPOSAL' },
    { type: 'numbered', items: [
      'Susunan acara', 'Naskah / skenario', 'Desain panggung',
      'Desain kostum dan rias', 'Daftar pemain', 'Daftar panitia',
      'Jadwal latihan', 'Surat izin', 'Lembar persetujuan', 'Dokumentasi pendukung',
    ]},
  ];
};

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
    { place: '', date: '', label: 'Hormat kami,\nPimpinan Produksi', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
  ]},
];

// ═══════════════════════════════════════════════════════
// 3. SURAT PERMOHONAN
// ═══════════════════════════════════════════════════════
const buildSuratPermohonan = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const bantuanRows = vTable(data, 'jenisBantuan', 3, [['[Jenis bantuan]', '[Jumlah]', '[Keterangan]']]);

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
      { place: '', date: '', label: 'Hormat kami,\nPimpinan Produksi', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 4. LPJ — FULL AUTO
// ═══════════════════════════════════════════════════════
const buildLPJ = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const judulPementasan = data?.judulPementasan || ctx.production?.title || ctx.kerabatKerja || '[JUDUL PEMENTASAN]';
  const jenisTeater = v(data, 'jenisTeaterTradisional', '[Jenis teater tradisional]');
  const waliKelas = v(data, 'waliKelasName', '...........................');
  const kepalaSekolah = v(data, 'kepalaSekolahName', '...........................');
  const tglSah = v(data, 'tanggalPengesahan', todayLongID());

  const susunanPanitia = buildSusunanPanitia(ctx.members, ctx.teacherName);
  const daftarPemain = buildDaftarPemain(ctx.members);
  const jadwalRows = buildJadwalProduksi(ctx.schedules);

  // Kendala & solusi dari input
  const kendalaRows = vTable(data, 'kendalaSolusi', 2, [
    ['[Kendala 1]', '[Solusi 1]'],
    ['[Kendala 2]', '[Solusi 2]'],
  ]);

  // Pementasan date & place
  const pementasanSched = ctx.schedules?.find(s => s.type === 'Pementasan');
  const hariTanggal = ctx.production?.performanceDate
    ? new Date(ctx.production.performanceDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : pementasanSched
    ? new Date(pementasanSched.startAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '[Hari, tanggal]';
  const waktu = pementasanSched
    ? `${new Date(pementasanSched.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} – ${new Date(pementasanSched.endAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`
    : '[Waktu]';
  const tempat = pementasanSched?.location || '[Tempat]';

  // Keuangan
  const manualPemasukan = parseTable(data?.realisasiPemasukan, 3);
  const manualPengeluaran = parseTable(data?.realisasiPengeluaran, 3);

  // Pemasukan: manual atau auto dari kas
  const pemasukanRows: (string | number)[][] = manualPemasukan.length > 0
    ? manualPemasukan.map((r, i) => {
        const renc = Number(r[1]) || 0;
        const real = Number(r[2]) || 0;
        return [i + 1, r[0], fmtRp(renc), fmtRp(real), fmtRp(real - renc)];
      })
    : [
        ['1', `Kas Kelas — ${ctx.kas?.title || 'Kas Produksi'}`, fmtRp(0), fmtRp(ctx.kas?.totalCollected || 0), fmtRp(ctx.kas?.totalCollected || 0)],
        ['2', 'Iuran Siswa', '[....]', '[....]', '[....]'],
        ['3', 'Sponsor / Donatur', '[....]', '[....]', '[....]'],
        ['4', 'Tiket / Undangan', '[....]', '[....]', '[....]'],
      ];

  // Pengeluaran: manual atau auto dari RAB
  const rabGrouped = groupRAB(ctx.rabItems || []);
  const pengeluaranRows: (string | number)[][] = manualPengeluaran.length > 0
    ? manualPengeluaran.map((r, i) => {
        const renc = Number(r[1]) || 0;
        const real = Number(r[2]) || 0;
        return [i + 1, r[0], fmtRp(renc), fmtRp(real), fmtRp(real - renc), ''];
      })
    : rabGrouped.map((g, i) => [
        i + 1,
        `${g.category} — ${g.targetName}`,
        fmtRp(g.subtotal),
        '-',
        '-',
        '',
      ]);

  const totalPengeluaranRencana = rabGrouped.reduce((s, g) => s + g.subtotal, 0);

  return [
    // ═══ COVER ═══
    { type: 'title', text: 'LAPORAN PERTANGGUNGJAWABAN (LPJ)' },
    { type: 'subtitle', text: 'PRODUKSI TEATER TRADISIONAL' },
    { type: 'subtitle', text: `"${judulPementasan}"`, italic: true },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Disusun oleh:', align: 'center' },
    { type: 'paragraph', text: `Tim Produksi Kelas ${ctx.className}`, align: 'center' },
    { type: 'spacer', count: 3 },
    { type: 'paragraph', text: ctx.schoolName, align: 'center', bold: true },
    { type: 'paragraph', text: `Tahun Pelajaran ${ctx.academicYear}`, align: 'center' },
    { type: 'pagebreak' },

    // ═══ LEMBAR PENGESAHAN ═══
    { type: 'title', text: 'LEMBAR PENGESAHAN' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Laporan Pertanggungjawaban kegiatan produksi teater tradisional dengan judul "${judulPementasan}" telah diterima dan disahkan oleh Tim Produksi Kelas ${ctx.className} ${ctx.schoolName} pada Tahun Pelajaran ${ctx.academicYear}.`, align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'spacer' },
    {
      type: 'signature',
      signatures: [
        { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
        { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
      ],
    },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Mengetahui / Menyetujui:', align: 'center' },
    { type: 'spacer' },
    {
      type: 'signature',
      signatures: [
        { place: '', date: '', label: `Wali Kelas ${ctx.className},`, name: waliKelas },
        { place: '', date: '', label: 'Guru Mata Pelajaran Seni Budaya,', name: ctx.teacherName },
      ],
    },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Menyetujui,', align: 'center' },
    { type: 'paragraph', text: 'Kepala SMP Negeri 10 Samarinda', align: 'center' },
    { type: 'spacer', count: 3 },
    { type: 'paragraph', text: kepalaSekolah, align: 'center', bold: true },
    { type: 'pagebreak' },

    // ═══ KATA PENGANTAR ═══
    { type: 'title', text: 'KATA PENGANTAR' },
    { type: 'paragraph', text: v(data, 'kataPengantar'), align: 'justify' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'paragraph', text: 'Tim Produksi', align: 'right' },
    { type: 'pagebreak' },

    // ═══ BAB I — PENDAHULUAN ═══
    { type: 'heading', text: 'BAB I — PENDAHULUAN' },
    { type: 'subheading', text: '1.1  Latar Belakang' },
    { type: 'paragraph', text: v(data, 'latarBelakang'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '1.2  Dasar Pelaksanaan' },
    { type: 'paragraph', text: v(data, 'dasarPelaksanaan', 'Program praktik seni teater kelas IX dan hasil rapat panitia.'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '1.3  Tujuan' },
    { type: 'paragraph', text: v(data, 'tujuanLPJ', 'Melaporkan pelaksanaan kegiatan dan pertanggungjawaban anggaran.'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '1.4  Ruang Lingkup' },
    { type: 'paragraph', text: v(data, 'ruangLingkup', 'Laporan mencakup tahap praproduksi, latihan, gladi resik, pementasan, dan evaluasi.'), align: 'justify' },
    { type: 'pagebreak' },

    // ═══ BAB II — PELAKSANAAN ═══
    { type: 'heading', text: 'BAB II — PELAKSANAAN KEGIATAN' },
    { type: 'subheading', text: '2.1  Nama Kegiatan' },
    { type: 'paragraph', text: `Pementasan Teater Tradisional Kelas ${ctx.className} — "${judulPementasan}"` },
    { type: 'spacer' },
    { type: 'subheading', text: '2.2  Waktu dan Tempat' },
    { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
      ['Hari/Tanggal', hariTanggal],
      ['Waktu', waktu],
      ['Tempat', tempat],
    ]},
    { type: 'spacer' },
    { type: 'subheading', text: '2.3  Jenis Teater Tradisional' },
    { type: 'paragraph', text: jenisTeater },
    { type: 'spacer' },
    { type: 'subheading', text: '2.4  Susunan Panitia' },
    {
      type: 'table',
      headers: ['No', 'Jabatan', 'Nama', 'Tugas'],
      rows: susunanPanitia,
      widths: [500, 2400, 2500, 3960],
    },
    { type: 'spacer' },
    { type: 'subheading', text: '2.5  Peserta' },
    {
      type: 'table',
      headers: ['No', 'Nama', 'Kelas', 'Peran'],
      rows: daftarPemain,
    },
    { type: 'spacer' },
    { type: 'subheading', text: '2.6  Tahapan Pelaksanaan' },
    { type: 'table', headers: ['Tahap', 'Kegiatan', 'Waktu', 'Tempat'], rows: jadwalRows.slice(0, 4).map(r => [r[0], r[1], r[2], r[3]]) },
    { type: 'spacer' },
    { type: 'subheading', text: '2.7  Hasil Pementasan' },
    { type: 'paragraph', text: v(data, 'hasilPementasan'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.8  Kendala dan Solusi' },
    { type: 'table', headers: ['No', 'Kendala', 'Solusi'], rows: kendalaRows.map((r, i) => [i + 1, r[0], r[1]]) },
    { type: 'pagebreak' },

    // ═══ BAB III — REALISASI ANGGARAN ═══
    { type: 'heading', text: 'BAB III — REALISASI ANGGARAN' },
    { type: 'subheading', text: '3.1  Pemasukan' },
    { type: 'table', headers: ['No', 'Sumber Dana', 'Rencana', 'Realisasi', 'Selisih'], rows: pemasukanRows },
    { type: 'spacer' },
    { type: 'subheading', text: '3.2  Pengeluaran' },
    { type: 'table', headers: ['No', 'Kebutuhan', 'Rencana', 'Realisasi', 'Selisih', 'Keterangan'], rows: pengeluaranRows },
    { type: 'spacer' },
    { type: 'subheading', text: '3.3  Rekapitulasi' },
    { type: 'table', headers: ['Uraian', 'Jumlah'], rows: [
      ['Total Pemasukan (rencana)', fmtRp(ctx.kas?.totalCollected || 0)],
      ['Total Pengeluaran (rencana)', fmtRp(totalPengeluaranRencana)],
      ['Saldo Rencana', fmtRp((ctx.kas?.totalCollected || 0) - totalPengeluaranRencana)],
    ]},
    { type: 'spacer' },
    { type: 'subheading', text: '3.4  Bukti Pengeluaran' },
    { type: 'paragraph', text: 'Lampirkan bukti pengeluaran pada bagian lampiran LPJ.', italic: true },
    ...(data?.rabUploadUrl
      ? [
          { type: 'spacer' as const },
          { type: 'label' as const, text: 'Lampiran RAB Final (telah ditandatangani):' },
          {
            type: 'paragraph' as const,
            text: data.rabUploadName
              ? `${data.rabUploadName} — ${data.rabUploadUrl}`
              : String(data.rabUploadUrl),
          },
        ]
      : []),
    { type: 'pagebreak' },

    // ═══ BAB IV — EVALUASI & REFLEKSI ═══
    { type: 'heading', text: 'BAB IV — EVALUASI DAN REFLEKSI' },
    { type: 'subheading', text: '4.1  Evaluasi Ketercapaian' },
    { type: 'paragraph', text: v(data, 'evaluasiKetercapaian'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '4.2  Refleksi Siswa / Tim' },
    { type: 'paragraph', text: v(data, 'refleksiTim'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '4.3  Rekomendasi' },
    { type: 'paragraph', text: v(data, 'rekomendasi', '[Rekomendasi untuk kegiatan berikutnya]'), align: 'justify' },
    { type: 'pagebreak' },

    // ═══ BAB V — PENUTUP ═══
    { type: 'heading', text: 'BAB V — PENUTUP' },
    { type: 'paragraph', text: v(data, 'penutup'), align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    {
      type: 'signature',
      signatures: [
        { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
        { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
      ],
    },
    { type: 'pagebreak' },

    // ═══ LAMPIRAN ═══
    { type: 'heading', text: 'LAMPIRAN LPJ' },
    { type: 'numbered', items: vList(data, 'lampiran', [
      'Daftar hadir panitia', 'Daftar hadir pemain', 'Daftar hadir latihan',
      'Notula rapat', 'Jadwal kegiatan', 'Dokumentasi pementasan',
      'Bukti pengeluaran', 'Surat menyurat', 'Lembar penilaian',
      'Daftar inventaris', 'Susunan acara', 'Naskah / skenario',
      'Desain artistik', 'Form evaluasi', 'Lain-lain',
    ]) },
  ];
};

// ═══════════════════════════════════════════════════════
// 5-10. Template lain (tidak berubah)
// ═══════════════════════════════════════════════════════
const buildSketsaPanggung = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const zonaRows = vTable(data, 'denahZona', 2, [
    ['UL', '[Upstage Left]'], ['UC', '[Upstage Center]'], ['UR', '[Upstage Right]'],
    ['CL', '[Center Left]'], ['C', '[Center]'], ['CR', '[Center Right]'],
    ['DL', '[Downstage Left]'], ['DC', '[Downstage Center]'], ['DR', '[Downstage Right]'],
  ]);
  const cueRows = vTable(data, 'cueLampu', 4, [['CUE-01', '[posisi]', '[warna]', '[adegan]']]);

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
    { type: 'bullets', items: vList(data, 'urutanPasang', ['Target pasang set: < 10 menit', 'Target strike: < 5 menit']) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Panggung', name: findMemberByRole(ctx.members, 'Koordinator Tata Panggung') },
    ]},
  ];
};

const buildPromptBook = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const adeganRows = vTable(data, 'daftarAdegan', 5, [['1', '[Adegan]', '[Durasi]', '[Pemain]', '[Zona]']]);
  const cueRows = vTable(data, 'cueList', 5, [['CUE-01', '[trigger]', '[aksi]', '[audio]', '[lampu]']]);

  return [
    { type: 'title', text: 'PROMPT BOOK — BUKU SUTRADARA' },
    { type: 'subtitle', text: ctx.kerabatKerja ? `"${ctx.kerabatKerja}"` : '[Nama Produksi]' },
    { type: 'spacer', count: 2 },
    { type: 'heading', text: 'A. IDENTITAS' },
    { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
      ['Produksi', ctx.kerabatKerja || '[Nama Produksi]'],
      ['Sutradara', data?.sutradara || findMemberByRole(ctx.members, 'Sutradara')],
      ['Asisten Sutradara', data?.asisten || findMemberByRole(ctx.members, 'Asisten Sutradara')],
      ['Stage Manager', data?.stageManager || '-'],
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
    { type: 'bullets', items: vList(data, 'catatanTeknis', ['Standby ASM di sisi panggung kiri']) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Sutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Asisten Sutradara', name: findMemberByRole(ctx.members, 'Asisten Sutradara') },
    ]},
  ];
};

const buildCueSheet = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const cueRows = vTable(data, 'cueList', 7, [['CUE-01', '[adegan]', '[track]', '[in/out]', '[durasi]', '[volume]', '[link]']]);
  const opRows = vTable(data, 'operatorList', 2, [['Sound Engineer', '[Nama]']]);

  return [
    { type: 'title', text: 'CUE SHEET — TATA MUSIK & SUARA' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },
    { type: 'heading', text: 'A. DAFTAR CUE' },
    { type: 'table', headers: ['Cue', 'Adegan', 'Track', 'In/Out', 'Durasi', 'Volume', 'Link'], rows: cueRows, widths: [900, 1400, 1500, 1100, 1000, 1000, 2460] },
    { type: 'spacer' },
    { type: 'heading', text: 'B. OPERATOR' },
    { type: 'table', headers: ['Posisi', 'Nama'], rows: opRows },
    { type: 'spacer' },
    { type: 'heading', text: 'C. CHECKLIST SOUND CHECK' },
    { type: 'bullets', items: vList(data, 'checklist', ['Semua mic on & balance']) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Sutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Musik', name: findMemberByRole(ctx.members, 'Koordinator Tata Musik') },
    ]},
  ];
};

const buildProperti = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const rows = vTable(data, 'propertiList', 7, [['1', '[adegan]', '[nama]', '[bahan]', '1', 'BELUM', '[PIC]']]);
  return [
    { type: 'title', text: 'BREAKDOWN PROPERTI PER ADEGAN' },
    { type: 'subtitle', text: `Kelas ${ctx.className} — ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },
    { type: 'table', headers: ['No', 'Adegan', 'Nama Properti', 'Bahan', 'Qty', 'Status', 'PIC'], rows, widths: [500, 1600, 1800, 1600, 600, 1200, 2060] },
    { type: 'spacer' },
    { type: 'heading', text: 'CATATAN PENTING' },
    { type: 'bullets', items: vList(data, 'catatanPenting', ['Semua properti harus aman dipakai di panggung']) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nPimpinan Produksi', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
      { place: '', date: '', label: 'Koordinator Perlengkapan', name: findMemberByRole(ctx.members, 'Koordinator Perlengkapan') },
    ]},
  ];
};

const buildKostum = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const bahanRows = vTable(data, 'bahanList', 3, [['[Bahan]', '[Jumlah]', '[Warna]']]);
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
    { type: 'bullets', items: ['☐ Desain', '☐ Potong', '☐ Jahit', '☐ Fitting', '☐ Selesai'] },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Busana', name: findMemberByRole(ctx.members, 'Koordinator Tata Busana') },
    ]},
  ];
};

const buildFaceChart = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const paletRows = vTable(data, 'paletList', 3, [['[Area]', '[Warna]', '[Produk]']]);
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
      'Bersihkan wajah & aplikasikan primer', 'Base & concealer',
      'Kontur & highlight', 'Mata', 'Alis', 'Blush on', 'Bibir', 'Setting spray', 'Touch-up terakhir',
    ]) },
    { type: 'spacer' },
    { type: 'heading', text: 'E. REFERENSI VISUAL' },
    { type: 'paragraph', text: `Moodboard: ${v(data, 'linkMoodboard', '-')}` },
    { type: 'paragraph', text: `Face chart kosong: ${v(data, 'linkFaceChart', '-')}` },
    { type: 'spacer' },
    { type: 'heading', text: 'F. CATATAN HIGIENITAS' },
    { type: 'bullets', items: vList(data, 'higienitas', ['Gunakan spons sekali pakai', 'Sterilkan kuas sebelum & sesudah']) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Rias', name: findMemberByRole(ctx.members, 'Koordinator Tata Rias') },
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
    description: 'Proposal lengkap — susunan panitia, daftar pemain, jadwal, & RAB otomatis dari sistem. Anda hanya isi narasi & tanda tangan.',
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
    description: 'Surat permohonan bantuan dana/barang/sponsorship ke pihak eksternal.',
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
    description: 'LPJ lengkap — susunan panitia, daftar pemain, jadwal, & RAB otomatis dari sistem + tabel realisasi.',
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
    description: 'Buku sutradara — daftar adegan, cue sheet, catatan blocking.',
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
    description: 'Desain rias — palet warna, teknik khusus, urutan pengerjaan.',
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
