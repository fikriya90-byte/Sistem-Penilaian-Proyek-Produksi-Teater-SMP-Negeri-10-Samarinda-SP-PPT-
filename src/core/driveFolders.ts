// ===================================================
// KONFIGURASI FOLDER GOOGLE DRIVE
// ===================================================
// GANTI URL DI BAWAH dengan link folder Drive tim Anda.
// Cara: buka folder Drive → Copy Link → Paste di sini.
// Folder harus di-set "Anyone with the link can view/edit".
// ===================================================

export const DRIVE_FOLDERS = {
  // Folder Utama Produksi (semua divisi)
  utama: 'https://drive.google.com/drive/folders/1ganti-dengan-folder-utama',

  // Folder Publikasi & Dokumentasi
  publikasi: 'https://drive.google.com/drive/folders/1ganti-publikasi',
  dokumentasi: 'https://drive.google.com/drive/folders/1ganti-dokumentasi',

  // Folder Keuangan & Bukti Nota
  keuangan: 'https://drive.google.com/drive/folders/1ganti-keuangan',
  nota: 'https://drive.google.com/drive/folders/1ganti-nota',

  // Folder per Divisi
  properti: 'https://drive.google.com/drive/folders/1ganti-properti',
  panggung: 'https://drive.google.com/drive/folders/1ganti-panggung',
  rias: 'https://drive.google.com/drive/folders/1ganti-rias',
  busana: 'https://drive.google.com/drive/folders/1ganti-busana',
  musik: 'https://drive.google.com/drive/folders/1ganti-musik',

  // Folder Naskah & Dokumen
  naskah: 'https://drive.google.com/drive/folders/1ganti-naskah',
  lpj: 'https://drive.google.com/drive/folders/1ganti-lpj',
};

// Helper untuk membuka folder di tab baru
export function openDriveFolder(key: keyof typeof DRIVE_FOLDERS) {
  window.open(DRIVE_FOLDERS[key], '_blank', 'noopener,noreferrer');
}
