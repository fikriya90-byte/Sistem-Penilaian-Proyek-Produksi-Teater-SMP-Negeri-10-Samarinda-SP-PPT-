import React, { useState, useEffect } from 'react';
import {
  Award, Printer, MessageSquare, CheckCircle, Clock, Target,
  BarChart3, Lightbulb, Star, TrendingUp,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell,
} from 'recharts';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  ACTOR_CRITERIA, GENERAL_CRITERIA, SCORE_SCALE, STAGES, getPredikat,
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

  const isActor = user?.role === 'Pemain';
  const myCriteria = isActor ? ACTOR_CRITERIA : GENERAL_CRITERIA;

  const getStageScore = (stage: ProductionStage) => {
    const stageRecords = assessments.filter(a => a.stage === stage);
    if (stageRecords.length === 0) return null;

    const byType: Record<string, AssessmentRecord[]> = {};
    stageRecords.forEach(r => {
      if (!byType[r.assessorType]) byType[r.assessorType] = [];
      byType[r.assessorType].push(r);
    });

    const avg = (arr: AssessmentRecord[]) =>
      arr.length > 0 ? arr.reduce((s, a) => s + a.totalScore, 0) / arr.length : null;

    const guru = byType['GURU'] ? avg(byType['GURU']) : null;
    const ketua = byType['KETUA'] ? avg(byType['KETUA']) : null;
    const rekan = byType['REKAN'] ? avg(byType['REKAN']) : null;

    let sum = 0, wSum = 0;
    if (guru !== null) { sum += guru * 0.5; wSum += 0.5; }
    if (ketua !== null) { sum += ketua * 0.3; wSum += 0.3; }
    if (rekan !== null) { sum += rekan * 0.2; wSum += 0.2; }
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

  const criteriaScores: Record<string, number[]> = {};
  assessments.forEach(a => {
    Object.entries(a.scores || {}).forEach(([k, v]) => {
      if (!criteriaScores[k]) criteriaScores[k] = [];
      criteriaScores[k].push(v);
    });
  });

  const criteriaAvg = (key: string) => {
    const arr = criteriaScores[key] || [];
    if (arr.length === 0) return null;
    return Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10;
  };

  const criteriaWithScore = myCriteria.map(c => ({
    ...c,
    avgScore: criteriaAvg(c.key),
  }));

  const lowestCriteria = [...criteriaWithScore]
    .filter(c => c.avgScore !== null)
    .sort((a, b) => (a.avgScore || 0) - (b.avgScore || 0))[0];

  const comments = assessments
    .filter(a => a.comment && a.comment.trim())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const history = [...assessments].sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const handleDownloadPDF = () => {
    showToast('Dialog cetak dibuka. Pilih "Save as PDF" untuk mengunduh.', 'info');
    setTimeout(() => window.print(), 300);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Memuat data penilaian...
      </div>
    );
  }

  if (!hasAnyScore) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto">
        <Award className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Nilai</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Anda belum menerima penilaian dari Guru, Ketua, atau Rekan Sejawat.
          Nilai akan muncul setelah penilai mengisi formulir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="rapor-container">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-600 via-amber-700 to-orange-800 text-white shadow-xl border border-amber-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-white/20 text-white border border-white/30">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/30">
                Rapor Digital
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Nilai Saya — {activeClass?.name || ''}
              </h2>
              <p className="text-xs text-amber-100 mt-0.5">
                {user?.displayName} • {user?.role}
                {user?.divisionName ? ` • ${user.divisionName}` : ''}
              </p>
            </div>
          </div>

          <button onClick={handleDownloadPDF}
            className="px-4 py-2.5 rounded-xl bg-white text-amber-800 hover:bg-amber-50 font-bold text-xs flex items-center gap-2 shadow-lg transition print:hidden">
            <Printer className="w-4 h-4" />
            <span>Unduh Rapor PDF</span>
          </button>
        </div>
      </div>

      {/* Kartu Nilai Akhir + Radar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-3xl border-2 shadow-md md:col-span-1 ${predikatInfo.color}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Nilai Akhir</p>
          <p className="text-5xl font-black mt-2 font-mono">{finalScore.toFixed(1)}</p>
          <p className="text-lg font-black mt-2">Predikat {predikatInfo.predikat}</p>
          <p className="text-xs mt-1 font-medium opacity-90">{predikatInfo.label}</p>
          <div className="mt-4 pt-3 border-t border-current/20">
            <p className="text-[10px] font-semibold">
              {finalScore >= 70 ? '✅ Memenuhi Standar Kelulusan' : '⚠️ Perlu Perbaikan'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm md:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-600" />
            Grafik Radar 4 Tahapan Produksi
          </h3>
          <p className="text-[11px] text-slate-500 mb-2">Visualisasi kekuatan per tahapan</p>
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

      {/* Bar Chart */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          Perbandingan Nilai Antar Tahapan
        </h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="Nilai" fill="#3B82F6" radius={[6, 6, 0, 0]}>
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

      {/* Rincian Kriteria */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Rincian Per Kriteria ({isActor ? 'Pemain' : 'Non-Pemain'})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {criteriaWithScore.map(c => {
            const score100 = c.avgScore ? SCORE_SCALE[Math.round(c.avgScore)]?.score100 : null;
            const sc = c.avgScore || 0;
            const colorClass =
              sc >= 3.5 ? 'border-emerald-300 bg-emerald-50' :
              sc >= 2.5 ? 'border-blue-300 bg-blue-50' :
              sc >= 1.5 ? 'border-amber-300 bg-amber-50' :
              sc > 0 ? 'border-rose-300 bg-rose-50' :
              'border-slate-200 bg-slate-50';
            return (
              <div key={c.key} className={`p-3 rounded-2xl border ${colorClass}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800">{c.label}</span>
                  <span className="text-[10px] font-bold text-slate-500">{c.weight}%</span>
                </div>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {c.avgScore !== null ? c.avgScore.toFixed(1) : '-'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {score100 ? `≈ ${score100}` : 'Belum dinilai'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sc >= 3.5 ? 'bg-emerald-500' :
                      sc >= 2.5 ? 'bg-blue-500' :
                      sc >= 1.5 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${(sc / 4) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rekomendasi Perbaikan */}
      {lowestCriteria && lowestCriteria.avgScore !== null && lowestCriteria.avgScore < 3 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
              <Lightbulb className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-amber-900">Rekomendasi Perbaikan</h3>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                Berdasarkan rincian nilai, aspek yang perlu Anda tingkatkan adalah{' '}
                <strong>{lowestCriteria.label}</strong> (nilai:{' '}
                <strong>{lowestCriteria.avgScore.toFixed(1)}</strong>). {lowestCriteria.desc}
              </p>
              <p className="text-[11px] text-amber-700 mt-2 italic">
                Fokus latihan pada aspek ini bersama koordinator / sutradara Anda.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Komentar Penilai */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-600" />
          Komentar dari Penilai ({comments.length})
        </h3>
        {comments.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">
            Belum ada komentar dari penilai.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {comments.map(c => (
              <div key={c.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between text-[11px] mb-1 flex-wrap gap-2">
                  <span className={`font-bold px-2 py-0.5 rounded-md ${
                    c.assessorType === 'GURU' ? 'bg-amber-100 text-amber-800' :
                    c.assessorType === 'KETUA' ? 'bg-blue-100 text-blue-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {c.assessorType} • {c.assessorRole}
                  </span>
                  <span className="text-slate-400">
                    {new Date(c.createdAt || 0).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed italic">"{c.comment}"</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Tahap: {c.stage} • Nilai: {c.totalScore}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Riwayat Penilaian */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-600" />
          Riwayat Penilaian Saya ({history.length})
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">
            Belum ada riwayat penilaian.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Penilai</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3">Tahap</th>
                  <th className="py-2.5 px-3 text-center">Nilai</th>
                  <th className="py-2.5 px-3">Komentar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.slice(0, 20).map(h => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">
                      {new Date(h.createdAt || 0).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-800 text-[11px]">{h.assessorName}</span>
                      <p className="text-[10px] text-slate-400">{h.assessorRole}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        h.assessorType === 'GURU' ? 'bg-amber-100 text-amber-800' :
                        h.assessorType === 'KETUA' ? 'bg-blue-100 text-blue-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>{h.assessorType}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">{h.stage}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                      {h.totalScore}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                      {h.comment || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Footer */}
      <div className="hidden print:block text-center text-[10px] text-slate-500 pt-4 border-t">
        SP-PPT — SMP Negeri 10 Samarinda • T.A. 2025/2026 • Dicetak:{' '}
        {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
};
