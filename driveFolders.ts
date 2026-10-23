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

// Peta penanggung jawab folder
export const RESPONSIBLE_ROLES: Record<DriveFolderKey, string> = {
  utama: 'Pimpinan Produksi / Sekretaris',
  publikasi: 'Koordinator Publikasi',
  dokumentasi: 'Koordinator Publikasi',
  keuangan: 'Bendahara',
  nota: 'Bendahara',
  properti: 'Koordinator Perlengkapan',
  panggung: 'Koordinator Tata Panggung',
  rias: 'Koordinator Tata Rias',
  busana: 'Koordinator Tata Busana',
  musik: 'Koordinator Tata Musik',
  naskah: 'Sekretaris',
  lpj: 'Pimpinan Produksi / Sekretaris',
};

// Helper untuk membuka folder di tab baru (Async)
export async function openDriveFolder(key: DriveFolderKey) {
  try {
    const docRef = doc(db, 'systemConfig', 'driveFolders');
    const snap = await getDoc(docRef);

    let url = '';

    if (snap.exists()) {
      const data = snap.data();
      url = data[key] || '';
    }

    // Jika URL kosong atau tidak valid
    if (!url || !url.startsWith('http')) {
      const roleTugas = RESPONSIBLE_ROLES[key] || 'Pengurus';
      alert(
        `⚠️ Link Google Drive Belum Dibuat!\n\n` +
        `Folder ini seharusnya dibuat dan diisi linknya oleh: *${roleTugas}*.\n\n` +
        `Silakan ingatkan atau hubungi ${roleTugas} untuk segera membuat folder di Google Drive dan memasukkan link-nya di menu Pengaturan > Link Google Drive.`
      );
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Gagal membuka Drive:', error);
    alert('Terjadi kesalahan saat membuka Google Drive.');
  }
}