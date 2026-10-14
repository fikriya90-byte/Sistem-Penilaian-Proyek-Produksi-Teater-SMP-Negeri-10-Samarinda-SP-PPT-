// src/components/modules/StageManagerModule.tsx
import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Save, AlertTriangle,
  BookOpen, Star, Flag, Palette,
  Zap, RefreshCw, ArrowRight, Info,
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
  startDate: string;   // YYYY-MM-DD
  startTime: string;   // HH:mm
  endDate: string;     // YYYY-MM-DD
  endTime: string;     // HH:mm
  enabled: boolean;
  notes: string;
}

const STAGE_META: Record<ProductionStage, { icon: any; desc: string }> = {
  PERSIAPAN: { icon: BookOpen, desc: 'Riset, naskah, casting, desain konsep' },
  PELAKSANAAN: { icon: Palette, desc: 'Latihan rutin, pembuatan properti & kostum' },
  PERTUNJUKAN: { icon: Star, desc: 'Gladi resik, pementasan utama' },
  PASCA: { icon: Flag, desc: 'Evaluasi, LPJ, dokumentasi akhir' },
};

const STAGE_ORDER: ProductionStage[] = ['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'];

function buildISO(dateStr: string, timeStr: string): string {
  if (!dateStr) return '';
  const t = timeStr || '00:00';
  try { return new Date(`${dateStr}T${t}:00`).toISOString(); } catch { return ''; }
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

function getStageStatus(cfg: StageDeadline): {
  status: 'off' | 'not-started' | 'ongoing' | 'ended' | 'incomplete' | 'open';
  startMs?: number; endMs?: number; label: string; color: string;
} {
  if (!cfg.enabled) {
    return { status: 'off', label: 'Tahapan tertutup', color: 'bg-slate-100 text-slate-700 border-slate-300' };
  }
  const startMs = cfg.startDate
    ? new Date(buildISO(cfg.startDate, cfg.startTime || '00:00')).getTime()
    : undefined;
  const endMs = cfg.endDate
    ? new Date(buildISO(cfg.endDate, cfg.endTime || '23:59')).getTime()
    : undefined;

  if (startMs && endMs && startMs >= endMs) {
    return { status: 'incomplete', label: 'Waktu tidak valid (mulai >= selesai)', color: 'bg-rose-50 text-rose-700 border-rose-300', startMs, endMs };
  }
  if (!startMs && !endMs) {
    return { status: 'open', label: 'Terbuka — belum ada tanggal', color: 'bg-slate-50 text-slate-700 border-slate-300' };
  }
  const now = Date.now();
  if (startMs && now < startMs) {
    return { status: 'not-started', label: `Belum dibuka — mulai dalam ${formatDuration(startMs - now)}`, color: 'bg-blue-50 text-blue-700 border-blue-300', startMs, endMs };
  }
  if (endMs && now > endMs) {
    return { status: 'ended', label: `Sudah ditutup — ${formatDuration(now - endMs)} yang lalu`, color: 'bg-rose-50 text-rose-700 border-rose-300', startMs, endMs };
  }
  if (endMs) {
    return { status: 'ongoing', label: `Berjalan — sisa ${formatDuration(endMs - now)}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-300', startMs, endMs };
  }
  return { status: 'open', label: 'Berjalan — tanpa deadline', color: 'bg-emerald-50 text-emerald-700 border-emerald-300', startMs, endMs };
}

export const StageManagerModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [stageDeadlines, setStageDeadlines] = useState<Record<ProductionStage, StageDeadline>>({
    PERSIAPAN:   { stageId: 'PERSIAPAN',   startDate: '', startTime: '', endDate: '', endTime: '', enabled: true,  notes: '' },
    PELAKSANAAN: { stageId: 'PELAKSANAAN', startDate: '', startTime: '', endDate: '', endTime: '', enabled: true,  notes: '' },
    PERTUNJUKAN: { stageId: 'PERTUNJUKAN', startDate: '', startTime: '', endDate: '', endTime: '', enabled: false, notes: '' },
    PASCA:       { stageId: 'PASCA',       startDate: '', startTime: '', endDate: '', endTime: '', enabled: false, notes: '' },
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
          STAGE_ORDER.forEach(k => {
            const src = data.stageDeadlines[k] || {};
            // Migrasi: kalau data lama tidak punya startTime/endTime, default ke 00:00 / 23:59
            let startTime = src.startTime || '';
            let endTime = src.endTime || '';
            // Kalau ada ISO lama (startAt/endAt), convert ke date + time
            if (!src.startDate && src.startAt) {
              try {
                const d = new Date(src.startAt);
                merged[k] = merged[k];
                startTime = startTime || d.toTimeString().slice(0, 5);
              } catch {}
            }
            merged[k] = {
              ...merged[k],
              stageId: k,
              startDate: src.startDate || '',
              startTime: startTime,
              endDate: src.endDate || '',
              endTime: endTime,
              enabled: src.enabled !== false,
              notes: src.notes || '',
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

    // Validasi per tahap
    for (const stageId of STAGE_ORDER) {
      const cfg = stageDeadlines[stageId];
      if (cfg.enabled && cfg.startDate && cfg.endDate) {
        const s = new Date(buildISO(cfg.startDate, cfg.startTime || '00:00')).getTime();
        const e = new Date(buildISO(cfg.endDate, cfg.endTime || '23:59')).getTime();
        if (s >= e) {
          showToast(`Tahap ${stageId}: waktu mulai harus lebih awal dari selesai.`, 'error');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // BACA dulu, merge field lama (jangan hapus field assessment milik modul lain)
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data() : {};
      const existingDeadlines = existing.stageDeadlines || {};

      const newStageDeadlines: any = {};
      STAGE_ORDER.forEach(stageId => {
        const old = existingDeadlines[stageId] || {};
        const cfg = stageDeadlines[stageId];
        newStageDeadlines[stageId] = {
          ...old,
          stageId,
          startDate: cfg.startDate || '',
          startTime: cfg.startTime || '',
          endDate: cfg.endDate || '',
          endTime: cfg.endTime || '',
          enabled: !!cfg.enabled,
          notes: cfg.notes || '',
        };
      });

      await setDoc(ref, {
        ...existing,
        stageDeadlines: newStageDeadlines,
        currentStage,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
        updatedByName: user.displayName,
      }, { merge: true });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'StageConfig', targetId: activeClass.id,
        details: `Update tahapan aktif: ${currentStage}`,
      });
      showToast('Konfigurasi tahapan tersimpan!', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStage = (stageId: ProductionStage, field: keyof StageDeadline, value: any) => {
    setStageDeadlines(prev => ({ ...prev, [stageId]: { ...prev[stageId], [field]: value } }));
  };

  if (!isGuruPengampu) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700">Akses Terbatas</h3>
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
                Jadwal Tahapan
              </span>
              <h2 className="text-xl font-black text-white mt-1">Kelola Tahapan Produksi</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Atur tahapan aktif & deadline (tanggal + jam) pengerjaan tugas
              </p>
            </div>
          </div>
          <button onClick={handleSave} disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
            <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Konfigurasi'}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <p><strong>Info:</strong> Halaman ini hanya mengatur <em>jadwal tahapan</em> (kapan siswa boleh mengerjakan tugas) — lengkap dengan tanggal & jam mulai-selesai.</p>
          <p className="mt-1">Untuk atur <em>jadwal buka/tutup penilaian</em>, buka menu <strong>Jadwal Penilaian</strong> di sidebar.</p>
        </div>
      </div>

      {carryOverCount > 0 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 shadow-md">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0"><Zap className="w-5 h-5" /></span>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-amber-900">{carryOverCount} Deadline dari Tahap Sebelumnya</h3>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={handleCarryOver} disabled={isCarryingOver}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 disabled:opacity-50">
                  <ArrowRight className="w-3.5 h-3.5" /> Carry Over ke {currentStage}
                </button>
                <button onClick={checkCarryOver} disabled={checkingCarryOver}
                  className="px-3 py-2.5 rounded-xl bg-white border border-amber-300 text-amber-800 font-bold text-xs flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingCarryOver ? 'animate-spin' : ''}`} /> Cek Ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PILIH TAHAPAN AKTIF */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <h3 className="text-base font-extrabold text-slate-900 mb-1">Tahapan Aktif</h3>
        <p className="text-xs text-slate-500 mb-4">Pilih tahapan yang sedang berlangsung.</p>
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
                    : enabled ? 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'
                    : 'bg-slate-100 text-slate-400 border-slate-200 opacity-70'
                }`}>
                <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-slate-950' : enabled ? 'text-amber-500' : 'text-slate-400'}`} />
                <p className="text-xs font-black uppercase tracking-wider">{stage.id}</p>
                <p className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>Bobot: {stage.defaultWeight}%</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* DEADLINE PER TAHAP */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" /> Deadline per Tahapan
        </h3>

        {STAGES.map(stage => {
          const config = stageDeadlines[stage.id];
          const meta = STAGE_META[stage.id];
          const Icon = meta.icon;
          const status = getStageStatus(config);
          const isActiveStage = currentStage === stage.id;

          return (
            <div key={stage.id}
              className={`p-5 rounded-3xl border-2 transition ${
                isActiveStage ? 'border-amber-400 shadow-lg' : 'border-slate-200'
              } ${config.enabled ? 'bg-white' : 'bg-slate-50 opacity-80'}`}>

              {/* Header tahap */}
              <div className="flex items-start gap-4 flex-wrap mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className={`p-3 rounded-2xl ${
                    config.enabled ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-extrabold text-slate-900">{stage.name}</h4>
                      {isActiveStage && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                          TAHAP AKTIF
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">{meta.desc}</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl bg-slate-100">
                  <input type="checkbox" checked={config.enabled}
                    onChange={(e) => updateStage(stage.id, 'enabled', e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                  <span className="text-xs font-bold text-slate-600">
                    {config.enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>
              </div>

              {config.enabled && (
                <>
                  {/* Status banner */}
                  <div className={`p-3 rounded-xl border-2 flex items-center gap-2 mb-4 ${status.color}`}>
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] font-bold">{status.label}</span>
                  </div>

                  {/* Input Mulai */}
                  <div className="mb-4">
                    <p className="text-[11px] font-black text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" /> Waktu Mulai Tahapan
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">📅 Tanggal</label>
                        <input type="date" value={config.startDate}
                          onChange={(e) => updateStage(stage.id, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">🕐 Jam</label>
                        <input type="time" value={config.startTime}
                          onChange={(e) => updateStage(stage.id, 'startTime', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                    {config.startDate && (
                      <p className="text-[10px] text-indigo-700 mt-1.5 font-semibold">
                        Mulai: {formatDateTime(config.startDate, config.startTime || '00:00')}
                      </p>
                    )}
                  </div>

                  {/* Input Selesai */}
                  <div className="mb-4">
                    <p className="text-[11px] font-black text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" /> Deadline Akhir Tahapan
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">📅 Tanggal</label>
                        <input type="date" value={config.endDate}
                          onChange={(e) => updateStage(stage.id, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">🕐 Jam</label>
                        <input type="time" value={config.endTime}
                          onChange={(e) => updateStage(stage.id, 'endTime', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
                      </div>
                    </div>
                    {config.endDate && (
                      <p className="text-[10px] text-rose-700 mt-1.5 font-semibold">
                        Selesai: {formatDateTime(config.endDate, config.endTime || '23:59')}
                      </p>
                    )}
                  </div>

                  {/* Preview rentang */}
                  {config.startDate && config.endDate && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 mb-4">
                      <p className="text-[11px] font-black text-indigo-900 mb-1">
                        📋 Preview Rentang Tahapan:
                      </p>
                      <p className="text-[11px] text-indigo-800 leading-relaxed">
                        Dari <strong>{formatDateTime(config.startDate, config.startTime || '00:00')}</strong>
                        <br />sampai <strong>{formatDateTime(config.endDate, config.endTime || '23:59')}</strong>
                      </p>
                    </div>
                  )}

                  {/* Catatan */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Catatan / Instruksi Tahapan
                    </label>
                    <textarea rows={2} value={config.notes}
                      onChange={(e) => updateStage(stage.id, 'notes', e.target.value)}
                      placeholder="Contoh: Fokus pada blocking Babak 1-2 dan latihan vokal..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800" />
                  </div>
                </>
              )}

              {!config.enabled && (
                <div className="p-4 text-center text-[11px] text-slate-400 italic">
                  Tahapan tertutup — centang "Aktif" untuk mengatur waktu.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* SAVE BOTTOM */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-300">
          💡 <strong className="text-white">Tips:</strong> Isi jam mulai & selesai agar countdown akurat (bukan cuma hari).
        </div>
        <button onClick={handleSave} disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
          <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
    </div>
  );
};