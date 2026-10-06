import React, { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Eye, History,
  Search, User, MessageSquare, Clock, Bot, Users, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { getPredikat, SCORE_SCALE } from '../../core/constants';
import { AssessmentRecord } from '../../core/types';
import {
  subscribeAssessments, subscribeAssessmentHistory, recordAuditLog,
} from '../../services/firestoreService';

interface Anomaly {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export const ModerationModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'anomali' | 'semua' | 'history'>('anomali');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!activeClass) return;
    const unsub1 = subscribeAssessments(activeClass.id, setAssessments);
    const unsub2 = subscribeAssessmentHistory(activeClass.id, setHistory);
    return () => { unsub1(); unsub2(); };
  }, [activeClass]);

  const detectAnomalies = (rec: AssessmentRecord): Anomaly[] => {
    const anomalies: Anomaly[] = [];
    const scores = Object.values(rec.scores || {});
    if (scores.length === 0) return anomalies;

    const allHigh = scores.every(s => s === 4);
    if (allHigh) {
      anomalies.push({
        type: 'Nilai Ekstrem Tinggi',
        severity: 'medium',
        description: 'Semua kriteria manual diberi nilai 4',
      });
    }

    const allLow = scores.every(s => s === 1);
    if (allLow) {
      anomalies.push({
        type: 'Nilai Ekstrem Rendah',
        severity: 'high',
        description: 'Semua kriteria diberi nilai 1',
      });
    }

    const allSame = scores.every(s => s === scores[0]);
    if (allSame && scores.length > 2 && scores[0] !== 1 && scores[0] !== 4) {
      anomalies.push({
        type: 'Pola Mencurigakan',
        severity: 'low',
        description: 'Semua kriteria diberi nilai sama',
      });
    }

    const hasLowScore = scores.some(s => s <= 2);
    if (hasLowScore && (!rec.comment || rec.comment.trim().length < 5)) {
      anomalies.push({
        type: 'Komentar Hilang',
        severity: 'high',
        description: 'Ada nilai ≤ 2 tapi tidak ada komentar',
      });
    }

    const autoScores = (rec as any).autoScores || {};
    const autoTJ = autoScores.tanggung_jawab;
    const autoHadir = autoScores.kehadiran;

    const manualAvg = scores.length > 0 ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;

    if (manualAvg >= 3.5) {
      if ((autoTJ !== undefined && autoTJ < 3) || (autoHadir !== undefined && autoHadir < 3)) {
        anomalies.push({
          type: 'Ketidaksesuaian Data',
          severity: 'high',
          description: `Manual tinggi (${manualAvg.toFixed(1)}) padahal auto rendah (TJ: ${autoTJ ?? '-'}, Hadir: ${autoHadir ?? '-'})`,
        });
      }
    }

    if (autoTJ !== undefined && manualAvg > 0) {
      const gap = Math.abs(manualAvg - autoTJ);
      if (gap >= 2) {
        anomalies.push({
          type: 'Gap Manual vs Auto',
          severity: 'medium',
          description: `Manual (avg ${manualAvg.toFixed(1)}) vs Auto TJ (${autoTJ}). Selisih ≥ 2.`,
        });
      }
    }

    if (allLow && (!rec.comment || rec.comment.trim().length < 20)) {
      anomalies.push({
        type: 'Skor Rendah Tanpa Alasan',
        severity: 'high',
        description: 'Nilai 1 semua tapi komentar < 20 karakter',
      });
    }

    return anomalies;
  };

  const assessWithAnomalies = assessments.map(a => ({
    assessment: a,
    anomalies: detectAnomalies(a),
  }));

  const filteredAssessments = assessWithAnomalies.filter(({ assessment }) => {
    if (activeTab === 'anomali' && detectAnomalies(assessment).length === 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        assessment.studentName.toLowerCase().includes(q) ||
        assessment.assessorName.toLowerCase().includes(q) ||
        assessment.stage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleValidate = async (rec: AssessmentRecord) => {
    if (!user) return;
    await recordAuditLog({
      userId: user.uid,
      userName: user.displayName,
      role: user.role,
      action: 'UPDATE',
      targetType: 'AssessmentModeration',
      targetId: rec.id,
      details: `Validasi: ${rec.assessorName} → ${rec.studentName}`,
    });
    showToast(`Penilaian ${rec.studentName} divalidasi.`, 'success');
  };

  if (!isGuruPengampu && !isAdminRole) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hanya Guru Pengampu yang dapat mengakses moderasi.
        </p>
      </div>
    );
  }

  const highCount = assessWithAnomalies.filter(a => a.anomalies.some(x => x.severity === 'high')).length;
  const totalAnomaly = assessWithAnomalies.filter(a => a.anomalies.length > 0).length;

  const getCategoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      GURU: 'bg-amber-100 text-amber-800 border-amber-300',
      ATASAN: 'bg-blue-100 text-blue-800 border-blue-300',
      REKAN: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      BAWAHAN: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[cat] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Shield className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Moderasi Penilaian 360°
            </span>
            <h2 className="text-xl font-black text-white mt-1">Validasi & Deteksi Anomali</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Deteksi otomatis + gap dengan skor otomatis
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Penilaian</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{assessments.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">Perlu Review</p>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-200">{totalAnomaly}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm">
          <p className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">Anomali Kritis</p>
          <p className="text-2xl font-black text-rose-800 dark:text-rose-200">{highCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Revisi Nilai</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">{history.length}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('anomali')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'anomali' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          <AlertTriangle className="w-3.5 h-3.5" /> Anomali ({totalAnomaly})
        </button>
        <button onClick={() => setActiveTab('semua')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'semua' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Semua ({assessments.length})
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'history' ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          <History className="w-3.5 h-3.5" /> Riwayat ({history.length})
        </button>

        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari siswa/penilai..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
      </div>

      {(activeTab === 'anomali' || activeTab === 'semua') && (
        <>
          {filteredAssessments.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                {activeTab === 'anomali' ? 'Tidak Ada Anomali' : 'Belum Ada Penilaian'}
              </h3>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssessments.map(({ assessment, anomalies }) => {
                const pred = getPredikat(assessment.totalScore);
                const cat = (assessment as any).assessorCategory || 'REKAN';
                const autoScores = (assessment as any).autoScores || {};

                return (
                  <div key={assessment.id} className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border shadow-sm ${
                    anomalies.length > 0 ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/5' : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCategoryBadge(cat)}`}>
                            {cat}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {assessment.stage}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${pred.color}`}>
                            {pred.predikat} • {assessment.totalScore}
                          </span>
                          {anomalies.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300">
                              ⚠️ {anomalies.length} Anomali
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {assessment.studentName}
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {' '}← {assessment.assessorName} ({assessment.assessorRole})
                          </span>
                        </p>

                        {(autoScores.tanggung_jawab || autoScores.kehadiran) && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Bot className="w-3 h-3" /> Auto:
                            </span>
                            {autoScores.tanggung_jawab !== undefined && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${SCORE_SCALE[autoScores.tanggung_jawab]?.badgeColor}`}>
                                TJ: {autoScores.tanggung_jawab}
                              </span>
                            )}
                            {autoScores.kehadiran !== undefined && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${SCORE_SCALE[autoScores.kehadiran]?.badgeColor}`}>
                                Hadir: {autoScores.kehadiran}
                              </span>
                            )}
                            {autoScores.kedisiplinan !== undefined && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${SCORE_SCALE[autoScores.kedisiplinan]?.badgeColor}`}>
                                Disiplin: {autoScores.kedisiplinan}
                              </span>
                            )}
                          </div>
                        )}

                        {assessment.comment && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic">"{assessment.comment}"</p>
                        )}
                      </div>
                      <button onClick={() => handleValidate(assessment)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Validasi
                      </button>
                    </div>

                    {anomalies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-500/30 space-y-1.5">
                        {anomalies.map((a, i) => (
                          <div key={i} className={`flex items-start gap-2 text-[11px] p-2 rounded-lg ${
                            a.severity === 'high' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-200' :
                            a.severity === 'medium' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-200' :
                            'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-200 border border-blue-200'
                          }`}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span><strong>{a.type}:</strong> {a.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {history.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Revisi</h3>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Waktu</th>
                      <th className="py-3.5 px-4">Siswa</th>
                      <th className="py-3.5 px-4">Penilai</th>
                      <th className="py-3.5 px-4">Tahap</th>
                      <th className="py-3.5 px-4 text-center">Versi</th>
                      <th className="py-3.5 px-4 text-center">Nilai Lama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {history.slice(0, 50).map((h: any, i) => (
                      <tr key={h.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                          {new Date(h.supersededAt || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{h.studentName}</td>
                        <td className="py-3 px-4">
                          <p className="text-[11px] text-slate-700 dark:text-slate-300">{h.assessorName}</p>
                          <p className="text-[10px] text-slate-400">{h.assessorRole}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">{h.stage}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            v{h.version || 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {h.totalScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
