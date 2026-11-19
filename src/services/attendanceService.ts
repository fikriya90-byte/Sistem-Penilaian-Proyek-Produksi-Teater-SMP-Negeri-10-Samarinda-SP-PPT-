// src/services/attendanceService.ts
// ================================================
// Helper UI untuk modul absensi
// ================================================

import {
  getExpectedStudentsForSession,
} from './firestoreService';
import { UserProfile, AttendanceSession } from '../core/types';

// ================================================
// ROLE PERMISSIONS
// ================================================
export function canCreateGeneralSession(role: string): boolean {
  return ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
          'Pimpinan Produksi', 'Sekretaris'].includes(role);
}

export function canCreateRehearsalSession(role: string): boolean {
  return ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
          'Sutradara', 'Asisten Sutradara'].includes(role);
}

export function canCreateDivisionSession(role: string): boolean {
  return ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'].includes(role)
    || role.startsWith('Koordinator ');
}

export function canFillOnBehalf(role: string): boolean {
  return ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
          'Pimpinan Produksi', 'Sekretaris'].includes(role);
}

// ================================================
// FILTER SESSIONS
// ================================================
export function filterSessionsForUser(
  sessions: AttendanceSession[],
  user: UserProfile | null
): AttendanceSession[] {
  if (!user) return [];
  if (['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
       'Pimpinan Produksi', 'Sekretaris'].includes(user.role)) {
    return sessions;
  }
  return sessions.filter(s => {
    const scope = (s as any).targetScope || 'SEMUA';
    if (scope === 'SEMUA') return true;
    if (scope === 'PEMAIN_MUSIK') {
      return user.role === 'Pemeran' ||
             user.role === 'Sutradara' ||
             user.role === 'Asisten Sutradara' ||
             user.divisionName === 'Tata Musik & Suara';
    }
    if (scope === 'PENGURUS_INTI' || scope === 'PIMPINAN') {
      return ['Pimpinan Produksi', 'Sekretaris', 'Bendahara'].includes(user.role);
    }
    if (scope === 'DIVISI') return (s as any).targetDivision === user.divisionName;
    if (scope === 'PERAN') return (s as any).targetRole === user.role;
    if (scope === 'CUSTOM') {
      const tr = (s as any).targetRoles || [];
      const td = (s as any).targetDivisions || [];
      const tu = (s as any).targetUserIds || [];
      return tr.includes(user.role) ||
             td.includes(user.divisionName) ||
             tu.includes(user.uid);
    }
    return true;
  });
}

// ================================================
// ROSTER
// ================================================
export function getAttendanceRoster(
  session: AttendanceSession,
  allUsers: UserProfile[],
  existingRecords: Array<{ studentId: string; status: string }>
): Array<{
  student: UserProfile;
  currentStatus: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa' | 'BELUM';
}> {
  const students = allUsers.filter(u =>
    !['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'].includes(u.role)
  );
  const expected = getExpectedStudentsForSession(session, students);
  const recordMap = new Map(existingRecords.map(r => [r.studentId, r.status]));

  return expected
    .map(student => ({
      student,
      currentStatus: (recordMap.get(student.uid) || 'BELUM') as any,
    }))
    .sort((a, b) => a.student.displayName.localeCompare(b.student.displayName));
}

// ================================================
// STATISTIK
// ================================================
export function summarizeAttendance(
  roster: Array<{ currentStatus: string }>
): { total: number; hadir: number; izin: number; sakit: number; alpa: number; belum: number } {
  const summary = { total: roster.length, hadir: 0, izin: 0, sakit: 0, alpa: 0, belum: 0 };
  roster.forEach(r => {
    if (r.currentStatus === 'Hadir') summary.hadir++;
    else if (r.currentStatus === 'Izin') summary.izin++;
    else if (r.currentStatus === 'Sakit') summary.sakit++;
    else if (r.currentStatus === 'Alpa') summary.alpa++;
    else summary.belum++;
  });
  return summary;
}
