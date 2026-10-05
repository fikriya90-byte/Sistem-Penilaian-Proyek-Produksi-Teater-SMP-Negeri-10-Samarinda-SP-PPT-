import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, ExternalLink, PlusCircle, Search,
  Trash2, Upload, UserCheck, X, Save, Timer, Target, ListChecks,
  Wand2, AlertTriangle, Square, CheckSquare, Package,
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

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Rendah', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  MEDIUM: { label: 'Sedang', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  HIGH: { label: 'Tinggi', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  CRITICAL: { label: 'Kritis', color: 'bg-rose-100 text-rose-800 border-rose-300' },
};

function getPriorityConfig(p?: string) {
  return PRIORITY_CONFIG[p || 'MEDIUM'] || PRIORITY_CONFIG.MEDIUM;
}

export const TaskDeadlineModule: React.FC = () => {
  const { user, activeClass, isTeacher, isGuruPengampu, isAdminRole, isPimprod, isSutradara, isKoordinator } = useAuth();
  const { showToast } = useToast();

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

  // Modal template baru — checklist centang
  const [isTplOpen, setIsTplOpen] = useState(false);
  const [tplStage, setTplStage] = useState<ProductionStage>('PELAKSANAAN');
  const [selectedTplIds, setSelectedTplIds] = useState<string[]>([]);

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

  // ==========================================
  // TEMPLATE FILTER SESUAI PERAN USER
  // ==========================================
  const getTemplatesForStage = (stage: ProductionStage) => {
    const all = TASK_TEMPLATES[stage];
    if (!user) return all;

    // Guru lihat semua
    if (isTeacher || isGuruPengampu || isAdminRole || isPimprod) return all;

    // Sutradara & Asisten lihat semua juga (mereka koordinasi lintas divisi)
    if (isSutradara || user.role === 'Asisten Sutradara') return all;

    // Koordinator lihat template divisinya + template perannya
    if (isKoordinator) {
      return all.filter(tpl =>
        tpl.targetType === 'SEMUA' ||
        tpl.targetDivision === user.divisionName ||
        tpl.targetRole === user.role
      );
    }

    // Anggota & Pemain lihat yang sesuai divisi/peran mereka
    return all.filter(tpl =>
      tpl.targetType === 'SEMUA' ||
      tpl.targetDivision === user.divisionName ||
      tpl.targetRole === user.role
    );
  };

  const currentTemplates = getTemplatesForStage(tplStage);

  const toggleTplSelect = (id: string) => {
    setSelectedTplIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedTplIds(currentTemplates.map(t => t.id));
  const deselectAll = () => setSelectedTplIds([]);

  // ==========================================
  // KIRIM TEMPLATE TERPILIH — SEMUA SEKALIGUS
  // ==========================================
  const handleSendSelectedTemplates = async () => {
    if (!user || !activeClass) return;
    if (selectedTplIds.length === 0) {
      showToast('Pilih minimal 1 template', 'warning');
      return;
    }
    setSubmitting(true);
    let success = 0;
    let failed = 0;

    for (const id of selectedTplIds) {
      const tpl = currentTemplates.find(t => t.id === id);
      if (!tpl) continue;

      try {
        const due = new Date();
        due.setDate(due.getDate() + tpl.daysFromNow);
        due.setHours(23, 59, 0, 0);

        let assigneeName = 'Semua Siswa';
        let divisionName = tpl.targetDivision || user.divisionName || 'Pengurus Inti';
        if (tpl.targetType === 'DIVISI' && tpl.targetDivision) {
          assigneeName = `Divisi ${tpl.targetDivision}`;
        } else if (tpl.targetType === 'PERAN' && tpl.targetRole) {
          assigneeName = `Peran ${tpl.targetRole}`;
        }

        await createTask({
          classId: activeClass.id,
          productionId: 'prod',
          stageId: tplStage,
          divisionName: divisionName as any,
          assigneeName,
          title: tpl.title,
          description: tpl.description,
          priority: tpl.priority as TaskPriority,
          status: 'NOT_STARTED',
          progress: 0,
          dueDate: due.toISOString(),
          createdBy: user.uid,
          creatorName: user.displayName,
        } as any);
        success++;
      } catch (err) {
        failed++;
      }
    }

    // Audit log
    try {
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'TaskBatch', targetId: 'batch',
        details: `Kirim ${success} tugas dari template (${tplStage})`,
      });
    } catch {}

    // Notif guru
    try {
      await notifyTeachers(activeClass.id, {
        title: `${success} Tugas Baru Dikirim`,
        message: `${user.displayName} mengirim ${success} tugas dari template tahap ${tplStage}.`,
        category: 'Tugas', link: 'tugas',
        senderName: user.displayName,
      });
    } catch {}

    setSubmitting(false);

    if (failed === 0) {
      showToast(`✅ ${success} tugas berhasil dikirim!`, 'success');
      setIsTplOpen(false);
      setSelectedTplIds([]);
    } else {
      showToast(`${success} berhasil, ${failed} gagal. Cek log.`, 'warning');
    }
  };

  // ==========================================
  // MANUAL
  // ==========================================
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!mTitle.trim() || !mDue) { showToast('Lengkapi judul dan deadline', 'warning'); return; }
    setSubmitting(true);
    try {
      const assignee = classStudents.find(s => s.uid === mAssignee);
      await createTask({
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
        action: 'CREATE', targetType: 'Task', targetId: 'manual',
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

  // ==========================================
  // PROOF & REVIEW
  // ==========================================
  const handleProof = async () => {
    if (!proofTask || !user || !activeClass) return;
    if (!proofUrl.trim() && !proofNote.trim()) { showToast('Isi link atau catatan', 'warning'); return; }
    setSubmitting(true);
    try {
      await updateTask(proofTask.id, {
        status: 'SUBMITTED', progress: 90,
        proofUrl: proofUrl.trim(), proofNote: proofNote.trim(),
      } as any);
      await notifyTeachers(activeClass.id, {
        title: 'Bukti Tugas Dikirim',
        message: `${user.displayName}: "${proofTask.title}"`,
        category: 'Tugas', link: 'tugas', senderName: user.displayName,
      });
      showToast('Bukti berhasil dikirim!', 'success');
      setProofTask(null); setProofUrl(''); setProofNote('');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Error'), 'error');
    } finally { setSubmitting(false); }
  };

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
    try { await deleteTask(id); showToast('Tugas dihapus', 'info'); }
    catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

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
              <CheckSquare className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Tugas & Deadline
              </span>
              <h2 className="text-xl font-black text-white mt-1">Checklist Tugas Produksi</h2>
              <p className="text-xs text-slate-300 mt-0.5">Buat manual atau centang dari template sesuai peran Anda</p>
            </div>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setIsManualOpen(true); resetManual(); }}
                className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Buat Manual
              </button>
              <button onClick={() => { setIsTplOpen(true); setTplStage('PELAKSANAAN'); setSelectedTplIds([]); }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
                <Wand2 className="w-4 h-4" /> Pakai Template
              </button>
            </div>
          )}
        </div>
      </div>

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

      {/* TASK LIST */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Belum ada tugas.</p>
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

      {/* MODAL MANUAL */}
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

      {/* MODAL TEMPLATE — CHECKLIST CENTANG */}
      {isTplOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-3xl max-h-[95vh] overflow-y-auto my-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-amber-500" /> Pakai Template Tugas
                </h3>
                <button onClick={() => setIsTplOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
              </div>

              {/* Pilih Tahap — langsung filter */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {STAGES.map(s => (
                  <button key={s.id} onClick={() => { setTplStage(s.id); setSelectedTplIds([]); }}
                    className={`p-2.5 rounded-xl text-[11px] font-black uppercase transition ${
                      tplStage === s.id
                        ? `bg-gradient-to-br ${STAGE_INFO_TASK[s.id].gradient} text-white shadow-md`
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {s.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Body — daftar template centang */}
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-slate-500">
                  Template <strong>{tplStage}</strong> sesuai peran Anda — <strong>{currentTemplates.length} tersedia</strong>
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll}
                    className="text-[11px] font-bold text-blue-600 hover:underline">✓ Pilih Semua</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAll}
                    className="text-[11px] font-bold text-rose-600 hover:underline">✕ Hapus Pilihan</button>
                </div>
              </div>

              {currentTemplates.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs text-slate-500">
                    Tidak ada template untuk tahap {tplStage} sesuai peran Anda.
                    Coba pilih tahap lain.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                  {currentTemplates.map(tpl => {
                    const prio = getPriorityConfig(tpl.priority);
                    const isSelected = selectedTplIds.includes(tpl.id);
                    return (
                      <button key={tpl.id} onClick={() => toggleTplSelect(tpl.id)}
                        className={`p-3 rounded-2xl border-2 text-left transition flex items-start gap-2 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'
                        }`}>
                        <div className={`p-0.5 rounded-md shrink-0 mt-0.5 ${
                          isSelected ? 'bg-emerald-500 text-white' : 'border border-slate-300'
                        }`}>
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${prio.color}`}>
                              {prio.label}
                            </span>
                            <span className="text-[9px] text-slate-500 ml-auto">+{tpl.daysFromNow} hari</span>
                          </div>
                          <p className="text-xs font-extrabold text-slate-900 line-clamp-2">{tpl.title}</p>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{tpl.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                              {tpl.targetType === 'DIVISI' ? `Divisi: ${tpl.targetDivision}` :
                               tpl.targetType === 'PERAN' ? `Peran: ${tpl.targetRole}` :
                               'Semua Siswa'}
                            </span>
                            <span className="text-[9px] text-blue-600 italic line-clamp-1">
                              📎 {tpl.reference}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 sticky bottom-0 bg-white flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-600">
                Terpilih: <strong className="text-emerald-600">{selectedTplIds.length}</strong> tugas
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsTplOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button onClick={handleSendSelectedTemplates}
                  disabled={submitting || selectedTplIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Mengirim...' : `Kirim ${selectedTplIds.length} Tugas`}
                </button>
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
