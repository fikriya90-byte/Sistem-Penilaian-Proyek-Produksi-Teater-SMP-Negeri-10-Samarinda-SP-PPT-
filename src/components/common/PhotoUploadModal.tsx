import React, { useState, useRef } from 'react';
import {
  X, Upload, Link2, Camera, ExternalLink, Save, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { useToast } from './Toast';
import { openDriveFolder } from '../../core/driveFolders';

interface PhotoUploadModalProps {
  currentPhotoUrl?: string;
  userName: string;
  onSave: (photoUrl: string) => Promise<void>;
  onClose: () => void;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  currentPhotoUrl,
  userName,
  onSave,
  onClose,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
  const [preview, setPreview] = useState<string>(currentPhotoUrl || '');
  const [urlInput, setUrlInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth = 400, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas tidak tersedia'));
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve(base64);
        };
        img.onerror = () => reject(new Error('Gagal memuat gambar'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa gambar (JPG/PNG).', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran file maksimal 5 MB.', 'warning');
      return;
    }

    try {
      const base64 = await compressImage(file);
      const sizeKB = Math.round((base64.length * 3) / 4 / 1024);
      if (sizeKB > 800) {
        showToast(`Foto terlalu besar (${sizeKB} KB setelah kompresi). Coba foto lain atau paste link.`, 'warning');
        return;
      }
      setPreview(base64);
      showToast(`Foto siap diupload (${sizeKB} KB).`, 'success');
    } catch (err: any) {
      showToast('Gagal memproses foto: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      showToast('Isi URL foto terlebih dahulu.', 'warning');
      return;
    }
    if (!urlInput.startsWith('http')) {
      showToast('URL harus dimulai dengan http:// atau https://', 'warning');
      return;
    }
    setPreview(urlInput.trim());
    showToast('URL foto siap digunakan.', 'success');
  };

  const handleOpenDrive = () => {
    openDriveFolder('dokumentasi');
    showToast('Folder Drive terbuka. Upload foto di sana, lalu paste link.', 'info');
  };

  const handleSave = async () => {
    if (!preview) {
      showToast('Belum ada foto yang dipilih.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await onSave(preview);
      showToast('Foto berhasil diperbarui!', 'success');
      onClose();
    } catch (err: any) {
      showToast('Gagal menyimpan foto: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-500" /> Foto
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 flex flex-col items-center">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-amber-400 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-lg">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-slate-400">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">Preview foto</p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'upload' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'link' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" /> Paste URL
          </button>
        </div>

        {activeTab === 'upload' && (
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition flex flex-col items-center justify-center gap-2"
            >
              <Upload className="w-8 h-8 text-amber-500" />
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Pilih Foto dari Perangkat</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">JPG/PNG • Maks 5 MB (auto kompres)</span>
            </button>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 dark:text-blue-300">
                Foto otomatis dikompres jadi <strong>400px</strong> untuk hemat kuota.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'link' && (
          <div className="space-y-3">
            <button
              onClick={handleOpenDrive}
              className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <ExternalLink className="w-4 h-4" /> Buka Folder Google Drive
            </button>

            <div className="relative">
              <Link2 className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              />
            </div>

            <button
              onClick={handleApplyUrl}
              className="w-full py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs"
            >
              Terapkan URL
            </button>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                <strong>Cara:</strong> Buka Drive → Upload foto → Klik kanan → Share → "Anyone with link" → Copy link → Paste.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || !preview}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {submitting ? 'Menyimpan...' : 'Simpan Foto'}
          </button>
        </div>
      </div>
    </div>
  );
};
