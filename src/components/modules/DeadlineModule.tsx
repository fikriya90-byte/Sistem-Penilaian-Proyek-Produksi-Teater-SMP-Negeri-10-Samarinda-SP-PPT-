import React, { useState, useEffect } from 'react';
import {
  Clock, PlusCircle, CheckCircle, Users, Upload, X, Send, Timer,
  AlertTriangle, Check, BookOpen, Flag, Palette, Star,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { DIVISIONS, STAGES } from '../../core/constants';
import {
  DeadlineItem, DeadlineSubmission, DivisionType, UserRole,
  ProductionStage, UserProfile,
} from '../../core/types';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass, notifyTeachers } from '../../services/firestoreService';

// =====================================================
// KONFIGURASI PRIORITAS
// =====================================================
const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  LOW: { label: 'Rendah', color: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Sedang', color: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  HIGH: { label: 'Tinggi', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  CRITICAL: { label: 'Kritis', color: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' },
};

function getPriorityConfig(priority?: string) {
  if (!priority) return PRIORITY_CONFIG.MEDIUM;
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
}

// =====================================================
// KONFIGURASI TAHAP
// =====================================================
const STAGE_META: Record<ProductionStage, {
  icon: any;
  label: string;
  desc: string;
  gradient: string;
  color: string;
}> = {
  PERSIAPAN: {
    icon: BookOpen,
    label: 'Tahap 1: Persiapan',
    desc: 'Riset, naskah, casting, desain konsep',
    gradient: 'from-amber-600 to-amber-800',
    color: 'text-amber-800 dark:text-amber-300',
  },
  PELAKSANAAN: {
    icon: Palette,
    label: 'Tahap 2: Pelaksanaan',
    desc: 'Latihan rutin, pembuatan properti & kostum',
    gradient: 'from-blue-600 to-blue-800',
    color: 'text-blue-800 dark:text-blue-300',
  },
  PERTUNJUKAN: {
    icon: Star,
    label: 'Tahap 3: Pertunjukan',
    desc: 'Gladi resik, pementasan utama',
    gradient: 'from-purple-600 to-purple-800',
    color: 'text-purple-800 dark:text-purple-300',
  },
  PASCA: {
    icon: Flag,
    label: 'Tahap 4: Pasca Produksi',
    desc: 'Evaluasi, LPJ, dokumentasi akhir',
    gradient: 'from-emerald-600 to-emerald-800',
    color: 'text-emerald-800 dark:text-emerald-300',
  },
};

// =====================================================
// TEMPLATE PER TAHAP
// =====================================================
interface TemplateDef {
  title: string;
  description: string;
  days: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  defaultTarget: 'SEMUA' | 'DIVISI' | 'PERAN';
  defaultDivision?: DivisionType;
  defaultRole?: UserRole;
}

const TEMPLATES_BY_STAGE: Record<ProductionStage, TemplateDef[]> = {
  PERSIAPAN: [
    { title: 'Baca Naskah & Analisis Karakter', description: 'Baca naskah lengkap dan buat analisis karakter masing-masing.', days: 5, priority: 'HIGH', defaultTarget: 'PERAN', defaultRole: 'Pemain' },
    { title: 'Desain Konsep Properti', description: 'Buat sketsa desain semua properti yang dibutuhkan.', days: 7, priority: 'MEDIUM', defaultTarget: 'DIVISI', defaultDivision: 'Perlengkapan' },
    { title: 'Desain Set Panggung', description: 'Rancang tata panggung lengkap dengan dimensi dan bahan.', days: 7, priority: 'HIGH', defaultTarget: 'DIVISI', defaultDivision: 'Tata Panggung' },
    { title: 'Moodboard Kostum & Rias', description: 'Kumpulkan referensi visual untuk semua tokoh.', days: 5, priority: 'MEDIUM', defaultTarget: 'DIVISI', defaultDivision: 'Tata Busana' },
    { title: 'Proposal & RAB Produksi', description: 'Susun proposal lengkap dengan RAB.', days: 10, priority: 'CRITICAL', defaultTarget: 'SEMUA' },
  ],
  PELAKSANAAN: [
    { title: 'Latihan Blocking Babak 1', description: 'Latihan blocking dan dialog Babak 1.', days: 3, priority: 'HIGH', defaultTarget: 'PERAN', defaultRole: 'Pemain' },
    { title: 'Latihan Blocking Babak 2', description: 'Latihan blocking dan dialog Babak 2.', days: 5, priority: 'HIGH', defaultTarget: 'PERAN', defaultRole: 'Pemain' },
    { title: 'Pembuatan Properti Setengah Jadi', description: 'Properti harus selesai 50%.', days: 7, priority: 'MEDIUM', defaultTarget: 'DIVISI', defaultDivision: 'Perlengkapan' },
    { title: 'Fitting Kostum Pertama', description: 'Fitting perdana semua kostum pemain.', days: 5, priority: 'HIGH', defaultTarget: 'PERAN', defaultRole: 'Pemain' },
    { title: 'Rekam Sound Cue Sheet', description: 'Rekam semua audio cue untuk pementasan.', days: 6, priority: 'HIGH', defaultTarget: 'DIVISI', defaultDivision: 'Tata Musik & Suara' },
    { title: 'Poster & Promosi H-14', description: 'Rilis poster resmi dan mulai promosi.', days: 3, priority: 'MEDIUM', defaultTarget: 'DIVISI', defaultDivision: 'Publikasi & Dokumentasi' },
  ],
  PERTUNJUKAN: [
    { title: 'Gladi Kotor Panggung', description: 'Uji coba blocking penuh di panggung.', days: 2, priority: 'CRITICAL', defaultTarget: 'SEMUA' },
    { title: 'Gladi Bersih Full', description: 'Gladi resik lengkap dengan kostum dan properti.', days: 1, priority: 'CRITICAL', defaultTarget: 'SEMUA' },
    { title: 'Check Sound & Lighting', description: 'Sound check dan lighting test.', days: 1, priority: 'CRITICAL', defaultTarget: 'DIVISI', defaultDivision: 'Tata Musik & Suara' },
    { title: 'Final Fitting & Rias', description: 'Fitting final dan uji coba rias.', days: 2, priority: 'HIGH', defaultTarget: 'PERAN', defaultRole: 'Pemain' },
  ],
  PASCA: [
    { title: 'Refleksi Diri Pasca Pentas', description: 'Tulis refleksi pribadi setelah pementasan.', days: 3, priority: 'HIGH', defaultTarget: 'PERAN', defaultRole: 'Pemain' },
    { title: 'Pengembalian Properti & Kostum', description: 'Kumpulkan dan kembalikan semua properti & kostum.', days: 5, priority: 'MEDIUM', defaultTarget: 'SEMUA' },
    { title: 'Kompilasi LPJ Final', description: 'Susun LPJ lengkap semua divisi.', days: 7, priority: 'CRITICAL', defaultTarget: 'SEMUA' },
    { title: 'Upload Aftermovie & Dokumentasi', description: 'Edit dan upload aftermovie + foto pementasan.', days: 10, priority: 'MEDIUM', defaultTarget: 'DIVISI', defaultDivision: 'Publikasi & Dokumentasi' },
    { title: 'Evaluasi Akhir Bersama', description: 'Rapat evaluasi seluruh tim produksi.', days: 5, priority: 'HIGH', defaultTarget: 'SEMUA' },
  ],
};

const CAN_CREATE_DEADLINE_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
  'Pimpinan Produksi', 'Sekretaris', 'Sutradara', 'Asisten Sutradara',
];
const isKoordinator = (role?: string) => !!role && role.startsWith('Koordinator ');

// =====================================================
// MAIN COMPONENT
// =====================================================
export const DeadlineModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, DeadlineSubmission>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineItem | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);
  const [filterStage, setFilterStage] = useState<'ALL' | ProductionStage>('ALL');
  const [filterScope, setFilterScope] = useState<'ALL' | 'MINE'>('ALL');
  const [now, setNow] = useState(new Date());

  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDef | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newTarget, setNewTarget] = useState<'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM'>('SEMUA');
  const [newDivision, setNewDivision] = useState<DivisionType>('Perlengkapan');
  const [newRole, setNewRole] = useState<UserRole>('Pemain');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [progress, setProgress] = useState(50);
  const [askExtension, setAskExtension] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');

  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [approveExt, setApproveExt] = useState(false);

  const canCreate = !!user && (
    CAN_CREATE_DEADLINE_ROLES.includes(user.role) ||
    isKoordinator(user.role)
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const items: DeadlineItem[] = snap.docs.map(d => ({ ...d.data(), id: d.id } as DeadlineItem));
      items.sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
      setDeadlines(items);
    });
    fetchUsersByClass(activeClass.id).then(setUsers);
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass || !user) return;
    const q = query(
      collection(db, 'deadlineSubmissions'),
      where('classId', '==', activeClass.id),
      where('studentId', '==', user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const map: Record<string, DeadlineSubmission> = {};
      snap.docs.forEach(d => {
        const data = d.data() as DeadlineSubmission;
        map[data.deadlineId] = { ...data, id: d.id };
      });
      setMySubmissions(map);
    });
    return () => unsub();
  }, [activeClass, user]);

  const getCountdown = (dueDate?: string) => {
    if (!dueDate) return { text: 'Tanpa deadline', color: 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
    const diff = new Date(dueDate).getTime() - now.getTime();
    if (isNaN(diff)) return { text: 'Format salah', color: 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
    if (diff <= 0) {
      const lateDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      return { text: `Terlambat ${lateDays} hari`, color: 'text-rose-700 bg-rose-100 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40' };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (hours < 24) return { text: `${hours} jam lagi`, color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 animate-pulse font-bold' };
    if (hours <= 72) return { text: `${days} hari lagi`, color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40' };
    return { text: `${days} hari lagi`, color: 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
  };

  const handleOpenCreate = () => {
    setSelectedStage('PELAKSANAAN');
    setSelectedTemplate(null);
    setNewTitle('');
    setNewDesc('');
    setNewDue('');
    setNewPriority('MEDIUM');
    setNewTarget('SEMUA');
    setSelectedUserIds([]);
    setIsCreateOpen(true);
  };

  const handleSelectTemplate = (tpl: TemplateDef) => {
    setSelectedTemplate(tpl);
    setNewTitle(tpl.title);
    setNewDesc(tpl.description);
    setNewPriority(tpl.priority);
    setNewTarget(tpl.defaultTarget);
    if (tpl.defaultDivision) setNewDivision(tpl.defaultDivision);
    if (tpl.defaultRole) setNewRole(tpl.defaultRole);

    const due = new Date();
    due.setDate(due.getDate() + tpl.days);
    due.setHours(23, 59, 0, 0);
    setNewDue(due.toISOString().slice(0, 16));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!newTitle.trim() || !newDue) {
      showToast('Lengkapi judul dan deadline.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'deadlines'));
      const newDeadline: DeadlineItem = {
        id: newRef.id,
        classId: activeClass.id,
        title: newTitle.trim(),
        description: newDesc.trim(),
        dueDate: new Date(newDue).toISOString(),
        priority: newPriority,
        targetScope: newTarget === 'CUSTOM' ? 'CUSTOM' : newTarget,
        targetDivision: newTarget === 'DIVISI' ? newDivision : undefined,
        targetRole: newTarget === 'PERAN' ? newRole : undefined,
        targetUserIds: newTarget === 'CUSTOM' ? selectedUserIds : undefined,
        stage: selectedStage,
        createdBy: user.uid,
        creatorName: user.displayName,
        creatorRole: user.role,
        createdAt: new Date().toISOString(),
      } as any;
      await setDoc(newRef, newDeadline);

      try {
        const allUsers = await fetchUsersByClass(activeClass.id);
        let recipients = allUsers.filter(u => {
          if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return false;
          if (u.role === 'Admin' || u.role === 'Super Admin') return false;
          if (newTarget === 'SEMUA') return true;
          if (newTarget === 'DIVISI') return u.divisionName === newDivision;
          if (newTarget === 'PERAN') return u.role === newRole;
          if (newTarget === 'CUSTOM') return selectedUserIds.includes(u.uid);
          return false;
        });

        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);
        recipients.forEach(r => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: r.uid,
            classId: activeClass.id,
            title: 'Deadline Baru',
            message: `${user.displayName}: "${newTitle.trim()}" (${selectedStage})`,
            category: 'Reminder',
            read: false,
            link: 'deadline',
            createdAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      } catch { /* non-fatal */ }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Deadline', targetId: newRef.id,
        details: `Buat deadline [${selectedStage}]: ${newTitle}`,
      });

      showToast('Deadline berhasil dikirim!', 'success');
      setIsCreateOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!user || !activeClass || !selectedDeadline) return;
    setSubmitting(true);
    try {
      const subId = `${selectedDeadline.id}_${user.uid}`;
      const dueMs = new Date(selectedDeadline.dueDate || 0).getTime();
      const isLate = !isNaN(dueMs) && dueMs < Date.now();
      await setDoc(doc(db, 'deadlineSubmissions', subId), {
        id: subId,
        deadlineId: selectedDeadline.id,
        classId: activeClass.id,
        studentId: user.uid,
        studentName: user.displayName,
        status: isLate ? 'TERLAMBAT' : 'SELESAI',
        progress: 100,
        proofUrl: proofUrl.trim(),
        proofNote: proofNote.trim(),
        extensionRequested: askExtension,
        extensionReason: askExtension ? extensionReason.trim() : undefined,
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      });

      // === NOTIFIKASI KE GURU ===
      try {
        await notifyTeachers(activeClass.id, {
          title: askExtension ? 'Permintaan Perpanjangan Deadline' : 'Bukti Deadline Dikirim',
          message: `${user.displayName} (${user.role}) - "${selectedDeadline.title}"${askExtension ? ' (minta perpanjangan)' : ''}`,
          category: 'Tugas',
          link: 'deadline',
          senderName: user.displayName,
        });
      } catch (err) {
        console.warn('Notif guru gagal:', err);
      }

      showToast('Bukti berhasil dikirim!', 'success');
      setIsSubmitOpen(false);
      setSelectedDeadline(null);
      setProofUrl('');
      setProofNote('');
      setAskExtension(false);
      setExtensionReason('');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReview = async (d: DeadlineItem) => {
    setSelectedDeadline(d);
    try {
      const q = query(collection(db, 'deadlineSubmissions'), where('deadlineId', '==', d.id));
      const snap = await getDocs(q);
      setSubmissions(snap.docs.map(x => ({ ...x.data(), id: x.id } as DeadlineSubmission)));
      setIsReviewOpen(true);
    } catch (err: any) {
      showToast('Gagal load: ' + err.message, 'error');
    }
  };

  const handleSaveFeedback = async (sub: DeadlineSubmission) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'deadlineSubmissions', sub.id), {
        feedback: feedbackText.trim() || sub.feedback,
        rating: feedbackRating || sub.rating,
        extensionApproved: approveExt ? true : sub.extensionApproved,
        updatedAt: new Date().toISOString(),
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: sub.studentId,
        classId: sub.classId,
        title: 'Feedback Deadline',
        message: `${user.displayName} memberi feedback`,
        category: 'Feedback',
        read: false,
        link: 'deadline',
        createdAt: new Date().toISOString(),
      });

      showToast('Feedback tersimpan!', 'success');
      setFeedbackText('');
      setFeedbackRating(5);
      setApproveExt(false);

      if (selectedDeadline) {
        const q = query(collection(db, 'deadlineSubmissions'), where('deadlineId', '==', selectedDeadline.id));
        const snap = await getDocs(q);
        setSubmissions(snap.docs.map(x => ({ ...x.data(), id: x.id } as DeadlineSubmission)));
      }
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const visibleDeadlines = deadlines.filter(d => {
    if (filterStage !== 'ALL') {
      const dStage = (d as any).stage;
      if (dStage && dStage !== filterStage) return false;
    }
    if (filterScope === 'MINE' && user) {
      if (d.createdBy === user.uid) return true;
      if (d.targetScope === 'SEMUA') return true;
      if (d.targetScope === 'DIVISI' && d.targetDivision === user.divisionName) return true;
      if (d.targetScope === 'PERAN' && d.targetRole === user.role) return true;
      if (d.targetScope === 'CUSTOM' && (d as any).targetUserIds?.includes(user.uid)) return true;
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-900 via-slate-900 to-slate-800 text-white shadow-xl border border-rose-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <Timer className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                Deadline Produksi
              </span>
              <h2 className="text-xl font-black text-white mt-1">Tenggat Waktu & Pengumpulan</h2>
              <p className="text-xs text-slate-300 mt-0.5">Template per tahap - pilih tahap, lalu target penerima</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={handleOpenCreate}
              className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
              <PlusCircle className="w-4 h-4" /> Kirim Deadline
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setFilterStage('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            filterStage === 'ALL'
              ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Semua ({deadlines.length})
        </button>
        {STAGES.map(s => {
          const Icon = STAGE_META[s.id].icon;
          const count = deadlines.filter(d => (d as any).stage === s.id).length;
          const isActive = filterStage === s.id;
          return (
            <button key={s.id} onClick={() => setFilterStage(s.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? `bg-gradient-to-r ${STAGE_META[s.id].gradient} text-white shadow-md`
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {s.id} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setFilterScope('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            filterScope === 'ALL' ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Semua Deadline
        </button>
        <button onClick={() => setFilterScope('MINE')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            filterScope === 'MINE' ? 'bg-amber-500 text-slate-950' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Untuk Saya
        </button>
      </div>

      {visibleDeadlines.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Timer className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Deadline</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canCreate ? 'Klik "Kirim Deadline" untuk buat.' : 'Tunggu instruksi.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleDeadlines.map(d => {
            const cd = getCountdown(d.dueDate);
            const mySub = mySubmissions[d.id];
            const priority = getPriorityConfig(d.priority);
            const dStage = (d as any).stage as ProductionStage | undefined;
            const stageInfo = dStage ? STAGE_META[dStage] : null;

            return (
              <div key={d.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/50 transition shadow-sm space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {stageInfo && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r ${stageInfo.gradient} text-white`}>
                      {dStage}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${priority.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                    {priority.label}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {d.targetScope === 'DIVISI' ? d.targetDivision :
                     d.targetScope === 'PERAN' ? d.targetRole :
                     d.targetScope === 'CUSTOM' ? 'Custom' : 'Semua'}
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{d.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{d.description}</p>

                <div className={`p-3 rounded-xl border text-xs font-bold text-center ${cd.color}`}>
                  <Clock className="w-4 h-4 inline mr-1" /> {cd.text}
                </div>

                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Dibuat <strong className="text-slate-600 dark:text-slate-300">{d.creatorName || 'Tim'}</strong>
                  {d.dueDate ? ` - Deadline: ${new Date(d.dueDate).toLocaleString('id-ID')}` : ''}
                </p>

                {!canCreate && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    {mySub ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Status:</span>
                          <span className={`font-bold px-2 py-0.5 rounded-md ${
                            mySub.status === 'SELESAI' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' :
                            mySub.status === 'TERLAMBAT' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300' :
                            'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                          }`}>{mySub.status}</span>
                        </div>
                        {mySub.feedback && (
                          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-[11px] text-emerald-900 dark:text-emerald-200">
                            <strong>Feedback:</strong> {mySub.feedback}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setSelectedDeadline(d);
                            setProofUrl(mySub.proofUrl || '');
                            setProofNote(mySub.proofNote || '');
                            setProgress(mySub.progress || 50);
                            setIsSubmitOpen(true);
                          }}
                          className="w-full py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs">
                          <Upload className="w-3.5 h-3.5 inline mr-1" /> Update Bukti
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedDeadline(d);
                          setProofUrl('');
                          setProofNote('');
                          setProgress(50);
                          setIsSubmitOpen(true);
                        }}
                        className="w-full py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs">
                        <Upload className="w-3.5 h-3.5 inline mr-1" /> Submit Bukti
                      </button>
                    )}
                  </div>
                )}

                {canCreate && (
                  <button onClick={() => handleOpenReview(d)}
                    className="w-full py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-bold text-xs flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Lihat & Review Submisi
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Create */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Send className="w-5 h-5" />
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Kirim Deadline Baru
                </h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  1. Pilih Tahap Produksi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {STAGES.map(s => {
                    const Icon = STAGE_META[s.id].icon;
                    const isActive = selectedStage === s.id;
                    return (
                      <button key={s.id} type="button"
                        onClick={() => { setSelectedStage(s.id); setSelectedTemplate(null); }}
                        className={`p-3 rounded-2xl border-2 text-left transition ${
                          isActive
                            ? `bg-gradient-to-r ${STAGE_META[s.id].gradient} text-white border-transparent shadow-md`
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        }`}>
                        <Icon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-white' : 'text-amber-500'}`} />
                        <p className={`text-[11px] font-black uppercase ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                          {s.id}
                        </p>
                        <p className={`text-[9px] mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                          Bobot {s.defaultWeight}%
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  2. Template Cepat (opsional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {TEMPLATES_BY_STAGE[selectedStage].map((tpl, i) => {
                    const isSelected = selectedTemplate?.title === tpl.title;
                    const prio = getPriorityConfig(tpl.priority);
                    return (
                      <button key={i} type="button" onClick={() => handleSelectTemplate(tpl)}
                        className={`p-3 rounded-xl border-2 text-left transition ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 bg-white dark:bg-slate-800'
                        }`}>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                          {tpl.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${prio.color}`}>
                            {prio.label}
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400">{tpl.days} hari</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  3. Detail Deadline
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Judul *</label>
                  <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Deskripsi</label>
                  <textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Deadline *</label>
                    <input type="datetime-local" required value={newDue} onChange={(e) => setNewDue(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Prioritas</label>
                    <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                      <option value="LOW">Rendah</option>
                      <option value="MEDIUM">Sedang</option>
                      <option value="HIGH">Tinggi</option>
                      <option value="CRITICAL">Kritis</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  4. Target Penerima
                </label>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { val: 'SEMUA', label: 'Semua Siswa' },
                    { val: 'DIVISI', label: 'Divisi' },
                    { val: 'PERAN', label: 'Peran' },
                    { val: 'CUSTOM', label: 'Manual' },
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setNewTarget(opt.val as any)}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold transition ${
                        newTarget === opt.val
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {newTarget === 'DIVISI' && (
                  <select value={newDivision} onChange={(e) => setNewDivision(e.target.value as DivisionType)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    {DIVISIONS.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
                  </select>
                )}

                {newTarget === 'PERAN' && (
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    <option value="Pemain">Pemain</option>
                    <option value="Sutradara">Sutradara</option>
                    <option value="Asisten Sutradara">Asisten Sutradara</option>
                    <option value="Pimpinan Produksi">Pimpinan Produksi</option>
                    <option value="Sekretaris">Sekretaris</option>
                    <option value="Bendahara">Bendahara</option>
                    <option value="Anggota Perlengkapan">Anggota Perlengkapan</option>
                    <option value="Anggota Publikasi">Anggota Publikasi</option>
                    <option value="Anggota Tata Panggung">Anggota Tata Panggung</option>
                    <option value="Anggota Tata Rias">Anggota Tata Rias</option>
                    <option value="Anggota Tata Busana">Anggota Tata Busana</option>
                    <option value="Anggota Tata Musik">Anggota Tata Musik</option>
                  </select>
                )}

                {newTarget === 'CUSTOM' && (
                  <div className="max-h-40 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                    {users.filter(u => u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin').map(u => (
                      <label key={u.uid} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 cursor-pointer">
                        <input type="checkbox"
                          checked={selectedUserIds.includes(u.uid)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUserIds(prev => [...prev, u.uid]);
                            else setSelectedUserIds(prev => prev.filter(id => id !== u.uid));
                          }}
                          className="rounded border-slate-300 text-amber-500" />
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{u.displayName}</span>
                        <span className="text-[9px] text-slate-400 ml-auto">{u.role}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> {submitting ? 'Mengirim...' : 'Kirim Deadline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Submit */}
      {isSubmitOpen && selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" /> Submit Bukti
              </h3>
              <button onClick={() => setIsSubmitOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Progress (%)</label>
                <input type="range" min="0" max="100" step="10" value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value))}
                  className="w-full accent-amber-500" />
                <p className="text-center text-xs font-bold text-slate-800 dark:text-white mt-1">{progress}%</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">URL Bukti</label>
                <input type="url" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
                <textarea rows={3} value={proofNote} onChange={(e) => setProofNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900 dark:text-amber-200">
                  <input type="checkbox" checked={askExtension} onChange={(e) => setAskExtension(e.target.checked)}
                    className="rounded border-amber-300 text-amber-500" />
                  Minta perpanjangan waktu
                </label>
                {askExtension && (
                  <textarea rows={2} value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)}
                    placeholder="Alasan..."
                    className="w-full mt-2 p-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white" />
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsSubmitOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="button" onClick={handleSubmitProof} disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">
                  {submitting ? 'Mengirim...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Review */}
      {isReviewOpen && selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Review: {selectedDeadline.title}
              </h3>
              <button onClick={() => setIsReviewOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            {submissions.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-8">Belum ada siswa yang submit.</p>
            ) : (
              <div className="space-y-3">
                {submissions.map(sub => (
                  <div key={sub.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{sub.studentName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            sub.status === 'SELESAI' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' :
                            sub.status === 'TERLAMBAT' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300' :
                            'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                          }`}>{sub.status}</span>
                          {sub.extensionRequested && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Minta Perpanjangan
                              {sub.extensionApproved && <Check className="w-3 h-3" />}
                            </span>
                          )}
                        </div>
                        {sub.proofNote && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">"{sub.proofNote}"</p>}
                        {sub.proofUrl && (
                          <a href={sub.proofUrl} target="_blank" rel="noreferrer"
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">
                            Lihat Bukti
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                      <textarea rows={2} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Beri feedback..."
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white" />
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Rating:</span>
                          <select value={feedbackRating} onChange={(e) => setFeedbackRating(parseInt(e.target.value))}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white">
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} bintang</option>)}
                          </select>
                        </div>
                        {sub.extensionRequested && !sub.extensionApproved && (
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer">
                            <input type="checkbox" checked={approveExt} onChange={(e) => setApproveExt(e.target.checked)}
                              className="rounded border-emerald-300 text-emerald-500" />
                            Setujui Perpanjangan
                          </label>
                        )}
                        <button onClick={() => handleSaveFeedback(sub)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Simpan
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
