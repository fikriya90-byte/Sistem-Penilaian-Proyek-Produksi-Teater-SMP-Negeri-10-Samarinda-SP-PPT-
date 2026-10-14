import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Save, AlertTriangle,
  BookOpen, Star, Flag, Palette, Sparkles,
  ArrowRight, Download, Zap, RefreshCw, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { STAGES } from '../../core/constants';
import { ProductionStage } from '../../core/types';
import {
  doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface StageDeadline {
  stageId: ProductionStage;
  startDate: string;
  endDate: string;
  enabled: boolean;
  notes: string;
}

const STAGE_META: Record<ProductionStage, { icon: any; color: string; desc: string }> = {
  PERSIAPAN: { icon: BookOpen, color: 'amber', desc: 'Riset, naskah, casting, desain konsep' },
  PELAKSANAAN: { icon: Palette, color: 'blue', desc: 'Latihan rutin, pembuatan properti & kostum' },
  PERTUNJUKAN: { icon: Star, color: 'purple', desc: 'Gladi resik, pementasan utama' },
  PASCA: { icon: Flag, color: 'emerald', desc: 'Evaluasi, LPJ, dokumentasi akhir' },
};

const STAGE_ORDER: ProductionStage[] = ['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'];

export const StageManagerModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [stageDeadlines, setStageDeadlines] = useState<Record<ProductionStage, StageDeadline>>({
    PERSIAPAN: { stageId: 'PERSIAPAN', startDate: '', endDate: '', enabled: true, notes: '' },
    PELAKSANAAN: { stageId: 'PELAKSANAAN', startDate: '', endDate: '', enabled: true, notes: '' },
    PERTUNJUKAN: { stageId: 'PERTUNJUKAN', startDate: '', endDate: '', enabled: false, notes: '' },
    PASCA: { stageId: 'PASCA', startDate: '', endDate: '', enabled: false, notes: '' },
  });

  const [currentStage, setCurrentStage] = useState<ProductionStage>('PELAKSANAAN');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ✅ Carry over state
  const [carryOverCount, setCarryOverCount] = useState<number>(0);
  const [checkingCarryOver, setCheckingCarryOver] = useState(false);
  const [isCarryingOver, setIsCarryingOver] = useState(false);

  useEffect(() => {
    if (!activeClass) return;
    loadStageConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass]);

  // ✅ Auto-check carry over saat currentStage berubah
  useEffect(() => {
    if (!activeClass) return;
    checkCarryOver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass, currentStage]);

  const loadStageConfig = async () => {
    if (!activeClass) return;
    setLoading(true);
    try {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.stageDeadlines) setStageDeadlines(data.stageDeadlines);
        if (data.currentStage) setCurrentStage(data.currentStage);
      }
    } catch (err) {
      console.warn('Load stage config error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CHECK: Deadline dari stage sebelumnya yang belum selesai
  const checkCarryOver = async () => {
    if (!activeClass) return;
    setCheckingCarryOver(true);
    try {
      const currentIdx = STAGE_ORDER.indexOf(currentStage);
      if (currentIdx <= 0) {
        setCarryOverCount(0);
        setCheckingCarryOver(false);
        return;
      }

      const previousStages = STAGE_ORDER.slice(0, currentIdx);

      const q = query(
        collection(db, 'deadlines'),
        where('classId', '==', activeClass.id)
      );
      const snap = await getDocs(q);

      // Cari deadline yang masih di stage sebelumnya & belum selesai
      let count = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const dStage = data.stage as ProductionStage | undefined;
        if (!dStage) return;
        if (!previousStages.includes(dStage)) return;
        if (data.status === 'CANCELLED') return;

        // Cek apakah deadline ini sudah selesai semua
        // Kita hitung sebagai "belum selesai" kalau targetUserIds > 0
        // dan mungkin masih ada submissions yang belum SELESAI
        // Simplifikasi: hitung sebagai perlu carry over kalau status masih aktif
        count++;
      });

      setCarryOverCount(count);
    } catch (err) {
      console.warn('Check carry over error:', err);
      setCarryOverCount(0);
    } finally {
      setCheckingCarryOver(false);
    }
  };

  // ✅ EXECUTE: Pindahkan deadline stage lama → current stage
  const handleCarryOver = async () => {
    if (!activeClass || !user) return;
    if (carryOverCount === 0) {
      showToast('Tidak ada deadline dari tahap sebelumnya yang perlu dipindah.', 'info');
      return;
    }
    if (!isGuruPengampu) {
      showToast('Hanya Guru Pengampu yang dapat melakukan carry over.', 'warning');
      return;
    }

    if (!confirm(
      `Pindahkan ${carryOverCount} deadline dari tahap sebelumnya ke tahap "${currentStage}"?\n\n` +
      `Deadline ini akan:\n` +
      `• Tetap ada di menu Tugas & Deadline\n` +
      `• Di-tag ulang ke tahap ${currentStage}\n` +
      `• Ditandai "Carry Over" agar siswa tahu\n\n` +
      `Proses ini tidak bisa dibatalkan otomatis.`
    )) return;

    setIsCarryingOver(true);
    try {
      const currentIdx = STAGE_ORDER.indexOf(currentStage);
      const previousStages = STAGE_ORDER.slice(0, currentIdx);

      const q = query(
        collection(db, 'deadlines'),
        where('classId', '==', activeClass.id)
      );
      const snap = await getDocs(q);

      const toCarry: any[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const dStage = data.stage as ProductionStage | undefined;
        if (!dStage) return;
        if (!previousStages.includes(dStage)) return;
        if (data.status === 'CANCELLED') return;
        toCarry.push({ ref: d.ref, data, oldStage: dStage });
      });

      if (toCarry.length === 0) {
        showToast('Tidak ada deadline yang perlu dipindah.', 'info');
        setIsCarryingOver(false);
        return;
      }

      const batch = writeBatch(db);
      toCarry.forEach(item => {
        batch.update(item.ref, {
          stage: currentStage,
          carriedOverFrom: item.oldStage,
          carriedOverAt: new Date().toISOString(),
          carriedOverBy: user.displayName,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'DeadlineCarryOver', targetId: activeClass.id,
        details: `Carry over ${toCarry.length} deadline dari tahap sebelumnya ke ${currentStage}`,
      });

      showToast(`✅ ${toCarry.length} deadline dipindah ke tahap ${currentStage}!`, 'success');
      setCarryOverCount(0);
    } catch (err: any) {
      showToast('Gagal carry over: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setIsCarryingOver(false);
    }
  };

  const handleSave = async () => {
    if (!activeClass || !user) return;
    setSubmitting(true);
    try {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      await setDoc(ref, {
        stageDeadlines,
        currentStage,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
        updatedByName: user.displayName,
      }, { merge: true });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'StageConfig',
        targetId: activeClass.id,
        details: `Update tahapan aktif: ${currentStage}`,
      });

      showToast('Konfigurasi tahapan berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStage = (stageId: ProductionStage, field: keyof StageDeadline, value: any) => {
    setStageDeadlines(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], [field]: value },
    }));
  };

  const getDaysRemaining = (endDate: string) => {
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (!isGuruPengampu) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hanya Guru Pengampu yang dapat mengelola tahapan produksi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Calendar className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Manajemen Tahapan
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Kelola Tahapan & Deadline Produksi
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Atur tahapan aktif, deadline, & carry-over tugas belum selesai
              </p>
            </div>
          </div>

          <button onClick={handleSave} disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50">
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
          </button>
        </div>
      </div>

      {/* INFO KELAS */}
      {activeClass && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            Kelas: <strong>{activeClass.name}</strong> — Tahapan aktif saat ini:{' '}
            <strong className="uppercase">{currentStage}</strong>
          </div>
        </div>
      )}

      {/* ✅ CARRY OVER ALERT */}
      {carryOverCount > 0 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-300 dark:border-amber-500/40 shadow-md">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0">
              <Zap className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                ⚡ Ada {carryOverCount} Deadline dari Tahap Sebelumnya
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                Deadline dari tahap sebelumnya (Persiapan/Pelaksanaan/...) belum tuntas.
                Mau pindahkan otomatis ke tahap <strong>{currentStage}</strong>?
                Siswa akan tetap bisa mengerjakan dengan tag tahap yang baru.
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  onClick={handleCarryOver}
                  disabled={isCarryingOver}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isCarryingOver ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memindahkan...</>
                  ) : (
                    <><ArrowRight className="w-3.5 h-3.5" /> Carry Over ke {currentStage}</>
                  )}
                </button>
                <button
                  onClick={checkCarryOver}
                  disabled={checkingCarryOver}
                  className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingCarryOver ? 'animate-spin' : ''}`} /> Cek Ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {carryOverCount === 0 && currentStage !== 'PERSIAPAN' && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-900 dark:text-emerald-200 font-bold">
            Tidak ada deadline dari tahap sebelumnya yang perlu dipindah. Semua bersih! ✅
          </p>
        </div>
      )}

      {/* CURRENT STAGE SELECTOR */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
          Tahapan Aktif Sekarang
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Pilih tahapan yang sedang berlangsung. Hanya tahapan yang dibuka (enabled) yang dapat dinilai di menu Penilaian.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAGES.map(stage => {
            const meta = STAGE_META[stage.id];
            const Icon = meta.icon;
            const isActive = currentStage === stage.id;
            const enabled = stageDeadlines[stage.id].enabled;

            return (
              <button key={stage.id} onClick={() => setCurrentStage(stage.id)}
                className={`p-4 rounded-2xl border text-left transition relative ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                    : enabled
                    ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-70'
                }`}>
                <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-slate-950' : enabled ? 'text-amber-500' : 'text-slate-400'}`} />
                <p className="text-xs font-black uppercase tracking-wider">
                  {stage.id}
                </p>
                <p className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                  Bobot: {stage.defaultWeight}%
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {enabled ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {isActive ? '● AKTIF' : '✓ Dibuka'}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      🔒 Tertutup
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STAGE DEADLINES */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Deadline & Status per Tahapan
        </h3>

        {STAGES.map(stage => {
          const config = stageDeadlines[stage.id];
          const meta = STAGE_META[stage.id];
          const Icon = meta.icon;
          const daysLeft = getDaysRemaining(config.endDate);

          return (
            <div key={stage.id}
              className={`p-5 rounded-3xl border transition ${
                config.enabled
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-70'
              }`}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className={`p-3 rounded-2xl ${
                    config.enabled ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {stage.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{meta.desc}</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.enabled}
                    onChange={(e) => updateStage(stage.id, 'enabled', e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {config.enabled ? 'Dibuka' : 'Tertutup'}
                  </span>
                </label>
              </div>

              {config.enabled && (
                <>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        📅 Tanggal Mulai
                      </label>
                      <input type="date" value={config.startDate}
                        onChange={(e) => updateStage(stage.id, 'startDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        🏁 Deadline Akhir
                      </label>
                      <input type="date" value={config.endDate}
                        onChange={(e) => updateStage(stage.id, 'endDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                    </div>
                  </div>

                  {config.endDate && daysLeft !== null && (
                    <div className={`mt-3 p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                      daysLeft < 0
                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
                        : daysLeft < 7
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    }`}>
                      <Clock className="w-4 h-4 shrink-0" />
                      {daysLeft < 0
                        ? `Sudah lewat ${Math.abs(daysLeft)} hari dari deadline`
                        : daysLeft === 0
                        ? 'Hari ini deadline!'
                        : `Tersisa ${daysLeft} hari lagi`}
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Catatan / Instruksi Tahapan
                    </label>
                    <textarea rows={2} value={config.notes}
                      onChange={(e) => updateStage(stage.id, 'notes', e.target.value)}
                      placeholder="Contoh: Fokus pada blocking Babak 1-2 dan latihan vokal..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* SAVE BUTTON */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-300">
          💡 <strong className="text-white">Tips:</strong> Set deadline akurat agar siswa tahu target waktu.
          Carry over akan otomatis ditawarkan jika ada deadline tahap sebelumnya yang belum selesai.
        </div>
        <button onClick={handleSave} disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition disabled:opacity-50">
          <Save className="w-4 h-4" />
          {submitting ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
    </div>
  );
};