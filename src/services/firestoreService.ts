// src/services/firestoreService.ts
import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../core/firebase';
import {
  AssessmentRecord, AttendanceRecord, AttendanceSession, AuditLogItem,
  BroadcastMessage, ClassRoom, ProductionDocument, ProductionProject,
  PromptBookScene, ScheduleEvent, StudentComplaint, SystemNotification,
  TaskItem, UserProfile,
} from '../core/types';
import { normalizeUserRole } from '../core/constants';

// ✅ FUNGSI SAKTI: Mencegah error "Unsupported field value: undefined"
function sanitizeData<T extends Record<string, any>>(data: T): T {
  const cleaned: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== null) {
      cleaned[key] = data[key];
    }
  }
  return cleaned as T;
}

const ROLE_DIV_MAP: Record<string, { id: string; name: any }> = {
  'Pimpinan Produksi': { id: 'div-inti', name: 'Pengurus Inti' },
  'Sekretaris': { id: 'div-inti', name: 'Pengurus Inti' },
  'Bendahara': { id: 'div-inti', name: 'Pengurus Inti' },
  'Sutradara': { id: 'div-pemain', name: 'Pemeran' },
  'Asisten Sutradara': { id: 'div-pemain', name: 'Pemeran' },
  'Pemain': { id: 'div-pemain', name: 'Pemeran' },
  'Pemeran': { id: 'div-pemain', name: 'Pemeran' },
  'Koordinator Perlengkapan': { id: 'div-perlengkapan', name: 'Perlengkapan' },
  'Anggota Perlengkapan': { id: 'div-perlengkapan', name: 'Perlengkapan' },
  'Koordinator Publikasi': { id: 'div-pubdok', name: 'Publikasi & Dokumentasi' },
  'Anggota Publikasi': { id: 'div-pubdok', name: 'Publikasi & Dokumentasi' },
  'Koordinator Tata Panggung': { id: 'div-panggung', name: 'Tata Panggung' },
  'Anggota Tata Panggung': { id: 'div-panggung', name: 'Tata Panggung' },
  'Koordinator Tata Rias': { id: 'div-rias', name: 'Tata Rias' },
  'Anggota Tata Rias': { id: 'div-rias', name: 'Tata Rias' },
  'Koordinator Tata Busana': { id: 'div-busana', name: 'Tata Busana' },
  'Anggota Tata Busana': { id: 'div-busana', name: 'Tata Busana' },
  'Koordinator Tata Musik': { id: 'div-musik', name: 'Tata Musik & Suara' },
  'Anggota Tata Musik': { id: 'div-musik', name: 'Tata Musik & Suara' },
};

function enrichUser(u: UserProfile): UserProfile {
  const normalizedRole = normalizeUserRole(u.role);
  const mapped = ROLE_DIV_MAP[normalizedRole];
  return {
    ...u,
    role: normalizedRole,
    divisionId: u.divisionId || mapped?.id || '',
    divisionName: u.divisionName || mapped?.name || 'Pemeran',
    classIds: Array.isArray(u.classIds) ? u.classIds : (u.classId ? [u.classId] : []),
  };
}

export async function fetchUsersByClass(classId: string): Promise<UserProfile[]> {
  const path = 'users';
  const found: Record<string, UserProfile> = {};
  let className: string | null = null;
  try {
    const classSnap = await getDoc(doc(db, 'classes', classId));
    if (classSnap.exists()) className = classSnap.data().name || null;
  } catch (err) { }

  try {
    const allSnap = await getDocs(collection(db, path));
    allSnap.docs.forEach(d => {
      const u = { ...d.data(), uid: d.id } as UserProfile;
      const matchId = u.classId === classId;
      const matchIdsArray = Array.isArray(u.classIds) && u.classIds.includes(classId);
      const matchName = className && ((u.className || '').toLowerCase().trim() === className.toLowerCase().trim());
      if (matchId || matchIdsArray || matchName) {
        found[d.id] = enrichUser({
          ...u, classId: u.classId || classId,
          classIds: Array.isArray(u.classIds) && u.classIds.length > 0 ? u.classIds : (u.classId ? [u.classId] : [classId]),
          className: u.className || className || '',
        });
      }
    });
  } catch (err) { }
  return Object.values(found).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

export async function fetchAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => enrichUser({ ...d.data(), uid: d.id } as UserProfile));
  } catch (error) { handleFirestoreError(error, OperationType.LIST, 'users'); }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return enrichUser({ ...snap.data(), uid: snap.id } as UserProfile);
  } catch (error) { handleFirestoreError(error, OperationType.GET, `users/${uid}`); }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), sanitizeData({ ...data, updatedAt: new Date().toISOString() }));
  } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`); }
}

export async function fetchClasses(): Promise<ClassRoom[]> {
  try {
    const snap = await getDocs(collection(db, 'classes'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClassRoom)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) { handleFirestoreError(error, OperationType.LIST, 'classes'); }
}

// ==========================================
// ATTENDANCE (PRESENSI)
// ==========================================
export function subscribeAttendanceSessions(classId: string, onUpdate: (sessions: AttendanceSession[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, 'attendanceSessions'), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceSession));
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onUpdate(list);
  }, error => { if (onError) onError(error); });
}

export async function createAttendanceSession(session: Omit<AttendanceSession, 'id'>): Promise<string> {
  try {
    const newRef = doc(collection(db, 'attendanceSessions'));
    const payload = sanitizeData({ ...session, id: newRef.id, createdAt: new Date().toISOString() });
    await setDoc(newRef, payload);
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'attendanceSessions'); }
}

export async function closeAttendanceSession(sessionId: string): Promise<void> {
  try { await updateDoc(doc(db, 'attendanceSessions', sessionId), { isOpen: false }); }
  catch (error) { handleFirestoreError(error, OperationType.UPDATE, `attendanceSessions/${sessionId}`); }
}

export function subscribeAttendanceRecords(sessionId: string, onUpdate: (records: AttendanceRecord[]) => void) {
  const q = query(collection(db, 'attendanceRecords'), where('sessionId', '==', sessionId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord))));
}

export function subscribeAllAttendanceRecords(classId: string, onUpdate: (records: AttendanceRecord[]) => void) {
  const q = query(collection(db, 'attendanceRecords'), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord))));
}

export async function submitAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<void> {
  try {
    const recId = `${record.sessionId}_${record.studentId}`;
    const payload = sanitizeData({ ...record, id: recId, timestamp: new Date().toISOString() });
    await setDoc(doc(db, 'attendanceRecords', recId), payload, { merge: true });
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'attendanceRecords'); }
}

// ==========================================
// LAINNYA (Disederhanakan agar bersih)
// ==========================================
export function subscribeDeadlinesByClass(classId: string, onUpdate: (d: any[]) => void) {
  return onSnapshot(query(collection(db, 'deadlines'), where('classId', '==', classId)), snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
}

export function subscribeDeadlineSubmissionsByClass(classId: string, onUpdate: (s: any[]) => void) {
  return onSnapshot(query(collection(db, 'deadlineSubmissions'), where('classId', '==', classId)), snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
}

export function subscribeSchedules(classId: string, onUpdate: (s: ScheduleEvent[]) => void) {
  return onSnapshot(query(collection(db, 'schedules'), where('classId', '==', classId)), snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleEvent))));
}

export async function createSchedule(event: Omit<ScheduleEvent, 'id'>): Promise<string> {
  try {
    const newRef = doc(collection(db, 'schedules'));
    await setDoc(newRef, sanitizeData({ ...event, id: newRef.id, createdAt: new Date().toISOString() }));
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'schedules'); }
}

export function subscribeNotifications(userId: string, onUpdate: (n: SystemNotification[]) => void) {
  return onSnapshot(query(collection(db, 'notifications'), where('userId', '==', userId)), snap => {
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemNotification));
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    onUpdate(items);
  });
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  try { await updateDoc(doc(db, 'notifications', notifId), { read: true }); } catch (e) {}
}

export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    return snap.size;
  } catch (error) { return 0; }
}

export async function recordAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> {
  try {
    const newRef = doc(collection(db, 'auditLogs'));
    await setDoc(newRef, sanitizeData({ ...log, id: newRef.id, timestamp: log.timestamp || new Date().toISOString() }));
  } catch (error) {}
} 