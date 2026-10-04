import React, { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail, Phone, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { APP_CONFIG } from '../../core/constants';
import { DEMO_USERS } from '../../core/seedData';
import { UserRole } from '../../core/types';
import { useToast } from '../common/Toast';

export const LoginModal: React.FC = () => {
  const { classes, loginWithEmail, loginAsDemoUser, registerStudent } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'guru' | 'siswa' | 'admin'>('siswa');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || 'class-ix-a');
  const [rememberMe, setRememberMe] = useState(true);

  // Registration states
  const [regClassCode, setRegClassCode] = useState('IXA-2025');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Pemain');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      showToast('Harap masukkan Email atau Nomor WhatsApp.', 'warning');
      return;
    }

    const success = await loginWithEmail(emailOrPhone, password);
    if (success) {
      showToast('Login berhasil! Selamat datang di SP-PPT.', 'success');
    } else {
      showToast('Kredensial tidak cocok. Silakan coba akun demo atau periksa kembali.', 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim()) {
      showToast('Harap lengkapi semua isian formulir.', 'warning');
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

    const result = await registerStudent({
      classCode: regClassCode,
      displayName: regName,
      email: regEmail,
      phone: regPhone,
      pass: regPassword,
      role: regRole,
    });

    if (result.success) {
      showToast('Registrasi siswa berhasil! Akun Anda siap digunakan.', 'success');
      setIsRegistering(false);
    } else {
      showToast(result.message, 'error');
    }
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
        
        {/* Header with Logos */}
        <div className="p-6 bg-linear-to-b from-amber-500/10 via-amber-500/5 to-transparent border-b border-slate-100 text-center relative">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img
              src={APP_CONFIG.logoSchool}
              alt="Logo SMPN 10"
              className="w-14 h-14 object-contain drop-shadow-md"
            />
            <img
              src={APP_CONFIG.logoMapel}
              alt="Logo Seni Budaya"
              className="w-14 h-14 object-contain drop-shadow-md"
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            SP-PPT SAMARINDA
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Sistem Penilaian & Manajemen Proyek Produksi Teater Kelas IX
          </p>
          <p className="text-[11px] text-amber-700 font-bold mt-0.5">
            SMP Negeri 10 Samarinda • T.A. 2025/2026
          </p>
        </div>

        {/* Tab Selection */}
        {!isRegistering && (
          <div className="grid grid-cols-3 p-1.5 m-4 bg-slate-100 rounded-2xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setActiveTab('siswa')}
              className={`py-2 rounded-xl transition ${
                activeTab === 'siswa'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              🎭 Siswa
            </button>
            <button
              onClick={() => setActiveTab('guru')}
              className={`py-2 rounded-xl transition ${
                activeTab === 'guru'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              👨‍🏫 Guru
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`py-2 rounded-xl transition ${
                activeTab === 'admin'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              🛡️ Admin
            </button>
          </div>
        )}

        <div className="p-6 pt-2">
          {!isRegistering ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              
              {activeTab === 'siswa' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Kelas Siswa <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.academicYear})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {activeTab === 'guru'
                    ? 'Email Guru'
                    : activeTab === 'admin'
                    ? 'Email Administrator'
                    : 'Email / Nomor WhatsApp Siswa'}
                </label>
                <div className="relative">
                  {emailOrPhone.includes('@') ? (
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  ) : (
                    <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  )}
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder={
                      activeTab === 'guru'
                        ? 'fikriya90@gmail.com'
                        : activeTab === 'admin'
                        ? 'admin@smpn10.sch.id'
                        : 'email@smpn10.sch.id atau 0812...'
                    }
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Kata Sandi (Password)
                  </label>
                  <button
                    type="button"
                    onClick={() => showToast('Hubungi guru pengampu untuk bantuan reset kata sandi.', 'info')}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                  <span>Ingat saya selama 8 jam</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {activeTab === 'guru'
                    ? 'Masuk Sebagai Guru'
                    : activeTab === 'admin'
                    ? 'Masuk Sebagai Admin'
                    : 'Masuk Sebagai Siswa'}
                </span>
              </button>

              {activeTab === 'siswa' && (
                <div className="text-center pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Belum memiliki akun siswa?{' '}
                    <button
                      type="button"
                      onClick={() => setIsRegistering(true)}
                      className="font-bold text-amber-600 hover:text-amber-700"
                    >
                      Daftar di sini
                    </button>
                  </p>
                </div>
              )}

              {/* Instant 1-Click Role Login for Quick Testing */}
              <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                  ⚡ Masuk Cepat Simulasi Peran (1-Klik)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('teacher-fikri')}
                    className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition truncate"
                    title="Fikri Yassaar Arrazaq, S.Sn. (Guru Pembina)"
                  >
                    👨‍🏫 Guru (Fikri)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('student-dude')}
                    className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-800 hover:bg-blue-100 transition truncate"
                    title="Dude Masyud Tualeka (Pimpinan Produksi)"
                  >
                    👑 Pimprod (Dude)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('student-nur-kasih')}
                    className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-800 hover:bg-rose-100 transition truncate"
                    title="Nur Kasih Oktavia (Sutradara)"
                  >
                    🎬 Sutradara (Kasih)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('student-alpine')}
                    className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition truncate"
                    title="alpine alfarizi (Pemain)"
                  >
                    🎭 Pemain (Alpine)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('student-chantika')}
                    className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] font-bold text-purple-800 hover:bg-purple-100 transition truncate"
                    title="Chantika Juliana Setiawan (Sekretaris)"
                  >
                    📋 Sekretaris (Chantika)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('student-naswa')}
                    className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-[11px] font-bold text-teal-800 hover:bg-teal-100 transition truncate"
                    title="Naswa Izdihar (Bendahara)"
                  >
                    💰 Bendahara (Naswa)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('student-jelita')}
                    className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100 transition truncate"
                    title="Jelita Ramadhani (Koordinator Perlengkapan)"
                  >
                    📦 Kor Prop (Jelita)
                  </button>
                  <button
                    type="button"
                    onClick={() => loginAsDemoUser('student-naufal')}
                    className="p-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-[11px] font-bold text-cyan-800 hover:bg-cyan-100 transition truncate"
                    title="Muhammad Naufal Nizar (Koordinator Musik)"
                  >
                    🎵 Kor Musik (Naufal)
                  </button>
                </div>
              </div>

            </form>
          ) : (
            /* Student Registration Form */
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-amber-500" /> Registrasi Siswa Baru
                </span>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Kembali ke Login
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Kode Kelas Resmi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regClassCode}
                  onChange={(e) => setRegClassCode(e.target.value)}
                  placeholder="Contoh: IXA-2025"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Dapatkan kode dari guru seni teater Anda.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Nama Lengkap Siswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nama sesuai absen sekolah"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Email Siswa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="siswa@smpn10.sch.id"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    No. WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0812..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 karakter"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Ulangi Sandi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Konfirmasi sandi"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Pilihan Peran Awal
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="Pemain">Pemeran (Aktor/Aktris)</option>
                  <option value="Anggota Perlengkapan">Anggota Divisi Perlengkapan</option>
                  <option value="Anggota Publikasi">Anggota Divisi Publikasi & Dok</option>
                  <option value="Anggota Tata Panggung">Anggota Divisi Tata Panggung</option>
                  <option value="Anggota Tata Rias">Anggota Divisi Tata Rias</option>
                  <option value="Anggota Tata Busana">Anggota Divisi Tata Busana</option>
                  <option value="Anggota Tata Musik">Anggota Divisi Tata Musik</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Daftarkan Akun Siswa</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
