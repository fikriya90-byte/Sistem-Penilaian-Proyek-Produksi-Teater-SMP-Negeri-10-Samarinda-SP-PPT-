export const DRIVE_FOLDERS = {
  utama: 'https://drive.google.com/drive/folders/1ganti-dengan-folder-utama',
  publikasi: 'https://drive.google.com/drive/folders/1ganti-publikasi',
  dokumentasi: 'https://drive.google.com/drive/folders/1ganti-dokumentasi',
  keuangan: 'https://drive.google.com/drive/folders/1ganti-keuangan',
  nota: 'https://drive.google.com/drive/folders/1ganti-nota',
  properti: 'https://drive.google.com/drive/folders/1ganti-properti',
  panggung: 'https://drive.google.com/drive/folders/1ganti-panggung',
  rias: 'https://drive.google.com/drive/folders/1ganti-rias',
  busana: 'https://drive.google.com/drive/folders/1ganti-busana',
  musik: 'https://drive.google.com/drive/folders/1ganti-musik',
  naskah: 'https://drive.google.com/drive/folders/1ganti-naskah',
  lpj: 'https://drive.google.com/drive/folders/1ganti-lpj',
};

export function openDriveFolder(key: keyof typeof DRIVE_FOLDERS) {
  window.open(DRIVE_FOLDERS[key], '_blank', 'noopener,noreferrer');
}
