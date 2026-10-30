// src/services/firestoreService.ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../core/firebase';
import {
  AssessmentRecord,
  AttendanceRecord,
  AttendanceSession,
  AuditLogItem,
  BroadcastMessage,
  ClassRoom,
  ProductionDocument,
  ProductionProject,
  PromptBookScene,
  ScheduleEvent,
  StudentComplaint,
  SystemNotification,
  TaskItem,
  UserProfile,
} from '../core/types';
import { normalizeUserRole } from '../core/constants';

// ==========================================
// ✅ FUNGSI SAKTI: PENCEGAH ERROR UNDEFINED
// ==========================================
function sanitizeData<T extends Record<string, any>>(data: T): T {
  const cleaned: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== null) {
      cleaned[key] = data[key];
    }
  }
  return cleaned as T;
}

// ==========================================
// ROLE → DIVISI MAPPING
// ==========================================
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

// ==========================================
// USERS
// ==========================================
export async function fetchUsersByClass(classId: string): Promise<UserProfile[]> {
  const path = 'users';
  const found: Record<string, UserProfile> = {};
  let className: string | null = null;
  try {
    const classSnap = await getDoc(doc(db, 'classes', classId));
    if (classSnap.exists()) className = classSnap.data().name || null;
  } catch (err) { console.warn('fetchUsersByClass: gagal ambil nama kelas:', err); }

  try {
    const allSnap = await getDocs(collection(db, path));
    allSnap.docs.forEach(d => {
      const u = { ...d.data(), uid: d.id } as UserProfile;
      const matchId = u.classId === classId;
      const matchIdsArray = Array.isArray(u.classIds) && u.classIds.includes(classId);
      const matchName = className && ((u.className || '').toLowerCase().trim() === className.toLowerCase().trim());
      if (matchId || matchIdsArray || matchName) {
        found[d.id] = enrichUser({
          ...u,
          classId: u.classId || classId,
          classIds: Array.isArray(u.classIds) && u.classIds.length > 0 ? u.classIds : (u.classId ? [u.classId] : [classId]),
          className: u.className || className || '',
        });
      }
    });
  } catch (err) { console.error('fetchUsersByClass PRIMARY gagal:', err); }

  if (Object.keys(found).length === 0) {
    try {
      const q = query(collection(db, path), where('classId', '==', classId));
      const snap = await getDocs(q);
      snap.docs.forEach(d => { found[d.id] = enrichUser({ ...d.data(), uid: d.id } as UserProfile); });
    } catch (err) { }
  }

  try {
    const q2 = query(collection(db, path), where('classIds', 'array-contains', classId));
    const snap2 = await getDocs(q2);
    snap2.docs.forEach(d => { if (!found[d.id]) found[d.id] = enrichUser({ ...d.data(), uid: d.id } as UserProfile); });
  } catch (err) { }

  if (Object.keys(found).length === 0 && className) {
    try {
      const q = query(collection(db, path), where('className', '==', className));
      const snap = await getDocs(q);
      snap.docs.forEach(d => { found[d.id] = enrichUser({ ...d.data(), uid: d.id } as UserProfile); });
    } catch (err) { }
  }

  return Object.values(found).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

export async function repairUsersForClass(classId: string, className: string): Promise<{ fixed: number; total: number }> {
  let fixed = 0, total = 0;
  try {
    const allSnap = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);
    allSnap.docs.forEach(d => {
      const u = d.data();
      total++;
      const matchName = (u.className || '').toLowerCase().trim() === className.toLowerCase().trim();
      const matchId = u.classId === classId;
      const matchIdsArray = Array.isArray(u.classIds) && u.classIds.includes(classId);
      if (matchName || matchId || matchIdsArray) {
        if (u.classId !== classId || u.className !== className) {
          batch.update(d.ref, { classId, className, updatedAt: new Date().toISOString() });
          fixed++;
        }
      }
    });
    if (fixed > 0) await batch.commit();
  } catch (err) { console.error('repairUsersForClass error:', err); throw err; }
  return { fixed, total };
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
// PRODUCTION
// ==========================================
export async function fetchProductionByClass(classId: string): Promise<ProductionProject | null> {
  try {
    const q = query(collection(db, 'productions'), where('classId', '==', classId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { ...snap.docs[0].data(), id: snap.docs[0].id } as ProductionProject;
  } catch (error) { handleFirestoreError(error, OperationType.GET, 'productions'); }
}

export async function updateProductionStage(prodId: string, stage: any): Promise<void> {
  try {
    await updateDoc(doc(db, 'productions', prodId), { currentStage: stage, updatedAt: new Date().toISOString() });
  } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `productions/${prodId}`); }
}

// ==========================================
// TASKS
// ==========================================
export function subscribeTasksByClass(classId: string, onUpdate: (tasks: TaskItem[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, 'tasks'), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    const tasks = snap.docs.map(d => ({ ...d.data(), id: d.id } as TaskItem));
    const now = new Date().getTime();
    onUpdate(tasks.map(t => (t.status !== 'APPROVED' && new Date(t.dueDate).getTime() < now) ? { ...t, status: 'OVERDUE' as const } : t));
  }, error => { if (onError) onError(error); handleFirestoreError(error, OperationType.LIST, 'tasks'); });
}

export async function createTask(task: Omit<TaskItem, 'id'>): Promise<string> {
  try {
    const newRef = doc(collection(db, 'tasks'));
    await setDoc(newRef, sanitizeData({ ...task, id: newRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'tasks'); }
}

export async function updateTask(taskId: string, data: Partial<TaskItem>): Promise<void> {
  try { await updateDoc(doc(db, 'tasks', taskId), sanitizeData({ ...data, updatedAt: new Date().toISOString() })); }
  catch (error) { handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`); }
}

export async function deleteTask(taskId: string): Promise<void> {
  try { await deleteDoc(doc(db, 'tasks', taskId)); }
  catch (error) { handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`); }
}

// ==========================================
// DEADLINES
// ==========================================
export function subscribeDeadlinesByClass(classId: string, onUpdate: (deadlines: any[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, 'deadlines'), where('classId', '==', classId));
  return onSnapshot(q, snap => { onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id }))); }, 
  error => { if (onError) onError(error); handleFirestoreError(error, OperationType.LIST, 'deadlines'); });
}

export function subscribeDeadlineSubmissionsByClass(classId: string, onUpdate: (subs: any[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, 'deadlineSubmissions'), where('classId', '==', classId));
  return onSnapshot(q, snap => { onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id }))); }, 
  error => { if (onError) onError(error); handleFirestoreError(error, OperationType.LIST, 'deadlineSubmissions'); });
}

// ==========================================
// ASSESSMENTS
// ==========================================
export function subscribeAssessments(classId: string, onUpdate: (assessments: AssessmentRecord[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, 'assessments'), where('classId', '==', classId));
  return onSnapshot(q, snap => { onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AssessmentRecord))); }, 
  error => { if (onError) onError(error); handleFirestoreError(error, OperationType.LIST, 'assessments'); });
}

export async function saveAssessment(assessment: Omit<AssessmentRecord, 'id'>): Promise<string> {
  try {
    const customId = `${assessment.assessorId}_${assessment.studentId}_${assessment.stage}`;
    const targetRef = doc(db, 'assessments', customId);
    const existing = await getDoc(targetRef);
    if (existing.exists()) {
      const oldData = existing.data();
      const histRef = doc(collection(db, 'assessmentHistory'));
      await setDoc(histRef, sanitizeData({ ...oldData, id: histRef.id, originalId: customId, supersededAt: new Date().toISOString(), supersededBy: assessment.assessorId }));
    }
    const version = existing.exists() ? ((existing.data()?.version || 1) + 1) : 1;
    const fullRecord: AssessmentRecord = {
      ...assessment, id: customId, version,
      updatedAt: new Date().toISOString(),
      createdAt: existing.exists() ? existing.data()?.createdAt : new Date().toISOString(),
    };
    await setDoc(targetRef, sanitizeData(fullRecord));
    return customId;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'assessments'); }
}

export function subscribeAssessmentHistory(classId: string, onUpdate: (records: any[]) => void) {
  const q = query(collection(db, 'assessmentHistory'), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
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
  }, error => { if (onError) onError(error); handleFirestoreError(error, OperationType.LIST, 'attendanceSessions'); });
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
// SCHEDULES
// ==========================================
export function subscribeSchedules(classId: string, onUpdate: (schedules: ScheduleEvent[]) => void) {
  const q = query(collection(db, 'schedules'), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleEvent))));
}

export async function createSchedule(event: Omit<ScheduleEvent, 'id'>): Promise<string> {
  try {
    const newRef = doc(collection(db, 'schedules'));
    await setDoc(newRef, sanitizeData({ ...event, id: newRef.id, createdAt: new Date().toISOString() }));
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'schedules'); }
}

export async function deleteSchedule(id: string): Promise<void> {
  try { await deleteDoc(doc(db, 'schedules', id)); }
  catch (error) { handleFirestoreError(error, OperationType.DELETE, `schedules/${id}`); }
}

// ==========================================
// DOCUMENTS & DRIVE
// ==========================================
export function subscribeDocuments(classId: string, onUpdate: (docs: ProductionDocument[]) => void) {
  const q = query(collection(db, 'documents'), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ProductionDocument))));
}

export async function uploadDocumentMeta(docData: Omit<ProductionDocument, 'id'>): Promise<string> {
  try {
    const newRef = doc(collection(db, 'documents'));
    await setDoc(newRef, sanitizeData({ ...docData, id: newRef.id, createdAt: new Date().toISOString() }));
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'documents'); }
}

export function subscribeDriveSubmissions(classId: string, onUpdate: (subs: any[]) => void, onError?: (err: any) => void) {
  const q = query(collection(db, 'driveSubmissions'), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    onUpdate(list);
  }, error => { if (onError) onError(error); });
}

// ==========================================
// NOTIFICATIONS
// ==========================================
export function subscribeNotifications(userId: string, onUpdate: (notifs: SystemNotification[]) => void) {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemNotification));
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    onUpdate(items);
  });
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  try { await updateDoc(doc(db, 'notifications', notifId), { read: true }); }
  catch (error) { handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`); }
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
  } catch (error) { console.warn('markAllNotificationsAsRead error:', error); return 0; }
}

export async function createNotification(notif: Omit<SystemNotification, 'id'>): Promise<void> {
  try {
    const newRef = doc(collection(db, 'notifications'));
    await setDoc(newRef, sanitizeData({ ...notif, id: newRef.id }));
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'notifications'); }
}

export async function notifyTeachers(classId: string, notif: any): Promise<void> {
  try {
    const users = await fetchUsersByClass(classId);
    const guruList = users.filter(u => u.role === 'Guru Pengampu' || u.role === 'Admin' || u.role === 'Super Admin');
    if (guruList.length === 0) return;
    const batch = writeBatch(db);
    guruList.forEach(u => {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, sanitizeData({
        id: notifRef.id, userId: u.uid, classId, title: notif.title, message: notif.message,
        category: notif.category, read: false, link: notif.link || '', createdAt: new Date().toISOString(),
      }));
    });
    await batch.commit();
  } catch (err) { console.warn('notifyTeachers error:', err); }
}

export async function notifyUsers(userIds: string[], notif: any): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    userIds.forEach(uid => {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, sanitizeData({ id: notifRef.id, userId: uid, classId: notif.classId || '', title: notif.title, message: notif.message, category: notif.category, read: false, link: notif.link || '', createdAt: new Date().toISOString() }));
    });
    await batch.commit();
  } catch (err) { console.warn('notifyUsers error:', err); }
}

// ==========================================
// BROADCASTS & COMPLAINTS
// ==========================================
export function subscribeBroadcasts(classId: string, onUpdate: (broadcasts: BroadcastMessage[]) => void) {
  const q = query(collection(db, 'broadcasts'), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as BroadcastMessage))));
}

export async function sendBroadcast(msg: Omit<BroadcastMessage, 'id'>): Promise<void> {
  try {
    const newRef = doc(collection(db, 'broadcasts'));
    await setDoc(newRef, sanitizeData({ ...msg, id: newRef.id, createdAt: new Date().toISOString() }));
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'broadcasts'); }
}

export function subscribeComplaints(classId: string, onUpdate: (complaints: StudentComplaint[]) => void) {
  const q = query(collection(db, 'complaints'), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as StudentComplaint))));
}

export async function submitComplaint(data: Omit<StudentComplaint, 'id'>): Promise<string> {
  try {
    const newRef = doc(collection(db, 'complaints'));
    await setDoc(newRef, sanitizeData({ ...data, id: newRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'complaints'); }
}

export async function replyComplaint(id: string, response: string, status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED', respondedBy: string): Promise<void> {
  try { await updateDoc(doc(db, 'complaints', id), sanitizeData({ teacherResponse: response, status, respondedBy, updatedAt: new Date().toISOString() })); }
  catch (error) { handleFirestoreError(error, OperationType.UPDATE, `complaints/${id}`); }
}

// ==========================================
// PROMPT BOOK & AUDIT
// ==========================================
export function subscribePromptBooks(classId: string, onUpdate: (books: PromptBookScene[]) => void) {
  const q = query(collection(db, 'promptBooks'), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as PromptBookScene))));
}

export async function savePromptBookScene(sceneData: PromptBookScene): Promise<void> {
  try { await setDoc(doc(db, 'promptBooks', sceneData.id), sanitizeData({ ...sceneData, updatedAt: new Date().toISOString() })); }
  catch (error) { handleFirestoreError(error, OperationType.WRITE, `promptBooks/${sceneData.id}`); }
}

export async function recordAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> {
  try {
    const newRef = doc(collection(db, 'auditLogs'));
    await setDoc(newRef, sanitizeData({ ...log, id: newRef.id, timestamp: log.timestamp || new Date().toISOString() }));
  } catch (error) { console.warn('Non-fatal audit log write error:', error); }
}