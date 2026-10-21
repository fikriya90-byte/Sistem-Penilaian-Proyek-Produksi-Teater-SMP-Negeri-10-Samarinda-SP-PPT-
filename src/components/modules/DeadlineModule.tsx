import React, { useState, useEffect } from 'react';
import {
  Clock, PlusCircle, CheckCircle, Users, Upload, X, Send, Timer,
  AlertTriangle, Check, BookOpen, ChevronRight, ChevronLeft, ChevronDown,
  Sparkles, Target, ListChecks, Square, CheckSquare, User, Briefcase,
  Copy, FilePlus, Wand2, Loader2, Trash2, Pencil, Pause, Play, Ban,
  XCircle, Info, Save, Star, FileText, Link2, MessageSquare, Calendar,
  Camera, History, ShieldAlert,
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

const STAGE_ORDER: ProductionStage[] = ['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'];

interface TargetItem {
  type: 'PERAN' | 'DIVISI';
  name: string;
}

type DueDateMode = 'PRESERVE' | 'SHIFT' | 'OVERRIDE';

/* ============================================================
   DUPLIKAT MODAL
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
                id: notifRef.id,
                userId: uid,
                classId: targetClassId,
                title: 'Deadline Baru',
                message: `${user.displayName} mengirim deadline untuk ${targetClass.name}: "${source.title}"`,
                category: 'Tugas',
                read: false,
                link: 'tugas',
                createdAt: nowStr,
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
                  <button onClick={selectAllDeadlines} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                    <Check className="w-3 h-3" /> Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAllDeadlines} className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Hapus
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {deadlines.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">Belum ada deadline.</p>
                ) : deadlines.map(d => {
                  const isSelected = selectedDeadlineIds.includes(d.id);
                  const targetInfo = d.targetScope === 'SEMUA' ? 'Semua Siswa'
                    : d.targetScope === 'PERAN' ? `Peran: ${(d as any).targetRole || '-'}`
                    : d.targetScope === 'DIVISI' ? `Divisi: ${(d as any).targetDivision || '-'}`
                    : 'Custom';
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
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-bold">{targetInfo}</p>
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
                <div className="flex items-center gap-2">
                  <button onClick={selectAllClasses} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                    <Check className="w-3 h-3" /> Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAllClasses} className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Hapus
                  </button>
                </div>
              </div>
              {otherClasses.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">
                  Tidak ada kelas lain. Buat kelas lain dulu.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {otherClasses.map(c => {
                    const isSelected = selectedClassIds.includes(c.id);
                    const count = recipientPreview[c.id];
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
                            {isSelected && count !== undefined && (
                              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {count} siswa akan menerima
                              </p>
                            )}
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
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                Pengaturan Waktu & Tanggal
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Pilih bagaimana tanggal deadline asli akan diterapkan pada deadline baru.
              </p>

              <div className="space-y-3">
                <button type="button" onClick={() => setDueDateMode('PRESERVE')}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    dueDateMode === 'PRESERVE' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                  <div className={`p-0.5 rounded-full shrink-0 mt-0.5 ${dueDateMode === 'PRESERVE' ? 'bg-purple-500 text-white' : 'border-2 border-slate-300'}`}>
                    {dueDateMode === 'PRESERVE' ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Pertahankan Tanggal Asli
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Deadline baru akan menggunakan tanggal & waktu yang sama persis dengan asli.
                    </p>
                  </div>
                </button>

                <button type="button" onClick={() => setDueDateMode('SHIFT')}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    dueDateMode === 'SHIFT' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                  <div className={`p-0.5 rounded-full shrink-0 mt-0.5 ${dueDateMode === 'SHIFT' ? 'bg-purple-500 text-white' : 'border-2 border-slate-300'}`}>
                    {dueDateMode === 'SHIFT' ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Geser Tanggal
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Tampilkan setelah tanggal asli, digeser maju/mundur beberapa hari.
                    </p>
                  </div>
                </button>

                {dueDateMode === 'SHIFT' && (
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border-2 border-purple-200 dark:border-purple-500/30 space-y-2">
                    <label className="block text-xs font-bold text-purple-900 dark:text-purple-200">
                      Geser berapa hari?
                    </label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setShiftDays(prev => prev - 1)}
                        className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-purple-200 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-100 transition">
                        -
                      </button>
                      <input type="number" value={shiftDays}
                        onChange={(e) => setShiftDays(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-sm font-black text-center text-purple-900 dark:text-purple-200" />
                      <button type="button" onClick={() => setShiftDays(prev => prev + 1)}
                        className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-purple-200 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-100 transition">
                        +
                      </button>
                    </div>
                    <p className="text-[10px] text-purple-700 dark:text-purple-300">
                      Nilai positif = geser maju. Negatif = geser mundur.
                    </p>
                  </div>
                )}

                <button type="button" onClick={() => setDueDateMode('OVERRIDE')}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    dueDateMode === 'OVERRIDE' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}>
                  <div className={`p-0.5 rounded-full shrink-0 mt-0.5 ${dueDateMode === 'OVERRIDE' ? 'bg-purple-500 text-white' : 'border-2 border-slate-300'}`}>
                    {dueDateMode === 'OVERRIDE' ? <Check className="w-4 h-4" /> : <div className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Set Tanggal Baru
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Semua deadline akan pakai tanggal & waktu yang Anda tentukan.
                    </p>
                  </div>
                </button>

                {dueDateMode === 'OVERRIDE' && (
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border-2 border-purple-200 dark:border-purple-500/30 space-y-2">
                    <label className="block text-xs font-bold text-purple-900 dark:text-purple-200">
                      Tanggal & Waktu Baru
                    </label>
                    <input type="datetime-local" value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-slate-800 text-xs font-semibold"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                Konfirmasi Duplikat
              </h4>
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-2 border-purple-200 dark:border-purple-500/30 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Deadline</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{selectedDeadlineIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Kelas</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{selectedClassIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Penerima</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{totalRecipients}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-purple-200 dark:border-purple-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Mode Waktu:</span>
                    <span className="font-bold text-purple-900 dark:text-purple-200">
                      {dueDateMode === 'PRESERVE' ? 'Pertahankan Asli' :
                       dueDateMode === 'SHIFT' ? `Geser ${shiftDays >= 0 ? '+' : ''}${shiftDays} hari` :
                       'Set Tanggal Baru'}
                    </span>
                  </div>
                  {dueDateMode === 'OVERRIDE' && overrideDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">Tanggal Baru:</span>
                      <span className="font-bold text-purple-900 dark:text-purple-200">
                        {new Date(overrideDate).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    Deadline akan dikirim <strong>hanya ke penerima yang sesuai peran/divisi</strong> dari deadline asli.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t flex justify-between items-center gap-2 shrink-0">
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
      return { text: 'DIBATALKAN', color: 'text-slate-600 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:text-slate-400' };
    }
    if (status === 'HOLD') {
      return { text: 'DITAHAN - countdown di-pause', color: 'text-amber-800 bg-amber-50 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300' };
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
        id: subId,
        deadlineId: d.id,
        classId: activeClass.id,
        studentId: user.uid,
        studentName: user.displayName,
        status: isLate ? 'TERLAMBAT' : 'SELESAI',
        progress: 100,
        proofUrl: '',
        proofNote: '',
        evidencePhotos: [],
        evidenceCount: 0,
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
        id: subId,
        deadlineId: selectedDeadline.id,
        classId: activeClass.id,
        studentId: user.uid,
        studentName: user.displayName,
        status: isLate ? 'TERLAMBAT' : 'SELESAI',
        progress: 100,
        proofUrl: noteLink.trim(),
        proofNote: noteText.trim(),
        evidencePhotos: notePhotos.map(p => ({
          id: p.id,
          dataUrl: p.dataUrl,
          caption: p.caption || '',
          uploadedAt: p.uploadedAt,
          sizeKB: p.sizeKB,
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
      setNoteText('');
      setNoteLink('');
      setNotePhotos([]);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
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
    setManualPhotoHint('');
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
          // ✅ FIX: Handle CUSTOM
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

    if (editTargetScope === 'PERAN' && !editTargetRole) {
      showToast('Pilih peran tujuan.', 'warning'); return;
    }
    if (editTargetScope === 'DIVISI' && !editTargetDivision) {
      showToast('Pilih divisi tujuan.', 'warning'); return;
    }
    if (editTargetScope === 'CUSTOM' && editTargetRoles.length === 0 && editTargetDivisions.length === 0) {
      showToast('Pilih minimal 1 peran atau divisi.', 'warning'); return;
    }

    setActionLoading(editingDeadline.id);
    try {
      const recipientIds = new Set<string>();
      users.forEach(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
        if (u.role === 'Admin' || u.role === 'Super Admin') return;

        if (editTargetScope === 'SEMUA') {
          recipientIds.add(u.uid);
        } else if (editTargetScope === 'PERAN') {
          if (u.role === editTargetRole) recipientIds.add(u.uid);
        } else if (editTargetScope === 'DIVISI') {
          if (u.divisionName === editTargetDivision) recipientIds.add(u.uid);
        } else if (editTargetScope === 'CUSTOM') {
          if (editTargetRoles.includes(u.role)) recipientIds.add(u.uid);
          else if (u.divisionName && editTargetDivisions.includes(u.divisionName)) recipientIds.add(u.uid);
        }
      });

      const updateData: any = {
        title: editTitle.trim(),
        description: editDesc.trim(),
        dueDate: new Date(editDueDate).toISOString(),
        priority: editPriority,
        isCritical: editIsCritical,
        targetScope: editTargetScope,
        targetUserIds: Array.from(recipientIds),
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName,
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
            // ✅ FIX: Handle CUSTOM target
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
          id: newRef.id,
          classId: activeClass.id,
          title: tpl.title,
          description: tpl.description,
          dueDate: dueIso,
          priority: tpl.priority,
          targetScope: targetScope,
          targetUserIds: Array.from(recipientIds),
          stage: selectedStage,
          isCritical: tpl.isCritical || false,
          photoHint: (tpl as any).photoHint || '',
          photoSearchQuery: (tpl as any).photoSearchQuery || '',
          createdBy: user.uid,
          creatorName: user.displayName,
          creatorRole: user.role,
          createdAt: new Date().toISOString(),
          templateReference: tpl.reference,
        };
        if (targetRole) deadlineData.targetRole = targetRole;
        if (targetDivision) deadlineData.targetDivision = targetDivision;
        // ✅ FIX: Simpan array targetRoles untuk CUSTOM
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
            id: notifRef.id,
            userId: uid,
            classId: activeClass.id,
            title: `${success} Deadline Baru`,
            message: `${user.displayName} mengirim ${success} deadline (${selectedStage}).`,
            category: 'Tugas', read: false, link: 'tugas',
            createdAt: nowStr,
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
      const manualData: any = {
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
        photoHint: manualPhotoHint.trim(),
        photoSearchQuery: '',
        createdBy: user.uid,
        creatorName: user.displayName,
        creatorRole: user.role,
        createdAt: new Date().toISOString(),
        isManual: true,
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
            id: notifRef.id,
            userId: uid,
            classId: activeClass.id,
            title: 'Deadline Baru',
            message: `${user.displayName}: "${manualTitle.trim()}"`,
            category: 'Tugas', read: false, link: 'tugas',
            createdAt: nowStr,
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
    const dStage = (d as any).stage as ProductionStage | undefined;
    const mySub = mySubmissions[d.id];
    const isDone = !!mySub;

    // 1. Logika Filter Tahapan
    if (filterStage !== 'ALL' && dStage && dStage !== filterStage) {
      // PAKSA TAMPIL: Untuk siswa, jika tugas dari tahap sebelumnya belum selesai, tetap tampilkan meski beda tab
      if (!canCreate) {
        const activeStageId = stageConfig?.currentStage || 'PELAKSANAAN';
        const currentStageIndex = STAGE_ORDER.indexOf(activeStageId);
        const taskStageIndex = STAGE_ORDER.indexOf(dStage);
        const isPastStage = taskStageIndex !== -1 && taskStageIndex < currentStageIndex;

        if (!isPastStage || isDone) return false;
      } else {
        // Untuk Guru/Admin, filter berjalan normal
        return false;
      }
    }

    // 2. Logika Visibilitas Target
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
      // ✅ FIX: Hapus fallback (if (dTargetUserIds.length === 0) return true;) yang menyebabkan kebocoran
      if (dTargetUserIds.length > 0) return dTargetUserIds.includes(user.uid);
      return false;
    }
    return false;
  });

  // (Sisa JSX rendering tidak berubah, cukup salin dari file asli Anda sebelumnya)
  return (
    <div className="space-y-6">
      {/* ... (Seluruh isi return JSX dari file DeadlineModule.tsx yang lama) ... */}
    </div>
  );
};