import React, { useState, useEffect } from 'react';
import { Award, Lock, Unlock, Search, Edit3, RefreshCw, AlertCircle, Timer, ListChecks, Clock, AlertTriangle, MessageCircle, Send, Download, Trash2, RotateCcw, ShieldAlert, Bot, ExternalLink, CheckSquare, Square, X, UserCog, Info } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import {
  PEMERAN_CRITERIA, GENERAL_CRITERIA, SCORE_SCALE, STAGES,
  getAssessorWeights, getAssessmentMatrix, AUTO_SCORE_THRESHOLDS,
  normalizeUserRole, isPemeranRole, getAssessorCategoryFor, getCriteriaForRole,
} from '../../core/constants';
import { AssessmentRecord, ProductionStage, UserProfile } from '../../core/types';
import { fetchUsersByClass, fetchAllUsers, recordAuditLog, saveAssessment, subscribeAssessments, subscribeAttendanceSessions, subscribeAllAttendanceRecords } from '../../services/firestoreService';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useToast } from '../common/Toast';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

const CATEGORY_LABEL: Record<AssessorCategory, string> = {
  GURU: 'Guru Pengampu', ATASAN: 'Koordinator', REKAN: 'Rekan Kerja', BAWAHAN: 'Anggota Tim',
};

function buildISO(d: string, t: string): string {
  if (!d) return '';
  try { return new Date(`${d}T${t || '00:00'}:00`).toISOString(); } catch { return ''; }
}
function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WITA'; } catch { return '-'; }
}
function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}h ${h}j`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}
function buildWhatsAppUrl(phone: string, text: string): string {
  let c = (phone || '').replace(/\D/g, '');
  if (c.startsWith('0')) c = '62' + c.slice(1);
  return c ? `https://wa.me/${c}?text=${encodeURIComponent(text)}` : '#';
}

function isAssessmentOpen(sd: any, sid: ProductionStage) {
  const cfg = sd?.[sid];
  if (!cfg) return { open: false, reason: 'disabled' as const };
  const raw = cfg.assessmentEnabled;
  const isEnabled = raw === true || raw === 'true';
  if (!isEnabled) return { open: false, reason: 'disabled' as const };
  let sMs: number | undefined, eMs: number | undefined;
  if (cfg.assessmentStartDate) { const iso = buildISO(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00'); if (iso) sMs = new Date(iso).getTime(); }
  if (cfg.assessmentEndDate) { const iso = buildISO(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59'); if (iso) eMs = new Date(iso).getTime(); }
  const now = Date.now();
  if (sMs && !isNaN(sMs) && now < sMs) return { open: false, reason: 'not-started' as const, startMs: sMs, endMs: eMs };
  if (eMs && !isNaN(eMs) && now > eMs) return { open: false, reason: 'ended' as const, startMs: sMs, endMs: eMs };
  return { open: true, reason: 'open' as const, startMs: sMs, endMs: eMs };
}

function computeTaskResponsibility(student: UserProfile, deadlines: any[], subs: any[], stage: ProductionStage) {
  const myTasks = deadlines.filter(t => {
    if (t.stage && t.stage !== stage) return false;
    if (t.status === 'CANCELLED') return false;
    const sc = t.targetScope;
    if (sc === 'SEMUA') return true;
    if (sc === 'PERAN') return t.targetRole === student.role;
    if (sc === 'DIVISI') return t.targetDivision === student.divisionName;
    if (sc === 'CUSTOM') {
      const tr: string[] = t.targetRoles || [], td: string[] = t.targetDivisions || [], tu: string[] = t.targetUserIds || [];
      if (tr.length > 0 && tr.includes(student.role)) return true;
      if (td.length > 0 && student.divisionName && td.includes(student.divisionName)) return true;
      if (tu.length === 0) return true;
      return tu.includes(student.uid);
    }
    return false;
  });
  let awal = 0, tepat = 0, telatR = 0, telatB = 0, belum = 0, cLate = 0, cMiss = 0;
  myTasks.forEach(task => {
    const sub = subs.find(s => s.deadlineId === task.id && s.studentId === student.uid);
    const isCrit = !!task.isCritical;
    if (!sub || sub.status === 'BELUM') { belum++; if (isCrit) cMiss++; return; }
    if (sub.status === 'SELESAI' && sub.submittedAt) {
      const diff = Math.floor((new Date(sub.submittedAt).getTime() - new Date(task.dueDate).getTime()) / 86400000);
      if (diff <= -1) awal++;
      else if (diff === 0) tepat++;
      else if (diff <= 2) { telatR++; if (isCrit && diff > 1) cLate++; }
      else { telatB++; if (isCrit) cLate++; }
    } else if (sub.status === 'TERLAMBAT') { telatB++; if (isCrit) cLate++; }
  });
  const total = myTasks.length;
  if (total === 0) return { score: 4 as const, totalTasks: 0, pctOnTime: 100 };
  const pct = Math.round(((awal + tepat) / total) * 100);
  let score: 1|2|3|4 = 1;
  if (pct >= 90 && cLate === 0 && cMiss === 0) score = 4;
  else if (pct >= 75 && cLate <= 0) score = 3;
  else if (pct >= 50 && cMiss === 0) score = 2;
  if (cMiss > 0) score = 1;
  return { score, totalTasks: total, pctOnTime: pct };
}

function computeAttendance(student: UserProfile, sessions: any[], records: any[], stage: ProductionStage) {
  const stageSess = sessions.filter(s => !s.stageId || s.stageId === stage);
  const sIds = new Set(stageSess.map(s => s.id));
  const myRecs = records.filter(r => r.studentId === student.uid && sIds.has(r.sessionId));
  let h = 0, iz = 0, al = 0, fatal = false;
  myRecs.forEach(r => {
    if (r.status === 'Hadir') h++;
    else if (r.status === 'Izin' || r.status === 'Sakit') iz++;
    else if (r.status === 'Alpa') { al++; const s = stageSess.find(x => x.id === r.sessionId); if (s && (s.activityType === 'Gladi' || s.activityType === 'Pementasan')) fatal = true; }
  });
  const total = myRecs.length;
  if (total === 0) return { score: 4 as const, totalSessions: 0, pct: 100 };
  const pct = Math.round(((h + iz) / total) * 100);
  let score: 1|2|3|4 = 1;
  if (pct >= AUTO_SCORE_THRESHOLDS.attendance.excellent) score = 4;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.good) score = 3;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.fair) score = 2;
  if (al >= 3 || fatal) score = Math.min(score, 2) as any;
  return { score, totalSessions: total, pct };
}

interface Anomaly { record: AssessmentRecord; assessor?: UserProfile; target?: UserProfile; reason: string; severity: 'high'|'medium'|'low'; type: string; }

function detectAnomalies(assessments: AssessmentRecord[], students: UserProfile[], stage: ProductionStage): Anomaly[] {
  const out: Anomaly[] = [];
  const stageRecs = assessments.filter(a => a.stage === stage);
  const byStudent: Record<string, AssessmentRecord[]> = {};
  stageRecs.forEach(a => { if (!byStudent[a.studentId]) byStudent[a.studentId] = []; byStudent[a.studentId].push(a); });
  stageRecs.forEach(rec => {
    const sc = Object.values(rec.scores || {}).filter(v => typeof v === 'number');
    if (sc.length === 0) return;
    const assessor = students.find(s => s.uid === rec.assessorId);
    const target = students.find(s => s.uid === rec.studentId);
    if (sc.every(v => v === 1)) { out.push({ record: rec, assessor, target, reason: `Semua ${sc.length} kriteria diberi nilai 1 (Kurang)`, severity: 'high', type: 'Nilai Sangat Rendah' }); return; }
    if (sc.every(v => v === 4)) { out.push({ record: rec, assessor, target, reason: `Semua ${sc.length} kriteria diberi nilai 4 (Sangat Baik)`, severity: 'medium', type: 'Nilai Sangat Tinggi' }); return; }
    if (sc.every(v => v === sc[0]) && sc[0] !== 1 && sc[0] !== 4) { out.push({ record: rec, assessor, target, reason: `Semua kriteria diberi nilai ${sc[0]}`, severity: 'low', type: 'Nilai Seragam' }); return; }
    const same = (byStudent[rec.studentId] || []).filter(r => r.id !== rec.id);
    if (same.length >= 2) {
      const othersAvg = same.reduce((s, r) => s + r.totalScore, 0) / same.length;
      const diff = Math.abs(rec.totalScore - othersAvg);
      if (diff >= 25) out.push({ record: rec, assessor, target, reason: `Nilai (${rec.totalScore}) beda jauh dari rata-rata (${othersAvg.toFixed(1)}), selisih ${diff.toFixed(1)}`, severity: diff >= 35 ? 'high' : 'medium', type: 'Outlier vs Penilai Lain' });
    }
  });
  return out.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity]);
}

export const AssessmentModule: React.FC = () => {
  const { user, activeClass, isAdminRole, isGuruPengampu, canAssessTarget } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [attRecords, setAttRecords] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [stageConfig, setStageConfig] = useState<any>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);
  const [showCommentsFor, setShowCommentsFor] = useState<UserProfile | null>(null);
  
  // ✅ NEW: State untuk Detail & Edit Nilai Per Orang
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<UserProfile | null>(null);
  const [editingRecord, setEditingRecord] = useState<AssessmentRecord | null>(null);
  const [editRecordScore, setEditRecordScore] = useState<number>(80);
  const [editRecordComment, setEditRecordComment] = useState('');

  const [, setTick] = useState(0);

  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 30000); return () => clearInterval(t); }, []);

  const canManageAll = isGuruPengampu || isAdminRole;

  const canGradeStudent = (s: UserProfile) => {
    if (canManageAll) return true;
    if (!user || s.uid === user.uid) return false;
    if (canAssessTarget(s)) return true;
    const targetRole = normalizeUserRole(s.role);
    const matrix = getAssessmentMatrix(targetRole);
    return matrix.some(r => r.roles.includes(user.role));
  };

  useEffect(() => {
    if (!activeClass) { setStudents([]); setStudentsLoading(false); return; }
    setStudentsLoading(true);
    (async () => {
      try {
        let list: UserProfile[] = [];
        try { list = await fetchUsersByClass(activeClass.id); } catch {}
        if (!list || list.length === 0) {
          try {
            const all = await fetchAllUsers();
            const n = (activeClass.name || '').toLowerCase().trim();
            list = all.filter(u => u.classId === activeClass.id || (u.className || '').toLowerCase().trim() === n);
          } catch {}
        }
        setStudents(list.filter(s => !['Guru Pengampu','Guru Pembina','Admin','Super Admin'].includes(s.role)));
      } catch { setStudents([]); } finally { setStudentsLoading(false); }
    })();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const u1 = subscribeAssessments(activeClass.id, setAssessments);
    const q2 = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
    const u2 = onSnapshot(q2, snap => setDeadlines(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    const u3 = subscribeAttendanceSessions(activeClass.id, setSessions);
    const u4 = subscribeAllAttendanceRecords(activeClass.id, setAttRecords);
    let u5 = () => {};
    (async () => {
      const q = query(collection(db, 'deadlineSubmissions'), where('classId', '==', activeClass.id));
      u5 = onSnapshot(q, snap => setSubmissions(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    })();
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) { const d = snap.data(); setStageConfig(d); if (d.currentStage) setSelectedStage(d.currentStage); }
    });
    return () => unsub();
  }, [activeClass]);

  const isStageEnabled = (sid: ProductionStage) => {
    if (!stageConfig?.stageDeadlines) return true;
    const c = stageConfig.stageDeadlines[sid];
    if (!c) return true;
    const raw = c.enabled;
    if (raw === false || raw === 'false') return false;
    return true;
  };

  const isDirectDisabled = () => {
    const directCfg = stageConfig?.stageDeadlines?.[selectedStage];
    if (!directCfg) return false;
    const raw = directCfg.assessmentEnabled;
    const enabled = raw === true || raw === 'true';
    return !enabled;
  };

  const isStageLocked = !isStageEnabled(selectedStage);
  const aStatus = isAssessmentOpen(stageConfig?.stageDeadlines, selectedStage);
  const isAssessmentLocked = !aStatus.open;

  const criteria = getCriteriaForRole(selectedStudent?.role);
  const manualCriteria = criteria.filter(c => c.source === 'MANUAL');

  const autoScoresFor = (s: UserProfile, st: ProductionStage) => {
    const t = computeTaskResponsibility(s, deadlines, submissions, st);
    const a = computeAttendance(s, sessions, attRecords, st);
    const auto: any = { tanggung_jawab: t.score, kehadiran: a.score };
    if (isPemeranRole(s.role)) auto.kedisiplinan = Math.floor((t.score + a.score) / 2);
    return { auto, taskResult: t, attendResult: a };
  };

  const calcTotal = () => {
    if (!selectedStudent) return 0;
    const { auto } = autoScoresFor(selectedStudent, selectedStage);
    let sum = 0, w = 0;
    criteria.forEach(c => {
      let sc = 3;
      if (c.source === 'MANUAL') sc = manualScores[c.key] || 3;
      else {
        const k = c.source === 'AUTO_TASK' ? 'tanggung_jawab' : c.source === 'AUTO_ATTENDANCE' ? 'kehadiran' : c.source === 'AUTO_DISCIPLINE' ? 'kedisiplinan' : null;
        if (k) sc = auto[k] || 3;
      }
      sum += (SCORE_SCALE[sc]?.score100 || 80) * c.weight;
      w += c.weight;
    });
    let finalScore = w > 0 ? Math.round((sum / w) * 10) / 10 : 80;

    const taskScore = auto.tanggung_jawab;
    const disciplineScore = auto.kedisiplinan;

    if (taskScore === 1) {
      finalScore = Math.min(finalScore, 70);
    } else if (isPemeranRole(selectedStudent.role) && disciplineScore !== undefined && disciplineScore <= 2) {
      finalScore = Math.min(finalScore, 75);
    }

    return finalScore;
  };

  const getSafetyNetInfo = () => {
    if (!selectedStudent) return { active: false, cap: 100, reason: '' };
    const { auto } = autoScoresFor(selectedStudent, selectedStage);
    if (auto.tanggung_jawab === 1) {
      return { active: true, cap: 70, reason: 'Tugas tidak dikerjakan (Tanggung Jawab = 1)' };
    }
    if (isPemeranRole(selectedStudent.role) && auto.kedisiplinan !== undefined && auto.kedisiplinan <= 2) {
      return { active: true, cap: 75, reason: 'Kedisiplinan rendah (≤ 2)' };
    }
    return { active: false, cap: 100, reason: '' };
  };

  const getStudentTasks = (s: UserProfile) => {
    return deadlines.filter(t => {
      if (t.stage && t.stage !== selectedStage) return false;
      if (t.status === 'CANCELLED') return false;
      const sc = t.targetScope;
      if (sc === 'SEMUA') return true;
      if (sc === 'PERAN') return t.targetRole === s.role;
      if (sc === 'DIVISI') return t.targetDivision === s.divisionName;
      if (sc === 'CUSTOM') {
        const tr: string[] = t.targetRoles || [], td: string[] = t.targetDivisions || [], tu: string[] = t.targetUserIds || [];
        if (tr.length > 0 && tr.includes(s.role)) return true;
        if (td.length > 0 && s.divisionName && td.includes(s.divisionName)) return true;
        if (tu.length === 0) return true;
        return tu.includes(s.uid);
      }
      return false;
    }).map(t => {
      const sub = submissions.find(x => x.deadlineId === t.id && x.studentId === s.uid);
      const done = sub && (sub.status === 'SELESAI' || sub.status === 'TERLAMBAT');
      return { task: t, sub, done, label: done ? 'Selesai' : 'Belum' };
    });
  };

  const getPeerStatus = (s: UserProfile) => {
    const matrix = getAssessmentMatrix(s.role);
    const tr = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(c => { const r = matrix.find(x => x.category === c); if (r) r.roles.forEach(y => tr.add(y)); });
    const targets = students.filter(x => x.uid !== s.uid && tr.has(x.role));
    const filled = targets.filter(t => assessments.some(a => a.assessorId === s.uid && a.studentId === t.uid && a.stage === selectedStage)).length;
    return { total: targets.length, filled, pct: targets.length > 0 ? Math.round((filled / targets.length) * 100) : 100, isComplete: filled >= targets.length };
  };

  const getAgg = (sid: string, srole: string) => {
    const recs = assessments.filter(a => a.studentId === sid && a.stage === selectedStage);
    if (recs.length === 0) return null;

    const by: Record<string, number[]> = { GURU: [], ATASAN: [], REKAN: [], BAWAHAN: [] };
    const roleBreakdown: Record<string, Record<string, number[]>> = { GURU: {}, ATASAN: {}, REKAN: {}, BAWAHAN: {} };

    recs.forEach(r => {
      const c = (r as any).assessorCategory || 'REKAN';
      const role = r.assessorRole || 'Tidak Diketahui';

      if (!by[c]) by[c] = [];
      by[c].push(r.totalScore);

      if (!roleBreakdown[c]) roleBreakdown[c] = {};
      if (!roleBreakdown[c][role]) roleBreakdown[c][role] = [];
      roleBreakdown[c][role].push(r.totalScore);
    });

    const avg = (a: number[]) => a.length > 0 ? a.reduce((s, x) => s + x, 0) / a.length : null;
    const g = avg(by.GURU), at = avg(by.ATASAN), rk = avg(by.REKAN), bw = avg(by.BAWAHAN);
    const w = getAssessorWeights(srole);

    let sum = 0, wt = 0;
    if (g !== null && w.GURU > 0) { sum += g * w.GURU; wt += w.GURU; }
    if (at !== null && w.ATASAN > 0) { sum += at * w.ATASAN; wt += w.ATASAN; }
    if (rk !== null && w.REKAN > 0) { sum += rk * w.REKAN; wt += w.REKAN; }
    if (bw !== null && w.BAWAHAN > 0) { sum += bw * w.BAWAHAN; wt += w.BAWAHAN; }

    return { finalVal: wt > 0 ? Math.round((sum / wt) * 10) / 10 : 0, guru: g, atasan: at, rekan: rk, bawahan: bw, count: recs.length, records: recs, roleBreakdown };
  };

  const openGrading = (s: UserProfile) => {
    if (!canManageAll) {
      if (isDirectDisabled()) { showToast('Penilaian tahap ini dinonaktifkan oleh Guru.', 'error'); return; }
      if (isStageLocked) { showToast(`Tahap ${selectedStage} belum dibuka.`, 'warning'); return; }
      if (isAssessmentLocked) {
        if (aStatus.reason === 'not-started' && aStatus.startMs) showToast(`Dibuka dalam ${formatDuration(aStatus.startMs - Date.now())}.`, 'warning');
        else if (aStatus.reason === 'ended') showToast(`Sudah ditutup.`, 'warning');
        else if (aStatus.reason === 'disabled') showToast('Dinonaktifkan.', 'warning');
        else showToast('Belum dibuka.', 'warning');
        return;
      }
    }
    if (!canGradeStudent(s)) { showToast('Tidak berwenang.', 'warning'); return; }
    setSelectedStudent(s);
    const ex = assessments.find(a => a.assessorId === user?.uid && a.studentId === s.uid && a.stage === selectedStage);
    const init: Record<string, number> = {};
    const crit = getCriteriaForRole(s.role);
    crit.filter(c => c.source === 'MANUAL').forEach(c => {
      init[c.key] = (ex?.scores && ex.scores[c.key]) || 3;
    });
    setManualScores(init);
    setComment(ex?.comment || '');
    setIsGradingOpen(true);
  };

  const handleSave = async () => {
    if (!user || !selectedStudent || !activeClass) return;

    if (!canManageAll) {
      if (isDirectDisabled()) { showToast('Penilaian tahap ini dinonaktifkan. Tidak bisa menyimpan.', 'error'); return; }
      if (isStageLocked || isAssessmentLocked) { showToast('Penilaian terkunci.', 'warning'); return; }
    }

    const low = Object.values(manualScores).some(v => v <= 2);
    if (low && (!comment || comment.trim().length < 5)) { showToast('Komentar wajib bila ada nilai <= 2!', 'error'); return; }
    setIsSubmitting(true);
    try {
      const { auto } = autoScoresFor(selectedStudent, selectedStage);
      const total = calcTotal();

      let cat: AssessorCategory;
      if (canManageAll) {
        cat = 'GURU';
      } else {
        const foundCat = getAssessorCategoryFor(selectedStudent.role, user.role);
        if (!foundCat) {
          showToast('Anda tidak berwenang menilai siswa ini.', 'error');
          setIsSubmitting(false);
          return;
        }
        cat = foundCat;
      }

      await saveAssessment({
        classId: activeClass.id, productionId: 'prod',
        studentId: selectedStudent.uid, studentName: selectedStudent.displayName,
        studentRole: selectedStudent.role, studentDivision: selectedStudent.divisionName,
        assessorId: user.uid, assessorName: user.displayName, assessorRole: user.role,
        assessorCategory: cat, stage: selectedStage, scores: manualScores, autoScores: auto,
        totalScore: total, comment: comment.trim(), isFinal: true,
      } as any);

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'ASSESS', targetType: 'Assessment', targetId: selectedStudent.uid,
        details: `Nilai ${total} untuk ${selectedStudent.displayName} (${selectedStage}, kategori: ${cat}${canManageAll && (isStageLocked || isAssessmentLocked) ? ', BYPASS LOCK' : ''})`,
      });
      showToast(`Penilaian ${selectedStudent.displayName} disimpan!`, 'success');
      setIsGradingOpen(false);
    } catch (e: any) { showToast('Gagal: ' + e.message, 'error'); } finally { setIsSubmitting(false); }
  };

  // ✅ NEW: Handler untuk buka detail penilaian (siapa saja yang menilai)
  const openDetail = (s: UserProfile) => {
    setDetailStudent(s);
    setIsDetailOpen(true);
  };

  // ✅ NEW: Handler untuk edit nilai spesifik per orang
  const openEditRecord = (r: AssessmentRecord) => {
    setEditingRecord(r);
    setEditRecordScore(r.totalScore);
    setEditRecordComment(r.comment || '');
  };

  // ✅ NEW: Handler simpan edit nilai per orang
  const handleSaveRecord = async () => {
    if (!editingRecord || !user) return;
    try {
      await updateDoc(doc(db, 'assessments', editingRecord.id), {
        totalScore: editRecordScore,
        comment: editRecordComment.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName,
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Assessment', targetId: editingRecord.id,
        details: `Guru mengedit nilai ${editingRecord.studentName} yang diberikan oleh ${editingRecord.assessorName} (${editingRecord.assessorCategory}) dari ${editingRecord.totalScore} menjadi ${editRecordScore}`,
      });
      showToast('Nilai berhasil diperbarui!', 'success');
      setEditingRecord(null);
    } catch (e: any) { showToast('Gagal: ' + e.message, 'error'); }
  };

  const handleReset = async () => {
    if (!canManageAll || !activeClass || !user) return;
    if (resetConfirmText.trim() !== activeClass.name) { showToast('Nama kelas tidak cocok.', 'error'); return; }
    setIsResetting(true);
    try {
      const q = query(collection(db, 'assessments'), where('classId', '==', activeClass.id), where('stage', '==', selectedStage));
      const snap = await getDocs(q);
      if (snap.empty) { showToast('Tidak ada penilaian.', 'info'); setIsResetting(false); setResetConfirmOpen(false); setResetConfirmText(''); return; }
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        const hRef = doc(collection(db, 'assessmentHistory'));
        batch.set(hRef, { ...d.data(), id: hRef.id, originalId: d.id, supersededAt: new Date().toISOString(), supersededBy: user.uid, reason: `RESET ${selectedStage}` });
        batch.delete(d.ref);
      });
      await batch.commit();
      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'DELETE', targetType: 'AssessmentStageReset', targetId: activeClass.id, details: `RESET ${snap.size} penilaian ${selectedStage}` });
      showToast(`${snap.size} penilaian direset!`, 'success');
      setResetConfirmOpen(false); setResetConfirmText('');
    } catch (e: any) { showToast('Gagal: ' + e.message, 'error'); } finally { setIsResetting(false); }
  };

  const handleDeleteOne = async (r: AssessmentRecord) => {
    if (!canManageAll || !user) return;
    if (!confirm(`Hapus penilaian ${r.studentName} oleh ${r.assessorName}?`)) return;
    try {
      const hRef = doc(collection(db, 'assessmentHistory'));
      await writeBatch(db).set(hRef, { ...r, id: hRef.id, originalId: r.id, supersededAt: new Date().toISOString(), supersededBy: user.uid, reason: `Dihapus oleh ${user.displayName}` }).commit();
      await deleteDoc(doc(db, 'assessments', r.id));
      showToast('Penilaian dihapus.', 'info');
    } catch (e: any) { showToast('Gagal: ' + e.message, 'error'); }
  };

  const getMissingPeers = (s: UserProfile) => {
    const matrix = getAssessmentMatrix(s.role);
    const tr = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(c => { const r = matrix.find(x => x.category === c); if (r) r.roles.forEach(y => tr.add(y)); });
    return students.filter(x => x.uid !== s.uid && tr.has(x.role) && !assessments.some(a => a.assessorId === s.uid && a.studentId === x.uid && a.stage === selectedStage));
  };

  const buildPeerText = (s: UserProfile) => {
    const tn = user?.displayName || 'Guru', cn = activeClass?.name || 'IX';
    const missing = getMissingPeers(s);
    const list = missing.length > 0 ? missing.map((m, i) => `${i + 1}. ${m.displayName} (${m.role})`).join('\n') : '-';
    return `Halo ${s.displayName},\n\nSaya ${tn}, guru pengampu ${cn}.\n\nAnda belum mengisi penilaian rekan kerja untuk tahap ${selectedStage}. Yang belum Anda nilai:\n${list}\n\nMohon segera isi di web SP-PPT menu Penilaian.\n\nTerima kasih.`;
  };

  const buildAnomalyText = (an: Anomaly) => {
    const tn = user?.displayName || 'Guru', cn = activeClass?.name || 'IX';
    const assessorName = an.assessor?.displayName || an.record.assessorName;
    const targetName = an.target?.displayName || an.record.studentName;
    return `Halo ${assessorName},\n\nSaya ${tn}, guru pengampu ${cn}.\n\nMohon konfirmasi penilaian Anda untuk ${targetName} di tahap ${selectedStage} (total ${an.record.totalScore}).\nCatatan sistem: ${an.reason}.\n\nJika nilai tersebut sudah sesuai, silakan abaikan pesan ini. Jika ingin mengubah, mohon perbarui di web SP-PPT.\n\nTerima kasih.`;
  };

  const handleWAPeer = (s: UserProfile) => {
    if (!s.phone) { showToast(`${s.displayName} belum punya WA.`, 'warning'); return; }
    const text = buildPeerText(s);
    window.open(buildWhatsAppUrl(s.phone, text), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WA ke ${s.displayName}...`, 'info');
  };

  const handleWAScore = (s: UserProfile) => {
    if (!s.phone) { showToast(`${s.displayName} belum punya WA.`, 'warning'); return; }
    const tn = user?.displayName || 'Guru', cn = activeClass?.name || 'IX';
    const text = `Halo ${s.displayName},\n\nSaya ${tn}, guru pengampu ${cn}.\n\nKami ingin membahas nilai Anda di tahap ${selectedStage}.\n\nJika ada pertanyaan, silakan hubungi saya.\n\nTerima kasih.`;
    window.open(buildWhatsAppUrl(s.phone, text), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WA ke ${s.displayName}...`, 'info');
  };

  const handleWAAnomaly = (an: Anomaly) => {
    const ph = an.assessor?.phone;
    if (!ph) { showToast(`${an.assessor?.displayName || an.record.assessorName} belum punya WA.`, 'warning'); return; }
    window.open(buildWhatsAppUrl(ph, buildAnomalyText(an)), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WA ke ${an.assessor?.displayName || an.record.assessorName}...`, 'info');
  };

  const handleRekap = () => {
    const sheet1 = {
      name: 'Rekap Nilai',
      headers: ['Nama', 'Peran', 'Divisi', 'Peer', 'Guru', 'Koordinator', 'Rekan Kerja', 'Anggota Tim', 'Nilai Akhir'],
      rows: filtered.map(s => {
        const a = getAgg(s.uid, s.role); const p = getPeerStatus(s);
        return [s.displayName, s.role, s.divisionName || '-', `${p.filled}/${p.total}`, a?.guru?.toFixed(1) ?? '-', a?.atasan?.toFixed(1) ?? '-', a?.rekan?.toFixed(1) ?? '-', a?.bawahan?.toFixed(1) ?? '-', a?.finalVal ?? '-'];
      }),
    };
    const sheet2 = {
      name: 'Komentar',
      headers: ['Siswa', 'Penilai', 'Kategori', 'Nilai', 'Komentar'],
      rows: filtered.flatMap(s => assessments.filter(a => a.studentId === s.uid && a.stage === selectedStage).map(a => [s.displayName, a.assessorName, CATEGORY_LABEL[((a as any).assessorCategory as AssessorCategory) || 'REKAN'], a.totalScore, a.comment || '-'])),
    };
    exportMultiSheetXLSX(`Rekap_${activeClass?.name || 'Kelas'}_${selectedStage}_${new Date().toISOString().slice(0,10)}.xlsx`, [sheet1, sheet2]);
    showToast('Rekap diunduh!', 'success');
  };

  const filtered = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.displayName || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q) || (s.divisionName || '').toLowerCase().includes(q);
  });

  const stageCount = (sid: ProductionStage) => assessments.filter(a => a.stage === sid).length;
  const anomalies = canManageAll ? detectAnomalies(assessments, students, selectedStage) : [];
  const pendingPeers = canManageAll ? students.filter(s => { const p = getPeerStatus(s); return p.total > 0 && !p.isComplete; }) : [];

  if (!activeClass) {
    return <div className="p-8 rounded-3xl bg-amber-50 border-2 border-amber-300 text-center max-w-2xl mx-auto my-8"><AlertCircle className="w-16 h-16 mx-auto text-amber-600 mb-4" /><h3 className="text-base font-extrabold text-amber-900">Anda Belum Masuk ke Kelas</h3></div>;
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600"><Award className="w-7 h-7" /></span>
            <div>
              <h2 className="text-xl font-black text-slate-900">Penilaian 360</h2>
              <p className="text-xs text-slate-500">Auto-score + Manual 360</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRekap} className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Rekap</button>
            <button onClick={() => window.location.reload()} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700">Tahapan:</span>
            {stageConfig?.currentStage && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">Aktif: {stageConfig.currentStage}</span>}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {STAGES.map(s => {
              const en = isStageEnabled(s.id);
              const isA = selectedStage === s.id;
              const cnt = stageCount(s.id);
              const st = isAssessmentOpen(stageConfig?.stageDeadlines, s.id);
              return (
                <button key={s.id} onClick={() => setSelectedStage(s.id)} disabled={!en && !canManageAll}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${isA ? (en ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' : 'bg-rose-500 text-white shadow-md') : en ? 'bg-white text-slate-600 border border-slate-200' : 'bg-slate-100 text-slate-400 border opacity-60 cursor-not-allowed'}`}>
                  {!en && <Lock className="w-3 h-3" />}
                  {en && !st.open && <Award className="w-3 h-3 opacity-70" />}
                  {en && st.open && <Unlock className="w-3 h-3 opacity-70" />}
                  <span>{s.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isA ? 'bg-white/20' : 'bg-slate-200'}`}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!isAssessmentLocked && aStatus.endMs && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex items-start gap-2">
            <Timer className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900"><p className="font-bold">Penilaian TERBUKA, sisa {formatDuration(aStatus.endMs - Date.now())}</p><p className="mt-0.5">Ditutup: {formatDateTime(new Date(aStatus.endMs).toISOString())}</p></div>
          </div>
        )}
        {isAssessmentLocked && aStatus.reason === 'not-started' && aStatus.startMs && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 border-2 border-blue-300 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900"><p className="font-bold">Belum dibuka, dalam {formatDuration(aStatus.startMs - Date.now())}</p><p className="mt-0.5">{formatDateTime(new Date(aStatus.startMs).toISOString())}</p></div>
          </div>
        )}
        {isAssessmentLocked && aStatus.reason === 'ended' && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border-2 border-rose-300 flex items-start gap-2"><Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><div className="text-[11px] text-rose-900"><p className="font-bold">Penilaian sudah ditutup</p></div></div>
        )}
        {isAssessmentLocked && aStatus.reason === 'disabled' && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 border-2 border-slate-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" /><div className="text-[11px] text-slate-800"><p className="font-bold">Penilaian dinonaktifkan</p></div></div>
        )}

        {canManageAll && (isStageLocked || isAssessmentLocked) && (
          <div className="mt-3 p-3 rounded-xl bg-purple-50 border-2 border-purple-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-purple-900">
              <p className="font-bold">Mode Guru/Admin: Bypass Lock Aktif</p>
              <p className="mt-0.5 leading-relaxed">
                Anda tetap dapat <strong>mengisi dan mengedit nilai</strong> meskipun tahap atau jadwal penilaian sedang <strong>ditutup / dinonaktifkan</strong>. Aturan lock hanya berlaku untuk siswa dan penilai lain.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
          <ListChecks className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 leading-relaxed">
            <p className="font-bold">Mode Guru/Admin:</p>
            <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
              <li>Klik <strong>Nilai Akhir</strong> di tabel untuk melihat siapa saja yang menilai siswa.</li>
              <li>Klik <strong>Edit</strong> di modal detail untuk mengubah nilai spesifik dari penilai manapun (termasuk nilai dari siswa/rekan).</li>
            </ul>
          </div>
        </div>
      </div>

      {canManageAll && pendingPeers.length > 0 && (() => {
        const allSelected = pendingPeers.every(p => selectedPeerIds.includes(p.uid));
        const toggleAll = () => { if (allSelected) setSelectedPeerIds([]); else setSelectedPeerIds(pendingPeers.map(p => p.uid)); };
        const toggleOne = (uid: string) => { setSelectedPeerIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]); };
        const selectedList = pendingPeers.filter(p => selectedPeerIds.includes(p.uid));
        const selectedWithPhone = selectedList.filter(p => p.phone);

        const sendToSelected = () => {
          if (selectedList.length === 0) { showToast('Pilih minimal 1 siswa dulu.', 'warning'); return; }
          if (selectedWithPhone.length === 0) { showToast('Siswa yang dipilih tidak punya nomor WA.', 'warning'); return; }
          const noPhone = selectedList.length - selectedWithPhone.length;
          if (!confirm(`Kirim WA ke ${selectedWithPhone.length} siswa terpilih?` + (noPhone > 0 ? `\n\n(${noPhone} siswa di-skip karena tidak punya nomor WA)` : '') + `\n\nBrowser akan buka tab satu per satu.`)) return;
          selectedWithPhone.forEach((s, i) => {
            setTimeout(() => {
              const text = buildPeerText(s);
              window.open(buildWhatsAppUrl(s.phone || '', text), '_blank', 'noopener,noreferrer');
              if (i === selectedWithPhone.length - 1) {
                setTimeout(() => showToast(`Selesai. ${selectedWithPhone.length} siswa dibuka di WA.`, 'success'), 500);
              }
            }, i * 1200);
          });
          showToast(`Membuka ${selectedWithPhone.length} chat WhatsApp...`, 'info');
        };

        return (
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 shadow-md">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0"><AlertCircle className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-sm font-extrabold text-amber-900">{pendingPeers.length} Siswa Belum Isi Peer Assessment</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                    {selectedPeerIds.length > 0 ? `${selectedPeerIds.length} DIPILIH` : `TAHAP ${selectedStage}`}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed mb-3">
                  Centang siswa yang mau dikirimi WA, lalu klik <strong>Kirim ke Terpilih</strong>. Atau klik ikon WhatsApp hijau di tiap baris untuk kirim 1 orang saja.
                </p>

                <div className="flex items-center gap-2 flex-wrap mb-3 p-2 rounded-xl bg-white border border-amber-200">
                  <button onClick={toggleAll}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${allSelected ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 border border-amber-300'}`}>
                    {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {allSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                  </button>
                  {selectedPeerIds.length > 0 && (
                    <>
                      <span className="text-[10px] font-bold text-amber-800">{selectedPeerIds.length} dipilih</span>
                      <button onClick={() => setSelectedPeerIds([])} className="text-[10px] font-bold text-rose-600 hover:underline">Kosongkan</button>
                    </>
                  )}
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto mb-3">
                  {pendingPeers.map(s => {
                    const ps = getPeerStatus(s);
                    const isSelected = selectedPeerIds.includes(s.uid);
                    const hasPhone = !!s.phone;
                    return (
                      <div key={s.uid} className={`flex items-center gap-2 p-2 rounded-xl border transition ${isSelected ? 'bg-amber-50 border-amber-400' : 'bg-white border-amber-200'}`}>
                        <button onClick={() => toggleOne(s.uid)} className="p-0.5 shrink-0" title={isSelected ? 'Batal pilih' : 'Pilih'}>
                          {isSelected ? <CheckSquare className="w-5 h-5 text-amber-600" /> : <Square className="w-5 h-5 text-slate-400" />}
                        </button>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${ps.filled === 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>{s.displayName.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{s.displayName}</p>
                          <p className="text-[9px] text-slate-500">
                            {s.role} • <span className={ps.filled === 0 ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>{ps.filled}/{ps.total} peer</span>
                            {!hasPhone && <span className="text-slate-400 italic"> • no WA</span>}
                          </p>
                        </div>
                        {hasPhone ? (
                          <button onClick={() => handleWAPeer(s)} className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shrink-0" title={`Kirim WA langsung ke ${s.displayName}`}>
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic px-1 shrink-0">no WA</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={sendToSelected} disabled={selectedPeerIds.length === 0 || selectedWithPhone.length === 0}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {selectedPeerIds.length === 0 ? 'Pilih Siswa Dulu' : `Kirim ke ${selectedWithPhone.length} Terpilih`}
                  </button>
                  {selectedList.length > 0 && selectedWithPhone.length < selectedList.length && (
                    <span className="text-[10px] text-amber-700 italic">{selectedList.length - selectedWithPhone.length} siswa tanpa WA akan di-skip</span>
                  )}
                </div>

                <p className="text-[10px] text-amber-700 italic mt-2">Tip: nilai siswa terbuka otomatis setelah peer lengkap.</p>
              </div>
            </div>
          </div>
        );
      })()}

      {canManageAll && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><ShieldAlert className="w-4 h-4 text-rose-600" /> Aksi Khusus Guru/Admin</div>
          <button onClick={() => setResetConfirmOpen(true)} disabled={isStageLocked} className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Reset Nilai Tahap {selectedStage}</button>
        </div>
      )}

      {canManageAll && anomalies.length > 0 && (
        <div className="rounded-3xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50 overflow-hidden shadow-sm">
          <button onClick={() => setShowAnomalies(!showAnomalies)} className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-rose-100/50 transition">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-rose-500 text-white shrink-0"><AlertTriangle className="w-5 h-5" /></span>
              <div><h3 className="text-sm font-extrabold text-rose-900">{anomalies.length} Penilaian Perlu Klarifikasi</h3><p className="text-[11px] text-rose-700 mt-0.5">Deteksi nilai ekstrem atau outlier, hubungi penilai via WA</p></div>
            </div>
            <span className={`text-rose-600 transition-transform ${showAnomalies ? 'rotate-180' : ''}`}>v</span>
          </button>
          {showAnomalies && (
            <div className="p-4 pt-0 space-y-2 border-t border-rose-200">
              {anomalies.map((an, i) => {
                const sev = an.severity === 'high' ? 'border-rose-400 bg-rose-50' : an.severity === 'medium' ? 'border-amber-400 bg-amber-50' : 'border-blue-400 bg-blue-50';
                const sevB = an.severity === 'high' ? 'bg-rose-600 text-white' : an.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white';
                return (
                  <div key={i} className={`p-3 rounded-2xl border-2 ${sev}`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${sevB}`}>{an.severity.toUpperCase()}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-700 text-white">{an.type}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">{an.assessor?.displayName || an.record.assessorName} → {an.target?.displayName || an.record.studentName}</p>
                        <p className="text-[11px] text-slate-600 mt-1">{an.reason}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Total: <strong className="font-mono">{an.record.totalScore}</strong></p>
                        {an.record.comment && (
                          <p className="text-[11px] text-slate-700 italic mt-2 p-2 rounded-lg bg-white/70 border border-slate-200">
                            "{an.record.comment}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {an.assessor?.phone && <button onClick={() => handleWAAnomaly(an)} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WA Klarifikasi</button>}
                        <button onClick={() => handleDeleteOne(an.record)} className="p-1.5 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200"><Trash2 className="w-3.5 h-3.5" /></button>
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
          <input type="text" placeholder="Cari siswa atau peran..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
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
                <th className="py-3.5 px-4 text-center">Koordinator</th>
                <th className="py-3.5 px-4 text-center">Rekan Kerja</th>
                <th className="py-3.5 px-4 text-center">Anggota Tim</th>
                <th className="py-3.5 px-4 text-center">Nilai</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentsLoading ? (
                <tr><td colSpan={9} className="py-8 text-center text-xs text-slate-400"><RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" /> Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center"><AlertCircle className="w-8 h-8 mx-auto text-amber-400 mb-2" /><p className="text-xs font-bold text-slate-700">{students.length === 0 ? 'Data siswa tidak ter-load.' : 'Tidak ada yang cocok.'}</p></td></tr>
              ) : (
                filtered.map(s => {
                  const ag = getAgg(s.uid, s.role);
                  const cg = canGradeStudent(s) && (canManageAll || (!isStageLocked && !isAssessmentLocked));
                  const ps = getPeerStatus(s);
                  const commentCount = assessments.filter(a =>
                    a.studentId === s.uid &&
                    a.stage === selectedStage &&
                    a.comment && a.comment.trim()
                  ).length;
                  return (
                    <tr key={s.uid} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900">{s.displayName}</p>
                          {commentCount > 0 && (
                            <button
                              onClick={() => setShowCommentsFor(s)}
                              className="p-1 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 transition inline-flex items-center gap-0.5"
                              title={`Lihat ${commentCount} komentar penilai`}
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span className="text-[9px] font-black">{commentCount}</span>
                            </button>
                          )}
                        </div>
                        {s.phone && <p className="text-[9px] text-slate-400 font-mono">{s.phone}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600">{s.role}</td>
                      <td className="py-3.5 px-4 text-center">
                        {ps.total === 0 ? <span className="text-[10px] text-slate-400 italic">-</span> : ps.isComplete ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-300 inline-flex items-center gap-1"><CheckSquare className="w-3 h-3" />{ps.filled}/{ps.total}</span>
                        ) : (
                          <button onClick={() => handleWAPeer(s)} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${ps.filled === 0 ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-amber-100 text-amber-700 border-amber-300'} hover:brightness-95`} title={`WA follow-up ke ${s.displayName}`}>
                            <AlertTriangle className="w-3 h-3" />{ps.filled}/{ps.total}{s.phone && <MessageCircle className="w-3 h-3" />}
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">{ag?.guru != null ? ag.guru.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">{ag?.atasan != null ? ag.atasan.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">{ag?.rekan != null ? ag.rekan.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">{ag?.bawahan != null ? ag.bawahan.toFixed(1) : '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        {ag ? (
                          <button onClick={() => openDetail(s)} className="text-sm font-black text-blue-600 hover:text-blue-800 transition underline decoration-dotted underline-offset-2 flex items-center gap-1 mx-auto" title="Klik untuk melihat rincian & edit nilai">
                            {ag.finalVal}
                            <Edit3 className="w-3 h-3" />
                          </button>
                        ) : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {cg ? (
                            <button onClick={() => openGrading(s)} className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 ${
                              canManageAll && (isStageLocked || isAssessmentLocked)
                                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                                : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                            }`}>
                              <Edit3 className="w-3 h-3" /> {ag ? 'Edit' : 'Nilai'}
                              {canManageAll && (isStageLocked || isAssessmentLocked) && (
                                <Lock className="w-3 h-3 opacity-80" />
                              )}
                            </button>
                          ) : <span className="text-[11px] text-slate-400">{isStageLocked ? 'Tutup' : isAssessmentLocked ? 'Kunci' : canGradeStudent(s) ? 'Lihat' : 'Bukan penilai'}</span>}
                          {canManageAll && s.phone && <button onClick={() => handleWAScore(s)} className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100" title="WA tanya nilai"><Send className="w-3.5 h-3.5" /></button>}
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
                  <span className="text-xs font-bold text-amber-400 uppercase">Penilaian 360 • {selectedStage}</span>
                  <h3 className="text-lg font-black mt-0.5">{selectedStudent.displayName}</h3>
                  <p className="text-xs text-slate-400">{selectedStudent.role}{selectedStudent.divisionName ? ` • ${selectedStudent.divisionName}` : ''}</p>
                  {canManageAll && (isStageLocked || isAssessmentLocked) && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-500/50">
                      <ShieldAlert className="w-2.5 h-2.5" /> Bypass Lock Aktif
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Perkiraan</p>
                  <p className="text-3xl font-black text-amber-400 font-mono">{calcTotal()}</p>
                  {(() => {
                    const sn = getSafetyNetInfo();
                    if (!sn.active) return null;
                    return (
                      <p className="text-[9px] font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded mt-1 flex items-center gap-1 justify-end">
                        <ShieldAlert className="w-2.5 h-2.5" /> Dibatasi {sn.cap}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
                <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><ListChecks className="w-5 h-5 text-amber-600" /><h4 className="text-xs font-black text-amber-900 uppercase">Tugas Siswa ({selectedStage})</h4></div></div>
                {(() => {
                  const tl = getStudentTasks(selectedStudent);
                  if (tl.length === 0) return <div className="p-4 rounded-xl bg-white/70 border border-amber-200 text-center"><p className="text-xs text-amber-800 italic">Tidak ada tugas untuk peran <strong>{selectedStudent.role}</strong> di tahap ini.</p></div>;
                  return (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {tl.map((item, idx) => (
                        <div key={item.task.id || idx} className="p-3 rounded-xl bg-white border border-amber-200">
                          <div className="flex items-start gap-2">
                            <div className={`mt-0.5 shrink-0 ${item.done ? 'text-emerald-600' : 'text-rose-500'}`}>{item.done ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                {item.task.isCritical && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">KRITIS</span>}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${item.done ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>{item.label}</span>
                              </div>
                              <p className="text-xs font-bold text-slate-900 leading-snug">{item.task.title}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">Deadline: {new Date(item.task.dueDate).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              {(item.sub?.proofUrl || item.sub?.proofNote) && (
                                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                                  {item.sub.proofNote && <div className="p-2 rounded-lg bg-slate-50 text-[10px] italic">"{item.sub.proofNote}"</div>}
                                  {item.sub.proofUrl && <a href={item.sub.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"><ExternalLink className="w-2.5 h-2.5" /> Lihat Bukti</a>}
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

              {(() => {
                const { auto, taskResult, attendResult } = autoScoresFor(selectedStudent, selectedStage);
                return (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                    <div className="flex items-center gap-2 mb-3"><Bot className="w-4 h-4 text-blue-600" /><h4 className="text-xs font-black text-blue-900">SKOR OTOMATIS</h4></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-white border border-blue-200"><p className="text-[10px] font-bold text-blue-700">Tanggung Jawab</p><p className="text-2xl font-black text-blue-900 font-mono">{auto.tanggung_jawab}</p><p className="text-[9px] text-blue-600">{taskResult.pctOnTime}% tepat waktu</p></div>
                      <div className="p-3 rounded-xl bg-white border border-blue-200"><p className="text-[10px] font-bold text-blue-700">Kehadiran</p><p className="text-2xl font-black text-blue-900 font-mono">{auto.kehadiran}</p><p className="text-[9px] text-blue-600">{attendResult.pct}% hadir</p></div>
                      {isPemeranRole(selectedStudent.role) && <div className="p-3 rounded-xl bg-white border border-blue-200"><p className="text-[10px] font-bold text-blue-700">Kedisiplinan</p><p className="text-2xl font-black text-blue-900 font-mono">{auto.kedisiplinan}</p></div>}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const ag = getAgg(selectedStudent.uid, selectedStudent.role);
                if (!ag || ag.count === 0) return null;

                return (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-black text-slate-900 mb-3">RINCIAN NILAI DARI PIHAK LAIN</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(['ATASAN', 'REKAN', 'BAWAHAN', 'GURU'] as AssessorCategory[]).map(cat => {
                        const breakdown = ag.roleBreakdown[cat];
                        const roles = Object.keys(breakdown);
                        if (roles.length === 0) return null;

                        const avgCatKey = cat === 'ATASAN' ? 'atasan' : cat === 'BAWAHAN' ? 'bawahan' : cat === 'REKAN' ? 'rekan' : 'guru';
                        const avgCat = ag[avgCatKey] as number;

                        return (
                          <div key={cat} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-slate-700 uppercase">{CATEGORY_LABEL[cat]}</span>
                              <span className="text-xs font-black text-slate-900">{avgCat.toFixed(1)}</span>
                            </div>
                            <div className="space-y-1.5 pt-2 border-t border-slate-200">
                              {roles.map(role => {
                                const scores = breakdown[role];
                                const avgRole = scores.reduce((a, b) => a + b, 0) / scores.length;
                                return (
                                  <div key={role} className="flex justify-between items-center text-[10.5px]">
                                    <span className="text-slate-600 font-medium">{role} <span className="text-slate-400">({scores.length} orang)</span></span>
                                    <span className="font-bold text-slate-800">{avgRole.toFixed(1)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(() => {
                      const others = assessments.filter(a =>
                        a.studentId === selectedStudent.uid &&
                        a.stage === selectedStage &&
                        a.comment && a.comment.trim() &&
                        a.assessorId !== user?.uid
                      );
                      if (others.length === 0) return null;
                      return (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <p className="text-[10px] font-black text-slate-600 uppercase mb-2 flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" /> Komentar dari penilai lain ({others.length})
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {others.map((o, i) => {
                              const ocat = ((o as any).assessorCategory as AssessorCategory) || 'REKAN';
                              const catColor =
                                ocat === 'GURU' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                ocat === 'ATASAN' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                ocat === 'REKAN' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                'bg-purple-100 text-purple-800 border-purple-300';
                              return (
                                <div key={o.id || i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${catColor}`}>
                                      {CATEGORY_LABEL[ocat]}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-700">{o.assessorName}</span>
                                    <span className="text-[9px] font-bold text-slate-500 ml-auto font-mono">
                                      Nilai: {o.totalScore}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-700 italic">"{o.comment}"</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              <div>
                <h4 className="text-xs font-black text-slate-900 mb-3">PENILAIAN MANUAL</h4>
                <div className="space-y-3">
                  {manualCriteria.map(crit => {
                    const cur = manualScores[crit.key] || 3;
                    const si = SCORE_SCALE[cur];
                    return (
                      <div key={crit.key} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between"><div><span className="text-xs font-bold text-slate-900">{crit.label}</span><span className="text-[10px] text-slate-400 ml-2">Bobot: {crit.weight}%</span><p className="text-[11px] text-slate-500 mt-0.5">{crit.desc}</p></div><span className={`text-xs font-bold px-2 py-1 rounded-lg border ${si.badgeColor}`}>{cur} • {si.label}</span></div>
                        <input type="range" min="1" max="4" step="1" value={cur} onChange={(e) => setManualScores(prev => ({ ...prev, [crit.key]: parseInt(e.target.value) }))} className="w-full accent-amber-500" />
                        <div className="flex justify-between text-[10px] font-semibold text-slate-400"><span>1 Kurang</span><span>2 Cukup</span><span>3 Baik</span><span>4 Sangat Baik</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Komentar{Object.values(manualScores).some(v => v <= 2) && <span className="text-rose-500 ml-1">(Wajib karena ada nilai &lt;= 2)</span>}</label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Catatan konstruktif..." className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium" />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-between shrink-0">
              <button onClick={() => setIsGradingOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleSave} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* ✅ MODAL DETAIL & EDIT NILAI PER ORANG            */}
      {/* ================================================= */}
      {isDetailOpen && detailStudent && (() => {
        const ag = getAgg(detailStudent.uid, detailStudent.role);
        if (!ag) return null;
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black">Rincian & Edit Nilai</h3>
                    <p className="text-xs opacity-90">{detailStudent.displayName} ({detailStudent.role})</p>
                  </div>
                  <button onClick={() => setIsDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  Klik "Edit Nilai" untuk mengubah nilai spesifik dari penilai tersebut. Perubahan akan langsung memperbarui total nilai.
                </div>
                {ag.records.map(r => (
                  <div key={r.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{r.assessorName} <span className="text-[10px] text-slate-500 font-normal">({r.assessorRole})</span></p>
                      <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400 mb-1">{CATEGORY_LABEL[((r as any).assessorCategory as AssessorCategory) || 'REKAN']}</p>
                      <p className="text-xs italic text-slate-600 dark:text-slate-300">"{r.comment || '-'}"</p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end justify-center">
                      <p className="text-lg font-black font-mono text-slate-900 dark:text-white">{r.totalScore}</p>
                      <button onClick={() => openEditRecord(r)} className="mt-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-[10px] font-bold transition flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit Nilai
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
                <button onClick={() => setIsDetailOpen(false)} className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs">Tutup</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================================================= */}
      {/* ✅ MODAL EDIT NILAI SPESIFIK (PER ORANG)          */}
      {/* ================================================= */}
      {editingRecord && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCog className="w-4 h-4 text-blue-600" /> Edit Nilai Spesifik
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Mengubah nilai untuk <strong>{editingRecord.studentName}</strong> dari <strong>{editingRecord.assessorName}</strong>.
              </p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nilai (0 - 100)</label>
              <input 
                type="number" 
                min="0" max="100" 
                value={editRecordScore} 
                onChange={(e) => setEditRecordScore(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Komentar</label>
              <textarea 
                rows={3} 
                value={editRecordComment} 
                onChange={(e) => setEditRecordComment(e.target.value)}
                placeholder="Alasan perubahan nilai..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" 
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setEditingRecord(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button onClick={handleSaveRecord} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm">Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-rose-600" /><h3 className="text-base font-extrabold text-rose-900">Reset Penilaian {selectedStage}</h3></div>
            <p className="text-xs text-rose-800 leading-relaxed">Ini akan menghapus semua penilaian di tahap <strong>{selectedStage}</strong>. Tindakan tidak bisa dibatalkan.</p>
            <input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} placeholder={`Ketik "${activeClass?.name}" untuk konfirmasi`} autoFocus className={`w-full px-3.5 py-2.5 rounded-xl border-2 font-semibold text-sm ${resetConfirmText.trim() === activeClass?.name ? 'border-emerald-500' : 'border-rose-200'}`} />
            <div className="flex gap-2">
              <button onClick={() => { setResetConfirmOpen(false); setResetConfirmText(''); }} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleReset} disabled={isResetting || resetConfirmText.trim() !== activeClass?.name} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs disabled:opacity-40">{isResetting ? 'Mereset...' : 'Reset'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
