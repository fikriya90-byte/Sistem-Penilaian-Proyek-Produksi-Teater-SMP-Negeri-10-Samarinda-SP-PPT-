import React, { useState, useEffect } from 'react';
import {
  Award, Lock, Unlock, Search, Edit3, RefreshCw, AlertCircle, Timer,
  ListChecks, Clock, AlertTriangle, MessageCircle, Send, Download, Trash2,
  RotateCcw, ShieldAlert, Bot, ExternalLink, CheckSquare, Square, X,
  UserCog, Info,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import {
  SCORE_SCALE, STAGES, getAssessorWeights, getAssessmentMatrix,
  normalizeUserRole, isPemeranRole, getAssessorCategoryFor, getCriteriaForRole,
} from '../../core/constants';
import { AssessmentRecord, ProductionStage, UserProfile } from '../../core/types';
import {
  fetchUsersByClass, fetchAllUsers, recordAuditLog, saveAssessment,
  subscribeAssessments, subscribeAttendanceSessions, subscribeAllAttendanceRecords,
} from '../../services/firestoreService';
import { computeTaskResponsibility, computeAttendanceScore } from '../../services/autoScoreService';
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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<UserProfile | null>(null);
  const [editingRecord, setEditingRecord] = useState<AssessmentRecord | null>(null);
  const [editRecordScore, setEditRecordScore] = useState<number>(80);
  const [editRecordComment, setEditRecordComment] = useState('');

  const [, setTick] = useState(0);

  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 30000); return () => clearInterval(t); }, []);

  const canManageAll = isGuruPengampu || isAdminRole;

  const canGradeStudent = (s: UserProfile) => {
    if (!user) return false;
    if (user.role === 'Admin' || user.role === 'Super Admin') return true;
    if (s.uid === user.uid) return false;
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
        try { list = await fetchUsersByClass(activeClass.id); } catch { /* ignore */ }
        if (!list || list.length === 0) {
          try {
            const all = await fetchAllUsers();
            const n = (activeClass.name || '').toLowerCase().trim();
            list = all.filter(u => u.classId === activeClass.id || (u.className || '').toLowerCase().trim() === n);
          } catch { /* ignore */ }
        }
        setStudents(list.filter(s => !['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'].includes(s.role)));
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
    const task = computeTaskResponsibility(s, deadlines, submissions, st);
    const attend = computeAttendanceScore(s, sessions, attRecords, st);
    const auto: any = { tanggung_jawab: task.score, kehadiran: attend.score };
    if (isPemeranRole(s.role)) auto.kedisiplinan = Math.floor((task.score + attend.score) / 2);
    return { auto, taskResult: task, attendResult: attend };
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
    recs.forEach(r => {
      const c = (r as any).assessorCategory || 'REKAN';
      if (!by[c]) by[c] = [];
      by[c].push(r.totalScore);
    });

    const avg = (a: number[]) => a.length > 0 ? a.reduce((s, x) => s + x, 0) / a.length : null;
    const g = avg(by.GURU), at = avg(by.ATASAN), rk = avg(by.REKAN), bw = avg(by.BAWAHAN);
    const w = getAssessorWeights(srole);

    let sum = 0, wt = 0;
    if (g !== null && w.GURU > 0) { sum += g * w.GURU; wt += w.GURU; }
    if (at !== null && w.ATASAN > 0) { sum += at * w.ATASAN; wt += w.ATASAN; }
    if (rk !== null && w.REKAN > 0) { sum += rk * w.REKAN; wt += w.REKAN; }
    if (bw !== null && w.BAWAHAN > 0) { sum += bw * w.BAWAHAN; wt += w.BAWAHAN; }

    return { finalVal: wt > 0 ? Math.round((sum / wt) * 10) / 10 : 0, guru: g, atasan: at, rekan: rk, bawahan: bw, count: recs.length, records: recs };
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

  const openDetail = (s: UserProfile) => {
    setDetailStudent(s);
    setIsDetailOpen(true);
  };

  const openEditRecord = (r: AssessmentRecord) => {
    if (!canManageAll) {
      showToast('Hanya Guru/Admin yang dapat mengedit nilai spesifik.', 'warning');
      return;
    }
    setEditingRecord(r);
    setEditRecordScore(r.totalScore);
    setEditRecordComment(r.comment || '');
  };

  const handleSaveRecord = async () => {
    if (!editingRecord || !user) return;
    if (!canManageAll) {
      showToast('Akses ditolak. Hanya Guru/Admin yang dapat mengubah nilai.', 'error');
      return;
    }
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
        details: `Guru mengedit nilai ${editingRecord.studentName} dari ${editingRecord.totalScore} menjadi ${editRecordScore}`,
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
    return `Halo ${assessorName},\n\nSaya ${tn}, guru pengampu ${cn}.\n\nMohon konfirmasi penilaian Anda untuk ${targetName} di tahap ${selectedStage} (total ${an.record.totalScore}).\nCatatan sistem: ${an.reason}.\n\nJika nilai tersebut sudah sesuai, silakan abaikan pesan ini.\n\nTerima kasih.`;
  };

  const handleWAPeer = (s: UserProfile) => {
    if (!s.phone) { showToast(`${s.displayName} belum punya WA.`, 'warning'); return; }
    window.open(buildWhatsAppUrl(s.phone, buildPeerText(s)), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WA ke ${s.displayName}...`, 'info');
  };

  const handleWAAnomaly = (an: Anomaly) => {
    const ph = an.assessor?.phone;
    if (!ph) { showToast(`${an.assessor?.displayName || an.record.assessorName} belum punya WA.`, 'warning'); return; }
    window.open(buildWhatsAppUrl(ph, buildAnomalyText(an)), '_blank', 'noopener,noreferrer');
    showToast(`Membuka WA...`, 'info');
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
    exportMultiSheetXLSX(`Rekap_${activeClass?.name || 'Kelas'}_${selectedStage}_${new Date().toISOString().slice(0, 10)}.xlsx`, [sheet1, sheet2]);
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
    return (
      <div className="p-8 rounded-3xl bg-amber-50 border-2 border-amber-300 text-center max-w-2xl mx-auto my-8">
        <AlertCircle className="w-16 h-16 mx-auto text-amber-600 mb-4" />
        <h3 className="text-base font-extrabold text-amber-900">Anda Belum Masuk ke Kelas</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600"><Award className="w-7 h-7" /></span>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Penilaian 360</h2>
              <p className="text-xs text-slate-500">Auto-score + Manual 360</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRekap} className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Rekap</button>
            <button onClick={() => window.location.reload()} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tahapan:</span>
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
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${isA ? (en ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md' : 'bg-rose-500 text-white shadow-md') : en ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border opacity-60 cursor-not-allowed'}`}>
                  {!en && <Lock className="w-3 h-3" />}
                  {en && !st.open && <Award className="w-3 h-3 opacity-70" />}
                  {en && st.open && <Unlock className="w-3 h-3 opacity-70" />}
                  <span>{s.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isA ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!isAssessmentLocked && aStatus.endMs && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-300 dark:border-emerald-500/40 flex items-start gap-2">
            <Timer className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200"><p className="font-bold">Penilaian TERBUKA, sisa {formatDuration(aStatus.endMs - Date.now())}</p><p className="mt-0.5">Ditutup: {formatDateTime(new Date(aStatus.endMs).toISOString())}</p></div>
          </div>
        )}
        {isAssessmentLocked && aStatus.reason === 'not-started' && aStatus.startMs && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-300 dark:border-blue-500/40 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 dark:text-blue-200"><p className="font-bold">Belum dibuka, dalam {formatDuration(aStatus.startMs - Date.now())}</p><p className="mt-0.5">{formatDateTime(new Date(aStatus.startMs).toISOString())}</p></div>
          </div>
        )}
        {isAssessmentLocked && aStatus.reason === 'ended' && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 flex items-start gap-2"><Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><div className="text-[11px] text-rose-900 dark:text-rose-200"><p className="font-bold">Penilaian sudah ditutup</p></div></div>
        )}
        {isAssessmentLocked && aStatus.reason === 'disabled' && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" /><div className="text-[11px] text-slate-800 dark:text-slate-200"><p className="font-bold">Penilaian dinonaktifkan</p></div></div>
        )}

        {canManageAll && (isStageLocked || isAssessmentLocked) && (
          <div className="mt-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border-2 border-purple-300 dark:border-purple-500/40 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-purple-900 dark:text-purple-200">
              <p className="font-bold">Mode Guru/Admin: Bypass Lock Aktif</p>
              <p className="mt-0.5 leading-relaxed">Anda tetap dapat <strong>mengisi dan mengedit nilai</strong> meskipun tahap atau jadwal penilaian sedang <strong>ditutup / dinonaktifkan</strong>.</p>
            </div>
          </div>
        )}
      </div>

      {/* PENDING PEERS */}
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
          if (!confirm(`Kirim WA ke ${selectedWithPhone.length} siswa terpilih?` + (noPhone > 0 ? `\n\n(${noPhone} siswa di-skip karena tidak punya nomor WA)` : ''))) return;
          selectedWithPhone.forEach((s, i) => {
            setTimeout(() => {
              window.open(buildWhatsAppUrl(s.phone || '', buildPeerText(s)), '_blank', 'noopener,noreferrer');
              if (i === selectedWithPhone.length - 1) {
                setTimeout(() => showToast(`Selesai. ${selectedWithPhone.length} siswa dibuka di WA.`, 'success'), 500);
              }
            }, i * 1200);
          });
          showToast(`Membuka ${selectedWithPhone.length} chat WhatsApp...`, 'info');
        };

        return (
          <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-300 dark:border-amber-500/40 shadow-md">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0"><AlertCircle className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">{pendingPeers.length} Siswa Belum Isi Peer Assessment</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                    {selectedPeerIds.length > 0 ? `${selectedPeerIds.length} DIPILIH` : `TAHAP ${selectedStage}`}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed mb-3">
                  Centang siswa yang mau dikirimi WA, lalu klik <strong>Kirim ke Terpilih</strong>.
                </p>

                <div className="flex items-center gap-2 flex-wrap mb-3 p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/40">
                  <button onClick={toggleAll}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${allSelected ? 'bg-amber-500 text-white' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40'}`}>
                    {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    {allSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                  </button>
                  {selectedPeerIds.length > 0 && (
                    <>
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200">{selectedPeerIds.length} dipilih</span>
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
                      <div key={s.uid} className={`flex items-center gap-2 p-2 rounded-xl border transition ${isSelected ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500/60' : 'bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-500/40'}`}>
                        <button onClick={() => toggleOne(s.uid)} className="p-0.5 shrink-0">
                          {isSelected ? <CheckSquare className="w-5 h-5 text-amber-600" /> : <Square className="w-5 h-5 text-slate-400" />}
                        </button>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${ps.filled === 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>{s.displayName.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{s.displayName}</p>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400">
                            {s.role} • <span className={ps.filled === 0 ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>{ps.filled}/{ps.total} peer</span>
                          </p>
                        </div>
                        {hasPhone ? (
                          <button onClick={() => handleWAPeer(s)} className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shrink-0" title={`Kirim WA ke ${s.displayName}`}>
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic px-1 shrink-0">no WA</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button onClick={sendToSelected} disabled={selectedPeerIds.length === 0 || selectedWithPhone.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {selectedPeerIds.length === 0 ? 'Pilih Siswa Dulu' : `Kirim ke ${selectedWithPhone.length} Terpilih`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RESET BUTTON */}
      {canManageAll && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><ShieldAlert className="w-4 h-4 text-rose-600" /> Aksi Khusus Guru/Admin</div>
          <button onClick={() => setResetConfirmOpen(true)} disabled={isStageLocked} className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Reset Nilai Tahap {selectedStage}</button>
        </div>
      )}

      {/* ANOMALIES */}
      {canManageAll && anomalies.length > 0 && (
        <div className="rounded-3xl border-2 border-rose-300 dark:border-rose-500/40 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-500/10 dark:to-orange-500/10 overflow-hidden shadow-sm">
          <button onClick={() => setShowAnomalies(!showAnomalies)} className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-rose-100/50 dark:hover:bg-rose-500/10 transition">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-rose-500 text-white shrink-0"><AlertTriangle className="w-5 h-5" /></span>
              <div><h3 className="text-sm font-extrabold text-rose-900 dark:text-rose-200">{anomalies.length} Penilaian Perlu Klarifikasi</h3><p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">Deteksi nilai ekstrem atau outlier</p></div>
            </div>
            <span className={`text-rose-600 transition-transform ${showAnomalies ? 'rotate-180' : ''}`}>v</span>
          </button>
          {showAnomalies && (
            <div className="p-4 pt-0 space-y-2 border-t border-rose-200 dark:border-rose-500/30">
              {anomalies.map((an, i) => {
                const sev = an.severity === 'high' ? 'border-rose-400 bg-rose-50 dark:bg-rose-500/10' : an.severity === 'medium' ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-blue-400 bg-blue-50 dark:bg-blue-500/10';
                const sevB = an.severity === 'high' ? 'bg-rose-600 text-white' : an.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white';
                return (
                  <div key={i} className={`p-3 rounded-2xl border-2 ${sev}`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${sevB}`}>{an.severity.toUpperCase()}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-700 text-white">{an.type}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{an.assessor?.displayName || an.record.assessorName} → {an.target?.displayName || an.record.studentName}</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{an.reason}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Total: <strong className="font-mono">{an.record.totalScore}</strong></p>
                        {an.record.comment && (
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 italic mt-2 p-2 rounded-lg bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">"{an.record.comment}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {an.assessor?.phone && <button onClick={() => handleWAAnomaly(an)} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1"><MessageCircle className="w-3 h-3" /> WA Klarifikasi</button>}
                        <button onClick={() => handleDeleteOne(an.record)} className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-500/30"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEARCH */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari siswa atau peran..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {studentsLoading ? (
                <tr><td colSpan={9} className="py-8 text-center text-xs text-slate-400"><RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" /> Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center"><AlertCircle className="w-8 h-8 mx-auto text-amber-400 mb-2" /><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{students.length === 0 ? 'Data siswa tidak ter-load.' : 'Tidak ada yang cocok.'}</p></td></tr>
              ) : (
                filtered.map(s => {
                  const ag = getAgg(s.uid, s.role);
                  const cg = canGradeStudent(s) && (canManageAll || (!isStageLocked && !isAssessmentLocked));
                  const ps = getPeerStatus(s);

                  return (
                    <tr key={s.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 text-xs">
                            {s.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{s.displayName}</p>
                            <p className="text-[10px] text-slate-400">{s.divisionName || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[10px] font-bold ${ps.isComplete ? 'text-emerald-600' : ps.filled === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                          {ps.filled}/{ps.total}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {ag?.guru?.toFixed(1) ?? '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {ag?.atasan?.toFixed(1) ?? '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {ag?.rekan?.toFixed(1) ?? '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {ag?.bawahan?.toFixed(1) ?? '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {ag ? (
                          <span className={`text-xs font-black font-mono ${ag.finalVal >= 90 ? 'text-amber-600' : ag.finalVal >= 80 ? 'text-blue-600' : ag.finalVal >= 70 ? 'text-emerald-600' : ag.finalVal >= 60 ? 'text-orange-600' : 'text-rose-600'}`}>
                            {ag.finalVal.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => cg ? openGrading(s) : showToast(isStageLocked || isAssessmentLocked ? 'Penilaian terkunci.' : 'Tidak berwenang.', 'warning')}
                            disabled={!cg}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] disabled:opacity-40 disabled:cursor-not-allowed">
                            {canGradeStudent(s) ? (ag ? 'Edit' : 'Nilai') : 'Lock'}
                          </button>
                          <button onClick={() => openDetail(s)} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Detail">
                            <Info className="w-3.5 h-3.5" />
                          </button>
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
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm"><Award className="w-6 h-6" /></span>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-90">Form Penilaian</span>
                    <h3 className="text-lg font-black mt-0.5">{selectedStudent.displayName}</h3>
                    <p className="text-[11px] opacity-90">{selectedStudent.role} • {selectedStage}</p>
                  </div>
                </div>
                <button onClick={() => setIsGradingOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* AUTO SCORE PREVIEW */}
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase mb-2 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> Skor Otomatis (dari sistem)</p>
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const { auto } = autoScoresFor(selectedStudent, selectedStage);
                    return Object.entries(auto).map(([k, v]) => (
                      <div key={k} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{k.replace('_', ' ')}</p>
                        <p className={`text-lg font-black font-mono mt-0.5 ${SCORE_SCALE[v as number]?.badgeColor?.split(' ')[0] || ''}`}>{v}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* MANUAL CRITERIA */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Kriteria Manual</p>
                {manualCriteria.map(c => (
                  <div key={c.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{c.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{c.desc}</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{c.weight}%</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map(v => (
                        <button key={v} type="button"
                          onClick={() => setManualScores({ ...manualScores, [c.key]: v })}
                          className={`py-2 rounded-lg text-xs font-bold transition ${manualScores[c.key] === v ? 'bg-amber-500 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* COMMENT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Komentar {Object.values(manualScores).some(v => v <= 2) && <span className="text-rose-500">* WAJIB (ada nilai ≤ 2)</span>}
                </label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Tulis alasan jika ada nilai di bawah standar, atau catatan positif..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              {/* TOTAL PREVIEW */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-300 dark:border-amber-500/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">Perkiraan Nilai Akhir:</span>
                  <span className="text-xl font-black text-amber-900 dark:text-amber-100 font-mono">{calcTotal()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button onClick={() => setIsGradingOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Batal</button>
              <button onClick={handleSave} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5">
                {isSubmitting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</> : <><Send className="w-3.5 h-3.5" /> Simpan Penilaian</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL */}
      {isDetailOpen && detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase opacity-90">Detail Penilaian</span>
                  <h3 className="text-lg font-black mt-0.5">{detailStudent.displayName}</h3>
                  <p className="text-[11px] opacity-90">{detailStudent.role} • {selectedStage}</p>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {(() => {
                const recs = assessments.filter(a => a.studentId === detailStudent.uid && a.stage === selectedStage);
                if (recs.length === 0) {
                  return (
                    <div className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-xs text-slate-500">Belum ada penilaian untuk siswa ini di tahap {selectedStage}.</p>
                    </div>
                  );
                }
                return recs.map(r => {
                  const cat = (r as any).assessorCategory || 'REKAN';
                  return (
                    <div key={r.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{r.assessorName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{r.assessorRole} • {CATEGORY_LABEL[cat as AssessorCategory]}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{r.totalScore}</span>
                          {canManageAll && (
                            <button onClick={() => openEditRecord(r)} className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/30">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canManageAll && (
                            <button onClick={() => handleDeleteOne(r)} className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-500/30">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {r.comment && <p className="text-[11px] italic text-slate-600 dark:text-slate-400 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">"{r.comment}"</p>}
                      {r.autoScores && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {Object.entries(r.autoScores).map(([k, v]) => (
                            <span key={k} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                              {k.replace('_', ' ')}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setIsDetailOpen(false)} className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT RECORD */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" /> Edit Nilai
              </h3>
              <button onClick={() => setEditingRecord(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">{editingRecord.studentName}</p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">oleh {editingRecord.assessorName} • Nilai lama: {editingRecord.totalScore}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nilai Baru (0-100)</label>
              <input type="number" min="0" max="100" value={editRecordScore} onChange={(e) => setEditRecordScore(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Komentar</label>
              <textarea rows={3} value={editRecordComment} onChange={(e) => setEditRecordComment(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setEditingRecord(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button onClick={handleSaveRecord} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET CONFIRM */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-300 dark:border-rose-500/40 my-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" /> Reset Nilai Tahap {selectedStage}
              </h3>
              <button onClick={() => { setResetConfirmOpen(false); setResetConfirmText(''); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
                <strong>PERINGATAN!</strong> Semua {stageCount(selectedStage)} penilaian di tahap <strong>{selectedStage}</strong> akan dihapus dan tidak bisa dikembalikan. Data lama akan diarsipkan ke riwayat.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ketik <strong className="text-rose-600">{activeClass?.name}</strong> untuk konfirmasi:
              </label>
              <input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setResetConfirmOpen(false); setResetConfirmText(''); }} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button onClick={handleReset} disabled={isResetting || resetConfirmText.trim() !== activeClass?.name}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                {isResetting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menghapus...</> : <><Trash2 className="w-3.5 h-3.5" /> Hapus Semua</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
