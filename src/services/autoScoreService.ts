// src/services/autoScoreService.ts
import { AttendanceRecord, AttendanceSession, DeadlineSubmission, ProductionStage, TaskItem, UserProfile } from '../core/types';
import { AUTO_SCORE_THRESHOLDS } from '../core/constants';

// =====================================================
// SKOR TANGGUNG JAWAB (4.3) — FIX
// =====================================================
export interface TaskResponsibilityResult {
  score: 1 | 2 | 3 | 4;
  totalTasks: number;
  awal: number;
  tepat: number;
  telatRingan: number;
  telatBerat: number;
  belum: number;
  pctOnTime: number;
  criticalLate: number;
  criticalMissed: number;
  details: Array<{ taskId: string; title: string; status: string; dueDate: string }>;
}

export function computeTaskResponsibility(
  student: UserProfile,
  tasks: TaskItem[],
  submissions: DeadlineSubmission[],
  stage: ProductionStage
): TaskResponsibilityResult {
  const myTasks = tasks.filter(t => {
    const tStage = (t as any).stage ?? (t as any).stageId;
    if (tStage && tStage !== stage) return false;
    if (t.status === 'CANCELLED') return false;

    const scope = (t as any).targetScope;
    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return (t as any).targetRole === student.role;
    if (scope === 'DIVISI') return (t as any).targetDivision === student.divisionName;
    if (scope === 'CUSTOM') {
      const tr = (t as any).targetRoles || [];
      const td = (t as any).targetDivisions || [];
      const tu = (t as any).targetUserIds || [];
      if (tr.length > 0 && tr.includes(student.role)) return true;
      if (td.length > 0 && student.divisionName && td.includes(student.divisionName)) return true;
      if (tu.length > 0) return tu.includes(student.uid);
      return true;
    }

    // Legacy fallback
    return (
      t.assigneeId === student.uid ||
      (t as any).targetRole === student.role ||
      (t as any).targetDivision === student.divisionName ||
      t.assigneeName === 'Semua Siswa' ||
      t.assigneeName === 'Semua Anggota Divisi'
    );
  });

  let awal = 0, tepat = 0, telatRingan = 0, telatBerat = 0, belum = 0;
  let criticalLate = 0, criticalMissed = 0;
  const details: TaskResponsibilityResult['details'] = [];

  myTasks.forEach(task => {
    const sub = submissions.find(s => s.deadlineId === task.id && s.studentId === student.uid);
    const isCritical = !!task.isCritical;

    if (!sub || sub.status === 'BELUM') {
      belum += 1;
      if (isCritical) criticalMissed += 1;
      details.push({ taskId: task.id, title: task.title, status: 'BELUM', dueDate: task.dueDate });
      return;
    }

    if (sub.status === 'SELESAI' && sub.submittedAt) {
      const dueMs = new Date(task.dueDate).getTime();
      const subMs = new Date(sub.submittedAt).getTime();
      const diffDays = Math.floor((subMs - dueMs) / 86400000);

      if (diffDays <= -1) {
        awal += 1;
        details.push({ taskId: task.id, title: task.title, status: 'AWAL', dueDate: task.dueDate });
      } else if (diffDays === 0) {
        tepat += 1;
        details.push({ taskId: task.id, title: task.title, status: 'TEPAT', dueDate: task.dueDate });
      } else if (diffDays <= 2) {
        telatRingan += 1;
        if (isCritical && diffDays > 1) criticalLate += 1;
        details.push({ taskId: task.id, title: task.title, status: 'TELAT_RINGAN', dueDate: task.dueDate });
      } else {
        telatBerat += 1;
        if (isCritical) criticalLate += 1;
        details.push({ taskId: task.id, title: task.title, status: 'TELAT_BERAT', dueDate: task.dueDate });
      }
    } else if (sub.status === 'TERLAMBAT') {
      telatBerat += 1;
      if (isCritical) criticalLate += 1;
      details.push({ taskId: task.id, title: task.title, status: 'TELAT_BERAT', dueDate: task.dueDate });
    }
  });

  const totalTasks = myTasks.length;

  // ✅ FIX: kalau tidak ada task → netral (3), bukan 4
  if (totalTasks === 0) {
    return {
      score: 3, totalTasks: 0,
      awal: 0, tepat: 0, telatRingan: 0, telatBerat: 0, belum: 0,
      pctOnTime: 0, criticalLate: 0, criticalMissed: 0, details: [],
    };
  }

  const onTime = awal + tepat;
  const pctOnTime = Math.round((onTime / totalTasks) * 100);

  let score: 1 | 2 | 3 | 4;
  if (pctOnTime >= 90 && criticalLate === 0 && criticalMissed === 0) {
    score = 4;
  } else if (pctOnTime >= 75 && criticalLate <= 0) {
    score = 3;
  } else if (pctOnTime >= 50 && criticalMissed === 0) {
    score = 2;
  } else if (pctOnTime >= 50 && criticalLate > 1) {
    score = 2;
  } else {
    score = 1;
  }

  if (criticalMissed > 0) score = 1;

  return {
    score, totalTasks, awal, tepat, telatRingan, telatBerat, belum,
    pctOnTime, criticalLate, criticalMissed, details,
  };
}

// =====================================================
// SKOR KEHADIRAN (4.4) — FIX
// =====================================================
export interface AttendanceResult {
  score: 1 | 2 | 3 | 4;
  totalSessions: number;
  hadir: number;
  izinSakit: number;
  alpa: number;
  pct: number;
  hasFatalAlpa: boolean;
}

export function computeAttendanceScore(
  student: UserProfile,
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  stage: ProductionStage
): AttendanceResult {
  // ✅ FIX 1: filter KETAT by stage
  const stageSessions = sessions.filter(s => {
    const sStage = (s as any).stage ?? (s as any).stageId;
    return sStage === stage;
  });

  const sessionIds = new Set(stageSessions.map(s => s.id));
  const myRecords = records.filter(r =>
    r.studentId === student.uid && sessionIds.has(r.sessionId)
  );

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

  const totalSessions = stageSessions.length;
  const totalMyRecords = myRecords.length;

  // ✅ FIX 2: tidak ada session di tahap ini → NETRAL (3)
  if (totalSessions === 0) {
    return {
      score: 3, totalSessions: 0,
      hadir: 0, izinSakit: 0, alpa: 0,
      pct: 0, hasFatalAlpa: false,
    };
  }

  // ✅ FIX 3: ada session tapi siswa tidak record sama sekali → ALPA semua
  if (totalMyRecords === 0) {
    return {
      score: 1, totalSessions,
      hadir: 0, izinSakit: 0, alpa: totalSessions,
      pct: 0, hasFatalAlpa: true,
    };
  }

  const effectiveHadir = hadir + izinSakit;
  const pct = Math.round((effectiveHadir / totalSessions) * 100);

  let score: 1 | 2 | 3 | 4;
  if (pct >= AUTO_SCORE_THRESHOLDS.attendance.excellent) score = 4;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.good) score = 3;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.fair) score = 2;
  else score = 1;

  if (alpa >= 3 || hasFatalAlpa) score = Math.min(score, 2) as any;

  return { score, totalSessions, hadir, izinSakit, alpa, pct, hasFatalAlpa };
}

// =====================================================
// KEDISIPLINAN PEMERAN
// =====================================================
export function computePemeranDiscipline(taskScore: number, attendScore: number): 1 | 2 | 3 | 4 {
  const avg = (taskScore + attendScore) / 2;
  return Math.floor(avg) as 1 | 2 | 3 | 4;
}
