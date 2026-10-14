import React, { useState, useEffect } from 'react';
import {
  Award, Lock, Unlock, Search, CheckCircle, MessageCircle, Send,
  TrendingUp, Info, AlertTriangle, Sparkles, Bot, Download,
  Trash2, RotateCcw, X, Edit3, ShieldAlert, Clock,
  RefreshCw, Bug, AlertCircle, Timer, Users,
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
  subscribeAssessments, subscribeTasksByClass, subscribeAttendanceSessions,
  subscribeAllAttendanceRecords,
} from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useToast } from '../common/Toast';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

// =========================================================
// LABEL HUMANIS — ganti "Atasan" & "Bawahan"
// =========================================================
type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

const CATEGORY_LABEL: Record<AssessorCategory, string> = {
  GURU: 'Guru Pengampu',
  ATASAN: 'Koordinator',       // label generik utk header tabel
  REKAN: 'Rekan Kerja',
  BAWAHAN: 'Anggota Tim',
};

// Label spesifik per siswa berdasarkan matriks penilaian
function getAssessorLabel(targetRole: string, category: AssessorCategory): string {
  if (category === 'GURU') return 'Guru Pengampu';

  const matrix = getAssessmentMatrix(targetRole);
  const rel = matrix.find(r => r.category === category);

  if (!rel || rel.roles.length === 0) {
    if (category === 'ATASAN') return 'Atasan Langsung';
    if (category === 'BAWAHAN') return 'Anggota Tim';
    return 'Rekan Kerja';
  }
  if (rel.roles.length === 1) return rel.roles[0];
  if (rel.roles.length <= 2) return rel.roles.join(' & ');
  return `${rel.roles[0]} & ${rel.roles.length - 1} lainnya`;
}

// =========================================================
// AUTO SCORE HELPERS
// =========================================================
function computeTaskResponsibility(
  student: UserProfile, tasks: any[], submissions: any[], stage: ProductionStage
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
      else if (diffDays <= 2) { telatRingan += 1; if (isCritical && diffDays > 1) criticalLate += 1; }
      else { telatBerat += 1; if (isCritical) criticalLate += 1; }
    } else if (sub.status === 'TERLAMBAT') {
      telatBerat += 1;
      if (isCritical) criticalLate += 1;
    }
  });

  const totalTasks = myTasks.length;
  if (totalTasks === 0) return { score: 4, totalTasks: 0, pctOnTime: 100, criticalLate: 0, criticalMissed: 0 };

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
  student: UserProfile, sessions: any[], records: any[], stage: ProductionStage
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
  const avg = (taskScore + attendScore) / 2;
  return Math.floor(avg) as 1 | 2 | 3 | 4;
}

// =========================================================
// JADWAL PENILAIAN HELPERS
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
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' WITA';
  } catch { return '-'; }
}

// =========================================================
// WA HELPERS
// =========================================================
function buildWhatsAppUrl(phone: string, text: string): string {
  let clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  if (!clean) return '#';
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

function templateFollowupPeerAssessment(studentName: string, classKerabat: string) {
  return `Halo ${studentName},\n\n` +
    `Salam dari tim produksi teater ${classKerabat}.\n\n` +
    `Kami ingatkan bahwa Anda belum mengisi *penilaian rekan kerja (peer assessment)* Anda.\n\n` +
    `Penilaian teman penting agar rapor 360° adil dan teman-teman Anda juga bisa melihat nilai mereka.\n\n` +
    `Mohon segera isi penilaian melalui aplikasi SP-PPT → menu *Penilaian*.\n\n` +
    `Terima kasih atas kerja samanya 🙏`;
}

function templateAskAboutScore(studentName: string, classKerabat: string, stage: string) {
  return `Halo ${studentName},\n\n` +
    `Salam dari tim produksi teater ${classKerabat}.\n\n` +
    `Kami ingin *membahas nilai Anda* di tahap ${stage}.\n\n` +
    `Jika ada pertanyaan atau keberatan terkait nilai, silakan hubungi Guru Pengampu untuk klarifikasi.\n\n` +
    `Terima kasih 🙏`;
}

// =========================================================
// MAIN
// =========================================================
export const AssessmentModule: React.FC = () => {
  const { user, activeClass, isAdminRole, isGuruPengampu, canAssessTarget } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsDebug, setStudentsDebug] = useState<{
    totalUsers: number; matched: number; source: string; error?: string;
  }>({ totalUsers: 0, matched: 0, source: 'idle' });

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

  // Filter: hanya tampilkan siswa yang punya tugas di tahap ini
  const [onlyWithTasks, setOnlyWithTasks] = useState(true);

  const [stageConfig, setStageConfig] = useState<any>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const canManageAll = isGuruPengampu || isAdminRole;

  // =========================== LOAD STUDENTS ===========================
  const loadStudents = async () => {
    if (!activeClass) {
      setStudentsLoading(false);
      setStudents([]);
      setStudentsDebug({ totalUsers: 0, matched: 0, source: 'no-active-class' });
      return;
    }
    setStudentsLoading(true);
    setStudentsDebug({ totalUsers: 0, matched: 0, source: 'loading...' });

    try {
      let list: UserProfile[] = [];
      let source = 'fetchUsersByClass';
      try { list = await fetchUsersByClass(activeClass.id); } catch (err: any) { console.warn('fetchUsersByClass gagal:', err); }

      if (!list || list.length === 0) {
        try {
          const all = await fetchAllUsers();
          const classNameLower = (activeClass.name || '').toLowerCase().trim();
          list = all.filter(u => {
            const matchId = u.classId === activeClass.id;
            const matchName = (u.className || '').toLowerCase().trim() === classNameLower;
            return matchId || matchName;
          });
          source = 'fetchAllUsers (fallback)';
          setStudentsDebug({ totalUsers: all.length, matched: list.length, source });
        } catch (err: any) {
          setStudentsDebug({ totalUsers: 0, matched: 0, source: 'error', error: err?.message || 'Unknown error' });
        }
      } else {
        setStudentsDebug(prev => ({ ...prev, source }));
      }

      const filtered = list.filter(s =>
        s.role !== 'Guru Pengampu' && s.role !== 'Guru Pembina' &&
        s.role !== 'Admin' && s.role !== 'Super Admin'
      );
      setStudents(filtered);
      setStudentsDebug(prev => ({ ...prev, totalUsers: prev.totalUsers || list.length, matched: filtered.length }));
    } catch (err: any) {
      setStudents([]);
      setStudentsDebug({ totalUsers: 0, matched: 0, source: 'error', error: err?.message || 'Unknown' });
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => { loadStudents(); /* eslint-disable-next-line */ }, [activeClass?.id]);

  useEffect(() => {
    if (!activeClass) return;
    const unsub1 = subscribeAssessments(activeClass.id, setAssessments);
    const unsub2 = subscribeTasksByClass(activeClass.id, setTasks);
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

  // =========================== STAGE GATE ===========================
  const isStageEnabled = (stageId: ProductionStage): boolean => {
    if (!stageConfig?.stageDeadlines) return true;
    const cfg = stageConfig.stageDeadlines[stageId];
    if (!cfg) return true;
    return cfg.enabled !== false;
  };

  const isStageLocked = !isStageEnabled(selectedStage);
  const assessmentStatus = isAssessmentOpen(stageConfig?.stageDeadlines, selectedStage);
  const isAssessmentLocked = !assessmentStatus.open;

  // =========================== AUTO SCORE ===========================
  const isPemeran = selectedStudent?.role === 'Pemeran';
  const criteriaList = isPemeran ? PEMERAN_CRITERIA : GENERAL_CRITERIA;
  const manualCriteria = criteriaList.filter(c => c.source === 'MANUAL');

  const computeAutoScoresFor = (student: UserProfile, stage: ProductionStage) => {
    const taskResult = computeTaskResponsibility(student, tasks, submissions, stage);
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
        const key = c.source === 'AUTO_TASK' ? 'tanggung_jawab'
          : c.source === 'AUTO_ATTENDANCE' ? 'kehadiran'
          : c.source === 'AUTO_DISCIPLINE' ? 'kedisiplinan' : null;
        if (key) score = autoScores[key] || 3;
      }
      const converted = SCORE_SCALE[score]?.score100 || 80;
      weightedSum += converted * c.weight;
      totalWeight += c.weight;
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 80;
  };

  // Cek apakah siswa punya tugas di tahap ini
  const studentHasTasksInStage = (student: UserProfile): boolean => {
    return tasks.some(t => {
      if (t.stageId && t.stageId !== selectedStage) return false;
      return (
        t.assigneeId === student.uid ||
        t.targetRole === student.role ||
        t.targetDivision === student.divisionName ||
        t.assigneeName === 'Semua Siswa' ||
        t.assigneeName === 'Semua Anggota Divisi'
      );
    });
  };

  // Cek status peer assessment siswa (berapa yang sudah ia nilai)
  const getPeerStatus = (student: UserProfile) => {
    const matrix = getAssessmentMatrix(student.role);
    const targetRoles = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(cat => {
      const rel = matrix.find(r => r.category === cat);
      if (rel) rel.roles.forEach(r => targetRoles.add(r));
    });

    const targets = students.filter(s => s.uid !== student.uid && targetRoles.has(s.role));
    const filled = targets.filter(t =>
      assessments.some(a => a.assessorId === student.uid && a.studentId === t.uid && a.stage === selectedStage)
    ).length;

    return {
      total: targets.length,
      filled,
      pending: targets.length - filled,
      pct: targets.length > 0 ? Math.round((filled / targets.length) * 100) : 100,
      isComplete: filled >= targets.length,
    };
  };

  // =========================== OPEN GRADING ===========================
  const openGradingModal = (student: UserProfile) => {
    if (isStageLocked) { showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning'); return; }
    if (isAssessmentLocked) {
      const reason = assessmentStatus.reason;
      if (reason === 'not-started' && assessmentStatus.startMs) {
        showToast(`Penilaian baru dibuka dalam ${formatDuration(assessmentStatus.startMs - Date.now())}.`, 'warning');
      } else if (reason === 'ended') {
        showToast(`Penilaian tahap ${selectedStage} sudah ditutup.`, 'warning');
      } else if (reason === 'disabled') {
        showToast('Penilaian tahap ini dinonaktifkan.', 'warning');
      } else {
        showToast('Penilaian belum dibuka.', 'warning');
      }
      return;
    }
    if (!canAssessTarget(student)) {
      showToast('Anda tidak memiliki wewenang menilai siswa ini.', 'warning');
      return;
    }
    setSelectedStudent(student);

    // Prefill dengan nilai lama (kalau sudah pernah dinilai)
    const existing = assessments.find(a =>
      a.assessorId === user?.uid && a.studentId === student.uid && a.stage === selectedStage
    );
    const initial: Record<string, number> = {};
    manualCriteria.forEach(c => {
      initial[c.key] = (existing?.scores && existing.scores[c.key]) || 3;
    });
    setManualScores(initial);
    setComment(existing?.comment || '');
    setIsGradingOpen(true);
  };

  // =========================== SAVE ===========================
  const handleSaveAssessment = async () => {
    if (!user || !selectedStudent || !activeClass) return;
    if (isStageLocked) { showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning'); return; }
    if (isAssessmentLocked) { showToast('Penilaian sedang terkunci.', 'warning'); return; }

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
      let category: AssessorCategory = 'REKAN';
      for (const rel of matrix) { if (rel.roles.includes(user.role)) { category = rel.category; break; } }

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
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setIsSubmitting(false); }
  };

  // =========================== WA FOLLOW-UP ===========================
  const handleWAFollowupPeer = (student: UserProfile) => {
    if (!student.phone) {
      showToast(`${student.displayName} belum mengisi nomor WhatsApp.`, 'warning');
      return;
    }
    const text = templateFollowupPeerAssessment(student.displayName, activeClass?.kerabatKerja || activeClass?.name || '');
    window.open(buildWhatsAppUrl(student.phone, text), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WhatsApp ke ${student.displayName}...`, 'info');
  };

  const handleWAAskAboutScore = (student: UserProfile) => {
    if (!student.phone) {
      showToast(`${student.displayName} belum mengisi nomor WhatsApp.`, 'warning');
      return;
    }
    const text = templateAskAboutScore(student.displayName, activeClass?.kerabatKerja || activeClass?.name || '', selectedStage);
    window.open(buildWhatsAppUrl(student.phone, text), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WhatsApp ke ${student.displayName}...`, 'info');
  };

  const handleWABulkFollowup = () => {
    // Kumpulkan siswa yang belum isi peer assessment
    const pending = students.filter(s => {
      const st = getPeerStatus(s);
      return st.total > 0 && !st.isComplete && s.phone;
    });

    if (pending.length === 0) {
      showToast('Semua siswa sudah mengisi penilaian rekan kerja. ✅', 'success');
      return;
    }

    if (!confirm(
      `Kirim reminder WhatsApp ke ${pending.length} siswa yang belum mengisi penilaian rekan?\n\n` +
      `Anda akan membuka WA satu per satu (tidak spam otomatis).`
    )) return;

    // Buka WA untuk setiap siswa dengan delay 800ms agar tidak diblokir browser
    pending.forEach((s, i) => {
      setTimeout(() => {
        const text = templateFollowupPeerAssessment(s.displayName, activeClass?.kerabatKerja || activeClass?.name || '');
        window.open(buildWhatsAppUrl(s.phone || '', text), '_blank', 'noopener,noreferrer');
      }, i * 800);
    });

    showToast(`Membuka ${pending.length} chat WhatsApp. Pastikan popup tidak diblokir.`, 'info');
  };

  // =========================== RESET ===========================
  const handleResetStage = async () => {
    if (!canManageAll || !activeClass || !user) return;
    if (resetConfirmText.trim() !== activeClass.name) { showToast('Nama kelas tidak cocok.', 'error'); return; }
    setIsResetting(true);
    try {
      const q = query(collection(db, 'assessments'),
        where('classId', '==', activeClass.id), where('stage', '==', selectedStage));
      const snap = await getDocs(q);
      if (snap.empty) {
        showToast('Tidak ada penilaian di tahap ini.', 'info');
        setIsResetting(false); setResetConfirmOpen(false); setResetConfirmText('');
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        const histRef = doc(collection(db, 'assessmentHistory'));
        batch.set(histRef, {
          ...d.data(), id: histRef.id, originalId: d.id,
          supersededAt: new Date().toISOString(), supersededBy: user.uid,
          reason: `RESET tahap ${selectedStage} oleh ${user.displayName}`,
        });
        batch.delete(d.ref);
      });
      await batch.commit();
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'AssessmentStageReset', targetId: activeClass.id,
        details: `RESET ${snap.size} penilaian tahap ${selectedStage}`,
      });
      showToast(`${snap.size} penilaian direset!`, 'success');
      setResetConfirmOpen(false); setResetConfirmText('');
    } catch (err: any) {
      showToast('Gagal reset: ' + (err?.message || 'Unknown'), 'error');
    } finally { setIsResetting(false); }
  };

  const handleDeleteOneAssessment = async (rec: AssessmentRecord) => {
    if (!canManageAll || !user) return;
    if (!confirm(`Hapus penilaian ${rec.studentName} oleh ${rec.assessorName}?`)) return;
    try {
      const histRef = doc(collection(db, 'assessmentHistory'));
      await writeBatch(db).set(histRef, {
        ...rec, id: histRef.id, originalId: rec.id,
        supersededAt: new Date().toISOString(), supersededBy: user.uid,
        reason: `Dihapus manual oleh ${user.displayName}`,
      }).commit();
      await deleteDoc(doc(db, 'assessments', rec.id));
      showToast(`Penilaian ${rec.studentName} dihapus.`, 'info');
    } catch (err: any) { showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error'); }
  };

  // =========================== AGGREGATED ===========================
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
    const guruScore = avg(byCat.GURU), atasanScore = avg(byCat.ATASAN),
          rekanScore = avg(byCat.REKAN), bawahanScore = avg(byCat.BAWAHAN);
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
    return (
      (s.displayName || '').toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q) ||
      (s.divisionName || '').toLowerCase().includes(q)
    );
  });

  const stageCount = (stageId: ProductionStage) => assessments.filter(a => a.stage === stageId).length;

  // =========================== DOWNLOAD REKAP KELAS ===========================
  const handleDownloadClassRecap = () => {
    const sheet1 = {
      name: 'Rekap Nilai',
      headers: [
        'Nama', 'Peran', 'Divisi',
        CATEGORY_LABEL.GURU, CATEGORY_LABEL.ATASAN, CATEGORY_LABEL.REKAN, CATEGORY_LABEL.BAWAHAN,
        'Nilai Akhir', 'Predikat',
      ],
      rows: filteredStudents.map(s => {
        const agg = getAggregatedScore(s.uid, s.role);
        const pred = agg ? getPredikat(agg.finalVal) : null;
        return [
          s.displayName, s.role, s.divisionName || '-',
          agg?.guruScore?.toFixed(1) ?? '-',
          agg?.atasanScore?.toFixed(1) ?? '-',
          agg?.rekanScore?.toFixed(1) ?? '-',
          agg?.bawahanScore?.toFixed(1) ?? '-',
          agg?.finalVal ?? '-',
          pred?.predikat ?? '-',
        ];
      }),
    };

    const sheet2 = {
      name: 'Detail Komentar',
      headers: ['Siswa', 'Penilai', 'Peran Penilai', 'Kategori', 'Nilai', 'Komentar', 'Tanggal'],
      rows: filteredStudents.flatMap(s =>
        assessments
          .filter(a => a.studentId === s.uid && a.stage === selectedStage)
          .map(a => [
            s.displayName,
            a.assessorName,
            a.assessorRole,
            CATEGORY_LABEL[(a as any).assessorCategory || 'REKAN'],
            a.totalScore,
            a.comment || '-',
            new Date(a.createdAt || a.updatedAt || '').toLocaleString('id-ID'),
          ])
      ),
    };

    const sheet3 = {
      name: 'Info',
      headers: ['Field', 'Nilai'],
      rows: [
        ['Kelas', activeClass?.name || '-'],
        ['Kerabat Kerja', activeClass?.kerabatKerja || '-'],
        ['Tahap', selectedStage],
        ['Tanggal Unduh', new Date().toLocaleString('id-ID')],
        ['Total Siswa', filteredStudents.length],
        ['Total Penilaian', assessments.filter(a => a.stage === selectedStage).length],
      ],
    };

    exportMultiSheetXLSX(
      `Rekap_Nilai_${activeClass?.name || 'Kelas'}_${selectedStage}_${new Date().toISOString().slice(0, 10)}.xls`,
      [sheet3, sheet1, sheet2]
    );
    showToast('Rekap nilai berhasil diunduh!', 'success');
  };

  // =========================== GUARD ===========================
  if (!activeClass) {
    return (
      <div className="p-8 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 text-center max-w-2xl mx-auto my-8">
        <AlertCircle className="w-16 h-16 mx-auto text-amber-600 dark:text-amber-400 mb-4" />
        <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">Anda Belum Masuk ke Kelas</h3>
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">Fitur penilaian membutuhkan kelas aktif.</p>
      </div>
    );
  }

  // =========================== RENDER ===========================
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
                Auto-score + Penilaian Koordinator, Rekan Kerja & Anggota Tim
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canManageAll && (
              <button onClick={handleWABulkFollowup}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition">
                <MessageCircle className="w-3.5 h-3.5" /> WA Follow-up Bulk
              </button>
            )}
            <button onClick={handleDownloadClassRecap}
              className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 transition">
              <Download className="w-3.5 h-3.5" /> Rekap Excel
            </button>
            <button onClick={loadStudents} disabled={studentsLoading}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${studentsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stage Selector */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilih Tahapan Penilaian:</span>
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
              const sAssessStatus = isAssessmentOpen(stageConfig?.stageDeadlines, s.id);
              return (
                <button key={s.id} onClick={() => setSelectedStage(s.id)}
                  disabled={!enabled && !canManageAll}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                    isActive
                      ? enabled ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' : 'bg-rose-500 text-white shadow-md'
                      : enabled
                      ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                  }`}>
                  {!enabled && <Lock className="w-3 h-3" />}
                  {enabled && !sAssessStatus.open && <Award className="w-3 h-3 opacity-70" />}
                  {enabled && sAssessStatus.open && <Unlock className="w-3 h-3 opacity-70" />}
                  <span>{s.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Jadwal Penilaian */}
        {!isAssessmentLocked && assessmentStatus.endMs && (
          <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 border-2 border-emerald-300 dark:border-emerald-500/40 flex items-start gap-2">
            <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <p className="font-bold">✅ Penilaian TERBUKA</p>
              <p className="mt-0.5">
                Sisa <strong>{formatDuration(assessmentStatus.endMs - Date.now())}</strong> — ditutup {formatDateTime(new Date(assessmentStatus.endMs).toISOString())}
              </p>
            </div>
          </div>
        )}

        {isAssessmentLocked && assessmentStatus.reason === 'not-started' && assessmentStatus.startMs && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-300 dark:border-blue-500/40 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
              <p className="font-bold">⏳ Penilaian BELUM DIBUKA</p>
              <p className="mt-0.5">Dibuka dalam <strong>{formatDuration(assessmentStatus.startMs - Date.now())}</strong></p>
            </div>
          </div>
        )}

        {isAssessmentLocked && assessmentStatus.reason === 'ended' && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
              <p className="font-bold">🔒 Penilaian SUDAH DITUTUP</p>
            </div>
          </div>
        )}

        {isStageLocked && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
              <p className="font-bold">🔒 Tahap {selectedStage} belum dibuka.</p>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 dark:text-blue-200">
            <p><strong>Skor otomatis</strong>: Tanggung Jawab (25%), Kehadiran (20%), Kedisiplinan Pemeran (10%).</p>
            <p className="mt-1"><strong>Skor manual</strong>: dinilai oleh Guru, {CATEGORY_LABEL.ATASAN}, {CATEGORY_LABEL.REKAN}, dan {CATEGORY_LABEL.BAWAHAN}.</p>
          </div>
        </div>

        {/* Debug */}
        {(studentsLoading || students.length === 0) && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
            <Bug className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed flex-1">
              <p className="font-bold">🔍 Diagnostik Data Siswa</p>
              <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
                <li>• Kelas: <strong>{activeClass?.name || '-'}</strong></li>
                <li>• Sumber: <strong>{studentsDebug.source}</strong></li>
                <li>• Total user: <strong>{studentsDebug.totalUsers}</strong></li>
                <li>• Match: <strong>{studentsDebug.matched}</strong></li>
                {studentsDebug.error && <li className="text-rose-700 dark:text-rose-300">• Error: {studentsDebug.error}</li>}
              </ul>
            </div>
          </div>
        )}
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
              className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition">
              <RotateCcw className="w-4 h-4" />
              Reset Nilai Tahap {selectedStage}
            </button>
          </div>
        </div>
      )}

      {/* SEARCH + FILTER */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari siswa atau peran..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <input type="checkbox" checked={onlyWithTasks}
            onChange={(e) => setOnlyWithTasks(e.target.checked)}
            className="rounded border-slate-300 text-amber-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Hanya yang punya tugas di tahap ini
          </span>
        </label>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="py-3.5 px-4">Nama</th>
                <th className="py-3.5 px-4">Peran</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.GURU}</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.ATASAN}</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.REKAN}</th>
                <th className="py-3.5 px-4 text-center">{CATEGORY_LABEL.BAWAHAN}</th>
                <th className="py-3.5 px-4 text-center">Nilai Akhir</th>
                <th className="py-3.5 px-4 text-center">Peer Assess</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {studentsLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
                    Memuat data siswa...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {students.length === 0
                        ? 'Data siswa tidak ter-load.'
                        : onlyWithTasks
                        ? 'Tidak ada siswa dengan tugas di tahap ini.'
                        : 'Tidak ada siswa yang cocok dengan pencarian.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  const agg = getAggregatedScore(student.uid, student.role);
                  const predInfo = agg ? getPredikat(agg.finalVal) : null;
                  const canGrade = canAssessTarget(student) && !isStageLocked && !isAssessmentLocked;
                  const peerStatus = getPeerStatus(student);
                  const hasPhone = !!student.phone;

                  return (
                    <tr key={student.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0">
                            {(student.displayName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{student.displayName}</p>
                            {hasPhone && (
                              <p className="text-[9px] text-slate-400 font-mono">{student.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600 dark:text-slate-400">{student.role}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {agg?.guruScore != null ? agg.guruScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {agg?.atasanScore != null ? agg.atasanScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {agg?.rekanScore != null ? agg.rekanScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {agg?.bawahanScore != null ? agg.bawahanScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {agg ? <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{agg.finalVal}</span> : <span className="text-xs text-slate-400 italic">-</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {peerStatus.total === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">—</span>
                        ) : peerStatus.isComplete ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                            ✅ {peerStatus.filled}/{peerStatus.total}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                            ⚠️ {peerStatus.filled}/{peerStatus.total}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Tombol Nilai (guru bisa edit jika sudah ada) */}
                          {canGrade ? (
                            <button onClick={() => openGradingModal(student)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1">
                              <Edit3 className="w-3 h-3" />
                              {agg ? 'Edit Nilai' : 'Nilai'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {isStageLocked ? 'Tahap tertutup' : isAssessmentLocked ? 'Terkunci jadwal' : 'Hanya lihat'}
                            </span>
                          )}

                          {/* WA Follow-up Peer Assessment */}
                          {canManageAll && peerStatus.total > 0 && !peerStatus.isComplete && hasPhone && (
                            <button onClick={() => handleWAFollowupPeer(student)}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 transition"
                              title="Follow-up via WA (belum isi peer assessment)">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* WA Tanya Nilai */}
                          {canManageAll && agg && hasPhone && (
                            <button onClick={() => handleWAAskAboutScore(student)}
                              className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition"
                              title="Tanya nilai via WA">
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Hapus satu penilaian */}
                          {canManageAll && agg && agg.count > 0 && (
                            <button
                              onClick={() => {
                                if (agg.records.length === 1) handleDeleteOneAssessment(agg.records[0]);
                                else {
                                  const list = agg.records.map((r: any) => `${r.assessorName} (${CATEGORY_LABEL[(r as any).assessorCategory || 'REKAN']}): ${r.totalScore}`).join('\n');
                                  const pick = prompt(`Ada ${agg.count} penilaian:\n\n${list}\n\nKetik nama penilai yang mau dihapus:`);
                                  if (!pick) return;
                                  const t = agg.records.find((r: any) => r.assessorName === pick);
                                  if (t) handleDeleteOneAssessment(t);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition"
                              title="Hapus penilaian">
                              <Trash2 className="w-3.5 h-3.5" />
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
              {/* Auto score */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-200 dark:border-blue-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-black text-blue-900 dark:text-blue-200">
                    🤖 SKOR OTOMATIS
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

              {/* Manual scores */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    ✋ PENILAIAN MANUAL
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
                  placeholder="Berikan catatan konstruktif..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              {/* WA Quick Actions */}
              {selectedStudent.phone && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-2">
                    💬 Kirim WhatsApp ke {selectedStudent.displayName}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleWAFollowupPeer(selectedStudent)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> Follow-up Peer
                    </button>
                    <button type="button" onClick={() => handleWAAskAboutScore(selectedStudent)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Tanya Nilai
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between shrink-0">
              <button onClick={() => setIsGradingOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Batal
              </button>
              <button onClick={handleSaveAssessment} disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50">
                {isSubmitting ? 'Menyimpan...' : 'Simpan Penilaian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET */}
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
                ⚠️ Akan MENGHAPUS semua penilaian tahap <strong>{selectedStage}</strong>.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ketik nama kelas "<strong>{activeClass?.name}</strong>" untuk konfirmasi:
              </label>
              <input type="text" value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder={activeClass?.name} autoFocus
                className={`w-full px-3.5 py-2.5 rounded-xl border-2 font-semibold text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-800 transition ${
                  resetConfirmText.trim() === activeClass?.name ? 'border-emerald-500' : 'border-rose-200 dark:border-rose-500/40'
                }`} />
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => { setResetConfirmOpen(false); setResetConfirmText(''); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button onClick={handleResetStage}
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