import React, { useState, useEffect } from 'react';
import {
  Clock, PlusCircle, CheckCircle, Users, Upload, X, Send, Timer,
  AlertTriangle, Check, BookOpen, Flag, Palette, Star, ChevronRight,
  Sparkles, Target, ListChecks, Square, CheckSquare, User, Briefcase,
  Copy,
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { DEADLINE_TEMPLATES, STAGE_INFO, DeadlineTemplate } from '../../core/deadlineTemplates';
import { DeadlineCopyModal } from './DeadlineCopyModal';

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

export const DeadlineModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, classes } = useAuth();
  const { showToast } = useToast();

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, DeadlineSubmission>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineItem | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);
  const [filterStage, setFilterStage] = useState<'ALL' | ProductionStage>('ALL');
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  // WIZARD STATE
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<TargetItem[]>([]);
  const [targetAll, setTargetAll] = useState(false);
  const [dueDateOverride, setDueDateOverride] = useState('');

  // SUBMIT PROOF
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [progress, setProgress] = useState(50);
  const [askExtension, setAskExtension] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');

  // REVIEW
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

  const getCountdown = (dueDate?: string) => {
    if (!dueDate) return { text: 'Tanpa deadline', color: 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
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
    return { text: `${days} hari lagi`, color: 'text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
  };

  const handleOpenCreate = () => {
    setWizardStep(1);
    setSelectedStage('PELAKSANAAN');
    setSelectedTemplateIds([]);
    setSelectedTargets([]);
    setTargetAll(false);
    setDueDateOverride('');
    setIsCreateOpen(true);
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

  const recipientCount = (() => {
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

  const handleCreate = async () => {
    if (!user || !activeClass) return;
    if (selectedTemplateIds.length === 0) { showToast('Pilih minimal 1 template.', 'warning'); return; }
    if (!targetAll && selectedTargets.length === 0) { showToast('Pilih minimal 1 target penerima.', 'warning'); return; }

    setSubmitting(true);
    let success = 0;

    try {
      const recipientIds = new Set<string>();
      users.forEach(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return;
        if (u.role === 'Admin' || u.role === 'Super Admin') return;
        if (targetAll) { recipientIds.add(u.uid); return; }
        selectedTargets.forEach(t => {
          if (t.type === 'PERAN' && u.role === t.name) recipientIds.add(u.uid);
          if (t.type === 'DIVISI' && u.divisionName === t.name) recipientIds.add(u.uid);
        });
      });

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

        const newRef = doc(collection(db, 'deadlines'));
        const newDeadline: any = {
          id: newRef.id,
          classId: activeClass.id,
          title: tpl.title,
          description: tpl.description,
          dueDate: dueIso,
          priority: tpl.priority,
          targetScope: targetAll ? 'SEMUA' : 'CUSTOM',
          targetUserIds: Array.from(recipientIds),
          stage: selectedStage,
          isCritical: tpl.isCritical || false,
          createdBy: user.uid,
          creatorName: user.displayName,
          creatorRole: user.role,
          createdAt: new Date().toISOString(),
          templateReference: tpl.reference,
        };
        await setDoc(newRef, newDeadline);
        success++;
      }

      if (recipientIds.size > 0) {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const label = targetAll
          ? 'Semua Siswa'
          : selectedTargets.map(t => t.name).join(', ');

        recipientIds.forEach(uid => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: uid,
            classId: activeClass.id,
            title: `📌 ${success} Deadline Baru`,
            message: `${user.displayName} mengirim ${success} deadline untuk ${label} (${selectedStage}). Cek menu Tugas & Deadline.`,
            category: 'Tugas',
            read: false,
            link: 'deadline',
            createdAt: now,
          });
        });
        await batch.commit();
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'DeadlineBatch', targetId: 'batch',
        details: `Kirim ${success} deadline ke ${recipientCount} siswa (${selectedStage})`,
      });

      showToast(`✅ ${success} deadline berhasil dikirim ke ${recipientCount} siswa!`, 'success');
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

      try {
        const batch = writeBatch(db);
        users.filter(u => u.role === 'Guru Pengampu' || u.role === 'Guru Pembina').forEach(g => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: g.uid,
            classId: activeClass.id,
            title: askExtension ? '📝 Permintaan Perpanjangan' : '📤 Bukti Deadline Dikirim',
            message: `${user.displayName} (${user.role}) — "${selectedDeadline.title}"`,
            category: 'Tugas', read: false, link: 'deadline',
            createdAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      } catch { /* non-fatal */ }

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
        title: '💬 Feedback Deadline',
        message: `${user.displayName} memberi feedback untuk "${selectedDeadline?.title}"`,
        category: 'Feedback', read: false, link: 'deadline',
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
    if (!canCreate && user) {
      const tu: string[] = (d as any).targetUserIds || [];
      if (d.targetScope === 'CUSTOM' && tu.length > 0 && !tu.includes(user.uid)) return false;
    }
    return true;
  });

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
                Deadline Produksi
              </span>
              <h2 className="text-xl font-black text-white mt-1">Tenggat Waktu & Pengumpulan</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Multi-template × Multi-target • Salin ke kelas lain
              </p>
            </div>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setIsCopyOpen(true)}
                disabled={deadlines.length === 0}
                className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition">
                <Copy className="w-4 h-4" /> Salin ke Kelas Lain
              </button>
              <button onClick={handleOpenCreate}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
                <PlusCircle className="w-4 h-4" /> Kirim Deadline
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FILTER TAHAP */}
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

      {/* LIST DEADLINES */}
      {visibleDeadlines.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Timer className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Deadline</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canCreate ? 'Klik "Kirim Deadline" untuk mulai dari template.' : 'Tunggu instruksi Guru Pengampu.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleDeadlines.map(d => {
            const cd = getCountdown(d.dueDate);
            const mySub = mySubmissions[d.id];
            const priority = getPriorityConfig(d.priority);
            const dStage = (d as any).stage as ProductionStage | undefined;
            const stageInfo = dStage ? STAGE_INFO[dStage] : null;
            const tplRef = (d as any).templateReference;
            const targetCount = ((d as any).targetUserIds || []).length;
            const isCritical = (d as any).isCritical;

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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${priority.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                    {priority.label}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {d.targetScope === 'SEMUA' ? 'Semua Siswa' : `${targetCount} penerima`}
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{d.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">{d.description}</p>

                {tplRef && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 italic bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-500/30">
                    <BookOpen className="w-3 h-3 inline mr-1" /> {tplRef}
                  </p>
                )}

                <div className={`p-3 rounded-xl border text-xs font-bold text-center ${cd.color}`}>
                  <Clock className="w-4 h-4 inline mr-1" /> {cd.text}
                </div>

                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Dibuat <strong className="text-slate-600 dark:text-slate-300">{d.creatorName || 'Guru'}</strong>
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
                        {mySub.feedback && (
                          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-[11px] text-emerald-900 dark:text-emerald-200">
                            <strong>Feedback:</strong> {mySub.feedback}
                          </div>
                        )}
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
                  <button onClick={() => handleOpenReview(d)}
                    className="w-full py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-bold text-xs flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Lihat Submisi ({targetCount} target)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL WIZARD 4 STEP */}
      {/* ============================================================ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[95vh] overflow-y-auto my-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Send className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Kirim Deadline Baru</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Langkah {wizardStep} dari 4</p>
                  </div>
                </div>
                <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-4">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={`flex-1 h-1.5 rounded-full transition ${s <= wizardStep ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                ))}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* STEP 1 */}
              {wizardStep === 1 && (
                <>
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-rose-600" />
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Langkah 1: Pilih Tahap Produksi</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STAGES.map(s => {
                      const info = STAGE_INFO[s.id];
                      const tplCount = DEADLINE_TEMPLATES[s.id].length;
                      return (
                        <button key={s.id} onClick={() => { setSelectedStage(s.id); setSelectedTemplateIds([]); setWizardStep(2); }}
                          className={`p-4 rounded-2xl border-2 text-left transition hover:scale-[1.02] bg-gradient-to-br ${info.gradient} text-white border-transparent shadow-md`}>
                          <p className="text-xs font-black uppercase tracking-wider">{s.id}</p>
                          <p className="text-[10px] mt-1 opacity-90">{info.desc}</p>
                          <p className="text-[10px] mt-2 font-bold bg-white/20 px-2 py-0.5 rounded-md inline-block">
                            {tplCount} template
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* STEP 2 */}
              {wizardStep === 2 && (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-5 h-5 text-rose-600" />
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Langkah 2: Pilih Template ({STAGE_INFO[selectedStage].label})
                      </h4>
                    </div>
                    <button onClick={() => setWizardStep(1)} className="text-[11px] font-bold text-blue-600 hover:underline">
                      ← Ganti Tahap
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <strong>{currentTemplates.length} template</strong> tersedia — terpilih: <strong className="text-emerald-600">{selectedTemplateIds.length}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={selectAllTemplates} className="text-[11px] font-bold text-blue-600 hover:underline">
                        ✓ Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button onClick={deselectAllTemplates} className="text-[11px] font-bold text-rose-600 hover:underline">
                        ✕ Hapus Pilihan
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                    {currentTemplates.map(tpl => {
                      const prio = getPriorityConfig(tpl.priority);
                      const isSelected = selectedTemplateIds.includes(tpl.id);
                      const tRole = tpl.targetRole;
                      const tDiv = tpl.targetDivision;
                      const label = tRole ? `👤 ${tRole}` : tDiv ? `👥 ${tDiv}` : '🌐 Semua';
                      return (
                        <button key={tpl.id} onClick={() => toggleTemplate(tpl.id)}
                          className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                            isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-400'
                          }`}>
                          <div className={`p-0.5 rounded-md shrink-0 mt-0.5 ${isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}`}>
                            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {tpl.isCritical && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300">
                                  ★ KRITIS
                                </span>
                              )}
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${prio.color}`}>{prio.label}</span>
                              <span className="text-[9px] text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">{label}</span>
                              <span className="text-[9px] text-slate-500 ml-auto">{tpl.deadlineRef}</span>
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

              {/* STEP 3 */}
              {wizardStep === 3 && (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-rose-600" />
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Langkah 3: Pilih Target Penerima (Multi)</h4>
                    </div>
                    <button onClick={() => setWizardStep(2)} className="text-[11px] font-bold text-blue-600 hover:underline">
                      ← Ganti Template
                    </button>
                  </div>

                  <button onClick={() => { setTargetAll(!targetAll); setSelectedTargets([]); }}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center gap-3 transition ${
                      targetAll ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                    <div className={`p-0.5 rounded-md shrink-0 ${targetAll ? 'bg-amber-500 text-white' : 'border-2 border-slate-300'}`}>
                      {targetAll ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-transparent" />}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white">🎯 Semua Siswa</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Kirim ke semua siswa kelas ini kecuali guru/admin
                      </p>
                    </div>
                  </button>

                  {!targetAll && (
                    <>
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Per Peran
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {ROLE_LIST.map(r => {
                            const sel = isTargetSelected('PERAN', r);
                            return (
                              <button key={r} onClick={() => toggleTarget('PERAN', r)}
                                className={`p-2.5 rounded-xl border-2 text-[11px] font-bold transition text-left flex items-center gap-2 ${
                                  sel ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                                }`}>
                                {sel ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                <span className="truncate">{r}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" /> Per Divisi
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {DIVISION_LIST.map(d => {
                            const sel = isTargetSelected('DIVISI', d);
                            return (
                              <button key={d} onClick={() => toggleTarget('DIVISI', d)}
                                className={`p-2.5 rounded-xl border-2 text-[11px] font-bold transition text-left flex items-center gap-2 ${
                                  sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-purple-300'
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

              {/* STEP 4 */}
              {wizardStep === 4 && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Langkah 4: Konfirmasi & Kirim</h4>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tahap</p>
                      <p className={`text-xs font-bold bg-gradient-to-r ${STAGE_INFO[selectedStage].gradient} bg-clip-text text-transparent`}>
                        {STAGE_INFO[selectedStage].label}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Template Terpilih</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedTemplateIds.length} template</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Target Penerima</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {targetAll ? '🎯 Semua Siswa' : selectedTargets.map(t => `${t.type === 'PERAN' ? '👤' : '👥'} ${t.name}`).join(', ')}
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <strong>{recipientCount} siswa</strong> akan menerima notifikasi
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center gap-2 sticky bottom-0 bg-white dark:bg-slate-900">
              <button onClick={() => setIsCreateOpen(false)}
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
                    disabled={
                      (wizardStep === 2 && selectedTemplateIds.length === 0) ||
                      (wizardStep === 3 && !targetAll && selectedTargets.length === 0)
                    }
                    className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                    Lanjut <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {wizardStep === 4 && (
                  <button onClick={handleCreate} disabled={submitting}
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

      {/* ==================== MODAL SUBMIT PROOF ==================== */}
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

      {/* ==================== MODAL REVIEW ==================== */}
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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 flex items-center gap-1">
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

      {/* ==================== MODAL SALIN KE KELAS LAIN ==================== */}
      {isCopyOpen && (
        <DeadlineCopyModal
          allClasses={classes}
          currentClassId={activeClass?.id || ''}
          deadlines={deadlines}
          onClose={() => setIsCopyOpen(false)}
          onSuccess={() => {
            showToast('Deadline berhasil disalin ke kelas lain!', 'success');
          }}
        />
      )}
    </div>
  );
};