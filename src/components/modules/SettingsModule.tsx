// src/components/modules/SettingsModule.tsx
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Camera, Database, Lock,
  RefreshCw, Save, Settings, Sliders, User, Users, Phone,
  Bot, Target, Link2, Folder, ExternalLink, HelpCircle, CheckCircle2, XCircle
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { ASSESSOR_WEIGHTS, AssessorWeightConfig } from '../../core/constants';
import { recordAuditLog, updateUserProfile } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { PhotoUploadModal } from '../common/PhotoUploadModal';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';

// ✅ KITA DEFINISIKAN LANGSUNG DI SINI AGAR TIDAK PERLU IMPORT
export type DriveFolderKey = 'utama' | 'publikasi' | 'dokumentasi' | 'keuangan' | 'nota' | 'properti' | 'panggung' | 'rias' | 'busana' | 'musik' | 'naskah' | 'lpj';

export interface DriveConfig {
  label: string;
  desc: string;
  role: string;
  access: 'EDITOR' | 'VIEWER';
}

const DRIVE_CONFIG: Record<DriveFolderKey, DriveConfig> = {
  utama:       { label: 'Folder Utama Produksi', desc: 'Folder induk', role: 'Pimpinan Produksi / Sekretaris', access: 'EDITOR' },
  publikasi:   { label: 'Publikasi & Dokumentasi', desc: 'Foto/Video', role: 'Koordinator Publikasi', access: 'EDITOR' }, 
  dokumentasi: { label: 'Dokumentasi Latihan', desc: 'Foto latihan', role: 'Koordinator Publikasi', access: 'EDITOR' }, 
  keuangan:    { label: 'Keuangan & RAB', desc: 'File RAB', role: 'Bendahara', access: 'VIEWER' },
  nota:        { label: 'Nota & Kwitansi', desc: 'Bukti belanja', role: 'Bendahara', access: 'VIEWER' },
  properti:    { label: 'Divisi Perlengkapan', desc: 'Desain properti', role: 'Koordinator Perlengkapan', access: 'EDITOR' },
  panggung:    { label: 'Divisi Tata Panggung', desc: 'Sketsa panggung', role: 'Koordinator Tata Panggung', access: 'EDITOR' },
  rias:        { label: 'Divisi Tata Rias', desc: 'Face chart', role: 'Koordinator Tata Rias', access: 'EDITOR' },
  busana:      { label: 'Divisi Tata Busana', desc: 'Desain kostum', role: 'Koordinator Tata Busana', access: 'EDITOR' },
  musik:       { label: 'Divisi Tata Musik', desc: 'File audio', role: 'Koordinator Tata Musik', access: 'EDITOR' },
  naskah:      { label: 'Naskah & Skenario', desc: 'File naskah', role: 'Sekretaris', access: 'VIEWER' },
  lpj:         { label: 'LPJ & Laporan Akhir', desc: 'File LPJ', role: 'Pimpinan Produksi / Sekretaris', access: 'VIEWER' },
};

const ROLE_KEYS = [
  'Pimpinan Produksi', 'Sutradara', 'Sekretaris', 'Bendahara',
  'Koordinator Perlengkapan', 'Koordinator Publikasi', 'Koordinator Tata Panggung', 'Koordinator Tata Rias', 'Koordinator Tata Busana', 'Koordinator Tata Musik',
  'Anggota Perlengkapan', 'Anggota Publikasi', 'Anggota Tata Panggung', 'Anggota Tata Rias', 'Anggota Tata Busana', 'Anggota Tata Musik', 'Asisten Sutradara', 'Pemeran',
];

const DRIVE_KEYS: { key: DriveFolderKey; label: string; desc: string }[] = [
  { key: 'utama', label: 'Folder Utama Produksi', desc: 'Folder induk yang menampung semua file' },
  { key: 'publikasi', label: 'Publikasi & Dokumentasi', desc: 'Poster, teaser, BTS, foto' },
  { key: 'dokumentasi', label: 'Dokumentasi Latihan', desc: 'Foto/video gladi dan latihan' },
  { key: 'keuangan', label: 'Keuangan & RAB', desc: 'File RAB, laporan keuangan, LPJ' },
  { key: 'nota', label: 'Nota & Kwitansi', desc: 'Bukti pengeluaran belanja' },
  { key: 'properti', label: 'Divisi Perlengkapan', desc: 'Desain properti & inventaris' },
  { key: 'panggung', label: 'Divisi Tata Panggung', desc: 'Sketsa panggung, denah, lighting' },
  { key: 'rias', label: 'Divisi Tata Rias', desc: 'Face chart & moodboard' },
  { key: 'busana', label: 'Divisi Tata Busana', desc: 'Desain kostum & referensi kain' },
  { key: 'musik', label: 'Divisi Tata Musik', desc: 'File audio, instrumen, cue sheet' },
  { key: 'naskah', label: 'Naskah & Skenario', desc: 'File naskah utama yang sudah final' },
  { key: 'lpj', label: 'LPJ & Laporan Akhir', desc: 'File LPJ yang sudah ditandatangani' },
];

export const SettingsModule: React.FC = () => {
  const { user, activeClass, isTeacher, isGuruPengampu, isAdminRole, isPimprod, isSekretaris, isKoordinator, isBendahara, resetDemoDatabase } = useAuth();
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

  // STATE UNTUK LINK DRIVE
  const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);

  const isGuruRole = user?.role === 'Guru Pengampu';
  const isPhoneMissing = isGuruRole && !phone.trim();
  const isPhoneInvalid = isGuruRole && phone.trim().length > 0 && (phone.replace(/\D/g, '').length < 9 || phone.replace(/\D/g, '').length > 15);
  
  const canManageDrive = isGuruPengampu || isAdminRole || isPimprod || isSekretaris || isKoordinator || isBendahara;

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

  // LOAD DRIVE LINKS
  useEffect(() => {
    if (!canManageDrive) return;
    setLoadingDrive(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'systemConfig', 'driveFolders'));
        if (snap.exists()) {
          setDriveLinks(snap.data());
        }
      } catch (err) {
        console.warn('Gagal load drive links:', err);
      } finally {
        setLoadingDrive(false);
      }
    })();
  }, [canManageDrive]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanPhone = phone.replace(/\D/g, '');

    if (user.role === 'Guru Pengampu') {
      if (!cleanPhone || cleanPhone.length < 9 || cleanPhone.length > 15) {
        showToast('Guru Pengampu WAJIB isi nomor WhatsApp valid (9-15 digit).', 'error');
        return;
      }
    } else if (cleanPhone.length > 0 && (cleanPhone.length < 9 || cleanPhone.length > 15)) {
      showToast('Nomor WhatsApp tidak valid (9-15 digit).', 'warning');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateUserProfile(user.uid, { phone: phone.trim(), nis: nis.trim(), secondaryEmail: secondaryEmail.trim(), photoURL });
      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'UPDATE', targetType: 'Profile', targetId: user.uid, details: 'Memperbarui detail profil' });
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
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
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
      await setDoc(ref, { weights, stageWeights: { PERSIAPAN: weightPersiapan, PELAKSANAAN: weightPelaksanaan, PERTUNJUKAN: weightPertunjukan, PASCA: weightPasca }, updatedAt: new Date().toISOString(), updatedBy: user?.uid }, { merge: true });
      showToast('Konfigurasi bobot berhasil disimpan!', 'success');
    } catch (err: any) { showToast('Gagal menyimpan: ' + err.message, 'error'); }
  };

  const handleSaveDriveLinks = async () => {
    if (!user) return;
    
    const cleanedLinks: Record<string, string> = {};
    Object.entries(driveLinks).forEach(([k, v]) => {
      cleanedLinks[k] = (v || '').trim();
    });

    const invalidKeys = Object.entries(cleanedLinks).filter(([k, v]) => v !== '' && !v.startsWith('http'));
    if (invalidKeys.length > 0) { 
      showToast('Link harus dimulai dengan http:// atau https://', 'warning'); 
      return; 
    }

    setIsSavingDrive(true);
    try {
      await setDoc(doc(db, 'systemConfig', 'driveFolders'), { ...cleanedLinks, updatedAt: new Date().toISOString(), updatedBy: user.displayName }, { merge: true });
      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'UPDATE', targetType: 'DriveSettings', targetId: 'systemConfig', details: 'Memperbarui link folder Google Drive' });
      showToast('Link Google Drive berhasil disimpan!', 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); } finally { setIsSavingDrive(false); }
  };

  const handleResetData = async () => {
    if (!confirm('PERINGATAN: Reset seluruh data demo ke setelan awal?')) return;
    setIsResetting(true);
    try {
      await resetDemoDatabase();
      showToast('Database berhasil direset!', 'success');
    } catch (err: any) { showToast('Gagal reset: ' + err.message, 'error'); } finally { setIsResetting(false); }
  };

  const updateWeightField = (role: string, field: 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN', value: number) => {
    setWeights(prev => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
  };

  const filledLinksCount = Object.values(driveLinks).filter(url => url && url.startsWith('http')).length;
  const totalLinksRequired = DRIVE_KEYS.length;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-amber-400"><Settings className="w-6 h-6" /></span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Pengaturan Akun & Konfigurasi Sistem</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Profil, bobot penilaian, folder Drive, dan pemeliharaan data</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KARTU PROFIL (Kiri) */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <User className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Detail Akun Saya</h3>
          </div>

          {isGuruRole && isPhoneMissing && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-extrabold text-rose-900 dark:text-rose-200">Nomor WA Belum Diisi</p>
                <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-1 leading-relaxed">Sebagai Guru Pengampu, Anda <strong>wajib</strong> mengisi nomor WhatsApp.</p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center py-2">
            <div className="relative">
              {photoURL ? <img src={photoURL} alt={user?.displayName} className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-md" /> : <div className="w-24 h-24 rounded-full bg-amber-500 text-slate-950 font-black text-3xl flex items-center justify-center border-4 border-amber-300">{user?.displayName?.charAt(0).toUpperCase() || '?'}</div>}
              <button type="button" onClick={() => setIsPhotoModalOpen(true)} className="absolute bottom-0 right-0 p-2 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600"><Camera className="w-4 h-4" /></button>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">Nama Lengkap <Lock className="w-3 h-3 text-slate-400" /></label>
              <input type="text" value={user?.displayName || ''} disabled className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">Peran / Jabatan <Lock className="w-3 h-3 text-slate-400" /></label>
              <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-amber-800 dark:text-amber-300">{user?.role}</div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Sekunder</label>
              <input type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">NIS / NIP</label>
              <input type="text" value={nis} onChange={(e) => setNis(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> No. WhatsApp {isGuruRole && <span className="text-rose-500 font-black">* WAJIB</span>}</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required={isGuruRole} placeholder={isGuruRole ? '0812... (wajib untuk notifikasi booking)' : '0812...'} className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold text-slate-800 dark:text-white bg-white dark:bg-slate-800 ${isGuruRole && (isPhoneMissing || isPhoneInvalid) ? 'border-2 border-rose-400 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700'}`} />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isSavingProfile || (isGuruRole && isPhoneMissing)} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}</button>
            </div>
          </form>
        </div>

        {/* KARTU BOBOT PENILAIAN (Kanan) */}
        {isTeacher && (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <Sliders className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Konfigurasi Bobot Penilaian 360°</h3>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Bobot Kelompok Penilai per Peran</p>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white mb-2">
                {ROLE_KEYS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className={`text-xs font-bold mb-2 ${totalAssessorWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>Total: {totalAssessorWeight}% {totalAssessorWeight === 100 ? '✓' : '(Harus 100%)'}</div>
              <div className="grid grid-cols-4 gap-2">
                {['GURU', 'ATASAN', 'REKAN', 'BAWAHAN'].map(cat => (
                  <div key={cat} className={`p-2 rounded-xl border text-center ${cat === 'GURU' ? 'bg-amber-50 border-amber-200' : cat === 'ATASAN' ? 'bg-blue-50 border-blue-200' : cat === 'REKAN' ? 'bg-emerald-50 border-emerald-200' : 'bg-purple-50 border-purple-200'}`}>
                    <label className={`block text-[10px] font-bold ${cat === 'GURU' ? 'text-amber-700' : cat === 'ATASAN' ? 'text-blue-700' : cat === 'REKAN' ? 'text-emerald-700' : 'text-purple-700'}`}>{cat}</label>
                    <input type="number" min="0" max="100" value={currentWeights[cat as keyof AssessorWeightConfig]} onChange={(e) => updateWeightField(selectedRole, cat as any, parseInt(e.target.value) || 0)} className="w-full text-center text-sm font-black font-mono mt-1 bg-transparent text-slate-900" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Bobot 4 Tahapan Produksi</span>
                <span className={`text-xs font-extrabold font-mono ${totalStageWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>Total: {totalStageWeight}%</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[{ label: 'Persiapan', value: weightPersiapan, set: setWeightPersiapan }, { label: 'Pelaksanaan', value: weightPelaksanaan, set: setWeightPelaksanaan }, { label: 'Pentas', value: weightPertunjukan, set: setWeightPertunjukan }, { label: 'Pasca', value: weightPasca, set: setWeightPasca }].map((s, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block">{s.label}</span>
                    <input type="number" value={s.value} onChange={(e) => s.set(parseInt(e.target.value) || 0)} className="w-full text-center text-xs font-bold font-mono mt-0.5 bg-transparent text-slate-800 dark:text-white" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button type="button" onClick={handleSaveWeights} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm">Simpan Bobot</button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ KARTU PENGATURAN LINK GOOGLE DRIVE */}
      {canManageDrive && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Link Folder Google Drive</h3>
                <p className="text-[11px] text-slate-500">Tugas Pengurus & Divisi untuk menyiapkan folder arsip.</p>
              </div>
            </div>
            
            <div className={`px-3 py-1.5 rounded-lg border-2 flex items-center gap-2 text-xs font-bold ${
              filledLinksCount === totalLinksRequired 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              {filledLinksCount === totalLinksRequired ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              Terisi: {filledLinksCount} / {totalLinksRequired} Folder
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 space-y-3">
            <p className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" /> Panduan Membuat Folder Drive (Wajib Dibaca):
            </p>
            <ol className="text-[11px] text-blue-800 dark:text-blue-300 list-decimal pl-5 space-y-1 leading-relaxed">
              <li><strong>LOGIN</strong> ke akun Google Anda terlebih dahulu.</li>
              <li>Buka aplikasi <strong>Google Drive</strong> → Klik <strong>+ (Baru)</strong> → <strong>Folder Baru</strong>.</li>
              <li>Klik kanan folder tersebut → Pilih <strong>Bagikan (Share)</strong>.</li>
              <li>Ubah akses menjadi <strong>"Siapa saja yang memiliki link"</strong>.</li>
              <li className="font-bold text-blue-900 dark:text-blue-200">
                ⚠️ PERHATIKAN IZINNYA: Jika kotak di bawah bertuliskan "Editor", pastikan Anda memilih <strong>Editor</strong> (agar orang lain bisa upload). Jika bertuliskan "Pelihat", pilih <strong>Pelihat (Viewer)</strong>.
              </li>
              <li>Klik <strong>Salin Link</strong>, lalu tempelkan di kolom di bawah ini.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DRIVE_KEYS.map(item => {
              const isFilled = !!(driveLinks[item.key] && driveLinks[item.key].startsWith('http'));
              const cfg = DRIVE_CONFIG[item.key];
              const isEditor = cfg.access === 'EDITOR';
              
              return (
                <div key={item.key} className={`p-3 rounded-xl border transition ${
                  isFilled 
                    ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30' 
                    : 'bg-rose-50/50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30'
                }`}>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      {cfg.label}
                    </label>
                    {isFilled ? (
                      <a href={driveLinks[item.key]} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-800 shrink-0" title="Uji Link">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      isEditor ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                    }`}>
                      Wajib {cfg.access}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <User className="w-2.5 h-2.5" /> {cfg.role}
                    </span>
                  </div>
                  
                  <div className="relative">
                    <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input 
                      type="url" 
                      placeholder="Tempel link Google Drive di sini..." 
                      value={driveLinks[item.key] || ''} 
                      onChange={(e) => setDriveLinks({ ...driveLinks, [item.key]: e.target.value })}
                      className={`w-full pl-8 pr-2 py-1.5 rounded-lg border text-[11px] font-medium text-slate-800 dark:text-white ${
                        isFilled 
                          ? 'border-emerald-300 bg-white dark:bg-slate-800 dark:border-emerald-500/40' 
                          : 'border-rose-300 bg-white dark:bg-slate-800 dark:border-rose-500/40'
                      }`} 
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSaveDriveLinks} disabled={isSavingDrive || loadingDrive} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
              <Save className="w-4 h-4" /> {isSavingDrive ? 'Menyimpan...' : 'Simpan Link Drive'}
            </button>
          </div>
        </div>
      )}

      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
          <Database className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pemeliharaan Data</h3>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-amber-900 dark:text-amber-200">Reset seluruh database Firestore ke setelan awal (HATI-HATI).</p>
          <button onClick={handleResetData} disabled={isResetting} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50 shrink-0">
            <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} /> {isResetting ? 'Mereset...' : 'Reset & Muat Demo'}
          </button>
        </div>
      </div>

      {isPhotoModalOpen && <PhotoUploadModal currentPhotoUrl={photoURL} userName={user?.displayName || 'Pengguna'} onSave={handleSavePhoto} onClose={() => setIsPhotoModalOpen(false)} />}
    </div>
  );
};