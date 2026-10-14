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
  startDate: string;
  endDate: string;
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

export const StageManagerModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [stageDeadlines, setStageDeadlines] = useState<Record<ProductionStage, StageDeadline>>({
    PERSIAPAN:   { stageId: 'PERSIAPAN',   startDate: '', endDate: '', enabled: true,  notes: '' },
    PELAKSANAAN: { stageId: 'PELAKSANAAN', startDate: '', endDate: '', enabled: true,  notes: '' },
    PERTUNJUKAN: { stageId: 'PERTUNJUKAN', startDate: '', endDate: '', enabled: false, notes: '' },
    PASCA:       { stageId: 'PASCA',       startDate: '', endDate: '', enabled: false, notes: '' },
  });

  const [currentStage, setCurrentStage] = useState<ProductionStage>('PELAKSANAAN');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [carryOverCount, setCarryOverCount] = useState<number>(0);
  const [checkingCarryOver, setCheckingCarryOver] = useState(false);
  const [isCarryingOver, setIsCarryingOver] = useState(false);

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
              stageId: src.stageId || k,
              startDate: src.startDate || '',
              endDate: src.endDate || '',
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
    setSubmitting(true);
    try {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data() : {};
      const existingDeadlines = existing.stageDeadlines || {};

      const newStageDeadlines: any = {};
      STAGE_ORDER.forEach(stageId => {
        const old = existingDeadlines[stageId] || {};
        const cfg = stageDeadlines[stageId];
        // PENTING: pertahankan field assessment lama
        newStageDeadlines[stageId] = {
          ...old,
          stageId,
          startDate: cfg.startDate || '',
          endDate: cfg.endDate || '',
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

  const getDaysRemaining = (endDate: string) => {
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
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
                Atur tahapan aktif & deadline pengerjaan tugas
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
          <p><strong>Info:</strong> Halaman ini hanya mengatur <em>jadwal tahapan</em> — kapan siswa boleh
          mengerjakan tugas.</p>
          <p className="mt-1">Untuk atur <em>jadwal buka/tutup penilaian</em>, buka menu
          <strong> Jadwal Penilaian</strong> di sidebar.</p>
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

      <div className="space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" /> Deadline per Tahapan
        </h3>

        {STAGES.map(stage => {
          const config = stageDeadlines[stage.id];
          const meta = STAGE_META[stage.id];
          const Icon = meta.icon;
          const daysLeft = getDaysRemaining(config.endDate);

          return (
            <div key={stage.id}
              className={`p-5 rounded-3xl border transition ${
                config.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-70'
              }`}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className={`p-3 rounded-2xl ${
                    config.enabled ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{stage.name}</h4>
                    <p className="text-[11px] text-slate-500">{meta.desc}</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.enabled}
                    onChange={(e) => updateStage(stage.id, 'enabled', e.target.checked)}
                    className="rounded border-slate-300 text-amber-500" />
                  <span className="text-xs font-bold text-slate-600">
                    {config.enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>
              </div>

              {config.enabled && (
                <>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Tanggal Mulai</label>
                      <input type="date" value={config.startDate}
                        onChange={(e) => updateStage(stage.id, 'startDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Deadline Akhir</label>
                      <input type="date" value={config.endDate}
                        onChange={(e) => updateStage(stage.id, 'endDate', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
                    </div>
                  </div>

                  {config.endDate && daysLeft !== null && (
                    <div className={`mt-3 p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                      daysLeft < 0 ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : daysLeft < 7 ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
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
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-300">
          Tips: Set deadline akurat agar siswa tahu target waktu.
        </div>
        <button onClick={handleSave} disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
          <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
    </div>
  );
};