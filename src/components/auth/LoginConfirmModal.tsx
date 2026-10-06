import React from 'react';
import {
  CheckCircle, XCircle, Shield, User, Briefcase, Users, AlertTriangle,
} from 'lucide-react';
import { UserProfile } from '../../core/types';

interface LoginConfirmModalProps {
  user: UserProfile;
  onYes: () => void;
  onNo: () => void;
}

export const LoginConfirmModal: React.FC<LoginConfirmModalProps> = ({ user, onYes, onNo }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden my-auto">

        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-3">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Verifikasi Login</h2>
          <p className="text-xs opacity-90 mt-1">Apakah data di bawah ini benar milik Anda?</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">

          {/* Foto & Nama */}
          <div className="flex flex-col items-center pb-4 border-b border-slate-100 dark:border-slate-700">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-md mb-3"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-amber-500 text-slate-950 font-black text-4xl flex items-center justify-center border-4 border-amber-300 mb-3">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <h3 className="text-lg font-black text-slate-900 dark:text-white text-center">
              {user.displayName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 break-all text-center">
              {user.email}
            </p>
          </div>

          {/* Detail */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Peran</p>
                <p className="font-bold text-slate-900 dark:text-white">{user.role}</p>
              </div>
            </div>

            {user.divisionName && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Divisi</p>
                  <p className="font-bold text-slate-900 dark:text-white">{user.divisionName}</p>
                </div>
              </div>
            )}

            {user.className && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Kelas</p>
                  <p className="font-bold text-slate-900 dark:text-white">{user.className}</p>
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              Jika data ini <strong>bukan milik Anda</strong>, klik <strong>"Bukan Saya"</strong> untuk logout dan mencegah penyalahgunaan akun.
            </p>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={onNo}
              className="py-3 rounded-xl bg-rose-50 dark:bg-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 border-2 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <XCircle className="w-4 h-4" />
              Bukan Saya
            </button>
            <button
              onClick={onYes}
              className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
            >
              <CheckCircle className="w-4 h-4" />
              Ya, Saya Benar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
