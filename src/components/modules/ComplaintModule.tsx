import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Lock,
  MessageCircle,
  MessageSquare,
  PlusCircle,
  Send,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { StudentComplaint } from '../../core/types';
import {
  recordAuditLog,
  replyComplaint,
  submitComplaint,
  subscribeComplaints
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const ComplaintModule: React.FC = () => {
  const { user, activeClass, isTeacher } = useAuth();
  const { showToast } = useToast();

  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<StudentComplaint | null>(null);

  // New complaint form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<StudentComplaint['category']>('Teknis');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Teacher reply fields
  const [teacherReply, setTeacherReply] = useState('');
  const [newStatus, setNewStatus] = useState<'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('RESOLVED');

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

      showToast('Aduan Anda berhasil disampaikan kepada Guru Pembina.', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      showToast('Gagal mengirim aduan: ' + err.message, 'error');
    }
  };

  const handleTeacherReply = async () => {
    if (!selectedComplaint || !user) return;
    try {
      await replyComplaint(selectedComplaint.id, teacherReply.trim(), newStatus, user.displayName);
      showToast('Tanggapan berhasil dikirim kepada siswa!', 'success');
      setSelectedComplaint(null);
      setTeacherReply('');
    } catch (err: any) {
      showToast('Gagal merespons aduan: ' + err.message, 'error');
    }
  };

  const getWhatsAppForwardLink = (c: StudentComplaint) => {
    const text = encodeURIComponent(
      `Halo Pak Fikri (Guru Pembina Seni Teater SMPN 10 Samarinda),\n\n` +
      `Saya ingin menyampaikan tindak lanjut terkait aduan di SP-PPT:\n` +
      `• Pengirim: ${c.studentName}\n` +
      `• Judul: ${c.title}\n` +
      `• Kategori: ${c.category}\n` +
      `• Uraian: ${c.description}\n\n` +
      `Mohon arahan dan bantuannya, terima kasih.`
    );
    return `https://wa.me/6281255551010?text=${text}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
              <MessageSquare className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Pusat Aduan, Kendala, & Konseling Teater
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Sampaikan hambatan teknis, konflik peran, maupun kendala pribadi secara aman dan transparan
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Sampaikan Aduan Baru</span>
        </button>
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {complaints.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            Belum ada aduan atau kendala yang tercatat. Seluruh produksi teater berjalan kondusif!
          </div>
        ) : (
          complaints.map(c => {
            const isMine = c.studentId === user?.uid;

            let statusBadge = 'bg-amber-100 text-amber-800 border-amber-300';
            if (c.status === 'RESOLVED') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
            if (c.status === 'CLOSED') statusBadge = 'bg-slate-100 text-slate-600 border-slate-300';

            return (
              <div
                key={c.id}
                className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 hover:border-slate-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                      {c.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                      {c.status}
                    </span>
                    {c.isAnonymous && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Anonim
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900">{c.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                  {c.description}
                </p>

                {/* Teacher Response */}
                {c.teacherResponse && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                    <span className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                      <CheckCircle className="w-4 h-4 text-emerald-600" /> Tanggapan Guru Pembina:
                    </span>
                    <p className="leading-relaxed">{c.teacherResponse}</p>
                    <p className="text-[10px] text-emerald-700 font-medium mt-1">
                      Dijawab oleh: {c.respondedBy || 'Guru Pembina'}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">
                    Pengirim: <strong className="text-slate-700">{c.studentName}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <a
                      href={getWhatsAppForwardLink(c)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kirim ke WA Guru</span>
                    </a>

                    {isTeacher && (
                      <button
                        onClick={() => {
                          setSelectedComplaint(c);
                          setTeacherReply(c.teacherResponse || '');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-rose-500" /> Sampaikan Aduan / Kendala
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Masalah</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="Teknis">Kendala Teknis (Alat/Properti/Jadwal)</option>
                  <option value="Akademik">Akademik / Penilaian</option>
                  <option value="Sosial">Komunikasi & Hubungan Tim</option>
                  <option value="Keamanan">Keamanan & Keselamatan Panggung</option>
                  <option value="Bullying">Perlakuan Kurang Menyenangkan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Kendala <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Kurangnya alat sound monitor di panggung"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Uraian Detail Masalah <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan kejadian atau kendala yang Anda alami secara obyektif..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500"
                  />
                  <span>Sembunyikan nama saya dari rekan lain (Kirim sebagai Anonim)</span>
                </label>
                <p className="text-[10px] text-slate-400 mt-1 pl-6">
                  Identitas Anda hanya akan diketahui oleh Guru Pembina untuk verifikasi pembinaan.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                >
                  Kirim Aduan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Teacher Reply */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase">Tanggapan Guru Pembina</span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {selectedComplaint.title}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Aduan</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="IN_PROGRESS">Sedang Ditindaklanjuti (In Progress)</option>
                  <option value="RESOLVED">Telah Diselesaikan (Resolved)</option>
                  <option value="CLOSED">Ditutup (Closed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Uraian Solusi & Tanggapan</label>
                <textarea
                  rows={4}
                  value={teacherReply}
                  onChange={(e) => setTeacherReply(e.target.value)}
                  placeholder="Tuliskan solusi atau arahan pembinaan kepada siswa..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleTeacherReply}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
                >
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
