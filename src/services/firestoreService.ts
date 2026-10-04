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
  where
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

// ==========================================
// USERS & CLASSES
// ==========================================

export async function fetchUsersByClass(classId: string): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const q = query(collection(db, path), where('classId', '==', classId));
    const snap = await getDocs(q);
    const usersList: UserProfile[] = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));

    // Also include any students embedded directly in the class document
    try {
      const classSnap = await getDoc(doc(db, 'classes', classId));
      if (classSnap.exists() && Array.isArray(classSnap.data()?.students)) {
        const ROLE_MAP: Record<string, string> = {
          pimpinan_produksi: 'Pimpinan Produksi',
          sutradara: 'Sutradara',
          asisten_sutradara: 'Asisten Sutradara',
          sekretaris: 'Sekretaris',
          bendahara: 'Bendahara',
          koor_perlengkapan: 'Koordinator Perlengkapan',
          koor_panggung: 'Koordinator Tata Panggung',
          koor_rias: 'Koordinator Tata Rias',
          koor_busana: 'Koordinator Tata Busana',
          koor_musik: 'Koordinator Tata Musik',
          koor_publikasi: 'Koordinator Publikasi',
          anggota_perlengkapan: 'Anggota Perlengkapan',
          anggota_panggung: 'Anggota Tata Panggung',
          anggota_rias: 'Anggota Tata Rias',
          anggota_busana: 'Anggota Tata Busana',
          anggota_musik: 'Anggota Tata Musik',
          anggota_publikasi: 'Anggota Publikasi',
          pemain: 'Pemain',
        };

        const existingNames = new Set(usersList.map(u => (u.displayName || '').toLowerCase()));
        for (const st of classSnap.data().students) {
          const sName = st.name || st.displayName;
          if (sName && !existingNames.has(sName.toLowerCase())) {
            const role = ROLE_MAP[st.role] || st.role || 'Pemain';
            usersList.push({
              uid: st.id || st.uid || `emb_${st.email || Math.random()}`,
              displayName: sName,
              email: st.email || '',
              phone: st.phone || '',
              role: role as any,
              classId,
              className: classSnap.data().name || classId,
              photoURL: st.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            });
            existingNames.add(sName.toLowerCase());
          }
        }
      }
    } catch (e) {
      // non-blocking
    }

    return usersList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { ...snap.data(), uid: snap.id } as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchClasses(): Promise<ClassRoom[]> {
  const path = 'classes';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs
      .map(d => ({ ...d.data(), id: d.id } as ClassRoom))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ==========================================
// PRODUCTIONS
// ==========================================

export async function fetchProductionByClass(classId: string): Promise<ProductionProject | null> {
  const path = 'productions';
  try {
    const q = query(collection(db, path), where('classId', '==', classId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { ...snap.docs[0].data(), id: snap.docs[0].id } as ProductionProject;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateProductionStage(prodId: string, stage: any): Promise<void> {
  const path = `productions/${prodId}`;
  try {
    await updateDoc(doc(db, 'productions', prodId), {
      currentStage: stage,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// TASKS & DEADLINES
// ==========================================

export function subscribeTasksByClass(
  classId: string,
  onUpdate: (tasks: TaskItem[]) => void,
  onError?: (err: any) => void
) {
  const path = 'tasks';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(
    q,
    snap => {
      const tasks = snap.docs.map(d => ({ ...d.data(), id: d.id } as TaskItem));
      // Auto compute OVERDUE status for tasks past due that are not approved
      const now = new Date().getTime();
      const updated = tasks.map(t => {
        if (t.status !== 'APPROVED' && new Date(t.dueDate).getTime() < now) {
          return { ...t, status: 'OVERDUE' as const };
        }
        return t;
      });
      onUpdate(updated);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createTask(task: Omit<TaskItem, 'id'>): Promise<string> {
  const path = 'tasks';
  try {
    const newRef = doc(collection(db, path));
    const fullTask: TaskItem = {
      ...task,
      id: newRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(newRef, fullTask);
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTask(taskId: string, data: Partial<TaskItem>): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
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
  return onSnapshot(
    q,
    snap => {
      const records = snap.docs.map(d => ({ ...d.data(), id: d.id } as AssessmentRecord));
      onUpdate(records);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveAssessment(assessment: Omit<AssessmentRecord, 'id'>): Promise<string> {
  const path = 'assessments';
  try {
    // Generate deterministic ID per assessor + student + stage to avoid duplicate writes
    const customId = `${assessment.assessorId}_${assessment.studentId}_${assessment.stage}`;
    const targetRef = doc(db, path, customId);
    const existing = await getDoc(targetRef);

    const version = existing.exists() ? ((existing.data()?.version || 1) + 1) : 1;

    const fullRecord: AssessmentRecord = {
      ...assessment,
      id: customId,
      version,
      updatedAt: new Date().toISOString(),
      createdAt: existing.exists() ? existing.data()?.createdAt : new Date().toISOString(),
    };

    await setDoc(targetRef, fullRecord);
    return customId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
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
  return onSnapshot(
    q,
    snap => {
      const sessions = snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceSession));
      onUpdate(sessions);
    },
    error => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createAttendanceSession(
  session: Omit<AttendanceSession, 'id'>
): Promise<string> {
  const path = 'attendanceSessions';
  try {
    const newRef = doc(collection(db, path));
    const fullSession: AttendanceSession = {
      ...session,
      id: newRef.id,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newRef, fullSession);
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function closeAttendanceSession(sessionId: string): Promise<void> {
  const path = `attendanceSessions/${sessionId}`;
  try {
    await updateDoc(doc(db, 'attendanceSessions', sessionId), {
      isOpen: false,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeAttendanceRecords(
  sessionId: string,
  onUpdate: (records: AttendanceRecord[]) => void
) {
  const path = 'attendanceRecords';
  const q = query(collection(db, path), where('sessionId', '==', sessionId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord)));
  });
}

export async function submitAttendanceRecord(record: Omit<AttendanceRecord, 'id'>): Promise<void> {
  const path = 'attendanceRecords';
  try {
    const recId = `${record.sessionId}_${record.studentId}`;
    await setDoc(doc(db, path, recId), {
      ...record,
      id: recId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ==========================================
// SCHEDULES
// ==========================================

export function subscribeSchedules(classId: string, onUpdate: (schedules: ScheduleEvent[]) => void) {
  const path = 'schedules';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleEvent)));
  });
}

export async function createSchedule(event: Omit<ScheduleEvent, 'id'>): Promise<string> {
  const path = 'schedules';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, {
      ...event,
      id: newRef.id,
      createdAt: new Date().toISOString(),
    });
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  const path = `schedules/${id}`;
  try {
    await deleteDoc(doc(db, 'schedules', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==========================================
// DOCUMENTS
// ==========================================

export function subscribeDocuments(
  classId: string,
  onUpdate: (docs: ProductionDocument[]) => void
) {
  const path = 'documents';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as ProductionDocument)));
  });
}

export async function uploadDocumentMeta(docData: Omit<ProductionDocument, 'id'>): Promise<string> {
  const path = 'documents';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, {
      ...docData,
      id: newRef.id,
      createdAt: new Date().toISOString(),
    });
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ==========================================
// NOTIFICATIONS & BROADCASTS
// ==========================================

export function subscribeNotifications(
  userId: string,
  onUpdate: (notifs: SystemNotification[]) => void
) {
  const path = 'notifications';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemNotification)));
  });
}

export async function markNotificationAsRead(notifId: string): Promise<void> {
  const path = `notifications/${notifId}`;
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createNotification(notif: Omit<SystemNotification, 'id'>): Promise<void> {
  const path = 'notifications';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, { ...notif, id: newRef.id });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeBroadcasts(
  classId: string,
  onUpdate: (broadcasts: BroadcastMessage[]) => void
) {
  const path = 'broadcasts';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as BroadcastMessage)));
  });
}

export async function sendBroadcast(msg: Omit<BroadcastMessage, 'id'>): Promise<void> {
  const path = 'broadcasts';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, {
      ...msg,
      id: newRef.id,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ==========================================
// COMPLAINTS (ADUAN)
// ==========================================

export function subscribeComplaints(
  classId: string,
  onUpdate: (complaints: StudentComplaint[]) => void
) {
  const path = 'complaints';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as StudentComplaint)));
  });
}

export async function submitComplaint(data: Omit<StudentComplaint, 'id'>): Promise<string> {
  const path = 'complaints';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, {
      ...data,
      id: newRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function replyComplaint(
  id: string,
  response: string,
  status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
  respondedBy: string
): Promise<void> {
  const path = `complaints/${id}`;
  try {
    await updateDoc(doc(db, 'complaints', id), {
      teacherResponse: response,
      status,
      respondedBy,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// PROMPT BOOK (3x3 STAGE BLOCKING)
// ==========================================

export function subscribePromptBooks(
  classId: string,
  onUpdate: (books: PromptBookScene[]) => void
) {
  const path = 'promptBooks';
  const q = query(collection(db, path), where('classId', '==', classId));
  return onSnapshot(q, snap => {
    onUpdate(snap.docs.map(d => ({ ...d.data(), id: d.id } as PromptBookScene)));
  });
}

export async function savePromptBookScene(sceneData: PromptBookScene): Promise<void> {
  const path = `promptBooks/${sceneData.id}`;
  try {
    await setDoc(doc(db, 'promptBooks', sceneData.id), {
      ...sceneData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// AUDIT LOG
// ==========================================

export async function recordAuditLog(
  log: Omit<AuditLogItem, 'id' | 'timestamp'> & { timestamp?: string }
): Promise<void> {
  const path = 'auditLogs';
  try {
    const newRef = doc(collection(db, path));
    await setDoc(newRef, {
      ...log,
      id: newRef.id,
      timestamp: log.timestamp || new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Non-fatal audit log write error:', error);
  }
}
