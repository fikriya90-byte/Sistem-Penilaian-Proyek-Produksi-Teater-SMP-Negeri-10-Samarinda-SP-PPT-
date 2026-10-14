import React, { useState, useEffect } from 'react';
import {
  Award, Lock, Unlock, Search, CheckCircle, MessageCircle, Send,
  TrendingUp, Info, AlertTriangle, Sparkles, Bot, Download,
  Trash2, RotateCcw, X, Edit3, ShieldAlert, Clock,
  RefreshCw, AlertCircle, Timer, Users, ListChecks,
  ExternalLink, CheckSquare, Square, Shield, Eye,
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
  fetchUsersByClass, fetchAllUsers, recordAuditLog, saveAssessment,
  subscribeAssessments, subscribeAttendanceSessions,
  subscribeAllAttendanceRecords,
} from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch, updateDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useToast } from '../common/Toast';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

const CATEGORY_LABEL: Record<AssessorCategory, string> = {
  GURU: 'Guru Pengampu',
  ATASAN: 'Koordinator',
  REKAN: 'Rekan Kerja',
  BAWAHAN: 'Anggota Tim',
};

// =========================================================
// TEMPLATE WA
// =========================================================
function templateFollowupPeerAssessment(
  studentName: string,
  teacherName: string,
  classKerabat: string,
  className: string
) {
  return `Halo ${studentName},\n\n` +
    `Saya ${teacherName}, guru pengampu ${classKerabat} kelas ${className}.\n\n` +
    `Kami ingatkan bahwa Anda belum mengisi *penilaian rekan kerja (peer assessment)*.\n\n` +
    `Mohon segera isi melalui web SP-PPT → menu *Penilaian*.\n\n` +
    `Terima kasih 🙏`;
}

function templateAskAboutScore(
  studentName: string,
  teacherName: string,
  classKerabat: string,
  className: string,
  stage: string
) {
  return `Halo ${studentName},\n\n` +
    `Saya ${teacherName}, guru pengampu ${classKerabat} kelas ${className}.\n\n` +
    `Kami ingin *membahas nilai Anda* di tahap ${stage}.\n\n` +
    `Jika ada pertanyaan atau keberatan terkait nilai, silakan hubungi saya untuk klarifikasi.\n\n` +
    `Terima kasih 🙏`;
}

function templateAskClarification(
  assessorName: string,
  targetStudentName: string,
  teacherName: string,
  classKerabat: string,
  className: string,
  stage: string,
  reason: string
) {
  return `Halo ${assessorName},\n\n` +
    `Saya ${teacherName}, guru pengampu ${classKerabat} kelas ${className}.\n\n` +
    `Saya melihat Anda memberi penilaian kepada *${targetStudentName}* di tahap *${stage}*.\n\n` +
    `Catatan: ${reason}\n\n` +
    `Boleh dijelaskan dasar penilaian Anda? Kami ingin memastikan penilaian ini objektif dan adil.\n\n` +
    `Mohon balas pesan ini untuk klarifikasi. Terima kasih 🙏`;
}

// =========================================================
// TASK HELPERS — pakai `deadlines` & field `stage`
// =========================================================
interface TaskWithStatus {
  task: any;
  submission: any | undefined;
  status: 'AWAL' | 'TEPAT' | 'TELAT_RINGAN' | 'TELAT_BERAT' | 'BELUM' | 'PROSES';
  daysLate: number;
  label: string;
  color: string;
}

function getStudentTasks(
  student: UserProfile,
  deadlines: any[],
  submissions: any[],
  stage: ProductionStage
): TaskWithStatus[] {
  const myTasks = deadlines.filter(t => {
    if (t.stage && t.stage !== stage) return false;
    if (t.status === 'CANCELLED') return false;
    const scope = t.targetScope as string;
    const targetUserIds: string[] = t.targetUserIds || [];
    const targetRoles: string[] = t.targetRoles || [];
    const targetDivisions: string[] = t.targetDivisions || [];
    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return t.targetRole === student.role;
    if (scope === 'DIVISI') return t.targetDivision === student.divisionName;
    if (scope === 'CUSTOM') {
      if (targetRoles.length > 0 && targetRoles.includes(student.role)) return true;
      if (targetDivisions.length > 0 && student.divisionName && targetDivisions.includes(student.divisionName)) return true;
      if (targetUserIds.length === 0) return true;
      return targetUserIds.includes(student.uid);
    }
    return false;
  });

  return myTasks.map(t => {
    const sub = submissions.find(s => s.deadlineId === t.id && s.studentId === student.uid);
    let status: TaskWithStatus['status'] = 'BELUM';
    let daysLate = 0;
    let label = 'Belum dikerjakan';
    let color = 'bg-slate-100 text-slate-700 border-slate-300';

    if (sub) {
      if (sub.status === 'SELESAI' && sub.submittedAt) {
        const dueMs = new Date(t.dueDate).getTime();
        const subMs = new Date(sub.submittedAt).getTime();
        daysLate = Math.floor((subMs - dueMs) / 86400000);
        if (daysLate <= -1) { status = 'AWAL'; label = `Awal ${Math.abs(daysLate)} hari`; color = 'bg-emerald-100 text-emerald-800 border-emerald-300'; }
        else if (daysLate === 0) { status = 'TEPAT'; label = 'Tepat waktu'; color = 'bg-emerald-100 text-emerald-800 border-emerald-300'; }
        else if (daysLate <= 2) { status = 'TELAT_RINGAN'; label = `Telat ${daysLate} hari`; color = 'bg-amber-100 text-amber-800 border-amber-300'; }
        else { status = 'TELAT_BERAT'; label = `Telat ${daysLate} hari`; color = 'bg-rose-100 text-rose-800 border-rose-300'; }
      } else if (sub.status === 'TERLAMBAT') {
        status = 'TELAT_BERAT'; daysLate = 999; label = 'Telat berat'; color = 'bg-rose-100 text-rose-800 border-rose-300';
      } else if (sub.status === 'PROSES') {
        status = 'PROSES'; label = 'Sedang proses'; color = 'bg-blue-100 text-blue-800 border-blue-300';
      }
    } else {
      const dueMs = new Date(t.dueDate).getTime();
      if (dueMs < Date.now()) { label = 'Belum & lewat deadline'; color = 'bg-rose-100 text-rose-800 border-rose-300'; }
    }
    return { task: t, submission: sub, status, daysLate, label, color };
  }).sort((a, b) => {
    const order: Record<string, number> = { BELUM: 0, TELAT_BERAT: 1, TELAT_RINGAN: 2, PROSES: 3, TEPAT: 4, AWAL: 5 };
    return (order[a.status] ?? 99) - (order[b.status] ?? 99);
  });
}

// =========================================================
// AUTO SCORE
// =========================================================
function computeTaskResponsibility(student: UserProfile, deadlines: any[], submissions: any[], stage: ProductionStage) {
  const myTasks = deadlines.filter(t => {
    if (t.stage && t.stage !== stage) return false;
    if (t.status === 'CANCELLED') return false;
    const scope = t.targetScope as string;
    const targetUserIds: string[] = t.targetUserIds || [];
    const targetRoles: string[] = t.targetRoles || [];
    const targetDivisions: string[] = t.targetDivisions || [];
    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return t.targetRole === student.role;
    if (scope === 'DIVISI') return t.targetDivision === student.divisionName;
    if (scope === 'CUSTOM') {
      if (targetRoles.length > 0 && targetRoles.includes(student.role)) return true;
      if (targetDivisions.length > 0 && student.divisionName && targetDivisions.includes(student.divisionName)) return true;
      if (targetUserIds.length === 0) return true;
      return targetUserIds.includes(student.uid);
    }
    return false;
  });

  let awal = 0, tepat = 0, telatRingan = 0, telatBerat = 0, belum = 0;
  let criticalLate = 0, criticalMissed = 0;

  myTasks.forEach(task => {
    const sub = submissions.find(s => s.deadlineId === task.id && s.studentId === student.uid);
    const isCritical = !!task.isCritical;
    if (!sub || sub.status === 'BELUM') {
      belum += 1; if (isCritical) criticalMissed += 1; return;
    }
    if (sub.status === 'SELESAI' && sub.submittedAt) {
      const dueMs = new Date(task.dueDate).getTime();
      const subMs = new Date(sub.submittedAt).getTime();
      const diffDays = Math.floor((subMs - dueMs) / 86400000);
      if (diffDays <= -1) awal += 1;
      else if (diffDays === 0) tepat += 1;
      else if (diffDays <= 2) { telatRingan += 1; if (isCritical && diffDays > 1) criticalLate += 1; }
      else { telatBerat += 1; if (isCritical) criticalLate += 1; }
    } else if (sub.status === 'TERLAMBAT') {
      telatBerat += 1; if (isCritical) criticalLate += 1;
    }
  });

  const totalTasks = myTasks.length;
  if (totalTasks === 0) return { score: 4, totalTasks: 0, pctOnTime: 100, criticalLate: 0, criticalMissed: 0, awal, tepat, telatRingan, telatBerat, belum };
  const onTime = awal + tepat;
  const pctOnTime = Math.round((onTime / totalTasks) * 100);
  let score: 1 | 2 | 3 | 4;
  if (pctOnTime >= 90 && criticalLate === 0 && criticalMissed === 0) score = 4;
  else if (pctOnTime >= 75 && criticalLate <= 0) score = 3;
  else if (pctOnTime >= 50 && criticalMissed === 0) score = 2;
  else score = 1;
  if (criticalMissed > 0) score = 1;
  return { score, totalTasks, pctOnTime, criticalLate, criticalMissed, awal, tepat, telatRingan, telatBerat, belum };
}

function computeAttendanceScore(student: UserProfile, sessions: any[], records: any[], stage: ProductionStage) {
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
      if (session && (session.activityType === 'Gladi' || session.activityType === 'Pementasan')) hasFatalAlpa = true;
    }
  });
  const totalSessions = myRecords.length;
  if (totalSessions === 0) return { score: 4, totalSessions: 0, pct: 100, hasFatalAlpa: false };
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
  return Math.floor((taskScore + attendScore) / 2) as 1 | 2 | 3 | 4;
}

// =========================================================
// JADWAL PENILAIAN
// =========================================================
function isAssessmentOpen(stageDeadlines: any, stageId: ProductionStage) {
  const cfg = stageDeadlines?.[stageId];
  if (!cfg) return { open: false, reason: 'no-config' as const };
  if (cfg.assessmentEnabled === false) return { open: false, reason: 'disabled' as const };
  const startMs = cfg.assessmentStart ? new Date(cfg.assessmentStart).getTime() : undefined;
  const endMs = cfg.assessmentEnd ? new Date(cfg.assessmentEnd).getTime() : undefined;
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
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WITA';
  } catch { return '-'; }
}

function buildWhatsAppUrl(phone: string, text: string): string {
  let clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  return clean ? `https://wa.me/${clean}?text=${encodeURIComponent(text)}` : '#';
}

// =========================================================
// DETEKSI ANOMALI
// =========================================================
interface Anomaly {
  record: AssessmentRecord;
  assessorUser?: UserProfile;
  targetUser?: UserProfile;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
}

function detectAnomalies(
  assessments: AssessmentRecord[],
  students: UserProfile[],
  stage: ProductionStage
): Anomaly[] {
  const result: Anomaly[] = [];
  const stageAssessments = assessments.filter(a => a.stage === stage);

  // Kelompokkan per student untuk cek outlier
  const byStudent: Record<string, AssessmentRecord[]> = {};
  stageAssessments.forEach(a => {
    if (!byStudent[a.studentId]) byStudent[a.studentId] = [];
    byStudent[a.studentId].push(a);
  });

  stageAssessments.forEach(rec => {
    // Skip guru penilaian guru lain
    const scores = Object.values(rec.scores || {}).filter(v => typeof v === 'number');
    if (scores.length === 0) return;

    const assessorUser = students.find(s => s.uid === rec.assessorId);
    const targetUser = students.find(s => s.uid === rec.studentId);

    // 1. Semua nilai 1 (rendah ekstrem)
    const allOne = scores.every(v => v === 1);
    if (allOne) {
      result.push({
        record: rec,
        assessorUser,
        targetUser,
        reason: `Semua ${scores.length} kriteria diberi nilai 1 (Kurang) — kemungkinan perlu klarifikasi`,
        severity: 'high',
        type: 'Nilai Sangat Rendah',
      });
      return;
    }

    // 2. Semua nilai 4 (tinggi ekstrem)
    const allFour = scores.every(v => v === 4);
    if (allFour) {
      result.push({
        record: rec,
        assessorUser,
        targetUser,
        reason: `Semua ${scores.length} kriteria diberi nilai 4 (Sangat Baik) — cek apakah objektif`,
        severity: 'medium',
        type: 'Nilai Sangat Tinggi',
      });
      return;
    }

    // 3. Semua nilai sama (tapi bukan 1 atau 4)
    const allSame = scores.every(v => v === scores[0]);
    if (allSame && scores[0] !== 1 && scores[0] !== 4) {
      result.push({
        record: rec,
        assessorUser,
        targetUser,
        reason: `Semua kriteria diberi nilai ${scores[0]} — penilaian bisa jadi asal-asalan`,
        severity: 'low',
        type: 'Nilai Seragam',
      });
      return;
    }

    // 4. Outlier — nilai sangat berbeda dengan rata-rata assessor lain untuk siswa yang sama
    const sameTargetRecords = (byStudent[rec.studentId] || []).filter(r => r.id !== rec.id);
    if (sameTargetRecords.length >= 2) {
      const othersAvg = sameTargetRecords.reduce((s, r) => s + r.totalScore, 0) / sameTargetRecords.length;
      const diff = Math.abs(rec.totalScore - othersAvg);
      if (diff >= 25) {
        result.push({
          record: rec,
          assessorUser,
          targetUser,
          reason: `Nilai (${rec.totalScore}) berbeda jauh dari rata-rata penilai lain (${othersAvg.toFixed(1)}) — selisih ${diff.toFixed(1)} poin`,
          severity: diff >= 35 ? 'high' : 'medium',
          type: 'Outlier vs Penilai Lain',
        });
      }
    }
  });

  // Sort: high dulu
  return result.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// =========================================================
// MAIN
// =========================================================
export const AssessmentModule: React.FC = () => {
  const { user, activeClass, isAdminRole, isGuruPengampu, canAssessTarget } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsDebug, setStudentsDebug] = useState<{ totalUsers: number; matched: number; source: string; error?: string }>({ totalUsers: 0, matched: 0, source: 'idle' });
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
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
  const [onlyWithTasks, setOnlyWithTasks] = useState(true);
  const [stageConfig, setStageConfig] = useState<any>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [, setTick] = useState(0);

  // Anomaly section
  const [showAnomalies, setShowAnomalies] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const canManageAll = isGuruPengampu || isAdminRole;

  // ✅ Guru/Admin bisa nilai & edit SIAPA SAJA (override matrix)
  const canGradeStudent = (student: UserProfile) => {
    if (canManageAll) return true;
    return canAssessTarget(student);
  };

  const loadStudents = async () => {
    if (!activeClass) {
      setStudentsLoading(false); setStudents([]);
      setStudentsDebug({ totalUsers: 0, matched: 0, source: 'no-active-class' });
      return;
    }
    setStudentsLoading(true);
    setStudentsDebug({ totalUsers: 0, matched: 0, source: 'loading...' });
    try {
      let list: UserProfile[] = [];
      let source = 'fetchUsersByClass';
      try { list = await fetchUsersByClass(activeClass.id); } catch (err: any) { console.warn('fetch gagal:', err); }
      if (!list || list.length === 0) {
        try {
          const all = await fetchAllUsers();
          const classNameLower = (activeClass.name || '').toLowerCase().trim();
          list = all.filter(u => (u.classId === activeClass.id) || ((u.className || '').toLowerCase().trim() === classNameLower));
          source = 'fetchAllUsers (fallback)';
          setStudentsDebug({ totalUsers: all.length, matched: list.length, source });
        } catch (err: any) {
          setStudentsDebug({ totalUsers: 0, matched: 0, source: 'error', error: err?.message || 'Unknown' });
        }
      } else {
        setStudentsDebug(prev => ({ ...prev, source }));
      }
      const filtered = list.filter(s => s.role !== 'Guru Pengampu' && s.role !== 'Guru Pembina' && s.role !== 'Admin' && s.role !== 'Super Admin');
      setStudents(filtered);
      setStudentsDebug(prev => ({ ...prev, totalUsers: prev.totalUsers || list.length, matched: filtered.length }));
    } catch (err: any) {
      setStudents([]);
      setStudentsDebug({ totalUsers: 0, matched: 0, source: 'error', error: err?.message || 'Unknown' });
    } finally { setStudentsLoading(false); }
  };

  useEffect(() => { loadStudents(); /* eslint-disable-next-line */ }, [activeClass?.id]);

  useEffect(() => {
    if (!activeClass) return;
    const unsub1 = subscribeAssessments(activeClass.id, setAssessments);
    const qT = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
    const unsub2 = onSnapshot(qT, snap => {
      setDeadlines(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    const unsub3 = subscribeAttendanceSessions(activeClass.id, setSessions);
    const unsub4 = subscribeAllAttendanceRecords(activeClass.id, setAttendanceRecords);
    let unsub5 = () => {};
    (async () => {
      const q = query(collection(db, 'deadlineSubmissions'), where('classId', '==', activeClass.id));
      unsub5 = onSnapshot(q, snap => { setSubmissions(snap.docs.map(d => ({ ...d.data(), id: d.id }))); });
    })();
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
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

  const isPemeran = selectedStudent?.role === 'Pemeran';
  const criteriaList = isPemeran ? PEMERAN_CRITERIA : GENERAL_CRITERIA;
  const manualCriteria = criteriaList.filter(c => c.source === 'MANUAL');

  const computeAutoScoresFor = (student: UserProfile, stage: ProductionStage) => {
    const taskResult = computeTaskResponsibility(student, deadlines, submissions, stage);
    const attendResult = computeAttendanceScore(student, sessions, attendanceRecords, stage);
    const autoScores: any = { tanggung_jawab: taskResult.score, kehadiran: attendResult.score };
    if (student.role === 'Pemeran') autoScores.kedisiplinan = computePemeranDiscipline(taskResult.score, attendResult.score);
    return { autoScores, taskResult, attendResult };
  };

  const calculateTotalScore = () => {
    if (!selectedStudent) return 0;
    const { autoScores } = computeAutoScoresFor(selectedStudent, selectedStage);
    let weightedSum = 0, totalWeight = 0;
    criteriaList.forEach(c => {
      let score = 3;
      if (c.source === 'MANUAL') score = manualScores[c.key] || 3;
      else {
        const key = c.source === 'AUTO_TASK' ? 'tanggung_jawab' : c.source === 'AUTO_ATTENDANCE' ? 'kehadiran' : c.source === 'AUTO_DISCIPLINE' ? 'kedisiplinan' : null;
        if (key) score = autoScores[key] || 3;
      }
      const converted = SCORE_SCALE[score]?.score100 || 80;
      weightedSum += converted * c.weight;
      totalWeight += c.weight;
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 80;
  };

  const studentHasTasksInStage = (student: UserProfile): boolean => {
    return getStudentTasks(student, deadlines, submissions, selectedStage).length > 0;
  };

  const getPeerStatus = (student: UserProfile) => {
    const matrix = getAssessmentMatrix(student.role);
    const targetRoles = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(cat => {
      const rel = matrix.find(r => r.category === cat);
      if (rel) rel.roles.forEach(r => targetRoles.add(r));
    });
    const targets = students.filter(s => s.uid !== student.uid && targetRoles.has(s.role));
    const filled = targets.filter(t => assessments.some(a => a.assessorId === student.uid && a.studentId === t.uid && a.stage === selectedStage)).length;
    return { total: targets.length, filled, pending: targets.length - filled, pct: targets.length > 0 ? Math.round((filled / targets.length) * 100) : 100, isComplete: filled >= targets.length };
  };

  const getStudentTaskList = (student: UserProfile): TaskWithStatus[] => {
    return getStudentTasks(student, deadlines, submissions, selectedStage);
  };

  // Helper data guru
  const teacherName = user?.displayName || 'Guru Pengampu';
  const classKerabat = activeClass?.kerabatKerja || activeClass?.name || 'Teater';
  const className = activeClass?.name || 'IX';

  const openGradingModal = (student: UserProfile) => {
    if (isStageLocked) { showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning'); return; }
    if (isAssessmentLocked) {
      const r = assessmentStatus.reason;
      if (r === 'not-started' && assessmentStatus.startMs) showToast(`Penilaian dibuka dalam ${formatDuration(assessmentStatus.startMs - Date.now())}.`, 'warning');
      else if (r === 'ended') showToast(`Penilaian tahap ${selectedStage} sudah ditutup.`, 'warning');
      else if (r === 'disabled') showToast('Penilaian tahap ini dinonaktifkan.', 'warning');
      else showToast('Penilaian belum dibuka.', 'warning');
      return;
    }
    if (!canGradeStudent(student)) { showToast('Tidak berwenang menilai siswa ini.', 'warning'); return; }
    setSelectedStudent(student);
    const existing = assessments.find(a => a.assessorId === user?.uid && a.studentId === student.uid && a.stage === selectedStage);
    const initial: Record<string, number> = {};
    manualCriteria.forEach(c => { initial[c.key] = (existing?.scores && existing.scores[c.key]) || 3; });
    setManualScores(initial);
    setComment(existing?.comment || '');
    setIsGradingOpen(true);
  };

  const handleSaveAssessment = async () => {
    if (!user || !selectedStudent || !activeClass) return;
    if (isStageLocked) { showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning'); return; }
    if (isAssessmentLocked) { showToast('Penilaian sedang terkunci.', 'warning'); return; }
    const hasLowManual = Object.values(manualScores).some(v => v <= 2);
    if (hasLowManual && (!comment || comment.trim().length < 5)) { showToast('Komentar pembinaan wajib bila ada nilai ≤ 2!', 'error'); return; }
    setIsSubmitting(true);
    try {
      const { autoScores } = computeAutoScoresFor(selectedStudent, selectedStage);
      const totalScore = calculateTotalScore();
      const matrix = getAssessmentMatrix(selectedStudent.role);
      let category: AssessorCategory = 'REKAN';
      for (const rel of matrix) { if (rel.roles.includes(user.role)) { category = rel.category; break; } }
      // Guru/admin selalu dapat kategori GURU
      if (canManageAll) category = 'GURU';

      await saveAssessment({
        classId: activeClass.id, productionId: 'prod',
        studentId: selectedStudent.uid, studentName: selectedStudent.displayName,
        studentRole: selectedStudent.role, studentDivision: selectedStudent.divisionName,
        assessorId: user.uid, assessorName: user.displayName, assessorRole: user.role,
        assessorCategory: category, stage: selectedStage,
        scores: manualScores, autoScores, totalScore,
        comment: comment.trim(), isFinal: true,
      } as any);

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'ASSESS', targetType: 'Assessment', targetId: selectedStudent.uid,
        details: `Nilai ${totalScore} untuk ${selectedStudent.displayName} (${selectedStage}) — ${category}`,
      });
      showToast(`Penilaian ${selectedStudent.displayName} disimpan!`, 'success');
      setIsGradingOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setIsSubmitting(false); }
  };

  // =====================================================
  // WA ACTIONS
  // =====================================================
  const handleWAFollowupPeer = (student: UserProfile) => {
    if (!student.phone) { showToast(`${student.displayName} belum punya nomor WA.`, 'warning'); return; }
    const text = templateFollowupPeerAssessment(
      student.displayName, teacherName, classKerabat, className
    );
    window.open(buildWhatsAppUrl(student.phone, text), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WhatsApp ke ${student.displayName}...`, 'info');
  };

  const handleWAAskAboutScore = (student: UserProfile) => {
    if (!student.phone) { showToast(`${student.displayName} belum punya nomor WA.`, 'warning'); return; }
    const text = templateAskAboutScore(
      student.displayName, teacherName, classKerabat, className, selectedStage
    );
    window.open(buildWhatsAppUrl(student.phone, text), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WhatsApp ke ${student.displayName}...`, 'info');
  };

  const handleWAAskClarification = (anomaly: Anomaly) => {
    const assessor = anomaly.assessorUser;
    if (!assessor) {
      showToast('Data penilai tidak ditemukan.', 'warning');
      return;
    }
    if (!assessor.phone) {
      showToast(`${assessor.displayName} belum punya nomor WA.`, 'warning');
      return;
    }
    const targetName = anomaly.targetUser?.displayName || anomaly.record.studentName;
    const text = templateAskClarification(
      assessor.displayName, targetName, teacherName, classKerabat, className,
      selectedStage, anomaly.reason
    );
    window.open(buildWhatsAppUrl(assessor.phone, text), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WhatsApp ke ${assessor.displayName}...`, 'info');
  };

  const handleWABulkFollowup = () => {
    const pending = students.filter(s => { const st = getPeerStatus(s); return st.total > 0 && !st.isComplete && s.phone; });
    if (pending.length === 0) { showToast('Semua siswa sudah isi peer assessment.', 'success'); return; }
    if (!confirm(`Kirim reminder WA ke ${pending.length} siswa yang belum isi penilaian rekan?`)) return;
    pending.forEach((s, i) => {
      setTimeout(() => {
        const text = templateFollowupPeerAssessment(s.displayName, teacherName, classKerabat, className);
        window.open(buildWhatsAppUrl(s.phone || '', text), '_blank', 'noopener,noreferrer');
      }, i * 800);
    });
    showToast(`Membuka ${pending.length} chat WhatsApp...`, 'info');
  };

  // =====================================================
  // RESET / DELETE
  // =====================================================
  const handleResetStage = async () => {
    if (!canManageAll || !activeClass || !user) return;
    if (resetConfirmText.trim() !== activeClass.name) { showToast('Nama kelas tidak cocok.', 'error'); return; }
    setIsResetting(true);
    try {
      const q = query(collection(db, 'assessments'), where('classId', '==', activeClass.id), where('stage', '==', selectedStage));
      const snap = await getDocs(q);
      if (snap.empty) { showToast('Tidak ada penilaian.', 'info'); setIsResetting(false); setResetConfirmOpen(false); setResetConfirmText(''); return; }
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        const histRef = doc(collection(db, 'assessmentHistory'));
        batch.set(histRef, { ...d.data(), id: histRef.id, originalId: d.id, supersededAt: new Date().toISOString(), supersededBy: user.uid, reason: `RESET ${selectedStage}` });
        batch.delete(d.ref);
      });
      await batch.commit();
      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'DELETE', targetType: 'AssessmentStageReset', targetId: activeClass.id, details: `RESET ${snap.size} penilaian ${selectedStage}` });
      showToast(`${snap.size} penilaian direset!`, 'success');
      setResetConfirmOpen(false); setResetConfirmText('');
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
    finally { setIsResetting(false); }
  };

  const handleDeleteOneAssessment = async (rec: AssessmentRecord, silent = false) => {
    if (!canManageAll || !user) return;
    if (!silent && !confirm(`Hapus penilaian ${rec.studentName} oleh ${rec.assessorName}?`)) return;
    try {
      const histRef = doc(collection(db, 'assessmentHistory'));
      await writeBatch(db).set(histRef, { ...rec, id: histRef.id, originalId: rec.id, supersededAt: new Date().toISOString(), supersededBy: user.uid, reason: `Dihapus oleh ${user.displayName}` }).commit();
      await deleteDoc(doc(db, 'assessments', rec.id));
      showToast(`Penilaian dihapus.`, 'info');
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
  };

  // =====================================================
  // AGGREGATED
  // =====================================================
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
    const guruScore = avg(byCat.GURU), atasanScore = avg(byCat.ATASAN), rekanScore = avg(byCat.REKAN), bawahanScore = avg(byCat.BAWAHAN);
    const weights = getAssessorWeights(studentRole);
    let weightedSum = 0, weightTotal = 0;
    if (guruScore !== null && weights.GURU > 0) { weightedSum += guruScore * weights.GURU; weightTotal += weights.GURU; }
    if (atasanScore !== null && weights.ATASAN > 0) { weightedSum += atasanScore * weights.ATASAN; weightTotal += weights.ATASAN; }
    if (rekanScore !== null && weights.REKAN > 0) { weightedSum += rekanScore * weights.REKAN; weightTotal += weights.REKAN; }
    if (bawahanScore !== null && weights.BAWAHAN > 0) { weightedSum += bawahanScore * weights.BAWAHAN; weightTotal += weights.BAWAHAN; }
    const finalVal = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0;
    return { finalVal, guruScore, atasanScore, rekanScore, bawahanScore, count: records.length, records };
  };

  const filteredStudents = students.filter(s => {
    if (onlyWithTasks && !studentHasTasksInStage(s)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.displayName || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q) || (s.divisionName || '').toLowerCase().includes(q);
  });

  const stageCount = (stageId: ProductionStage) => assessments.filter(a => a.stage === stageId).length;

  // ✅ Deteksi anomali
  const anomalies = canManageAll ? detectAnomalies(assessments, students, selectedStage) : [];

  const handleDownloadClassRecap = () => {
    const sheet1 = {
      name: 'Rekap Nilai',
      headers: ['Nama', 'Peran', 'Divisi', 'Tugas Selesai', 'Total Tugas', CATEGORY_LABEL.GURU, CATEGORY_LABEL.ATASAN, CATEGORY_LABEL.REKAN, CATEGORY_LABEL.BAWAHAN, 'Nilai Akhir', 'Predikat'],
      rows: filteredStudents.map(s => {
        const agg = getAggregatedScore(s.uid, s.role);
        const pred = agg ? getPredikat(agg.finalVal) : null;
        const taskList = getStudentTaskList(s);
        const done = taskList.filter(t => t.status !== 'BELUM' && t.status !== 'PROSES').length;
        return [s.displayName, s.role, s.divisionName || '-', done, taskList.length, agg?.guruScore?.toFixed(1) ?? '-', agg?.atasanScore?.toFixed(1) ?? '-', agg?.rekanScore?.toFixed(1) ?? '-', agg?.bawahanScore?.toFixed(1) ?? '-', agg?.finalVal ?? '-', pred?.predikat ?? '-'];
      }),
    };
    const sheet2 = {
      name: 'Detail Tugas',
      headers: ['Nama', 'Peran', 'Judul Tugas', 'Deadline', 'Status', 'Submit', 'Bukti', 'Catatan'],
      rows: filteredStudents.flatMap(s => getStudentTaskList(s).map(t => [s.displayName, s.role, t.task.title, new Date(t.task.dueDate).toLocaleDateString('id-ID'), t.label, t.submission?.submittedAt ? new Date(t.submission.submittedAt).toLocaleString('id-ID') : '-', t.submission?.proofUrl || '-', t.submission?.proofNote || '-'])),
    };
    const sheet3 = {
      name: 'Komentar',
      headers: ['Siswa', 'Penilai', 'Peran', 'Kategori', 'Nilai', 'Komentar', 'Tanggal'],
      rows: filteredStudents.flatMap(s => assessments.filter(a => a.studentId === s.uid && a.stage === selectedStage).map(a => [s.displayName, a.assessorName, a.assessorRole, CATEGORY_LABEL[(a as any).assessorCategory || 'REKAN'], a.totalScore, a.comment || '-', new Date(a.createdAt || a.updatedAt || '').toLocaleString('id-ID')])),
    };
    exportMultiSheetXLSX(`Rekap_Nilai_${activeClass?.name || 'Kelas'}_${selectedStage}_${new Date().toISOString().slice(0, 10)}.xls`, [sheet1, sheet2, sheet3]);
    showToast('Rekap berhasil diunduh!', 'success');
  };

  if (!activeClass) {
    return (
      <div className="p-8 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 text-center max-w-2xl mx-auto my-8">
        <AlertCircle className="w-16 h-16 mx-auto text-amber-600 dark:text-amber-400 mb-4" />
        <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">Anda Belum Masuk ke Kelas</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600"><Award className="w-7 h-7" /></span>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Penilaian 360° Berbasis Tugas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Auto-score dari Tugas & Presensi + Manual 360°</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canManageAll && (
              <button onClick={handleWABulkFollowup}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> WA Bulk
              </button>
            )}
            <button onClick={handleDownloadClassRecap}
              className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Rekap
            </button>
            <button onClick={loadStudents} disabled={studentsLoading}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${studentsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tahapan:</span>
            {stageConfig?.currentStage && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
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
                <button key={s.id} onClick={() => setSelectedStage(s.id)} disabled={!enabled && !canManageAll}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                    isActive ? enabled ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' : 'bg-rose-500 text-white shadow-md'
                      : enabled ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed'
                  }`}>
                  {!enabled && <Lock className="w-3 h-3" />}
                  {enabled && !sStatus.open && <Award className="w-3 h-3 opacity-70" />}
                  {enabled && sStatus.open && <Unlock className="w-3 h-3 opacity-70" />}
                  <span>{s.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!isAssessmentLocked && assessmentStatus.endMs && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-300 flex items-start gap-2">
            <Timer className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200">
              <p className="font-bold">Penilaian TERBUKA — sisa {formatDuration(assessmentStatus.endMs - Date.now())}</p>
            </div>
          </div>
        )}
        {isAssessmentLocked && assessmentStatus.reason === 'not-started' && assessmentStatus.startMs && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-300 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 dark:text-blue-200">
              <p className="font-bold">Penilaian BELUM DIBUKA</p>
              <p className="mt-0.5">Dibuka dalam <strong>{formatDuration(assessmentStatus.startMs - Date.now())}</strong></p>
            </div>
          </div>
        )}
        {isAssessmentLocked && assessmentStatus.reason === 'ended' && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900 dark:text-rose-200"><p className="font-bold">Penilaian SUDAH DITUTUP</p></div>
          </div>
        )}
        {isStageLocked && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900 dark:text-rose-200"><p className="font-bold">Tahap {selectedStage} belum dibuka.</p></div>
          </div>
        )}

        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 flex items-start gap-2">
          <ListChecks className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
            <p className="font-bold">Penilaian berbasis tugas sesuai peran.</p>
            <p className="mt-0.5">Siswa dinilai dari tugas-tugas yang ditugaskan ke peran/divisinya di tahap ini. <strong>Guru bisa edit nilai siapa saja</strong> untuk moderasi.</p>
          </div>
        </div>
      </div>

      {canManageAll && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Aksi Khusus Guru/Admin
          </div>
          <button onClick={() => setResetConfirmOpen(true)} disabled={isStageLocked}
            className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> Reset Nilai Tahap {selectedStage}
          </button>
        </div>
      )}

      {/* ═══ SECTION: ANOMALI PENILAIAN (GURU) ═══ */}
      {canManageAll && anomalies.length > 0 && (
        <div className="rounded-3xl border-2 border-rose-300 dark:border-rose-500/40 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-500/10 dark:to-orange-500/10 overflow-hidden shadow-sm">
          <button
            onClick={() => setShowAnomalies(!showAnomalies)}
            className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-rose-100/50 dark:hover:bg-rose-500/10 transition"
          >
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-rose-500 text-white shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
                  {anomalies.length} Penilaian Perlu Klarifikasi
                </h3>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                  Deteksi nilai ekstrem atau outlier — hubungi penilai via WA
                </p>
              </div>
            </div>
            <span className={`text-rose-600 dark:text-rose-400 transition-transform ${showAnomalies ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {showAnomalies && (
            <div className="p-4 pt-0 space-y-2 border-t border-rose-200 dark:border-rose-500/30">
              {anomalies.map((an, i) => {
                const sevColor =
                  an.severity === 'high' ? 'border-rose-400 bg-rose-50 dark:bg-rose-500/10'
                  : an.severity === 'medium' ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                  : 'border-blue-400 bg-blue-50 dark:bg-blue-500/10';
                const sevLabel =
                  an.severity === 'high' ? 'KRITIS'
                  : an.severity === 'medium' ? 'SEDANG'
                  : 'RINGAN';
                const sevBadge =
                  an.severity === 'high' ? 'bg-rose-600 text-white'
                  : an.severity === 'medium' ? 'bg-amber-500 text-white'
                  : 'bg-blue-500 text-white';

                return (
                  <div key={i} className={`p-3 rounded-2xl border-2 ${sevColor}`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${sevBadge}`}>{sevLabel}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-700 text-white">
                            {an.type}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-auto">
                            {new Date(an.record.createdAt || an.record.updatedAt || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {an.assessorUser?.displayName || an.record.assessorName}
                          <span className="text-slate-400 font-normal"> ({CATEGORY_LABEL[(an.record as any).assessorCategory || 'REKAN']})</span>
                          <span className="mx-1">→</span>
                          {an.targetUser?.displayName || an.record.studentName}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {an.reason}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Total nilai: <strong className="font-mono">{an.record.totalScore}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {an.assessorUser?.phone && (
                          <button onClick={() => handleWAAskClarification(an)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" /> WA Klarifikasi
                          </button>
                        )}
                        <button onClick={() => handleDeleteOneAssessment(an.record)}
                          className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 hover:bg-rose-200 transition"
                          title="Hapus penilaian ini">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari siswa atau peran..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={onlyWithTasks} onChange={(e) => setOnlyWithTasks(e.target.checked)} className="rounded border-slate-300 text-amber-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Hanya yang punya tugas</span>
        </label>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="py-3.5 px-4">Nama</th>
                <th className="py-3.5 px-4">Peran</th>
                <th className="py-3.5 px-4 text-center">Tugas</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.GURU}</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.ATASAN}</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.REKAN}</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.BAWAHAN}</th>
                <th className="py-3.5 px-4 text-center">Nilai</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {studentsLoading ? (
                <tr><td colSpan={9} className="py-8 text-center text-xs text-slate-400"><RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" /> Memuat...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {students.length === 0 ? 'Data siswa tidak ter-load.' : onlyWithTasks ? 'Tidak ada siswa dengan tugas di tahap ini.' : 'Tidak ada yang cocok.'}
                  </p>
                </td></tr>
              ) : (
                filteredStudents.map(student => {
                  const agg = getAggregatedScore(student.uid, student.role);
                  const predInfo = agg ? getPredikat(agg.finalVal) : null;
                  const canGrade = canGradeStudent(student) && !isStageLocked && !isAssessmentLocked;
                  const peerStatus = getPeerStatus(student);
                  const taskList = getStudentTaskList(student);
                  const doneTasks = taskList.filter(t => t.status !== 'BELUM' && t.status !== 'PROSES').length;
                  return (
                    <tr key={student.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{student.displayName}</p>
                        {student.phone && <p className="text-[9px] text-slate-400 font-mono">{student.phone}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600 dark:text-slate-400">{student.role}</td>
                      <td className="py-3.5 px-4 text-center">
                        {taskList.length === 0 ? <span className="text-[10px] text-slate-400 italic">—</span> : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            doneTasks === taskList.length ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-amber-100 text-amber-700 border-amber-300'
                          }`}>{doneTasks}/{taskList.length}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{agg?.guruScore != null ? agg.guruScore.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{agg?.atasanScore != null ? agg.atasanScore.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{agg?.rekanScore != null ? agg.rekanScore.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{agg?.bawahanScore != null ? agg.bawahanScore.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        {agg ? <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{agg.finalVal}</span> : <span className="text-xs text-slate-400">-</span>}
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
                          {canManageAll && peerStatus.total > 0 && !peerStatus.isComplete && student.phone && (
                            <button onClick={() => handleWAFollowupPeer(student)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700" title="WA follow-up peer">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canManageAll && agg && student.phone && (
                            <button onClick={() => handleWAAskAboutScore(student)} className="p-1.5 rounded-lg bg-blue-50 text-blue-700" title="Tanya nilai">
                              <Send className="w-3.5 h-3.5" />
                            </button>
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

      {/* MODAL GRADING */}
      {isGradingOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-6 bg-slate-900 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase">Penilaian 360° • {selectedStage}</span>
                  <h3 className="text-lg font-black mt-0.5">{selectedStudent.displayName}</h3>
                  <p className="text-xs text-slate-400">{selectedStudent.role}{selectedStudent.divisionName ? ` • ${selectedStudent.divisionName}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Perkiraan Nilai</p>
                  <p className="text-3xl font-black text-amber-400 font-mono">{calculateTotalScore()}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-amber-600" />
                    <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase">Tugas Siswa di Tahap {selectedStage}</h4>
                  </div>
                  {(() => {
                    const tl = getStudentTaskList(selectedStudent);
                    const done = tl.filter(t => t.status !== 'BELUM' && t.status !== 'PROSES').length;
                    return <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-white/70 border border-amber-300 text-amber-900">{done}/{tl.length}</span>;
                  })()}
                </div>
                {(() => {
                  const taskList = getStudentTaskList(selectedStudent);
                  if (taskList.length === 0) {
                    return (
                      <div className="p-4 rounded-xl bg-white/70 border border-amber-200 text-center">
                        <p className="text-xs text-amber-800 italic">Tidak ada tugas untuk peran <strong>{selectedStudent.role}</strong> di tahap ini.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {taskList.map((item, idx) => (
                        <div key={item.task.id || idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200">
                          <div className="flex items-start gap-2">
                            <div className={`mt-0.5 shrink-0 ${
                              item.status === 'AWAL' || item.status === 'TEPAT' ? 'text-emerald-600' :
                              item.status === 'TELAT_RINGAN' || item.status === 'PROSES' ? 'text-amber-600' : 'text-rose-600'
                            }`}>
                              {item.status === 'AWAL' || item.status === 'TEPAT' ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                {item.task.isCritical && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">KRITIS</span>}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${item.color}`}>{item.label}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{item.task.title}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Deadline: {new Date(item.task.dueDate).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {item.submission?.submittedAt && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Submit: {new Date(item.submission.submittedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                              {(item.submission?.proofUrl || item.submission?.proofNote) && (
                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                  {item.submission.proofNote && <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] italic">"{item.submission.proofNote}"</div>}
                                  {item.submission.proofUrl && (
                                    <a href={item.submission.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline">
                                      <ExternalLink className="w-2.5 h-2.5" /> Lihat Bukti
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Daftar penilaian yang sudah ada (khusus guru) */}
              {canManageAll && (() => {
                const existingRecords = assessments.filter(a => a.studentId === selectedStudent.uid && a.stage === selectedStage);
                if (existingRecords.length === 0) return null;
                return (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border-2 border-indigo-200 dark:border-indigo-500/40">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase">Moderasi: Penilaian yang Sudah Ada ({existingRecords.length})</h4>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {existingRecords.map(r => {
                        const cat = (r as any).assessorCategory || 'REKAN';
                        const isSelf = r.assessorId === user?.uid;
                        return (
                          <div key={r.id} className={`p-2.5 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-between gap-2 ${
                            isSelf ? 'border-emerald-300' : 'border-slate-200 dark:border-slate-700'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                                {r.assessorName} <span className="text-slate-400 font-normal">({CATEGORY_LABEL[cat]})</span>
                                {isSelf && <span className="ml-1 text-[9px] text-emerald-600 font-bold">[Anda]</span>}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Nilai: <strong className="font-mono">{r.totalScore}</strong>
                                {r.comment && <span className="ml-1 italic truncate">— "{r.comment.slice(0, 40)}..."</span>}
                              </p>
                            </div>
                            <button onClick={() => handleDeleteOneAssessment(r)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0"
                              title="Hapus penilaian ini">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-2 italic">
                      Anda bisa hapus penilaian anomali di sini, lalu isi nilai baru di bawah.
                    </p>
                  </div>
                );
              })()}

              {/* AUTO SCORE */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-black text-blue-900 dark:text-blue-200">SKOR OTOMATIS</h4>
                </div>
                {(() => {
                  const { autoScores, taskResult, attendResult } = computeAutoScoresFor(selectedStudent, selectedStage);
                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200">
                          <p className="text-[10px] font-bold text-blue-700">Tanggung Jawab</p>
                          <p className="text-2xl font-black text-blue-900 font-mono">{autoScores.tanggung_jawab}</p>
                          <p className="text-[9px] text-blue-600">{taskResult.pctOnTime}% tepat waktu</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200">
                          <p className="text-[10px] font-bold text-blue-700">Kehadiran</p>
                          <p className="text-2xl font-black text-blue-900 font-mono">{autoScores.kehadiran}</p>
                          <p className="text-[9px] text-blue-600">{attendResult.pct}% hadir</p>
                        </div>
                        {selectedStudent.role === 'Pemeran' && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200">
                            <p className="text-[10px] font-bold text-blue-700">Kedisiplinan</p>
                            <p className="text-2xl font-black text-blue-900 font-mono">{autoScores.kedisiplinan}</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">PENILAIAN MANUAL</h4>
                </div>
                <div className="space-y-3">
                  {manualCriteria.map(crit => {
                    const currentVal = manualScores[crit.key] || 3;
                    const scaleInfo = SCORE_SCALE[currentVal];
                    return (
                      <div key={crit.key} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{crit.label}</span>
                            <span className="text-[10px] text-slate-400 ml-2">Bobot: {crit.weight}%</span>
                            <p className="text-[11px] text-slate-500 mt-0.5">{crit.desc}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${scaleInfo.badgeColor}`}>{currentVal} • {scaleInfo.label}</span>
                        </div>
                        <input type="range" min="1" max="4" step="1" value={currentVal} onChange={(e) => setManualScores(prev => ({ ...prev, [crit.key]: parseInt(e.target.value) }))} className="w-full accent-amber-500 cursor-pointer" />
                        <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                          <span>1 Kurang (40)</span><span>2 Cukup (60)</span><span>3 Baik (80)</span><span>4 Sangat Baik (100)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Komentar
                  {Object.values(manualScores).some(v => v <= 2) && <span className="text-rose-500 font-bold ml-1">(Wajib karena ada nilai ≤ 2)</span>}
                </label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Catatan konstruktif..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium" />
              </div>

              {selectedStudent.phone && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[11px] font-bold text-emerald-900 mb-2">WhatsApp:</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleWAFollowupPeer(selectedStudent)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px]">Follow-up Peer</button>
                    <button type="button" onClick={() => handleWAAskAboutScore(selectedStudent)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px]">Tanya Nilai</button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-between shrink-0">
              <button onClick={() => setIsGradingOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleSaveAssessment} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-extrabold text-rose-900 dark:text-rose-200">Reset Penilaian</h3>
            </div>
            <input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} placeholder={activeClass?.name} autoFocus
              className={`w-full px-3.5 py-2.5 rounded-xl border-2 font-semibold text-sm ${resetConfirmText.trim() === activeClass?.name ? 'border-emerald-500' : 'border-rose-200'}`} />
            <div className="flex gap-2">
              <button onClick={() => { setResetConfirmOpen(false); setResetConfirmText(''); }} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleResetStage} disabled={isResetting || resetConfirmText.trim() !== activeClass?.name} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs disabled:opacity-40">
                {isResetting ? 'Mereset...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};