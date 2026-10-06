import React, { useState, useEffect } from 'react';
import {
  Clock, PlusCircle, CheckCircle, Users, Upload, X, Send, Timer,
  AlertTriangle, Check, BookOpen, ChevronRight, Sparkles, Target,
  ListChecks, Square, CheckSquare, User, Briefcase, Copy, FilePlus,
  Wand2, Loader2, Trash2, Pencil, Pause, Play, Ban, XCircle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { STAGES } from '../../core/constants';
import {
  DeadlineItem, DeadlineSubmission, DivisionType, UserRole,
  ProductionStage, UserProfile, ClassRoom, TaskPriority,
} from '../../core/types';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc,
  getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { DEADLINE_TEMPLATES, STAGE_INFO } from '../../core/deadlineTemplates';

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  LOW: { label: 'Rendah', color: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Sedang', color: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  HIGH: { label: 'Tinggi', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  CRITICAL: { label: 'Kritis', color: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' },
};

function getPriorityConfig(priority?: string) {
  return PRIORITY_CONFIG[priority || 'MEDIUM'] || PRIORITY_CONFIG.MEDIUM;
}

const CAN_CREATE_DEADLINE_ROLES = ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'];

const ROLE_LIST: UserRole[] = [
  'Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Sutradara', 'Asisten Sutradara', 'Pemeran',
  'Koordinator Perlengkapan', 'Koordinator Publikasi', 'Koordinator Tata Panggung',
  'Koordinator Tata Rias', 'Koordinator Tata Busana', 'Koordinator Tata Musik',
  'Anggota Perlengkapan', 'Anggota Publikasi', 'Anggota Tata Panggung',
  'Anggota Tata Rias', 'Anggota Tata Busana', 'Anggota Tata Musik',
];

const DIVISION_LIST: DivisionType[] = [
  'Pengurus Inti', 'Pemeran', 'Perlengkapan', 'Publikasi & Dokumentasi',
  'Tata Panggung', 'Tata Rias', 'Tata Busana', 'Tata Musik & Suara',
];

interface TargetItem {
  type: 'PERAN' | 'DIVISI';
  name: string;
}

const DeadlineCopyModal: React.FC<{
  allClasses: ClassRoom[];
  currentClassId: string;
  deadlines: DeadlineItem[];
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ allClasses, currentClassId, deadlines, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDeadlineIds, setSelectedDeadlineIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recipientPreview, setRecipientPreview] = useState<Record<string, number>>({});

  useEffect(() => {
    setSelectedDeadlineIds(deadlines.map(d => d.id));
  }, [deadlines]);

  const otherClasses = allClasses.filter(c => c.id !== currentClassId);

  const toggleDeadline = (id: string) => {
    setSelectedDeadlineIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleClass = (id: string) => {
    setSelectedClassIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllDeadlines = () => setSelectedDeadlineIds(deadlines.map(d => d.id));
  const deselectAllDeadlines = () => setSelectedDeadlineIds([]);
  const selectAllClasses = () => setSelectedClassIds(otherClasses.map(c => c.id));
  const deselectAllClasses = () => setSelectedClassIds([]);

  useEffect(() => {
    if (selectedClassIds.length === 0 || selectedDeadlineIds.length === 0) {
      setRecipientPreview({});
      return;
    }
    (async () => {
      const preview: Record<string, number> = {};
      for (const cid of selectedClassIds) {
        try {
          const users = await fetchUsersByClass(cid);
          const targets = new Set<string>();
          users.forEach(u => {
            if (u.role === 'Guru Pengampu' || u.role === 'Admin' || u.role === 'Super Admin') return;
            for (const did of selectedDeadlineIds) {
              const d = deadlines.find(x => x.id === did);
              if (!d) continue;
              const targetRole = (d as any).targetRole;
              const targetDivision = (d as any).targetDivision;
              if (d.targetScope === 'SEMUA') { targets.add(u.uid); break; }
              if (d.targetScope === 'PERAN' && targetRole && u.role === targetRole) { targets.add(u.uid); break; }
              if (d.targetScope === 'DIVISI' && targetDivision && u.divisionName === targetDivision) { targets.add(u.uid); break; }
              if (d.targetScope === 'CUSTOM') { targets.add(u.uid); break; }
            }
          });
          preview[cid] = targets.size;
        } catch (err) {
          preview[cid] = 0;
        }
      }
      setRecipientPreview(preview);
    })();
  }, [selectedClassIds, selectedDeadlineIds, deadlines]);

  const handleCopy = async () => {
    if (!user) return;
    if (selectedDeadlineIds.length === 0) { showToast('Pilih minimal 1 deadline.', 'warning'); return; }
    if (selectedClassIds.length === 0) { showToast('Pilih minimal 1 kelas tujuan.', 'warning'); return; }

    setSubmitting(true);
    let totalCreated = 0;
    let totalNotif = 0;

    try {
      for (const targetClassId of selectedClassIds) {
        const targetClass = allClasses.find(c => c.id === targetClassId);
        if (!targetClass) continue;

        const targetUsers = await fetchUsersByClass(targetClassId);
        const studentsTarget = targetUsers.filter(u =>
          u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
        );

        for (const deadlineId of selectedDeadlineIds) {
          const source = deadlines.find(d => d.id === deadlineId);
          if (!source) continue;

          const targetRole = (source as any).targetRole;
          const targetDivision = (source as any).targetDivision;

          const recipientIds = new Set<string>();
          studentsTarget.forEach(u => {
            if (source.targetScope === 'SEMUA') recipientIds.add(u.uid);
            else if (source.targetScope === 'PERAN' && targetRole && u.role === targetRole) recipientIds.add(u.uid);
            else if (source.targetScope === 'DIVISI' && targetDivision && u.divisionName === targetDivision) recipientIds.add(u.uid);
            else if (source.targetScope === 'CUSTOM') recipientIds.add(u.uid);
          });

          const newRef = doc(collection(db, 'deadlines'));
          await setDoc(newRef, {
            id: newRef.id,
            classId: targetClassId,
            title: source.title,
            description: source.description,
            dueDate: source.dueDate,
            priority: source.priority,
            targetScope: source.targetScope,
            targetDivision: targetDivision,
            targetRole: targetRole,
            targetUserIds: Array.from(recipientIds),
            stage: (source as any).stage,
            isCritical: (source as any).isCritical || false,
            createdBy: user.uid,
            creatorName: user.displayName,
            creatorRole: user.role,
            createdAt: new Date().toISOString(),
          });
          totalCreated++;

          if (recipientIds.size > 0) {
            const batch = writeBatch(db);
            const nowStr = new Date().toISOString();
            recipientIds.forEach(uid => {
              const notifRef = doc(collection(db, 'notifications'));
              batch.set(notifRef, {
                id: notifRef.id,
                userId: uid,
                classId: targetClassId,
                title: '📌 Deadline Baru',
                message: `${user.displayName} mengirim deadline untuk ${targetClass.name}: "${source.title}"`,
                category: 'Tugas',
                read: false,
                link: 'deadline',
                createdAt: nowStr,
              });
            });
            await batch.commit();
            totalNotif += recipientIds.size;
          }
        }
      }

      showToast(`✅ ${totalCreated} deadline disalin! ${totalNotif} siswa menerima notifikasi.`, 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast('Gagal menyalin: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalRecipients = Object.values(recipientPreview).reduce((s, n) => s + n, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-800 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
                <Copy className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Salin Deadline</span>
                <h3 className="text-lg font-black mt-0.5">Langkah {step} dari 3</h3>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilih Deadline</h4>
                <div className="flex items-center gap-2">
                  <button onClick={selectAllDeadlines} className="text-[11px] font-bold text-blue-600 hover:underline">✓ Semua</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAllDeadlines} className="text-[11px] font-bold text-rose-600 hover:underline">✕ Hapus</button>
                </div>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {deadlines.map(d => {
                  const isSelected = selectedDeadlineIds.includes(d.id);
                  return (
                    <button key={d.id} onClick={() => toggleDeadline(d.id)}
                      className={`w-full p-3 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                        isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}>
                      <div className={`p-0.5 rounded-md shrink-0 mt-0.5 ${isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}`}>
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                      </div>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-2">{d.title}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilih Kelas Tujuan</h4>
                <div className="flex items-center gap-2">
                  <button onClick={selectAllClasses} className="text-[11px] font-bold text-blue-600 hover:underline">✓ Semua</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAllClasses} className="text-[11px] font-bold text-rose-600 hover:underline">✕ Hapus</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherClasses.map(c => {
                  const isSelected = selectedClassIds.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleClass(c.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition ${
                        isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-0.5 rounded-md shrink-0 mt-0.5 ${isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}`}>
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white">{c.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{c.code}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">Konfirmasi</h4>
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-2 border-purple-200 dark:border-purple-500/30">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 uppercase">Deadline</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{selectedDeadlineIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 uppercase">Kelas</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{selectedClassIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 uppercase">Siswa</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{totalRecipients}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t flex justify-between items-center gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Batal</button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as any)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700">
                ← Kembali
              </button>
            )}
            {step < 3 && (
              <button onClick={() => setStep((step + 1) as any)}
                disabled={(step === 1 && selectedDeadlineIds.length === 0) || (step === 2 && selectedClassIds.length === 0)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {step === 3 && (
              <button onClick={handleCopy} disabled={submitting || totalRecipients === 0}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Menyalin...' : `Salin ke ${selectedClassIds.length} Kelas`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DeadlineModule: React.FC = () => {
  const { user, activeClass, classes } = useAuth();
  const { showToast } = useToast();

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, DeadlineSubmission>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineItem | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);
  const [filterStage, setFilterStage] = useState<'ALL' | ProductionStage>('ALL');
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<TargetItem[]>([]);
  const [targetAll, setTargetAll] = useState(false);
  const [dueDateOverride, setDueDateOverride] = useState('');
  const [useTemplateTarget, setUseTemplateTarget] = useState(true);
  // State untuk Edit Deadline
  const [editingDeadline, setEditingDeadline] = useState<DeadlineItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editIsCritical, setEditIsCritical] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualDueDate, setManualDueDate] = useState('');
  const [manualPriority, setManualPriority] = useState<TaskPriority>('MEDIUM');
  const [manualStage, setManualStage] = useState<ProductionStage>('PELAKSANAAN');
  const [manualTargetAll, setManualTargetAll] = useState(true);
  const [manualTargets, setManualTargets] = useState<TargetItem[]>([]);
  const [manualIsCritical, setManualIsCritical] = useState(false);

  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [progress, setProgress] = useState(50);
  const [askExtension, setAskExtension] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');

  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [approveExt, setApproveExt] = useState(false);

  const canCreate = !!user && CAN_CREATE_DEADLINE_ROLES.includes(user.role);

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

   const getCountdown = (dueDate?: string, status?: string) => {
    if (status === 'CANCELLED') {
      return { text: '🚫 DIBATALKAN — tidak perlu dikerjakan', color: 'text-slate-600 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:text-slate-400' };
    }
    if (status === 'HOLD') {
      return { text: '⏸️ DITAHAN — countdown di-pause', color: 'text-amber-800 bg-amber-50 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300' };
    }
    if (!dueDate) return { text: 'Tanpa deadline', color: 'text-slate-700 bg-slate-50 border-slate-200' };
    const diff = new Date(dueDate).getTime() - now.getTime();
    if (isNaN(diff)) return { text: 'Format salah', color: 'text-slate-700 bg-slate-50 border-slate-200' };
    if (diff <= 0) {
      const lateDays = Math.floor(Math.abs(diff) / 86400000);
      return { text: `Terlambat ${lateDays} hari`, color: 'text-rose-700 bg-rose-100 border-rose-300' };
    }
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (hours < 24) return { text: `${hours} jam lagi`, color: 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse font-bold' };
    if (hours <= 72) return { text: `${days} hari lagi`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { text: `${days} hari lagi`, color: 'text-slate-700 bg-slate-50 border-slate-200' };
  };

  const handleOpenTemplate = () => {
    setWizardStep(1);
    setSelectedStage('PELAKSANAAN');
    setSelectedTemplateIds([]);
    setSelectedTargets([]);
    setTargetAll(false);
    setDueDateOverride('');
    setUseTemplateTarget(true);
    setIsTemplateOpen(true);
  };

  const handleOpenManual = () => {
    setManualTitle('');
    setManualDescription('');
    setManualDueDate('');
    setManualPriority('MEDIUM');
    setManualStage('PELAKSANAAN');
    setManualTargetAll(true);
    setManualTargets([]);
    setManualIsCritical(false);
    setIsManualOpen(true);
  };

  const currentTemplates = DEADLINE_TEMPLATES[selectedStage];

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAllTemplates = () => setSelectedTemplateIds(currentTemplates.map(t => t.id));
  const deselectAllTemplates = () => setSelectedTemplateIds([]);

  const toggleTarget = (type: 'PERAN' | 'DIVISI', name: string) => {
    setSelectedTargets(prev => {
      const exists = prev.find(t => t.type === type && t.name === name);
      if (exists) return prev.filter(t => !(t.type === type && t.name === name));
      return [...prev, { type, name }];
    });
  };

  const isTargetSelected = (type: 'PERAN' | 'DIVISI', name: string) =>
    selectedTargets.some(t => t.type === type && t.name === name);

  const manualToggleTarget = (type: 'PERAN' | 'DIVISI', name: string) => {
    setManualTargets(prev => {
      const exists = prev.find(t => t.type === type && t.name === name);
      if (exists) return prev.filter(t => !(t.type === type && t.name === name));
      return [...prev, { type, name }];
    });
  };

  const manualIsTargetSelected = (type: 'PERAN' | 'DIVISI', name: string) =>
    manualTargets.some(t => t.type === type && t.name === name);

  const recipientCount = (() => {
    if (useTemplateTarget) {
      const matched = new Set<string>();
      selectedTemplateIds.forEach(tplId => {
        const tpl = currentTemplates.find(t => t.id === tplId);
        if (!tpl) return;
        users.forEach(u => {
          if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
          if (u.role === 'Admin' || u.role === 'Super Admin') return;
          if (tpl.targetType === 'SEMUA') matched.add(u.uid);
          if (tpl.targetType === 'PERAN' && tpl.targetRole && u.role === tpl.targetRole) matched.add(u.uid);
          if (tpl.targetType === 'DIVISI' && tpl.targetDivision && u.divisionName === tpl.targetDivision) matched.add(u.uid);
        });
      });
      return matched.size;
    }
    if (targetAll) {
      return users.filter(u =>
        u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
        u.role !== 'Admin' && u.role !== 'Super Admin'
      ).length;
    }
    const matched = new Set<string>();
    selectedTargets.forEach(t => {
      users.forEach(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
        if (u.role === 'Admin' || u.role === 'Super Admin') return;
        if (t.type === 'PERAN' && u.role === t.name) matched.add(u.uid);
        if (t.type === 'DIVISI' && u.divisionName === t.name) matched.add(u.uid);
      });
    });
    return matched.size;
  })();

  const manualRecipientCount = (() => {
    if (manualTargetAll) {
      return users.filter(u =>
        u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
        u.role !== 'Admin' && u.role !== 'Super Admin'
      ).length;
    }
    const matched = new Set<string>();
    manualTargets.forEach(t => {
      users.forEach(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
        if (u.role === 'Admin' || u.role === 'Super Admin') return;
        if (t.type === 'PERAN' && u.role === t.name) matched.add(u.uid);
        if (t.type === 'DIVISI' && u.divisionName === t.name) matched.add(u.uid);
      });
    });
    return matched.size;
  })();
  const handleOpenEdit = (d: DeadlineItem) => {
    setEditingDeadline(d);
    setEditTitle(d.title);
    setEditDesc(d.description || '');
    setEditDueDate(d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 16) : '');
    setEditPriority(d.priority || 'MEDIUM');
    setEditIsCritical((d as any).isCritical || false);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeadline || !user) return;
    setActionLoading(editingDeadline.id);
    try {
      await updateDoc(doc(db, 'deadlines', editingDeadline.id), {
        title: editTitle.trim(),
        description: editDesc.trim(),
        dueDate: new Date(editDueDate).toISOString(),
        priority: editPriority,
        isCritical: editIsCritical,
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName,
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Deadline', targetId: editingDeadline.id,
        details: `Edit deadline: ${editTitle}`,
      });
      showToast('Deadline berhasil diperbarui!', 'success');
      setIsEditOpen(false);
      setEditingDeadline(null);
    } catch (err: any) {
      showToast('Gagal edit: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleHold = async (d: DeadlineItem) => {
    if (!user) return;
    const isHeld = (d as any).status === 'HOLD';
    const newStatus = isHeld ? 'ACTIVE' : 'HOLD';
    if (!confirm(
      isHeld
        ? `Aktifkan kembali deadline "${d.title}"?\n\nCountdown akan berjalan lagi.`
        : `Tahan deadline "${d.title}"?\n\nCountdown akan di-pause — tidak dihitung overdue sementara.`
    )) return;

    setActionLoading(d.id);
    try {
      await updateDoc(doc(db, 'deadlines', d.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName,
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Deadline', targetId: d.id,
        details: `${isHeld ? 'Aktifkan' : 'Tahan'} deadline: ${d.title}`,
      });
      showToast(isHeld ? '✅ Deadline diaktifkan kembali.' : '⏸️ Deadline ditahan.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelDeadline = async (d: DeadlineItem) => {
    if (!user) return;
    if (!confirm(
      `BATALKAN deadline "${d.title}"?\n\n` +
      `Deadline akan ditandai "DIBATALKAN" — siswa tidak perlu mengerjakan.\n` +
      `Bisa diaktifkan kembali nanti bila perlu.`
    )) return;

    setActionLoading(d.id);
    try {
      await updateDoc(doc(db, 'deadlines', d.id), {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelledBy: user.displayName,
        updatedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Deadline', targetId: d.id,
        details: `Batalkan deadline: ${d.title}`,
      });
      showToast('🚫 Deadline dibatalkan.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreDeadline = async (d: DeadlineItem) => {
    if (!user) return;
    if (!confirm(`Aktifkan kembali deadline "${d.title}"?`)) return;
    setActionLoading(d.id);
    try {
      await updateDoc(doc(db, 'deadlines', d.id), {
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName,
      });
      showToast('✅ Deadline diaktifkan kembali.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setActionLoading(null);
    }
  };
  const handleDeleteDeadline = async (d: DeadlineItem) => {
    if (!user) return;
    if (!confirm(`Hapus deadline "${d.title}"?\n\nTindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteDoc(doc(db, 'deadlines', d.id));
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'Deadline', targetId: d.id,
        details: `Hapus deadline: ${d.title}`,
      });
      showToast('Deadline berhasil dihapus.', 'success');
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!user || !activeClass) return;
    if (selectedTemplateIds.length === 0) { showToast('Pilih minimal 1 template.', 'warning'); return; }
    if (!useTemplateTarget && !targetAll && selectedTargets.length === 0) {
      showToast('Pilih minimal 1 target.', 'warning');
      return;
    }

    setSubmitting(true);
    let success = 0;
    let totalNotif = 0;

    try {
      const allRecipientIds = new Set<string>();

      for (const tplId of selectedTemplateIds) {
        const tpl = currentTemplates.find(t => t.id === tplId);
        if (!tpl) continue;

        let dueIso: string;
        if (dueDateOverride) {
          dueIso = new Date(dueDateOverride).toISOString();
        } else {
          const d = new Date();
          d.setDate(d.getDate() + tpl.daysFromNow);
          d.setHours(23, 59, 0, 0);
          dueIso = d.toISOString();
        }

        const recipientIds = new Set<string>();
        let targetScope: 'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM';
        let targetRole: string | undefined;
        let targetDivision: string | undefined;

        if (useTemplateTarget) {
          targetScope = tpl.targetType as any;
          targetRole = tpl.targetRole;
          targetDivision = tpl.targetDivision as any;
        } else {
          targetScope = targetAll ? 'SEMUA' : 'CUSTOM';
        }

        users.forEach(u => {
          if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
          if (u.role === 'Admin' || u.role === 'Super Admin') return;

          if (useTemplateTarget) {
            if (tpl.targetType === 'SEMUA') recipientIds.add(u.uid);
            if (tpl.targetType === 'PERAN' && tpl.targetRole && u.role === tpl.targetRole) recipientIds.add(u.uid);
            if (tpl.targetType === 'DIVISI' && tpl.targetDivision && u.divisionName === tpl.targetDivision) recipientIds.add(u.uid);
          } else {
            if (targetAll) recipientIds.add(u.uid);
            else {
              selectedTargets.forEach(t => {
                if (t.type === 'PERAN' && u.role === t.name) recipientIds.add(u.uid);
                if (t.type === 'DIVISI' && u.divisionName === t.name) recipientIds.add(u.uid);
              });
            }
          }
        });

        const newRef = doc(collection(db, 'deadlines'));
        await setDoc(newRef, {
          id: newRef.id,
          classId: activeClass.id,
          title: tpl.title,
          description: tpl.description,
          dueDate: dueIso,
          priority: tpl.priority,
          targetScope: targetScope,
          targetUserIds: Array.from(recipientIds),
          targetRole: targetRole,
          targetDivision: targetDivision,
          stage: selectedStage,
          isCritical: tpl.isCritical || false,
          createdBy: user.uid,
          creatorName: user.displayName,
          creatorRole: user.role,
          createdAt: new Date().toISOString(),
          templateReference: tpl.reference,
        });

        recipientIds.forEach(id => allRecipientIds.add(id));
        totalNotif += recipientIds.size;
        success++;
      }

      if (allRecipientIds.size > 0) {
        const batch = writeBatch(db);
        const nowStr = new Date().toISOString();
        allRecipientIds.forEach(uid => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: uid,
            classId: activeClass.id,
            title: `📌 ${success} Deadline Baru`,
            message: `${user.displayName} mengirim ${success} deadline (${selectedStage}).`,
            category: 'Tugas', read: false, link: 'deadline',
            createdAt: nowStr,
          });
        });
        await batch.commit();
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'DeadlineBatch', targetId: 'batch',
        details: `Kirim ${success} deadline ke ${totalNotif} penerima (${selectedStage})`,
      });

      showToast(`✅ ${success} deadline dikirim ke ${totalNotif} penerima!`, 'success');
      setIsTemplateOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!manualTitle.trim()) { showToast('Judul wajib diisi.', 'warning'); return; }
    if (!manualDueDate) { showToast('Tenggat wajib diisi.', 'warning'); return; }
    if (!manualTargetAll && manualTargets.length === 0) {
      showToast('Pilih minimal 1 target.', 'warning'); return;
    }

    setSubmitting(true);
    try {
      const recipientIds = new Set<string>();
      users.forEach(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
        if (u.role === 'Admin' || u.role === 'Super Admin') return;
        if (manualTargetAll) { recipientIds.add(u.uid); return; }
        manualTargets.forEach(t => {
          if (t.type === 'PERAN' && u.role === t.name) recipientIds.add(u.uid);
          if (t.type === 'DIVISI' && u.divisionName === t.name) recipientIds.add(u.uid);
        });
      });

      const newRef = doc(collection(db, 'deadlines'));
      await setDoc(newRef, {
        id: newRef.id,
        classId: activeClass.id,
        title: manualTitle.trim(),
        description: manualDescription.trim(),
        dueDate: new Date(manualDueDate).toISOString(),
        priority: manualPriority,
        targetScope: manualTargetAll ? 'SEMUA' : 'CUSTOM',
        targetUserIds: Array.from(recipientIds),
        stage: manualStage,
        isCritical: manualIsCritical,
        createdBy: user.uid,
        creatorName: user.displayName,
        creatorRole: user.role,
        createdAt: new Date().toISOString(),
        isManual: true,
      });

      if (recipientIds.size > 0) {
        const batch = writeBatch(db);
        const nowStr = new Date().toISOString();
        recipientIds.forEach(uid => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: uid,
            classId: activeClass.id,
            title: '📌 Deadline Baru',
            message: `${user.displayName}: "${manualTitle.trim()}"`,
            category: 'Tugas', read: false, link: 'deadline',
            createdAt: nowStr,
          });
        });
        await batch.commit();
      }

      showToast(`✅ Deadline dikirim ke ${manualRecipientCount} siswa!`, 'success');
      setIsManualOpen(false);
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
      showToast('Bukti dikirim!', 'success');
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
    // Siswa tidak perlu lihat deadline yang dibatalkan (biar fokus)
    if (!canCreate && (d as any).status === 'CANCELLED') return false;
    if (!canCreate && user) {
      const tu: string[] = (d as any).targetUserIds || [];
      if (d.targetScope === 'CUSTOM' && tu.length > 0 && !tu.includes(user.uid)) return false;
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
                Manajemen Tugas
              </span>
              <h2 className="text-xl font-black text-white mt-1">Tugas & Deadline Produksi</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Buat dari template, input manual, atau salin ke kelas lain
              </p>
            </div>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleOpenManual}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition">
                <FilePlus className="w-4 h-4" /> Buat Manual
              </button>
              <button onClick={handleOpenTemplate}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition">
                <Wand2 className="w-4 h-4" /> Dari Template
              </button>
              <button onClick={() => setIsCopyOpen(true)} disabled={deadlines.length === 0}
                className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition">
                <Copy className="w-4 h-4" /> Salin
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setFilterStage('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            filterStage === 'ALL' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Semua ({deadlines.length})
        </button>
        {STAGES.map(s => {
          const count = deadlines.filter(d => (d as any).stage === s.id).length;
          const isActive = filterStage === s.id;
          return (
            <button key={s.id} onClick={() => setFilterStage(s.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                isActive ? `bg-gradient-to-r ${STAGE_INFO[s.id].gradient} text-white shadow-md`
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              {s.id} ({count})
            </button>
          );
        })}
      </div>

      {visibleDeadlines.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Timer className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Deadline</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canCreate ? 'Klik "Buat Manual" atau "Dari Template".' : 'Tunggu instruksi Guru Pengampu.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleDeadlines.map(d => {
            const cd = getCountdown(d.dueDate, (d as any).status);
            const mySub = mySubmissions[d.id];
            const priority = getPriorityConfig(d.priority);
            const dStage = (d as any).stage as ProductionStage | undefined;
            const stageInfo = dStage ? STAGE_INFO[dStage] : null;
            const targetCount = ((d as any).targetUserIds || []).length;
            const isCritical = (d as any).isCritical;
            const isManual = (d as any).isManual;

            return (
              <div key={d.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-rose-300 transition shadow-sm space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {stageInfo && dStage && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r ${stageInfo.gradient} text-white`}>
                      {dStage}
                    </span>
                  )}
                  {isCritical && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">
                      ★ KRITIS
                    </span>
                  )}
                  {isManual && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                      MANUAL
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${priority.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                                      {(d as any).status === 'HOLD' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 flex items-center gap-1">
                      <Pause className="w-3 h-3" /> DITAHAN
                    </span>
                  )}
                  {(d as any).status === 'CANCELLED' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 flex items-center gap-1">
                      <Ban className="w-3 h-3" /> DIBATALKAN
                    </span>
                  )}
                    {priority.label}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {d.targetScope === 'SEMUA' ? 'Semua Siswa' :
                     d.targetScope === 'PERAN' && (d as any).targetRole ? `👤 ${(d as any).targetRole}` :
                     d.targetScope === 'DIVISI' && (d as any).targetDivision ? `👥 ${(d as any).targetDivision}` :
                     `${targetCount} penerima`}
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{d.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{d.description}</p>

                <div className={`p-3 rounded-xl border text-xs font-bold text-center ${cd.color}`}>
                  <Clock className="w-4 h-4 inline mr-1" /> {cd.text}
                </div>

                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Oleh <strong className="text-slate-600 dark:text-slate-300">{d.creatorName || 'Guru'}</strong>
                  {d.dueDate ? ` — ${new Date(d.dueDate).toLocaleString('id-ID')}` : ''}
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
                        <button onClick={() => {
                          setSelectedDeadline(d);
                          setProofUrl(mySub.proofUrl || '');
                          setProofNote(mySub.proofNote || '');
                          setProgress(mySub.progress || 50);
                          setIsSubmitOpen(true);
                        }}
                          className="w-full py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs">
                          <Upload className="w-3.5 h-3.5 inline mr-1" /> Update Bukti
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => {
                        setSelectedDeadline(d);
                        setProofUrl(''); setProofNote(''); setProgress(50);
                        setIsSubmitOpen(true);
                      }}
                        className="w-full py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs">
                        <Upload className="w-3.5 h-3.5 inline mr-1" /> Submit Bukti
                      </button>
                    )}
                  </div>
                )}

                {canCreate && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    {/* Baris 1: Edit/Hold/Cancel/Restore */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button onClick={() => handleOpenEdit(d)}
                        disabled={actionLoading === d.id || (d as any).status === 'CANCELLED'}
                        className="py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40"
                        title="Edit deadline">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>

                      {(d as any).status === 'CANCELLED' ? (
                        <button onClick={() => handleRestoreDeadline(d)}
                          disabled={actionLoading === d.id}
                          className="py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40"
                          title="Aktifkan kembali">
                          <Play className="w-3.5 h-3.5" /> Aktifkan
                        </button>
                      ) : (d as any).status === 'HOLD' ? (
                        <button onClick={() => handleToggleHold(d)}
                          disabled={actionLoading === d.id}
                          className="py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40"
                          title="Aktifkan kembali">
                          <Play className="w-3.5 h-3.5" /> Lanjut
                        </button>
                      ) : (
                        <button onClick={() => handleToggleHold(d)}
                          disabled={actionLoading === d.id}
                          className="py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40"
                          title="Tahan deadline">
                          <Pause className="w-3.5 h-3.5" /> Tahan
                        </button>
                      )}

                      {(d as any).status !== 'CANCELLED' ? (
                        <button onClick={() => handleCancelDeadline(d)}
                          disabled={actionLoading === d.id}
                          className="py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40"
                          title="Batalkan deadline">
                          <Ban className="w-3.5 h-3.5" /> Batal
                        </button>
                      ) : (
                        <button onClick={() => handleDeleteDeadline(d)}
                          className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-[10px] flex items-center justify-center gap-1"
                          title="Hapus permanen">
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      )}
                    </div>

                    {/* Baris 2: Lihat Submisi + Hapus */}
                    <div className="grid grid-cols-5 gap-1.5">
                      <button onClick={() => handleOpenReview(d)}
                        className="col-span-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Lihat Submisi ({targetCount})
                      </button>
                      <button onClick={() => handleDeleteDeadline(d)}
                        className="py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-bold text-xs flex items-center justify-center"
                        title="Hapus permanen">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
      {isManualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleCreateManual}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
                    <FilePlus className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Buat Manual</span>
                    <h3 className="text-lg font-black mt-0.5">Tugas & Deadline Produksi</h3>
                  </div>
                </div>
                <button type="button" onClick={() => setIsManualOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Tugas <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Contoh: Latihan Blocking Babak 2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi / Instruksi
                </label>
                <textarea rows={3} value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Jelaskan detail tugas..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tahap <span className="text-rose-500">*</span>
                  </label>
                  <select value={manualStage} onChange={(e) => setManualStage(e.target.value as ProductionStage)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    <option value="PERSIAPAN">Persiapan</option>
                    <option value="PELAKSANAAN">Pelaksanaan</option>
                    <option value="PERTUNJUKAN">Pertunjukan</option>
                    <option value="PASCA">Pasca Produksi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prioritas <span className="text-rose-500">*</span>
                  </label>
                  <select value={manualPriority}
                    onChange={(e) => setManualPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    <option value="LOW">Rendah</option>
                    <option value="MEDIUM">Sedang</option>
                    <option value="HIGH">Tinggi</option>
                    <option value="CRITICAL">Kritis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tenggat Waktu <span className="text-rose-500">*</span>
                </label>
                <input type="datetime-local" required value={manualDueDate}
                  onChange={(e) => setManualDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-900 dark:text-rose-200">
                  <input type="checkbox" checked={manualIsCritical}
                    onChange={(e) => setManualIsCritical(e.target.checked)}
                    className="rounded border-rose-300 text-rose-500" />
                  <span>★ Tandai sebagai Tugas Kritis</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Target Penerima <span className="text-rose-500">*</span>
                </label>

                <button type="button"
                  onClick={() => { setManualTargetAll(!manualTargetAll); setManualTargets([]); }}
                  className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition mb-3 ${
                    manualTargetAll ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700'
                  }`}>
                  <div className={`p-0.5 rounded-md shrink-0 ${manualTargetAll ? 'bg-amber-500 text-white' : 'border-2 border-slate-300'}`}>
                    {manualTargetAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">🎯 Semua Siswa</p>
                  </div>
                </button>

                {!manualTargetAll && (
                  <>
                    <div className="mb-3">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Per Peran</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {ROLE_LIST.map(r => {
                          const sel = manualIsTargetSelected('PERAN', r);
                          return (
                            <button type="button" key={r} onClick={() => manualToggleTarget('PERAN', r)}
                              className={`p-2 rounded-lg border-2 text-[10px] font-bold transition text-left flex items-center gap-1.5 ${
                                sel ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}>
                              {sel ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0" />}
                              <span className="truncate">{r}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">Per Divisi</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {DIVISION_LIST.map(d => {
                          const sel = manualIsTargetSelected('DIVISI', d);
                          return (
                            <button type="button" key={d} onClick={() => manualToggleTarget('DIVISI', d)}
                              className={`p-2 rounded-lg border-2 text-[10px] font-bold transition text-left flex items-center gap-1.5 ${
                                sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}>
                              {sel ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0" />}
                              <span className="truncate">{d}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                    <strong>{manualRecipientCount} siswa</strong> akan menerima notifikasi
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsManualOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Batal
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Mengirim...' : `Kirim ke ${manualRecipientCount} Siswa`}
              </button>
            </div>
          </form>
        </div>
      )}

      {isTemplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[95vh] overflow-y-auto my-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Wand2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Kirim dari Template</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Langkah {wizardStep} dari 4
                      {wizardStep === 2 && ` — ${STAGE_INFO[selectedStage].label}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsTemplateOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-4">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={`flex-1 h-1.5 rounded-full transition ${
                    s <= wizardStep
                      ? `bg-gradient-to-r ${STAGE_INFO[selectedStage].gradient}`
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                ))}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {wizardStep === 1 && (
                <>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Langkah 1: Pilih Tahap</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STAGES.map(s => {
                      const info = STAGE_INFO[s.id];
                      const tplCount = DEADLINE_TEMPLATES[s.id].length;
                      const isSelected = selectedStage === s.id;
                      return (
                        <button key={s.id} onClick={() => { setSelectedStage(s.id); setSelectedTemplateIds([]); setWizardStep(2); }}
                          className={`p-4 rounded-2xl border-2 text-left transition hover:scale-[1.02] bg-gradient-to-br ${info.gradient} text-white border-transparent shadow-md ${
                            isSelected ? 'ring-4 ring-amber-400/50' : ''
                          }`}>
                          <p className="text-xs font-black uppercase tracking-wider">{s.id}</p>
                          <p className="text-[10px] mt-1 opacity-90">{info.desc}</p>
                          <p className="text-[10px] mt-2 font-bold bg-white/20 px-2 py-0.5 rounded-md inline-block">{tplCount} template</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {wizardStep === 2 && (
                <>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Tahap: <span className={`bg-gradient-to-r ${STAGE_INFO[selectedStage].gradient} bg-clip-text text-transparent font-black`}>{STAGE_INFO[selectedStage].label}</span>
                      </span>
                    </div>
                    <button onClick={() => setWizardStep(1)} className="text-[11px] font-bold text-blue-600 hover:underline">← Ganti Tahap</button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <strong>{currentTemplates.length} template</strong> — terpilih: <strong className="text-emerald-600">{selectedTemplateIds.length}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={selectAllTemplates} className="text-[11px] font-bold text-blue-600 hover:underline">✓ Semua</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={deselectAllTemplates} className="text-[11px] font-bold text-rose-600 hover:underline">✕ Hapus</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                    {currentTemplates.map(tpl => {
                      const prio = getPriorityConfig(tpl.priority);
                      const isSelected = selectedTemplateIds.includes(tpl.id);
                      return (
                        <button key={tpl.id} onClick={() => toggleTemplate(tpl.id)}
                          className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                            isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-400'
                          }`}>
                          <div className={`p-0.5 rounded-md shrink-0 mt-0.5 ${isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}`}>
                            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              {tpl.isCritical && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300">
                                  ★ KRITIS
                                </span>
                              )}
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${prio.color}`}>
                                {prio.label}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40 flex items-center gap-0.5">
                                {tpl.targetRole ? `👤 ${tpl.targetRole}` : tpl.targetDivision ? `👥 ${tpl.targetDivision}` : '🌐 Semua'}
                              </span>
                            </div>
                            <p className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-2">{tpl.title}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{tpl.description}</p>
                            <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-1 italic">📎 {tpl.reference}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {wizardStep === 3 && (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Langkah 3: Target Penerima</h4>
                    <button onClick={() => setWizardStep(2)} className="text-[11px] font-bold text-blue-600 hover:underline">← Ganti Template</button>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-300 dark:border-emerald-500/40">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={useTemplateTarget}
                        onChange={(e) => setUseTemplateTarget(e.target.checked)}
                        className="mt-0.5 rounded border-emerald-300 text-emerald-500" />
                      <div>
                        <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                          🎯 Kirim sesuai target template (disarankan)
                        </p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                          Deadline akan otomatis dikirim ke peran/divisi yang sesuai dengan template masing-masing.
                        </p>
                      </div>
                    </label>
                  </div>

                  {!useTemplateTarget && (
                    <>
                      <button onClick={() => { setTargetAll(!targetAll); setSelectedTargets([]); }}
                        className={`w-full p-4 rounded-2xl border-2 text-left flex items-center gap-3 transition ${
                          targetAll ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700'
                        }`}>
                        <div className={`p-0.5 rounded-md shrink-0 ${targetAll ? 'bg-amber-500 text-white' : 'border-2 border-slate-300'}`}>
                          {targetAll ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-transparent" />}
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white">🎯 Semua Siswa</p>
                        </div>
                      </button>

                      {!targetAll && (
                        <>
                          <div>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Per Peran</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {ROLE_LIST.map(r => {
                                const sel = isTargetSelected('PERAN', r);
                                return (
                                  <button key={r} onClick={() => toggleTarget('PERAN', r)}
                                    className={`p-2.5 rounded-xl border-2 text-[11px] font-bold transition text-left flex items-center gap-2 ${
                                      sel ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                    {sel ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    <span className="truncate">{r}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Per Divisi</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {DIVISION_LIST.map(d => {
                                const sel = isTargetSelected('DIVISI', d);
                                return (
                                  <button key={d} onClick={() => toggleTarget('DIVISI', d)}
                                    className={`p-2.5 rounded-xl border-2 text-[11px] font-bold transition text-left flex items-center gap-2 ${
                                      sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                    {sel ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    <span className="truncate">{d}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Override Deadline (Opsional)
                    </label>
                    <input type="datetime-local" value={dueDateOverride}
                      onChange={(e) => setDueDateOverride(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                  </div>
                </>
              )}

              {wizardStep === 4 && (
                <>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Langkah 4: Konfirmasi</h4>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Tahap</p>
                      <p className={`text-xs font-bold bg-gradient-to-r ${STAGE_INFO[selectedStage].gradient} bg-clip-text text-transparent`}>
                        {STAGE_INFO[selectedStage].label}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Template</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedTemplateIds.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Mode Target</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {useTemplateTarget ? '🎯 Sesuai target template' : targetAll ? '🎯 Semua Siswa' : 'Custom'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Penerima</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{recipientCount} siswa</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center gap-2 sticky bottom-0 bg-white dark:bg-slate-900">
              <button onClick={() => setIsTemplateOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <div className="flex items-center gap-2">
                {wizardStep > 1 && (
                  <button onClick={() => setWizardStep((wizardStep - 1) as any)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    ← Kembali
                  </button>
                )}
                {wizardStep < 4 && wizardStep >= 2 && (
                  <button onClick={() => setWizardStep((wizardStep + 1) as any)}
                    disabled={(wizardStep === 2 && selectedTemplateIds.length === 0) || (wizardStep === 3 && !useTemplateTarget && !targetAll && selectedTargets.length === 0)}
                    className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                    Lanjut <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {wizardStep === 4 && (
                  <button onClick={handleCreateFromTemplate} disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Mengirim...' : `Kirim ke ${recipientCount} Siswa`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                        <select value={feedbackRating} onChange={(e) => setFeedbackRating(parseInt(e.target.value))}
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white">
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} bintang</option>)}
                        </select>
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
      {isEditOpen && editingDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveEdit}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-500" /> Edit Deadline
              </h3>
              <button type="button" onClick={() => { setIsEditOpen(false); setEditingDeadline(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Deskripsi
              </label>
              <textarea rows={3} value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tenggat Waktu <span className="text-rose-500">*</span>
                </label>
                <input type="datetime-local" required value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Prioritas
                </label>
                <select value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  <option value="LOW">Rendah</option>
                  <option value="MEDIUM">Sedang</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="CRITICAL">Kritis</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-900 dark:text-rose-200">
                <input type="checkbox" checked={editIsCritical}
                  onChange={(e) => setEditIsCritical(e.target.checked)}
                  className="rounded border-rose-300 text-rose-500" />
                <span>★ Tandai sebagai Tugas Kritis</span>
              </label>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 dark:text-blue-200">
                Perubahan akan langsung terlihat di dashboard siswa. Kalau siswa sudah menerima notifikasi, mereka dapat notifikasi baru.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => { setIsEditOpen(false); setEditingDeadline(null); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={actionLoading === editingDeadline.id}
                className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {actionLoading === editingDeadline.id ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}
      {isCopyOpen && (
        <DeadlineCopyModal
          allClasses={classes || []}
          currentClassId={activeClass?.id || ''}
          deadlines={deadlines}
          onClose={() => setIsCopyOpen(false)}
          onSuccess={() => {
            showToast('Deadline disalin ke kelas lain!', 'success');
          }}
        />
      )}
    </div>
  );
};
