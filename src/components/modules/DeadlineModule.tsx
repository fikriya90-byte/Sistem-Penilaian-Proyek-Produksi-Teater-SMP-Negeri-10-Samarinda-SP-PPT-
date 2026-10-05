import React, { useState, useEffect } from 'react';
import {
  Clock, PlusCircle, CheckCircle, Users, Upload, X, Send, Timer,
  AlertTriangle, Check,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { DIVISIONS } from '../../core/constants';
import { DeadlineItem, DeadlineSubmission, DivisionType, UserRole } from '../../core/types';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';

// =====================================================
// SAFE PRIORITY CONFIG — fallback default
// =====================================================
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Rendah', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  MEDIUM: { label: 'Sedang', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  HIGH: { label: 'Tinggi', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  CRITICAL: { label: 'Kritis', color: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const DEFAULT_PRIORITY = { label: 'Sedang', color: 'bg-blue-100 text-blue-800 border-blue-300' };

function getPriorityConfig(priority?: string) {
  if (!priority) return DEFAULT_PRIORITY;
  return PRIORITY_CONFIG[priority] || DEFAULT_PRIORITY;
}

const CAN_CREATE_DEADLINE_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
  'Pimpinan Produksi', 'Sekretaris', 'Sutradara', 'Asisten Sutradara',
];

const isKoordinator = (role?: string) => !!role && role.startsWith('Koordinator ');

export const DeadlineModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, DeadlineSubmission>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineItem | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);
  const [filterScope, setFilterScope] = useState<'ALL' | 'MINE'>('ALL');
  const [now, setNow] = useState(new Date());

  // Form create
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newTarget, setNewTarget] = useState<'SEMUA' | 'DIVISI' | 'PERAN'>('SEMUA');
  const [newDivision, setNewDivision] = useState<DivisionType>('Perlengkapan');
  const [newRole, setNewRole] = useState<UserRole>('Pemain');
  const [submitting, setSubmitting] = useState(false);

  // Form submit
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [progress, setProgress] = useState(50);
  const [askExtension, setAskExtension] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');

  // Form feedback
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
    if (!dueDate) {
      return { text: 'Tanpa deadline', color: 'text-slate-700 bg-slate-50 border-slate-200' };
    }
    const diff = new Date(dueDate).getTime() - now.getTime();
    if (isNaN(diff)) {
      return { text: 'Format tanggal salah', color: 'text-slate-700 bg-slate-50 border-slate-200' };
    }
    if (diff <= 0) {
      const lateDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      return {
        text: `Terlambat ${lateDays} hari`,
        color: 'text-rose-700 bg-rose-100 border-rose-300',
      };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (hours < 24) {
      return {
        text: `${hours} jam lagi`,
        color: 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse font-bold',
      };
    }
    if (hours <= 72) {
      return { text: `${days} hari lagi`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { text: `${days} hari lagi`, color: 'text-slate-700 bg-slate-50 border-slate-200' };
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
        targetScope: newTarget,
        targetDivision: newTarget === 'DIVISI' ? newDivision : undefined,
        targetRole: newTarget === 'PERAN' ? newRole : undefined,
        createdBy: user.uid,
        creatorName: user.displayName,
        creatorRole: user.role,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, newDeadline);

      // Notifikasi
      try {
        const allUsers = await fetchUsersByClass(activeClass.id);
        const recipients = allUsers.filter(u => {
          if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return false;
          if (u.role === 'Admin' || u.role === 'Super Admin') return false;
          if (newTarget === 'SEMUA') return true;
          if (newTarget === 'DIVISI') return u.divisionName === newDivision;
          if (newTarget === 'PERAN') return u.role === newRole;
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
            title: 'Deadline Baru!',
            message: `${user.displayName} mengirim: "${newTitle.trim()}"`,
            category: 'Reminder',
            read: false,
            link: 'deadline',
            createdAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      } catch (err) {
        console.warn('Notif gagal (non-fatal):', err);
      }

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Deadline',
        targetId: newRef.id,
        details: `Buat deadline: ${newTitle}`,
      });

      showToast('Deadline berhasil dikirim!', 'success');
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewDue('');
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
        const { notifyTeachers } = await import('../../services/firestoreService');
        await notifyTeachers(activeClass.id, {
          title: 'Bukti Deadline Dikirim',
          message: `${user.displayName} submit: "${selectedDeadline.title}"`,
          category: 'Tugas',
          link: 'deadline',
        });
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

  const handleSaveProgress = async () => {
    if (!user || !activeClass || !selectedDeadline) return;
    setSubmitting(true);
    try {
      const subId = `${selectedDeadline.id}_${user.uid}`;
      await setDoc(doc(db, 'deadlineSubmissions', subId), {
        id: subId,
        deadlineId: selectedDeadline.id,
        classId: activeClass.id,
        studentId: user.uid,
        studentName: user.displayName,
        status: 'PROSES',
        progress,
        proofNote: proofNote.trim(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      showToast('Progres tersimpan!', 'success');
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
      showToast('Gagal load submisi: ' + err.message, 'error');
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
    if (filterScope === 'MINE' && user) {
      if (d.createdBy === user.uid) return true;
      if (d.targetScope === 'SEMUA') return true;
      if (d.targetScope === 'DIVISI' && d.targetDivision === user.divisionName) return true;
      if (d.targetScope === 'PERAN' && d.targetRole === user.role) return true;
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
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
                Reminder otomatis H-3, H-1, dan setelah deadline
              </p>
            </div>
          </div>

          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Kirim Deadline Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterScope('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            filterScope === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Semua ({deadlines.length})
        </button>
        <button
          onClick={() => setFilterScope('MINE')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
            filterScope === 'MINE' ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Untuk Saya
        </button>
      </div>

      {/* List */}
      {visibleDeadlines.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Timer className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Deadline</h3>
          <p className="text-xs text-slate-500 mt-1">
            {canCreate ? 'Klik "Kirim Deadline Baru".' : 'Tunggu instruksi.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleDeadlines.map(d => {
            const cd = getCountdown(d.dueDate);
            const mySub = mySubmissions[d.id];
            const priority = getPriorityConfig(d.priority);

            return (
              <div key={d.id} className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-rose-300 transition shadow-sm space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${priority.color}`}>
                    {priority.label}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Target: {d.targetScope === 'DIVISI' ? d.targetDivision : d.targetScope === 'PERAN' ? d.targetRole : 'Semua'}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">{d.title}</h3>
                <p className="text-xs text-slate-500">{d.description}</p>

                <div className={`p-3 rounded-xl border text-xs font-bold text-center ${cd.color}`}>
                  <Clock className="w-4 h-4 inline mr-1" /> {cd.text}
                </div>

                <p className="text-[11px] text-slate-400">
                  Dibuat oleh <strong>{d.creatorName || 'Tim'}</strong>
                  {d.dueDate ? ` • Deadline: ${new Date(d.dueDate).toLocaleString('id-ID')}` : ''}
                </p>

                {!canCreate && (
                  <div className="pt-2 border-t border-slate-100">
                    {mySub ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Status:</span>
                          <span className={`font-bold px-2 py-0.5 rounded-md ${
                            mySub.status === 'SELESAI' ? 'bg-emerald-100 text-emerald-800' :
                            mySub.status === 'TERLAMBAT' ? 'bg-rose-100 text-rose-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>{mySub.status}</span>
                        </div>
                        {mySub.feedback && (
                          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
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
                          className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                        >
                          <Upload className="w-3.5 h-3.5 inline mr-1" /> Submit Bukti
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
                        className="w-full py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs"
                      >
                        <Upload className="w-3.5 h-3.5 inline mr-1" /> Submit Bukti Sekarang
                      </button>
                    )}
                  </div>
                )}

                {canCreate && (
                  <button
                    onClick={() => handleOpenReview(d)}
                    className="w-full py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs flex items-center justify-center gap-1"
                  >
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
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-rose-500" /> Kirim Deadline Baru
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul *</label>
                <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Kumpulkan sketsa properti"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi</label>
                <textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deadline *</label>
                <input type="datetime-local" required value={newDue} onChange={(e) => setNewDue(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prioritas</label>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                  <option value="LOW">Rendah</option>
                  <option value="MEDIUM">Sedang</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="CRITICAL">Kritis</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target</label>
                <select value={newTarget} onChange={(e) => setNewTarget(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                  <option value="SEMUA">Semua Siswa</option>
                  <option value="DIVISI">Divisi Tertentu</option>
                  <option value="PERAN">Peran Tertentu</option>
                </select>
              </div>

              {newTarget === 'DIVISI' && (
                <select value={newDivision} onChange={(e) => setNewDivision(e.target.value as DivisionType)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                  {DIVISIONS.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
                </select>
              )}

              {newTarget === 'PERAN' && (
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-50">
                  {submitting ? 'Mengirim...' : 'Kirim Deadline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Submit */}
      {isSubmitOpen && selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" /> Submit Bukti
              </h3>
              <button onClick={() => setIsSubmitOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <p className="font-bold text-slate-900">{selectedDeadline.title}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Progress (%)</label>
                <input type="range" min="0" max="100" step="10" value={progress}
                  onChange={(e) => setProgress(parseInt(e.target.value))}
                  className="w-full accent-amber-500" />
                <p className="text-center text-xs font-bold text-slate-800 mt-1">{progress}%</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URL Bukti</label>
                <input type="url" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
                <textarea rows={3} value={proofNote} onChange={(e) => setProofNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800" />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                  <input type="checkbox" checked={askExtension} onChange={(e) => setAskExtension(e.target.checked)}
                    className="rounded border-amber-300 text-amber-500" />
                  Minta perpanjangan waktu
                </label>
                {askExtension && (
                  <textarea rows={2} value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)}
                    placeholder="Alasan..."
                    className="w-full mt-2 p-2 rounded-xl border border-amber-200 text-xs" />
                )}
              </div>

              <div className="flex justify-between gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={handleSaveProgress} disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">
                  Simpan Draft
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsSubmitOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                  <button type="button" onClick={handleSubmitProof} disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">
                    {submitting ? 'Mengirim...' : 'Submit Final'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Review */}
      {isReviewOpen && selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">
                Review: {selectedDeadline.title}
              </h3>
              <button onClick={() => setIsReviewOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submissions.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">Belum ada siswa yang submit.</p>
            ) : (
              <div className="space-y-3">
                {submissions.map(sub => (
                  <div key={sub.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">{sub.studentName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            sub.status === 'SELESAI' ? 'bg-emerald-100 text-emerald-800' :
                            sub.status === 'TERLAMBAT' ? 'bg-rose-100 text-rose-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>{sub.status}</span>
                          {sub.extensionRequested && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Minta Perpanjangan
                              {sub.extensionApproved && <Check className="w-3 h-3" />}
                            </span>
                          )}
                        </div>
                        {sub.proofNote && <p className="text-xs text-slate-600 mt-1 italic">"{sub.proofNote}"</p>}
                        {sub.proofUrl && (
                          <a href={sub.proofUrl} target="_blank" rel="noreferrer"
                            className="text-[11px] text-blue-600 hover:underline mt-1 inline-block">
                            🔗 Lihat Bukti
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      <textarea rows={2} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Beri feedback..."
                        className="w-full p-2 rounded-xl border border-slate-200 text-xs" />
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600">Rating:</span>
                          <select value={feedbackRating} onChange={(e) => setFeedbackRating(parseInt(e.target.value))}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs">
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} ⭐</option>)}
                          </select>
                        </div>
                        {sub.extensionRequested && !sub.extensionApproved && (
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 cursor-pointer">
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
