import { AssessorCategory, DivisionType, ProductionStage, UserRole } from './types';

export const APP_CONFIG = {
  appName: 'SP-PPT',
  schoolName: 'SMP Negeri 10 Samarinda',
  tagline: 'Sistem Penilaian & Manajemen Proyek Produksi Teater Kelas IX',
  academicYear: '2025/2026',
  logoSchool: 'https://iili.io/nBiviCX.png',
  logoMapel: 'https://iili.io/nap50AB.png',
  bgMotif: 'https://iili.io/nJ1Rcj1.png',
};

export const TEACHER_INVITE_CODE = 'SPPPT-GURU-2025!';

export const COLOR_PALETTE = {
  primary: '#D4AF37',
  primaryDark: '#B8972E',
  secondary: '#2E5090',
  secondaryDark: '#1E3A6E',
  success: '#27AE60',
  warning: '#E67E22',
  danger: '#E74C3C',
  info: '#3498DB',
  neutral: '#95A5A6',
  dark: '#1A1A1A',
};

export const STAGES: { id: ProductionStage; name: string; defaultWeight: number; color: string }[] = [
  { id: 'PERSIAPAN', name: 'Tahap 1: Persiapan', defaultWeight: 20, color: 'border-amber-500 text-amber-600 bg-amber-50' },
  { id: 'PELAKSANAAN', name: 'Tahap 2: Pelaksanaan', defaultWeight: 35, color: 'border-blue-500 text-blue-600 bg-blue-50' },
  { id: 'PERTUNJUKAN', name: 'Tahap 3: Pertunjukan', defaultWeight: 30, color: 'border-purple-500 text-purple-600 bg-purple-50' },
  { id: 'PASCA', name: 'Tahap 4: Pasca Produksi', defaultWeight: 15, color: 'border-emerald-500 text-emerald-600 bg-emerald-50' },
];

export const DIVISIONS: { id: DivisionType; color: string; badgeColor: string; description: string }[] = [
  { id: 'Pengurus Inti', color: '#D4AF37', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300', description: 'Pimpinan Produksi, Sekretaris, Bendahara' },
  { id: 'Pemeran', color: '#E74C3C', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300', description: 'Sutradara, Asisten Sutradara, dan Para Aktor/Aktris (Pemeran)' },
  { id: 'Perlengkapan', color: '#2E5090', badgeColor: 'bg-blue-100 text-blue-800 border-blue-300', description: 'Manajemen properti, set alat, dan inventaris' },
  { id: 'Publikasi & Dokumentasi', color: '#27AE60', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', description: 'Poster, kalender konten, foto, video, BTS' },
  { id: 'Tata Panggung', color: '#8E44AD', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300', description: 'Desain set panggung, tata cahaya, konstruksi, gladi kering' },
  { id: 'Tata Rias', color: '#E91E63', badgeColor: 'bg-pink-100 text-pink-800 border-pink-300', description: 'Face chart, rias karakter/fantasi, sterilisasi alat' },
  { id: 'Tata Busana', color: '#3F51B5', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300', description: 'Desain kostum, ukuran pemeran, fitting, quick change' },
  { id: 'Tata Musik & Suara', color: '#00BCD4', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300', description: 'Konsep musik, cue sheet audio, sound check' },
];

// =====================================================
// KRITERIA PEMERAN (6 poin, 5 manual + 1 otomatis)
// =====================================================
export const PEMERAN_CRITERIA = [
  { key: 'hafalan', label: 'Hafalan Dialog', weight: 20, source: 'MANUAL' as const, desc: 'Hafal dialog pada/sebelum tenggat tanpa dibisiki' },
  { key: 'penjiwaan', label: 'Penjiwaan Karakter', weight: 25, source: 'MANUAL' as const, desc: 'Analisis karakter tepat waktu + perasaan tokoh konsisten' },
  { key: 'suara', label: 'Proyeksi Suara & Intonasi', weight: 15, source: 'MANUAL' as const, desc: 'Terdengar sampai baris belakang, nada bervariasi' },
  { key: 'blocking', label: 'Blocking & Movement', weight: 15, source: 'MANUAL' as const, desc: 'Ingat semua blocking tanpa diingatkan' },
  { key: 'interaksi', label: 'Interaksi Panggung', weight: 15, source: 'MANUAL' as const, desc: 'Responsif, cue tepat, bisa selamatkan adegan' },
  { key: 'kedisiplinan', label: 'Kedisiplinan', weight: 10, source: 'AUTO_DISCIPLINE' as const, desc: 'Otomatis: rata-rata kehadiran & ketepatan tugas' },
];

// =====================================================
// KRITERIA NON-PEMERAN (5 poin, 3 manual + 2 otomatis)
// =====================================================
export const GENERAL_CRITERIA = [
  { key: 'kerja_sama', label: 'Kerja Sama Tim', weight: 25, source: 'MANUAL' as const, desc: 'Hasil & informasi sampai tepat tenggat, mau menerima arahan' },
  { key: 'tanggung_jawab', label: 'Tanggung Jawab', weight: 25, source: 'AUTO_TASK' as const, desc: 'Otomatis dari ketepatan tugas (Awal/Tepat/Telat)' },
  { key: 'kehadiran', label: 'Kehadiran & Disiplin', weight: 20, source: 'AUTO_ATTENDANCE' as const, desc: 'Otomatis dari presensi per tahap' },
  { key: 'kreativitas', label: 'Kreativitas', weight: 15, source: 'MANUAL' as const, desc: 'Punya ide yang membuat hasil lebih baik / kerja lebih cepat' },
  { key: 'teknis', label: 'Keahlian Teknis', weight: 15, source: 'MANUAL' as const, desc: 'Hasil rapi, benar, sesuai permintaan' },
];

// =====================================================
// BOBOT KELOMPOK PENILAI PER PERAN (Section 3.2)
// =====================================================
export interface AssessorWeightConfig {
  GURU: number;
  ATASAN: number;
  REKAN: number;
  BAWAHAN: number;
}

export const ASSESSOR_WEIGHTS: Record<string, AssessorWeightConfig> = {
  'Pimpinan Produksi': { GURU: 40, ATASAN: 0, REKAN: 20, BAWAHAN: 40 },
  'Sutradara':          { GURU: 40, ATASAN: 0, REKAN: 20, BAWAHAN: 40 },
  'Sekretaris':         { GURU: 0,  ATASAN: 60, REKAN: 40, BAWAHAN: 0 },
  'Bendahara':          { GURU: 0,  ATASAN: 60, REKAN: 40, BAWAHAN: 0 },
  'Koordinator Perlengkapan':         { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 },
  'Koordinator Publikasi':            { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 },
  'Koordinator Tata Panggung':        { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 },
  'Koordinator Tata Rias':            { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 },
  'Koordinator Tata Busana':          { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 },
  'Koordinator Tata Musik':           { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 },
  'Anggota Perlengkapan':             { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 },
  'Anggota Publikasi':                { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 },
  'Anggota Tata Panggung':            { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 },
  'Anggota Tata Rias':                { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 },
  'Anggota Tata Busana':              { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 },
  'Anggota Tata Musik':               { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 },
  'Asisten Sutradara':                { GURU: 0, ATASAN: 60, REKAN: 0, BAWAHAN: 40 },
  'Pemeran':                          { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 },
};

// =====================================================
// MATRIKS PENILAI 360° — Siapa menilai siapa
// =====================================================
export interface AssessorRelationship {
  category: AssessorCategory;
  roles: string[];
}

export const ASSESSMENT_MATRIX: Record<string, AssessorRelationship[]> = {
  'Pimpinan Produksi': [
    { category: 'GURU', roles: ['Guru Pengampu'] },
    { category: 'REKAN', roles: ['Sutradara'] },
    { category: 'BAWAHAN', roles: ['Sekretaris', 'Bendahara', 'Koordinator Publikasi', 'Koordinator Perlengkapan'] },
  ],
  'Sutradara': [
    { category: 'GURU', roles: ['Guru Pengampu'] },
    { category: 'REKAN', roles: ['Pimpinan Produksi'] },
    { category: 'BAWAHAN', roles: [
      'Asisten Sutradara',
      'Koordinator Tata Panggung', 'Koordinator Tata Busana', 'Koordinator Tata Rias', 'Koordinator Tata Musik',
      'Anggota Tata Panggung', 'Anggota Tata Busana', 'Anggota Tata Rias', 'Anggota Tata Musik',
      'Pemeran',
    ] },
  ],
  'Sekretaris': [
    { category: 'ATASAN', roles: ['Pimpinan Produksi'] },
    { category: 'REKAN', roles: ['Bendahara'] },
  ],
  'Bendahara': [
    { category: 'ATASAN', roles: ['Pimpinan Produksi'] },
    { category: 'REKAN', roles: ['Sekretaris'] },
  ],
  'Koordinator Perlengkapan': [
    { category: 'ATASAN', roles: ['Pimpinan Produksi'] },
    { category: 'BAWAHAN', roles: ['Anggota Perlengkapan'] },
  ],
  'Koordinator Publikasi': [
    { category: 'ATASAN', roles: ['Pimpinan Produksi'] },
    { category: 'BAWAHAN', roles: ['Anggota Publikasi'] },
  ],
  'Koordinator Tata Panggung': [
    { category: 'ATASAN', roles: ['Sutradara'] },
    { category: 'BAWAHAN', roles: ['Anggota Tata Panggung'] },
  ],
  'Koordinator Tata Rias': [
    { category: 'ATASAN', roles: ['Sutradara'] },
    { category: 'BAWAHAN', roles: ['Anggota Tata Rias'] },
  ],
  'Koordinator Tata Busana': [
    { category: 'ATASAN', roles: ['Sutradara'] },
    { category: 'BAWAHAN', roles: ['Anggota Tata Busana'] },
  ],
  'Koordinator Tata Musik': [
    { category: 'ATASAN', roles: ['Sutradara'] },
    { category: 'BAWAHAN', roles: ['Anggota Tata Musik'] },
  ],
  'Anggota Perlengkapan': [
    { category: 'ATASAN', roles: ['Koordinator Perlengkapan'] },
    { category: 'REKAN', roles: ['Anggota Perlengkapan'] },
  ],
  'Anggota Publikasi': [
    { category: 'ATASAN', roles: ['Koordinator Publikasi'] },
    { category: 'REKAN', roles: ['Anggota Publikasi'] },
  ],
  'Anggota Tata Panggung': [
    { category: 'ATASAN', roles: ['Koordinator Tata Panggung'] },
    { category: 'REKAN', roles: ['Anggota Tata Panggung'] },
  ],
  'Anggota Tata Rias': [
    { category: 'ATASAN', roles: ['Koordinator Tata Rias'] },
    { category: 'REKAN', roles: ['Anggota Tata Rias'] },
  ],
  'Anggota Tata Busana': [
    { category: 'ATASAN', roles: ['Koordinator Tata Busana'] },
    { category: 'REKAN', roles: ['Anggota Tata Busana'] },
  ],
  'Anggota Tata Musik': [
    { category: 'ATASAN', roles: ['Koordinator Tata Musik'] },
    { category: 'REKAN', roles: ['Anggota Tata Musik'] },
  ],
  'Asisten Sutradara': [
    { category: 'ATASAN', roles: ['Sutradara'] },
    { category: 'BAWAHAN', roles: ['Pemeran'] },
  ],
  'Pemeran': [
    { category: 'ATASAN', roles: ['Sutradara', 'Asisten Sutradara'] },
    { category: 'REKAN', roles: ['Pemeran'] },
  ],
};

// =====================================================
// AMBANG SKOR OTOMATIS
// =====================================================
export const AUTO_SCORE_THRESHOLDS = {
  task: {
    excellent: 90, // ≥90% → 4
    good: 75,       // 75-89% → 3
    fair: 50,       // 50-74% → 2
    // <50% → 1
  },
  attendance: {
    excellent: 95, // ≥95% → 4
    good: 85,       // 85-94% → 3
    fair: 70,       // 70-84% → 2
    // <70% → 1
  },
};

export const SCORE_SCALE: Record<number, { label: string; score100: number; badgeColor: string }> = {
  1: { label: 'Kurang', score100: 40, badgeColor: 'bg-red-100 text-red-700 border-red-300' },
  2: { label: 'Cukup', score100: 60, badgeColor: 'bg-orange-100 text-orange-700 border-orange-300' },
  3: { label: 'Baik', score100: 80, badgeColor: 'bg-blue-100 text-blue-700 border-blue-300' },
  4: { label: 'Sangat Baik', score100: 100, badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

export function getPredikat(score: number): { predikat: 'A' | 'B' | 'C' | 'D' | 'E'; label: string; color: string } {
  if (score >= 90) return { predikat: 'A', label: 'Mahir (Sangat Memuaskan)', color: 'text-amber-500 bg-amber-50 border-amber-300' };
  if (score >= 80) return { predikat: 'B', label: 'Kompeten (Baik)', color: 'text-blue-500 bg-blue-50 border-blue-300' };
  if (score >= 70) return { predikat: 'C', label: 'Memenuhi Standar (Cukup)', color: 'text-emerald-500 bg-emerald-50 border-emerald-300' };
  if (score >= 60) return { predikat: 'D', label: 'Perlu Perbaikan (Kurang)', color: 'text-orange-500 bg-orange-50 border-orange-300' };
  return { predikat: 'E', label: 'Tidak Memenuhi Standar', color: 'text-rose-500 bg-rose-50 border-rose-300' };
}

export const DIALOG_PRACTICE_STEPS = [
  { step: 1, title: 'Pemahaman Karakter', tip: 'Analisis latar belakang, motivasi, konflik batin, dan relasi tokoh Anda.' },
  { step: 2, title: 'Memahami Naskah', tip: 'Pahami keseluruhan alur cerita, tema sentral, dan pesan utama naskah drama.' },
  { step: 3, title: 'Penekanan Kata & Frase', tip: 'Tentukan kata kunci penting yang harus mendapat aksentuasi dalam setiap kalimat dialog.' },
  { step: 4, title: 'Intonasi Suara & Emosi', tip: 'Eksplorasi tinggi rendah nada, tempo cepat-lambat, dan warna suara sesuai gejolak emosi.' },
  { step: 5, title: 'Membaca Bersama Lawan Main', tip: 'Berlatihlah membaca berdampingan untuk menyelaraskan ritme dan saling melempar reaksi.' },
  { step: 6, title: 'Gerakan Tubuh & Ekspresi Wajah', tip: 'Sinkronkan kalimat dialog dengan kontak mata, gestur tangan, dan postur tubuh yang luwes.' },
  { step: 7, title: 'Latihan Berdialog Tanpa Naskah', tip: 'Uji hafalan naskah Anda sembari tetap mempertahankan kewajaran berbicara alami.' },
  { step: 8, title: 'Memahami Tujuan Karakter Tiap Adegan', tip: 'Selalu ingat apa yang diinginkan karakter Anda dari lawan bicaranya pada adegan ini.' },
  { step: 9, title: 'Latihan Imajinasi Sensoris', tip: 'Bayangkan suasana ruang, aroma, suhu, dan tekanan situasi dramatis di sekeliling panggung.' },
  { step: 10, title: 'Pementasan Ulang Lengkap', tip: 'Lakukan run-through utuh adegan dengan kostum, properti, dan blocking panggung teruji.' },
];

// =====================================================
// MAPPING ROLE → DIVISI OTOMATIS
// =====================================================
export const ROLE_TO_DIVISION: Record<string, { id: string; name: DivisionType }> = {
  'Pimpinan Produksi': { id: 'div-inti', name: 'Pengurus Inti' },
  'Sekretaris': { id: 'div-inti', name: 'Pengurus Inti' },
  'Bendahara': { id: 'div-inti', name: 'Pengurus Inti' },
  'Sutradara': { id: 'div-pemeran', name: 'Pemeran' },
  'Asisten Sutradara': { id: 'div-pemeran', name: 'Pemeran' },
  'Pemeran': { id: 'div-pemeran', name: 'Pemeran' },
  'Koordinator Perlengkapan': { id: 'div-perlengkapan', name: 'Perlengkapan' },
  'Anggota Perlengkapan': { id: 'div-perlengkapan', name: 'Perlengkapan' },
  'Koordinator Publikasi': { id: 'div-pubdok', name: 'Publikasi & Dokumentasi' },
  'Anggota Publikasi': { id: 'div-pubdok', name: 'Publikasi & Dokumentasi' },
  'Koordinator Tata Panggung': { id: 'div-panggung', name: 'Tata Panggung' },
  'Anggota Tata Panggung': { id: 'div-panggung', name: 'Tata Panggung' },
  'Koordinator Tata Rias': { id: 'div-rias', name: 'Tata Rias' },
  'Anggota Tata Rias': { id: 'div-rias', name: 'Tata Rias' },
  'Koordinator Tata Busana': { id: 'div-busana', name: 'Tata Busana' },
  'Anggota Tata Busana': { id: 'div-busana', name: 'Tata Busana' },
  'Koordinator Tata Musik': { id: 'div-musik', name: 'Tata Musik & Suara' },
  'Anggota Tata Musik': { id: 'div-musik', name: 'Tata Musik & Suara' },
};

export function getDivisionFromRole(role: string): { id: string; name: DivisionType } {
  return ROLE_TO_DIVISION[role] || { id: '', name: 'Pemeran' };
}

export function getAssessorWeights(targetRole: string): AssessorWeightConfig {
  return ASSESSOR_WEIGHTS[targetRole] || { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 };
}

export function getAssessmentMatrix(targetRole: string): AssessorRelationship[] {
  return ASSESSMENT_MATRIX[targetRole] || [];
}
export const ACTOR_CRITERIA = PEMERAN_CRITERIA;
