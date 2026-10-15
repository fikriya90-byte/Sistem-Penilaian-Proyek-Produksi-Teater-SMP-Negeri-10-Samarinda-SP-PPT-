import React, { useState, useEffect } from 'react';
import { Award, Lock, Unlock, Search, Edit3, RefreshCw, AlertCircle, Timer, ListChecks, Clock, AlertTriangle, MessageCircle, Send, Download, Trash2, RotateCcw, ShieldAlert, Bot, ExternalLink, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { PEMERAN_CRITERIA, GENERAL_CRITERIA, SCORE_SCALE, STAGES, getAssessorWeights, getAssessmentMatrix, AUTO_SCORE_THRESHOLDS } from '../../core/constants';
import { AssessmentRecord, ProductionStage, UserProfile } from '../../core/types';
import { fetchUsersByClass, fetchAllUsers, recordAuditLog, saveAssessment, subscribeAssessments, subscribeAttendanceSessions, subscribeAllAttendanceRecords } from '../../services/firestoreService';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useToast } from '../common/Toast';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

// ✅ UPDATE: Label yang humanis untuk UI & Modal
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
  const [, setTick] = useState(0);

  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 30000); return () => clearInterval(t); }, []);

  const canManageAll = isGuruPengampu || isAdminRole;
  const canGradeStudent = (s: UserProfile) => canManageAll ? true : canAssessTarget(s);

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

  const criteria = selectedStudent?.role === 'Pemeran' ? PEMERAN_CRITERIA : GENERAL_CRITERIA;
  const manualCriteria = criteria.filter(c => c.source === 'MANUAL');

  const autoScoresFor = (s: UserProfile, st: ProductionStage) => {
    const t = computeTaskResponsibility(s, deadlines, submissions, st);
    const a = computeAttendance(s, sessions, attRecords, st);
    const auto: any = { tanggung_jawab: t.score, kehadiran: a.score };
    if (s.role === 'Pemeran') auto.kedisiplinan = Math.floor((t.score + a.score) / 2);
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
    return w > 0 ? Math.round((sum / w) * 10) / 10 : 80;
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

  // ✅ UPDATE: getPeerStatus mengambil list nama target yang belum dinilai
  const getPeerStatus = (s: UserProfile) => {
    const matrix = getAssessmentMatrix(s.role);
    const tr = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(c => { const r = matrix.find(x => x.category === c); if (r) r.roles.forEach(y => tr.add(y)); });
    
    const targets = students.filter(x => x.uid !== s.uid && tr.has(x.role));
    
    const assessedIds = new Set(assessments.filter(a => a.assessorId === s.uid && a.stage === selectedStage).map(a => a.studentId));
    const pendingTargets = targets.filter(t => !assessedIds.has(t.uid));
    const pendingNames = pendingTargets.map(t => t.displayName);
    
    const filled = targets.length - pendingTargets.length;
    
    return { 
      total: targets.length, 
      filled, 
      pct: targets.length > 0 ? Math.round((filled / targets.length) * 100) : 100, 
      isComplete: filled >= targets.length,
      pendingNames
    };
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
      
      if (!roleBreakUntuk menambahkan daftar nama siswa yang belum dinilai ke dalam pesan WhatsApp, Anda perlu memperbarui fungsi `getPeerStatus` untuk melacak siapa saja yang belum dinilai, lalu menggunakan data tersebut di dalam `handleWAPeer` dan `sendToSelected`.

Berikut adalah 3 bagian kode yang perlu Anda ubah:

**1. Perbarui `getPeerStatus`**
Ganti fungsi `getPeerStatus` yang ada dengan kode ini agar bisa mengekstrak nama-nama target yang belum dinilai:

```typescript
  const getPeerStatus = (s: UserProfile) => {
    const matrix = getAssessmentMatrix(s.role);
    const tr = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(c => { const r = matrix.find(x => x.category === c); if (r) r.roles.forEach(y => tr.add(y)); });
    const targets = students.filter(x => x.uid !== s.uid && tr.has(x.role));
    
    // Pisahkan yang sudah dan belum dinilai
    const filled = targets.filter(t => assessments.some(a => a.assessorId === s.uid && a.studentId === t.uid && a.stage === selectedStage)).length;
    const pendingNames = targets
      .filter(t => !assessments.some(a => a.assessorId === s.uid && a.studentId === t.uid && a.stage === selectedStage))
      .map(t => t.displayName);

    return { 
      total: targets.length, 
      filled, 
      pct: targets.length > 0 ? Math.round((filled / targets.length) * 100) : 100, 
      isComplete: filled >= targets.length,
      pendingNames // Tambahan properti baru
    };
  };
