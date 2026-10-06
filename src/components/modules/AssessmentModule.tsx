import React, { useState, useEffect } from 'react';
import {
  Award, Download, Lock, Unlock, Search, UserCheck, Users, CheckCircle,
  Calculator, EyeOff, TrendingUp, Info, AlertTriangle, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import {
  PEMERAN_CRITERIA, GENERAL_CRITERIA, getPredikat, SCORE_SCALE, STAGES,
  getAssessorWeights, getAssessmentMatrix,
} from '../../core/constants';
import {
  AssessmentRecord, ProductionStage, UserProfile, TaskItem, AttendanceSession, AttendanceRecord,
} from '../../core/types';
import {
  fetchUsersByClass, recordAuditLog, saveAssessment, subscribeAssessments,
  subscribeTasksByClass, subscribeAttendanceSessions, subscribeAllAttendanceRecords,
} from '../../services/firestoreService';
import {
  computeTaskResponsibility, computeAttendanceScore, computePemeranDiscipline,
} from '../../services/autoScoreService';
import { useToast } from '../common/Toast';

export const AssessmentModule: React.FC = () => {
  const { user, activeClass, isTeacher, isAdminRole, isGuruPengampu, canAssessTarget } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [isLockedByTeacher, setIsLockedByTeacher] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe data
  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(u => {
      setStudents(u.filter(s =>
        s.role !== 'Guru Pengampu' && s.role !== 'Admin' && s.role !== 'Super Admin'
      ));
    });
    const unsub1 = subscribeAssessments(activeClass.id, setAssessments);
    const unsub2 = subscribeTasksByClass(activeClass.id, setTasks);
    const unsub3 = subscribeAttendanceSessions(activeClass.id, setSessions);
    const unsub4 = subscribeAllAttendanceRecords(activeClass.id, setAttendanceRecords);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [activeClass]);

  const isPemeran = selectedStudent?.role === 'Pemeran';
  const criteriaList = isPemeran ? PEMERAN_CRITERIA : GENERAL_CRITERIA;
  const manualCriteria = criteriaList.filter(c => c.source === 'MANUAL');

  // =========================================================
  // HITUNG AUTO SCORES
  // =========================================================
  const computeAutoScoresFor = (student: UserProfile, stage: ProductionStage) => {
    // Asumsikan submissions adalah deadlineSubmissions (perlu subscribe tambahan)
    // Untuk penyederhanaan, gunakan tasks langsung (setelah nanti integrasi)
    const taskResult = computeTaskResponsibility(student, tasks, [], stage);
    const attendResult = computeAttendanceScore(student, sessions, attendanceRecords, stage);

    const autoScores: any = {
      tanggung_jawab: taskResult.score,
      kehadiran: attendResult.score,
    };
    if (student.role === 'Pemeran') {
      autoScores.kedisiplinan = computePemeranDiscipline(taskResult.score, attendResult.score);
    }

    return { autoScores, taskResult, attendResult };
  };

  // =========================================================
  // HITUNG TOTAL SCORE
  // =========================================================
  const calculateTotalScore = () => {
    if (!selectedStudent) return 0;
    const { autoScores } = computeAutoScoresFor(selectedStudent, selectedStage);

    let weightedSum = 0;
    let totalWeight = 0;
    criteriaList.forEach(c => {
      let score = 3;
      if (c.source === 'MANUAL') {
        score = manualScores[c.key] || 3;
      } else {
        // Auto source
        const key = c.source === 'AUTO_TASK' ? 'tanggung_jawab'
          : c.source === 'AUTO_ATTENDANCE' ? 'kehadiran'
          : c.source === 'AUTO_DISCIPLINE' ? 'kedisiplinan'
          : null;
        if (key) score = autoScores[key] || 3;
      }
      const converted = SCORE_SCALE[score]?.score100 || 80;
      weightedSum += converted * c.weight;
      totalWeight += c.weight;
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 80;
  };

  const openGradingModal = (student: UserProfile) => {
    if (!canAssessTarget(student)) {
      showToast('Anda tidak memiliki wewenang menilai siswa ini.', 'warning');
      return;
    }
    setSelectedStudent(student);
    const initial: Record<string, number> = {};
    manualCriteria.forEach(c => { initial[c.key] = 3; });
    setManualScores(initial);
    setComment('');
    setIsGradingOpen(true);
  };

  const handleSaveAssessment = async () => {
    if (!user || !selectedStudent || !activeClass) return;
    const hasLowManual = Object.values(manualScores).some(v => v <= 2);
    if (hasLowManual && (!comment || comment.trim().length < 5)) {
      showToast('Komentar pembinaan wajib diisi bila ada nilai ≤ 2!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { autoScores } = computeAutoScoresFor(selectedStudent, selectedStage);
      const totalScore = calculateTotalScore();

      // Tentukan kategori penilai
      const matrix = getAssessmentMatrix(selectedStudent.role);
      let category: 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN' = 'REKAN';
      for (const rel of matrix) {
        if (rel.roles.includes(user.role)) {
          category = rel.category;
          break;
        }
      }

      await saveAssessment({
        classId: activeClass.id,
        productionId: 'prod',
        studentId: selectedStudent.uid,
        studentName: selectedStudent.displayName,
        studentRole: selectedStudent.role,
        studentDivision: selectedStudent.divisionName,
        assessorId: user.uid,
        assessorName: user.displayName,
        assessorRole: user.role,
        assessorCategory: category,
        stage: selectedStage,
        scores: manualScores,
        autoScores,
        totalScore,
        comment: comment.trim(),
        isFinal: true,
      } as any);

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'ASSESS', targetType: 'Assessment',
        targetId: selectedStudent.uid,
        details: `Memberi nilai ${totalScore} untuk ${selectedStudent.displayName} (${selectedStage}) — kategori: ${category}`,
      });

      showToast(`Penilaian berhasil disimpan!`, 'success');
      setIsGradingOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // AGREGASI NILAI DENGAN 4 KATEGORI PENILAI
  // =========================================================
  const getAggregatedScore = (studentId: string, studentRole: string) => {
    const records = assessments.filter(a => a.studentId === studentId && a.stage === selectedStage);
    if (records.length === 0) return null;

    const byCat: Record<string, number[]> = { GURU: [], ATASAN: [], REKAN: [], BAWAHAN: [] };
    records.forEach(r => {
      const cat = (r as any).assessorCategory || 'REKAN';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(r.totalScore);
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
    const guruScore = avg(byCat.GURU);
    const atasanScore = avg(byCat.ATASAN);
    const rekanScore = avg(byCat.REKAN);
    const bawahanScore = avg(byCat.BAWAHAN);

    const weights = getAssessorWeights(studentRole);
    let weightedSum = 0;
    let weightTotal = 0;

    if (guruScore !== null && weights.GURU > 0) { weightedSum += guruScore * weights.GURU; weightTotal += weights.GURU; }
    if (atasanScore !== null && weights.ATASAN > 0) { weightedSum += atasanScore * weights.ATASAN; weightTotal += weights.ATASAN; }
    if (rekanScore !== null && weights.REKAN > 0) { weightedSum += rekanScore * weights.REKAN; weightTotal += weights.REKAN; }
    if (bawahanScore !== null && weights.BAWAHAN > 0) { weightedSum += bawahanScore * weights.BAWAHAN; weightTotal += weights.BAWAHAN; }

    const finalVal = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0;
    return { finalVal, guruScore, atasanScore, rekanScore, bawahanScore, count: records.length };
  };

  const filteredStudents = students.filter(s =>
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER + Stage Selector */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Penilaian 360° Multi-Kategori
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auto-score dari Tugas & Presensi + Penilaian Atasan/Rekan/Bawahan
              </p>
            </div>
          </div>

          <select value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value as ProductionStage)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white">
            {STAGES.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.defaultWeight}%)
              </option>
            ))}
          </select>
        </div>

        {/* Info box */}
        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 dark:text-blue-200">
            <p><strong>Skor otomatis</strong> dari sistem (Tugas & Presensi): Tanggung Jawab (25%), Kehadiran (20%), Kedisiplinan Khusus Pemeran (10%).</p>
            <p className="mt-1"><strong>Skor manual</strong> oleh penilai: Kerja Sama (25%), Kreativitas (15%), Keahlian Teknis (15%) — atau untuk Pemeran: Hafalan, Penjiwaan, Suara, Blocking, Interaksi.</p>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input type="text" placeholder="Cari siswa atau peran..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
      </div>

      {/* TABLE dengan 4 KOLOM KATEGORI */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="py-3.5 px-4">Nama</th>
                <th className="py-3.5 px-4">Peran</th>
                <th className="py-3.5 px-4 text-center">Guru</th>
                <th className="py-3.5 px-4 text-center">Atasan</th>
                <th className="py-3.5 px-4 text-center">Rekan</th>
                <th className="py-3.5 px-4 text-center">Bawahan</th>
                <th className="py-3.5 px-4 text-center">Nilai Akhir</th>
                <th className="py-3.5 px-4 text-center">Predikat</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredStudents.map(student => {
                const agg = getAggregatedScore(student.uid, student.role);
                const predInfo = agg ? getPredikat(agg.finalVal) : null;
                const canGrade = canAssessTarget(student);

                return (
                  <tr key={student.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{student.displayName}</td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-600 dark:text-slate-400">{student.role}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.guruScore?.toFixed(1) ?? '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.atasanScore?.toFixed(1) ?? '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.rekanScore?.toFixed(1) ?? '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.bawahanScore?.toFixed(1) ?? '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {agg ? <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{agg.finalVal}</span> : <span className="text-xs text-slate-400 italic">-</span>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {predInfo ? (
                        <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs border ${predInfo.color}`}>
                          {predInfo.predikat}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {canGrade && !isLockedByTeacher ? (
                        <button onClick={() => openGradingModal(student)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                          Nilai
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">{isLockedByTeacher ? 'Terkunci' : 'Hanya Lihat'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PENILAIAN dengan auto score */}
      {isGradingOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="p-6 bg-slate-900 dark:bg-slate-800 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase">
                    Penilaian 360° • {selectedStage}
                  </span>
                  <h3 className="text-lg font-black mt-0.5">Menilai: {selectedStudent.displayName}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedStudent.role}
                    {selectedStudent.divisionName ? ` • ${selectedStudent.divisionName}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Perkiraan Nilai</p>
                  <p className="text-3xl font-black text-amber-400 font-mono">{calculateTotalScore()}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">

              {/* ============ AUTO SCORE SECTION ============ */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-200 dark:border-blue-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-black text-blue-900 dark:text-blue-200">
                    🤖 SKOR OTOMATIS (Dihitung Sistem)
                  </h4>
                </div>
                {(() => {
                  const { autoScores, taskResult, attendResult } = computeAutoScoresFor(selectedStudent, selectedStage);
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30">
                        <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Tanggung Jawab</p>
                        <p className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">{autoScores.tanggung_jawab}</p>
                        <p className="text-[9px] text-blue-600 dark:text-blue-400">
                          {taskResult.pctOnTime}% tepat waktu
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30">
                        <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Kehadiran</p>
                        <p className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">{autoScores.kehadiran}</p>
                        <p className="text-[9px] text-blue-600 dark:text-blue-400">
                          {attendResult.pct}% hadir
                        </p>
                      </div>
                      {selectedStudent.role === 'Pemeran' && (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30">
                          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Kedisiplinan</p>
                          <p className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">{autoScores.kedisiplinan}</p>
                          <p className="text-[9px] text-blue-600 dark:text-blue-400">
                            rata-rata TJ & Kehadiran
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ============ MANUAL SCORE SECTION ============ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    ✋ PENILAIAN MANUAL (Skor dari Anda)
                  </h4>
                </div>
                <div className="space-y-3">
                  {manualCriteria.map(crit => {
                    const currentVal = manualScores[crit.key] || 3;
                    const scaleInfo = SCORE_SCALE[currentVal];
                    return (
                      <div key={crit.key} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{crit.label}</span>
                            <span className="text-[10px] text-slate-400 ml-2">Bobot: {crit.weight}%</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{crit.desc}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${scaleInfo.badgeColor}`}>
                            {currentVal} • {scaleInfo.label}
                          </span>
                        </div>
                        <input type="range" min="1" max="4" step="1" value={currentVal}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setManualScores(prev => ({ ...prev, [crit.key]: val }));
                          }}
                          className="w-full accent-amber-500 cursor-pointer" />
                        <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                          <span>1 Kurang (40)</span>
                          <span>2 Cukup (60)</span>
                          <span>3 Baik (80)</span>
                          <span>4 Sangat Baik (100)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Komentar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Komentar & Catatan Pembinaan
                  {Object.values(manualScores).some(v => v <= 2) && (
                    <span className="text-rose-500 font-bold ml-1">(Wajib karena ada nilai ≤ 2)</span>
                  )}
                </label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Berikan catatan konstruktif. Jika skor ≤ 2, sebutkan tugas & kejadiannya secara spesifik..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between shrink-0">
              <button onClick={() => setIsGradingOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Batal
              </button>
              <button onClick={handleSaveAssessment} disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50">
                {isSubmitting ? 'Menyimpan...' : 'Finalisasi & Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
