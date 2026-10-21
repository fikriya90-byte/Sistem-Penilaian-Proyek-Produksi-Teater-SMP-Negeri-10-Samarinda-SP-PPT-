import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, PlusCircle, CheckCircle, Users, Upload, X, Send, Timer,
  AlertTriangle, Check, BookOpen, ChevronRight, ChevronLeft, ChevronDown,
  Sparkles, Target, ListChecks, Square, CheckSquare, User, Briefcase,
  Copy, FilePlus, Wand2, Loader2, Trash2, Pencil, Pause, Play, Ban,
  XCircle, Info, Save, Star, FileText, Link2, MessageSquare, Calendar,
  Camera, History, ShieldAlert, MoreVertical, ChevronUp,
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
import { PhotoEvidenceUploader, PhotoEvidence, checkPhotoContent } from '../common/PhotoEvidenceUploader';

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  LOW: { label: 'Rendah', color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Sedang', color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-500/40', dot: 'bg-blue-500' },
  HIGH: { label: 'Tinggi', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-500/40', dot: 'bg-amber-500' },
  CRITICAL: { label: 'Kritis', color: 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-500/40', dot: 'bg-rose-500' },
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

const STAGE_ORDER: ProductionStage[] = ['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'];

const STAGE_BADGE: Record<ProductionStage, string> = {
  PERSIAPAN: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-500/40',
  PELAKSANAAN: 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-500/40',
  PERTUNJUKAN: 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-500/40',
  PASCA: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/40',
};

interface TargetItem {
  type: 'PERAN' | 'DIVISI';
  name: string;
}

type DueDateMode = 'PRESERVE' | 'SHIFT' | 'OVERRIDE';

/* ============================================================
   DUPLIKAT MODAL (tidak diubah)
   ============================================================ */
const DeadlineCopyModal: React.FC<{
  allClasses: ClassRoom[];
  currentClassId: string;
  deadlines: DeadlineItem[];
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ allClasses, currentClassId, deadlines, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDeadlineIds, setSelectedDeadlineIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [dueDateMode, setDueDateMode] = useState<DueDateMode>('PRESERVE');
  const [shiftDays, setShiftDays] = useState(0);
  const [overrideDate, setOverrideDate] = useState('');

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

  const computeNewDueDate = (originalDue: string): string => {
    if (dueDateMode === 'SHIFT') {
      const d = new Date(originalDue);
      d.setDate(d.getDate() + shiftDays);
      return d.toISOString();
    }
    if (dueDateMode === 'OVERRIDE' && overrideDate) {
      return new Date(overrideDate).toISOString();
    }
    return originalDue;
  };

  const getRecipientsForDeadline = (
    source: DeadlineItem,
    studentsInClass: UserProfile[]
  ): Set<string> => {
    const recipientIds = new Set<string>();
    const dScope = source.targetScope as string;
    const dRole = (source as any).targetRole as string | undefined;
    const dDivision = (source as any).targetDivision as string | undefined;
    const dTargetRoles: string[] = (source as any).targetRoles || [];
    const dTargetDivisions: string[] = (source as any).targetDivisions || [];

    studentsInClass.forEach(u => {
      if (dScope === 'SEMUA') { recipientIds.add(u.uid); return; }
      if (dScope === 'PERAN') { if (dRole && u.role === dRole) recipientIds.add(u.uid); return; }
      if (dScope === 'DIVISI') { if (dDivision && u.divisionName === dDivision) recipientIds.add(u.uid); return; }
      if (dScope === 'CUSTOM') {
        if (dTargetRoles.length > 0 && dTargetRoles.includes(u.role)) { recipientIds.add(u.uid); return; }
        if (dTargetDivisions.length > 0 && u.divisionName && dTargetDivisions.includes(u.divisionName)) { recipientIds.add(u.uid); return; }
      }
    });

    return recipientIds;
  };

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
          const students = users.filter(u =>
            u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
            u.role !== 'Admin' && u.role !== 'Super Admin'
          );
          const allTargets = new Set<string>();
          for (const did of selectedDeadlineIds) {
            const d = deadlines.find(x => x.id === did);
            if (!d) continue;
            const recipients = getRecipientsForDeadline(d, students);
            recipients.forEach(r => allTargets.add(r));
          }
          preview[cid] = allTargets.size;
        } catch (err) {
          preview[cid] = 0;
        }
      }
      setRecipientPreview(preview);
    })();
  }, [selectedClassIds, selectedDeadlineIds, deadlines]);

  const handleDuplicate = async () => {
    if (!user) return;
    if (selectedDeadlineIds.length === 0) { showToast('Pilih minimal 1 deadline.', 'warning'); return; }
    if (selectedClassIds.length === 0) { showToast('Pilih minimal 1 kelas tujuan.', 'warning'); return; }
    if (dueDateMode === 'OVERRIDE' && !overrideDate) {
      showToast('Pilih tanggal baru terlebih dahulu.', 'warning');
      return;
    }

    setSubmitting(true);
    let totalCreated = 0;
    let totalNotif = 0;
    let totalSkipped = 0;

    try {
      for (const targetClassId of selectedClassIds) {
        const targetClass = allClasses.find(c => c.id === targetClassId);
        if (!targetClass) continue;

        const targetUsers = await fetchUsersByClass(targetClassId);
        const studentsTarget = targetUsers.filter(u =>
          u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
          u.role !== 'Admin' && u.role !== 'Super Admin'
        );

        for (const deadlineId of selectedDeadlineIds) {
          const source = deadlines.find(d => d.id === deadlineId);
          if (!source) continue;

          const recipientIds = getRecipientsForDeadline(source, studentsTarget);

          if (recipientIds.size === 0 && source.targetScope === 'CUSTOM') {
            totalSkipped++;
            continue;
          }

          const newDueDate = computeNewDueDate(source.dueDate);
          const targetRole = (source as any).targetRole;
          const targetDivision = (source as any).targetDivision;
          const targetRoles = (source as any).targetRoles;
          const targetDivisions = (source as any).targetDivisions;

          const newRef = doc(collection(db, 'deadlines'));
          const newData: any = {
            id: newRef.id,
            classId: targetClassId,
            title: source.title,
            description: source.description,
            dueDate: newDueDate,
            priority: source.priority,
            targetScope: source.targetScope,
            targetUserIds: Array.from(recipientIds),
            stage: (source as any).stage,
            isCritical: (source as any).isCritical || false,
            photoHint: (source as any).photoHint || '',
            photoSearchQuery: (source as any).photoSearchQuery || '',
            createdBy: user.uid,
            creatorName: user.displayName,
            creatorRole: user.role,
            createdAt: new Date().toISOString(),
            duplicatedFrom: source.id,
          };
          if (targetRole) newData.targetRole = targetRole;
          if (targetDivision) newData.targetDivision = targetDivision;
          if (targetRoles && targetRoles.length > 0) newData.targetRoles = targetRoles;
          if (targetDivisions && targetDivisions.length > 0) newData.targetDivisions = targetDivisions;

          await setDoc(newRef, newData);
          totalCreated++;

          if (recipientIds.size > 0) {
            const batch = writeBatch(db);
            const nowStr = new Date().toISOString();
            recipientIds.forEach(uid => {
              const notifRef = doc(collection(db, 'notifications'));
              batch.set(notifRef, {
                id: notifRef.id, userId: uid, classId: targetClassId,
                title: 'Deadline Baru',
                message: `${user.displayName} mengirim deadline untuk ${targetClass.name}: "${source.title}"`,
                category: 'Tugas', read: false, link: 'tugas', createdAt: nowStr,
              });
            });
            await batch.commit();
            totalNotif += recipientIds.size;
          }
        }
      }

      let msg = `${totalCreated} deadline diduplikat. ${totalNotif} siswa menerima notifikasi.`;
      if (totalSkipped > 0) msg += ` (${totalSkipped} di-skip karena target tidak cocok)`;
      showToast(msg, 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast('Gagal duplikat: ' + (err?.message || 'Unknown'), 'error');
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
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  Duplikat Deadline
                </span>
                <h3 className="text-lg font-black mt-0.5">Langkah {step} dari 4</h3>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Pilih Deadline yang Mau Diduplikat
                </h4>
                <div className="flex items-center gap-2">
                  <button onClick={selectAllDeadlines} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                    <Check className="w-3 h-3" /> Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAllDeadlines} className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Hapus
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {deadlines.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">Belum ada deadline.</p>
                ) : deadlines.map(d => {
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
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-2">{d.title}</p>
                      </div>
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
              </div>
              {otherClasses.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">Tidak ada kelas lain.</p>
              ) : (
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
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{c.code}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">Pengaturan Waktu</h4>
              <div className="space-y-3">
                <button type="button" onClick={() => setDueDateMode('PRESERVE')}
                  className={`w-full p-3 rounded-2xl border-2 text-left transition ${
                    dueDateMode === 'PRESERVE' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">Pertahankan Tanggal Asli</p>
                </button>
                <button type="button" onClick={() => setDueDateMode('SHIFT')}
                  className={`w-full p-3 rounded-2xl border-2 text-left transition ${
                    dueDateMode === 'SHIFT' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">Geser Tanggal</p>
                </button>
                {dueDateMode === 'SHIFT' && (
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border-2 border-purple-200 dark:border-purple-500/30">
                    <input type="number" value={shiftDays}
                      onChange={(e) => setShiftDays(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-sm font-black text-center text-purple-900 dark:text-purple-200" />
                    <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-1">Positif = maju. Negatif = mundur.</p>
                  </div>
                )}
                <button type="button" onClick={() => setDueDateMode('OVERRIDE')}
                  className={`w-full p-3 rounded-2xl border-2 text-left transition ${
                    dueDateMode === 'OVERRIDE' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">Set Tanggal Baru</p>
                </button>
                {dueDateMode === 'OVERRIDE' && (
                  <input type="datetime-local" value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">Konfirmasi Duplikat</h4>
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border-2 border-purple-200 dark:border-purple-500/30 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Deadline</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-100">{selectedDeadlineIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Kelas</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-100">{selectedClassIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Penerima</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-100">{totalRecipients}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
            Batal
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as any)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <ChevronLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            )}
            {step < 4 && (
              <button onClick={() => setStep((step + 1) as any)}
                disabled={
                  (step === 1 && selectedDeadlineIds.length === 0) ||
                  (step === 2 && selectedClassIds.length === 0) ||
                  (step === 3 && dueDateMode === 'OVERRIDE' && !overrideDate)
                }
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {step === 4 && (
              <button onClick={handleDuplicate} disabled={submitting || totalRecipients === 0}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5" />
                {submitting ? 'Menduplikat...' : `Duplikat ke ${selectedClassIds.length} Kelas`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   MAIN MODULE
   ============================================================ */
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
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);
  const [filterStage, setFilterStage] = useState<'ALL' | ProductionStage>('ALL');
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [stageConfig, setStageConfig] = useState<any>(null);

  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLink, setNoteLink] = useState('');
  const [notePhotos, setNotePhotos] = useState<PhotoEvidence[]>([]);

  const [confirmDoneItem, setConfirmDoneItem] = useState<DeadlineItem | null>(null);
  const [quickDoneLoading, setQuickDoneLoading] = useState<string | null>(null);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<TargetItem[]>([]);
  const [targetAll, setTargetAll] = useState(false);
  const [dueDateOverride, setDueDateOverride] = useState('');
  const [useTemplateTarget, setUseTemplateTarget] = useState(true);

  const [editingDeadline, setEditingDeadline] = useState<DeadlineItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editIsCritical, setEditIsCritical] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [editTargetScope, setEditTargetScope] = useState<'SEMUA' | 'PERAN' | 'DIVISI' | 'CUSTOM'>('SEMUA');
  const [editTargetRole, setEditTargetRole] = useState<string>('');
  const [editTargetDivision, setEditTargetDivision] = useState<string>('');
  const [editTargetRoles, setEditTargetRoles] = useState<string[]>([]);
  const [editTargetDivisions, setEditTargetDivisions] = useState<string[]>([]);
  const [showEditTargetSection, setShowEditTargetSection] = useState(false);

  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualDueDate, setManualDueDate] = useState('');
  const [manualPriority, setManualPriority] = useState<TaskPriority>('MEDIUM');
  const [manualStage, setManualStage] = useState<ProductionStage>('PELAKSANAAN');
  const [manualTargetAll, setManualTargetAll] = useState(true);
  const [manualTargets, setManualTargets] = useState<TargetItem[]>([]);
  const [manualIsCritical, setManualIsCritical] = useState(false);
  const [manualPhotoHint, setManualPhotoHint] = useState('');

  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [approveExt, setApproveExt] = useState(false);

  // ✅ UI State: accordion tahap + expand deskripsi
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [expandedDescIds, setExpandedDescIds] = useState<string[]>([]);

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

    const stageRef = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
    const unsubStage = onSnapshot(stageRef, snap => {
      if (snap.exists()) setStageConfig(snap.data());
    });

    return () => { unsub(); unsubStage(); };
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
      return { text: 'Dibatalkan', color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' };
    }
    if (status === 'HOLD') {
      return { text: 'Ditahan', color: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40' };
    }
    if (!dueDate) return { text: 'Tanpa deadline', color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' };
    const diff = new Date(dueDate).getTime() - now.getTime();
    if (isNaN(diff)) return { text: 'Format salah', color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' };
    if (diff <= 0) {
      const lateDays = Math.floor(Math.abs(diff) / 86400000);
      return { text: `Terlambat ${lateDays} hari`, color: 'text-white bg-rose-600 border-rose-700' };
    }
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (hours < 24) return { text: `${hours} jam lagi`, color: 'text-white bg-rose-500 border-rose-600' };
    if (hours <= 72) return { text: `${days} hari lagi`, color: 'text-white bg-amber-500 border-amber-600' };
    return { text: `${days} hari lagi`, color: 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' };
  };

  const handleQuickDone = async (d: DeadlineItem) => {
    if (!user || !activeClass) return;
    const isPelaksanaan = (d as any).stage === 'PELAKSANAAN';
    if (isPelaksanaan) {
      handleOpenNote(d);
      setConfirmDoneItem(null);
      return;
    }

    setQuickDoneLoading(d.id);
    try {
      const subId = `${d.id}_${user.uid}`;
      const dueMs = new Date(d.dueDate || 0).getTime();
      const isLate = !isNaN(dueMs) && dueMs < Date.now();

      await setDoc(doc(db, 'deadlineSubmissions', subId), {
        id: subId, deadlineId: d.id, classId: activeClass.id,
        studentId: user.uid, studentName: user.displayName,
        status: isLate ? 'TERLAMBAT' : 'SELESAI',
        progress: 100, proofUrl: '', proofNote: '',
        evidencePhotos: [], evidenceCount: 0,
        stage: (d as any).stage || null,
        extensionRequested: false,
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'SUBMIT', targetType: 'DeadlineSubmission', targetId: subId,
        details: `Tandai selesai: "${d.title}"${isLate ? ' (terlambat)' : ''}`,
      });

      showToast(isLate ? `Tandai selesai (terlambat).` : `Mantap! Tugas selesai.`, 'success');
      setConfirmDoneItem(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setQuickDoneLoading(null);
    }
  };

  const handleUnmarkDone = async (d: DeadlineItem) => {
    if (!user) return;
    if (!confirm(`Batalkan status selesai untuk "${d.title}"?`)) return;
    try {
      const subId = `${d.id}_${user.uid}`;
      await deleteDoc(doc(db, 'deadlineSubmissions', subId));
      showToast('Status dibatalkan.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleOpenNote = (d: DeadlineItem) => {
    const existing = mySubmissions[d.id];
    setSelectedDeadline(d);
    setNoteText(existing?.proofNote || '');
    setNoteLink(existing?.proofUrl || '');
    setNotePhotos(((existing as any)?.evidencePhotos || []) as PhotoEvidence[]);
    setIsNoteOpen(true);
  };

  const handleSaveNote = async () => {
    if (!user || !activeClass || !selectedDeadline) return;

    const isPelaksanaan = (selectedDeadline as any).stage === 'PELAKSANAAN';
    if (isPelaksanaan && notePhotos.length === 0) {
      showToast('Tahap PELAKSANAAN wajib menyertakan minimal 1 foto bukti!', 'error');
      return;
    }

    for (const p of notePhotos) {
      if (p.caption) {
        const check = checkPhotoContent(p.caption);
        if (check.has) {
          showToast(`Keterangan foto mengandung kata tidak pantas: ${check.found.join(', ')}`, 'error');
          return;
        }
      }
    }

    const totalPhotoKB = notePhotos.reduce((s, p) => s + p.sizeKB, 0);
    if (totalPhotoKB > 900) {
      showToast(`Total foto terlalu besar (${totalPhotoKB}KB). Maks 900KB.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const subId = `${selectedDeadline.id}_${user.uid}`;
      const dueMs = new Date(selectedDeadline.dueDate || 0).getTime();
      const isLate = !isNaN(dueMs) && dueMs < Date.now();

      await setDoc(doc(db, 'deadlineSubmissions', subId), {
        id: subId, deadlineId: selectedDeadline.id, classId: activeClass.id,
        studentId: user.uid, studentName: user.displayName,
        status: isLate ? 'TERLAMBAT' : 'SELESAI',
        progress: 100, proofUrl: noteLink.trim(), proofNote: noteText.trim(),
        evidencePhotos: notePhotos.map(p => ({
          id: p.id, dataUrl: p.dataUrl, caption: p.caption || '',
          uploadedAt: p.uploadedAt, sizeKB: p.sizeKB,
        })),
        evidenceCount: notePhotos.length,
        stage: (selectedDeadline as any).stage || null,
        extensionRequested: false,
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'SUBMIT', targetType: 'DeadlineSubmission', targetId: subId,
        details: `Bukti tersimpan: "${selectedDeadline.title}" (${notePhotos.length} foto)`,
      });

      showToast(`Bukti tersimpan dengan ${notePhotos.length} foto!`, 'success');
      setIsNoteOpen(false);
      setNoteText(''); setNoteLink(''); setNotePhotos([]);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTemplate = () => {
    setWizardStep(1); setSelectedStage('PELAKSANAAN');
    setSelectedTemplateIds([]); setSelectedTargets([]);
    setTargetAll(false); setDueDateOverride(''); setUseTemplateTarget(true);
    setIsTemplateOpen(true);
  };

  const handleOpenManual = () => {
    setManualTitle(''); setManualDescription(''); setManualDueDate('');
    setManualPriority('MEDIUM'); setManualStage('PELAKSANAAN');
    setManualTargetAll(true); setManualTargets([]);
    setManualIsCritical(false); setManualPhotoHint('');
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
          if (tpl.targetType === 'CUSTOM' && tpl.targetRoles && tpl.targetRoles.includes(u.role)) matched.add(u.uid);
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
    const scope = ((d as any).targetScope || 'SEMUA') as 'SEMUA' | 'PERAN' | 'DIVISI' | 'CUSTOM';
    setEditTargetScope(scope);
    setEditTargetRole((d as any).targetRole || '');
    setEditTargetDivision((d as any).targetDivision || '');
    setEditTargetRoles((d as any).targetRoles || []);
    setEditTargetDivisions((d as any).targetDivisions || []);
    setShowEditTargetSection(false);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeadline || !user) return;
    if (editTargetScope === 'PERAN' && !editTargetRole) { showToast('Pilih peran tujuan.', 'warning'); return; }
    if (editTargetScope === 'DIVISI' && !editTargetDivision) { showToast('Pilih divisi tujuan.', 'warning'); return; }
    if (editTargetScope === 'CUSTOM' && editTargetRoles.length === 0 && editTargetDivisions.length === 0) {
      showToast('Pilih minimal 1 peran atau divisi.', 'warning'); return;
    }

    setActionLoading(editingDeadline.id);
    try {
      const recipientIds = new Set<string>();
      users.forEach(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
        if (u.role === 'Admin' || u.role === 'Super Admin') return;
        if (editTargetScope === 'SEMUA') { recipientIds.add(u.uid); }
        else if (editTargetScope === 'PERAN') { if (u.role === editTargetRole) recipientIds.add(u.uid); }
        else if (editTargetScope === 'DIVISI') { if (u.divisionName === editTargetDivision) recipientIds.add(u.uid); }
        else if (editTargetScope === 'CUSTOM') {
          if (editTargetRoles.includes(u.role)) recipientIds.add(u.uid);
          else if (u.divisionName && editTargetDivisions.includes(u.divisionName)) recipientIds.add(u.uid);
        }
      });

      const updateData: any = {
        title: editTitle.trim(), description: editDesc.trim(),
        dueDate: new Date(editDueDate).toISOString(),
        priority: editPriority, isCritical: editIsCritical,
        targetScope: editTargetScope, targetUserIds: Array.from(recipientIds),
        updatedAt: new Date().toISOString(), updatedBy: user.displayName,
      };

      if (editTargetScope === 'PERAN') {
        updateData.targetRole = editTargetRole;
        updateData.targetDivision = '';
        updateData.targetRoles = [];
        updateData.targetDivisions = [];
      } else if (editTargetScope === 'DIVISI') {
        updateData.targetDivision = editTargetDivision;
        updateData.targetRole = '';
        updateData.targetRoles = [];
        updateData.targetDivisions = [];
      } else if (editTargetScope === 'CUSTOM') {
        updateData.targetRoles = editTargetRoles;
        updateData.targetDivisions = editTargetDivisions;
        updateData.targetRole = '';
        updateData.targetDivision = '';
      } else {
        updateData.targetRole = '';
        updateData.targetDivision = '';
        updateData.targetRoles = [];
        updateData.targetDivisions = [];
      }

      await updateDoc(doc(db, 'deadlines', editingDeadline.id), updateData);
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Deadline', targetId: editingDeadline.id,
        details: `Edit deadline: ${editTitle} - target: ${editTargetScope} (${recipientIds.size} penerima)`,
      });
      showToast(`Deadline diperbarui! Target: ${recipientIds.size} penerima.`, 'success');
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
    if (!confirm(isHeld ? `Aktifkan kembali deadline "${d.title}"?` : `Tahan deadline "${d.title}"?`)) return;
    setActionLoading(d.id);
    try {
      await updateDoc(doc(db, 'deadlines', d.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName,
      });
      showToast(isHeld ? 'Deadline diaktifkan kembali.' : 'Deadline ditahan.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelDeadline = async (d: DeadlineItem) => {
    if (!user) return;
    if (!confirm(`BATALKAN deadline "${d.title}"?`)) return;
    setActionLoading(d.id);
    try {
      await updateDoc(doc(db, 'deadlines', d.id), {
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelledBy: user.displayName,
        updatedAt: new Date().toISOString(),
      });
      showToast('Deadline dibatalkan.', 'info');
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
      showToast('Deadline diaktifkan kembali.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDeadline = async (d: DeadlineItem) => {
    if (!user) return;
    if (!confirm(`Hapus deadline "${d.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'deadlines', d.id));
      showToast('Deadline berhasil dihapus.', 'success');
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!user || !activeClass) return;
    if (selectedTemplateIds.length === 0) { showToast('Pilih minimal 1 template.', 'warning'); return; }
    if (!useTemplateTarget && !targetAll && selectedTargets.length === 0) {
      showToast('Pilih minimal 1 target.', 'warning'); return;
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
            if (tpl.targetType === 'CUSTOM' && tpl.targetRoles && tpl.targetRoles.includes(u.role as any)) recipientIds.add(u.uid);
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
        const deadlineData: any = {
          id: newRef.id, classId: activeClass.id,
          title: tpl.title, description: tpl.description,
          dueDate: dueIso, priority: tpl.priority,
          targetScope, targetUserIds: Array.from(recipientIds),
          stage: selectedStage, isCritical: tpl.isCritical || false,
          photoHint: (tpl as any).photoHint || '',
          photoSearchQuery: (tpl as any).photoSearchQuery || '',
          createdBy: user.uid, creatorName: user.displayName, creatorRole: user.role,
          createdAt: new Date().toISOString(),
          templateReference: tpl.reference,
        };
        if (targetRole) deadlineData.targetRole = targetRole;
        if (targetDivision) deadlineData.targetDivision = targetDivision;
        if (useTemplateTarget && tpl.targetType === 'CUSTOM' && tpl.targetRoles) {
          deadlineData.targetRoles = tpl.targetRoles;
        }

        await setDoc(newRef, deadlineData);
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
            id: notifRef.id, userId: uid, classId: activeClass.id,
            title: `${success} Deadline Baru`,
            message: `${user.displayName} mengirim ${success} deadline (${selectedStage}).`,
            category: 'Tugas', read: false, link: 'tugas', createdAt: nowStr,
          });
        });
        await batch.commit();
      }

      showToast(`${success} deadline dikirim ke ${totalNotif} penerima!`, 'success');
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
    if (!manualTargetAll && manualTargets.length === 0) { showToast('Pilih minimal 1 target.', 'warning'); return; }

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
      const manualData: any = {
        id: newRef.id, classId: activeClass.id,
        title: manualTitle.trim(), description: manualDescription.trim(),
        dueDate: new Date(manualDueDate).toISOString(),
        priority: manualPriority,
        targetScope: manualTargetAll ? 'SEMUA' : 'CUSTOM',
        targetUserIds: Array.from(recipientIds),
        stage: manualStage, isCritical: manualIsCritical,
        photoHint: manualPhotoHint.trim(), photoSearchQuery: '',
        createdBy: user.uid, creatorName: user.displayName, creatorRole: user.role,
        createdAt: new Date().toISOString(), isManual: true,
      };
      if (!manualTargetAll) {
        const roles = manualTargets.filter(t => t.type === 'PERAN').map(t => t.name);
        const divisions = manualTargets.filter(t => t.type === 'DIVISI').map(t => t.name);
        if (roles.length > 0) manualData.targetRoles = roles;
        if (divisions.length > 0) manualData.targetDivisions = divisions;
      }
      await setDoc(newRef, manualData);

      if (recipientIds.size > 0) {
        const batch = writeBatch(db);
        const nowStr = new Date().toISOString();
        recipientIds.forEach(uid => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id, userId: uid, classId: activeClass.id,
            title: 'Deadline Baru', message: `${user.displayName}: "${manualTitle.trim()}"`,
            category: 'Tugas', read: false, link: 'tugas', createdAt: nowStr,
          });
        });
        await batch.commit();
      }

      showToast(`Deadline dikirim ke ${manualRecipientCount} siswa!`, 'success');
      setIsManualOpen(false);
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
        extensionApproved: approveExt ? true : sub.approvedExt,
        updatedAt: new Date().toISOString(),
      });
      showToast('Feedback tersimpan!', 'success');
      setFeedbackText(''); setFeedbackRating(5); setApproveExt(false);
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
    const dStage = (d as any).stage as ProductionStage | undefined;
    const mySub = mySubmissions[d.id];
    const isDone = !!mySub;

    if (filterStage !== 'ALL' && dStage && dStage !== filterStage) {
      if (!canCreate) {
        const activeStageId = stageConfig?.currentStage || 'PELAKSANAAN';
        const currentStageIndex = STAGE_ORDER.indexOf(activeStageId);
        const taskStageIndex = STAGE_ORDER.indexOf(dStage);
        const isPastStage = taskStageIndex !== -1 && taskStageIndex < currentStageIndex;
        if (!isPastStage || isDone) return false;
      } else {
        return false;
      }
    }

    if (canCreate) return true;
    if ((d as any).status === 'CANCELLED') return false;
    if (!user) return false;

    const dScope = d.targetScope as string;
    const dRole = (d as any).targetRole as string | undefined;
    const dDivision = (d as any).targetDivision as string | undefined;
    const dTargetUserIds: string[] = (d as any).targetUserIds || [];
    const dTargetRoles: string[] = (d as any).targetRoles || [];
    const dTargetDivisions: string[] = (d as any).targetDivisions || [];

    if (dScope === 'SEMUA') return true;
    if (dScope === 'PERAN') return dRole === user.role;
    if (dScope === 'DIVISI') return dDivision === user.divisionName;
    if (dScope === 'CUSTOM') {
      if (dTargetRoles.length > 0 && dTargetRoles.includes(user.role)) return true;
      if (dTargetDivisions.length > 0 && user.divisionName && dTargetDivisions.includes(user.divisionName)) return true;
      if (dTargetUserIds.length > 0) return dTargetUserIds.includes(user.uid);
      return false;
    }
    return false;
  });

  // ✅ NEW: Group by stage
  const groupedVisible = useMemo(() => {
    const groups: Record<ProductionStage, DeadlineItem[]> = {
      PERSIAPAN: [], PELAKSANAAN: [], PERTUNJUKAN: [], PASCA: [],
    };
    visibleDeadlines.forEach(d => {
      const st = ((d as any).stage || 'PELAKSANAAN') as ProductionStage;
      if (groups[st]) groups[st].push(d);
    });
    return groups;
  }, [visibleDeadlines]);

  const toggleStageCollapse = (st: string) => {
    setCollapsedStages(prev => ({ ...prev, [st]: !prev[st] }));
  };

  const toggleDescExpand = (id: string) => {
    setExpandedDescIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
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
              <h2 className="text-xl font-black text-white mt-1">Tugas &amp; Deadline</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {canCreate
                  ? 'Kelola tugas semua divisi & peran'
                  : `${visibleDeadlines.length} tugas untuk peran Anda`}
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
                <Copy className="w-4 h-4" /> Duplikat
              </button>
            </div>
          )}
        </div>

        {!canCreate && (
          <div className="mt-3 p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-slate-200 flex items-start gap-2">
            <Camera className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
            <span>
              <strong>Info:</strong> Tugas tahap <strong>PELAKSANAAN wajib melampirkan foto bukti</strong>. Foto auto-kompres (maks 300KB/foto).
            </span>
          </div>
        )}
      </div>

      {/* FILTER STAGE */}
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

      {/* LIST GROUPED BY STAGE */}
      {visibleDeadlines.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Timer className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
            {canCreate ? 'Belum Ada Deadline' : 'Tidak Ada Deadline untuk Anda'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canCreate ? 'Klik "Buat Manual" atau "Dari Template".' : 'Belum ada tugas untuk peran Anda saat ini.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'] as ProductionStage[]).map(stage => {
            const stageItems = groupedVisible[stage];
            if (!stageItems || stageItems.length === 0) return null;
            const isCollapsed = collapsedStages[stage] === true;
            const stageInfo = STAGE_INFO[stage];

            return (
              <div key={stage} className="space-y-3">
                {/* Stage header — accordion */}
                <button
                  onClick={() => toggleStageCollapse(stage)}
                  className={`w-full p-3 rounded-2xl bg-gradient-to-r ${stageInfo.gradient} text-white shadow-md flex items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-white/20">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-black">{stageInfo.label}</p>
                      <p className="text-[10px] opacity-90">{stageItems.length} tugas</p>
                    </div>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stageItems.map(d => {
                      const cd = getCountdown(d.dueDate, (d as any).status);
                      const mySub = mySubmissions[d.id];
                      const priority = getPriorityConfig(d.priority);
                      const isCritical = (d as any).isCritical;
                      const isDone = !!mySub;
                      const isLoadingQuick = quickDoneLoading === d.id;
                      const isPelaksanaan = stage === 'PELAKSANAAN';
                      const photos = ((mySub as any)?.evidencePhotos || []) as any[];
                      const targetCount = ((d as any).targetUserIds || []).length;
                      const isExpanded = expandedDescIds.includes(d.id);
                      const descIsLong = (d.description || '').length > 120;

                      // Detect late stage (for students)
                      const activeStageId = stageConfig?.currentStage || 'PELAKSANAAN';
                      const currentStageIndex = STAGE_ORDER.indexOf(activeStageId);
                      const taskStageIndex = STAGE_ORDER.indexOf(stage);
                      const isPastStage = taskStageIndex !== -1 && taskStageIndex < currentStageIndex;
                      const isOverdue = !isDone && new Date(d.dueDate).getTime() < Date.now();
                      const isLateSubmission = mySub?.status === 'TERLAMBAT';

                      return (
                        <div key={d.id}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex flex-col"
                        >
                          {/* BADGES ROW */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${priority.color}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${priority.dot} mr-1`} />
                              {priority.label}
                            </span>
                            {isCritical && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-500/40 flex items-center gap-1">
                                <Star className="w-3 h-3" /> KRITIS
                              </span>
                            )}
                            {isPelaksanaan && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-500/40 flex items-center gap-1">
                                <Camera className="w-3 h-3" /> WAJIB FOTO
                              </span>
                            )}
                            {isPastStage && !isDone && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm">
                                <History className="w-3 h-3" /> TERTINGGAL
                              </span>
                            )}
                            {(isOverdue || isLateSubmission) && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                                <AlertTriangle className="w-3 h-3" /> TERLAMBAT
                              </span>
                            )}
                            {isDone && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md text-white flex items-center gap-1 ${
                                mySub?.status === 'TERLAMBAT' ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}>
                                <CheckCircle className="w-3 h-3" /> {mySub?.status === 'TERLAMBAT' ? 'SELESAI (TELAT)' : 'SELESAI'}
                              </span>
                            )}
                            {(d as any).status === 'HOLD' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40">
                                DITAHAN
                              </span>
                            )}
                            {(d as any).status === 'CANCELLED' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                                DIBATALKAN
                              </span>
                            )}
                          </div>

                          {/* TITLE */}
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug mb-1">
                            {d.title}
                          </h3>

                          {/* DESCRIPTION — expandable */}
                          {d.description && (
                            <div className="mb-2">
                              <p className={`text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line ${
                                !isExpanded && descIsLong ? 'line-clamp-2' : ''
                              }`}>
                                {d.description}
                              </p>
                              {descIsLong && (
                                <button
                                  onClick={() => toggleDescExpand(d.id)}
                                  className="mt-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {isExpanded ? '↑ Sembunyikan' : '↓ Baca selengkapnya'}
                                </button>
                              )}
                            </div>
                          )}

                          {/* COUNTDOWN */}
                          <div className={`p-2 rounded-lg border text-xs font-bold text-center flex items-center justify-center gap-1.5 ${cd.color}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{cd.text}</span>
                          </div>

                          {/* METADATA */}
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5 flex-wrap">
                            <span>Oleh <strong className="text-slate-700 dark:text-slate-200">{d.creatorName || 'Guru'}</strong></span>
                            {d.dueDate && (
                              <>
                                <span>•</span>
                                <span>{new Date(d.dueDate).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </>
                            )}
                          </p>

                          {/* ============ SISWA: AKSI ============ */}
                          {!canCreate && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              {!isDone ? (
                                <>
                                  <button onClick={() => setConfirmDoneItem(d)} disabled={isLoadingQuick}
                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 active:scale-[0.99]">
                                    {isLoadingQuick ? (
                                      <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                                    ) : isPelaksanaan ? (
                                      <><Camera className="w-4 h-4" /> Kirim Bukti + Foto</>
                                    ) : (
                                      <><CheckCircle className="w-4 h-4" /> Tandai Selesai</>
                                    )}
                                  </button>
                                  <button onClick={() => handleOpenNote(d)}
                                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition">
                                    <MessageSquare className="w-3.5 h-3.5" /> {isPelaksanaan ? 'Kirim Bukti + Foto (Wajib)' : 'Tambah Catatan (Opsional)'}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                                    mySub?.status === 'TERLAMBAT'
                                      ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/40 text-rose-900 dark:text-rose-100'
                                      : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-100'
                                  }`}>
                                    <CheckCircle className="w-4 h-4 shrink-0" />
                                    <div className="flex-1 min-w-0 text-[11px]">
                                      <p className="font-bold">Sudah dikerjakan</p>
                                      <p className="opacity-80">
                                        {mySub.submittedAt ? new Date(mySub.submittedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                        {photos.length > 0 && ` • ${photos.length} foto`}
                                      </p>
                                    </div>
                                  </div>

                                  {photos.length > 0 && (
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {photos.map((p, i) => (
                                        <img key={p.id || i} src={p.dataUrl} alt={`Foto ${i + 1}`}
                                          className="w-full h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                                          onClick={() => {
                                            const w = window.open('', '_blank');
                                            if (w) {
                                              w.document.write(`<html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${p.dataUrl}" style="max-width:95vw;max-height:95vh;border-radius:12px"/></body></html>`);
                                              w.document.close();
                                            }
                                          }} />
                                      ))}
                                    </div>
                                  )}

                                  {mySub.proofNote && (
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 italic p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                                      "{mySub.proofNote}"
                                    </p>
                                  )}

                                  {mySub.proofUrl && (
                                    <a href={mySub.proofUrl} target="_blank" rel="noreferrer"
                                      className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition">
                                      <Link2 className="w-3.5 h-3.5 shrink-0" />
                                      <span className="font-bold truncate">Buka link lampiran</span>
                                    </a>
                                  )}

                                  <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleOpenNote(d)}
                                      className="py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 font-bold text-[11px] flex items-center justify-center gap-1 transition">
                                      <Pencil className="w-3 h-3" /> Edit Bukti
                                    </button>
                                    <button onClick={() => handleUnmarkDone(d)}
                                      className="py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 font-bold text-[11px] flex items-center justify-center gap-1 transition">
                                      <XCircle className="w-3 h-3" /> Batalkan
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* ============ GURU/ADMIN: AKSI ============ */}
                          {canCreate && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              {/* Primary action row */}
                              <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleOpenReview(d)}
                                  className="py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5">
                                  <Users className="w-3.5 h-3.5" /> Submisi ({targetCount})
                                </button>
                                <button onClick={() => handleOpenEdit(d)}
                                  disabled={actionLoading === d.id || (d as any).status === 'CANCELLED'}
                                  className="py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 font-bold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-40">
                                  <Pencil className="w-3.5 h-3.5" /> Edit
                                </button>
                              </div>
                              {/* Secondary actions — compact row */}
                              <div className="grid grid-cols-3 gap-1.5">
                                {(d as any).status === 'CANCELLED' ? (
                                  <button onClick={() => handleRestoreDeadline(d)} disabled={actionLoading === d.id}
                                    className="py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40">
                                    <Play className="w-3 h-3" /> Aktifkan
                                  </button>
                                ) : (d as any).status === 'HOLD' ? (
                                  <button onClick={() => handleToggleHold(d)} disabled={actionLoading === d.id}
                                    className="py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40">
                                    <Play className="w-3 h-3" /> Lanjut
                                  </button>
                                ) : (
                                  <button onClick={() => handleToggleHold(d)} disabled={actionLoading === d.id}
                                    className="py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40">
                                    <Pause className="w-3 h-3" /> Tahan
                                  </button>
                                )}
                                {(d as any).status !== 'CANCELLED' ? (
                                  <button onClick={() => handleCancelDeadline(d)} disabled={actionLoading === d.id}
                                    className="py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 font-bold text-[10px] flex items-center justify-center gap-1 disabled:opacity-40">
                                    <Ban className="w-3 h-3" /> Batal
                                  </button>
                                ) : (
                                  <button onClick={() => handleDeleteDeadline(d)}
                                    className="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-[10px] flex items-center justify-center gap-1">
                                    <Trash2 className="w-3 h-3" /> Hapus
                                  </button>
                                )}
                                <button onClick={() => handleDeleteDeadline(d)}
                                  className="py-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-500/40 font-bold text-[10px] flex items-center justify-center gap-1">
                                  <Trash2 className="w-3 h-3" /> Hapus
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============ SISA MODAL (disingkat karena tidak berubah) ============ */}
      {/* Modal Konfirmasi Quick Done, Modal Catatan, Modal Manual, Modal Template, Modal Review, Modal Edit, Modal Duplikat — SAMA seperti file asli Anda */}

      {/* MODAL KONFIRMASI QUICK DONE */}
      {confirmDoneItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border-2 border-emerald-300 dark:border-emerald-500/40 mb-3">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Tandai Selesai?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Anda yakin sudah menyelesaikan tugas ini?</p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-3 text-left">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tugas:</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{confirmDoneItem.title}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmDoneItem(null)}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition">
                Batal
              </button>
              <button onClick={() => handleQuickDone(confirmDoneItem)} disabled={quickDoneLoading === confirmDoneItem.id}
                className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5">
                {quickDoneLoading === confirmDoneItem.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</> : <><Check className="w-3.5 h-3.5" /> Ya, Selesai</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATATAN: Semua modal lain (Catatan/Foto, Manual, Template, Review, Edit, Duplikat) tetap pakai kode lama Anda */}
      {/* Jika ingin modul ini jalan tanpa error, pastikan Anda telah menyatukan kembali blok modal-modal tsb di sini */}
    </div>
  );
};