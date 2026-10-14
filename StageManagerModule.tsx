import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, Save, AlertTriangle,
  BookOpen, Star, Flag, Palette, Award, Sparkles, Users,
  Zap, RefreshCw, ArrowRight, Info, Timer,
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
  assessmentEnabled?: boolean;
  assessmentStart?: string;
  assessmentEnd?: string;
}

const STAGE_META: Record<ProductionStage, { icon: any; color: string; desc: string }> = {
  PERSIAPAN: { icon: BookOpen, color: 'amber', desc: 'Riset, naskah, casting, desain konsep' },
  PELAKSANAAN: { icon: Palette, color: 'blue', desc: 'Latihan rutin, pembuatan properti & kostum' },
  PERTUNJUKAN: { icon: Star, color: 'purple', desc: 'Gladi resik, pementasan utama' },
  PASCA: { icon: Flag, color: 'emerald', desc: 'Evaluasi, LPJ, dokumentasi akhir' },
};

const STAGE_ORDER: ProductionStage[] = ['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'];

function toISO(localValue: string): string {
  if (!localValue) return '';
  try { return new Date(localValue).toISOString(); } catch { return ''; }
}

function toLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  try {
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

export const StageManagerModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [stageDeadlines, setStageDeadlines] = useState<Record<ProductionStage, StageDeadline>>({
    PERSIAPAN:    { stageId: 'PERSIAPAN',    startDate: '', endDate: '', enabled: true,  notes: '', assessmentEnabled: true, assessmentStart: '', assessmentEnd: '' },
    PELAKSANAAN:  { stageId: 'PELAKSANAAN',  startDate: '', endDate: '', enabled: true,  notes: '', assessmentEnabled: true, assessmentStart: '', assessmentEnd: '' },
    PERTUNJUKAN:  { stageId: 'PERTUNJUKAN',  startDate: '', endDate: '', enabled: false, notes: '', assessmentEnabled: true, assessmentStart: '', assessmentEnd: '' },
    PASCA:        { stageId: 'PASCA',        startDate: '', endDate: '', enabled: false, notes: '', assessmentEnabled: true, assessmentStart: '', assessmentEnd: '' },
  });

  const [currentStage, setCurrentStage] = useState<ProductionStage>('PELAKSANAAN');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [carryOverCount, setCarryOverCount] = useState<number>(0);
  const [checkingCarryOver, setCheckingCarryOver] = useState(false);
  const [isCarryingOver, setIsCarryingOver] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
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
            merged[k] = {
              ...merged[k],
              ...data.stageDeadlines[k],
              assessmentEnabled: data.stageDeadlines[k].assessmentEnabled !== false,
              assessmentStart: data.stageDeadlines[k].assessmentStart || '',
              assessmentEnd: data.stageDeadlines[k].assessmentEnd || '',
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
      showToast(`✅ ${toCarry.length} deadline dipindah!`, 'success');
      setCarryOverCount(0);
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
    finally { setIsCarryingOver(false); }
  };

  const handleSave = async () => {
    if (!activeClass || !user) return;
    for (const stageId of STAGE_ORDER) {
      const cfg = stageDeadlines[stageId];
      if (cfg.assessmentEnabled !== false && cfg.assessmentStart && cfg.assessmentEnd) {
        const s = new Date(cfg.assessmentStart).getTime();
        const e = new Date(cfg.assessmentEnd).getTime();
        if (!isNaN(s) && !isNaN(e) && s >= e) {
          showToast(`Tahap ${stageId}: waktu mulai penilaian harus lebih awal dari selesai.`, 'error');
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      await setDoc(ref, {
        stageDeadlines, currentStage,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid, updatedByName: user.displayName,
      }, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'StageConfig', targetId: activeClass.id,
        details: `Update tahapan: ${currentStage}`,
      });
      showToast('Konfigurasi disimpan!', 'success');
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
    finally { setSubmitting(false); }
  };

  const updateStage = (stageId: ProductionStage, field: keyof StageDeadline, value: any) => {
    setStageDeadlines(prev => ({ ...prev, [stageId]: { ...prev[stageId], [field]: value } }));
  };

  const getDaysRemaining = (endDate: string) => {
    if (!endDate) return null;
    return Math.floor((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const renderAssessmentBadge = (stageId: ProductionStage) => {
    const cfg = stageDeadlines[stageId];
    if (cfg.assessmentEnabled === false) {
      return <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">⏸️ Dinonaktifkan</span>;
    }
    const startMs = cfg.assessmentStart ? new Date(cfg.assessmentStart).getTime() : undefined;
    const endMs = cfg.assessmentEnd ? new Date(cfg.assessmentEnd).getTime() : undefined;
    const now = Date.now();
    if (startMs && now < startMs) {
      return <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40">⏳ Dibuka dalam {formatDuration(startMs - now)}</span>;
    }
    if (endMs && now > endMs) {
      return <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40">🔒 Sudah ditutup</span>;
    }
    if (endMs) {
      return <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">✅ TERBUKA — sisa {formatDuration(endMs - now)}</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">✅ TERBUKA (tanpa batas)</span>;
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
            <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <p><strong>2 jenis jadwal:</strong></p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>Jadwal Tahapan</strong> → kapan siswa boleh mengerjakan tugas</li>
            <li><strong>Jadwal Penilaian</strong> → kapan guru/siswa boleh <strong>mengisi nilai</strong></li>
          </ul>
          <p className="mt-1.5">💡 Meski tahapannya aktif, <strong>penilaian tetap terkunci</strong> sampai Jadwal Penilaian dibuka.</p>
        </div>
      </div>

      {carryOverCount > 0 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-300 dark:border-amber-500/40 shadow-md">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0"><Zap className="w-5 h-5" /></span>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">⚡ {carryOverCount} Deadline dari Tahap Sebelumnya</h3>
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
                <div className="mt-2">
                  {enabled ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-emerald-600 text-white' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'}`}>
                      {isActive ? '● AKTIF' : '✓ Dibuka'}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">🔒 Tertutup</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Jadwal Tahapan & Penilaian
        </h3>
        {STAGES.map(stage => {
          const config = stageDeadlines[stage.id];
          const meta = STAGE_META[stage.id];
          const Icon = meta.icon;
          const daysLeft = getDaysRemaining(config.endDate);
          const isActiveStage = currentStage === stage.id;
          return (
            <div key={stage.id}
              className={`p-5 rounded-3xl border transition ${
                config.enabled ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-70'
              } ${isActiveStage ? 'ring-2 ring-amber-400/40' : ''}`}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className={`p-3 rounded-2xl ${config.enabled ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      {stage.name}
                      {isActiveStage && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950">AKTIF</span>}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{meta.desc}</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.enabled}
                    onChange={(e) => updateStage(stage.id, 'enabled', e.target.checked)}
                    className="rounded border-slate-300 text-amber-500" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{config.enabled ? 'Dibuka' : 'Tertutup'}</span>
                </label>
              </div>

              {config.enabled && (
                <>
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Jadwal Tahapan (siswa mengerjakan tugas)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">📅 Mulai</label>
                        <input type="date" value={config.startDate}
                          onChange={(e) => updateStage(stage.id, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">🏁 Deadline</label>
                        <input type="date" value={config.endDate}
                          onChange={(e) => updateStage(stage.id, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                      </div>
                    </div>
                    {config.endDate && daysLeft !== null && (
                      <div className={`mt-2 p-2 rounded-lg border flex items-center gap-2 text-[11px] font-bold ${
                        daysLeft < 0 ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : daysLeft < 7 ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {daysLeft < 0 ? `Lewat ${Math.abs(daysLeft)} hari` : daysLeft === 0 ? 'Hari ini deadline!' : `${daysLeft} hari lagi`}
                      </div>
                    )}
                  </div>

                  {/* JADWAL PENILAIAN */}
                  <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-2 border-purple-200 dark:border-purple-500/40">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200">Jadwal Penilaian</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderAssessmentBadge(stage.id)}
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox"
                            checked={config.assessmentEnabled !== false}
                            onChange={(e) => updateStage(stage.id, 'assessmentEnabled', e.target.checked)}
                            className="rounded border-purple-300 text-purple-500" />
                          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                            {config.assessmentEnabled !== false ? 'Aktif' : 'Off'}
                          </span>
                        </label>
                      </div>
                    </div>
                    <p className="text-[10px] text-purple-700 dark:text-purple-400 mb-2 leading-relaxed">
                      🎯 Penilaian hanya bisa diakses dalam rentang waktu berikut. Di luar rentang → tombol <strong>Nilai</strong> otomatis terkunci.
                    </p>
                    {config.assessmentEnabled !== false && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-purple-800 dark:text-purple-300 mb-1 flex items-center gap-1">
                              <Timer className="w-3 h-3" /> Mulai Dibuka
                            </label>
                            <input type="datetime-local"
                              value={toLocalInput(config.assessmentStart)}
                              onChange={(e) => updateStage(stage.id, 'assessmentStart', toISO(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                            {config.assessmentStart && (
                              <p className="text-[9px] text-purple-600 dark:text-purple-400 mt-1">{formatDateTime(config.assessmentStart)}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-purple-800 dark:text-purple-300 mb-1 flex items-center gap-1">
                              <Timer className="w-3 h-3" /> Selesai Ditutup
                            </label>
                            <input type="datetime-local"
                              value={toLocalInput(config.assessmentEnd)}
                              onChange={(e) => updateStage(stage.id, 'assessmentEnd', toISO(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                            {config.assessmentEnd && (
                              <p className="text-[9px] text-purple-600 dark:text-purple-400 mt-1">{formatDateTime(config.assessmentEnd)}</p>
                            )}
                          </div>
                        </div>
                        {!config.assessmentStart && !config.assessmentEnd && (
                          <div className="mt-2 p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 flex items-start gap-1.5">
                            <Info className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200">
                              Tanpa batas waktu → penilaian <strong>selalu terbuka</strong>. Set waktu untuk membatasi akses.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-3">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
                    <textarea rows={2} value={config.notes}
                      onChange={(e) => updateStage(stage.id, 'notes', e.target.value)}
                      placeholder="Fokus latihan..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-300">
          💡 <strong className="text-white">Tips:</strong> Set jadwal penilaian setiap tahap agar penilaian tidak overlap dengan tahapan.
        </div>
        <button onClick={handleSave} disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
          <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
    </div>
  );
};