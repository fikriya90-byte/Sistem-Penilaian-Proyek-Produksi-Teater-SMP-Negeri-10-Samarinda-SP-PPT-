// =====================================================
// TEMPLATE LIBRARY v7 — REVISI SESUAI PANDUAN FINAL
// Semua builder sudah disesuaikan dengan:
// - Istilah "Pemain" → "Pemeran"
// - Prompt Book: tambah daftar kru, alat, adegan
// - Sketsa Panggung: denah per adegan + pasang/bongkar per pergantian
// - Properti: penanggung jawab per adegan
// - Kostum: penanggung jawab kostum
// - Face Chart: 6 kolom (tambah Kru rias), Referensi & Higienitas gabung
// - Cue Sheet: checklist bertimestamp (H-1, 30 menit, Saat pentas)
// =====================================================

import { DOCXBlock, DOCXKopContext, todayLongID } from '../utils/exportDOCX';
import { parseList, parseTable } from './templateForms';
import { UserProfile } from './types';

export type TemplateCategory = 'ADMINISTRASI' | 'ARTISTIK' | 'PRODUKSI';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
export interface RABItemLite {
  category: string;
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
  totalCollected?: number;
  amountPaid?: number;
}

export interface CashEntryLite {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  targetName: string;
  itemName: string;
  qty: number;
  unit: string;
  amount: number;
  notes?: string;
  date: string;
  creatorName?: string;
}

export interface AttendanceSessionLite {
  id: string;
  title: string;
  date: string;
  activityType: string;
  targetScope: string;
}

export interface AttendanceRecordLite {
  sessionId: string;
  studentId: string;
  studentName: string;
  role: string;
  status: string;
  timestamp?: string;
  note?: string;
}

export interface PropertyLite {
  id: string;
  name: string;
  scene?: string;
  material?: string;
  status?: string;
  condition?: string;
  pic?: string;
  notes?: string;
}

export interface CostumeLite {
  id: string;
  characterName: string;
  playerName: string;
  costumeType: string;
  colors?: string;
  texture?: string;
  accessories?: string;
  status?: string;
  notes?: string;
}

export interface FaceChartLite {
  id: string;
  playerName: string;
  characterName: string;
  riasType: string;
  notes?: string;
  moodboardUrl?: string;
  faceChartUrl?: string;
}

export interface MusicCueLite {
  id: string;
  scene: string;
  cueType: string;
  title: string;
  audioUrl?: string;
  volume?: number;
  duration?: string;
  notes?: string;
}

export interface PromptBookLite {
  id: string;
  scene: string;
  gridPositions?: Record<string, string>;
  notes?: string;
  cues?: Array<{ code: string; action: string; timing: string; soundLight?: string }>;
}

export interface NotulensiLite {
  id: string;
  title: string;
  date: string;
  location?: string;
  agenda?: string;
}

export interface DocumentLite {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  uploaderName?: string;
  createdAt: string;
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
  rabItems?: RABItemLite[];
  members?: UserProfile[];
  production?: ProductionLite;
  schedules?: ScheduleLite[];
  kas?: KasLite;
  cashEntries?: CashEntryLite[];
  attendanceSessions?: AttendanceSessionLite[];
  attendanceRecords?: AttendanceRecordLite[];
  properties?: PropertyLite[];
  costumes?: CostumeLite[];
  faceCharts?: FaceChartLite[];
  musicCues?: MusicCueLite[];
  promptBooks?: PromptBookLite[];
  notulensi?: NotulensiLite[];
  documents?: DocumentLite[];
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
const fmtDate = (iso: string): string => {
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '-'; }
};

const findMemberByRole = (members: UserProfile[] | undefined, ...roles: string[]): string => {
  if (!members) return '...........................';
  for (const r of roles) {
    const m = members.find(x => x.role === r);
    if (m) return m.displayName;
  }
  return '...........................';
};

// ═══════════════════════════════════════════════════════
// AUTO: SUSUNAN PANITIA
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
// AUTO: DAFTAR Pemeran
// ═══════════════════════════════════════════════════════
function buildDaftarPemain(members: UserProfile[] | undefined): (string | number)[][] {
  if (!members) return [['1', '[Nama]', '-', '[Peran]']];
  const pemeran = members.filter(m => m.role === 'Pemeran');
  if (pemeran.length === 0) return [['1', '[Belum ada pemeran terdaftar]', '-', '-']];
  return pemeran.map((p, i) => [i + 1, p.displayName, p.className || '-', 'Pemeran']);
}

// ═══════════════════════════════════════════════════════
// AUTO: JADWAL PRODUKSI
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
  const sorted = [...schedules].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return sorted.map(s => [
    s.type || '-',
    s.title,
    `${fmtDate(s.startAt)}, ${new Date(s.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
    s.location || '-',
    s.participants || '-',
  ]);
}

// ═══════════════════════════════════════════════════════
// AUTO: RAB
// ═══════════════════════════════════════════════════════
function groupRAB(items: RABItemLite[]) {
  const groups: Record<string, { category: string; targetName: string; items: RABItemLite[]; subtotal: number }> = {};
  items.forEach(it => {
    const key = `${it.category}__${it.targetName}`;
    if (!groups[key]) groups[key] = { category: it.category, targetName: it.targetName, items: [], subtotal: 0 };
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
      blocks.push({ type: 'paragraph', text: data.rabUploadName ? `${data.rabUploadName} - ${data.rabUploadUrl}` : String(data.rabUploadUrl) });
    }
    return blocks;
  }

  const grouped = groupRAB(items);
  const grandTotal = grouped.reduce((s, g) => s + g.subtotal, 0);

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
    { type: 'table', headers: ['Kategori', 'Item', 'Qty', 'Harga Satuan', 'Total'], rows: tableRows, widths: [1900, 2860, 900, 1700, 2000] },
    { type: 'spacer' },
    { type: 'label', text: 'B. Subtotal per Kategori' },
    { type: 'bullets', items: grouped.map(g => `${g.category} - ${g.targetName}: ${fmtRp(g.subtotal)} (${g.items.length} item)`) },
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
    blocks.push({ type: 'paragraph', text: data.rabUploadName ? `${data.rabUploadName} - ${data.rabUploadUrl}` : String(data.rabUploadUrl) });
  }
  return blocks;
}

// ═══════════════════════════════════════════════════════
// AUTO: DAFTAR HADIR
// ═══════════════════════════════════════════════════════
function buildDaftarHadirBlock(ctx: TemplateContext): DOCXBlock[] {
  const sessions = ctx.attendanceSessions || [];
  const records = ctx.attendanceRecords || [];

  if (sessions.length === 0 || records.length === 0) {
    return [
      { type: 'label', text: 'Daftar Hadir Panitia & Pemeran' },
      { type: 'paragraph', text: 'Belum ada data presensi di sistem. Silakan buka menu Presensi untuk mencatat kehadiran.' },
      { type: 'spacer' },
    ];
  }

  const blocks: DOCXBlock[] = [
    { type: 'label', text: `Rekap Kehadiran (${sessions.length} sesi, ${records.length} entri)` },
    { type: 'spacer' },
  ];

  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  recentSessions.forEach(sess => {
    const sessRecs = records.filter(r => r.sessionId === sess.id);
    if (sessRecs.length === 0) return;

    const hadir = sessRecs.filter(r => r.status === 'Hadir').length;
    const izin = sessRecs.filter(r => r.status === 'Izin').length;
    const sakit = sessRecs.filter(r => r.status === 'Sakit').length;
    const alpa = sessRecs.filter(r => r.status === 'Alpa').length;

    blocks.push({
      type: 'paragraph',
      text: `${sess.title} (${fmtDate(sess.date)}, ${sess.activityType}): Hadir ${hadir}, Izin ${izin}, Sakit ${sakit}, Alpa ${alpa} - Total ${sessRecs.length} peserta`,
    });
  });

  blocks.push({ type: 'spacer' });
  blocks.push({ type: 'label', text: 'Rekap Kehadiran per Siswa' });

  const byStudent: Record<string, { name: string; role: string; hadir: number; izin: number; sakit: number; alpa: number }> = {};
  records.forEach(r => {
    if (!byStudent[r.studentId]) {
      byStudent[r.studentId] = { name: r.studentName, role: r.role, hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    }
    if (r.status === 'Hadir') byStudent[r.studentId].hadir++;
    else if (r.status === 'Izin') byStudent[r.studentId].izin++;
    else if (r.status === 'Sakit') byStudent[r.studentId].sakit++;
    else if (r.status === 'Alpa') byStudent[r.studentId].alpa++;
  });

  const rekapRows = Object.values(byStudent).map((s, i) => {
    const total = s.hadir + s.izin + s.sakit + s.alpa;
    const pct = total > 0 ? Math.round((s.hadir / total) * 100) : 0;
    return [i + 1, s.name, s.role, s.hadir, s.izin, s.sakit, s.alpa, `${pct}%`];
  });

  if (rekapRows.length > 0) {
    blocks.push({
      type: 'table',
      headers: ['No', 'Nama', 'Peran', 'Hadir', 'Izin', 'Sakit', 'Alpa', '%'],
      rows: rekapRows,
      widths: [400, 2400, 1600, 800, 800, 800, 800, 760],
    });
  }

  blocks.push({ type: 'spacer' });
  return blocks;
}

// ═══════════════════════════════════════════════════════
// AUTO: BUKTI PENGELUARAN
// ═══════════════════════════════════════════════════════
function buildBuktiPengeluaranBlock(ctx: TemplateContext): DOCXBlock[] {
  const entries = ctx.cashEntries || [];
  if (entries.length === 0) {
    return [
      { type: 'paragraph', text: 'Belum ada entri Buku Kas di sistem. Bukti pengeluaran akan otomatis muncul setelah Bendahara mencatat transaksi di menu Kas & Buku Kas.', italic: true },
      { type: 'spacer' },
    ];
  }

  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const rows = sorted.map((e, i) => {
    const total = (Number(e.qty) || 0) * (Number(e.amount) || 0);
    return [
      i + 1,
      fmtDate(e.date),
      e.type === 'INCOME' ? 'Masuk' : 'Keluar',
      e.itemName,
      `${e.qty} ${e.unit}`,
      fmtRp(total),
      e.notes || '-',
    ];
  });

  const totalMasuk = entries.filter(e => e.type === 'INCOME').reduce((s, e) => s + (Number(e.qty) || 0) * (Number(e.amount) || 0), 0);
  const totalKeluar = entries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + (Number(e.qty) || 0) * (Number(e.amount) || 0), 0);
  const saldo = totalMasuk - totalKeluar;

  return [
    { type: 'label', text: `Buku Kas (${entries.length} transaksi tercatat)` },
    { type: 'spacer' },
    {
      type: 'table',
      headers: ['No', 'Tanggal', 'Jenis', 'Item', 'Qty', 'Nominal', 'Catatan'],
      rows,
      widths: [400, 1400, 900, 2400, 1000, 1660, 1600],
    },
    { type: 'spacer' },
    { type: 'bullets', items: [
      `Total Pemasukan: ${fmtRp(totalMasuk)}`,
      `Total Pengeluaran: ${fmtRp(totalKeluar)}`,
      `Saldo: ${fmtRp(saldo)}`,
    ]},
    { type: 'spacer' },
  ];
}

// ═══════════════════════════════════════════════════════
// AUTO: INVENTARIS PROPERTI
// ═══════════════════════════════════════════════════════
function buildInventarisBlock(ctx: TemplateContext): DOCXBlock[] {
  const props = ctx.properties || [];
  if (props.length === 0) {
    return [
      { type: 'paragraph', text: 'Belum ada data inventaris properti di sistem. Silakan isi di menu Properti.', italic: true },
      { type: 'spacer' },
    ];
  }

  const rows = props.map((p, i) => [
    i + 1,
    p.name,
    p.scene || '-',
    p.material || '-',
    p.status || '-',
    p.condition || '-',
    p.pic || '-',
  ]);

  return [
    { type: 'label', text: `Daftar Inventaris Properti (${props.length} item)` },
    { type: 'spacer' },
    {
      type: 'table',
      headers: ['No', 'Nama Properti', 'Adegan', 'Bahan', 'Status', 'Kondisi', 'PIC'],
      rows,
      widths: [400, 2000, 1500, 1400, 1200, 1200, 1660],
    },
    { type: 'spacer' },
  ];
}

// ═══════════════════════════════════════════════════════
// AUTO: NOTULA RAPAT
// ═══════════════════════════════════════════════════════
function buildNotulaListBlock(ctx: TemplateContext): DOCXBlock[] {
  const items = ctx.notulensi || [];
  if (items.length === 0) {
    return [
      { type: 'paragraph', text: 'Belum ada notula rapat tersimpan di sistem.', italic: true },
      { type: 'spacer' },
    ];
  }

  const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const rows = sorted.map((n, i) => [
    i + 1,
    fmtDate(n.date),
    n.title,
    n.location || '-',
    (n.agenda || '-').slice(0, 80),
  ]);

  return [
    { type: 'label', text: `Daftar Notula Rapat (${items.length} rapat)` },
    { type: 'spacer' },
    {
      type: 'table',
      headers: ['No', 'Tanggal', 'Judul Rapat', 'Lokasi', 'Agenda'],
      rows,
      widths: [400, 1400, 2600, 1600, 3360],
    },
    { type: 'spacer' },
  ];
}

// ═══════════════════════════════════════════════════════
// AUTO: DOKUMENTASI
// ═══════════════════════════════════════════════════════
function buildDokumentasiBlock(ctx: TemplateContext): DOCXBlock[] {
  const docs = ctx.documents || [];
  if (docs.length === 0) {
    return [
      { type: 'paragraph', text: 'Belum ada dokumen tersimpan di sistem.', italic: true },
      { type: 'spacer' },
    ];
  }

  const byCategory: Record<string, DocumentLite[]> = {};
  docs.forEach(d => {
    if (!byCategory[d.category]) byCategory[d.category] = [];
    byCategory[d.category].push(d);
  });

  const blocks: DOCXBlock[] = [
    { type: 'label', text: `Arsip Dokumen (${docs.length} file)` },
    { type: 'spacer' },
  ];

  Object.entries(byCategory).forEach(([cat, items]) => {
    blocks.push({ type: 'subheading', text: `${cat} (${items.length})` });
    blocks.push({
      type: 'bullets',
      items: items.map(d => `${d.title} - ${d.fileUrl}`),
    });
  });

  blocks.push({ type: 'spacer' });
  return blocks;
}

// ═══════════════════════════════════════════════════════
// AUTO: ESTIMASI PEMASUKAN
// ═══════════════════════════════════════════════════════
function buildPemasukanTable(ctx: TemplateContext): (string | number)[][] {
  const rows: (string | number)[][] = [];
  let total = 0;

  if (ctx.kas && ctx.kas.totalCollected !== undefined) {
    rows.push(['1', `Kas Kelas - ${ctx.kas.title || 'Kas Produksi'}`, fmtRp(ctx.kas.totalCollected)]);
    total += ctx.kas.totalCollected;
  }

  const incomeEntries = (ctx.cashEntries || []).filter(e => e.type === 'INCOME');
  incomeEntries.forEach(e => {
    const amount = (Number(e.qty) || 0) * (Number(e.amount) || 0);
    rows.push([String(rows.length + 1), `${e.itemName} (${e.targetName})`, fmtRp(amount)]);
    total += amount;
  });

  rows.push([String(rows.length + 1), 'Iuran Siswa (di luar kas)', '[....]']);
  rows.push([String(rows.length + 1), 'Sponsor / Donatur', '[....]']);
  rows.push([String(rows.length + 1), 'Tiket / Undangan', '[....]']);
  rows.push(['', 'Total Estimasi Pemasukan', total > 0 ? fmtRp(total) + ' + sumber lain' : '[....]']);

  return rows;
}

// ═══════════════════════════════════════════════════════
// 1. PROPOSAL
// ═══════════════════════════════════════════════════════
const buildProposal = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const judulPementasan = data?.judulPementasan || ctx.production?.title || ctx.kerabatKerja || '[JUDUL PEMENTASAN]';
  const jenisTeater = v(data, 'jenisTeaterTradisional', '[Jenis teater tradisional]');
  const sinopsis = ctx.production?.synopsis || '[Tuliskan sinopsis di menu Produksi]';
  const waliKelas = v(data, 'namaWaliKelas', '...........................');
  const kepalaSekolah = v(data, 'namaKepalaSekolah', '...........................');
  const tglSah = v(data, 'tanggalPengesahan', todayLongID());

  const gambaranPementasan = data?.gambaranPementasan
    || ctx.production?.directorVision
    || '[Tuliskan gambaran pementasan atau isi Visi di menu Produksi]';

  const gaya = data?.konsepSederhana || 'sederhana';
  const konsepArtistikRows: (string | number)[][] = (() => {
    if (gaya === 'meriah') {
      return [
        ['Tata Panggung', 'Panggung megah dengan backdrop bergambar dan properti lengkap.'],
        ['Tata Cahaya', 'Lampu sorot berwarna, follow spot, dan efek pencahayaan dramatik.'],
        ['Tata Suara', 'Sound system lengkap dengan mikrofon clip-on untuk pemeran utama.'],
        ['Musik Pengiring', 'Musik tradisional daerah direkam dan pemeran musik live (sape, gendang).'],
        ['Kostum', 'Baju adat lengkap dengan aksesori mahkota, kalung, dan gelang.'],
        ['Rias', 'Rias karakter penuh sesuai tokoh, dengan efek khusus (luka, penuaan).'],
        ['Properti', 'Properti utama lengkap: singgasana, meja, keris, mahkota.'],
        ['Tari/Gerak', 'Tarian pembuka dari penari latar dengan gerak tari daerah.'],
        ['Bahasa/Dialek', 'Bahasa Indonesia dengan sentuhan dialek Kalimantan Timur.'],
      ];
    }
    if (gaya === 'sedang') {
      return [
        ['Tata Panggung', 'Panggung dengan backdrop sederhana dan properti utama.'],
        ['Tata Cahaya', 'Lampu utama dan lampu warna sederhana.'],
        ['Tata Suara', 'Mikrofon dan speaker standar, musik pengiring dari laptop.'],
        ['Musik Pengiring', 'Musik tradisional direkam sebagai latar suasana.'],
        ['Kostum', 'Baju adat sederhana dengan aksesori minimal.'],
        ['Rias', 'Rias karakter ringan sesuai tokoh.'],
        ['Properti', 'Properti utama minimalis: 1-2 item kunci per adegan.'],
        ['Tari/Gerak', 'Gerak panggung sederhana mengikuti adegan.'],
        ['Bahasa/Dialek', 'Bahasa Indonesia dengan sedikit sentuhan daerah.'],
      ];
    }
    return [
      ['Tata Panggung', 'Panggung minimalis, fokus pada akting dan blocking pemeran.'],
      ['Tata Cahaya', 'Lampu utama dan pencahayaan seadanya.'],
      ['Tata Suara', 'Mikrofon dan speaker seadanya, musik pengiring dari speaker.'],
      ['Musik Pengiring', 'Musik direkam dari sumber digital (YouTube, MP3).'],
      ['Kostum', 'Baju sehari-hari atau baju adat sederhana.'],
      ['Rias', 'Rias ringan atau tanpa rias karakter.'],
      ['Properti', 'Properti seadanya dari barang yang tersedia.'],
      ['Tari/Gerak', 'Gerak panggung mengikuti dialog.'],
      ['Bahasa/Dialek', 'Bahasa Indonesia.'],
    ];
  })();

  const susunanPanitia = buildSusunanPanitia(ctx.members, ctx.teacherName);
  const jadwalRows = buildJadwalProduksi(ctx.schedules);
  const rabBlocks = buildRABDetailBlocks(ctx, data);
  const pemasukanRows = buildPemasukanTable(ctx);
  const grouped = groupRAB(ctx.rabItems || []);
  const grandTotalRAB = grouped.reduce((s, g) => s + g.subtotal, 0);

  return [
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

    { type: 'title', text: 'LEMBAR PENGESAHAN' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Proposal kegiatan produksi teater tradisional dengan judul "${judulPementasan}" telah disetujui dan disahkan untuk dilaksanakan oleh Tim Produksi Kelas ${ctx.className} ${ctx.schoolName} pada Tahun Pelajaran ${ctx.academicYear}.`, align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'spacer' },
    { type: 'signature', signatures: [
      { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
      { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
    ]},
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Mengetahui / Menyetujui:', align: 'center' },
    { type: 'spacer' },
    { type: 'signature', signatures: [
      { place: '', date: '', label: `Wali Kelas ${ctx.className},`, name: waliKelas },
      { place: '', date: '', label: 'Guru Mata Pelajaran Seni Budaya,', name: ctx.teacherName },
    ]},
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Menyetujui,', align: 'center' },
    { type: 'paragraph', text: 'Kepala SMP Negeri 10 Samarinda', align: 'center' },
    { type: 'spacer', count: 3 },
    { type: 'paragraph', text: kepalaSekolah, align: 'center', bold: true },
    { type: 'pagebreak' },

    { type: 'title', text: 'KATA PENGANTAR' },
    { type: 'paragraph', text: v(data, 'kataPengantar'), align: 'justify' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'paragraph', text: 'Tim Produksi', align: 'right' },
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB I - PENDAHULUAN' },
    { type: 'subheading', text: '1.1  Latar Belakang' },
    { type: 'paragraph', text: v(data, 'latarBelakang'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '1.2  Tujuan Kegiatan' },
    { type: 'numbered', items: vList(data, 'tujuan', ['[Tujuan kegiatan]']) },
    { type: 'spacer' },
    { type: 'subheading', text: '1.3  Manfaat Kegiatan' },
    { type: 'paragraph', text: v(data, 'manfaat'), align: 'justify' },
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB II - DESKRIPSI PRODUKSI' },
    { type: 'subheading', text: '2.1  Nama Kegiatan' },
    { type: 'paragraph', text: `Pementasan Teater Tradisional Kelas ${ctx.className} - "${judulPementasan}"` },
    { type: 'spacer' },
    { type: 'subheading', text: '2.2  Tema' },
    { type: 'paragraph', text: ctx.production?.theme || '[Tema produksi]' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.3  Jenis Teater Tradisional' },
    { type: 'paragraph', text: jenisTeater },
    { type: 'spacer' },
    { type: 'subheading', text: '2.4  Sinopsis Cerita' },
    { type: 'paragraph', text: sinopsis, align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.5  Tokoh dan Pemeran' },
    { type: 'paragraph', text: 'Daftar pemeran diambil otomatis dari data kelas:', italic: true },
    { type: 'table', headers: ['No', 'Nama', 'Kelas', 'Peran'], rows: buildDaftarPemain(ctx.members) },
    { type: 'spacer' },
    { type: 'subheading', text: '2.6  Gambaran Pementasan' },
    { type: 'paragraph', text: gambaranPementasan, align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.7  Alur Cerita' },
    { type: 'paragraph', text: v(data, 'alurCerita', '[Alur cerita singkat]'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.8  Konsep Artistik' },
    { type: 'paragraph', text: `Gaya pementasan: ${gaya.charAt(0).toUpperCase() + gaya.slice(1)}`, italic: true },
    { type: 'table', headers: ['Aspek', 'Deskripsi'], rows: konsepArtistikRows },
    { type: 'spacer' },
    { type: 'subheading', text: '2.9  Susunan Panitia' },
    { type: 'paragraph', text: 'Disusun otomatis dari struktur kepanitiaan yang terdaftar di sistem:', italic: true },
    { type: 'table', headers: ['No', 'Jabatan', 'Nama', 'Tugas'], rows: susunanPanitia, widths: [500, 2400, 2500, 3960] },
    { type: 'spacer' },
    { type: 'subheading', text: '2.10  Jadwal Produksi' },
    { type: 'paragraph', text: 'Diambil otomatis dari menu Jadwal dan Agenda:', italic: true },
    { type: 'table', headers: ['Tahap/Jenis', 'Kegiatan', 'Waktu', 'Tempat', 'PIC/Peserta'], rows: jadwalRows, widths: [1300, 2500, 2200, 1800, 1560] },
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB III - RENCANA ANGGARAN' },
    { type: 'subheading', text: '3.1  Estimasi Pemasukan' },
    { type: 'paragraph', text: 'Diambil otomatis dari Kas Produksi dan Buku Kas:', italic: true },
    { type: 'table', headers: ['No', 'Sumber Dana', 'Jumlah'], rows: pemasukanRows },
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

    { type: 'heading', text: 'BAB IV - PENUTUP' },
    { type: 'paragraph', text: v(data, 'penutup'), align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'signature', signatures: [
      { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
      { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
    ]},
    { type: 'pagebreak' },

    { type: 'heading', text: 'LAMPIRAN PROPOSAL' },
    { type: 'numbered', items: [
      'Susunan acara', 'Naskah atau skenario', 'Desain panggung',
      'Desain kostum dan rias', 'Daftar pemeran', 'Daftar panitia',
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
  { type: 'paragraph', text: 'di Samarinda' },
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
    { type: 'paragraph', text: `di ${v(data, 'alamatInstansi', 'Tempat')}` },
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
// 4. LPJ
// ═══════════════════════════════════════════════════════
const buildLPJ = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const judulPementasan = data?.judulPementasan || ctx.production?.title || ctx.kerabatKerja || '[JUDUL PEMENTASAN]';
  const jenisTeater = v(data, 'jenisTeaterTradisional', '[Jenis teater tradisional]');
  const waliKelas = v(data, 'namaWaliKelas', '...........................');
  const kepalaSekolah = v(data, 'namaKepalaSekolah', '...........................');
  const tglSah = v(data, 'tanggalPengesahan', todayLongID());

  const susunanPanitia = buildSusunanPanitia(ctx.members, ctx.teacherName);
  const daftarPemain = buildDaftarPemain(ctx.members);
  const jadwalRows = buildJadwalProduksi(ctx.schedules);

  const kendalaRows = vTable(data, 'kendalaSolusi', 2, [
    ['[Kendala 1]', '[Solusi 1]'], ['[Kendala 2]', '[Solusi 2]'],
  ]);

  const pementasanSched = ctx.schedules?.find(s => s.type === 'Pementasan');
  const hariTanggal = ctx.production?.performanceDate
    ? fmtDate(ctx.production.performanceDate)
    : pementasanSched ? fmtDate(pementasanSched.startAt) : '[Hari, tanggal]';
  const waktu = pementasanSched
    ? `${new Date(pementasanSched.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${new Date(pementasanSched.endAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`
    : '[Waktu]';
  const tempat = pementasanSched?.location || '[Tempat]';

  const pemasukanRows = buildPemasukanTable(ctx);
  const manualPengeluaran = parseTable(data?.realisasiPengeluaran, 3);
  const rabGrouped = groupRAB(ctx.rabItems || []);

  const pengeluaranRows: (string | number)[][] = manualPengeluaran.length > 0
    ? manualPengeluaran.map((r, i) => {
        const renc = Number(r[1]) || 0;
        const real = Number(r[2]) || 0;
        return [i + 1, r[0], fmtRp(renc), fmtRp(real), fmtRp(real - renc), ''];
      })
    : rabGrouped.map((g, i) => [i + 1, `${g.category} - ${g.targetName}`, fmtRp(g.subtotal), '-', '-', '']);

  const totalPengeluaranRencana = rabGrouped.reduce((s, g) => s + g.subtotal, 0);

  return [
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

    { type: 'title', text: 'LEMBAR PENGESAHAN' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Laporan Pertanggungjawaban kegiatan produksi teater tradisional dengan judul "${judulPementasan}" telah diterima dan disahkan oleh Tim Produksi Kelas ${ctx.className} ${ctx.schoolName} pada Tahun Pelajaran ${ctx.academicYear}.`, align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'spacer' },
    { type: 'signature', signatures: [
      { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
      { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
    ]},
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Mengetahui / Menyetujui:', align: 'center' },
    { type: 'spacer' },
    { type: 'signature', signatures: [
      { place: '', date: '', label: `Wali Kelas ${ctx.className},`, name: waliKelas },
      { place: '', date: '', label: 'Guru Mata Pelajaran Seni Budaya,', name: ctx.teacherName },
    ]},
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: 'Menyetujui,', align: 'center' },
    { type: 'paragraph', text: 'Kepala SMP Negeri 10 Samarinda', align: 'center' },
    { type: 'spacer', count: 3 },
    { type: 'paragraph', text: kepalaSekolah, align: 'center', bold: true },
    { type: 'pagebreak' },

    { type: 'title', text: 'KATA PENGANTAR' },
    { type: 'paragraph', text: v(data, 'kataPengantar'), align: 'justify' },
    { type: 'spacer' },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'paragraph', text: 'Tim Produksi', align: 'right' },
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB I - PENDAHULUAN' },
    { type: 'subheading', text: '1.1  Latar Belakang' },
    { type: 'paragraph', text: v(data, 'latarBelakang'), align: 'justify' },
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB II - PELAKSANAAN KEGIATAN' },
    { type: 'subheading', text: '2.1  Nama Kegiatan' },
    { type: 'paragraph', text: `Pementasan Teater Tradisional Kelas ${ctx.className} - "${judulPementasan}"` },
    { type: 'spacer' },
    { type: 'subheading', text: '2.2  Waktu dan Tempat' },
    { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
      ['Hari/Tanggal', hariTanggal],
      ['Waktu', waktu],
      ['Tempat', tempat],
      ['Jumlah Penonton', v(data, 'jumlahPenonton', '-')],
    ]},
    { type: 'spacer' },
    { type: 'subheading', text: '2.3  Jenis Teater Tradisional' },
    { type: 'paragraph', text: jenisTeater },
    { type: 'spacer' },
    { type: 'subheading', text: '2.4  Susunan Panitia' },
    { type: 'paragraph', text: 'Diambil otomatis dari struktur kepanitiaan yang terdaftar:', italic: true },
    { type: 'table', headers: ['No', 'Jabatan', 'Nama', 'Tugas'], rows: susunanPanitia, widths: [500, 2400, 2500, 3960] },
    { type: 'spacer' },
    { type: 'subheading', text: '2.5  Peserta' },
    { type: 'paragraph', text: 'Diambil otomatis dari data kelas:', italic: true },
    { type: 'table', headers: ['No', 'Nama', 'Kelas', 'Peran'], rows: daftarPemain },
    { type: 'spacer' },
    { type: 'subheading', text: '2.6  Tahapan Pelaksanaan' },
    { type: 'paragraph', text: 'Diambil otomatis dari Jadwal dan Agenda:', italic: true },
    { type: 'table', headers: ['Tahap/Jenis', 'Kegiatan', 'Waktu', 'Tempat', 'PIC'], rows: jadwalRows, widths: [1300, 2500, 2200, 1800, 1560] },
    { type: 'spacer' },
    { type: 'subheading', text: '2.7  Hasil Pementasan' },
    { type: 'paragraph', text: v(data, 'hasilPementasan'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '2.8  Kendala dan Solusi' },
    { type: 'table', headers: ['No', 'Kendala', 'Solusi'], rows: kendalaRows.map((r, i) => [i + 1, r[0], r[1]]) },
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB III - REALISASI ANGGARAN' },
    { type: 'subheading', text: '3.1  Pemasukan' },
    { type: 'paragraph', text: 'Diambil otomatis dari Kas Produksi dan Buku Kas:', italic: true },
    { type: 'table', headers: ['No', 'Sumber Dana', 'Jumlah'], rows: pemasukanRows },
    { type: 'spacer' },
    { type: 'subheading', text: '3.2  Pengeluaran' },
    { type: 'paragraph', text: 'Diambil otomatis dari RAB Digital:', italic: true },
    { type: 'table', headers: ['No', 'Kebutuhan', 'Rencana', 'Realisasi', 'Selisih', 'Ket.'], rows: pengeluaranRows },
    { type: 'spacer' },
    { type: 'subheading', text: '3.3  Rekapitulasi' },
    { type: 'table', headers: ['Uraian', 'Jumlah'], rows: [
      ['Total Pemasukan (rencana)', fmtRp(ctx.kas?.totalCollected || 0)],
      ['Total Pengeluaran (rencana)', fmtRp(totalPengeluaranRencana)],
      ['Saldo Rencana', fmtRp((ctx.kas?.totalCollected || 0) - totalPengeluaranRencana)],
    ]},
    { type: 'spacer' },
    { type: 'subheading', text: '3.4  Bukti Pengeluaran' },
    ...buildBuktiPengeluaranBlock(ctx),
    ...(data?.rabUploadUrl
      ? [
          { type: 'label' as const, text: 'Lampiran RAB Final (telah ditandatangani):' },
          { type: 'paragraph' as const, text: data.rabUploadName ? `${data.rabUploadName} - ${data.rabUploadUrl}` : String(data.rabUploadUrl) },
          { type: 'spacer' as const },
        ]
      : []),
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB IV - EVALUASI DAN REFLEKSI' },
    { type: 'subheading', text: '4.1  Apa yang Sudah Berhasil?' },
    { type: 'paragraph', text: v(data, 'evaluasiKetercapaian'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '4.2  Apa Pelajaran yang Didapat?' },
    { type: 'paragraph', text: v(data, 'refleksiTim'), align: 'justify' },
    { type: 'spacer' },
    { type: 'subheading', text: '4.3  Saran untuk Kegiatan Berikutnya' },
    { type: 'paragraph', text: v(data, 'rekomendasi', '[Rekomendasi untuk kegiatan berikutnya]'), align: 'justify' },
    { type: 'pagebreak' },

    { type: 'heading', text: 'BAB V - PENUTUP' },
    { type: 'paragraph', text: v(data, 'penutup'), align: 'justify' },
    { type: 'spacer', count: 2 },
    { type: 'paragraph', text: `Samarinda, ${tglSah}`, align: 'right' },
    { type: 'signature', signatures: [
      { place: '', date: '', label: 'Ketua Panitia,', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
      { place: '', date: '', label: 'Sekretaris,', name: findMemberByRole(ctx.members, 'Sekretaris') },
    ]},
    { type: 'pagebreak' },

    { type: 'heading', text: 'LAMPIRAN LPJ' },
    { type: 'spacer' },

    { type: 'subheading', text: 'Lampiran 1: Daftar Hadir Panitia dan Pemeran' },
    ...buildDaftarHadirBlock(ctx),
    { type: 'spacer' },

    { type: 'subheading', text: 'Lampiran 2: Daftar Notula Rapat' },
    ...buildNotulaListBlock(ctx),
    { type: 'spacer' },

    { type: 'subheading', text: 'Lampiran 3: Bukti Pengeluaran' },
    ...buildBuktiPengeluaranBlock(ctx),
    { type: 'spacer' },

    { type: 'subheading', text: 'Lampiran 4: Daftar Inventaris' },
    ...buildInventarisBlock(ctx),
    { type: 'spacer' },

    { type: 'subheading', text: 'Lampiran 5: Dokumentasi dan Arsip' },
    ...buildDokumentasiBlock(ctx),
  ];
};

// ═══════════════════════════════════════════════════════
// 5. SKETSA PANGGUNG (REVISI)
// ═══════════════════════════════════════════════════════
const buildSketsaPanggung = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const pb = (ctx.promptBooks || [])[0];

  // Auto-fallback denah zona dari Prompt Book Studio
  const autoDenah = pb?.gridPositions
    ? Object.entries(pb.gridPositions).map(([actorId, zone]) => {
        const m = ctx.members?.find(x => x.uid === actorId);
        return [String(zone), m?.displayName || actorId];
      })
    : null;

  const zonaRows = vTable(data, 'denahZona', 2, autoDenah || [
    ['UL', '[Upstage Left]'], ['UC', '[Upstage Center]'], ['UR', '[Upstage Right]'],
    ['CL', '[Center Left]'], ['C', '[Center]'], ['CR', '[Center Right]'],
    ['DL', '[Downstage Left]'], ['DC', '[Downstage Center]'], ['DR', '[Downstage Right]'],
  ]);

  // Denah per adegan (8 kolom)
  const denahPerAdeganRows = vTable(data, 'denahPerAdegan', 8, [
    ['Adegan 1', '[latar]', '-', '-', '[posisi aktor]', '[cue]', '-', '-'],
  ]);

  // Pasang & bongkar per pergantian
  const pasangBongkarList = vList(data, 'pasangBongkar', [
    '[Pergantian]: [nama kru] [aksi] (target [waktu])',
  ]);

  return [
    { type: 'title', text: 'SKETSA DAN DENAH PANGGUNG' },
    { type: 'subtitle', text: `Kelas ${ctx.className} - ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    // BAGIAN A
    { type: 'heading', text: 'BAGIAN A: DENAH DASAR' },
    { type: 'subheading', text: 'A.1  Konsep Tata Panggung' },
    { type: 'paragraph', text: v(data, 'konsep') },
    { type: 'spacer' },
    { type: 'subheading', text: 'A.2  Denah 9 Zona Panggung (Kondisi Tetap)' },
    { type: 'paragraph', text: autoDenah ? 'Diambil otomatis dari Prompt Book di Studio:' : 'Isi manual (belum ada Prompt Book di sistem):', italic: true },
    { type: 'table', headers: ['Kode Zona', 'Isi Zona'], rows: zonaRows },
    { type: 'spacer' },
    { type: 'subheading', text: 'A.3  Sketsa Visual' },
    { type: 'paragraph', text: `Link sketsa: ${v(data, 'sketsaLink', '-')}` },
    { type: 'pagebreak' },

    // BAGIAN B
    { type: 'heading', text: 'BAGIAN B: DENAH PER ADEGAN' },
    { type: 'paragraph', text: 'Hanya mencatat perubahan dari adegan sebelumnya. Tanda "-" berarti tidak ada perubahan.', italic: true },
    { type: 'table',
      headers: ['Adegan', 'Latar', 'Set Masuk', 'Set Keluar', 'Posisi Awal Aktor', 'Cue Lampu', 'Kru Bergerak', 'Waktu Ganti'],
      rows: denahPerAdeganRows,
      widths: [900, 1200, 1100, 1100, 1400, 800, 1600, 700],
    },
    { type: 'pagebreak' },

    // BAGIAN C
    { type: 'heading', text: 'BAGIAN C: PASANG DAN BONGKAR PER PERGANTIAN' },
    { type: 'paragraph', text: 'Satu langkah per baris. Format: [Pergantian]: [Nama kru] [aksi] (target [waktu]).', italic: true },
    { type: 'bullets', items: pasangBongkarList },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Panggung', name: findMemberByRole(ctx.members, 'Koordinator Tata Panggung') },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 6. PROMPT BOOK (REVISI)
// ═══════════════════════════════════════════════════════
const buildPromptBook = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const promptBooksFromStudio = ctx.promptBooks || [];
  const musicCues = ctx.musicCues || [];

  // Fallback: daftar adegan otomatis dari Prompt Book Studio
  const autoAdegan: (string | number)[][] = promptBooksFromStudio.map((pb, i) => [
    `Adegan ${i + 1}`,
    pb.scene,
    pb.gridPositions ? `${Object.keys(pb.gridPositions).length} aktor` : '-',
  ]);

  const daftarAdeganRows = vTable(data, 'daftarAdegan', 3,
    autoAdegan.length > 0 ? autoAdegan : [['Adegan 1', '[latar]', '[durasi]']]
  );

  const daftarKruRows = vTable(data, 'daftarKru', 5, [
    ['[Nama]', '[Divisi]', '[Posisi standby]', '[Jalur gerak]', '[Tugas utama]'],
  ]);

  const alatRows = vTable(data, 'alatStageManager', 4, [
    ['[Alat]', '[Jumlah]', '[Dibawa oleh]', '[Fungsi]'],
  ]);

  // Cue list (dari data manual & auto dari Studio)
  const autoCues: (string | number)[][] = [];
  promptBooksFromStudio.forEach(pb => {
    (pb.cues || []).forEach(c => {
      autoCues.push([c.code || '-', pb.scene, c.action || '-', c.soundLight || '-', c.timing || '-']);
    });
  });
  musicCues.forEach(m => {
    autoCues.push([m.cueType || '-', m.scene || '-', m.title, m.audioUrl || '-', m.duration || '-']);
  });

  const cueRows = vTable(data, 'cueList', 5, autoCues.length > 0 ? autoCues : [['CUE-01', '[trigger]', '[aksi]', '[audio]', '[lampu]']]);

  return [
    { type: 'title', text: 'PROMPT BOOK - BUKU SUTRADARA' },
    { type: 'subtitle', text: ctx.kerabatKerja ? `"${ctx.kerabatKerja}"` : '[Nama Produksi]' },
    { type: 'spacer', count: 2 },

    // A. Jadwal & Stage Manager
    { type: 'heading', text: 'A. JADWAL DAN STAGE MANAGER' },
    { type: 'table', headers: ['Keterangan', 'Detail'], rows: [
      ['Produksi', ctx.kerabatKerja || '[Nama Produksi]'],
      ['Sutradara', findMemberByRole(ctx.members, 'Sutradara')],
      ['Asisten Sutradara', findMemberByRole(ctx.members, 'Asisten Sutradara')],
      ['Stage Manager', v(data, 'stageManager', '-')],
      ['Tanggal Mulai Latihan', v(data, 'tanggalMulai', '-')],
      ['Durasi Target', '30 menit'],
    ]},
    { type: 'pagebreak' },

    // B. Daftar Kru
    { type: 'heading', text: 'B. DAFTAR KRU' },
    { type: 'paragraph', text: 'Kru tahu tugas, posisi standby, dan jalur geraknya saat pergantian.', italic: true },
    { type: 'table',
      headers: ['Nama', 'Divisi', 'Posisi Standby', 'Jalur Gerak', 'Tugas Utama'],
      rows: daftarKruRows,
      widths: [1500, 1600, 1800, 2200, 2260],
    },
    { type: 'pagebreak' },

    // C. Alat Stage Manager
    { type: 'heading', text: 'C. ALAT STAGE MANAGER DAN KRU' },
    { type: 'paragraph', text: 'Alat yang dibawa bergerak di panggung. Setiap baris wajib ada fungsi.', italic: true },
    { type: 'table',
      headers: ['Alat', 'Jumlah', 'Dibawa oleh', 'Fungsi'],
      rows: alatRows,
      widths: [2200, 1200, 2000, 3960],
    },
    { type: 'pagebreak' },

    // D. Daftar Adegan
    { type: 'heading', text: 'D. DAFTAR ADEGAN' },
    { type: 'paragraph', text: autoAdegan.length > 0 && !data?.daftarAdegan ? 'Diambil otomatis dari Prompt Book di Studio:' : 'Urutan adegan:', italic: true },
    { type: 'table',
      headers: ['Adegan', 'Latar', 'Durasi Perkiraan'],
      rows: daftarAdeganRows,
      widths: [2000, 5360, 2000],
    },
    { type: 'pagebreak' },

    // E. Catatan Blocking
    { type: 'heading', text: 'E. CATATAN BLOCKING PENTING' },
    { type: 'paragraph', text: 'Aturan gerak aktor yang tidak boleh dilanggar.' },
    { type: 'bullets', items: vList(data, 'catatanBlocking', ['Ratu tidak turun dari singgasana sampai adegan 3.']) },
    { type: 'spacer' },

    // F. Catatan Teknis
    { type: 'heading', text: 'F. CATATAN TEKNIS' },
    { type: 'bullets', items: vList(data, 'catatanTeknis', ['Standby stage manager di sisi panggung kiri']) },
    { type: 'pagebreak' },

    // LAMPIRAN: CUE SHEET
    { type: 'heading', text: 'LAMPIRAN: CUE SHEET' },
    { type: 'paragraph', text: autoCues.length > 0 ? `Diambil otomatis dari Prompt Book dan Cue Sheet Musik (${autoCues.length} cue):` : 'Isi manual:', italic: true },
    { type: 'table', headers: ['Cue', 'Trigger/Scene', 'Aksi', 'Audio', 'Timing'], rows: cueRows },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Sutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Asisten Sutradara', name: findMemberByRole(ctx.members, 'Asisten Sutradara') },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 7. CUE SHEET (REVISI — checklist bertimestamp)
// ═══════════════════════════════════════════════════════
const buildCueSheet = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const musicCues = ctx.musicCues || [];

  const autoCueRows = musicCues.map((m, i) => [
    `CUE-${String(i + 1).padStart(2, '0')}`,
    m.scene || '-',
    m.title,
    m.cueType || '-',
    m.duration || '-',
    m.volume ? `${m.volume}%` : '-',
    m.audioUrl || '-',
  ]);

  const cueRows = vTable(data, 'cueList', 7, autoCueRows.length > 0 ? autoCueRows : [['CUE-01', '[adegan]', '[track]', '[in/out]', '[durasi]', '[volume]', '[link]']]);

  const autoOperators: (string | number)[][] = [];
  const koordMusik = findMemberByRole(ctx.members, 'Koordinator Tata Musik');
  if (koordMusik !== '...........................') autoOperators.push(['Sound Engineer', koordMusik]);
  const anggotaMusik = (ctx.members || []).filter(m => m.role === 'Anggota Tata Musik');
  anggotaMusik.slice(0, 2).forEach((m, i) => {
    autoOperators.push([i === 0 ? 'Mixer Operator' : 'Backup Operator', m.displayName]);
  });

  const opRows = vTable(data, 'operatorList', 2, autoOperators.length > 0 ? autoOperators : [['Sound Engineer', '[Nama]']]);

  return [
    { type: 'title', text: 'CUE SHEET - TATA MUSIK DAN SUARA' },
    { type: 'subtitle', text: `Kelas ${ctx.className} - ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. DAFTAR CUE' },
    { type: 'paragraph', text: autoCueRows.length > 0 ? `Diambil otomatis dari menu Cue Sheet (${musicCues.length} cue):` : 'Isi manual (belum ada cue di sistem):', italic: true },
    { type: 'table',
      headers: ['Cue', 'Adegan', 'Track', 'In/Out', 'Durasi', 'Volume', 'Link'],
      rows: cueRows,
      widths: [900, 1400, 1500, 1100, 1000, 1000, 2460],
    },
    { type: 'pagebreak' },

    { type: 'heading', text: 'B. OPERATOR' },
    { type: 'paragraph', text: 'Diambil otomatis dari struktur divisi Tata Musik:', italic: true },
    { type: 'table', headers: ['Posisi', 'Nama'], rows: opRows },
    { type: 'pagebreak' },

    { type: 'heading', text: 'C. CHECKLIST PERSIAPAN' },
    { type: 'paragraph', text: 'Setiap baris harus bisa dijawab "sudah" atau "belum". Urutkan sesuai waktu pengecekan.', italic: true },
    { type: 'paragraph', text: 'Tambahkan kotak centang di kertas setelah dicetak, atau tandai manual di sini.', italic: true },
    { type: 'spacer' },
    { type: 'bullets', items: vList(data, 'checklist', [
      'H-1: Backing track tersedia offline di dua perangkat',
      'H-1: Mixer preset tersimpan dan sudah diuji',
      '30 menit sebelum opening: Sound check semua mic dan balance',
      'Saat pentas: Lagu darurat siap diputar dari laptop cadangan',
    ]) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Sutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Musik', name: findMemberByRole(ctx.members, 'Koordinator Tata Musik') },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 8. PROPERTI (REVISI — penanggung jawab per adegan)
// ═══════════════════════════════════════════════════════
const buildProperti = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const properties = ctx.properties || [];

  const autoRows = properties.map((p, i) => [
    String(i + 1),
    p.scene || '-',
    p.name,
    p.material || '-',
    '1',
    p.status || 'BELUM',
    p.pic || '-',
  ]);

  const rows = vTable(data, 'propertiList', 7, autoRows.length > 0 ? autoRows : [['1', '[adegan]', '[nama]', '[bahan]', '1', 'BELUM', '[PIC]']]);

  const pjRows = vTable(data, 'penanggungJawabProperti', 4, [
    ['[adegan]', '[properti]', '[penanggung jawab]', '[posisi awal]'],
  ]);

  return [
    { type: 'title', text: 'BREAKDOWN PROPERTI PER ADEGAN' },
    { type: 'subtitle', text: `Kelas ${ctx.className} - ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. DAFTAR PROPERTI (dari menu Properti)' },
    { type: 'paragraph', text: autoRows.length > 0 ? `Diambil otomatis dari menu Properti (${properties.length} item):` : 'Isi manual (belum ada properti di sistem):', italic: true },
    { type: 'table',
      headers: ['No', 'Adegan', 'Nama Properti', 'Bahan', 'Qty', 'Status', 'PIC'],
      rows,
      widths: [500, 1600, 1800, 1600, 600, 1200, 2060],
    },
    { type: 'pagebreak' },

    { type: 'heading', text: 'B. PENANGGUNG JAWAB PER ADEGAN' },
    { type: 'paragraph', text: 'Nama dari Daftar Kru Prompt Book. Posisi awal properti pakai kode zona (UL sampai DR).', italic: true },
    { type: 'table',
      headers: ['Adegan', 'Properti', 'Penanggung Jawab', 'Posisi Awal Properti'],
      rows: pjRows,
      widths: [1800, 2500, 2560, 2500],
    },
    { type: 'pagebreak' },

    { type: 'heading', text: 'C. CATATAN PENTING' },
    { type: 'bullets', items: vList(data, 'catatanPenting', ['Semua properti harus aman dipakai di panggung']) },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nPimpinan Produksi', name: findMemberByRole(ctx.members, 'Pimpinan Produksi') },
      { place: '', date: '', label: 'Koordinator Perlengkapan', name: findMemberByRole(ctx.members, 'Koordinator Perlengkapan') },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 9. KOSTUM (REVISI — penanggung jawab kostum)
// ═══════════════════════════════════════════════════════
const buildKostum = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const costumes = ctx.costumes || [];
  const karakter = data?.namaKarakter || '';
  const found = costumes.find(c => c.characterName === karakter) || costumes[0];

  const perkiraanUkuran = data?.perkiraanUkuran && String(data.perkiraanUkuran).trim() !== ''
    ? String(data.perkiraanUkuran)
    : null;

  return [
    { type: 'title', text: 'DESAIN KOSTUM PER KARAKTER' },
    { type: 'subtitle', text: `Kelas ${ctx.className} - ${ctx.academicYear}`, italic: true },
    { type: 'spacer', count: 2 },

    { type: 'heading', text: 'A. IDENTITAS KARAKTER' },
    { type: 'table', headers: ['Field', 'Keterangan'], rows: [
      ['Nama Karakter', v(data, 'namaKarakter', found?.characterName || '-')],
      ['Nama Pemeran', v(data, 'namaPemain', found?.playerName || '-')],
      ['Peran', v(data, 'peranKarakter', '-')],
      ['Watak Karakter', v(data, 'watakKarakter', '-')],
    ]},
    { type: 'spacer' },

    { type: 'heading', text: 'B. KONSEP KOSTUM' },
    { type: 'paragraph', text: found ? 'Diambil otomatis dari menu Kostum (kalau ada):' : 'Isi manual:', italic: true },
    { type: 'table', headers: ['Elemen', 'Deskripsi'], rows: [
      ['Warna Dominan', v(data, 'warnaDominan', found?.colors || '-')],
      ['Warna Sekunder', v(data, 'warnaSekunder', '-')],
      ['Bentuk/Siluet', v(data, 'siluet', '-')],
      ['Ornamen/Aksesoris', v(data, 'ornamen', found?.accessories || '-')],
    ]},
    ...(perkiraanUkuran
      ? [
          { type: 'spacer' as const },
          { type: 'label' as const, text: 'C. Perkiraan Ukuran' },
          { type: 'paragraph' as const, text: perkiraanUkuran === 'custom' ? 'Ukuran custom / di luar standar (silakan konfirmasi ke pemeran).' : `Ukuran ${perkiraanUkuran}` },
        ]
      : []),
    { type: 'spacer' },

    { type: 'heading', text: 'C. REFERENSI & PENANGGUNG JAWAB' },
    { type: 'table', headers: ['Field', 'Keterangan'], rows: [
      ['Penanggung Jawab Kostum', v(data, 'penanggungJawabKostum', '-')],
      ['Link Moodboard', v(data, 'linkMoodboard', '-')],
      ['Link Foto Referensi Utama', v(data, 'linkReferensi', '-')],
    ]},
    { type: 'spacer' },

    ...(data?.catatanKostum
      ? [
          { type: 'label' as const, text: 'D. Catatan Kostum' },
          { type: 'paragraph' as const, text: v(data, 'catatanKostum') },
          { type: 'spacer' as const },
        ]
      : []),

    { type: 'heading', text: 'E. STATUS PRODUKSI' },
    { type: 'paragraph', text: `Status saat ini: ${found?.status || '[Belum ada]'}`, italic: true },
    { type: 'bullets', items: ['[ ] Desain', '[ ] Potong', '[ ] Jahit', '[ ] Fitting', '[ ] Selesai'] },
    { type: 'spacer', count: 2 },
    { type: 'signature', signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Busana', name: findMemberByRole(ctx.members, 'Koordinator Tata Busana') },
    ]},
  ];
};

// ═══════════════════════════════════════════════════════
// 10. FACE CHART (REVISI — 6 kolom + Referensi & Higienitas gabung)
// ═══════════════════════════════════════════════════════
const buildFaceChart = (ctx: TemplateContext, data: Record<string, any>): DOCXBlock[] => {
  const rawRows = parseList(data?.daftarPemain);

  interface FaceRow {
    pemeran: string;
    karakter: string;
    jenisRias: string;
    warnaDominan: string;
    palet: string[];
    kruRias: string;
  }

  const faceRows: FaceRow[] = rawRows.map(line => {
    const cols = line.split('|').map(c => c.trim());
    const paletRaw = cols[4] || '';
    const palet = paletRaw.split(';').map(p => p.trim()).filter(Boolean);
    return {
      pemeran: cols[0] || '-',
      karakter: cols[1] || '-',
      jenisRias: cols[2] || '-',
      warnaDominan: cols[3] || '-',
      palet,
      kruRias: cols[5] || '-',
    };
  });

  // Fallback: kalau input kosong, pakai data faceCharts dari sistem
  if (faceRows.length === 0 && (ctx.faceCharts || []).length > 0) {
    (ctx.faceCharts || []).forEach(fc => {
      faceRows.push({
        pemeran: fc.playerName || '-',
        karakter: fc.characterName || '-',
        jenisRias: fc.riasType || '-',
        warnaDominan: '-',
        palet: [],
        kruRias: '-',
      });
    });
  }

  if (faceRows.length === 0) {
    faceRows.push({
      pemeran: '[Nama Pemeran]',
      karakter: '[Nama Karakter]',
      jenisRias: '[Korektif/Karakter/Fantasi]',
      warnaDominan: '[Warna]',
      palet: ['[Belum ada palet]'],
      kruRias: '[Nama Kru Rias]',
    });
  }

  const blocks: DOCXBlock[] = [
    { type: 'title', text: 'FACE CHART - DESAIN RIAS KARAKTER' },
    { type: 'subtitle', text: `Kelas ${ctx.className} - ${ctx.academicYear}`, italic: true },
    { type: 'subtitle', text: `Total ${faceRows.length} pemeran`, italic: true },
    { type: 'spacer', count: 2 },
  ];

  // Section per pemeran
  faceRows.forEach((row, idx) => {
    blocks.push({ type: 'heading', text: `#${idx + 1}  ${row.pemeran} - ${row.karakter}` });
    blocks.push({
      type: 'table',
      headers: ['Field', 'Keterangan'],
      rows: [
        ['Nama Pemeran', row.pemeran],
        ['Nama Karakter', row.karakter],
        ['Jenis Rias', row.jenisRias],
        ['Warna Dominan', row.warnaDominan],
        ['Kru Rias', row.kruRias],
      ],
    });
    blocks.push({ type: 'spacer' });

    blocks.push({ type: 'label', text: 'Palet Warna' });
    if (row.palet.length > 0) {
      blocks.push({
        type: 'bullets',
        items: row.palet,
      });
    } else {
      blocks.push({ type: 'paragraph', text: '-', italic: true });
    }
    blocks.push({ type: 'spacer' });

    if (idx < faceRows.length - 1) {
      blocks.push({ type: 'divider' });
      blocks.push({ type: 'spacer' });
    }
  });

  // Catatan teknis berlaku untuk semua
  blocks.push({ type: 'pagebreak' });
  blocks.push({ type: 'heading', text: 'CATATAN TEKNIS (BERLAKU UNTUK SEMUA Pemeran)' });
  blocks.push({ type: 'spacer' });

  blocks.push({ type: 'label', text: 'Teknik Khusus' });
  blocks.push({ type: 'bullets', items: vList(data, 'teknikKhusus', ['[Belum ada teknik khusus]']) });
  blocks.push({ type: 'spacer' });

  blocks.push({ type: 'label', text: 'Urutan Pengerjaan Rias' });
  blocks.push({
    type: 'numbered',
    items: vList(data, 'urutanPengerjaan', [
      'Bersihkan wajah dan aplikasikan primer',
      'Base dan concealer',
      'Kontur dan highlight',
      'Mata (eyeshadow, eyeliner, bulu mata)',
      'Alis',
      'Blush on',
      'Bibir',
      'Setting spray',
      'Touch-up terakhir',
    ]),
  });
  blocks.push({ type: 'spacer' });

  // Referensi & Higienitas (digabung)
  blocks.push({ type: 'heading', text: 'REFERENSI & HIGIENITAS (BERLAKU UNTUK SEMUA Pemeran)' });
  blocks.push({ type: 'spacer' });

  blocks.push({ type: 'label', text: 'Link Moodboard' });
  blocks.push({ type: 'paragraph', text: v(data, 'linkMoodboard', '-') });
  blocks.push({ type: 'spacer' });

  blocks.push({ type: 'label', text: 'Catatan Higienitas' });
  blocks.push({
    type: 'bullets',
    items: vList(data, 'higienitas', [
      'Gunakan spons sekali pakai',
      'Sterilkan kuas sebelum dan sesudah dipakai',
      'Lakukan tes alergi H-1 pada area kecil di lengan',
      'Sediakan makeup remover di ruang rias',
    ]),
  });

  blocks.push({ type: 'spacer', count: 2 });
  blocks.push({
    type: 'signature',
    signatures: [
      { place: 'Samarinda', date: todayLongID(), label: 'Mengetahui,\nSutradara', name: findMemberByRole(ctx.members, 'Sutradara') },
      { place: '', date: '', label: 'Koordinator Tata Rias', name: findMemberByRole(ctx.members, 'Koordinator Tata Rias') },
    ],
  });

  return blocks;
};

// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════
export const TEMPLATE_LIBRARY: TemplateDef[] = [
  {
    id: 'proposal',
    title: 'Proposal Produksi Seni Teater',
    shortTitle: 'Proposal',
    description: 'Proposal lengkap dengan kop surat. Susunan panitia, daftar pemeran, jadwal, RAB, dan estimasi pemasukan diambil otomatis dari sistem.',
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
    description: 'Surat permohonan izin resmi ke Kepala Sekolah dengan kop surat.',
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
    description: 'Surat permohonan bantuan dana, barang, atau sponsorship dengan kop surat.',
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
    description: 'LPJ lengkap dengan kop surat. Daftar hadir, notula rapat, bukti pengeluaran, inventaris, dan dokumentasi diambil otomatis dari sistem.',
    category: 'ADMINISTRASI',
    icon: 'FileCheck',
    color: 'purple',
    allowedRoles: ['Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'],
    withKop: true,
    buildBlocks: buildLPJ,
  },
  {
    id: 'sketsa-panggung',
    title: 'Sketsa dan Denah Panggung',
    shortTitle: 'Sketsa Panggung',
    description: 'Denah 9 zona otomatis dari Prompt Book. Denah per adegan + pasang/bongkar per pergantian.',
    category: 'ARTISTIK',
    icon: 'Layers',
    color: 'purple',
    allowedRoles: ['Koordinator Tata Panggung', 'Anggota Tata Panggung', 'Pimpinan Produksi', 'Guru Pengampu', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildSketsaPanggung,
  },
  {
    id: 'prompt-book',
    title: 'Prompt Book - Buku Sutradara',
    shortTitle: 'Prompt Book',
    description: 'Daftar kru, alat stage manager, daftar adegan, blocking, dan cue list lengkap.',
    category: 'ARTISTIK',
    icon: 'BookOpen',
    color: 'rose',
    allowedRoles: ['Sutradara', 'Asisten Sutradara', 'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildPromptBook,
  },
  {
    id: 'cue-sheet',
    title: 'Cue Sheet - Tata Musik dan Suara',
    shortTitle: 'Cue Sheet',
    description: 'Daftar cue otomatis dari menu Cue Sheet. Checklist persiapan bertimestamp (H-1, 30 menit, Saat pentas).',
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
    description: 'Daftar properti otomatis dari menu Properti. Penanggung jawab per adegan dari Daftar Kru.',
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
    description: 'Konsep dan warna otomatis dari menu Kostum. Dilengkapi penanggung jawab kostum.',
    category: 'ARTISTIK',
    icon: 'Scissors',
    color: 'indigo',
    allowedRoles: ['Koordinator Tata Busana', 'Anggota Tata Busana', 'Pimpinan Produksi', 'Guru Pengampu', 'Admin', 'Super Admin'],
    withKop: false,
    buildBlocks: buildKostum,
  },
  {
    id: 'face-chart',
    title: 'Face Chart - Desain Rias Karakter',
    shortTitle: 'Face Chart',
    description: 'Isi daftar pemeran sekaligus (termasuk Kru rias). Sekali generate, semua face chart tercetak dalam satu dokumen.',
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