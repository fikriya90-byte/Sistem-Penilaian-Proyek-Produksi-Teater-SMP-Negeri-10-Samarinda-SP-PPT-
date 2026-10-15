// src/components/modules/AssessmentScheduleModule.tsx
import React, { useState, useEffect } from 'react';
import {
  Award, Clock, Save, AlertTriangle, Info, Timer,
  BookOpen, Star, Flag, Palette,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { STAGES } from '../../core/constants';
import { ProductionStage } from '../../core/types';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface AssessmentConfig {
  stageId: ProductionStage;
  assessmentEnabled: boolean;
  assessmentStartDate: string;
  assessmentStartTime: string;
  assessmentEndDate: string;
  assessmentEndTime: string;
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
  try { return new Date(`${dateStr}T${t}:00`).toISOString(); }
  catch { return ''; }
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

function getStatus(cfg: AssessmentConfig): { label: string; color: string } {
  if (!cfg.assessmentEnabled) {
    return { label: 'Nonaktif — siswa tidak bisa isi nilai', color: 'bg-slate-100 text-slate-700 border-slate-300' };
  }
  const startMs = cfg.assessmentStartDate
    ? new Date(buildISO(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00')).getTime()
    : undefined;
  const endMs = cfg.assessmentEndDate
    ? new Date(buildISO(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59')).getTime()
    : undefined;

  if (!startMs && !endMs) {
    return { label: 'Terbuka tanpa batas (tanggal belum diisi)', color: 'bg-amber-50 text-amber-700 border-amber-300' };
  }
  if (startMs && endMs && startMs >= endMs) {
    return { label: 'Waktu tidak valid (mulai >= selesai)', color: 'bg-rose-50 text-rose-700 border-rose-300' };
  }
  const now = Date.now();
  if (startMs && now < startMs) {
    return { label: `Akan dibuka dalam ${formatDuration(startMs - now)}`, color: 'bg-blue-50 text-blue-700 border-blue-300' };
  }
  if (endMs && now > endMs) {
    return { label: 'Sudah ditutup', color: 'bg-rose-50 text-rose-700 border-rose-300' };
  }
  if (endMs) {
    return { label: `Terbuka — sisa ${formatDuration(endMs - now)}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-300' };
  }
  return { label: 'Terbuka tanpa batas', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' };
}

export const AssessmentScheduleModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [configs, setConfigs] = useState<Record<ProductionStage, AssessmentConfig>>({
    PERSIAPAN:   { stageId: 'PERSIAPAN',   assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '', notes: '' },
    PELAKSANAAN: { stageId: 'PELAKSANAAN', assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '', notes: '' },
    PERTUNJUKAN: { stageId: 'PERTUNJUKAN', assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '', notes: '' },
    PASCA:       { stageId: 'PASCA',       assessmentEnabled: false, assessmentStartDate: '', assessmentStartTime: '', assessmentEndDate: '', assessmentEndTime: '', notes: '' },
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass]);

  const loadConfig = async () => {
    if (!activeClass) return;
    setLoading(true);
    try {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.stageDeadlines) {
          const merged: any = { ...configs };
          STAGE_ORDER.forEach(k => {
            const src = data.stageDeadlines[k] || {};
            merged[k] = {
              stageId: k,
              assessmentEnabled: src.assessmentEnabled === true || src.assessmentEnabled === 'true',
              assessmentStartDate: src.assessmentStartDate || '',
              assessmentStartTime: src.assessmentStartTime || '',
              assessmentEndDate: src.assessmentEndDate || '',
              assessmentEndTime: src.assessmentEndTime || '',
              notes: src.notes || '',
            };
          });
          setConfigs(merged);
        }
      }
    } catch (err) {
      console.warn('Load assessment config error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (stageId: ProductionStage, field: keyof AssessmentConfig, value: any) => {
    setConfigs(prev => ({ ...prev, [stageId]: { ...prev[stageId], [field]: value } }));
  };

  const handleSave = async () => {
    if (!activeClass || !user) return;

    for (const stageId of STAGE_ORDER) {
      const cfg = configs[stageId];
      if (cfg.assessmentEnabled && cfg.assessmentStartDate && cfg.assessmentEndDate) {
        const s = new Date(buildISO(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00')).getTime();
        const e = new Date(buildISO(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59')).getTime();
        if (s >= e) {
          showToast(`Tahap ${stageId}: waktu mulai harus lebih awal dari selesai.`, 'error');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data() : {};
      const existingDeadlines = existing.stageDeadlines || {};

      const newStageDeadlines: any = { ...existingDeadlines };
      STAGE_ORDER.forEach(stageId => {
        const old = existingDeadlines[stageId] || {};
        const cfg = configs[stageId];
        // PENTING: pertahankan field tahapan lama, hanya overwrite field assessment
        newStageDeadlines[stageId] = {
          ...old,
          stageId,
          assessmentEnabled: cfg.assessmentEnabled,
          assessmentStartDate: cfg.assessmentStartDate || '',
          assessmentStartTime: cfg.assessmentStartTime || '',
          assessmentEndDate: cfg.assessmentEndDate || '',
          assessmentEndTime: cfg.assessmentEndTime || '',
        };
      });

      await setDoc(ref, {
        ...existing,
        stageDeadlines: newStageDeadlines,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
        updatedByName: user.displayName,
      }, { merge: true });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'AssessmentSchedule', targetId: activeClass.id,
        details: `Update jadwal penilaian per tahap`,
      });
      showToast('Jadwal penilaian tersimpan!', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isGuruPengampu) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 mt-1">Hanya Guru Pengampu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                Jadwal Buka/Tutup Penilaian
              </span>
              <h2 className="text-xl font-black text-white mt-1">Jadwal Penilaian 360</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Atur kapan siswa boleh <strong>mengisi nilai</strong> di setiap tahap
              </p>
            </div>
          </div>
          <button onClick={handleSave} disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
            <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Semua'}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-900 leading-relaxed">
          <p><strong>Halaman ini HANYA untuk jadwal penilaian.</strong></p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li>Aktifkan toggle di tahap yang mau dibuka penilaiannya</li>
            <li>Isi <strong>tanggal + jam mulai</strong> dan <strong>tanggal + jam selesai</strong></li>
            <li>Di luar rentang → siswa <strong>tidak bisa</strong> mengisi nilai</li>
            <li>Untuk jadwal tahapan (kapan siswa kerjakan tugas), buka menu <strong>Kelola Tahapan</strong></li>
          </ul>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Memuat...</div>
      ) : (
        <div className="space-y-4">
          {STAGES.map(stage => {
            const cfg = configs[stage.id];
            const meta = STAGE_META[stage.id];
            const Icon = meta.icon;
            const status = getStatus(cfg);

            return (
              <div key={stage.id} className={`rounded-3xl border-2 overflow-hidden transition ${
                cfg.assessmentEnabled ? 'border-purple-400 shadow-md' : 'border-slate-200'
              }`}>
                <div className="p-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-white/20 text-white">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-white">{stage.name}</h4>
                    <p className="text-[10px] text-white/80">{meta.desc}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                    <input type="checkbox" checked={cfg.assessmentEnabled}
                      onChange={(e) => updateConfig(stage.id, 'assessmentEnabled', e.target.checked)}
                      className="rounded border-white/40 text-amber-500" />
                    <span className="text-[10px] font-bold text-white">
                      {cfg.assessmentEnabled ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </label>
                </div>

                {cfg.assessmentEnabled ? (
                  <div className="p-5 space-y-4 bg-white">
                    <div className={`p-3 rounded-xl border-2 flex items-center gap-2 ${status.color}`}>
                      <Timer className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold">{status.label}</span>
                    </div>

                    <div>
                      <p className="text-xs font-black text-purple-900 uppercase mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Waktu Mulai Dibuka
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-purple-700 mb-1">Tanggal</label>
                          <input type="date"
                            value={cfg.assessmentStartDate}
                            onChange={(e) => updateConfig(stage.id, 'assessmentStartDate', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 bg-white text-xs font-semibold text-slate-800" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-purple-700 mb-1">Jam</label>
                          <input type="time"
                            value={cfg.assessmentStartTime}
                            onChange={(e) => updateConfig(stage.id, 'assessmentStartTime', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 bg-white text-xs font-semibold text-slate-800" />
                        </div>
                      </div>
                      {cfg.assessmentStartDate && (
                        <p className="text-[10px] text-purple-700 mt-1.5 font-semibold">
                          Mulai: {formatDateTime(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00')}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-black text-purple-900 uppercase mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Waktu Selesai Ditutup
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-purple-700 mb-1">Tanggal</label>
                          <input type="date"
                            value={cfg.assessmentEndDate}
                            onChange={(e) => updateConfig(stage.id, 'assessmentEndDate', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 bg-white text-xs font-semibold text-slate-800" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-purple-700 mb-1">Jam</label>
                          <input type="time"
                            value={cfg.assessmentEndTime}
                            onChange={(e) => updateConfig(stage.id, 'assessmentEndTime', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border-2 border-purple-200 bg-white text-xs font-semibold text-slate-800" />
                        </div>
                      </div>
                      {cfg.assessmentEndDate && (
                        <p className="text-[10px] text-purple-700 mt-1.5 font-semibold">
                          Selesai: {formatDateTime(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59')}
                        </p>
                      )}
                    </div>

                    {cfg.assessmentStartDate && cfg.assessmentEndDate && (
                      <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300">
                        <p className="text-[11px] font-black text-purple-900 mb-1">
                          Preview Jadwal Penilaian:
                        </p>
                        <p className="text-[11px] text-purple-800 leading-relaxed">
                          Siswa bisa isi nilai dari <strong>{formatDateTime(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00')}</strong>
                          <br />sampai <strong>{formatDateTime(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59')}</strong>
                        </p>
                      </div>
                    )}

                    {!cfg.assessmentStartDate && !cfg.assessmentEndDate && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-amber-900">
                          Belum ada tanggal → terbuka tanpa batas. Isi tanggal + jam untuk membatasi waktu.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-purple-700 mb-1">Catatan (opsional)</label>
                      <textarea rows={2} value={cfg.notes}
                        onChange={(e) => updateConfig(stage.id, 'notes', e.target.value)}
                        placeholder="Contoh: Isi nilai rekan hanya untuk yang sudah tampil di gladi kering."
                        className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs font-medium text-slate-800" />
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center bg-white">
                    <p className="text-xs font-bold text-slate-500">
                      Penilaian tahap ini <strong>NONAKTIF</strong>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Centang toggle di atas untuk mengaktifkan.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-slate-300">
          Tips: Set jadwal penilaian pendek (3-7 hari) per tahap.
        </div>
        <button onClick={handleSave} disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
          <Save className="w-4 h-4" /> {submitting ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
    </div>
  );
};