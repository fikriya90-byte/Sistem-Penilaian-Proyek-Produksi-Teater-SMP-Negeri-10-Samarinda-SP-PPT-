import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Paperclip,
  PlusCircle,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS, STAGES } from '../../core/constants';
import { DivisionType, ProductionStage, TaskItem, TaskPriority, TaskStatus, UserProfile } from '../../core/types';
import {
  createTask,
  deleteTask,
  fetchUsersByClass,
  recordAuditLog,
  subscribeTasksByClass,
  updateTask
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const TaskDeadlineModule: React.FC = () => {
  const { user, activeClass, isTeacher, isPimprod, isSutradara, isKoordinator } = useAuth();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskForProof, setSelectedTaskForProof] = useState<TaskItem | null>(null);
  const [selectedTaskForReview, setSelectedTaskForReview] = useState<TaskItem | null>(null);

  // New task form fields
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStage, setNewStage] = useState<ProductionStage>('PELAKSANAAN');
  const [newDivision, setNewDivision] = useState<DivisionType>('Perlengkapan');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');

  // Proof submission fields
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');

  // Review fields
  const [reviewStatus, setReviewStatus] = useState<TaskStatus>('APPROVED');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewRating, setReviewRating] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeTasksByClass(activeClass.id, (taskList) => {
      setTasks(taskList);
    });
    fetchUsersByClass(activeClass.id).then(u => setClassStudents(u));
    return () => unsub();
  }, [activeClass]);

  const canCreateTasks = isTeacher || isPimprod || isSutradara || isKoordinator;

  // Real-time countdown helper
  const getDeadlineStatus = (dueDateIso: string, status: TaskStatus) => {
    if (status === 'APPROVED') {
      return { text: 'Selesai & Disetujui', color: 'text-emerald-600 bg-emerald-50 border-emerald-300' };
    }

    const diff = new Date(dueDateIso).getTime() - currentTime.getTime();
    if (diff <= 0) {
      return { text: 'TERLAMBAT (OVERDUE)', color: 'text-rose-700 bg-rose-100 border-rose-300 font-black' };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let label = `${days}h ${remHours}j ${mins}m`;
    if (days === 0) label = `${hours}j ${mins}m`;

    if (hours < 24) {
      return { text: `Tersisa: ${label}`, color: 'text-rose-600 bg-rose-50 border-rose-200 font-bold animate-pulse' };
    }
    if (hours <= 72) {
      return { text: `Tersisa: ${label}`, color: 'text-amber-700 bg-amber-50 border-amber-200 font-semibold' };
    }
    return { text: `Tersisa: ${label}`, color: 'text-slate-600 bg-slate-50 border-slate-200' };
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!newTitle.trim() || !newDueDate) {
      showToast('Harap lengkapi judul tugas dan batas waktu deadline.', 'warning');
      return;
    }

    const assignee = classStudents.find(s => s.uid === newAssigneeId);

    try {
      const taskId = await createTask({
        classId: activeClass.id,
        productionId: 'prod-ix-a',
        stageId: newStage,
        divisionName: newDivision,
        assigneeId: newAssigneeId || undefined,
        assigneeName: assignee ? assignee.displayName : 'Semua Anggota Divisi',
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
        status: 'NOT_STARTED',
        progress: 0,
        dueDate: new Date(newDueDate).toISOString(),
        createdBy: user.uid,
        creatorName: user.displayName,
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Task',
        targetId: taskId,
        details: `Membuat tugas "${newTitle}" untuk ${newDivision}`,
      });

      showToast('Tugas dan deadline baru berhasil diterbitkan!', 'success');
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
    } catch (err: any) {
      showToast('Gagal membuat tugas: ' + err.message, 'error');
    }
  };
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
    } catch (err: any) {
      showToast('Gagal membuat tugas: ' + err.message, 'error');
    }
  };

      const handleSubmitProof = async () => {
    if (!selectedTaskForProof || !user) return;
    if (!proofUrl.trim() && !proofNote.trim()) {
      showToast('Harap sertakan link bukti hasil kerja atau catatan penjelasan.', 'warning');
      return;
    }

    try {
      await updateTask(selectedTaskForProof.id, {
        status: 'SUBMITTED',
        progress: 90,
        proofUrl: proofUrl.trim(),
        proofNote: proofNote.trim(),
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'SUBMIT',
        targetType: 'Task',
        targetId: selectedTaskForProof.id,
        details: `Mengirimkan bukti tugas "${selectedTaskForProof.title}"`,
      });

      // Kirim notifikasi ke guru (non-blocking)
      if (activeClass) {
        try {
          const { notifyTeachers } = await import('../../services/firestoreService');
          await notifyTeachers(activeClass.id, {
            title: 'Bukti Tugas Baru Dikirim',
            message: `${user.displayName} mengirim bukti untuk: "${selectedTaskForProof.title}"`,
            category: 'Tugas',
            link: 'tugas',
            senderName: user.displayName,
          });
        } catch {
          /* non-fatal */
        }
      }

      showToast('Bukti pekerjaan berhasil dikirim untuk diverifikasi!', 'success');
      setSelectedTaskForProof(null);
      setProofUrl('');
      setProofNote('');
    } catch (err: any) {
      showToast('Gagal mengirim bukti: ' + err.message, 'error');
    }
  };

  const handleReviewTask = async () => {
    if (!selectedTaskForReview || !user) return;

    try {
      await updateTask(selectedTaskForReview.id, {
        status: reviewStatus,
        progress: reviewStatus === 'APPROVED' ? 100 : 50,
        feedback: reviewFeedback.trim(),
        rating: reviewRating,
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'TaskReview',
        targetId: selectedTaskForReview.id,
        details: `Verifikasi tugas "${selectedTaskForReview.title}": ${reviewStatus}`,
      });

      showToast(`Tugas berhasil diubah status menjadi ${reviewStatus}!`, 'success');
      setSelectedTaskForReview(null);
      setReviewFeedback('');
    } catch (err: any) {
      showToast('Gagal menyimpan hasil verifikasi: ' + err.message, 'error');
    }
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`Hapus tugas "${title}"?`)) return;
    try {
      await deleteTask(taskId);
      showToast('Tugas berhasil dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal menghapus tugas: ' + err.message, 'error');
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
    if (filterDivision !== 'ALL' && t.divisionName !== filterDivision) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Checklist Tugas & Deadline Produksi
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Pantau tenggat waktu nyata, kirim bukti progres, dan verifikasi hasil kerja
              </p>
            </div>
          </div>
        </div>

        {canCreateTasks && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Terbitkan Tugas Baru</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama tugas atau nama siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
          />
        </div>

        {/* Division Filter */}
        <select
          value={filterDivision}
          onChange={(e) => setFilterDivision(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50"
        >
          <option value="ALL">Semua Divisi</option>
          {DIVISIONS.map(d => (
            <option key={d.id} value={d.id}>
              {d.id}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50"
        >
          <option value="ALL">Semua Status</option>
          <option value="NOT_STARTED">Belum Dikerjakan</option>
          <option value="IN_PROGRESS">Sedang Dikerjakan</option>
          <option value="SUBMITTED">Menunggu Verifikasi</option>
          <option value="REVISION">Perlu Revisi</option>
          <option value="APPROVED">Selesai / Disetujui</option>
          <option value="OVERDUE">Terlambat (OVERDUE)</option>
        </select>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50"
        >
          <option value="ALL">Semua Prioritas</option>
          <option value="CRITICAL">Kritis</option>
          <option value="HIGH">Tinggi</option>
          <option value="MEDIUM">Sedang</option>
          <option value="LOW">Rendah</option>
        </select>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            Belum ada tugas yang sesuai dengan filter pencarian.
          </div>
        ) : (
          filteredTasks.map(task => {
            const countdown = getDeadlineStatus(task.dueDate, task.status);
            const isAssignedToMe = task.assigneeId === user?.uid;
            const canReview = isTeacher || isPimprod || (isKoordinator && task.divisionName === user?.divisionName);

            let priorityBadge = 'bg-slate-100 text-slate-700 border-slate-200';
            if (task.priority === 'CRITICAL') priorityBadge = 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
            if (task.priority === 'HIGH') priorityBadge = 'bg-amber-100 text-amber-800 border-amber-300';
            if (task.priority === 'MEDIUM') priorityBadge = 'bg-blue-100 text-blue-800 border-blue-300';

            return (
              <div
                key={task.id}
                className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                      {task.divisionName}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityBadge}`}>
                      {task.priority}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5">
                    <p className="text-[11px] flex items-center justify-between">
                      <span className="text-slate-400">Penanggung Jawab:</span>
                      <span className="font-bold text-slate-800 truncate max-w-[170px]">
                        {task.assigneeName || 'Divisi'}
                      </span>
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Batas Waktu:</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700">
                        {new Date(task.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Live Countdown Badge */}
                    <div className="pt-1">
                      <span className={`block text-center text-xs py-1 px-2.5 rounded-xl border ${countdown.color}`}>
                        {countdown.text}
                      </span>
                    </div>
                  </div>

                  {/* Submission note or feedback if available */}
                  {task.proofNote && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800 block mb-0.5">Catatan Pengiriman:</span>
                      <p className="line-clamp-2 italic">{task.proofNote}</p>
                      {task.proofUrl && (
                        <a
                          href={task.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Lihat Lampiran Bukti
                        </a>
                      )}
                    </div>
                  )}

                  {task.feedback && (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
                      <span className="font-bold block mb-0.5">Umpan Balik Penilai:</span>
                      <p className="line-clamp-2">{task.feedback}</p>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Student submit proof button */}
                  {task.status !== 'APPROVED' && (
                    <button
                      onClick={() => setSelectedTaskForProof(task)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{task.status === 'SUBMITTED' ? 'Edit Bukti' : 'Unggah Bukti'}</span>
                    </button>
                  )}

                  {/* Review button for Teacher/Coordinator */}
                  {canReview && (
                    <button
                      onClick={() => {
                        setSelectedTaskForReview(task);
                        setReviewStatus(task.status === 'SUBMITTED' ? 'APPROVED' : task.status);
                      }}
                      className="py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1 transition"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>
                  )}

                  {/* Teacher delete */}
                  {isTeacher && (
                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                      title="Hapus Tugas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Task */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <h3 className="text-base font-extrabold text-slate-900">
              Terbitkan Tugas & Deadline Baru
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Tugas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Pembuatan Properti Keris Pusaka"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Tugas</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detail instruksi pengerjaan tugas..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tahapan Produksi</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value as ProductionStage)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    {STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Divisi Target</label>
                  <select
                    value={newDivision}
                    onChange={(e) => setNewDivision(e.target.value as DivisionType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    {DIVISIONS.map(d => (
                      <option key={d.id} value={d.id}>{d.id}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Penerima Tugas</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    <option value="">Semua Anggota Divisi</option>
                    {classStudents.map(s => (
                      <option key={s.uid} value={s.uid}>
                        {s.displayName} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat Prioritas</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    <option value="LOW">Rendah (Low)</option>
                    <option value="MEDIUM">Sedang (Medium)</option>
                    <option value="HIGH">Tinggi (High)</option>
                    <option value="CRITICAL">Kritis (Critical)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batas Waktu Deadline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
                >
                  Simpan & Terbitkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Submit Proof */}
      {selectedTaskForProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase">Kirim Bukti Pekerjaan</span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {selectedTaskForProof.title}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL Tautan Berkas / Foto / Video Bukti
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... atau https://..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Tautan foto dokumentasi, video latihan, sketsa desain, atau Google Drive.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Progres / Penjelasan Hasil Kerja
                </label>
                <textarea
                  rows={3}
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="Jelaskan apa yang telah diselesaikan dan kendala yang dihadapi..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForProof(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitProof}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
                >
                  Kirim Bukti Tugas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Review & Approval */}
      {selectedTaskForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase">Verifikasi & Penilaian Tugas</span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {selectedTaskForReview.title}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ubah Status Tugas</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('APPROVED')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      reviewStatus === 'APPROVED' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Disetujui (Approved)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus('REVISION')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      reviewStatus === 'REVISION' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Perlu Revisi
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus('IN_PROGRESS')}
                    className={`py-2 rounded-xl text-xs font-bold transition border ${
                      reviewStatus === 'IN_PROGRESS' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    Proses Ulang
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Umpan Balik (Feedback)</label>
                <textarea
                  rows={3}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Catatan hasil verifikasi kepada siswa..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForReview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReviewTask}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
                >
                  Simpan Verifikasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
