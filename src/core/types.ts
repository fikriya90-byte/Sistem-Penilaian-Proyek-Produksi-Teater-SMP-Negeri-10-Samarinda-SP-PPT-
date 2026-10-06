export type UserRole =
  | 'Guru Pengampu'
  | 'Pimpinan Produksi'
  | 'Sekretaris'
  | 'Bendahara'
  | 'Sutradara'
  | 'Asisten Sutradara'
  | 'Koordinator Perlengkapan'
  | 'Koordinator Publikasi'
  | 'Koordinator Tata Panggung'
  | 'Koordinator Tata Rias'
  | 'Koordinator Tata Busana'
  | 'Koordinator Tata Musik'
  | 'Anggota Perlengkapan'
  | 'Anggota Publikasi'
  | 'Anggota Tata Panggung'
  | 'Anggota Tata Rias'
  | 'Anggota Tata Busana'
  | 'Anggota Tata Musik'
  | 'Pemeran'
  | 'Admin'
  | 'Super Admin';

export type DivisionType =
  | 'Pengurus Inti'
  | 'Perlengkapan'
  | 'Publikasi & Dokumentasi'
  | 'Tata Panggung'
  | 'Tata Rias'
  | 'Tata Busana'
  | 'Tata Musik & Suara'
  | 'Pemeran';

export type ProductionStage = 'PERSIAPAN' | 'PELAKSANAAN' | 'PERTUNJUKAN' | 'PASCA';

export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'REVISION'
  | 'APPROVED'
  | 'OVERDUE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';

export type ScheduleType =
  | 'Rapat' | 'Latihan' | 'Gladi' | 'Pementasan'
  | 'Evaluasi' | 'Produksi' | 'Fitting' | 'Briefing';

// =====================================================
// KATEGORI PENILAI (untuk 360°)
// =====================================================
export type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

export interface UserProfile {
  uid: string;
  email: string;
  secondaryEmail?: string;
  displayName: string;
  role: UserRole;
  classId: string;
  className: string;
  productionId?: string;
  divisionId?: string;
  divisionName?: DivisionType;
  phone?: string;
  photoURL?: string;
  nis?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  teacherId: string;
  teacherName: string;
  totalStudents?: number;
  kerabatKerja?: string;
  kerabatLogo?: string;
  students?: any[];
  createdAt?: string;
}

export interface ProductionProject {
  id: string;
  title: string;
  classId: string;
  className?: string;
  schoolYear: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  currentStage: ProductionStage;
  synopsis?: string;
  theme?: string;
  directorVision?: string;
  startDate?: string;
  performanceDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskItem {
  id: string;
  classId: string;
  productionId?: string;
  stageId?: ProductionStage;
  divisionId?: string;
  divisionName?: DivisionType;
  role?: string;
  assigneeId?: string;
  assigneeName?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  dueDate: string;
  proofUrl?: string;
  proofNote?: string;
  feedback?: string;
  rating?: number;
  // BARU: penanda tugas kritis (★)
  isCritical?: boolean;
  // BARU: untuk menyimpan status ketepatan
  completionStatus?: 'AWAL' | 'TEPAT' | 'TELAT_RINGAN' | 'TELAT_BERAT' | 'BELUM';
  createdBy: string;
  creatorName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssessmentRecord {
  id: string;
  classId: string;
  productionId?: string;
  studentId: string;
  studentName: string;
  studentRole: UserRole;
  studentDivision?: DivisionType;
  assessorId: string;
  assessorName: string;
  assessorRole: UserRole;
  // BARU: 4 kategori penilai
  assessorCategory: AssessorCategory;
  stage: ProductionStage;
  // scores: { kerja_sama: 3, kreativitas: 4, teknis: 3 } untuk manual
  scores: Record<string, number>;
  // BARU: skor otomatis dari sistem
  autoScores?: {
    tanggung_jawab?: number;   // 1-4
    kehadiran?: number;        // 1-4
    kedisiplinan?: number;     // 1-4 (Pemeran)
  };
  totalScore: number;
  comment?: string;
  isFinal: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceSession {
  id: string;
  title: string;
  classId: string;
  activityType: ScheduleType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  targetScope: 'SEMUA' | 'DIVISI' | 'PEMAIN_MUSIK' | 'CUSTOM';
  targetDivisionId?: string;
  targetDivisionName?: DivisionType;
  createdBy: string;
  creatorRole: UserRole;
  creatorName: string;
  agenda?: string;
  isOpen: boolean;
  createdAt?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  classId: string;
  studentId: string;
  studentName: string;
  role: UserRole;
  divisionName?: DivisionType;
  status: AttendanceStatus;
  note?: string;
  timestamp: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  classId: string;
  type: ScheduleType;
  startAt: string;
  endAt: string;
  location: string;
  participants: string;
  divisionId?: string;
  divisionName?: DivisionType;
  pic: string;
  description?: string;
  createdBy: string;
  creatorName?: string;
  createdAt?: string;
}

export interface SystemNotification {
  id: string;
  userId: string;
  classId?: string;
  title: string;
  message: string;
  category: 'Tugas' | 'Nilai' | 'Pengumuman' | 'Urgent' | 'Reminder' | 'Feedback' | 'Sistem' | 'Keuangan';
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface BroadcastMessage {
  id: string;
  classId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  title: string;
  content: string;
  target: 'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM';
  targetDivision?: DivisionType;
  targetRole?: UserRole;
  createdAt: string;
}

export interface ProductionDocument {
  id: string;
  classId: string;
  title: string;
  category:
    | 'Proposal' | 'Surat Izin' | 'Naskah Drama' | 'Notulen Rapat'
    | 'Dokumentasi' | 'Laporan Keuangan' | 'Laporan Divisi' | 'LPJ';
  fileUrl: string;
  fileSize?: string;
  fileType?: string;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole?: UserRole;
  createdAt: string;
}

export interface StudentComplaint {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  isAnonymous: boolean;
  title: string;
  description: string;
  category: 'Akademik' | 'Teknis' | 'Sosial' | 'Keamanan' | 'Bullying' | 'Lainnya';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  teacherResponse?: string;
  respondedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PromptBookScene {
  id: string;
  classId: string;
  scene: string;
  gridPositions: Record<string, string>;
  notes?: string;
  cues?: Array<{
    code: string;
    action: string;
    timing: string;
    soundLight?: string;
  }>;
  updatedBy: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSESS' | 'LOCK' | 'SUBMIT';
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface DeadlineItem {
  id: string;
  classId: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  targetScope: 'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM';
  targetDivision?: DivisionType;
  targetRole?: UserRole;
  targetUserIds?: string[];
  stage?: ProductionStage;
  isCritical?: boolean;
  attachmentUrl?: string;
  createdBy: string;
  creatorName: string;
  creatorRole: UserRole;
  createdAt: string;
  updatedAt?: string;
}

export interface DeadlineSubmission {
  id: string;
  deadlineId: string;
  classId: string;
  studentId: string;
  studentName: string;
  status: 'BELUM' | 'PROSES' | 'SELESAI' | 'TERLAMBAT';
  progress: number;
  proofUrl?: string;
  proofNote?: string;
  extensionRequested?: boolean;
  extensionReason?: string;
  extensionApproved?: boolean;
  feedback?: string;
  rating?: number;
  submittedAt?: string;
  updatedAt: string;
}

export interface StageConfig {
  stageId: ProductionStage;
  startDate: string;
  endDate: string;
  enabled: boolean;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}
