import { SystemNotification } from '../core/types';

const CATEGORY_TO_MODULE: Record<string, string> = {
  'Tugas': 'tugas',
  'Feedback': 'tugas',
  'Reminder': 'tugas',
  'Pengumuman': 'informasi',
  'Nilai': 'nilai-saya',
  'Urgent': 'informasi',
  'Sistem': 'notifikasi',
  'Keuangan': 'kas',
};

const TITLE_KEYWORDS: Array<{ keywords: string[]; module: string }> = [
  // Prioritas 1: kata kunci spesifik
  { keywords: ['siswa baru', 'murid baru', 'mendaftar', 'pendaftaran siswa'], module: 'kelola-siswa' },
  { keywords: ['reminder deadline', 'deadline terlewat', 'deadline baru', 'tenggat'], module: 'tugas' },
  { keywords: ['reminder jadwal', 'agenda baru'], module: 'jadwal' },
  { keywords: ['presensi', 'absensi', 'kehadiran'], module: 'absensi' },
  { keywords: ['booking', 'peminjaman', 'pinjam alat', 'booking alat'], module: 'booking' },
  { keywords: ['kas', 'iuran', 'tagihan', 'pembayaran'], module: 'kas' },
  { keywords: ['aduan', 'keluhan', 'laporan kasus'], module: 'aduan' },
  { keywords: ['broadcast', 'siaran'], module: 'broadcast' },
  { keywords: ['notulen', 'notulensi', 'catatan rapat'], module: 'notulensi' },
  { keywords: ['nilai', 'penilaian', 'rapor', 'evaluasi'], module: 'nilai-saya' },
  { keywords: ['koordinasi lintas', 'lintas kelas', 'inter-class', 'inter class'], module: 'inter-class' },
  { keywords: ['properti'], module: 'properti' },
  { keywords: ['kostum', 'busana'], module: 'busana' },
  { keywords: ['rias', 'face chart'], module: 'rias' },
  { keywords: ['musik', 'cue', 'audio', 'sound'], module: 'musik' },
  { keywords: ['dokumen', 'arsip', 'berkas'], module: 'dokumen' },
  { keywords: ['backup', 'restore'], module: 'backup' },
  { keywords: ['tahapan', 'stage config'], module: 'kelola-tahapan' },
  { keywords: ['timeline', 'milestone'], module: 'master-timeline' },
  { keywords: ['konten', 'publikasi'], module: 'content-schedule' },
  { keywords: ['papan informasi', 'info baru'], module: 'informasi' },
  { keywords: ['struktur', 'kerabat kerja'], module: 'struktur' },
  { keywords: ['studio', 'naskah'], module: 'studio' },
];

export function resolveNotificationLink(n: SystemNotification): string {
  // 1. Cek n.link eksplisit
  if (n.link && n.link.trim()) {
    return n.link.trim();
  }

  // 2. Cek keyword di title
  const titleLower = (n.title || '').toLowerCase();
  for (const entry of TITLE_KEYWORDS) {
    if (entry.keywords.some(k => titleLower.includes(k))) {
      return entry.module;
    }
  }

  // 3. Cek kategori
  const cat = n.category || '';
  if (CATEGORY_TO_MODULE[cat]) {
    return CATEGORY_TO_MODULE[cat];
  }

  // 4. Fallback
  return 'notifikasi';
}

export function isValidModuleForRole(
  module: string,
  role: string,
  isGuru: boolean,
  isAdmin: boolean,
): boolean {
  const guruOnlyModules = [
    'kelola-siswa', 'kelola-kelas', 'kelola-tahapan',
    'moderasi', 'statistik-absensi', 'aktivitas', 'backup',
  ];
  if (guruOnlyModules.includes(module) && !isGuru && !isAdmin) {
    return false;
  }
  return true;
}