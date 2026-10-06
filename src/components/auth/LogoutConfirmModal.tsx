import React from 'react';
import { LogOut, XCircle, AlertTriangle } from 'lucide-react';

interface LogoutConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-500 to-rose-700 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm mb-2">
            <LogOut className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black">Konfirmasi Logout</h2>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              Apakah Anda yakin ingin <strong>keluar</strong> dari SP-PPT?
              Anda perlu login kembali untuk melanjutkan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={onCancel}
              className="py-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <XCircle className="w-4 h-4" />
              Batal
            </button>
            <button
              onClick={onConfirm}
              className="py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-700 hover:from-rose-600 hover:to-rose-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
            >
              <LogOut className="w-4 h-4" />
              Ya, Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
