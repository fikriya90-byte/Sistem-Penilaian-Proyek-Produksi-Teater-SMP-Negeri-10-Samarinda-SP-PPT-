import React, { useState, useEffect } from 'react';
import {
  Award, Lock, Unlock, Search, Users, CheckCircle,
  Calculator, TrendingUp, Info, AlertTriangle, Sparkles, Bot,
  Trash2, RotateCcw, X, Edit3, ShieldAlert, Filter, Clock,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import {
  PEMERAN_CRITERIA, GENERAL_CRITERIA, getPredikat, SCORE_SCALE, STAGES,
  getAssessorWeights, getAssessmentMatrix, AUTO_SCORE_THRESHOLDS,
} from '../../core/constants';
import {
  AssessmentRecord, ProductionStage, UserProfile,
} from '../../core/types';
import {
  fetchUsersByClass, recordAuditLog, saveAssessment, subscribeAssessments,
  subscribeTasksByClass, subscribeAttendanceSessions, subscribeAllAttendanceRecords,
} from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, getDoc,
  deleteDoc, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useToast } from '../common/Toast';

// =========================================================
// INLINE AUTO SCORE FUNCTIONS
// =========================================================
function computeTaskResponsibility(
  student: UserProfile,
  tasks: any[],
  submissions: any[],
  stage: ProductionStage
) {
  const myTasks = tasks.filter(t => {
    if (t.stageId && t.stageId !== stage) return false;
    return (
      t.assigneeId === student.uid ||
      t.targetRole === student.role ||
      t.targetDivision === student.divisionName ||
      t.assigneeName === 'Semua Siswa' ||
      t.assigneeName === 'Semua Anggota Divisi'
    );
  });

  let awal = 0, tepat = 0, telatRingan = 0, telatBerat = 0, belum = 0;
  let criticalLate = 0, criticalMissed = 0;

  myTasks.forEach(task => {
    const sub = submissions.find(s => s.deadlineId === task.id && s.studentId === student.uid);
    const isCritical = !!task.isCritical;

    if (!sub || sub.status === 'BELUM') {
      belum += 1;
      if (isCritical) criticalMissed += 1;
      return;
    }

    if (sub.status === 'SELESAI' && sub.submittedAt) {
      const dueMs = new Date(task.dueDate).getTime();
      const subMs = new Date(sub.submittedAt).getTime();
      const diffDays = Math.floor((subMs - dueMs) / 86400000);

      if (diffDays <= -1) awal += 1;
      else if (diffDays === 0) tepat += 1;
      else if (diffDays <= 2) {
        telatRingan += 1;
        if (isCritical && diffDays > 1) criticalLate += 1;
      } else {
        telatBerat += 1;
        if (isCritical) criticalLate += 1;
      }
    } else if (sub.status === 'TERLAMBAT') {
      telatBerat += 1;
      if (isCritical) criticalLate += 1;
    }
  });

  const totalTasks = myTasks.length;
  if (totalTasks === 0) {
    return { score: 4, totalTasks: 0, pctOnTime: 100, criticalLate: 0, criticalMissed: 0 };
  }

  const onTime = awal + tepat;
  const pctOnTime = Math.round((onTime / totalTasks) * 100);

  let score: 1 | 2 | 3 | 4;
  if (pctOnTime >= 90 && criticalLate === 0 && criticalMissed === 0) score = 4;
  else if (pctOnTime >= 75 && criticalLate <= 0) score = 3;
  else if (pctOnTime >= 50 && criticalMissed === 0) score = 2;
  else score = 1;

  if (criticalMissed > 0) score = 1;

  return { score, totalTasks, pctOnTime, criticalLate, criticalMissed };
}

function computeAttendanceScore(
  student: UserProfile,
  sessions: any[],
  records: any[],
  stage: ProductionStage
) {
  const stageSessions = sessions.filter(s => {
    if (s.stageId && s.stageId !== stage) return false;
    return true;
  });

  const sessionIds = new Set(stageSessions.map(s => s.id));
  const myRecords = records.filter(r => r.studentId === student.uid && sessionIds.has(r.sessionId));

  let hadir = 0, izinSakit = 0, alpa = 0;
  let hasFatalAlpa = false;

  myRecords.forEach(r => {
    if (r.status === 'Hadir') hadir += 1;
    else if (r.status === 'Izin' || r.status === 'Sakit') izinSakit += 1;
    else if (r.status === 'Alpa') {
      alpa += 1;
      const session = stageSessions.find(s => s.id === r.sessionId);
      if (session && (session.activityType === 'Gladi' || session.activityType === 'Pementasan')) {
        hasFatalAlpa = true;
      }
    }
  });

  const totalSessions = myRecords.length;
  if (totalSessions === 0) {
    return { score: 4, totalSessions: 0, pct: 100, hasFatalAlpa: false };
  }

  const effectiveHadir = hadir + izinSakit;
  const pct = Math.round((effectiveHadir / totalSessions) * 100);

  let score: 1 | 2 | 3 | 4;
  if (pct >= AUTO_SCORE_THRESHOLDS.attendance.excellent) score = 4;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.good) score = 3;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.fair) score = 2;
  else score = 1;

  if (alpa >= 3 || hasFatalAlpa) score = Math.min(score, 2) as any;

  return { score, totalSessions, pct, hasFatalAlpa };
}

function computePemeranDiscipline(taskScore: number, attendScore: number): 1 | 2 | 3 | 4 {
  const avg = (taskScore + attendScore) / 2;
  return Math.floor(avg) as 1 | 2 | 3 | 4;
}

// =========================================================
// MAIN COMPONENT
// =========================================================
export const AssessmentModule: React.FC = () => {
  const {
    user, activeClass, isAdminRole, isGuruPengampu, canAssessTarget,
  } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ Stage config
  const [stageConfig, setStageConfig] = useState<any>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // ✅ Admin/guru bisa reset & edit
  const canManageAll = isGuruPengampu || isAdminRole;

  // =========================================================
  // SUBSCRIBE DATA
  // =========================================================
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

    let unsub5 = () => {};
    (async () => {
      const q = query(collection(db, 'deadlineSubmissions'), where('classId', '==', activeClass.id));
      unsub5 = onSnapshot(q, snap => {
        setSubmissions(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      });
    })();

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [activeClass]);

  // ✅ Subscribe stage config
  useEffect(() => {
    if (!activeClass) return;
    const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data();
        setStageConfig(data);
        // Auto set ke currentStage
        if (data.currentStage) {
          setSelectedStage(data.currentStage);
        }
      }
    });
    return () => unsub();
  }, [activeClass]);

  // =========================================================
  // STAGE GATE
  // =========================================================
  const isStageEnabled = (stageId: ProductionStage): boolean => {
    if (!stageConfig?.stageDeadlines) return true; // kalau config belum ada → semua boleh
    const cfg = stageConfig.stageDeadlines[stageId];
    if (!cfg) return true;
    return cfg.enabled !== false;
  };

  const isStageLocked = !isStageEnabled(selectedStage);
  const currentActiveStage = stageConfig?.currentStage || 'PELAKSANAAN';
  const isSelectedNotCurrent = selectedStage !== currentActiveStage;

  // =========================================================
  // AUTO SCORE
  // =========================================================
  const isPemeran = selectedStudent?.role === 'Pemeran';
  const criteriaList = isPemeran ? PEMERAN_CRITERIA : GENERAL_CRITERIA;
  const manualCriteria = criteriaList.filter(c => c.source === 'MANUAL');

  const computeAutoScoresFor = (student: UserProfile, stage: ProductionStage) => {
    const taskResult = computeTaskResponsibility(student, tasks, submissions, stage);
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

  // =========================================================
  // OPEN GRADING
  // =========================================================
  const openGradingModal = (student: UserProfile) => {
    if (isStageLocked) {
      showToast(`Tahap ${selectedStage} belum dibuka oleh Guru.`, 'warning');
      return;
    }
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

  // =========================================================
  // SAVE ASSESSMENT
  // =========================================================
  const handleSaveAssessment = async () => {
    if (!user || !selectedStudent || !activeClass) return;
    if (isStageLocked) {
      showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning');
      return;
    }

    const hasLowManual = Object.values(manualScores).some(v => v <= 2);
    if (hasLowManual && (!comment || comment.trim().length < 5)) {
      showToast('Komentar pembinaan wajib diisi bila ada nilai ≤ 2!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { autoScores } = computeAutoScoresFor(selectedStudent, selectedStage);
      const totalScore = calculateTotalScore();

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
        details: `Nilai ${totalScore} untuk ${selectedStudent.displayName} (${selectedStage}) — ${category}`,
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
  // ✅ RESET SEMUA PENILAIAN PER TAHAP
  // =========================================================
  const handleResetStage = async () => {
    if (!canManageAll || !activeClass || !user) return;
    if (resetConfirmText.trim() !== activeClass.name) {
      showToast('Nama kelas tidak cocok. Coba lagi.', 'error');
      return;
    }

    setIsResetting(true);
    try {
      const q = query(
        collection(db, 'assessments'),
        where('classId', '==', activeClass.id),
        where('stage', '==', selectedStage)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast('Tidak ada penilaian di tahap ini.', 'info');
        setIsResetting(false);
        setResetConfirmOpen(false);
        setResetConfirmText('');
        return;
      }

      // Backup ke assessmentHistory dulu
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        const histRef = doc(collection(db, 'assessmentHistory'));
        batch.set(histRef, {
          ...d.data(),
          id: histRef.id,
          originalId: d.id,
          supersededAt: new Date().toISOString(),
          supersededBy: user.uid,
          reason: `RESET tahap ${selectedStage} oleh ${user.displayName}`,
        });
        batch.delete(d.ref);
      });
      await batch.commit();

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'AssessmentStageReset',
        targetId: activeClass.id,
        details: `RESET ${snap.size} penilaian tahap ${selectedStage} kelas ${activeClass.name}`,
      });

      showToast(`${snap.size} penilaian di tahap ${selectedStage} direset!`, 'success');
      setResetConfirmOpen(false);
      setResetConfirmText('');
    } catch (err: any) {
      showToast('Gagal reset: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // =========================================================
  // ✅ DELETE INDIVIDUAL ASSESSMENT
  // =========================================================
  const handleDeleteOneAssessment = async (rec: AssessmentRecord) => {
    if (!canManageAll || !user) return;
    if (!confirm(`Hapus penilaian ${rec.studentName} oleh ${rec.assessorName} (${rec.assessorCategory})?`)) return;

    try {
      // Backup ke history
      const histRef = doc(collection(db, 'assessmentHistory'));
      await writeBatch(db).set(histRef, {
        ...rec,
        id: histRef.id,
        originalId: rec.id,
        supersededAt: new Date().toISOString(),
        supersededBy: user.uid,
        reason: `Dihapus manual oleh ${user.displayName}`,
      }).commit();

      await deleteDoc(doc(db, 'assessments', rec.id));

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'Assessment',
        targetId: rec.id,
        details: `Hapus penilaian ${rec.studentName} (${rec.stage}) oleh ${rec.assessorName}`,
      });

      showToast(`Penilaian ${rec.studentName} dihapus.`, 'info');
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // =========================================================
  // AGGREGATED SCORE
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
    return { finalVal, guruScore, atasanScore, rekanScore, bawahanScore, count: records.length, records };
  };

  const filteredStudents = students.filter(s =>
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count assessments per stage (untuk info)
  const stageCount = (stageId: ProductionStage) =>
    assessments.filter(a => a.stage === stageId).length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
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
        </div>

        {/* Stage Selector dengan Gate */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Pilih Tahapan Penilaian:
            </span>
            {stageConfig?.currentStage && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                🎯 Tahap Aktif: {stageConfig.currentStage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {STAGES.map(s => {
              const enabled = isStageEnabled(s.id);
              const isActive = selectedStage === s.id;
              const count = stageCount(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStage(s.id)}
                  disabled={!enabled && !canManageAll}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                    isActive
                      ? enabled
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                        : 'bg-rose-500 text-white shadow-md'
                      : enabled
                      ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {!enabled && <Lock className="w-3 h-3" />}
                  {enabled && <Unlock className="w-3 h-3 opacity-70" />}
                  <span>{s.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info untuk stage yang dipilih */}
        {isStageLocked && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
              <p className="font-bold">🔒 Tahap {selectedStage} Belum Dibuka</p>
              <p className="mt-0.5">
                {canManageAll
                  ? 'Anda bisa lihat riwayat, tapi tidak bisa menilai/edit. Buka tahap ini di menu "Kelola Tahapan" dulu.'
                  : 'Tahap ini belum dibuka oleh Guru. Tunggu info dari pengajar.'}
              </p>
            </div>
          </div>
        )}

        {!isStageLocked && isSelectedNotCurrent && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              Anda melihat tahap <strong>{selectedStage}</strong>, tapi tahap aktif saat ini adalah <strong>{currentActiveStage}</strong>.
            </p>
          </div>
        )}

        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 dark:text-blue-200">
            <p><strong>Skor otomatis</strong>: Tanggung Jawab (25%), Kehadiran (20%), Kedisiplinan Pemeran (10%).</p>
            <p className="mt-1"><strong>Skor manual</strong>: Kerja Sama (25%), Kreativitas (15%), Teknis (15%) — atau untuk Pemeran: Hafalan, Penjiwaan, Suara, Blocking, Interaksi.</p>
            {canManageAll && (
              <p className="mt-1.5 pt-1.5 border-t border-blue-200 dark:border-blue-500/30">
                👑 <strong>Guru/Admin:</strong> bisa reset semua penilaian tahap ini atau hapus per penilaian (dengan konfirmasi).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AKSI GURU */}
      {canManageAll && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Aksi Khusus Guru/Admin
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setResetConfirmOpen(true)}
              disabled={isStageLocked}
              className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Nilai Tahap {selectedStage}
            </button>
          </div>
        </div>
      )}

      {/* SEARCH */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input type="text" placeholder="Cari siswa atau peran..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
      </div>

      {/* TABLE */}
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
                const canGrade = canAssessTarget(student) && !isStageLocked;

                return (
                  <tr key={student.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{student.displayName}</td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-600 dark:text-slate-400">{student.role}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.guruScore !== null && agg?.guruScore !== undefined ? agg.guruScore.toFixed(1) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.atasanScore !== null && agg?.atasanScore !== undefined ? agg.atasanScore.toFixed(1) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.rekanScore !== null && agg?.rekanScore !== undefined ? agg.rekanScore.toFixed(1) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {agg?.bawahanScore !== null && agg?.bawahanScore !== undefined ? agg.bawahanScore.toFixed(1) : '-'}
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
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {canGrade ? (
                          <button onClick={() => openGradingModal(student)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                            {agg ? 'Edit Nilai' : 'Nilai'}
                          </button>
                        ) : isStageLocked ? (
                          <span className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Terkunci
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Hanya Lihat</span>
                        )}

                        {canManageAll && agg && agg.count > 0 && (
                          <button
                            onClick={() => {
                              if (agg.records.length === 1) {
                                handleDeleteOneAssessment(agg.records[0]);
                              } else {
                                // Kalau lebih dari 1, tampilkan pilihan
                                const ids = agg.records.map((r: any) => `${r.assessorName} (${r.assessorCategory}): ${r.totalScore}`).join('\n');
                                const pick = prompt(`Ada ${agg.count} penilaian:\n\n${ids}\n\nKetik nama penilai yang mau dihapus (persis):`);
                                if (!pick) return;
                                const target = agg.records.find((r: any) => r.assessorName === pick);
                                if (target) handleDeleteOneAssessment(target);
                                else showToast('Nama penilai tidak cocok.', 'error');
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition"
                            title="Hapus penilaian"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL GRADING */}
      {isGradingOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
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

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-200 dark:border-blue-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                        <p className="text-[9px] text-blue-600 dark:text-blue-400">{taskResult.pctOnTime}% tepat waktu</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30">
                        <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Kehadiran</p>
                        <p className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">{autoScores.kehadiran}</p>
                        <p className="text-[9px] text-blue-600 dark:text-blue-400">{attendResult.pct}% hadir</p>
                      </div>
                      {selectedStudent.role === 'Pemeran' && (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30">
                          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">Kedisiplinan</p>
                          <p className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">{autoScores.kedisiplinan}</p>
                          <p className="text-[9px] text-blue-600 dark:text-blue-400">rata-rata TJ & Kehadiran</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

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

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Komentar & Catatan Pembinaan
                  {Object.values(manualScores).some(v => v <= 2) && (
                    <span className="text-rose-500 font-bold ml-1">(Wajib karena ada nilai ≤ 2)</span>
                  )}
                </label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Berikan catatan konstruktif. Jika skor ≤ 2, sebutkan tugas & kejadiannya..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>
            </div>

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

      {/* MODAL RESET KONFIRMASI */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-300 dark:border-rose-500/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <h3 className="text-base font-extrabold text-rose-900 dark:text-rose-200">
                Reset Semua Penilaian
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                ⚠️ Tindakan ini akan MENGHAPUS semua penilaian tahap <strong>{selectedStage}</strong> untuk kelas <strong>{activeClass?.name}</strong>.
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1.5 leading-relaxed">
                Data akan dibackup dulu ke <strong>assessmentHistory</strong>, jadi masih bisa dilihat kalau diperlukan.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ketik nama kelas "<strong>{activeClass?.name}</strong>" untuk konfirmasi:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder={activeClass?.name}
                autoFocus
                className={`w-full px-3.5 py-2.5 rounded-xl border-2 font-semibold text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 transition ${
                  resetConfirmText.trim() === activeClass?.name
                    ? 'border-emerald-500'
                    : 'border-rose-200 dark:border-rose-500/40'
                }`}
              />
              {resetConfirmText.length > 0 && resetConfirmText.trim() !== activeClass?.name && (
                <p className="text-[11px] text-rose-600 mt-1 font-bold">❌ Nama kelas tidak cocok.</p>
              )}
              {resetConfirmText.trim() === activeClass?.name && (
                <p className="text-[11px] text-emerald-600 mt-1 font-bold">✅ Cocok. Anda bisa reset.</p>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => { setResetConfirmOpen(false); setResetConfirmText(''); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button
                onClick={handleResetStage}
                disabled={isResetting || resetConfirmText.trim() !== activeClass?.name}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                {isResetting ? 'Mereset...' : `Reset ${selectedStage}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};