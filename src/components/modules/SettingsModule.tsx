import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle,
  Database,
  Layers,
  Lock,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sliders,
  User,
  Users
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { ProductionStage } from '../../core/types';
import { recordAuditLog, updateProductionStage, updateUserProfile } from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const SettingsModule: React.FC = () => {
  const { user, activeClass, isTeacher, resetDemoDatabase } = useAuth();
  const { showToast } = useToast();

  // Profile states
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [nis, setNis] = useState(user?.nis || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Weights configuration states
  const [weightGuru, setWeightGuru] = useState(50);
  const [weightKetua, setWeightKetua] = useState(30);
  const [weightRekan, setWeightRekan] = useState(20);

  // Stage weights states
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
    setIsSavingProfile(true);

    try {
      await updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        phone: phone.trim(),
        nis: nis.trim(),
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Profile',
        targetId: user.uid,
        details: 'Memperbarui profil akun',
      });

      showToast('Profil Anda berhasil diperbarui!', 'success');
    } catch (err: any) {
      showToast('Gagal memperbarui profil: ' + err.message, 'error');
    } finally {
      setIsSavingProfile(false);
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
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                Profil pengguna, matriks pembobotan nilai, tahapan produksi, dan pemeliharaan database
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profile Card */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Profil Pengguna Anda</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Peran Aktif</label>
              <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-amber-800">
                {user?.role} {user?.divisionName ? `• ${user.divisionName}` : ''}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NIS / NIP</label>
                <input
                  type="text"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
              >
                {isSavingProfile ? 'Menyimpan...' : 'Perbarui Profil'}
              </button>
            </div>
          </form>
        </div>

        {/* Teacher Configuration Card */}
        {isTeacher && (
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
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
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
                >
                  Simpan Konfigurasi Bobot
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Database Maintenance Card (Explicit Seed/Reset Data) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Database className="w-5 h-5 text-slate-700" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Pemeliharaan Data & Inisialisasi Ulang (Seed Database)
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
              Menyiapkan kelas IX A, IX B, produksi "Legenda Danau Lipan", 16 profil siswa, checklist tugas, sesi absensi, jadwal, naskah digital, dan akun peran untuk seluruh wewenang.
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

    </div>
  );
};
