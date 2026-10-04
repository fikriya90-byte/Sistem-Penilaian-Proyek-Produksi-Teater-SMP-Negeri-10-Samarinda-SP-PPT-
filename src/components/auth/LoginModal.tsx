import React, { useState } from 'react';
import {
  Eye, EyeOff, Lock, LogIn, Mail, Phone, ShieldCheck, UserPlus,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { APP_CONFIG } from '../../core/constants';
import { UserRole } from '../../core/types';
import { useToast } from '../common/Toast';

type LoginTab = 'siswa' | 'guru' | 'admin';

export const LoginModal: React.FC = () => {
  const { classes, loginWithEmail, registerUser } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<LoginTab>('siswa');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register states
  const [regClassCode, setRegClassCode] = useState('');
  const [regTeacherCode, setRegTeacherCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Pemain');
  const [submitting, setSubmitting] = useState(false);

  // Reset form saat pindah tab
  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Harap masukkan Email.', 'warning');
      return;
    }
    if (!password) {
      showToast('Harap masukkan Kata Sandi.', 'warning');
      return;
    }

    setSubmitting(true);
    const res = await loginWithEmail(email, password);
    setSubmitting(false);

    if (res.ok) {
      showToast('Login berhasil! Selamat datang di SP-PPT.', 'success');
    } else {
      showToast(res.message || 'Login gagal.', 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isTeacherMode) {
      if (!regTeacherCode.trim()) {
        showToast('Harap isi Kode Undangan Guru.', 'warning');
        return;
      }
    } else {
      if (!regClassCode.trim()) {
        showToast('Harap isi Kode Kelas.', 'warning');
        return;
      }
    }

    if (!regName.trim() || !regEmail.trim()) {
      showToast('Nama dan Email wajib diisi.', 'warning');
      return;
    }
    if (regPassword.length < 6) {
      showToast('Password minimal 6 karakter.', 'warning');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      showToast('Konfirmasi password tidak cocok!', 'error');
      return;
    }

    setSubmitting(true);
    const result = await registerUser({
      classCode: isTeacherMode ? regTeacherCode : regClassCode,
      displayName: regName,
      email: regEmail,
      phone: regPhone,
      pass: regPassword,
      role: regRole,
      isTeacherRegistration: isTeacherMode,
    });
    setSubmitting(false);

    if (result.success) {
      showToast(result.message, 'success');
      setIsRegistering(false);
    } else {
      showToast(result.message, 'error');
    }
  };

  // Konfigurasi visual per tab
  const tabConfig = {
    siswa: {
      label: '🎭 Siswa',
      title: 'Email Siswa',
      activeClass: 'bg-white text-slate-900 shadow-sm',
    },
    guru: {
      label: '👨‍🏫 Guru',
      title: 'Email Guru',
      activeClass: 'bg-white text-amber-800 shadow-sm',
    },
    admin: {
      label: '🛡️ Admin',
      title: 'Email Administrator',
      activeClass: 'bg-white text-blue-800 shadow-sm',
    },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md"
      style={{
        backgroundImage: `radial-gradient(circle at center, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.98)), url(${APP_CONFIG.bgMotif})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full max-w-lg bg-white/95 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto backdrop-blur-xl">
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border-b border-slate-100 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src={APP_CONFIG.logoSchool} alt="Logo SMPN 10" className="w-14 h-14 object-contain drop-shadow-md" />
            <img src={APP_CONFIG.logoMapel} alt="Logo Seni Budaya" className="w-14 h-14 object-contain drop-shadow-md" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">SP-PPT SAMARINDA</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Sistem Penilaian & Manajemen Proyek Produksi Teater Kelas IX
          </p>
          <p className="text-[11px] text-amber-700 font-bold mt-0.5">
            SMP Negeri 10 Samarinda • T.A. 2025/2026
          </p>
        </div>

        {/* Tab Login: Siswa / Guru / Admin */}
        {!isRegistering && (
          <div className="grid grid-cols-3 p-1.5 m-4 bg-slate-100 rounded-2xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => handleTabChange('siswa')}
              className={`py-2 rounded-xl transition ${
                activeTab === 'siswa' ? tabConfig.siswa.activeClass : 'hover:text-slate-900'
              }`}
            >
              {tabConfig.siswa.label}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('guru')}
              className={`py-2 rounded-xl transition ${
                activeTab === 'guru' ? tabConfig.guru.activeClass : 'hover:text-slate-900'
              }`}
            >
              {tabConfig.guru.label}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`py-2 rounded-xl transition ${
                activeTab === 'admin' ? tabConfig.admin.activeClass : 'hover:text-slate-900'
              }`}
            >
              {tabConfig.admin.label}
            </button>
          </div>
        )}

        <div className="p-6 pt-2">
          {!isRegistering ? (
            /* ============ LOGIN FORM ============ */
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tabConfig[activeTab].title}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    name="spppt_email_field"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ketik email Anda"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">Kata Sandi</label>
                  <button
                    type="button"
                    onClick={() => showToast('Hubungi Guru Pembina / Admin untuk reset password.', 'info')}
                    className="text-[11px] font-semibold text-amber-600 hover:text-amber-700"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    name="spppt_password_field"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ketik kata sandi Anda"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Ingat saya</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Memproses...'
                    : `Masuk Sebagai ${
                        activeTab === 'siswa' ? 'Siswa' : activeTab === 'guru' ? 'Guru' : 'Administrator'
                      }`}
                </span>
              </button>

              {/* Info tambahan & Registrasi */}
              {activeTab !== 'admin' && (
                <div className="text-center pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Belum memiliki akun?{' '}
                    <button
                      type="button"
                      onClick={() => { setIsRegistering(true); setIsTeacherMode(false); }}
                      className="font-bold text-amber-600 hover:text-amber-700"
                    >
                      Daftar Siswa
                    </button>
                    {' • '}
                    <button
                      type="button"
                      onClick={() => { setIsRegistering(true); setIsTeacherMode(true); }}
                      className="font-bold text-blue-600 hover:text-blue-700"
                    >
                      Daftar Guru
                    </button>
                  </p>
                </div>
              )}

              {activeTab === 'admin' && (
                <div className="text-center pt-2 border-t border-slate-100">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Akun Administrator dibuat manual oleh pihak sekolah.
                    <br />
                    Hubungi pengelola sistem jika membutuhkan akses.
                  </p>
                </div>
              )}
            </form>
          ) : (
            /* ============ REGISTER FORM ============ */
            <form onSubmit={handleRegister} className="space-y-3" autoComplete="off">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-amber-500" />
                  {isTeacherMode ? 'Registrasi Guru Pembina' : 'Registrasi Siswa Baru'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Kembali ke Login
                </button>
              </div>

              {/* Toggle mode Guru / Siswa */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsTeacherMode(false)}
                  className={`py-2 rounded-lg transition ${
                    !isTeacherMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  🎭 Siswa
                </button>
                <button
                  type="button"
                  onClick={() => setIsTeacherMode(true)}
                  className={`py-2 rounded-lg transition ${
                    isTeacherMode ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  👨‍🏫 Guru
                </button>
              </div>

              {!isTeacherMode && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Kode Kelas Resmi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={regClassCode}
                    onChange={(e) => setRegClassCode(e.target.value)}
                    placeholder="Ketik kode kelas dari guru Anda"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 uppercase"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Dapatkan kode dari guru seni teater Anda.</p>
                </div>
              )}

              {isTeacherMode && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    Kode Undangan Guru <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={regTeacherCode}
                    onChange={(e) => setRegTeacherCode(e.target.value)}
                    placeholder="Ketik kode undangan khusus guru"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 uppercase"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Hubungi admin sekolah untuk mendapatkan kode undangan guru.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ketik nama lengkap Anda"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Ketik email Anda"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">No. WhatsApp</label>
                  <input
                    type="tel"
                    autoComplete="off"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Opsional"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 karakter"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Ulangi Sandi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang sandi"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              {!isTeacherMode && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Pilihan Peran Awal</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    <option value="Pemain">Pemeran (Aktor/Aktris)</option>
                    <option value="Anggota Perlengkapan">Anggota Divisi Perlengkapan</option>
                    <option value="Anggota Publikasi">Anggota Divisi Publikasi & Dok</option>
                    <option value="Anggota Tata Panggung">Anggota Divisi Tata Panggung</option>
                    <option value="Anggota Tata Rias">Anggota Divisi Tata Rias</option>
                    <option value="Anggota Tata Busana">Anggota Divisi Tata Busana</option>
                    <option value="Anggota Tata Musik">Anggota Divisi Tata Musik</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Guru/koordinator dapat mengubah peran Anda setelah verifikasi.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Memproses...'
                    : isTeacherMode
                    ? 'Daftar Sebagai Guru'
                    : 'Daftarkan Akun Siswa'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
