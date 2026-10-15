import React, { useState, useRef } from 'react';
import {
  Camera, X, Upload, AlertTriangle, CheckCircle, Image as ImageIcon,
  Trash2, Info, ShieldCheck, ExternalLink,
} from 'lucide-react';
import { useToast } from './Toast';

export interface PhotoEvidence {
  id: string;
  dataUrl: string;   // base64 JPEG terkompresi
  caption?: string;
  uploadedAt: string;
  sizeKB: number;
}

interface PhotoEvidenceUploaderProps {
  photos: PhotoEvidence[];
  onChange: (photos: PhotoEvidence[]) => void;
  maxPhotos?: number;
  required?: boolean;
  hint?: string;                    // teks panduan
  searchQuery?: string;             // untuk tombol "lihat contoh di google"
  maxWidth?: number;                // default 800
  quality?: number;                 // default 0.7
}

// ═══════════════════════════════════════════════════════════
// FILTER KATA KASAR / TERLARANG
// ═══════════════════════════════════════════════════════════
const FORBIDDEN_WORDS = [
  // SARA / diskriminasi
  'kafir', 'cina', 'cino', 'jawa', 'batak', 'papua', 'ambon',
  'pribumi', 'pendatang', 'kafir', 'yahudi', 'kristen', 'islam',
  'hindu', 'buddha', 'kafir', 'sesat', 'kafirin',
  // Pornografi / vulgar
  'sex', 'seks', 'porno', 'porn', 'xxx', 'bugil', 'telanjang',
  'bokep', 'mesum', 'syur', 'vulgar', 'nakeds', 'nude',
  'seksi', 'colok', 'sange', 'sahwat', 'mesum',
  // Kekerasan ekstrem
  'darah', 'mayat', 'bunuh', 'sadis', 'jagal', 'pembunuhan',
  // Kata kasar umum
  'anjing', 'anjg', 'bangsat', 'bajingan', 'kontol', 'memek',
  'ngentot', 'pepek', 'peler', 'tai', 'goblok', 'tolol', 'idiot',
];

function checkForbiddenText(text: string): { has: boolean; found: string[] } {
  if (!text) return { has: false, found: [] };
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const found: string[] = [];
  FORBIDDEN_WORDS.forEach(w => {
    const regex = new RegExp(`\\b${w}\\b|${w}`, 'i');
    if (regex.test(lower) && !found.includes(w)) found.push(w);
  });
  return { has: found.length > 0, found };
}

// ═══════════════════════════════════════════════════════════
// KOMPRES GAMBAR
// ═══════════════════════════════════════════════════════════
function compressImage(file: File, maxWidth: number, quality: number): Promise<{ dataUrl: string; sizeKB: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas tidak tersedia'));
        // Background putih (kalau PNG transparan → jadi putih, aman di JPEG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
        resolve({ dataUrl, sizeKB });
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════
// KOMPONEN UTAMA
// ═══════════════════════════════════════════════════════════
export const PhotoEvidenceUploader: React.FC<PhotoEvidenceUploaderProps> = ({
  photos,
  onChange,
  maxPhotos = 3,
  required = false,
  hint,
  searchQuery,
  maxWidth = 800,
  quality = 0.7,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      showToast(`Maksimal ${maxPhotos} foto. Anda sudah punya ${photos.length}.`, 'warning');
      e.target.value = '';
      return;
    }

    setProcessing(true);
    const newPhotos: PhotoEvidence[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // 1. Validasi tipe
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: bukan gambar`);
        continue;
      }

      // 2. Validasi ukuran awal (max 10MB sebelum kompres)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: >10MB`);
        continue;
      }

      // 3. Filter nama file (kata terlarang)
      const nameCheck = checkForbiddenText(file.name);
      if (nameCheck.has) {
        errors.push(`${file.name}: mengandung kata tidak pantas`);
        continue;
      }

      // 4. Kompres
      try {
        const { dataUrl, sizeKB } = await compressImage(file, maxWidth, quality);

        // 5. Final size check
        if (sizeKB > 300) {
          errors.push(`${file.name}: hasil kompres ${sizeKB}KB (maks 300KB)`);
          continue;
        }

        newPhotos.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          dataUrl,
          caption: '',
          uploadedAt: new Date().toISOString(),
          sizeKB,
        });
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (newPhotos.length > 0) {
      onChange([...photos, ...newPhotos]);
      showToast(`✅ ${newPhotos.length} foto siap. Rata-rata ${Math.round(newPhotos.reduce((s, p) => s + p.sizeKB, 0) / newPhotos.length)}KB.`, 'success');
    }

    if (errors.length > 0) {
      showToast(`⚠️ ${errors.length} foto ditolak: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} lagi)` : ''}`, 'warning');
    }

    e.target.value = '';
    setProcessing(false);
  };

  const handleRemove = (id: string) => {
    onChange(photos.filter(p => p.id !== id));
    showToast('Foto dihapus.', 'info');
  };

  const handleUpdateCaption = (id: string, caption: string) => {
    // Filter caption dari kata terlarang
    const check = checkForbiddenText(caption);
    if (check.has) {
      showToast(`Keterangan mengandung kata tidak pantas: ${check.found.join(', ')}`, 'error');
      return;
    }
    onChange(photos.map(p => p.id === id ? { ...p, caption } : p));
  };

  const openGoogleSearch = () => {
    if (!searchQuery) return;
    const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery + ' siswa sekolah')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const totalSize = photos.reduce((s, p) => s + p.sizeKB, 0);
  const canSave = !required || (photos.length > 0 && declarationChecked);

  return (
    <div className={`p-4 rounded-2xl border-2 space-y-3 ${
      required ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`p-2 rounded-xl ${required ? 'bg-amber-500 text-white' : 'bg-slate-500 text-white'}`}>
            <Camera className="w-4 h-4" />
          </span>
          <div>
            <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              Foto Bukti {required && <span className="text-rose-600 dark:text-rose-400">*WAJIB</span>}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Maks {maxPhotos} foto • Auto-kompres (≤300KB/foto) • Total: {totalSize}KB
            </p>
          </div>
        </div>
        {searchQuery && (
          <button type="button" onClick={openGoogleSearch}
            className="px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Lihat Contoh
          </button>
        )}
      </div>

      {/* Hint */}
      {hint && (
        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong>Contoh foto yang tepat:</strong> {hint}
          </p>
        </div>
      )}

      {/* Grid foto */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <img src={photo.dataUrl} alt="Bukti" className="w-full h-32 object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(photo.id)}
                className="absolute top-1 right-1 p-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md transition"
                title="Hapus foto"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="p-1.5 bg-white dark:bg-slate-900">
                <input
                  type="text"
                  placeholder="Keterangan..."
                  value={photo.caption || ''}
                  onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                  maxLength={60}
                  className="w-full text-[10px] px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                />
                <p className="text-[9px] text-slate-400 mt-0.5 text-right">{photo.sizeKB}KB</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tombol upload */}
      {photos.length < maxPhotos && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleSelectFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className={`w-full py-4 rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 ${
              required
                ? 'border-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20'
                : 'border-slate-300 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className={`w-6 h-6 ${required ? 'text-amber-600' : 'text-slate-500'}`} />
            <span className={`text-xs font-bold ${required ? 'text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'}`}>
              {processing ? 'Memproses...' : `Pilih ${maxPhotos - photos.length} foto lagi`}
            </span>
            <span className="text-[10px] text-slate-500">
              JPG/PNG • Auto-kompres jadi ≤300KB
            </span>
          </button>
        </>
      )}

      {/* Deklarasi sopan */}
      {photos.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={declarationChecked}
              onChange={(e) => setDeclarationChecked(e.target.checked)}
              className="mt-0.5 rounded border-emerald-300 text-emerald-500 focus:ring-emerald-400"
            />
            <div className="text-[10px] leading-relaxed text-emerald-900 dark:text-emerald-200">
              <p className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Saya menyatakan foto ini:
              </p>
              <ul className="list-disc pl-3.5 mt-0.5 space-y-0">
                <li>Tidak mengandung <strong>SARA</strong> (Suku/Agama/Ras/Antar-golongan)</li>
                <li>Tidak mengandung <strong>pornografi</strong> atau unsur vulgar</li>
                <li>Tidak mengandung kekerasan sadis</li>
                <li>Benar-benar hasil kerja/progres saya sendiri</li>
              </ul>
              <p className="mt-1 text-[9px] italic opacity-80">
                Pelanggaran dapat dikenai sanksi akademik dan pelaporan ke guru BK.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Status */}
      {required && !canSave && photos.length === 0 && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-rose-900 dark:text-rose-200">
            <strong>Foto wajib diisi</strong> untuk tugas di tahap PELAKSANAAN.
          </p>
        </div>
      )}

      {required && photos.length > 0 && !declarationChecked && (
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-900 dark:text-amber-200">
            Centang pernyataan di atas untuk melanjutkan.
          </p>
        </div>
      )}

      {canSave && photos.length > 0 && (
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200">
            Foto siap dikirim ({photos.length}/{maxPhotos})
          </p>
        </div>
      )}
    </div>
  );
};

export function isPhotoEvidenceValid(photos: PhotoEvidence[], required: boolean): boolean {
  if (!required) return true;
  return photos.length > 0;
}

export function checkPhotoContent(text: string): { has: boolean; found: string[] } {
  return checkForbiddenText(text);
}
