import React, { useState } from 'react';
import {
  Database, Download, Upload, ShieldCheck, AlertTriangle, CheckCircle,
  HardDrive, RefreshCw, X,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  createBackup, downloadBackupJSON, restoreBackup, validateBackupFile, BackupData,
} from '../../utils/backupRestore';
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
        details: `Backup data ${activeClass.name}`,
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
        details: `Restore data dari backup`,
      });
      showToast(`${result.restored} dokumen berhasil dipulihkan!`, 'success');
      setRestoreData(null);
    } catch (err: any) {
      showToast('Gagal restore: ' + err.message, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
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
            <p className="text-xs text-slate-300 mt-0.5">Ekspor & pulihkan data produksi teater</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-3xl bg-white border-2 border-emerald-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-emerald-500 text-white">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Backup Data</h3>
              <p className="text-[11px] text-slate-500">Ekspor ke file JSON</p>
            </div>
          </div>
          <button onClick={handleBackup} disabled={isBackingUp || !activeClass}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
            {isBackingUp ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sedang backup...</> : <><Download className="w-4 h-4" /> Backup Sekarang</>}
          </button>
        </div>

        <div className="p-6 rounded-3xl bg-white border-2 border-amber-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-amber-500 text-white">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Restore Data</h3>
              <p className="text-[11px] text-slate-500">Pulihkan dari file backup</p>
            </div>
          </div>
          <label className={`w-full py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer ${
            isRestoring ? 'bg-slate-300 text-slate-500' : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}>
            <input type="file" accept=".json" className="hidden" onChange={handleFileSelect} disabled={isRestoring} />
            {isRestoring ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sedang restore...</> : <><Upload className="w-4 h-4" /> Pilih File Backup</>}
          </label>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <HardDrive className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <p className="font-bold">💡 Tips:</p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
              <li>Backup minimal 1× per minggu</li>
              <li>Simpan file di Google Drive</li>
              <li>Beri nama dengan tanggal: backup-2026-10-05.json</li>
            </ul>
          </div>
        </div>
      </div>

      {isConfirmOpen && restoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Konfirmasi Restore
              </h3>
              <button onClick={() => setIsConfirmOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-3">
              <p className="text-slate-500">File Backup:</p>
              <p className="font-bold text-slate-900">Kelas {restoreData.className || restoreData.classId}</p>
              <p className="text-[11px] text-slate-500">Dibuat: {new Date(restoreData.createdAt).toLocaleString('id-ID')}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 mb-4">
              <p className="text-[11px] text-rose-800">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> Data saat ini akan <strong>ditimpa</strong>.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
              <button onClick={handleConfirmRestore} disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" /> Ya, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
