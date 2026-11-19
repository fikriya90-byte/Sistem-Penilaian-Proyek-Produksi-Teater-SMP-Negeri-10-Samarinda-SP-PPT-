// src/components/modules/MigrationPanel.tsx
// ================================================
// Panel migrasi data lama — bisa di-embed di mana saja
// ================================================

import React, { useState } from 'react';
import {
  Wrench, Database, AlertTriangle, CheckCircle, Loader2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { runAllMigrations } from '../../services/migrationService';

interface MigrationPanelProps {
  /** Override classId. Kalau tidak diisi, pakai activeClass.id */
  classId?: string;
}

export const MigrationPanel: React.FC<MigrationPanelProps> = ({ classId: propClassId }) => {
  const { activeClass, isAdminRole, isGuruPengampu } = useAuth();
  const { showToast } = useToast();
  const [migrating, setMigrating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [result, setResult] = useState<{
    attendanceClassId: { fixed: number; skipped: number; errors: string[]; message: string };
    attendanceStage: { fixed: number; skipped: number; errors: string[]; message: string };
    deadlineTargets: { fixed: number; skipped: number; errors: string[]; message: string };
    summary: string;
  } | null>(null);

  const targetClassId = propClassId || activeClass?.id;
  const canRun = isAdminRole || isGuruPengampu;

  // Sembunyikan total untuk non-admin/guru
  if (!canRun) return null;

  // Belum pilih kelas
  if (!targetClassId) {
    return (
      <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            Pilih kelas aktif terlebih dahulu untuk menjalankan migrasi.
          </p>
        </div>
      </div>
    );
  }

  const handleMigrate = async () => {
    if (!confirm(
      'JALANKAN MIGRASI DATA LAMA?\n\n' +
      'Akan memperbaiki:\n' +
      '• classId yang hilang di attendanceRecords\n' +
      '• stage yang kosong di attendanceSessions\n' +
      '• targetUserIds yang kosong di deadlines\n\n' +
      'Aman dijalankan berkali-kali. Tidak akan mengubah data yang sudah OK.'
    )) return;

    setMigrating(true);
    setResult(null);
    try {
      const res = await runAllMigrations(targetClassId);
      setResult(res);
      setShowDetails(true);
      showToast(res.summary, 'success');
    } catch (err: any) {
      showToast('Migrasi gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setMigrating(false);
    }
  };

  const hasErrors = result && (
    result.attendanceClassId.errors.length > 0 ||
    result.attendanceStage.errors.length > 0 ||
    result.deadlineTargets.errors.length > 0
  );

  return (
    <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0">
          <Wrench className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
            Migrasi Data Lama
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Perbaiki data lama yang belum punya field wajib (classId, stage, targetUserIds)
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-amber-200 dark:border-amber-500/30 mb-3 text-xs text-amber-900 dark:text-amber-200">
        <p className="font-bold mb-1">Yang akan diperbaiki:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><strong>classId</strong> di attendanceRecords → untuk statistik presensi</li>
          <li><strong>stage</strong> di attendanceSessions → untuk auto-score per tahap</li>
          <li><strong>targetUserIds</strong> di deadlines → untuk progress & filter tugas</li>
        </ul>
        <p className="text-[10px] italic opacity-80 mt-1.5">
          💡 Aman dijalankan berkali-kali. Tidak akan mengubah data yang sudah OK.
        </p>
      </div>

      {/* Tombol */}
      <button
        onClick={handleMigrate}
        disabled={migrating}
        className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition"
      >
        {migrating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Memigrasikan...</>
        ) : (
          <><Database className="w-4 h-4" /> Jalankan Migrasi</>
        )}
      </button>

      {/* Hasil */}
      {result && (
        <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="font-bold text-emerald-900 dark:text-emerald-200 truncate">
                {result.summary}
              </p>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0"
              title={showDetails ? 'Sembunyikan detail' : 'Tampilkan detail'}
            >
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showDetails && (
            <div className="space-y-1 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700 pt-2">
              <p>• Attendance classId: <strong>{result.attendanceClassId.fixed}</strong> diperbaiki, <strong>{result.attendanceClassId.skipped}</strong> skip</p>
              <p>• Attendance stage: <strong>{result.attendanceStage.fixed}</strong> diperbaiki, <strong>{result.attendanceStage.skipped}</strong> skip</p>
              <p>• Deadline targets: <strong>{result.deadlineTargets.fixed}</strong> diperbaiki, <strong>{result.deadlineTargets.skipped}</strong> skip</p>
            </div>
          )}

          {hasErrors && showDetails && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Ada error ({[
                  ...result.attendanceClassId.errors,
                  ...result.attendanceStage.errors,
                  ...result.deadlineTargets.errors,
                ].length})
              </summary>
              <div className="mt-1 text-[10px] text-rose-700 dark:text-rose-300 font-mono space-y-0.5 max-h-32 overflow-y-auto">
                {[
                  ...result.attendanceClassId.errors,
                  ...result.attendanceStage.errors,
                  ...result.deadlineTargets.errors,
                ].map((e: string, i: number) => (
                  <p key={i} className="truncate">• {e}</p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
