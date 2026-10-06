import React, { useState, useEffect } from 'react';
import {
  Award, Printer, MessageSquare, CheckCircle, Clock, Target,
  BarChart3, Lightbulb, Star, TrendingUp, Bot, EyeOff, Users,
  Shield, Sparkles, Info,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell,
} from 'recharts';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  PEMERAN_CRITERIA, GENERAL_CRITERIA, SCORE_SCALE, STAGES, getPredikat,
} from '../../core/constants';
import { AssessmentRecord, ProductionStage } from '../../core/types';
import { subscribeAssessments } from '../../services/firestoreService';

export const MyGradeModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClass || !user) return;
    const unsub = subscribeAssessments(activeClass.id, (records) => {
      setAssessments(records.filter(r => r.studentId === user.uid));
      setLoading(false);
    });
    return () => unsub();
  }, [activeClass, user]);

  const isPemeran = user?.role === 'Pemeran';
  const myCriteria = isPemeran ? PEMERAN_CRITERIA : GENERAL_CRITERIA;

  const getStageScore = (stage: ProductionStage) => {
    const stageRecords = assessments.filter(a => a.stage === stage);
    if (stageRecords.length === 0) return null;

    const byCat: Record<string, AssessmentRecord[]> = {};
    stageRecords.forEach(r => {
      const cat = (r as any).assessorCategory || 'REKAN';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(r);
    });

    const avg = (arr: AssessmentRecord[]) =>
      arr.length > 0 ? arr.reduce((s, a) => s + a.totalScore, 0) / arr.length : null;

    let weights = { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 };
    if (user?.role === 'Pimpinan Produksi' || user?.role === 'Sutradara') {
      weights = { GURU: 40, ATASAN: 0, REKAN: 20, BAWAHAN: 40 };
    } else if (user?.role === 'Sekretaris' || user?.role === 'Bendahara') {
      weights = { GURU: 0, ATASAN: 60, REKAN: 40, BAWAHAN: 0 };
    } else if (user?.role?.startsWith('Koordinator ')) {
      weights = { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 };
    } else if (user?.role === 'Asisten Sutradara') {
      weights = { GURU: 0, ATASAN: 60, REKAN: 0, BAWAHAN: 40 };
    }

    let sum = 0, wSum = 0;
    Object.entries(weights).forEach(([cat, w]) => {
      const catScore = byCat[cat] ? avg(byCat[cat]) : null;
      if (catScore !== null && w > 0) {
        sum += catScore * w;
        wSum += w;
      }
    });

    return wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
  };

  const stageScores: Record<ProductionStage, number | null> = {
    PERSIAPAN: getStageScore('PERSIAPAN'),
    PELAKSANAAN: getStageScore('PELAKSANAAN'),
    PERTUNJUKAN: getStageScore('PERTUNJUKAN'),
    PASCA: getStageScore('PASCA'),
  };

  const computeFinal = () => {
    let sum = 0, wTotal = 0;
    STAGES.forEach(s => {
      const sc = stageScores[s.id];
      if (sc !== null) {
        sum += sc * (s.defaultWeight / 100);
        wTotal += s.defaultWeight / 100;
      }
    });
    return wTotal > 0 ? Math.round((sum / wTotal) * 10) / 10 : 0;
  };
  const finalScore = computeFinal();
  const predikatInfo = getPredikat(finalScore);
  const hasAnyScore = Object.values(stageScores).some(s => s !== null);

  const radarData = STAGES.map(s => ({
    stage: s.name.replace('Tahap ', '').replace(/^\d+:\s*/, ''),
    score: stageScores[s.id] || 0,
  }));

  const barData = STAGES.map(s => ({
    name: s.id.slice(0, 6),
    Nilai: stageScores[s.id] || 0,
  }));

  const categoryData = [
    { name: 'Guru', value: assessments.filter(a => (a as any).assessorCategory === 'GURU').length, fill: '#F59E0B' },
    { name: 'Atasan', value: assessments.filter(a => (a as any).assessorCategory === 'ATASAN').length, fill: '#3B82F6' },
    { name: 'Rekan', value: assessments.filter(a => (a as any).assessorCategory === 'REKAN').length, fill: '#10B981' },
    { name: 'Bawahan', value: assessments.filter(a => (a as any).assessorCategory === 'BAWAHAN').length, fill: '#8B5CF6' },
  ].filter(d => d.value > 0);

  const criteriaScores: Record<string, number[]> = {};
  const autoScoresAgg: Record<string, number[]> = {};

  assessments.forEach(a => {
    Object.entries(a.scores || {}).forEach(([k, v]) => {
      if (!criteriaScores[k]) criteriaScores[k] = [];
      criteriaScores[k].push(v);
    });
    const auto = (a as any).autoScores || {};
    Object.entries(auto).forEach(([k, v]) => {
      if (typeof v === 'number') {
        if (!autoScoresAgg[k]) autoScoresAgg[k] = [];
        autoScoresAgg[k].push(v);
      }
    });
  });

  const criteriaAvg = (key: string) => {
    const arr = criteriaScores[key] || [];
    if (arr.length === 0) return null;
    return Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10;
  };

  const autoAvg = (key: string) => {
    const arr = autoScoresAgg[key] || [];
    if (arr.length === 0) return null;
    return Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10;
  };

  const comments = assessments
    .filter(a => a.comment && a.comment.trim())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const handleDownloadPDF = () => {
    showToast('Dialog cetak dibuka. Pilih "Save as PDF".', 'info');
    setTimeout(() => window.print(), 300);
  };

  if (loading) return <div className="p-12 text-center text-slate-400 text-xs">Memuat...</div>;

  if (!hasAnyScore) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto">
        <Award className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Nilai</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Nilai akan muncul setelah penilai mengisi formulir.
        </p>
      </div>
    );
  }

  const getCategoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      GURU: 'bg-amber-100 text-amber-800 border-amber-300',
      ATASAN: 'bg-blue-100 text-blue-800 border-blue-300',
      REKAN: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      BAWAHAN: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[cat] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      GURU: 'Guru Pengampu',
      ATASAN: 'Atasan',
      REKAN: 'Rekan Sejawat',
      BAWAHAN: 'Bawahan',
    };
    return map[cat] || cat;
  };

  return (
    <div className="space-y-6" id="rapor-container">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-600 via-amber-700 to-orange-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-white/20 border border-white/30">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/30">
                Rapor Digital 360°
              </span>
              <h2 className="text-xl font-black text-white mt-1">Nilai Saya — {activeClass?.name || ''}</h2>
              <p className="text-xs text-amber-100 mt-0.5">
                {user?.displayName} • {user?.role}
                {user?.divisionName ? ` • ${user.divisionName}` : ''}
              </p>
            </div>
          </div>
          <button onClick={handleDownloadPDF}
            className="px-4 py-2.5 rounded-xl bg-white text-amber-800 hover:bg-amber-50 font-bold text-xs flex items-center gap-2 shadow-lg print:hidden">
            <Printer className="w-4 h-4" /> Unduh PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-3xl border-2 shadow-md ${predikatInfo.color}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Nilai Akhir</p>
          <p className="text-5xl font-black mt-2 font-mono">{finalScore.toFixed(1)}</p>
          <p className="text-lg font-black mt-2">Predikat {predikatInfo.predikat}</p>
          <p className="text-xs mt-1 font-medium opacity-90">{predikatInfo.label}</p>
          <div className="mt-4 pt-3 border-t border-current/20">
            <p className="text-[10px] font-semibold">
              {finalScore >= 70 ? '✅ Memenuhi Standar' : '⚠️ Perlu Perbaikan'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm md:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-600" /> Grafik Radar 4 Tahapan
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Visualisasi kekuatan per tahapan</p>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="stage" tick={{ fontSize: 10, fill: '#475569' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} />
                <Radar name="Nilai" dataKey="score" stroke="#D97706" fill="#F59E0B" fillOpacity={0.5} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {categoryData.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Distribusi Penilai (360°)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categoryData.map((cat, i) => (
              <div key={i} className={`p-3 rounded-2xl border-2 ${getCategoryBadge(cat.name.toUpperCase())}`}>
                <p className="text-[10px] font-bold uppercase opacity-80">{getCategoryLabel(cat.name.toUpperCase())}</p>
                <p className="text-2xl font-black font-mono mt-1">{cat.value}</p>
                <p className="text-[10px] opacity-70">penilaian</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 italic flex items-center gap-1">
            <EyeOff className="w-3 h-3" />
            Penilaian dari bawahan/rekan ditampilkan sebagai rata-rata tanpa nama (anonim).
          </p>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" /> Perbandingan Nilai Antar Tahapan
        </h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="Nilai" radius={[6, 6, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.Nilai >= 90 ? '#F59E0B' :
                    entry.Nilai >= 80 ? '#3B82F6' :
                    entry.Nilai >= 70 ? '#10B981' :
                    entry.Nilai >= 60 ? '#F97316' : '#EF4444'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Rincian Per Kriteria ({isPemeran ? 'Pemeran' : 'Non-Pemeran'})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {myCriteria.map(c => {
            const isAuto = c.source !== 'MANUAL';
            const autoKey = c.source === 'AUTO_TASK' ? 'tanggung_jawab'
              : c.source === 'AUTO_ATTENDANCE' ? 'kehadiran'
              : c.source === 'AUTO_DISCIPLINE' ? 'kedisiplinan'
              : null;

            const manualVal = criteriaAvg(c.key);
            const autoVal = autoKey ? autoAvg(autoKey) : null;
            const displayVal = isAuto ? autoVal : manualVal;
            const sc = displayVal || 0;

            const colorClass =
              sc >= 3.5 ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10' :
              sc >= 2.5 ? 'border-blue-300 bg-blue-50 dark:bg-blue-500/10' :
              sc >= 1.5 ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10' :
              sc > 0 ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/10' :
              'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';

            return (
              <div key={c.key} className={`p-3 rounded-2xl border ${colorClass}`}>
                <div className="flex items-start justify-between mb-1 gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{c.label}</span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{c.weight}%</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  {isAuto ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center gap-0.5">
                      <Bot className="w-2.5 h-2.5" /> OTOMATIS
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      MANUAL
                    </span>
                  )}
                </div>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {displayVal !== null ? displayVal.toFixed(1) : '-'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {displayVal ? `≈ ${SCORE_SCALE[Math.round(displayVal)]?.score100}` : 'Belum dinilai'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${
                    sc >= 3.5 ? 'bg-emerald-500' :
                    sc >= 2.5 ? 'bg-blue-500' :
                    sc >= 1.5 ? 'bg-amber-500' : 'bg-rose-500'
                  }`} style={{ width: `${(sc / 4) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
            <strong>Skor OTOMATIS</strong> dihitung dari ketepatan tugas & presensi — objektif.
            <strong> Skor MANUAL</strong> diisi oleh atasan, rekan, atau bawahan sesuai matriks 360°.
          </p>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-600" /> Komentar dari Penilai ({comments.length})
        </h3>
        {comments.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">Belum ada komentar.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {comments.map(c => {
              const cat = (c as any).assessorCategory || 'REKAN';
              const shouldAnonymize = cat === 'BAWAHAN' || (cat === 'REKAN' && user?.role !== 'Pimpinan Produksi' && user?.role !== 'Sutradara');
              return (
                <div key={c.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between text-[11px] mb-1 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold px-2 py-0.5 rounded-md border ${getCategoryBadge(cat)}`}>
                        {getCategoryLabel(cat)}
                      </span>
                      {shouldAnonymize ? (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Anonim
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          {c.assessorName}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[10px]">
                      {new Date(c.createdAt || 0).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">"{c.comment}"</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Tahap: {c.stage} • Nilai: {c.totalScore}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden print:block text-center text-[10px] text-slate-500 pt-4 border-t">
        SP-PPT — SMP Negeri 10 Samarinda • T.A. 2025/2026 • Dicetak:{' '}
        {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
};
