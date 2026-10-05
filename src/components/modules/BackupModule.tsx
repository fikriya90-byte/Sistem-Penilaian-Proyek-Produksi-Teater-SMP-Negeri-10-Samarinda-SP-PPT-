import React, { useState } from 'react';
import {
  Database, Download, Upload, ShieldCheck, AlertTriangle, CheckCircle,
  FileText, HardDrive, RefreshCw, X,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { createBackup, downloadBackupJSON, restoreBackup, validateBackupFile, BackupData } from '../../utils/backupRestore';
import { recordAuditLog } from '../../services/firestoreService';

export const BackupModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreData, setRestoreData] = useState<BackupData | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const canAccess = isGuruPengampu || isAdminRole;

  if (!canAccess) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <ShieldCheck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 mt-1">Hanya Guru Pengampu dan Admin yang dapat mengakses backup.</p>
      </div>
    );
  }

  const handleBackup = async () => {
    if (!activeClass) return;
    setIsBackingUp(true);
    try {
      const backup = await createBackup(activeClass.id);
      backup.className = activeClass.name;
      downloadBackupJSON(backup);

      await recordAuditLog({
        userId: user!.uid,
        userName: user!.displayName,
        role: user!.role,
        action: 'CREATE',
        targetType: 'Backup',
        targetId: activeClass.id,
        details: `Backup data ${activeClass.name} — ${Object.values(backup.stats).reduce((a, b) => a + b, 0)} dokumen`,
      });

      showToast('Backup berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast('Gagal backup: ' + err.message, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await validateBackupFile(file);
      setRestoreData(data);
      setIsConfirmOpen(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreData || !user) return;
    setIsRestoring(true);
    setIsConfirmOpen(false);
    try {
      const result = await restoreBackup(restoreData);
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Restore',
        targetId: restoreData.classId,
        details: `Restore data dari backup ${new Date(restoreData.createdAt).toLocaleString('id-ID')}`,
      });
      if (result.errors.length > 0) {
        showToast(`${result.restored} dokumen dipulihkan, ${result.errors.length} error.`, 'warning');
      } else {
        showToast(`${result.restored} dokumen berhasil dipulihkan!`, 'success');
      }
      setRestoreData(null);
    } catch (err: any) {
      showToast('Gagal restore: ' + err.message, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Database className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Backup & Restore
            </span>
            <h2 className="text-xl font-black text-white mt-1">Pemeliharaan Data</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Ekspor seluruh data produksi ke file JSON & pulihkan kapan saja
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-5 rounded-3xl bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <p className="font-extrabold">Data yang akan di-backup:</p>
            <p className="mt-1">
              Kelas, siswa, tugas, nilai, presensi, jadwal, dokumen, kas, properti,
              cue musik, face chart, kostum, aduan, dan seluruh aktivitas lainnya untuk kelas{' '}
              <strong>{activeClass?.name}</strong>.
            </p>
            <p className="mt-2 text-[11px] text-blue-700">
              File backup disimpan lokal (.json) — <strong>tidak dikirim ke server manapun</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Backup & Restore Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backup */}
        <div className="p-6 rounded-3xl bg-white border-2 border-emerald-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-emerald-500 text-white">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Backup Data</h3>
              <p className="text-[11px] text-slate-500">Ekspor semua data kelas ke file JSON</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
            <p className="text-[11px] text-emerald-800">
              ✅ Kelas: <strong>{activeClass?.name}</strong>
            </p>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              📅 Tanggal: <strong>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </p>
          </div>

          <button onClick={handleBackup} disabled={isBackingUp || !activeClass}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
            {isBackingUp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sedang membuat backup...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Backup Sekarang
              </>
            )}
          </button>
        </div>

        {/* Restore */}
        <div className="p-6 rounded-3xl bg-white border-2 border-amber-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-amber-500 text-white">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Restore Data</h3>
              <p className="text-[11px] text-slate-500">Pulihkan data dari file backup</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">
                Data yang sudah ada akan <strong>ditimpa</strong> oleh data dari file backup.
                Pastikan file yang dipilih benar.
              </p>
            </div>
          </div>

          <label className={`w-full py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition ${
            isRestoring ? 'bg-slate-300 text-slate-500' : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}>
            <input type="file" accept=".json" className="hidden" onChange={handleFileSelect} disabled={isRestoring} />
            {isRestoring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sedang memulihkan...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Pilih File Backup
              </>
            )}
          </label>
        </div>
      </div>

      {/* Tips */}
      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200">
        <div className="flex items-start gap-3">
          <HardDrive className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700">
            <p className="font-bold">💡 Tips Pemeliharaan Data:</p>
            <ul className="list-disc pl-4 mt-2 space-y-1 text-[11px]">
              <li>Lakukan backup minimal <strong>1× per minggu</strong> selama produksi</li>
              <li>Simpan file backup di <strong>Google Drive / cloud storage</strong>, jangan hanya di lokal</li>
              <li>Backup sebelum melakukan <strong>reset data</strong> atau perubahan besar</li>
              <li>Beri nama file dengan tanggal, contoh: <code className="bg-slate-200 px-1 rounded">backup-2026-10-05.json</code></li>
              <li>Restore hanya dilakukan jika data rusak / tidak sengaja terhapus</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {isConfirmOpen && restoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Konfirmasi Restore
              </h3>
              <button onClick={() => setIsConfirmOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <p className="text-slate-500">File Backup:</p>
                <p className="font-bold text-slate-900">Kelas {restoreData.className || restoreData.classId}</p>
                <p className="text-[11px] text-slate-500">
                  Dibuat: {new Date(restoreData.createdAt).toLocaleString('id-ID')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs font-bold text-blue-900 mb-2">📊 Data yang akan dipulihkan:</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {Object.entries(restoreData.stats)
                    .filter(([_, count]) => count > 0)
                    .map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between text-[10px] bg-white px-2 py-1 rounded-md border border-blue-100">
                        <span className="text-slate-600 truncate">{key}</span>
                        <span className="font-bold text-blue-800">{count}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-800">
                  Data saat ini akan <strong>ditimpa</strong>. Pastikan Anda sudah backup data terkini sebelum melanjutkan.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                Batal
              </button>
              <button onClick={handleConfirmRestore} disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Ya, Restore Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
