import React, { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Eye, History,
  Search, User, MessageSquare, Clock,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { getPredikat } from '../../core/constants';
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

    // Cek nilai ekstrem (semua 4 atau semua 1)
    const allHigh = scores.every(s => s === 4);
    const allLow = scores.every(s => s === 1);
    if (allHigh) {
      anomalies.push({ type: 'Nilai Ekstrem', severity: 'medium', description: 'Semua kriteria diberi nilai 4 (Sangat Baik)' });
    }
    if (allLow) {
      anomalies.push({ type: 'Nilai Ekstrem', severity: 'high', description: 'Semua kriteria diberi nilai 1 (Kurang)' });
    }

    // Cek pola mencurigakan (semua sama)
    const allSame = scores.every(s => s === scores[0]);
    if (allSame && scores.length > 3) {
      anomalies.push({ type: 'Pola Mencurigakan', severity: 'low', description: 'Semua kriteria diberi nilai yang sama' });
    }

    // Cek komentar wajib jika ada nilai ≤ 2
    const hasLowScore = scores.some(s => s <= 2);
    if (hasLowScore && (!rec.comment || rec.comment.trim().length < 5)) {
      anomalies.push({ type: 'Komentar Hilang', severity: 'high', description: 'Ada nilai ≤ 2 tapi tidak ada komentar pembinaan' });
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
      details: `Validasi penilaian ${rec.assessorName} → ${rec.studentName}`,
    });
    showToast(`Penilaian ${rec.studentName} divalidasi.`, 'success');
  };

  if (!isGuruPengampu && !isAdminRole) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 mt-1">Hanya Guru Pengampu yang dapat mengakses moderasi penilaian.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Shield className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Moderasi Penilaian
            </span>
            <h2 className="text-xl font-black text-white mt-1">Validasi & Deteksi Anomali</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Sistem otomatis mendeteksi penilaian tidak wajar untuk direview guru
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 font-semibold">Total Penilaian</p>
          <p className="text-2xl font-black text-slate-900">{assessments.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
          <p className="text-[11px] text-amber-700 font-semibold">Perlu Review</p>
          <p className="text-2xl font-black text-amber-800">
            {assessWithAnomalies.filter(a => a.anomalies.length > 0).length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
          <p className="text-[11px] text-rose-700 font-semibold">Anomali Kritis</p>
          <p className="text-2xl font-black text-rose-800">
            {assessWithAnomalies.filter(a => a.anomalies.some(x => x.severity === 'high')).length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-600 font-semibold">Revisi Nilai</p>
          <p className="text-2xl font-black text-slate-800">{history.length}</p>
        </div>
      </div>

      {/* Tab */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('anomali')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'anomali' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          Anomali ({assessWithAnomalies.filter(a => a.anomalies.length > 0).length})
        </button>
        <button onClick={() => setActiveTab('semua')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'semua' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          Semua Penilaian ({assessments.length})
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'history' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          <History className="w-3.5 h-3.5" />
          History Revisi ({history.length})
        </button>

        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari nama siswa/penilai..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
        </div>
      </div>

      {/* TAB: ANOMALI & SEMUA */}
      {(activeTab === 'anomali' || activeTab === 'semua') && (
        <>
          {filteredAssessments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700">
                {activeTab === 'anomali' ? 'Tidak Ada Anomali' : 'Belum Ada Penilaian'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {activeTab === 'anomali' ? 'Semua penilaian terlihat wajar.' : 'Penilaian akan muncul setelah penilai mengisi.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssessments.map(({ assessment, anomalies }) => {
                const pred = getPredikat(assessment.totalScore);
                return (
                  <div key={assessment.id} className={`p-5 rounded-3xl bg-white border shadow-sm ${
                    anomalies.length > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
                  }`}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            assessment.assessorType === 'GURU' ? 'bg-amber-100 text-amber-800' :
                            assessment.assessorType === 'KETUA' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>{assessment.assessorType}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {assessment.stage}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${pred.color}`}>
                            {pred.predikat} • {assessment.totalScore}
                          </span>
                          {anomalies.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                              ⚠️ {anomalies.length} Anomali
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {assessment.studentName}
                          <span className="text-xs font-medium text-slate-500"> ← {assessment.assessorName} ({assessment.assessorRole})</span>
                        </p>
                        {assessment.comment && (
                          <p className="text-xs text-slate-600 mt-1 italic">"{assessment.comment}"</p>
                        )}
                      </div>
                      <button onClick={() => handleValidate(assessment)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Validasi
                      </button>
                    </div>

                    {anomalies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200 space-y-1.5">
                        {anomalies.map((a, i) => (
                          <div key={i} className={`flex items-start gap-2 text-[11px] p-2 rounded-lg ${
                            a.severity === 'high' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                            a.severity === 'medium' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                            'bg-blue-50 text-blue-800 border border-blue-200'
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

      {/* TAB: HISTORY */}
      {activeTab === 'history' && (
        <>
          {history.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Revisi</h3>
              <p className="text-xs text-slate-500 mt-1">Setiap perubahan nilai akan tercatat di sini.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Waktu Revisi</th>
                      <th className="py-3.5 px-4">Siswa</th>
                      <th className="py-3.5 px-4">Penilai</th>
                      <th className="py-3.5 px-4">Tahap</th>
                      <th className="py-3.5 px-4 text-center">Versi</th>
                      <th className="py-3.5 px-4 text-center">Nilai Lama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.slice(0, 50).map((h: any, i) => (
                      <tr key={h.id || i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                          {new Date(h.supersededAt || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{h.studentName}</td>
                        <td className="py-3 px-4">
                          <p className="text-[11px] text-slate-700">{h.assessorName}</p>
                          <p className="text-[10px] text-slate-400">{h.assessorRole}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">{h.stage}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            v{h.version || 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
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
