import React, { useState } from 'react';
import {
  Mail, X, Send, CheckCircle, AlertTriangle, Info, KeyRound,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../core/firebase';
import { useToast } from '../common/Toast';

interface ForgotPasswordModalProps {
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Harap masukkan email Anda.', 'warning');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSent(true);
      showToast('Link reset password telah dikirim ke email Anda!', 'success');
    } catch (err: any) {
      const code = err?.code || '';
      let message = 'Gagal mengirim email reset.';
      if (code === 'auth/user-not-found') {
        message = 'Email ini belum terdaftar. Pastikan Anda sudah mendaftar dengan email yang benar.';
      } else if (code === 'auth/invalid-email') {
        message = 'Format email tidak valid.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.';
      } else if (code === 'auth/network-request-failed') {
        message = 'Koneksi internet bermasalah. Cek sinyal Anda.';
      } else {
        message = err?.message || message;
      }
      setErrorMsg(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden my-auto">

        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                <KeyRound className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-black">Lupa Password?</h2>
                <p className="text-[11px] opacity-90">Reset via email</p>
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!sent ? (
            <>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  Masukkan email yang Anda pakai saat mendaftar. Kami akan mengirim
                  <strong> link reset password</strong> ke email tersebut.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Terdaftar
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                      placeholder="ketik email Anda di sini"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
                      {errorMsg}
                    </p>
                  </div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <Send className="w-4 h-4" />
                  {submitting ? 'Mengirim...' : 'Kirim Link Reset'}
                </button>
              </form>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                  <strong>Catatan:</strong> Jika email Anda tidak dikenal, hubungi
                  <strong> Guru Pengampu</strong> atau <strong>Admin</strong> untuk reset manual.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border-2 border-emerald-300 dark:border-emerald-500/40 mb-3">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
                  Email Terkirim!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Kami telah mengirim link reset password ke:
                </p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-1 font-mono break-all">
                  {email}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1.5">
                  Langkah selanjutnya:
                </p>
                <ol className="text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1 pl-4 list-decimal">
                  <li>Buka <strong>kotak masuk email</strong> Anda (Gmail/Outlook/dll)</li>
                  <li>Cari email dari <strong>Firebase / SP-PPT</strong></li>
                  <li>Klik tombol <strong>"Reset Password"</strong> di email</li>
                  <li>Buat password baru (min 6 karakter)</li>
                  <li>Kembali ke aplikasi → login dengan password baru</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  <p className="font-bold">Tidak menerima email?</p>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                    <li>Cek folder <strong>Spam / Promosi</strong></li>
                    <li>Tunggu 1-2 menit (kadang delay)</li>
                    <li>Pastikan email yang dimasukkan benar</li>
                    <li>Jika tetap tidak ada, hubungi Guru Pengampu</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => { setSent(false); setEmail(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  Kirim Ulang ke Email Lain
                </button>
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition">
                  Kembali ke Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
