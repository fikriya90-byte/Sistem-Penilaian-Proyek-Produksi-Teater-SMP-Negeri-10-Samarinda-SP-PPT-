import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const DRIVE_FOLDERS = {
  utama: '',
  publikasi: '',
  dokumentasi: '',
  keuangan: '',
  nota: '',
  properti: '',
  panggung: '',
  rias: '',
  busana: '',
  musik: '',
  naskah: '',
  lpj: '',
};

export type DriveFolderKey = keyof typeof DRIVE_FOLDERS;

export interface DriveConfig {
  label: string;
  desc: string;
  role: string;
  access: 'EDITOR' | 'VIEWER';
}

// ✅ KONFIGURASI ATURAN IZIN AKSES
export const DRIVE_CONFIG: Record<DriveFolderKey, DriveConfig> = {
  utama:       { label: 'Folder Utama Produksi', desc: 'Folder induk yang menampung semua file', role: 'Pimpinan Produksi / Sekretaris', access: 'EDITOR' },
  publikasi:   { label: 'Publikasi & Dokumentasi', desc: 'Poster, teaser, BTS, foto (Semua siswa boleh kontribusi)', role: 'Koordinator Publikasi', access: 'EDITOR' }, 
  dokumentasi: { label: 'Dokumentasi Latihan', desc: 'Foto/video gladi dan latihan (Semua siswa boleh kontribusi)', role: 'Koordinator Publikasi', access: 'EDITOR' }, 
  keuangan:    { label: 'Keuangan & RAB', desc: 'File RAB dan laporan keuangan', role: 'Bendahara', access: 'VIEWER' },
  nota:        { label: 'Nota & Kwitansi', desc: 'Bukti pengeluaran belanja', role: 'Bendahara', access: 'VIEWER' },
  properti:    { label: 'Divisi Perlengkapan', desc: 'Desain properti & inventaris', role: 'Koordinator Perlengkapan', access: 'EDITOR' },
  panggung:    { label: 'Divisi Tata Panggung', desc: 'Sketsa panggung, denah, lighting', role: 'Koordinator Tata Panggung', access: 'EDITOR' },
  rias:        { label: 'Divisi Tata Rias', desc: 'Face chart & moodboard', role: 'Koordinator Tata Rias', access: 'EDITOR' },
  busana:      { label: 'Divisi Tata Busana', desc: 'Desain kostum & referensi kain', role: 'Koordinator Tata Busana', access: 'EDITOR' },
  musik:       { label: 'Divisi Tata Musik', desc: 'File audio, instrumen, cue sheet', role: 'Koordinator Tata Musik', access: 'EDITOR' },
  naskah:      { label: 'Naskah & Skenario', desc: 'File naskah utama (Hanya dibaca)', role: 'Sekretaris', access: 'VIEWER' },
  lpj:         { label: 'LPJ & Laporan Akhir', desc: 'File LPJ yang sudah ditandatangani (Hanya dibaca)', role: 'Pimpinan Produksi / Sekretaris', access: 'VIEWER' },
};

export async function openDriveFolder(key: DriveFolderKey) {
  try {
    const docRef = doc(db, 'systemConfig', 'driveFolders');
    const snap = await getDoc(docRef);
    let url = '';
    if (snap.exists()) {
      url = snap.data()[key] || '';
    }
    
    if (!url || !url.startsWith('http')) {
      const config = DRIVE_CONFIG[key];
      alert(
        `⚠️ Link Google Drive Belum Dibuat!\n\n` +
        `Folder "${config.label}" seharusnya dibuat oleh: *${config.role}*.\n\n` +
        `Silakan hubungi ${config.role} untuk mengatur link di menu Pengaturan.`
      );
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    alert('Terjadi kesalahan saat membuka Google Drive.');
  }
}