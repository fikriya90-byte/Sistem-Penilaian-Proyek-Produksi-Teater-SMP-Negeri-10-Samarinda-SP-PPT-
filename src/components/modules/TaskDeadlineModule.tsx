import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, ExternalLink, PlusCircle, Search,
  Trash2, Upload, UserCheck, Users, X, Save, Timer, Target, ListChecks,
  ChevronRight, Wand2, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS, STAGES } from '../../core/constants';
import {
  DivisionType, ProductionStage, TaskItem, TaskPriority, TaskStatus, UserProfile,
} from '../../core/types';
import {
  createTask, deleteTask, fetchUsersByClass, recordAuditLog,
  subscribeTasksByClass, updateTask, notifyTeachers,
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { TASK_TEMPLATES, STAGE_INFO_TASK, TaskTemplate } from '../../core/taskTemplates';

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  LOW: { label: 'Rendah', color: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Sedang', color: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  HIGH: { label: 'Tinggi', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  CRITICAL: { label: 'Kritis', color: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' },
};

function getPriorityConfig(p?: string) {
  return PRIORITY_CONFIG[p || 'MEDIUM'] || PRIORITY_CONFIG.MEDIUM;
}

export const TaskDeadlineModule: React.FC = () => {
  const { user, activeClass, isTeacher, isGuruPengampu, isAdminRole, isPimprod, isSutradara, isKoordinator } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'tasks' | 'templates'>('tasks');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [now, setNow] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterDivision, setFilterDivision] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal manual
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mStage, setMStage] = useState<ProductionStage>('PELAKSANAAN');
  const [mDivision, setMDivision] = useState<DivisionType>('Perlengkapan');
  const [mAssignee, setMAssignee] = useState('');
  const [mPriority, setMPriority] = useState<TaskPriority>('MEDIUM');
  const [mDue, setMDue] = useState('');

  // Modal template wizard
  const [isTplOpen, setIsTplOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tplStage, setTplStage] = useState<ProductionStage>('PELAKSANAAN');
  const [tplSel, setTplSel] = useState<TaskTemplate | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tDue, setTDue] = useState('');
  const [tPriority, setTPriority] = useState<TaskPriority>('MEDIUM');
  const [tTarget, setTTarget] = useState<'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM'>('SEMUA');
  const [tDivision, setTDivision] = useState<DivisionType>('Perlengkapan');
  const [tRole, setTRole] = useState('Pemain');
  const [tUserIds, setTUserIds] = useState<string[]>([]);

  // Modal bukti & review
  const [proofTask, setProofTask] = useState<TaskItem | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [reviewTask, setReviewTask] = useState<TaskItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<TaskStatus>('APPROVED');
  const [reviewFeedback, setReviewFeedback] = useState('');

  const canCreate = isTeacher || isGuruPengampu || isAdminRole || isPimprod || isSutradara || isKoordinator;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeTasksByClass(activeClass.id, setTasks);
    fetchUsersByClass(activeClass.id).then(setClassStudents);
    return () => unsub();
  }, [activeClass]);

  const getCountdown = (dueIso: string, status: TaskStatus) => {
    if (status === 'APPROVED') return { text: '✓ Selesai', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' };
    const diff = new Date(dueIso).getTime() - now.getTime();
    if (diff <= 0) return { text: 'TERLAMBAT', color: 'text-rose-700 bg-rose-100 border-rose-300 font-black' };
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    const label = d > 0 ? `${d}h ${h % 24}j` : `${h}j`;
    if (h < 24) return { text: `Sisa ${label}`, color: 'text-rose-700 bg-rose-50 border-rose-200 font-bold animate-pulse' };
    if (h <= 72) return { text: `Sisa ${label}`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { text: `Sisa ${label}`, color: 'text-slate-700 bg-slate-50 border-slate-200' };
  };

  // MANUAL CREATE
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!mTitle.trim() || !mDue) { showToast('Lengkapi judul dan deadline', 'warning'); return; }
    setSubmitting(true);
    try {
      const assignee = classStudents.find(s => s.uid === mAssignee);
      const taskId = await createTask({
        classId: activeClass.id,
        productionId: 'prod',
        stageId: mStage,
        divisionName: mDivision,
        assigneeId: mAssignee || undefined,
        assigneeName: assignee ? assignee.displayName : 'Semua Anggota Divisi',
        title: mTitle.trim(),
        description: mDesc.trim(),
        priority: mPriority,
        status: 'NOT_STARTED',
        progress: 0,
        dueDate: new Date(mDue).toISOString(),
        createdBy: user.uid,
        creatorName: user.displayName,
      } as any);
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Task', targetId: taskId,
        details: `Buat tugas manual: ${mTitle}`,
      });
      showToast('Tugas berhasil dibuat!', 'success');
      setIsManualOpen(false);
      resetManual();
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Error'), 'error');
    } finally { setSubmitting(false); }
  };

  const resetManual = () => {
    setMTitle(''); setMDesc(''); setMStage('PELAKSANAAN');
    setMDivision('Perlengkapan'); setMAssignee(''); setMPriority('MEDIUM'); setMDue('');
  };

  // TEMPLATE STEP 2
  const selectTemplate = (tpl: TaskTemplate) => {
    setTplSel(tpl);
    setTTitle(tpl.title);
    setTDesc(tpl.description);
    setTPriority(tpl.priority);
    setTTarget(tpl.targetType);
    if (tpl.targetDivision) setTDivision(tpl.targetDivision);
    if (tpl.targetRole) setTRole(tpl.targetRole as string);
    const due = new Date();
    due.setDate(due.getDate() + tpl.daysFromNow);
    due.setHours(23, 59, 0, 0);
    setTDue(due.toISOString().slice(0, 16));
    setStep(3);
  };

  // TEMPLATE STEP 4 SUBMIT
  const handleTemplateCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!tTitle.trim() || !tDue) { showToast('Lengkapi judul dan deadline', 'warning'); return; }
    setSubmitting(true);
    try {
      let assigneeName = 'Semua Siswa';
      let assigneeId = '';
      if (tTarget === 'DIVISI') assigneeName = `Divisi ${tDivision}`;
      if (tTarget === 'PERAN') assigneeName = `Peran ${tRole}`;
      if (tTarget === 'CUSTOM') {
        assigneeName = `${tUserIds.length} siswa terpilih`;
      }
      const taskId = await createTask({
        classId: activeClass.id,
        productionId: 'prod',
        stageId: tplStage,
        divisionName: tTarget === 'DIVISI' ? tDivision : (tDivision || 'Pengurus Inti'),
        assigneeId: assigneeId || undefined,
        assigneeName,
        title: tTitle.trim(),
        description: tDesc.trim(),
        priority: tPriority,
        status: 'NOT_STARTED',
        progress: 0,
        dueDate: new Date(tDue).toISOString(),
        createdBy: user.uid,
        creatorName: user.displayName,
      } as any);
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Task', targetId: taskId,
        details: `Buat tugas dari template: ${tTitle}`,
      });
      // Notif ke guru
      try {
        await notifyTeachers(activeClass.id, {
          title: 'Tugas Baru',
          message: `${user.displayName}: "${tTitle}"`,
          category: 'Tugas', link: 'tugas',
          senderName: user.displayName,
        });
      } catch {}
      showToast('Tugas berhasil dikirim dari template!', 'success');
      setIsTplOpen(false);
      setStep(1);
      setTplSel(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Error'), 'error');
    } finally { setSubmitting(false); }
  };

  // SUBMIT PROOF
  const handleProof = async () => {
    if (!proofTask || !user || !activeClass) return;
    if (!proofUrl.trim() && !proofNote.trim()) { showToast('Isi link atau catatan', 'warning'); return; }
    setSubmitting(true);
    try {
      await updateTask(proofTask.id, {
        status: 'SUBMITTED',
        progress: 90,
        proofUrl: proofUrl.trim(),
        proofNote: proofNote.trim(),
      } as any);
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'SUBMIT', targetType: 'Task', targetId: proofTask.id,
        details: `Submit bukti: ${proofTask.title}`,
      });
      try {
        await notifyTeachers(activeClass.id, {
          title: 'Bukti Tugas Dikirim',
          message: `${user.displayName}: "${proofTask.title}"`,
          category: 'Tugas', link: 'tugas',
          senderName: user.displayName,
        });
      } catch {}
      showToast('Bukti berhasil dikirim!', 'success');
      setProofTask(null); setProofUrl(''); setProofNote('');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Error'), 'error');
    } finally { setSubmitting(false); }
  };

  // REVIEW
  const handleReview = async () => {
    if (!reviewTask || !user) return;
    setSubmitting(true);
    try {
      await updateTask(reviewTask.id, {
        status: reviewStatus,
        progress: reviewStatus === 'APPROVED' ? 100 : 50,
        feedback: reviewFeedback.trim(),
      } as any);
      showToast(`Status diubah ke ${reviewStatus}`, 'success');
      setReviewTask(null); setReviewFeedback('');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Error'), 'error');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus tugas "${title}"?`)) return;
    try {
      await deleteTask(id);
      showToast('Tugas dihapus', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filteredTasks = tasks.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
    if (filterDivision !== 'ALL' && t.divisionName !== filterDivision) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Tugas & Deadline
              </span>
              <h2 className="text-xl font-black text-white mt-1">Checklist Tugas Produksi</h2>
              <p className="text-xs text-slate-300 mt-0.5">Buat tugas manual atau pakai template dari 12 peran resmi</p>
            </div>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setIsManualOpen(true); resetManual(); }}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Buat Manual
              </button>
              <button onClick={() => { setIsTplOpen(true); setStep(1); setTplSel(null); }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
                <Wand2 className="w-4 h-4" /> Pakai Template
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2">
        <button onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'tasks' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
          📋 Daftar Tugas ({tasks.length})
        </button>
        <button onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'templates' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
          ✨ Template (47)
        </button>
      </div>

      {/* TAB: TASKS */}
      {activeTab === 'tasks' && (
        <>
          {/* FILTER */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Cari tugas..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
            </div>
            <select value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              <option value="ALL">Semua Divisi</option>
              {DIVISIONS.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              <option value="ALL">Semua Status</option>
              <option value="NOT_STARTED">Belum</option>
              <option value="IN_PROGRESS">Proses</option>
              <option value="SUBMITTED">Menunggu Review</option>
              <option value="APPROVED">Selesai</option>
              <option value="OVERDUE">Terlambat</option>
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
              <option value="ALL">Semua Prioritas</option>
              <option value="CRITICAL">Kritis</option>
              <option value="HIGH">Tinggi</option>
              <option value="MEDIUM">Sedang</option>
              <option value="LOW">Rendah</option>
            </select>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Belum ada tugas. {canCreate ? 'Klik "Buat Manual" atau "Pakai Template".' : ''}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map(task => {
                const cd = getCountdown(task.dueDate, task.status);
                const prio = getPriorityConfig(task.priority);
                const canReview = isTeacher || isGuruPengampu || isAdminRole || isPimprod || (isKoordinator && task.divisionName === user?.divisionName);
                return (
                  <div key={task.id} className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        {task.divisionName || 'Divisi'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${prio.color}`}>
                        {prio.label}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{task.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <p><strong>PIC:</strong> {task.assigneeName || 'Divisi'}</p>
                      <p><strong>Deadline:</strong> {new Date(task.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className={`p-2 rounded-xl border text-center text-xs ${cd.color}`}>{cd.text}</div>
                    {task.feedback && (
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
                        <strong>Feedback:</strong> {task.feedback}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      {task.status !== 'APPROVED' && (
                        <button onClick={() => { setProofTask(task); setProofUrl(task.proofUrl || ''); setProofNote(task.proofNote || ''); }}
                          className="flex-1 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1">
                          <Upload className="w-3.5 h-3.5" /> Bukti
                        </button>
                      )}
                      {canReview && (
                        <button onClick={() => { setReviewTask(task); setReviewStatus(task.status === 'SUBMITTED' ? 'APPROVED' : task.status); }}
                          className="py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Review
                        </button>
                      )}
                      {(isTeacher || isGuruPengampu || isAdminRole) && (
                        <button onClick={() => handleDelete(task.id, task.title)}
                          className="p-1.5 text-slate-400 hover:text-rose-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB: TEMPLATES PREVIEW */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <Wand2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <strong>47 template tugas</strong> sesuai job desc 12 peran produksi teater. Klik "Pakai Template" untuk mulai.
            </div>
          </div>
          {STAGES.map(stage => (
            <div key={stage.id} className="p-5 rounded-3xl bg-white border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded-full bg-gradient-to-r ${STAGE_INFO_TASK[stage.id].gradient}`}>
                  {STAGE_INFO_TASK[stage.id].label}
                </span>
                <span className="text-xs text-slate-500">({TASK_TEMPLATES[stage.id].length} template)</span>
              </div>
              <div className="space-y-2">
                {TASK_TEMPLATES[stage.id].map(tpl => {
                  const prio = getPriorityConfig(tpl.priority);
                  return (
                    <div key={tpl.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">{tpl.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{tpl.description}</p>
                        <p className="text-[9px] text-blue-600 mt-1 italic">📎 {tpl.reference}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${prio.color}`}>{prio.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL MANUAL CREATE */}
      {isManualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-500" /> Buat Tugas Manual
              </h3>
              <button onClick={() => setIsManualOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleManualCreate} className="space-y-3">
              <input type="text" required value={mTitle} onChange={(e) => setMTitle(e.target.value)}
                placeholder="Judul tugas *" className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <textarea rows={2} value={mDesc} onChange={(e) => setMDesc(e.target.value)}
                placeholder="Deskripsi" className="w-full p-2.5 rounded-xl border border-slate-200 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <select value={mStage} onChange={(e) => setMStage(e.target.value as ProductionStage)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs">
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={mPriority} onChange={(e) => setMPriority(e.target.value as TaskPriority)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs">
                  <option value="LOW">Rendah</option>
                  <option value="MEDIUM">Sedang</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="CRITICAL">Kritis</option>
                </select>
              </div>
              <select value={mDivision} onChange={(e) => setMDivision(e.target.value as DivisionType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs">
                {DIVISIONS.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
              </select>
              <select value={mAssignee} onChange={(e) => setMAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs">
                <option value="">Semua Anggota Divisi</option>
                {classStudents.filter(s => s.role !== 'Guru Pengampu' && s.role !== 'Guru Pembina' && s.role !== 'Admin' && s.role !== 'Super Admin').map(s => (
                  <option key={s.uid} value={s.uid}>{s.displayName} ({s.role})</option>
                ))}
              </select>
              <input type="datetime-local" required value={mDue} onChange={(e) => setMDue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsManualOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {submitting ? '...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TEMPLATE WIZARD */}
      {isTplOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-3xl max-h-[95vh] overflow-y-auto my-auto">
            <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-amber-500" /> Pakai Template Tugas
                </h3>
                <button onClick={() => setIsTplOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Langkah {step} dari 4</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-amber-500' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {step === 1 && (
                <>
                  <h4 className="text-sm font-extrabold">Langkah 1: Pilih Tahap</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STAGES.map(s => (
                      <button key={s.id} onClick={() => { setTplStage(s.id); setStep(2); }}
                        className={`p-4 rounded-2xl text-left bg-gradient-to-br ${STAGE_INFO_TASK[s.id].gradient} text-white shadow-md hover:scale-105 transition`}>
                        <p className="text-xs font-black uppercase">{s.id}</p>
                        <p className="text-[10px] mt-1 opacity-90">{TASK_TEMPLATES[s.id].length} template</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold">Langkah 2: Pilih Template ({tplStage})</h4>
                    <button onClick={() => setStep(1)} className="text-[11px] font-bold text-blue-600">← Ganti</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                    {TASK_TEMPLATES[tplStage].map(tpl => {
                      const prio = getPriorityConfig(tpl.priority);
                      return (
                        <button key={tpl.id} onClick={() => selectTemplate(tpl)}
                          className="p-4 rounded-2xl border-2 text-left border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 transition">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${prio.color}`}>{prio.label}</span>
                            <span className="text-[9px] text-slate-500 ml-auto">+{tpl.daysFromNow} hari</span>
                          </div>
                          <p className="text-xs font-extrabold line-clamp-2">{tpl.title}</p>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{tpl.description}</p>
                          <p className="text-[9px] text-blue-600 mt-2 italic">📎 {tpl.reference}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold">Langkah 3: Target & Detail</h4>
                    <button onClick={() => setStep(2)} className="text-[11px] font-bold text-blue-600">← Ganti</button>
                  </div>
                  <div className="space-y-3">
                    <input type="text" value={tTitle} onChange={(e) => setTTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
                    <textarea rows={2} value={tDesc} onChange={(e) => setTDesc(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="datetime-local" value={tDue} onChange={(e) => setTDue(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                      <select value={tPriority} onChange={(e) => setTPriority(e.target.value as TaskPriority)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs">
                        <option value="LOW">Rendah</option>
                        <option value="MEDIUM">Sedang</option>
                        <option value="HIGH">Tinggi</option>
                        <option value="CRITICAL">Kritis</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-bold mb-2">Target Penerima</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { v: 'SEMUA', l: 'Semua' },
                          { v: 'DIVISI', l: 'Divisi' },
                          { v: 'PERAN', l: 'Peran' },
                          { v: 'CUSTOM', l: 'Manual' },
                        ].map(o => (
                          <button key={o.v} type="button" onClick={() => setTTarget(o.v as any)}
                            className={`p-2 rounded-xl border-2 text-xs font-bold ${tTarget === o.v ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-slate-200 text-slate-600'}`}>
                            {o.l}
                          </button>
                        ))}
                      </div>
                      {tTarget === 'DIVISI' && (
                        <select value={tDivision} onChange={(e) => setTDivision(e.target.value as DivisionType)}
                          className="w-full mt-2 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                          {DIVISIONS.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
                        </select>
                      )}
                      {tTarget === 'PERAN' && (
                        <select value={tRole} onChange={(e) => setTRole(e.target.value)}
                          className="w-full mt-2 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                          <option value="Pimpinan Produksi">Pimpinan Produksi</option>
                          <option value="Sekretaris">Sekretaris</option>
                          <option value="Bendahara">Bendahara</option>
                          <option value="Sutradara">Sutradara</option>
                          <option value="Asisten Sutradara">Asisten Sutradara</option>
                          <option value="Pemain">Pemain</option>
                          <option value="Koordinator Perlengkapan">Koor. Perlengkapan</option>
                          <option value="Anggota Perlengkapan">Anggota Perlengkapan</option>
                          <option value="Koordinator Publikasi">Koor. Publikasi</option>
                          <option value="Anggota Publikasi">Anggota Publikasi</option>
                          <option value="Koordinator Tata Panggung">Koor. Panggung</option>
                          <option value="Anggota Tata Panggung">Anggota Panggung</option>
                          <option value="Koordinator Tata Rias">Koor. Rias</option>
                          <option value="Anggota Tata Rias">Anggota Rias</option>
                          <option value="Koordinator Tata Busana">Koor. Busana</option>
                          <option value="Anggota Tata Busana">Anggota Busana</option>
                          <option value="Koordinator Tata Musik">Koor. Musik</option>
                          <option value="Anggota Tata Musik">Anggota Musik</option>
                        </select>
                      )}
                      {tTarget === 'CUSTOM' && (
                        <div className="mt-2 max-h-40 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                          {classStudents.filter(u => u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin').map(u => (
                            <label key={u.uid} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                              <input type="checkbox"
                                checked={tUserIds.includes(u.uid)}
                                onChange={(e) => {
                                  if (e.target.checked) setTUserIds(p => [...p, u.uid]);
                                  else setTUserIds(p => p.filter(x => x !== u.uid));
                                }}
                                className="rounded border-slate-300" />
                              <span className="text-[11px] font-semibold">{u.displayName}</span>
                              <span className="text-[9px] text-slate-400 ml-auto">{u.role}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <h4 className="text-sm font-extrabold">Langkah 4: Konfirmasi</h4>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <p><strong>Tahap:</strong> {tplStage}</p>
                    <p><strong>Judul:</strong> {tTitle}</p>
                    <p><strong>Deadline:</strong> {tDue ? new Date(tDue).toLocaleString('id-ID') : '-'}</p>
                    <p><strong>Target:</strong> {tTarget === 'SEMUA' ? 'Semua Siswa' : tTarget === 'DIVISI' ? tDivision : tTarget === 'PERAN' ? tRole : `${tUserIds.length} siswa`}</p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-between sticky bottom-0 bg-white">
              <button onClick={() => setIsTplOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
              <div className="flex gap-2">
                {step > 1 && step < 4 && (
                  <button onClick={() => setStep((step - 1) as any)}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100">← Kembali</button>
                )}
                {step === 3 && (
                  <button onClick={() => setStep(4)}
                    className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1">
                    Lanjut <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {step === 4 && (
                  <button onClick={handleTemplateCreate} disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                    <Save className="w-3.5 h-3.5" /> {submitting ? '...' : 'Kirim Tugas'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROOF */}
      {proofTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold">Submit Bukti</h3>
              <button onClick={() => setProofTask(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input type="url" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://drive.google.com/..." className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <textarea rows={3} value={proofNote} onChange={(e) => setProofNote(e.target.value)}
                placeholder="Catatan..." className="w-full p-2.5 rounded-xl border border-slate-200 text-xs" />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => setProofTask(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button onClick={handleProof} disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs disabled:opacity-50">
                  {submitting ? '...' : 'Kirim'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REVIEW */}
      {reviewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold">Review: {reviewTask.title}</h3>
              <button onClick={() => setReviewTask(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setReviewStatus('APPROVED')}
                  className={`py-2 rounded-xl text-xs font-bold ${reviewStatus === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>✓ Setuju</button>
                <button onClick={() => setReviewStatus('REVISION')}
                  className={`py-2 rounded-xl text-xs font-bold ${reviewStatus === 'REVISION' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Revisi</button>
                <button onClick={() => setReviewStatus('IN_PROGRESS')}
                  className={`py-2 rounded-xl text-xs font-bold ${reviewStatus === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Proses</button>
              </div>
              <textarea rows={3} value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder="Feedback..." className="w-full p-2.5 rounded-xl border border-slate-200 text-xs" />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => setReviewTask(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button onClick={handleReview} disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs disabled:opacity-50">
                  {submitting ? '...' : 'Simpan Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
