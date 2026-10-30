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
// HELPER: BERSIHKAN FIELD UNDEFINED
// Firestore menolak nilai `undefined`. Fungsi ini
// membuang semua key yang bernilai undefined sebelum
// data dikirim ke database.
// ==========================================
function sanitizeData<T extends Record<string, any>>(data: T): T {
  const cleaned: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  return cleaned as T;
}

// ==========================================
// ROLE → DIVISI MAPPING (auto-fill)
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
// FETCH USERS — Support classIds array
// ==========================================
export async function fetchUsersByClass(classId: string): Promise<UserProfile[]> {
  const path = 'users';
  const found: Record<string, UserProfile> = {};

  let className: string | null = null;
  try {
    const classSnap = await getDoc(doc(db, 'classes', classId));
    if (classSnap.exists()) className = classSnap.data().name || null;
  } catch (err) { console.warn('fetchUsersByClass: gagal ambil nama kelas:', err); }

  // 1. Full scan + filter di memori (support classId tunggal, classIds array, className)
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
          classIds: Array.isArray(u.classIds) && u.classIds.length > 0
            ? u.classIds
            : (u.classId ? [u.classId] : [classId]),
          className: u.className || className || '',
        });
      }
    });
  } catch (err) { console.error('fetchUsersByClass PRIMARY gagal:', err); }

  // 2. Fallback: query by classId jika scan kosong
  if (Object.keys(found).length === 0) {
    try {
      const q = query(collection(db, path), where('classId', '==', classId));
      const snap = await getDocs(q);
      snap.docs.forEach(d => { found[d.id] = enrichUser({ ...d.data(), uid: d.id } as UserProfile); });
    } catch (err) { console.warn('fetchUsersByClass FALLBACK 1 gagal:', err); }
  }

  // 3. Fallback: query by classIds array-contains (untuk guru multi-kelas)
  try {
    const q2 = query(collection(db, path), where('classIds', 'array-contains', classId));
    const snap2 = await getDocs(q2);
    snap2.docs.forEach(d => {
      if (!found[d.id]) {
        found[d.id] = enrichUser({ ...d.data(), uid: d.id } as UserProfile);
      }
    });
  } catch (err) {
    // Silent: banyak index firestore belum punya field classIds
  }

  // 4. Fallback: query by className
  if (Object.keys(found).length === 0 && className) {
    try {
      const q = query(collection(db, path), where('className', '==', className));
      const snap = await getDocs(q);
      snap.docs.forEach(d => { found[d.id] = enrichUser({ ...d.data(), uid: d.id } as UserProfile); });
    } catch (err) { console.warn('fetchUsersByClass FALLBACK 3 gagal:', err); }
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
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => enrichUser({ ...d.data(), uid: d.id } as UserProfile));
  } catch (error) { handleFirestoreError(error, OperationType.LIST, path); }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return enrichUser({ ...snap.data(), uid: snap.id } as UserProfile);
  } catch (error) { handleFirestoreError(error, OperationType.GET, path); }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), sanitizeData({ ...data, updatedAt: new Date().toISOString() }));
  } catch (error) { handleFirestoreError(error, OperationType.UPDATE, path); }
}

export async function fetchClasses(): Promise<ClassRoom[]> {
  const path = 'classes';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClassRoom))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) { handleFirestoreError(error, OperationType.LIST, path); }
}

// ==========================================
// PRODUCTION
// ==========================================
export async function fetchProductionByClass(classId: string): Promise<ProductionProject | null> {
  const path = 'productions';
  try {
    const q = query(collection(db, path), where('classId', '==', classId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { ...snap.docs[0].data(), id: snap.docs[0].id } as ProductionProject;
  } catch (error) { handleFirestoreError(error, OperationType.GET, path); }
}

export async function updateProductionStage(prodId: string, stage: any): Promise<void> {
  const path = `productions/${prodId}`;
  try {
    await updateDoc(doc(db, 'productions', prodId), { currentStage: stage, updatedAt: new Date().toISOString() });
  } catch (error) { handleFirestoreError(error, OperationType.UPDATE, path); }
}

// ==========================================
// TASKS (legacy)
// ==========================================
export function subscribeTasksByClass(
  classId: string,
  onUpdate: (tasks: TaskItem[]) => void,
  onError?: (err: any) => void
) {
  const path = 'tasks';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    const tasks = snap.docs.map(d => ({ ...d.data(), id: d.id } as TaskItem));
    const now = new Date().getTime();
    const updated = tasks.map(t => {
      if (t.status !== 'APPROVED' && new Date(t.dueDate).getTime() < now) return { ...t, status: 'OVERDUE' as const };
      return t;
    });
    onUpdate(updated);
  }, error => {
    if (onError) onError(error);
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function createTask(task: Omit<TaskItem, 'id'>): Promise<string> {
  const path = 'tasks';
  try {
    const newRef = doc(collection(db, path));
    const payload = sanitizeData({ ...task, id: newRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await setDoc(newRef, payload);
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

export async function updateTask(taskId: string, data: Partial<TaskItem>): Promise<void> {
  const path = `tasks/${taskId}`;
  try { await updateDoc(doc(db, 'tasks', taskId), sanitizeData({ ...data, updatedAt: new Date().toISOString() })); }
  catch (error) { handleFirestoreError(error, OperationType.UPDATE, path); }
}

export async function deleteTask(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try { await deleteDoc(doc(db, 'tasks', taskId)); }
  catch (error) { handleFirestoreError(error, OperationType.DELETE, path); }
}

// ==========================================
// DEADLINES SUBSCRIPTIONS
// ==========================================
export function subscribeDeadlinesByClass(
  classId: string,
  onUpdate: (deadlines: any[]) => void,
  onError?: (err: any) => void
) {
  const path = 'deadlines';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    onUpdate(list);
  }, error => {
    if (onError) onError(error);
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export function subscribeDeadlineSubmissionsByClass(
  classId: string,
  onUpdate: (subs: any[]) => void,
  onError?: (err: any) => void
) {
  const path = 'deadlineSubmissions';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id })));
  }, error => {
    if (onError) onError(error);
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// ==========================================
// ASSESSMENTS
// ==========================================
export function subscribeAssessments(
  classId: string,
  onUpdate: (assessments: AssessmentRecord[]) => void,
  onError?: (err: any) => void
) {
  const path = 'assessments';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AssessmentRecord)));
  }, error => {
    if (onError) onError(error);
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function saveAssessment(assessment: Omit<AssessmentRecord, 'id'>): Promise<string> {
  const path = 'assessments';
  try {
    const customId = `${assessment.assessorId}_${assessment.studentId}_${assessment.stage}`;
    const targetRef = doc(db, path, customId);
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
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

export function subscribeAssessmentHistory(classId: string, onUpdate: (records: any[]) => void) {
  const path = 'assessmentHistory';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
}

// ==========================================
// ATTENDANCE
// ==========================================
export function subscribeAttendanceSessions(
  classId: string,
  onUpdate: (sessions: AttendanceSession[]) => void,
  onError?: (err: any) => void
) {
  const path = 'attendanceSessions';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceSession)));
  }, error => {
    if (onError) onError(error);
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function createAttendanceSession(session: Omit<AttendanceSession, 'id'>): Promise<string> {
  const path = 'attendanceSessions';
  try {
    const newRef = doc(collection(db, path));
    const payload = sanitizeData({
      ...session,
      id: newRef.id,
      createdAt: new Date().toISOString(),
    });
    await setDoc(newRef, payload);
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

export async function closeAttendanceSession(sessionId: string): Promise<void> {
  const path = `attendanceSessions/${sessionId}`;
  try { await updateDoc(doc(db, 'attendanceSessions', sessionId), { isOpen: false }); }
  catch (error) { handleFirestoreError(error, OperationType.UPDATE, path); }
}

export function subscribeAttendanceRecords(sessionId: string, onUpdate: (records: AttendanceRecord[]) => void) {
  const path = 'attendanceRecords';
  const q = query(collection(db, path), where('sessionId', '==', sessionId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord))));
}

export function subscribeAllAttendanceRecords(classId: string, onUpdate: (records: AttendanceRecord[]) => void) {
  const path = 'attendanceRecords';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord))));
}

export async function submitAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<void> {
  const path = 'attendanceRecords';
  try {
    const recId = `${record.sessionId}_${record.studentId}`;
    const payload = sanitizeData({
      ...record,
      id: recId,
      timestamp: new Date().toISOString(),
    });
    await setDoc(doc(db, path, recId), payload);
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

// ==========================================
// SCHEDULES
// ==========================================
export function subscribeSchedules(classId: string, onUpdate: (schedules: ScheduleEvent[]) => void) {
  const path = 'schedules';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleEvent))));
}

export async function createSchedule(event: Omit<ScheduleEvent, 'id'>): Promise<string> {
  const path = 'schedules';
  try {
    const newRef = doc(collection(db, path));
    const payload = sanitizeData({
      ...event,
      id: newRef.id,
      createdAt: new Date().toISOString(),
    });
    await setDoc(newRef, payload);
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

export async function deleteSchedule(id: string): Promise<void> {
  const path = `schedules/${id}`;
  try { await deleteDoc(doc(db, 'schedules', id)); }
  catch (error) { handleFirestoreError(error, OperationType.DELETE, path); }
}

// ==========================================
// DOCUMENTS
// ==========================================
export function subscribeDocuments(classId: string, onUpdate: (docs: ProductionDocument[]) => void) {
  const path = 'documents';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ProductionDocument))));
}

export async function uploadDocumentMeta(docData: Omit<ProductionDocument, 'id'>): Promise<string> {
  const path = 'documents';
  try {
    const newRef = doc(collection(db, path));
    const payload = sanitizeData({
      ...docData,
      id: newRef.id,
      createdAt: new Date().toISOString(),
    });
    await setDoc(newRef, payload);
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

// ==========================================
// DRIVE SUBMISSIONS
// ==========================================
export function subscribeDriveSubmissions(
  classId: string,
  onUpdate: (subs: any[]) => void,
  onError?: (err: any) => void
) {
  const path = 'driveSubmissions';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    list.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    onUpdate(list);
  }, error => {
    if (onError) onError(error);
    console.warn('subscribeDriveSubmissions error:', error);
  });
}

// ==========================================
// NOTIFICATIONS
// ==========================================
export function subscribeNotifications(userId: string, onUpdate: (notifs: SystemNotification[]) => void) {
  const path = 'notifications';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemNotification));
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    onUpdate(items);
  });
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  const path = `notifications/${notifId}`;
  try { await updateDoc(doc(db, 'notifications', notifId), { read: true }); }
  catch (error) { handleFirestoreError(error, OperationType.UPDATE, path); }
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
  const path = 'notifications';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, sanitizeData({ ...notif, id: newRef.id }));
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

// ==========================================
// NOTIFY TEACHERS — Hanya Guru Pengampu (support classIds)
// ==========================================
export async function notifyTeachers(classId: string, notif: {
  title: string;
  message: string;
  category: SystemNotification['category'];
  link?: string;
  senderName?: string;
}): Promise<void> {
  try {
    const users = await fetchUsersByClass(classId);
    const guruList = users.filter(u =>
      u.role === 'Guru Pengampu' ||
      u.role === 'Admin' ||
      u.role === 'Super Admin'
    );

    if (guruList.length === 0) {
      const allSnap = await getDocs(collection(db, 'users'));
      const fallback = allSnap.docs.filter(d => {
        const role = d.data().role;
        return role === 'Guru Pengampu' || role === 'Admin' || role === 'Super Admin';
      });
      if (fallback.length === 0) return;

      const batch = writeBatch(db);
      const now = new Date().toISOString();
      fallback.forEach(d => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, sanitizeData({
          id: notifRef.id,
          userId: d.id,
          classId,
          title: notif.title,
          message: notif.message,
          category: notif.category,
          read: false,
          link: notif.link || '',
          createdAt: now,
        }));
      });
      await batch.commit();
      return;
    }

    const batch = writeBatch(db);
    const now = new Date().toISOString();
    guruList.forEach(u => {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, sanitizeData({
        id: notifRef.id,
        userId: u.uid,
        classId,
        title: notif.title,
        message: notif.message,
        category: notif.category,
        read: false,
        link: notif.link || '',
        createdAt: now,
      }));
    });
    await batch.commit();
  } catch (err) { console.warn('Non-fatal notifyTeachers error:', err); }
}

export async function notifyUsers(userIds: string[], notif: { title: string; message: string; category: SystemNotification['category']; link?: string; classId?: string }): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    userIds.forEach(uid => {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, sanitizeData({ id: notifRef.id, userId: uid, classId: notif.classId || '', title: notif.title, message: notif.message, category: notif.category, read: false, link: notif.link || '', createdAt: now }));
    });
    await batch.commit();
  } catch (err) { console.warn('notifyUsers error:', err); }
}

// ==========================================
// BROADCASTS
// ==========================================
export function subscribeBroadcasts(classId: string, onUpdate: (broadcasts: BroadcastMessage[]) => void) {
  const path = 'broadcasts';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as BroadcastMessage))));
}

export async function sendBroadcast(msg: Omit<BroadcastMessage, 'id'>): Promise<void> {
  const path = 'broadcasts';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, sanitizeData({ ...msg, id: newRef.id, createdAt: new Date().toISOString() }));
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

// ==========================================
// COMPLAINTS
// ==========================================
export function subscribeComplaints(classId: string, onUpdate: (complaints: StudentComplaint[]) => void) {
  const path = 'complaints';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as StudentComplaint))));
}

export async function submitComplaint(data: Omit<StudentComplaint, 'id'>): Promise<string> {
  const path = 'complaints';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, sanitizeData({ ...data, id: newRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    return newRef.id;
  } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
}

export async function replyComplaint(id: string, response: string, status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED', respondedBy: string): Promise<void> {
  const path = `complaints/${id}`;
  try {
    await updateDoc(doc(db, 'complaints', id), sanitizeData({ teacherResponse: response, status, respondedBy, updatedAt: new Date().toISOString() }));
  } catch (error) { handleFirestoreError(error, OperationType.UPDATE, path); }
}

// ==========================================
// PROMPT BOOK
// ==========================================
export function subscribePromptBooks(classId: string, onUpdate: (books: PromptBookScene[]) => void) {
  const path = 'promptBooks';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as PromptBookScene))));
}

export async function savePromptBookScene(sceneData: PromptBookScene): Promise<void> {
  const path = `promptBooks/${sceneData.id}`;
  try { await setDoc(doc(db, 'promptBooks', sceneData.id), sanitizeData({ ...sceneData, updatedAt: new Date().toISOString() })); }
  catch (error) { handleFirestoreError(error, OperationType.WRITE, path); }
}

// ==========================================
// AUDIT LOG
// ==========================================
export async function recordAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'> & { timestamp?: string }): Promise<void> {
  const path = 'auditLogs';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, sanitizeData({ ...log, id: newRef.id, timestamp: log.timestamp || new Date().toISOString() }));
  } catch (error) { console.warn('Non-fatal audit log write error:', error); }
}