import { DivisionType, ProductionStage, UserRole } from './types';

export const APP_CONFIG = {
  appName: 'SP-PPT',
  schoolName: 'SMP Negeri 10 Samarinda',
  tagline: 'Sistem Penilaian & Manajemen Proyek Produksi Teater Kelas IX',
  academicYear: '2025/2026',
  // Official school & subject assets provided
  logoSchool: 'https://iili.io/nBiviCX.png',
  logoMapel: 'https://iili.io/nap50AB.png',
  bgMotif: 'https://iili.io/nJ1Rcj1.png',
};

export const COLOR_PALETTE = {
  primary: '#D4AF37', // Emas/Kuning
  primaryDark: '#B8972E',
  secondary: '#2E5090', // Biru
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
  { id: 'Pemeran', color: '#E74C3C', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300', description: 'Sutradara, Asisten Sutradara, dan Para Aktor/Aktris' },
  { id: 'Perlengkapan', color: '#2E5090', badgeColor: 'bg-blue-100 text-blue-800 border-blue-300', description: 'Manajemen properti, set alat, dan inventaris' },
  { id: 'Publikasi & Dokumentasi', color: '#27AE60', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', description: 'Poster, kalender konten, foto, video, BTS' },
  { id: 'Tata Panggung', color: '#8E44AD', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300', description: 'Desain set panggung, konstruksi, gladi kering' },
  { id: 'Tata Rias', color: '#E91E63', badgeColor: 'bg-pink-100 text-pink-800 border-pink-300', description: 'Face chart, rias karakter/fantasi, sterilisasi alat' },
  { id: 'Tata Busana', color: '#3F51B5', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300', description: 'Desain kostum, ukuran pemain, fitting, quick change' },
  { id: 'Tata Musik & Suara', color: '#00BCD4', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300', description: 'Konsep musik, cue sheet audio, sound check' },
];

export const ACTOR_CRITERIA = [
  { key: 'hafalan', label: 'Hafalan Dialog', weight: 20, desc: 'Tingkat penguasaan dan kelancaran menghafal baris naskah' },
  { key: 'penjiwaan', label: 'Penjiwaan Karakter', weight: 25, desc: 'Kedalaman emosi, ekspresi wajah, dan penjiwaan peran' },
  { key: 'suara', label: 'Proyeksi Suara & Intonasi', weight: 15, desc: 'Kejelasan vokal, dinamika intonasi, dan daya jangkau suara' },
  { key: 'blocking', label: 'Blocking & Movement', weight: 15, desc: 'Ketepatan posisi panggung, orientasi penonton, keluwesan' },
  { key: 'interaksi', label: 'Interaksi Panggung', weight: 15, desc: 'Respons terhadap lawan main dan dinamika panggung' },
  { key: 'disiplin', label: 'Kedisiplinan', weight: 10, desc: 'Kehadiran latihan tepat waktu, fokus, dan komitmen' },
];

export const GENERAL_CRITERIA = [
  { key: 'kerjasama', label: 'Kerja Sama Tim', weight: 25, desc: 'Koordinasi, komunikasi, dan kolaborasi aktif dengan tim' },
  { key: 'tanggungjawab', label: 'Tanggung Jawab & Eksekusi', weight: 25, desc: 'Kualitas dan ketuntasan tugas divisi yang diberikan' },
  { key: 'disiplin', label: 'Kehadiran & Disiplin', weight: 20, desc: 'Kedisiplinan waktu, presensi rapat, dan kepatuhan aturan' },
  { key: 'kreativitas', label: 'Kreativitas & Inisiatif', weight: 15, desc: 'Ide orisinal, pemecahan masalah, dan inisiatif berkarya' },
  { key: 'teknis', label: 'Keahlian Teknis Divisi', weight: 15, desc: 'Penguasaan alat, kerapian kerja, dan standar keselamatan' },
];

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
