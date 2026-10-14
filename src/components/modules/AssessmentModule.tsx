// src/components/modules/AssessmentModule.tsx
import React, { useState, useEffect } from 'react';
import {
  Award, Lock, Unlock, Search, Edit3, RefreshCw, AlertCircle,
  Timer, ListChecks, Bot, Clock, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import {
  PEMERAN_CRITERIA, GENERAL_CRITERIA, SCORE_SCALE, STAGES,
  getAssessorWeights, getAssessmentMatrix,
} from '../../core/constants';
import { AssessmentRecord, ProductionStage, UserProfile } from '../../core/types';
import {
  fetchUsersByClass, fetchAllUsers, recordAuditLog, saveAssessment,
  subscribeAssessments,
} from '../../services/firestoreService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useToast } from '../common/Toast';

type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

function buildISO(dateStr: string, timeStr: string): string {
  if (!dateStr) return '';
  const t = timeStr || '00:00';
  try { return new Date(`${dateStr}T${t}:00`).toISOString(); }
  catch { return ''; }
}

function isAssessmentOpen(stageDeadlines: any, stageId: ProductionStage) {
  const cfg = stageDeadlines?.[stageId];
  if (!cfg) return { open: false, reason: 'no-config' as const };
  if (cfg.assessmentEnabled === false) return { open: false, reason: 'disabled' as const };
  let startMs: number | undefined;
  let endMs: number | undefined;
  if (cfg.assessmentStartDate) {
    const iso = buildISO(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00');
    if (iso) startMs = new Date(iso).getTime();
  }
  if (cfg.assessmentEndDate) {
    const iso = buildISO(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59');
    if (iso) endMs = new Date(iso).getTime();
  }
  const now = Date.now();
  if (startMs && !isNaN(startMs) && now < startMs) return { open: false, reason: 'not-started' as const, startMs, endMs };
  if (endMs && !isNaN(endMs) && now > endMs) return { open: false, reason: 'ended' as const, startMs, endMs };
  return { open: true, reason: 'open' as const, startMs, endMs };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 detik';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}h ${h}j`;
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(ms / 1000)}s`;
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

export const AssessmentModule: React.FC = () => {
  const { user, activeClass, isAdminRole, isGuruPengampu, canAssessTarget } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stageConfig, setStageConfig] = useState<any>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const canManageAll = isGuruPengampu || isAdminRole;

  const canGradeStudent = (student: UserProfile) => {
    if (canManageAll) return true;
    return canAssessTarget(student);
  };

  useEffect(() => {
    if (!activeClass) { setStudents([]); setStudentsLoading(false); return; }
    setStudentsLoading(true);
    (async () => {
      try {
        let list: UserProfile[] = [];
        try { list = await fetchUsersByClass(activeClass.id); } catch { /* ignore */ }
        if (!list || list.length === 0) {
          try {
            const all = await fetchAllUsers();
            const cName = (activeClass.name || '').toLowerCase().trim();
            list = all.filter(u =>
              (u.classId === activeClass.id) ||
              ((u.className || '').toLowerCase().trim() === cName)
            );
          } catch { /* ignore */ }
        }
        const filtered = list.filter(s =>
          s.role !== 'Guru Pengampu' &&
          s.role !== 'Guru Pembina' &&
          s.role !== 'Admin' &&
          s.role !== 'Super Admin'
        );
        setStudents(filtered);
      } catch {
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    })();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeAssessments(activeClass.id, setAssessments);
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data();
        setStageConfig(data);
        if (data.currentStage) setSelectedStage(data.currentStage);
      }
    });
    return () => unsub();
  }, [activeClass]);

  const isStageEnabled = (stageId: ProductionStage): boolean => {
    if (!stageConfig?.stageDeadlines) return true;
    const cfg = stageConfig.stageDeadlines[stageId];
    if (!cfg) return true;
    return cfg.enabled !== false;
  };

  const isStageLocked = !isStageEnabled(selectedStage);
  const assessmentStatus = isAssessmentOpen(stageConfig?.stageDeadlines, selectedStage);
  const isAssessmentLocked = !assessmentStatus.open;

  const criteriaList = selectedStudent?.role === 'Pemeran' ? PEMERAN_CRITERIA : GENERAL_CRITERIA;
  const manualCriteria = criteriaList.filter(c => c.source === 'MANUAL');

  const calculateTotalScore = (): number => {
    if (!selectedStudent) return 0;
    let weightedSum = 0, totalWeight = 0;
    criteriaList.forEach(c => {
      let score = 3;
      if (c.source === 'MANUAL') score = manualScores[c.key] || 3;
      const converted = SCORE_SCALE[score]?.score100 || 80;
      weightedSum += converted * c.weight;
      totalWeight += c.weight;
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 80;
  };

  const getPeerStatus = (student: UserProfile) => {
    const matrix = getAssessmentMatrix(student.role);
    const targetRoles = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(cat => {
      const rel = matrix.find(r => r.category === cat);
      if (rel) rel.roles.forEach(r => targetRoles.add(r));
    });
    const targets = students.filter(s => s.uid !== student.uid && targetRoles.has(s.role));
    const filled = targets.filter(t =>
      assessments.some(a =>
        a.assessorId === student.uid &&
        a.studentId === t.uid &&
        a.stage === selectedStage
      )
    ).length;
    return {
      total: targets.length,
      filled,
      pending: targets.length - filled,
      pct: targets.length > 0 ? Math.round((filled / targets.length) * 100) : 100,
      isComplete: filled >= targets.length,
    };
  };

  const openGradingModal = (student: UserProfile) => {
    if (isStageLocked) {
      showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning');
      return;
    }
    if (isAssessmentLocked) {
      const r = assessmentStatus.reason;
      if (r === 'not-started' && assessmentStatus.startMs) {
        showToast(`Penilaian dibuka dalam ${formatDuration(assessmentStatus.startMs - Date.now())}.`, 'warning');
      } else if (r === 'ended') {
        showToast(`Penilaian tahap ${selectedStage} sudah ditutup.`, 'warning');
      } else if (r === 'disabled') {
        showToast('Penilaian tahap ini dinonaktifkan.', 'warning');
      } else {
        showToast('Penilaian belum dibuka.', 'warning');
      }
      return;
    }
    if (!canGradeStudent(student)) {
      showToast('Tidak berwenang menilai siswa ini.', 'warning');
      return;
    }
    setSelectedStudent(student);
    const existing = assessments.find(a =>
      a.assessorId === user?.uid &&
      a.studentId === student.uid &&
      a.stage === selectedStage
    );
    const initial: Record<string, number> = {};
    manualCriteria.forEach(c => {
      initial[c.key] = (existing?.scores && existing.scores[c.key]) || 3;
    });
    setManualScores(initial);
    setComment(existing?.comment || '');
    setIsGradingOpen(true);
  };

  const handleSaveAssessment = async () => {
    if (!user || !selectedStudent || !activeClass) return;
    if (isStageLocked) {
      showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning');
      return;
    }
    if (isAssessmentLocked) {
      showToast('Penilaian sedang terkunci.', 'warning');
      return;
    }
    const hasLowManual = Object.values(manualScores).some(v => v <= 2);
    if (hasLowManual && (!comment || comment.trim().length < 5)) {
      showToast('Komentar pembinaan wajib bila ada nilai <= 2!', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const totalScore = calculateTotalScore();
      const matrix = getAssessmentMatrix(selectedStudent.role);
      let category: AssessorCategory = 'REKAN';
      for (const rel of matrix) {
        if (rel.roles.includes(user.role)) { category = rel.category; break; }
      }
      if (canManageAll) category = 'GURU';

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
        autoScores: {},
        totalScore,
        comment: comment.trim(),
        isFinal: true,
      } as any);

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'ASSESS',
        targetType: 'Assessment',
        targetId: selectedStudent.uid,
        details: `Nilai ${totalScore} untuk ${selectedStudent.displayName} (${selectedStage})`,
      });
      showToast(`Penilaian ${selectedStudent.displayName} disimpan!`, 'success');
      setIsGradingOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAggregatedScore = (studentId: string, studentRole: string) => {
    const records = assessments.filter(a =>
      a.studentId === studentId && a.stage === selectedStage
    );
    if (records.length === 0) return null;
    const byCat: Record<string, number[]> = { GURU: [], ATASAN: [], REKAN: [], BAWAHAN: [] };
    records.forEach(r => {
      const cat = (r as any).assessorCategory || 'REKAN';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(r.totalScore);
    });
    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
    const guruScore = avg(byCat.GURU);
    const atasanScore = avg(byCat.ATASAN);
    const rekanScore = avg(byCat.REKAN);
    const bawahanScore = avg(byCat.BAWAHAN);
    const weights = getAssessorWeights(studentRole);
    let weightedSum = 0, weightTotal = 0;
    if (guruScore !== null && weights.GURU > 0) { weightedSum += guruScore * weights.GURU; weightTotal += weights.GURU; }
    if (atasanScore !== null && weights.ATASAN > 0) { weightedSum += atasanScore * weights.ATASAN; weightTotal += weights.ATASAN; }
    if (rekanScore !== null && weights.REKAN > 0) { weightedSum += rekanScore * weights.REKAN; weightTotal += weights.REKAN; }
    if (bawahanScore !== null && weights.BAWAHAN > 0) { weightedSum += bawahanScore * weights.BAWAHAN; weightTotal += weights.BAWAHAN; }
    const finalVal = weightTotal > 0
      ? Math.round((weightedSum / weightTotal) * 10) / 10
      : 0;
    return { finalVal, guruScore, atasanScore, rekanScore, bawahanScore, count: records.length, records };
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.displayName || '').toLowerCase().includes(q)
        || (s.role || '').toLowerCase().includes(q)
        || (s.divisionName || '').toLowerCase().includes(q);
  });

  const stageCount = (stageId: ProductionStage) =>
    assessments.filter(a => a.stage === stageId).length;

  if (!activeClass) {
    return (
      <div className="p-8 rounded-3xl bg-amber-50 border-2 border-amber-300 text-center max-w-2xl mx-auto my-8">
        <AlertCircle className="w-16 h-16 mx-auto text-amber-600 mb-4" />
        <h3 className="text-base font-extrabold text-amber-900">Anda Belum Masuk ke Kelas</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-900">Penilaian 360</h2>
              <p className="text-xs text-slate-500">Manual 360 + auto dari Tugas & Presensi</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => window.location.reload()}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700">Tahapan:</span>
            {stageConfig?.currentStage && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                Aktif: {stageConfig.currentStage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {STAGES.map(s => {
              const enabled = isStageEnabled(s.id);
              const isActive = selectedStage === s.id;
              const count = stageCount(s.id);
              const sStatus = isAssessmentOpen(stageConfig?.stageDeadlines, s.id);
              return (
                <button key={s.id} onClick={() => setSelectedStage(s.id)}
                  disabled={!enabled && !canManageAll}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                    isActive
                      ? enabled
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                        : 'bg-rose-500 text-white shadow-md'
                      : enabled
                        ? 'bg-white text-slate-600 border border-slate-200'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed'
                  }`}>
                  {!enabled && <Lock className="w-3 h-3" />}
                  {enabled && !sStatus.open && <Award className="w-3 h-3 opacity-70" />}
                  {enabled && sStatus.open && <Unlock className="w-3 h-3 opacity-70" />}
                  <span>{s.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!isAssessmentLocked && assessmentStatus.endMs && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex items-start gap-2">
            <Timer className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900">
              <p className="font-bold">
                Penilaian TERBUKA — sisa {formatDuration(assessmentStatus.endMs - Date.now())}
              </p>
              <p className="mt-0.5">
                Ditutup: {formatDateTime(new Date(assessmentStatus.endMs).toISOString())}
              </p>
            </div>
          </div>
        )}
        {isAssessmentLocked && assessmentStatus.reason === 'not-started' && assessmentStatus.startMs && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 border-2 border-blue-300 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900">
              <p className="font-bold">Penilaian BELUM DIBUKA</p>
              <p className="mt-0.5">
                Dibuka dalam <strong>{formatDuration(assessmentStatus.startMs - Date.now())}</strong>
              </p>
              <p className="mt-0.5">
                Tepat pada: {formatDateTime(new Date(assessmentStatus.startMs).toISOString())}
              </p>
            </div>
          </div>
        )}
        {isAssessmentLocked && assessmentStatus.reason === 'ended' && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-300 flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900">
              <p className="font-bold">Penilaian SUDAH DITUTUP</p>
            </div>
          </div>
        )}
        {isAssessmentLocked && assessmentStatus.reason === 'disabled' && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 border-2 border-slate-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-800">
              <p className="font-bold">Penilaian tahap ini dinonaktifkan oleh Guru.</p>
            </div>
          </div>
        )}
        {isAssessmentLocked && assessmentStatus.reason === 'no-config' && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900">
              <p className="font-bold">Jadwal penilaian belum diatur</p>
              <p className="mt-0.5">
                Buka menu Kelola Tahapan untuk atur tanggal & jam penilaian.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
          <ListChecks className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 leading-relaxed">
            <p className="font-bold">Guru bisa edit nilai siapa saja.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari siswa atau peran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-3.5 px-4">Nama</th>
                <th className="py-3.5 px-4">Peran</th>
                <th className="py-3.5 px-4 text-center">Peer</th>
                <th className="py-3.5 px-4 text-center">Guru</th>
                <th className="py-3.5 px-4 text-center">Atasan</th>
                <th className="py-3.5 px-4 text-center">Rekan</th>
                <th className="py-3.5 px-4 text-center">Bawahan</th>
                <th className="py-3.5 px-4 text-center">Nilai</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" /> Memuat...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                    <p className="text-xs font-bold text-slate-700">
                      {students.length === 0 ? 'Data siswa tidak ter-load.' : 'Tidak ada yang cocok.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const agg = getAggregatedScore(student.uid, student.role);
                  const canGrade = canGradeStudent(student) && !isStageLocked && !isAssessmentLocked;
                  const peerStatus = getPeerStatus(student);
                  return (
                    <tr key={student.uid} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{student.displayName}</p>
                        {student.phone && (
                          <p className="text-[9px] text-slate-400 font-mono">{student.phone}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600">{student.role}</td>
                      <td className="py-3.5 px-4 text-center">
                        {peerStatus.total === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">—</span>
                        ) : peerStatus.isComplete ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-300">
                            {peerStatus.filled}/{peerStatus.total}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-300">
                            {peerStatus.filled}/{peerStatus.total}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {agg?.guruScore != null ? agg.guruScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {agg?.atasanScore != null ? agg.atasanScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {agg?.rekanScore != null ? agg.rekanScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {agg?.bawahanScore != null ? agg.bawahanScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {agg ? (
                          <span className="text-sm font-black text-slate-900 font-mono">{agg.finalVal}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {canGrade ? (
                            <button onClick={() => openGradingModal(student)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1">
                              <Edit3 className="w-3 h-3" /> {agg ? 'Edit' : 'Nilai'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {isStageLocked ? 'Tahap tutup' : isAssessmentLocked ? 'Terkunci' : 'Hanya lihat'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isGradingOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-6 bg-slate-900 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase">
                    Penilaian 360 • {selectedStage}
                  </span>
                  <h3 className="text-lg font-black mt-0.5">{selectedStudent.displayName}</h3>
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
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-black text-blue-900">PENILAIAN MANUAL</h4>
                </div>
                <div className="space-y-3">
                  {manualCriteria.map(crit => {
                    const currentVal = manualScores[crit.key] || 3;
                    const scaleInfo = SCORE_SCALE[currentVal];
                    return (
                      <div key={crit.key} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900">{crit.label}</span>
                            <span className="text-[10px] text-slate-400 ml-2">Bobot: {crit.weight}%</span>
                            <p className="text-[11px] text-slate-500 mt-0.5">{crit.desc}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${scaleInfo.badgeColor}`}>
                            {currentVal} • {scaleInfo.label}
                          </span>
                        </div>
                        <input type="range" min="1" max="4" step="1" value={currentVal}
                          onChange={(e) => setManualScores(prev => ({
                            ...prev,
                            [crit.key]: parseInt(e.target.value),
                          }))}
                          className="w-full accent-amber-500 cursor-pointer" />
                        <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                          <span>1 Kurang</span>
                          <span>2 Cukup</span>
                          <span>3 Baik</span>
                          <span>4 Sangat Baik</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Komentar
                  {Object.values(manualScores).some(v => v <= 2) && (
                    <span className="text-rose-500 font-bold ml-1">
                      (Wajib karena ada nilai &lt;= 2)
                    </span>
                  )}
                </label>
                <textarea rows={3} value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Catatan konstruktif..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium" />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-between shrink-0">
              <button onClick={() => setIsGradingOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600">
                Batal
              </button>
              <button onClick={handleSaveAssessment} disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};