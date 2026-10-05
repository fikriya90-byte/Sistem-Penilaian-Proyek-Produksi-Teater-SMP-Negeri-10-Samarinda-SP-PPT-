import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, Lock, MessageCircle, MessageSquare,
  PlusCircle, Send, UserCheck, X, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { StudentComplaint } from '../../core/types';
import {
  recordAuditLog, replyComplaint, submitComplaint, subscribeComplaints,
  notifyTeachers,
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const ComplaintModule: React.FC = () => {
  const { user, activeClass, isTeacher, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<StudentComplaint | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<StudentComplaint['category']>('Teknis');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [teacherReply, setTeacherReply] = useState('');
  const [newStatus, setNewStatus] = useState<'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('RESOLVED');

  const canReply = isTeacher || isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeComplaints(activeClass.id, (cList) => {
      setComplaints(cList);
    });
    return () => unsub();
  }, [activeClass]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !description.trim()) {
      showToast('Harap lengkapi judul dan rincian aduan.', 'warning');
      return;
    }

    try {
      const complaintId = await submitComplaint({
        classId: activeClass.id,
        studentId: user.uid,
        studentName: isAnonymous ? 'Siswa (Anonim)' : user.displayName,
        isAnonymous,
        title: title.trim(),
        description: description.trim(),
        category,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Complaint',
        targetId: complaintId,
        details: `Mengirim aduan "${title}" (${category})`,
      });

      // === NOTIFIKASI KE GURU ===
      try {
        await notifyTeachers(activeClass.id, {
          title: category === 'Bullying' ? 'ADUAN URGENT: Bullying' : category === 'Keamanan' ? 'ADUAN URGENT: Keamanan' : 'Aduan Baru dari Siswa',
          message: `${isAnonymous ? 'Siswa (Anonim)' : user.displayName} - "${title.trim()}" (${category})`,
          category: category === 'Bullying' || category === 'Keamanan' ? 'Urgent' : 'Sistem',
          link: 'aduan',
          senderName: isAnonymous ? 'Anonim' : user.displayName,
        });
      } catch (err) {
        console.warn('Notif guru gagal:', err);
      }

      showToast('Aduan Anda berhasil disampaikan ke Guru Pengampu.', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setIsAnonymous(false);
    } catch (err: any) {
      showToast('Gagal mengirim aduan: ' + err.message, 'error');
    }
  };

  const handleTeacherReply = async () => {
    if (!selectedComplaint || !user || !activeClass) return;
    if (!teacherReply.trim()) {
      showToast('Isi tanggapan terlebih dahulu.', 'warning');
      return;
    }

    try {
      await replyComplaint(selectedComplaint.id, teacherReply.trim(), newStatus, user.displayName);

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Complaint',
        targetId: selectedComplaint.id,
        details: `Menanggapi aduan "${selectedComplaint.title}" dengan status: ${newStatus}`,
      });

      // === NOTIFIKASI KE SISWA YANG MENGIRIM ===
      try {
        const { writeBatch } = await import('firebase/firestore');
        const { doc, collection } = await import('firebase/firestore');
        const { db } = await import('../../core/firebase');
        const batch = writeBatch(db);
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: selectedComplaint.studentId,
          classId: activeClass.id,
          title: 'Tanggapan Aduan Anda',
          message: `${user.displayName} menanggapi aduan "${selectedComplaint.title}" - Status: ${newStatus}`,
          category: 'Feedback',
          read: false,
          link: 'aduan',
          createdAt: new Date().toISOString(),
        });
        await batch.commit();
      } catch (err) {
        console.warn('Notif siswa gagal:', err);
      }

      showToast('Tanggapan berhasil dikirim!', 'success');
      setSelectedComplaint(null);
      setTeacherReply('');
    } catch (err: any) {
      showToast('Gagal merespons aduan: ' + err.message, 'error');
    }
  };

  const getWhatsAppForwardLink = (c: StudentComplaint) => {
    const text = encodeURIComponent(
      `Halo Pak/Bu Guru Pengampu Seni Teater SMPN 10 Samarinda,\n\n` +
      `Saya ingin menyampaikan tindak lanjut terkait aduan di SP-PPT:\n` +
      `Pengirim: ${c.studentName}\n` +
      `Judul: ${c.title}\n` +
      `Kategori: ${c.category}\n` +
      `Uraian: ${c.description}\n\n` +
      `Mohon arahan dan bantuannya, terima kasih.`
    );
    return `https://wa.me/6281255551010?text=${text}`;
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <MessageSquare className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Pusat Aduan & Konseling Teater
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sampaikan hambatan teknis, konflik peran, maupun kendala pribadi secara aman
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Sampaikan Aduan Baru</span>
        </button>
      </div>

      <div className="space-y-4">
        {complaints.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs">
            Belum ada aduan atau kendala yang tercatat.
          </div>
        ) : (
          complaints.map(c => {
            const isMine = c.studentId === user?.uid;
            const isUrgent = c.category === 'Bullying' || c.category === 'Keamanan';

            let statusBadge = 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40';
            if (c.status === 'RESOLVED') statusBadge = 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40';
            if (c.status === 'CLOSED') statusBadge = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600';

            return (
              <div key={c.id} className={`p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-sm space-y-3 ${
                isUrgent ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200/80 dark:border-slate-700'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      {c.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                      {c.status}
                    </span>
                    {c.isAnonymous && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Anonim
                      </span>
                    )}
                    {isUrgent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="w-3 h-3" /> URGENT
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    {new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{c.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                  {c.description}
                </p>

                {c.teacherResponse && (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
                    <span className="font-extrabold flex items-center gap-1.5 text-emerald-900 dark:text-emerald-300">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Tanggapan Guru:
                    </span>
                    <p className="leading-relaxed">{c.teacherResponse}</p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                      Dijawab oleh: {c.respondedBy || 'Guru Pengampu'}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400 dark:text-slate-500">
                    Pengirim: <strong className="text-slate-700 dark:text-slate-300">{c.studentName}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <a href={getWhatsAppForwardLink(c)} target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Kirim ke WA Guru</span>
                    </a>

                    {canReply && (
                      <button
                        onClick={() => {
                          setSelectedComplaint(c);
                          setTeacherReply(c.teacherResponse || '');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs transition"
                      >
                        Beri Tanggapan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Submit Complaint */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-rose-500" /> Sampaikan Aduan / Kendala
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori Masalah</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  <option value="Teknis">Kendala Teknis (Alat/Properti/Jadwal)</option>
                  <option value="Akademik">Akademik / Penilaian</option>
                  <option value="Sosial">Komunikasi & Hubungan Tim</option>
                  <option value="Keamanan">Keamanan & Keselamatan Panggung</option>
                  <option value="Bullying">Perlakuan Kurang Menyenangkan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Kendala <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Kurangnya alat sound monitor di panggung"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Uraian Detail Masalah <span className="text-rose-500">*</span>
                </label>
                <textarea rows={4} required value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan kejadian atau kendala yang Anda alami secara obyektif..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500" />
                  <span>Sembunyikan nama saya dari rekan lain (Kirim sebagai Anonim)</span>
                </label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 pl-6">
                  Identitas Anda hanya akan diketahui oleh Guru Pengampu.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Kirim Aduan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Teacher Reply */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 my-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Tanggapan Guru</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {selectedComplaint.title}
                </h3>
              </div>
              <button onClick={() => setSelectedComplaint(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status Aduan</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  <option value="IN_PROGRESS">Sedang Ditindaklanjuti</option>
                  <option value="RESOLVED">Telah Diselesaikan</option>
                  <option value="CLOSED">Ditutup</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Uraian Solusi & Tanggapan</label>
                <textarea rows={4} value={teacherReply} onChange={(e) => setTeacherReply(e.target.value)}
                  placeholder="Tuliskan solusi atau arahan pembinaan kepada siswa..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setSelectedComplaint(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="button" onClick={handleTeacherReply}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-sm">
                  Kirim Tanggapan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
