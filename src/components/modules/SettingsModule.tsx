import React, { useState } from 'react';
import {
  AlertTriangle, Award, Camera, CheckCircle, Database, Layers, Lock,
  RefreshCw, Save, Settings, Shield, Sliders, User, Users, Mail, Phone,
  CreditCard, Info,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { ProductionStage } from '../../core/types';
import { recordAuditLog, updateProductionStage, updateUserProfile } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { PhotoUploadModal } from '../common/PhotoUploadModal';

export const SettingsModule: React.FC = () => {
  const { user, activeClass, isTeacher, resetDemoDatabase } = useAuth();
  const { showToast } = useToast();

  // Profile states — HANYA yang boleh diedit sendiri
  const [phone, setPhone] = useState(user?.phone || '');
  const [nis, setNis] = useState(user?.nis || '');
  const [secondaryEmail, setSecondaryEmail] = useState(user?.secondaryEmail || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');

  // Weights configuration states
  const [weightGuru, setWeightGuru] = useState(50);
  const [weightKetua, setWeightKetua] = useState(30);
  const [weightRekan, setWeightRekan] = useState(20);

  const [weightPersiapan, setWeightPersiapan] = useState(20);
  const [weightPelaksanaan, setWeightPelaksanaan] = useState(35);
  const [weightPertunjukan, setWeightPertunjukan] = useState(30);
  const [weightPasca, setWeightPasca] = useState(15);

  const [activeStage, setActiveStage] = useState<ProductionStage>('PELAKSANAAN');
  const [isResetting, setIsResetting] = useState(false);

  const totalAssessorWeight = weightGuru + weightKetua + weightRekan;
  const totalStageWeight = weightPersiapan + weightPelaksanaan + weightPertunjukan + weightPasca;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 0 && (cleanPhone.length < 9 || cleanPhone.length > 15)) {
      showToast('Nomor WhatsApp tidak valid (9-15 digit).', 'warning');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateUserProfile(user.uid, {
        phone: phone.trim(),
        nis: nis.trim(),
        secondaryEmail: secondaryEmail.trim(),
        photoURL: photoURL,
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Profile',
        targetId: user.uid,
        details: 'Memperbarui detail profil akun sendiri',
      });

      showToast('Detail akun Anda berhasil diperbarui!', 'success');
    } catch (err: any) {
      showToast('Gagal memperbarui profil: ' + err.message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePhoto = async (newPhotoUrl: string) => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, { photoURL: newPhotoUrl });
      setPhotoURL(newPhotoUrl);
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Profile',
        targetId: user.uid,
        details: 'Memperbarui foto profil',
      });
      showToast('Foto profil berhasil diperbarui!', 'success');
    } catch (err: any) {
      showToast('Gagal simpan foto: ' + err.message, 'error');
    }
  };

  const handleSaveWeights = async () => {
    if (totalAssessorWeight !== 100) {
      showToast('Total bobot multi-penilai wajib 100%!', 'error');
      return;
    }
    if (totalStageWeight !== 100) {
      showToast('Total bobot 4 tahapan produksi wajib 100%!', 'error');
      return;
    }

    try {
      if (activeClass) {
        await updateProductionStage('prod-ix-a', activeStage);
      }
      showToast('Konfigurasi bobot penilaian dan tahapan berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan konfigurasi: ' + err.message, 'error');
    }
  };

  const handleResetData = async () => {
    if (!confirm('PERINGATAN: Apakah Anda yakin ingin menginisialisasi ulang seluruh data demo produksi teater ke setelan awal?')) {
      return;
    }

    setIsResetting(true);
    try {
      await resetDemoDatabase();
      showToast('Basis data produksi teater berhasil direset ke kondisi awal!', 'success');
    } catch (err: any) {
      showToast('Gagal mereset data: ' + err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-amber-400">
              <Settings className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Pengaturan Akun & Konfigurasi Sistem
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Kelola detail akun Anda, konfigurasi penilaian, dan pemeliharaan data
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* === KARTU PROFIL === */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Detail Akun Saya</h3>
          </div>

          {/* Foto Profil */}
          <div className="flex flex-col items-center py-2">
            <div className="relative">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={user?.displayName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-amber-500 text-slate-950 font-black text-3xl flex items-center justify-center border-4 border-amber-300">
                  {user?.displayName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(true)}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition"
                title="Ganti foto profil"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Klik ikon kamera untuk ganti foto</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">

            {/* Nama — TERKUNCI */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                Nama Lengkap
                <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <input
                type="text"
                value={user?.displayName || ''}
                disabled
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Nama hanya dapat diubah oleh Guru/Admin untuk menjaga validitas data.
              </p>
            </div>

            {/* Role — TERKUNCI */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                Peran / Jabatan
                <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-amber-800 flex items-center justify-between">
                <span>{user?.role}</span>
                {user?.divisionName && (
                  <span className="text-[10px] text-slate-500 font-normal">• {user.divisionName}</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Peran/jabatan hanya dapat diubah oleh Guru/Admin.
              </p>
            </div>

            {/* Email — TERKUNCI */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                Email Utama
                <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs font-mono text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Email Sekunder */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Sekunder (Opsional)</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="email"
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  placeholder="Email cadangan untuk reset password"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            {/* NIS */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">NIS / NIP</label>
              <div className="relative">
                <CreditCard className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="Nomor Induk Siswa/Pegawai"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                No. WhatsApp <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08123456789"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Wajib diisi untuk keperluan komunikasi koordinasi produksi.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>

        {/* === KONFIGURASI BOBOT (Khusus Guru) === */}
        {isTeacher && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sliders className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Konfigurasi Pembobotan Penilaian (Khusus Guru)
              </h3>
            </div>

            <div className="space-y-4">
              {/* Multi-assessor weights */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700">Bobot Multi-Penilai:</span>
                  <span className={`text-xs font-extrabold font-mono ${totalAssessorWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Total: {totalAssessorWeight}% {totalAssessorWeight === 100 ? '✓' : '(Harus 100%)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500">Guru (50%)</label>
                    <input
                      type="number"
                      value={weightGuru}
                      onChange={(e) => setWeightGuru(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500">Ketua (30%)</label>
                    <input
                      type="number"
                      value={weightKetua}
                      onChange={(e) => setWeightKetua(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500">Rekan (20%)</label>
                    <input
                      type="number"
                      value={weightRekan}
                      onChange={(e) => setWeightRekan(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Stage Weights */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700">Bobot 4 Tahapan Produksi:</span>
                  <span className={`text-xs font-extrabold font-mono ${totalStageWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Total: {totalStageWeight}%
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 block">Persiapan</span>
                    <input
                      type="number"
                      value={weightPersiapan}
                      onChange={(e) => setWeightPersiapan(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-xs font-bold font-mono mt-0.5 bg-transparent"
                    />
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 block">Pelaksanaan</span>
                    <input
                      type="number"
                      value={weightPelaksanaan}
                      onChange={(e) => setWeightPelaksanaan(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-xs font-bold font-mono mt-0.5 bg-transparent"
                    />
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 block">Pentas</span>
                    <input
                      type="number"
                      value={weightPertunjukan}
                      onChange={(e) => setWeightPertunjukan(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-xs font-bold font-mono mt-0.5 bg-transparent"
                    />
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-500 block">Pasca</span>
                    <input
                      type="number"
                      value={weightPasca}
                      onChange={(e) => setWeightPasca(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-xs font-bold font-mono mt-0.5 bg-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveWeights}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm"
                >
                  Simpan Konfigurasi Bobot
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Database Maintenance Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Database className="w-5 h-5 text-slate-700" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Pemeliharaan Data & Inisialisasi Ulang
            </h3>
            <p className="text-xs text-slate-500">
              Gunakan fitur ini untuk mereset seluruh database Firestore ke setelan proyek teater SMPN 10 Samarinda.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-amber-950 space-y-1">
            <p className="font-bold">Inisialisasi Data Teater Resmi:</p>
            <p className="text-[11px] text-amber-800">
              Menyiapkan kelas IX A-F, produksi, profil guru, checklist tugas, sesi absensi, jadwal, dan akun peran.
            </p>
          </div>

          <button
            type="button"
            disabled={isResetting}
            onClick={handleResetData}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Mereset Data...' : 'Reset & Muat Data Demo'}</span>
          </button>
        </div>
      </div>

      {/* Photo Upload Modal */}
      {isPhotoModalOpen && (
        <PhotoUploadModal
          currentPhotoUrl={photoURL}
          userName={user?.displayName || 'Pengguna'}
          onSave={handleSavePhoto}
          onClose={() => setIsPhotoModalOpen(false)}
        />
      )}

    </div>
  );
};
