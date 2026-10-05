import React, { useState } from 'react';
import {
  Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck, UserPlus, X, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { APP_CONFIG } from '../../core/constants';
import { UserRole } from '../../core/types';
import { useToast } from '../common/Toast';

type LoginTab = 'siswa' | 'guru' | 'admin';

// ============ DAFTAR ROLE UNTUK REGISTRASI SISWA ============
const STUDENT_ROLE_GROUPS: { label: string; roles: { value: UserRole; label: string }[] }[] = [
  {
    label: 'Pengurus Inti',
    roles: [
      { value: 'Pimpinan Produksi', label: 'Pimpinan Produksi' },
      { value: 'Sekretaris', label: 'Sekretaris' },
      { value: 'Bendahara', label: 'Bendahara' },
    ],
  },
  {
    label: 'Pemeran & Penyutradaraan',
    roles: [
      { value: 'Sutradara', label: 'Sutradara' },
      { value: 'Asisten Sutradara', label: 'Asisten Sutradara' },
      { value: 'Pemain', label: 'Pemain (Aktor / Aktris)' },
    ],
  },
  {
    label: 'Koordinator Divisi',
    roles: [
      { value: 'Koordinator Perlengkapan', label: 'Koordinator Perlengkapan' },
      { value: 'Koordinator Publikasi', label: 'Koordinator Publikasi & Dokumentasi' },
      { value: 'Koordinator Tata Panggung', label: 'Koordinator Tata Panggung' },
      { value: 'Koordinator Tata Rias', label: 'Koordinator Tata Rias' },
      { value: 'Koordinator Tata Busana', label: 'Koordinator Tata Busana' },
      { value: 'Koordinator Tata Musik', label: 'Koordinator Tata Musik & Suara' },
    ],
  },
  {
    label: 'Anggota Divisi',
    roles: [
      { value: 'Anggota Perlengkapan', label: 'Anggota Perlengkapan' },
      { value: 'Anggota Publikasi', label: 'Anggota Publikasi & Dokumentasi' },
      { value: 'Anggota Tata Panggung', label: 'Anggota Tata Panggung' },
      { value: 'Anggota Tata Rias', label: 'Anggota Tata Rias' },
      { value: 'Anggota Tata Busana', label: 'Anggota Tata Busana' },
      { value: 'Anggota Tata Musik', label: 'Anggota Tata Musik & Suara' },
    ],
  },
];

export const LoginModal: React.FC = () => {
  const { loginWithEmail, registerUser } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<LoginTab>('siswa');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [regClassCode, setRegClassCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Pemain');
  const [submitting, setSubmitting] = useState(false);

  const [roleMismatch, setRoleMismatch] = useState<{
    loggedInAs: string;
    expectedTab: LoginTab;
    actualRole: string;
  } | null>(null);

  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRoleMismatch(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { showToast('Harap masukkan Email.', 'warning'); return; }
    if (!password) { showToast('Harap masukkan Kata Sandi.', 'warning'); return; }

    setSubmitting(true);
    setRoleMismatch(null);

    const res = await loginWithEmail(email, password);
    setSubmitting(false);

    if (!res.ok) {
      showToast(res.message || 'Login gagal.', 'error');
      return;
    }

    const role = res.role || '';
    // Backward compat: terima dua varian role guru
    const isGuruRole = role === 'Guru Pengampu' || role === 'Guru Pembina';
    const isAdminRole = role === 'Admin' || role === 'Super Admin';
    const isStudentRole = !isGuruRole && !isAdminRole;

    let mismatch = false;
    let expectedRole = '';

    if (activeTab === 'guru' && !isGuruRole) {
      mismatch = true;
      expectedRole = isAdminRole ? 'Admin' : 'Siswa';
    } else if (activeTab === 'admin' && !isAdminRole) {
      mismatch = true;
      expectedRole = isGuruRole ? 'Guru' : 'Siswa';
    } else if (activeTab === 'siswa' && !isStudentRole) {
      mismatch = true;
      expectedRole = isAdminRole ? 'Admin' : 'Guru';
    }

    if (mismatch) {
      setRoleMismatch({
        loggedInAs: role,
        expectedTab: activeTab,
        actualRole: expectedRole,
      });
      showToast(`Akun ini adalah ${role}. Silakan gunakan tab ${expectedRole}.`, 'warning');
      return;
    }

    showToast('Login berhasil! Selamat datang di SP-PPT.', 'success');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regClassCode.trim()) { showToast('Harap isi Kode Kelas.', 'warning'); return; }
    if (!regName.trim() || !regEmail.trim()) { showToast('Nama dan Email wajib diisi.', 'warning'); return; }
    if (regPassword.length < 6) { showToast('Password minimal 6 karakter.', 'warning'); return; }
    if (regPassword !== regConfirmPassword) { showToast('Konfirmasi password tidak cocok!', 'error'); return; }

    setSubmitting(true);
    const result = await registerUser({
      classCode: regClassCode,
      displayName: regName,
      email: regEmail,
      phone: regPhone,
      pass: regPassword,
      role: regRole,
      isTeacherRegistration: false,
    });
    setSubmitting(false);

    if (result.success) {
      showToast(result.message, 'success');
      setIsRegistering(false);
    } else {
      showToast(result.message, 'error');
    }
  };

  const tabConfig = {
    siswa: { label: 'Siswa', title: 'Email Siswa', activeClass: 'bg-white text-slate-900 shadow-sm' },
    guru: { label: 'Guru', title: 'Email Guru', activeClass: 'bg-white text-amber-800 shadow-sm' },
    admin: { label: 'Admin', title: 'Email Administrator', activeClass: 'bg-white text-blue-800 shadow-sm' },
  };

  const mismatchLabel: Record<LoginTab, string> = {
    guru: 'Guru',
    admin: 'Admin',
    siswa: 'Siswa',
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

        {!isRegistering && (
          <div className="grid grid-cols-3 p-1.5 m-4 bg-slate-100 rounded-2xl text-xs font-bold text-slate-600">
            <button type="button" onClick={() => handleTabChange('siswa')}
              className={`py-2 rounded-xl transition ${activeTab === 'siswa' ? tabConfig.siswa.activeClass : 'hover:text-slate-900'}`}>
              {tabConfig.siswa.label}
            </button>
            <button type="button" onClick={() => handleTabChange('guru')}
              className={`py-2 rounded-xl transition ${activeTab === 'guru' ? tabConfig.guru.activeClass : 'hover:text-slate-900'}`}>
              {tabConfig.guru.label}
            </button>
            <button type="button" onClick={() => handleTabChange('admin')}
              className={`py-2 rounded-xl transition ${activeTab === 'admin' ? tabConfig.admin.activeClass : 'hover:text-slate-900'}`}>
              {tabConfig.admin.label}
            </button>
          </div>
        )}

        <div className="p-6 pt-2">
          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              {roleMismatch && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-rose-900">
                    <p className="font-extrabold">Role tidak cocok dengan tab login</p>
                    <p className="mt-1 leading-relaxed">
                      Akun <strong>{email}</strong> terdaftar sebagai <strong>{roleMismatch.loggedInAs}</strong>.
                      Silakan gunakan tab <strong>{mismatchLabel[roleMismatch.expectedTab]}</strong> untuk masuk.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleTabChange(roleMismatch.expectedTab)}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px]"
                    >
                      Ganti ke Tab {mismatchLabel[roleMismatch.expectedTab]}
                    </button>
                  </div>
                  <button type="button" onClick={() => setRoleMismatch(null)}
                    className="p-1 text-rose-400 hover:text-rose-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tabConfig[activeTab].title}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input type="email" required name="spppt_email_field" autoComplete="off"
                    value={email} onChange={(e) => { setEmail(e.target.value); setRoleMismatch(null); }}
                    placeholder="Ketik email Anda"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">Kata Sandi</label>
                  <button type="button"
                    onClick={() => showToast('Hubungi Guru Pengampu / Admin untuk reset password.', 'info')}
                    className="text-[11px] font-semibold text-amber-600 hover:text-amber-700">
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} required name="spppt_password_field"
                    autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ketik kata sandi Anda"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                <span>Ingat saya</span>
              </label>

              <button type="submit" disabled={submitting}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950'
                }`}>
                <LogIn className="w-4 h-4" />
                <span>
                  {submitting ? 'Memproses...' : `Masuk Sebagai ${
                    activeTab === 'siswa' ? 'Siswa' : activeTab === 'guru' ? 'Guru' : 'Administrator'
                  }`}
                </span>
              </button>

              {activeTab !== 'admin' && (
                <div className="text-center pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Belum memiliki akun?{' '}
                    <button type="button"
                      onClick={() => setIsRegistering(true)}
                      className="font-bold text-amber-600 hover:text-amber-700">
                      Daftar Siswa
                    </button>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Akun Guru dibuat oleh Administrator melalui panel sistem.
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
            <form onSubmit={handleRegister} className="space-y-3" autoComplete="off">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-amber-500" />
                  Registrasi Siswa Baru
                </span>
                <button type="button" onClick={() => setIsRegistering(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                  Kembali ke Login
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Kode Kelas Resmi <span className="text-rose-500">*</span>
                </label>
                <input type="text" required autoComplete="off" value={regClassCode}
                  onChange={(e) => setRegClassCode(e.target.value)}
                  placeholder="Ketik kode kelas dari guru Anda"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 uppercase" />
                <p className="text-[10px] text-slate-400 mt-0.5">Dapatkan kode dari guru seni teater Anda.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input type="text" required autoComplete="off" value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ketik nama lengkap Anda"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input type="email" required autoComplete="off" value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Ketik email Anda"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">No. WhatsApp</label>
                  <input type="tel" autoComplete="off" value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)} placeholder="Opsional"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <input type="password" required autoComplete="new-password" value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)} placeholder="Min 6 karakter"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Ulangi Sandi <span className="text-rose-500">*</span>
                  </label>
                  <input type="password" required autoComplete="new-password" value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Ketik ulang sandi"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
              </div>

              {/* ====== DROPDOWN ROLE LENGKAP ====== */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Pilih Peran / Jabatan dalam Produksi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
                >
                  {STUDENT_ROLE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.roles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Pilih peran Anda dalam kepanitiaan produksi. Guru/koordinator dapat mengubah peran setelah verifikasi.
                </p>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50">
                <UserPlus className="w-4 h-4" />
                <span>{submitting ? 'Memproses...' : 'Daftarkan Akun Siswa'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
