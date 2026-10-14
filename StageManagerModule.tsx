// src/components/modules/StageManagerModule.tsx
import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Save, AlertTriangle,
  BookOpen, Star, Flag, Palette, Award, Sparkles,
  Zap, RefreshCw, ArrowRight, Info, Timer,
  ToggleLeft, ToggleRight, Power,
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
  // ✅ JADWAL PENILAIAN — TERPISAH dari tahapan
  assessmentEnabled?: boolean;
  assessmentStartDate?: string;  // YYYY-MM-DD
  assessmentStartTime?: string;  // HH:mm
  assessmentEndDate?: string;    // YYYY-MM-DD
  assessmentEndTime?: string;    // HH:mm
}

const STAGE_META: Record<ProductionStage, { icon: any; desc: string }> = {
  PERSIAPAN: { icon: BookOpen, desc: 'Riset, naskah, casting, desain konsep' },
  PELAKSANAAN: { icon: Palette, desc: 'Latihan rutin, pembuatan properti & kostum' },
  PERTUNJUKAN: { icon: Star, desc: 'Gladi resik, pementasan utama' },
  PASCA: { icon: Flag, desc: 'Evaluasi, LPJ, dokumentasi akhir' },
};

const STAGE_ORDER: ProductionStage[] = ['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'];

// Helper: bikin ISO dari date + time
function buildISO(dateStr: string, timeStr: string): string {
  if (!dateStr) return '';
  const t = timeStr || '00:00';
  try {
    return new Date(`${dateStr}T${t}:00`).toISOString();
  } catch { return ''; }
}

function formatDateTime(dateStr: string, timeStr: string): string {
  if (!dateStr) return '-';
  try {
    const iso = buildISO(dateStr, timeStr);
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' WITA';
  } catch { return '-'; }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 detik';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit`;
  return `${Math.floor(ms / 1000)} detik`;
}

// Cek status penilaian tahap
function getAssessmentStatus(cfg: StageDeadline): {
  status: 'off' | 'incomplete' | 'not-started' | 'open' | 'ended' | 'open-no-limit';
  startMs?: number;
  endMs?: number;
  label: string;
  color: string;
} {
  if (cfg.assessmentEnabled === false) {
    return { status: 'off', label: 'Nonaktif', color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600' };
  }

  const startMs = cfg.assessmentStartDate
    ? new Date(buildISO(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00')).getTime()
    : undefined;
  const endMs = cfg.assessmentEndDate
    ? new Date(buildISO(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59')).getTime()
    : undefined;

  if (!startMs && !endMs) {
    return { status: 'open-no-limit', label: 'Terbuka tanpa batas', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' };
  }

  if (startMs && endMs && startMs >= endMs) {
    return { status: 'incomplete', label: 'Waktu tidak valid (mulai ≥ selesai)', color: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40', startMs, endMs };
  }

  const now = Date.now();
  if (startMs && now < startMs) {
    return { status: 'not-started', label: `Akan dibuka dalam ${formatDuration(startMs - now)}`, color: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40', startMs, endMs };
  }
  if (endMs && now > endMs) {
    return { status: 'ended', label: 'Sudah ditutup', color: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40', startMs, endMs };
  }
  if (endMs) {
    return { status: 'open', label: `Terbuka — sisa ${formatDuration(endMs - now)}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40', startMs, endMs };
  }
  return { status: 'open-no-limit', label: 'Terbuka tanpa batas', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40', startMs, endMs };
}

export const StageManagerModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [stageDeadlines, setStageDeadlines] = useState<Record<ProductionStage, StageDeadline>>({
    PERSIAPAN:    { stageId: 'PERSIAPAN',    startDate: '', endDate: '', enabled: true,  notes: '', assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '' },
    PELAKSANAAN:  { stageId: 'PELAKSANAAN',  startDate: '', endDate: '', enabled: true,  notes: '', assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '' },
    PERTUNJUKAN:  { stageId: 'PERTUNJUKAN',  startDate: '', endDate: '', enabled: false, notes: '', assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '' },
    PASCA:        { stageId: 'PASCA',        startDate: '', endDate: '', enabled: false, notes: '', assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '' },
  });

  const [currentStage, setCurrentStage] = useState<ProductionStage>('PELAKSANAAN');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [carryOverCount, setCarryOverCount] = useState<number>(0);
  const [checkingCarryOver, setCheckingCarryOver] = useState(false);
  const [isCarryingOver, setIsCarryingOver] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    loadStageConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass]);

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
        if (data.stageDeadlines) {
          const merged: any = { ...stageDeadlines };
          Object.keys(data.stageDeadlines).forEach(k => {
            const src = data.stageDeadlines[k];
            merged[k] = {
              ...merged[k],
              ...src,
              // Migrasi: kalau ada field lama assessmentStart/End (ISO), konversi ke date/time
              assessmentEnabled: src.assessmentEnabled === true,
              assessmentStartDate: src.assessmentStartDate || (src.assessmentStart ? new Date(src.assessmentStart).toISOString().slice(0, 10) : ''),
              assessmentStartTime: src.assessmentStartTime || (src.assessmentStart ? new Date(src.assessmentStart).toTimeString().slice(0, 5) : ''),
              assessmentEndDate: src.assessmentEndDate || (src.assessmentEnd ? new Date(src.assessmentEnd).toISOString().slice(0, 10) : ''),
              assessmentEndTime: src.assessmentEndTime || (src.assessmentEnd ? new Date(src.assessmentEnd).toTimeString().slice(0, 5) : ''),
            };
          });
          setStageDeadlines(merged);
        }
        if (data.currentStage) setCurrentStage(data.currentStage);
      }
    } catch (err) {
      console.warn('Load stage config error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCarryOver = async () => {
    if (!activeClass) return;
    setCheckingCarryOver(true);
    try {
      const currentIdx = STAGE_ORDER.indexOf(currentStage);
      if (currentIdx <= 0) { setCarryOverCount(0); setCheckingCarryOver(false); return; }
      const previousStages = STAGE_ORDER.slice(0, currentIdx);
      const q = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
      const snap = await getDocs(q);
      let count = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const dStage = data.stage as ProductionStage | undefined;
        if (!dStage) return;
        if (!previousStages.includes(dStage)) return;
        if (data.status === 'CANCELLED') return;
        count++;
      });
      setCarryOverCount(count);
    } catch { setCarryOverCount(0); }
    finally { setCheckingCarryOver(false); }
  };

  const handleCarryOver = async () => {
    if (!activeClass || !user) return;
    if (carryOverCount === 0) { showToast('Tidak ada deadline yang perlu dipindah.', 'info'); return; }
    if (!isGuruPengampu) { showToast('Hanya Guru Pengampu.', 'warning'); return; }
    if (!confirm(`Pindahkan ${carryOverCount} deadline dari tahap sebelumnya ke "${currentStage}"?`)) return;

    setIsCarryingOver(true);
    try {
      const currentIdx = STAGE_ORDER.indexOf(currentStage);
      const previousStages = STAGE_ORDER.slice(0, currentIdx);
      const q = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
      const snap = await getDocs(q);
      const toCarry: any[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const dStage = data.stage as ProductionStage | undefined;
        if (!dStage) return;
        if (!previousStages.includes(dStage)) return;
        if (data.status === 'CANCELLED') return;
        toCarry.push({ ref: d.ref, oldStage: dStage });
      });
      if (toCarry.length === 0) { showToast('Tidak ada yang perlu dipindah.', 'info'); setIsCarryingOver(false); return; }
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
        details: `Carry over ${toCarry.length} deadline ke ${currentStage}`,
      });
      showToast(`${toCarry.length} deadline dipindah!`, 'success');
      setCarryOverCount(0);
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
    finally { setIsCarryingOver(false); }
  };

  const handleSave = async () => {
    if (!activeClass || !user) return;

    // Validasi: untuk setiap tahap, cek assessment
    for (const stageId of STAGE_ORDER) {
      const cfg = stageDeadlines[stageId];
      if (cfg.assessmentEnabled) {
        const hasStart = !!cfg.assessmentStartDate;
        const hasEnd = !!cfg.assessmentEndDate;
        if (hasStart && hasEnd) {
          const s = new Date(buildISO(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00')).getTime();
          const e = new Date(buildISO(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59')).getTime();
          if (s >= e) {
            showToast(`Tahap ${stageId}: waktu mulai penilaian harus lebih awal dari selesai.`, 'error');
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      // Susun data untuk Firestore — hanya field yang relevan
      const cleanedStageDeadlines: any = {};
      STAGE_ORDER.forEach(stageId => {
        const cfg = stageDeadlines[stageId];
        cleanedStageDeadlines[stageId] = {
          stageId: cfg.stageId,
          startDate: cfg.startDate,
          endDate: cfg.endDate,
          enabled: cfg.enabled,
          notes: cfg.notes,
          assessmentEnabled: !!cfg.assessmentEnabled,
          assessmentStartDate: cfg.assessmentStartDate || '',
          assessmentStartTime: cfg.assessmentStartTime || '',
          assessmentEndDate: cfg.assessmentEndDate || '',
          assessmentEndTime: cfg.assessmentEndTime || '',
          assessmentStart: undefined,
          assessmentEnd: undefined,
        };
      });

      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      await setDoc(ref, {
        stageDeadlines: cleanedStageDeadlines,
        currentStage,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid, updatedByName: user.displayName,
      }, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'StageConfig', targetId: activeClass.id,
        details: `Update tahapan & jadwal penilaian`,
      });
      showToast('Konfigurasi tersimpan!', 'success');
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
    finally { setSubmitting(false); }
  };

  const updateStage = (stageId: ProductionStage, field: keyof StageDeadline, value: any) => {
    setStageDeadlines(prev => ({ ...prev, [stageId]: { ...prev[stageId], [field]: value } }));
  };

  if (!isGuruPengampu) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Akses Terbatas</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Calendar className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Manajemen Tahapan
              </span>
              <h2 className="text-xl font-black text-white mt-1">Tahapan & Jadwal Penilaian</h2>
              <p className="text-xs text-slate-300 mt-0.5">Atur kapan tahapan aktif & kapan penilaian dibuka</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
            <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Semua'}
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <p><strong>2 jadwal terpisah:</strong></p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>Jadwal Tahapan</strong> → kapan siswa boleh <em>mengerjakan tugas</em> (rentang panjang, mis. 1 bulan)</li>
            <li><strong>Jadwal Penilaian</strong> → kapan siswa boleh <em>mengisi nilai</em> (rentang pendek, mis. 3 hari)</li>
          </ul>
          <p className="mt-1.5">Guru set tanggal & jam penilaian manual per tahap. Di luar rentang → siswa <strong>tidak bisa mengisi nilai</strong>.</p>
        </div>
      </div>

      {/* CARRY OVER */}
      {carryOverCount > 0 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-300 dark:border-amber-500/40 shadow-md">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0"><Zap className="w-5 h-5" /></span>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">{carryOverCount} Deadline dari Tahap Sebelumnya</h3>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={handleCarryOver} disabled={isCarryingOver}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 disabled:opacity-50">
                  <ArrowRight className="w-3.5 h-3.5" /> Carry Over ke {currentStage}
                </button>
                <button onClick={checkCarryOver} disabled={checkingCarryOver}
                  className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingCarryOver ? 'animate-spin' : ''}`} /> Cek Ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAHAPAN AKTIF */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Tahapan Aktif</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Pilih tahapan yang sedang berlangsung.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAGES.map(stage => {
            const meta = STAGE_META[stage.id];
            const Icon = meta.icon;
            const isActive = currentStage === stage.id;
            const enabled = stageDeadlines[stage.id].enabled;
            return (
              <button key={stage.id} onClick={() => setCurrentStage(stage.id)}
                className={`p-4 rounded-2xl border text-left transition ${
                  isActive ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                    : enabled ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-70'
                }`}>
                <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-slate-950' : enabled ? 'text-amber-500' : 'text-slate-400'}`} />
                <p className="text-xs font-black uppercase tracking-wider">{stage.id}</p>
                <p className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>Bobot: {stage.defaultWeight}%</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* PER-TAHAP: TAHAPAN + PENILAIAN */}
      <div className="space-y-6">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Pengaturan Per Tahap
        </h3>

        {STAGES.map(stage => {
          const config = stageDeadlines[stage.id];
          const meta = STAGE_META[stage.id];
          const Icon = meta.icon;
          const isActiveStage = currentStage === stage.id;
          const aStatus = getAssessmentStatus(config);

          return (
            <div key={stage.id} className={`rounded-3xl border-2 overflow-hidden ${isActiveStage ? 'border-amber-400 shadow-lg' : 'border-slate-200 dark:border-slate-700'}`}>
              {/* Header tahap */}
              <div className={`p-4 flex items-center gap-3 ${
                isActiveStage ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-slate-100 dark:bg-slate-800'
              }`}>
                <span className={`p-2 rounded-xl ${isActiveStage ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600'}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <h4 className={`text-sm font-black ${isActiveStage ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {stage.name}
                  </h4>
                  <p className={`text-[10px] ${isActiveStage ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                    {meta.desc} • Bobot {stage.defaultWeight}%
                  </p>
                </div>
                {isActiveStage && (
                  <span className="text-[9px] font-black px-2 py-1 rounded-full bg-white text-amber-600">
                    TAHAP AKTIF
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
                {/* CARD A: JADWAL TAHAPAN */}
                <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span className="text-xs font-extrabold text-slate-800 dark:text-white">A. Jadwal Tahapan</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">— kapan siswa mengerjakan tugas</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={config.enabled}
                        onChange={(e) => updateStage(stage.id, 'enabled', e.target.checked)}
                        className="rounded border-slate-300 text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {config.enabled ? 'Dibuka' : 'Tutup'}
                      </span>
                    </label>
                  </div>
                  {config.enabled && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">📅 Tanggal Mulai</label>
                        <input type="date" value={config.startDate}
                          onChange={(e) => updateStage(stage.id, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">🏁 Deadline Akhir</label>
                        <input type="date" value={config.endDate}
                          onChange={(e) => updateStage(stage.id, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                      </div>
                    </div>
                  )}
                  {!config.enabled && (
                    <div className="p-3 text-center text-[11px] text-slate-400 italic">
                      Tahapan tertutup
                    </div>
                  )}
                </div>

                {/* CARD B: JADWAL PENILAIAN (TERPISAH) */}
                <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-500/40 overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10">
                  <div className="p-3 bg-purple-100 dark:bg-purple-500/20 border-b border-purple-200 dark:border-purple-500/40 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-700 dark:text-purple-300" />
                      <span className="text-xs font-extrabold text-purple-900 dark:text-purple-200">B. Jadwal Penilaian</span>
                      <span className="text-[10px] text-purple-700 dark:text-purple-300">— kapan siswa mengisi nilai</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox"
                        checked={!!config.assessmentEnabled}
                        onChange={(e) => updateStage(stage.id, 'assessmentEnabled', e.target.checked)}
                        className="rounded border-purple-300 text-purple-500" />
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                        {config.assessmentEnabled ? 'Aktifkan' : 'Nonaktif'}
                      </span>
                    </label>
                  </div>

                  {config.assessmentEnabled ? (
                    <div className="p-4 space-y-4">
                      {/* Status */}
                      <div className={`p-3 rounded-xl border-2 flex items-center gap-2 ${aStatus.color}`}>
                        <Timer className="w-4 h-4 shrink-0" />
                        <span className="text-[11px] font-bold">{aStatus.label}</span>
                      </div>

                      {/* Input jam mulai */}
                      <div>
                        <p className="text-[11px] font-black text-purple-900 dark:text-purple-200 uppercase mb-2 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Waktu Mulai Dibuka
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1">📅 Tanggal</label>
                            <input type="date"
                              value={config.assessmentStartDate || ''}
                              onChange={(e) => updateStage(stage.id, 'assessmentStartDate', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1">🕐 Jam</label>
                            <input type="time"
                              value={config.assessmentStartTime || ''}
                              onChange={(e) => updateStage(stage.id, 'assessmentStartTime', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                          </div>
                        </div>
                        {config.assessmentStartDate && (
                          <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-1.5 font-semibold">
                            Mulai: {formatDateTime(config.assessmentStartDate, config.assessmentStartTime || '00:00')}
                          </p>
                        )}
                      </div>

                      {/* Input jam selesai */}
                      <div>
                        <p className="text-[11px] font-black text-purple-900 dark:text-purple-200 uppercase mb-2 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Waktu Selesai Ditutup
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1">📅 Tanggal</label>
                            <input type="date"
                              value={config.assessmentEndDate || ''}
                              onChange={(e) => updateStage(stage.id, 'assessmentEndDate', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1">🕐 Jam</label>
                            <input type="time"
                              value={config.assessmentEndTime || ''}
                              onChange={(e) => updateStage(stage.id, 'assessmentEndTime', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                          </div>
                        </div>
                        {config.assessmentEndDate && (
                          <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-1.5 font-semibold">
                            Selesai: {formatDateTime(config.assessmentEndDate, config.assessmentEndTime || '23:59')}
                          </p>
                        )}
                      </div>

                      {/* Preview rentang */}
                      {config.assessmentStartDate && config.assessmentEndDate && (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-purple-300 dark:border-purple-500/40">
                          <p className="text-[11px] font-black text-purple-900 dark:text-purple-200 mb-1">
                            📋 Preview Jadwal Penilaian:
                          </p>
                          <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                            Siswa bisa isi nilai dari <strong>{formatDateTime(config.assessmentStartDate, config.assessmentStartTime || '00:00')}</strong>
                            <br />sampai <strong>{formatDateTime(config.assessmentEndDate, config.assessmentEndTime || '23:59')}</strong>
                          </p>
                        </div>
                      )}

                      {!config.assessmentStartDate && !config.assessmentEndDate && (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-bold text-amber-900 dark:text-amber-200">
                            Belum ada tanggal. Isi tanggal & jam mulai + selesai agar siswa tahu kapan boleh mengisi.
                            Kalau dibiarkan kosong = <strong>terbuka tanpa batas</strong>.
                          </p>
                        </div>
                      )}

                      <div className="pt-3 border-t border-purple-200 dark:border-purple-500/30">
                        <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1">Catatan (opsional)</label>
                        <textarea rows={2} value={config.notes}
                          onChange={(e) => updateStage(stage.id, 'notes', e.target.value)}
                          placeholder="Contoh: Isi nilai rekan hanya untuk yang sudah tampil di gladi kering."
                          className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 text-center">
                      <ToggleLeft className="w-8 h-8 mx-auto text-purple-300 dark:text-purple-500 mb-2" />
                      <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-1">
                        Penilaian tahap ini NONAKTIF
                      </p>
                      <p className="text-[10px] text-purple-600 dark:text-purple-400">
                        Siswa tidak bisa isi nilai untuk tahap ini. Centang "Aktifkan" di atas untuk mulai mengatur.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SAVE */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-300">
          💡 <strong className="text-white">Tips:</strong> Set jadwal penilaian pendek (mis. 3-7 hari) di setiap tahap. Berbeda dengan jadwal tahapan yang bisa panjang.
        </div>
        <button onClick={handleSave} disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
          <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
    </div>
  );
};