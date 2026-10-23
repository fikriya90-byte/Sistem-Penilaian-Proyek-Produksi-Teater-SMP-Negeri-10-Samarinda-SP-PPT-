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

export const DRIVE_CONFIG: Record<DriveFolderKey, DriveConfig> = {
  utama:       { label: 'Folder Utama Produksi', desc: 'Folder induk', role: 'Pimpinan Produksi / Sekretaris', access: 'EDITOR' },
  publikasi:   { label: 'Publikasi & Dokumentasi', desc: 'Foto/Video', role: 'Koordinator Publikasi', access: 'EDITOR' }, 
  dokumentasi: { label: 'Dokumentasi Latihan', desc: 'Foto latihan', role: 'Koordinator Publikasi', access: 'EDITOR' }, 
  keuangan:    { label: 'Keuangan & RAB', desc: 'File RAB', role: 'Bendahara', access: 'VIEWER' },
  nota:        { label: 'Nota & Kwitansi', desc: 'Bukti belanja', role: 'Bendahara', access: 'VIEWER' },
  properti:    { label: 'Divisi Perlengkapan', desc: 'Desain properti', role: 'Koordinator Perlengkapan', access: 'EDITOR' },
  panggung:    { label: 'Divisi Tata Panggung', desc: 'Sketsa panggung', role: 'Koordinator Tata Panggung', access: 'EDITOR' },
  rias:        { label: 'Divisi Tata Rias', desc: 'Face chart', role: 'Koordinator Tata Rias', access: 'EDITOR' },
  busana:      { label: 'Divisi Tata Busana', desc: 'Desain kostum', role: 'Koordinator Tata Busana', access: 'EDITOR' },
  musik:       { label: 'Divisi Tata Musik', desc: 'File audio', role: 'Koordinator Tata Musik', access: 'EDITOR' },
  naskah:      { label: 'Naskah & Skenario', desc: 'File naskah', role: 'Sekretaris', access: 'VIEWER' },
  lpj:         { label: 'LPJ & Laporan Akhir', desc: 'File LPJ', role: 'Pimpinan Produksi / Sekretaris', access: 'VIEWER' },
};

export async function openDriveFolder(key: DriveFolderKey) {
  try {
    const docRef = doc(db, 'systemConfig', 'driveFolders');
    const snap = await getDoc(docRef);
    let url = '';
    if (snap.exists()) {
      url = (snap.data()[key] || '').trim();
    }
    
    if (!url || !url.startsWith('http')) {
      const config = DRIVE_CONFIG[key];
      alert(
        `⚠️ Link Folder Belum Diatur!\n\n` +
        `Folder "${config.label}" seharusnya dibuat oleh: ${config.role}.\n\n` +
        `Sistem akan membuka Google Drive. Silakan buat folder baru, atur akses menjadi "${config.access}", lalu tempelkan link-nya di menu Pengaturan.`
      );
      window.open('https://drive.google.com', '_blank', 'noopener,noreferrer');
      return;
    }
    
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Gagal buka drive:', error);
    alert('Terjadi kesalahan sistem. Membuka Google Drive...');
    window.open('https://drive.google.com', '_blank', 'noopener,noreferrer');
  }
}