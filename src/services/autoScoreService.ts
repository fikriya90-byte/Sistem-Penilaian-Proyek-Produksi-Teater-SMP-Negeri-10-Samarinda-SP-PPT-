// =====================================================
// AUTO SCORE SERVICE
// Hitung skor otomatis: Tanggung Jawab, Kehadiran, Kedisiplinan
// dari data Tasks & Attendance. Sesuai Section 4.3, 4.4, 5.3
// =====================================================

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../core/firebase';
import {
  AttendanceRecord, AttendanceSession, DeadlineItem, DeadlineSubmission,
  ProductionStage, TaskItem, UserProfile,
} from '../core/types';
import { AUTO_SCORE_THRESHOLDS } from '../core/constants';

// =====================================================
// HITUNG SKOR TANGGUNG JAWAB (4.3)
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
  // Filter tugas untuk siswa ini & tahap ini
  const myTasks = tasks.filter(t => {
    if ((t as any).stageId && (t as any).stageId !== stage) return false;
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
    const isCritical = !!task.isCritical || (task as any).isCritical === true;

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
  if (totalTasks === 0) {
    return {
      score: 4, totalTasks: 0, awal: 0, tepat: 0, telatRingan: 0, telatBerat: 0, belum: 0,
      pctOnTime: 100, criticalLate: 0, criticalMissed: 0, details: [],
    };
  }

  const onTime = awal + tepat;
  const pctOnTime = Math.round((onTime / totalTasks) * 100);

  // Skor sesuai tabel 4.3
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

  // Override: tugas kritis tidak dikerjakan → 1
  if (criticalMissed > 0) score = 1;

  return {
    score, totalTasks, awal, tepat, telatRingan, telatBerat, belum,
    pctOnTime, criticalLate, criticalMissed, details,
  };
}

// =====================================================
// HITUNG SKOR KEHADIRAN (4.4)
// =====================================================
export interface AttendanceResult {
  score: 1 | 2 | 3 | 4;
  totalSessions: number;
  hadir: number;
  izinSakit: number;
  alpa: number;
  pct: number;
  hasFatalAlpa: boolean; // Alpa pada Gladi/Pementasan
}

export function computeAttendanceScore(
  student: UserProfile,
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  stage: ProductionStage
): AttendanceResult {
  // Filter sesi di tahap ini
  const stageSessions = sessions.filter(s => {
    // Sesuaikan dengan field stage jika ada
    if ((s as any).stageId && (s as any).stageId !== stage) return false;
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
    return { score: 4, totalSessions: 0, hadir: 0, izinSakit: 0, alpa: 0, pct: 100, hasFatalAlpa: false };
  }

  const effectiveHadir = hadir + izinSakit;
  const pct = Math.round((effectiveHadir / totalSessions) * 100);

  let score: 1 | 2 | 3 | 4;
  if (pct >= AUTO_SCORE_THRESHOLDS.attendance.excellent) score = 4;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.good) score = 3;
  else if (pct >= AUTO_SCORE_THRESHOLDS.attendance.fair) score = 2;
  else score = 1;

  // Batas maksimal 2 jika alpa ≥3 atau alpa di Gladi/Pementasan
  if (alpa >= 3 || hasFatalAlpa) score = Math.min(score, 2) as any;

  return { score, totalSessions, hadir, izinSakit, alpa, pct, hasFatalAlpa };
}

// =====================================================
// HITUNG KEDISIPLINAN PEMERAN (rata-rata 4.3 & 4.4)
// =====================================================
export function computePemeranDiscipline(taskScore: number, attendScore: number): 1 | 2 | 3 | 4 {
  const avg = (taskScore + attendScore) / 2;
  return Math.floor(avg) as 1 | 2 | 3 | 4;
}
