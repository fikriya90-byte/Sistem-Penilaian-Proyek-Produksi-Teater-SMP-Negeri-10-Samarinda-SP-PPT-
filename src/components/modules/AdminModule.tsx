import React, { useState, useEffect } from 'react';
import {
  UserPlus, Users, GraduationCap, Shield, Search, Mail, Phone,
  Trash2, KeyRound, RefreshCw, Copy, CheckCircle2, AlertTriangle,
  ShieldCheck, BookOpen, X, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { UserProfile } from '../../core/types';
import { fetchAllUsers } from '../../services/firestoreService';
import {
  createTeacherAccount,
  sendPasswordReset,
  deleteUserProfile,
} from '../../services/adminService';
import { useToast } from '../common/Toast';

export const AdminModule: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'guru' | 'siswa'>('guru');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form create teacher
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Password yang baru dibuat (untuk ditampilkan ke admin agar bisa dikirim ke guru)
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await fetchAllUsers();
      setAllUsers(list);
    } catch (err) {
      console.warn('Gagal load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const teachers = allUsers.filter(u =>
    u.role === 'Guru Pembina' || u.role === 'Admin' || u.role === 'Super Admin'
  );

  const students = allUsers.filter(u =>
    u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin'
  );

  const activeList = activeTab === 'guru' ? teachers : students;

  const filteredList = activeList.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.className || '').toLowerCase().includes(q)
    );
  });

  // Generate password random
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleOpenCreateModal = () => {
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword(generatePassword());
    setShowPassword(true);
    setGeneratedEmail('');
    setGeneratedPassword('');
    setIsCreateModalOpen(true);
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 6) {
      showToast('Lengkapi nama, email, dan password minimal 6 karakter.', 'warning');
      return;
    }

    setSubmitting(true);
    const result = await createTeacherAccount({
      email: newEmail,
      password: newPassword,
      displayName: newName,
      phone: newPhone,
    });
    setSubmitting(false);

    if (result.success) {
      setGeneratedEmail(newEmail);
      setGeneratedPassword(newPassword);
      showToast(result.message, 'success');
      loadUsers();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleCloseAndReset = () => {
    setIsCreateModalOpen(false);
    setGeneratedPassword('');
    setGeneratedEmail('');
  };

  const handleResetPassword = async (target: UserProfile) => {
    if (!confirm(`Kirim link reset password ke ${target.email}?\n\nGuru akan menerima email dari Firebase untuk mengganti password sendiri.`)) return;
    const res = await sendPasswordReset(target.email);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleDeleteProfile = async (target: UserProfile) => {
    if (!confirm(`Hapus profil ${target.displayName} dari Firestore?\n\nCatatan: Akun Firebase Auth TIDAK ikut terhapus — harus dihapus manual di Firebase Console (Authentication → Users).`)) return;
    const res = await deleteUserProfile(target.uid);
    if (res.success) {
      showToast(res.message, 'info');
      loadUsers();
      setSelectedUser(null);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin ke clipboard.`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-slate-900 to-slate-800 text-white shadow-xl border border-blue-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <ShieldCheck className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Panel Administrator
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Manajemen Akun Guru & Siswa
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Kelola akun guru pembina dan siswa seluruh kelas SP-PPT SMPN 10 Samarinda
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Buat Akun Guru Baru</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Total Akun Guru</p>
            <p className="text-xl font-black text-slate-900">{teachers.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Total Akun Siswa</p>
            <p className="text-xl font-black text-slate-900">{students.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Administrator</p>
            <p className="text-xl font-black text-slate-900">
              {allUsers.filter(u => u.role === 'Admin' || u.role === 'Super Admin').length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold">Total Semua Akun</p>
            <p className="text-xl font-black text-slate-900">{allUsers.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('guru')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'guru' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Guru ({teachers.length})
            </button>
            <button
              onClick={() => setActiveTab('siswa')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'siswa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Siswa ({students.length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={`Cari ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
              />
            </div>
            <button
              onClick={loadUsers}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
            Memuat data pengguna...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            {searchQuery
              ? 'Tidak ada hasil yang cocok dengan pencarian.'
              : `Belum ada akun ${activeTab} yang terdaftar.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Nama</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4">Kontak</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map(u => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 border border-slate-200 text-xs">
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.displayName}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                            UID: {u.uid.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono text-[11px]">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          u.role === 'Guru Pembina'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : u.role === 'Admin' || u.role === 'Super Admin'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{u.className || '-'}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{u.phone || '-'}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
                          title="Detail"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition"
                          title="Kirim Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(u)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                          title="Hapus Profil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Buat Akun Guru Baru */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 my-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900">Buat Akun Guru Baru</h3>
              </div>
              <button onClick={handleCloseAndReset} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatedPassword ? (
              /* ==== SUKSES: Tampilkan Kredensial ==== */
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900">
                    <p className="font-extrabold">Akun guru berhasil dibuat!</p>
                    <p className="text-[11px] mt-0.5">
                      Kirimkan kredensial berikut ke guru melalui WhatsApp pribadi. Guru bisa mengganti password sendiri setelah login.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Email</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs font-mono font-bold text-slate-900 break-all">{generatedEmail}</p>
                      <button onClick={() => handleCopy(generatedEmail, 'Email')} className="p-1.5 text-slate-500 hover:text-slate-800">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Password</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs font-mono font-bold text-slate-900 break-all">{generatedPassword}</p>
                      <button onClick={() => handleCopy(generatedPassword, 'Password')} className="p-1.5 text-slate-500 hover:text-slate-800">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCloseAndReset}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                >
                  Selesai
                </button>
              </div>
            ) : (
              /* ==== FORM ==== */
              <form onSubmit={handleCreateTeacher} className="p-6 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap Guru <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Ahmad Fauzi, S.Pd."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nama.guru@smpn10.sch.id"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0812..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password Sementara <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 pr-20 rounded-xl border border-slate-200 text-xs font-mono font-semibold text-slate-800"
                    />
                    <div className="absolute right-2 top-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNewPassword(generatePassword()); setShowPassword(true); }}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Acak
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Guru wajib mengganti password ini setelah login pertama.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <p>
                    Setelah akun dibuat, salin password dan kirim ke guru via WhatsApp pribadi.
                    Password tidak akan ditampilkan lagi setelah modal ini ditutup.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseAndReset}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Membuat...' : 'Buat Akun Guru'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Detail User */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Detail Pengguna</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Nama</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedUser.displayName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Email</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="font-mono text-slate-900 break-all">{selectedUser.email}</p>
                  <button onClick={() => handleCopy(selectedUser.email, 'Email')} className="p-1 text-slate-500">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Role</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedUser.role}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Kelas</p>
                <p className="font-bold text-slate-900 mt-0.5">{selectedUser.className || '-'}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase">UID</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="font-mono text-[10px] text-slate-900 break-all">{selectedUser.uid}</p>
                  <button onClick={() => handleCopy(selectedUser.uid, 'UID')} className="p-1 text-slate-500">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleResetPassword(selectedUser)}
                className="flex-1 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" /> Reset Password
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
