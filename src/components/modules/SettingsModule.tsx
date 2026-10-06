import React, { useState } from 'react';
import {
  AlertTriangle, Award, Camera, CheckCircle, Database, Layers, Lock,
  RefreshCw, Save, Settings, Shield, Sliders, User, Users, Mail, Phone,
  CreditCard, Info, Bot, Target,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { ProductionStage } from '../../core/types';
import { ASSESSOR_WEIGHTS, AssessorWeightConfig } from '../../core/constants';
import { recordAuditLog, updateProductionStage, updateUserProfile } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { PhotoUploadModal } from '../common/PhotoUploadModal';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';

const ROLE_KEYS = [
  'Pimpinan Produksi', 'Sutradara',
  'Sekretaris', 'Bendahara',
  'Koordinator Perlengkapan', 'Koordinator Publikasi',
  'Koordinator Tata Panggung', 'Koordinator Tata Rias',
  'Koordinator Tata Busana', 'Koordinator Tata Musik',
  'Anggota Perlengkapan', 'Anggota Publikasi',
  'Anggota Tata Panggung', 'Anggota Tata Rias',
  'Anggota Tata Busana', 'Anggota Tata Musik',
  'Asisten Sutradara', 'Pemeran',
];

export const SettingsModule: React.FC = () => {
  const { user, activeClass, isTeacher, isGuruPengampu, resetDemoDatabase } = useAuth();
  const { showToast } = useToast();

  const [phone, setPhone] = useState(user?.phone || '');
  const [nis, setNis] = useState(user?.nis || '');
  const [secondaryEmail, setSecondaryEmail] = useState(user?.secondaryEmail || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');

  const [weights, setWeights] = useState<Record<string, AssessorWeightConfig>>(() => {
    const initial: Record<string, AssessorWeightConfig> = {};
    ROLE_KEYS.forEach(k => {
      initial[k] = { ...(ASSESSOR_WEIGHTS[k] || { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 }) };
    });
    return initial;
  });
  const [selectedRole, setSelectedRole] = useState<string>('Pimpinan Produksi');

  const [weightPersiapan, setWeightPersiapan] = useState(20);
  const [weightPelaksanaan, setWeightPelaksanaan] = useState(35);
  const [weightPertunjukan, setWeightPertunjukan] = useState(30);
  const [weightPasca, setWeightPasca] = useState(15);

  const [isResetting, setIsResetting] = useState(false);
  const totalStageWeight = weightPersiapan + weightPelaksanaan + weightPertunjukan + weightPasca;
  const currentWeights = weights[selectedRole] || { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 };
  const totalAssessorWeight = currentWeights.GURU + currentWeights.ATASAN + currentWeights.REKAN + currentWeights.BAWAHAN;

  React.useEffect(() => {
    if (!activeClass) return;
    (async () => {
      try {
        const ref = doc(db, 'classes', activeClass.id, 'config', 'assessorWeights');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data().weights;
          if (data) setWeights({ ...weights, ...data });
        }
      } catch (err) { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass]);

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
        photoURL,
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Profile', targetId: user.uid,
        details: 'Memperbarui detail profil',
      });
      showToast('Detail akun berhasil diperbarui!', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setIsSavingProfile(false); }
  };

  const handleSavePhoto = async (newPhotoUrl: string) => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, { photoURL: newPhotoUrl });
      setPhotoURL(newPhotoUrl);
      showToast('Foto profil diperbarui!', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const handleSaveWeights = async () => {
    if (!activeClass) return;

    for (const role of ROLE_KEYS) {
      const w = weights[role];
      const total = w.GURU + w.ATASAN + w.REKAN + w.BAWAHAN;
      if (total !== 100) {
        showToast(`Total bobot untuk ${role} harus 100% (saat ini ${total}%).`, 'error');
        setSelectedRole(role);
        return;
      }
    }

    if (totalStageWeight !== 100) {
      showToast('Total bobot 4 tahapan produksi wajib 100%!', 'error');
      return;
    }

    try {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'assessorWeights');
      await setDoc(ref, {
        weights,
        stageWeights: {
          PERSIAPAN: weightPersiapan,
          PELAKSANAAN: weightPelaksanaan,
          PERTUNJUKAN: weightPertunjukan,
          PASCA: weightPasca,
        },
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid,
      }, { merge: true });

      showToast('Konfigurasi bobot berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  };

  const handleResetData = async () => {
    if (!confirm('PERINGATAN: Reset seluruh data demo ke setelan awal?')) return;
    setIsResetting(true);
    try {
      await resetDemoDatabase();
      showToast('Database berhasil direset!', 'success');
    } catch (err: any) {
      showToast('Gagal reset: ' + err.message, 'error');
    } finally { setIsResetting(false); }
  };

  const updateWeightField = (role: string, field: 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN', value: number) => {
    setWeights(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-amber-400">
            <Settings className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Pengaturan Akun & Konfigurasi Sistem
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Profil, bobot penilaian 360°, tahapan produksi, dan pemeliharaan data
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <User className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Detail Akun Saya</h3>
          </div>

          <div className="flex flex-col items-center py-2">
            <div className="relative">
              {photoURL ? (
                <img src={photoURL} alt={user?.displayName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-md" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-amber-500 text-slate-950 font-black text-3xl flex items-center justify-center border-4 border-amber-300">
                  {user?.displayName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <button type="button" onClick={() => setIsPhotoModalOpen(true)}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600">
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                Nama Lengkap <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <input type="text" value={user?.displayName || ''} disabled
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                Peran / Jabatan <Lock className="w-3 h-3 text-slate-400" />
              </label>
              <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-amber-800 dark:text-amber-300">
                {user?.role}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Sekunder</label>
              <input type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">NIS / NIP</label>
              <input type="text" value={nis} onChange={(e) => setNis(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                No. WhatsApp <span className="text-rose-500">*</span>
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isSavingProfile}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>

        {isTeacher && (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Sliders className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Konfigurasi Bobot Penilaian 360°
              </h3>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Bobot Kelompok Penilai per Peran
              </p>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white mb-2">
                {ROLE_KEYS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <div className={`text-xs font-bold mb-2 ${totalAssessorWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                Total: {totalAssessorWeight}% {totalAssessorWeight === 100 ? '✓' : '(Harus 100%)'}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-300">Guru</label>
                  <input type="number" min="0" max="100" value={currentWeights.GURU}
                    onChange={(e) => updateWeightField(selectedRole, 'GURU', parseInt(e.target.value) || 0)}
                    className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent text-amber-900 dark:text-amber-200" />
                </div>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                  <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-300">Atasan</label>
                  <input type="number" min="0" max="100" value={currentWeights.ATASAN}
                    onChange={(e) => updateWeightField(selectedRole, 'ATASAN', parseInt(e.target.value) || 0)}
                    className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent text-blue-900 dark:text-blue-200" />
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Rekan</label>
                  <input type="number" min="0" max="100" value={currentWeights.REKAN}
                    onChange={(e) => updateWeightField(selectedRole, 'REKAN', parseInt(e.target.value) || 0)}
                    className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent text-emerald-900 dark:text-emerald-200" />
                </div>
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
                  <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300">Bawahan</label>
                  <input type="number" min="0" max="100" value={currentWeights.BAWAHAN}
                    onChange={(e) => updateWeightField(selectedRole, 'BAWAHAN', parseInt(e.target.value) || 0)}
                    className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent text-purple-900 dark:text-purple-200" />
                </div>
              </div>

              <div className="p-2 mt-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                  Jika suatu kelompok tidak ada yang mengisi, bobotnya dibagi proporsional ke kelompok lain.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Bobot 4 Tahapan Produksi
                </span>
                <span className={`text-xs font-extrabold font-mono ${totalStageWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Total: {totalStageWeight}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Persiapan', value: weightPersiapan, set: setWeightPersiapan },
                  { label: 'Pelaksanaan', value: weightPelaksanaan, set: setWeightPelaksanaan },
                  { label: 'Pentas', value: weightPertunjukan, set: setWeightPertunjukan },
                  { label: 'Pasca', value: weightPasca, set: setWeightPasca },
                ].map((s, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block">{s.label}</span>
                    <input type="number" value={s.value}
                      onChange={(e) => s.set(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-xs font-bold font-mono mt-0.5 bg-transparent text-slate-800 dark:text-white" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button type="button" onClick={handleSaveWeights}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm">
                Simpan Konfigurasi Bobot
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-200 dark:border-blue-500/30">
        <div className="flex items-start gap-3">
          <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-black text-blue-900 dark:text-blue-200 mb-1">
              🤖 Skor Otomatis dari Sistem
            </p>
            <ul className="text-blue-800 dark:text-blue-300 space-y-0.5 pl-4 list-disc text-[11px]">
              <li><strong>Tanggung Jawab (25%)</strong>: Dihitung dari % tugas Awal/Tepat (≥90%→4, 75-89%→3, 50-74%→2, &lt;50%→1). Tugas ★ yang terlambat menurunkan skor.</li>
              <li><strong>Kehadiran & Disiplin (20%)</strong>: Dihitung dari % presensi (≥95%→4, 85-94%→3, 70-84%→2, &lt;70%→1). Alpa ≥3× atau di Gladi/Pementasan → maks 2.</li>
              <li><strong>Kedisiplinan Khusus Pemeran (10%)</strong>: Rata-rata skor Tanggung Jawab & Kehadiran.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
          <Database className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pemeliharaan Data</h3>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-amber-900 dark:text-amber-200">
            Reset seluruh database Firestore ke setelan awal (HATI-HATI: menghapus semua data).
          </p>
          <button onClick={handleResetData} disabled={isResetting}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? 'Mereset...' : 'Reset & Muat Demo'}
          </button>
        </div>
      </div>

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
