import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, MessageCircle, MessageSquare,
  PlusCircle, Send, X, ShieldAlert, ExternalLink, Trash2,
  Lock, Clock, User, FileText,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { StudentComplaint, UserProfile } from '../../core/types';
import {
  recordAuditLog, submitComplaint, subscribeComplaints,
  notifyTeachers, fetchUsersByClass,
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';

// ============================================================
// KATEGORI SERIUS SAJA (tidak bisa diselesaikan mandiri)
// ============================================================
const SERIOUS_CATEGORIES = [
  {
    value: 'Bullying' as const,
    label: 'Bullying / Perundungan',
    desc: 'Perundungan fisik, verbal, sosial, atau cyberbullying',
    icon: ShieldAlert,
    color: 'text-rose-600',
  },
  {
    value: 'Pelecehan' as const,
    label: 'Pelecehan',
    desc: 'Pelecehan seksual, verbal, atau non-verbal',
    icon: ShieldAlert,
    color: 'text-rose-700',
  },
  {
    value: 'Kekerasan' as const,
    label: 'Kekerasan Fisik',
    desc: 'Pemukulan, penganiayaan, atau kekerasan fisik lainnya',
    icon: AlertTriangle,
    color: 'text-rose-600',
  },
  {
    value: 'Ancaman' as const,
    label: 'Ancaman / Intimidasi',
    desc: 'Ancaman kekerasan, tekanan, atau pemaksaan',
    icon: AlertTriangle,
    color: 'text-amber-600',
  },
  {
    value: 'Diskriminasi' as const,
    label: 'Diskriminasi',
    desc: 'Perlakuan tidak adil berdasarkan SARA, gender, dsb',
    icon: ShieldAlert,
    color: 'text-orange-600',
  },
  {
    value: 'Lainnya' as const,
    label: 'Lainnya (Serius)',
    desc: 'Kasus serius lain yang butuh penanganan guru',
    icon: FileText,
    color: 'text-slate-600',
  },
];

// Minimal karakter uraian
const MIN_CHARS = 20;
const MAX_CHARS = 1000;

// Nomor WhatsApp Guru default (fallback)
const DEFAULT_GURU_WA = '6281255551010';

export const ComplaintModule: React.FC = () => {
  const { user, activeClass, isTeacher, isGuruPengampu, isAdminRole, isPimprod } = useAuth();
  const { showToast } = useToast();

  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guruWA, setGuruWA] = useState<string>(DEFAULT_GURU_WA);
  const [guruName, setGuruName] = useState<string>('Guru Pengampu');

  const [category, setCategory] = useState<typeof SERIOUS_CATEGORIES[number]['value']>('Bullying');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Guru bisa hapus log
  const canDelete = isTeacher || isGuruPengampu || isAdminRole || isPimprod;

  // ============================================================
  // LOAD GURU WA NUMBER
  // ============================================================
  useEffect(() => {
    if (!activeClass) return;
    (async () => {
      try {
        const list = await fetchUsersByClass(activeClass.id);
        const guru = list.find(u =>
          u.role === 'Guru Pengampu' || u.role === 'Guru Pembina'
        ) as UserProfile | undefined;
        if (guru?.phone) {
          let clean = guru.phone.replace(/\D/g, '');
          if (clean.startsWith('0')) clean = '62' + clean.slice(1);
          setGuruWA(clean);
          setGuruName(guru.displayName || 'Guru Pengampu');
        }
      } catch (err) {
        console.warn('Gagal load guru WA:', err);
      }
    })();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeComplaints(activeClass.id, (cList) => {
      const sorted = [...cList].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setComplaints(sorted);
    });
    return () => unsub();
  }, [activeClass]);

  // ============================================================
  // BUILD WA LINK dengan TEMPLATE FORMAT LENGKAP
  // ============================================================
  const buildWALink = (opts: {
    studentName: string;
    className: string;
    categoryLabel: string;
    description: string;
    evidenceUrl?: string;
  }) => {
    const header = `Mohon maaf sebelumnya Pak/Bu ${guruName}, saya izin menyampaikan.`;
    const body = `Saya ${opts.studentName} dari kelas ${opts.className}, dengan keperluan terkait ${opts.categoryLabel}, ingin menyampaikan bahwa saya ingin mengadukan hal berikut:`;
    const evidenceText = opts.evidenceUrl
      ? `\n\nLink bukti: ${opts.evidenceUrl}`
      : '';

    const text =
      `${header}\n\n` +
      `${body}\n\n` +
      `"${opts.description}"` +
      `${evidenceText}\n\n` +
      `Mohon arahan dan bantuannya. Terima kasih 🙏`;

    return `https://wa.me/${guruWA}?text=${encodeURIComponent(text)}`;
  };

  // ============================================================
  // SUBMIT COMPLAINT + AUTO-OPEN WA
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;

    // Validasi
    if (!description.trim()) {
      showToast('Uraian masalah wajib diisi.', 'warning');
      return;
    }
    if (description.trim().length < MIN_CHARS) {
      showToast(`Uraian masalah minimal ${MIN_CHARS} karakter. Sekarang: ${description.trim().length} karakter.`, 'warning');
      return;
    }
    if (description.trim().length > MAX_CHARS) {
      showToast(`Uraian masalah maksimal ${MAX_CHARS} karakter.`, 'warning');
      return;
    }
    if (evidenceUrl.trim() && !evidenceUrl.startsWith('http')) {
      showToast('Link bukti harus dimulai dengan http:// atau https://', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const catConfig = SERIOUS_CATEGORIES.find(c => c.value === category)!;

      const complaintId = await submitComplaint({
        classId: activeClass.id,
        studentId: user.uid,
        studentName: user.displayName,
        isAnonymous: false,
        title: catConfig.label,
        description: description.trim(),
        category: category as any,
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
        details: `Aduan serius: "${catConfig.label}"`,
      });

      // Notifikasi ke Guru
      try {
        await notifyTeachers(activeClass.id, {
          title: `🚨 ADUAN SERIUS: ${catConfig.label}`,
          message: `${user.displayName} (${activeClass.name}) mengirim aduan serius. Cek WA untuk detail.`,
          category: 'Urgent',
          link: 'aduan',
          senderName: user.displayName,
        });
      } catch (err) {
        console.warn('Notif guru gagal:', err);
      }

      // Buka WhatsApp dengan template lengkap
      const waLink = buildWALink({
        studentName: user.displayName,
        className: activeClass.name,
        categoryLabel: catConfig.label,
        description: description.trim(),
        evidenceUrl: evidenceUrl.trim() || undefined,
      });

      // Buka di tab baru
      setTimeout(() => {
        window.open(waLink, '_blank', 'noopener,noreferrer');
      }, 300);

      showToast(
        'Aduan tersimpan! WhatsApp Guru akan terbuka otomatis. Tinggal tekan Send di WA.',
        'success'
      );

      // Reset
      setIsModalOpen(false);
      setCategory('Bullying');
      setDescription('');
      setEvidenceUrl('');
    } catch (err: any) {
      showToast('Gagal mengirim aduan: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // HAPUS LOG (Guru/Admin/Pimprod)
  // ============================================================
  const handleDeleteLog = async (c: StudentComplaint) => {
    if (!canDelete) {
      showToast('Hanya Guru/Admin/Pimprod yang bisa menghapus log.', 'warning');
      return;
    }
    if (!confirm(
      `Hapus log aduan ini?\n\n` +
      `Pengirim: ${c.studentName}\n` +
      `Kategori: ${c.category}\n\n` +
      `Tindakan ini tidak bisa dibatalkan.`
    )) return;

    try {
      await deleteDoc(doc(db, 'complaints', c.id));
      await recordAuditLog({
        userId: user!.uid,
        userName: user!.displayName,
        role: user!.role,
        action: 'DELETE',
        targetType: 'Complaint',
        targetId: c.id,
        details: `Hapus log aduan: "${c.title}" dari ${c.studentName}`,
      });
      showToast('Log aduan dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const charCount = description.trim().length;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-900 via-slate-900 to-rose-950 text-white shadow-xl border border-rose-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-3 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                Aduan Serius
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Laporan Kasus Penting
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Khusus untuk kasus <strong>bullying, pelecehan, kekerasan, ancaman, & diskriminasi</strong>
              </p>
            </div>
          </div>

          {!canDelete && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Laporkan Kasus Serius</span>
            </button>
          )}
        </div>

        {/* Info untuk siswa */}
        {!canDelete && (
          <div className="mt-3 p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-slate-200 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
            <span>
              <strong>Penting:</strong> Fitur ini hanya untuk kasus serius yang <strong>tidak bisa diselesaikan mandiri</strong>.
              Aduan akan <strong>otomatis terkirim ke WA {guruName}</strong>.
              Untuk kendala teknis biasa, silakan hubungi pengurus kelas langsung.
            </span>
          </div>
        )}

        {/* Info untuk guru */}
        {canDelete && (
          <div className="mt-3 p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-slate-200 flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-300" />
            <span>
              <strong>Log Aduan:</strong> Halaman ini menampilkan semua laporan yang masuk.
              Siswa otomatis diarahkan ke WA Anda saat submit, jadi Anda bisa langsung menindaklanjuti via WhatsApp.
            </span>
          </div>
        )}
      </div>

      {/* INFO GURU WA */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3">
        <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
          <p className="font-bold">📱 WA Guru Pengampu: {guruName}</p>
          <p className="text-[11px] mt-0.5">
            Laporan akan otomatis terkirim ke nomor WA ini dalam format pesan formal siap kirim.
          </p>
        </div>
      </div>

      {/* STATISTIK (untuk guru) */}
      {canDelete && complaints.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Total Aduan</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{complaints.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
            <p className="text-[10px] text-rose-700 dark:text-rose-300 font-bold uppercase">Bullying</p>
            <p className="text-2xl font-black text-rose-800 dark:text-rose-200 mt-1">
              {complaints.filter(c => c.category === 'Bullying').length}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase">Kekerasan/Ancaman</p>
            <p className="text-2xl font-black text-amber-800 dark:text-amber-200 mt-1">
              {complaints.filter(c => ['Kekerasan', 'Ancaman'].includes(c.category)).length}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
            <p className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase">Pelecehan</p>
            <p className="text-2xl font-black text-purple-800 dark:text-purple-200 mt-1">
              {complaints.filter(c => c.category === 'Pelecehan').length}
            </p>
          </div>
        </div>
      )}

      {/* LIST LOG */}
      {complaints.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <MessageSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
            {canDelete ? 'Belum Ada Log Aduan' : 'Belum Ada Laporan'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canDelete
              ? 'Semua aduan serius dari siswa akan muncul di sini.'
              : 'Semoga tidak ada kasus serius. Kalau ada, klik tombol di atas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map(c => {
            const catConfig = SERIOUS_CATEGORIES.find(x => x.value === c.category) || SERIOUS_CATEGORIES[0];
            const CatIcon = catConfig.icon;
            const isUrgent = ['Bullying', 'Pelecehan', 'Kekerasan'].includes(c.category);

            return (
              <div key={c.id} className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-sm space-y-3 ${
                isUrgent ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200 dark:border-slate-700'
              }`}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`p-1.5 rounded-lg ${isUrgent ? 'bg-rose-100 dark:bg-rose-500/20' : 'bg-amber-100 dark:bg-amber-500/20'}`}>
                      <CatIcon className={`w-4 h-4 ${catConfig.color}`} />
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                      isUrgent
                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                    }`}>
                      {catConfig.label}
                    </span>
                    {isUrgent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="w-3 h-3" /> URGENT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(c.createdAt).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Info Pengirim */}
                <div className="flex items-center gap-2 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">
                    Dilaporkan oleh: <strong className="text-slate-800 dark:text-slate-200">{c.studentName}</strong>
                  </span>
                </div>

                {/* Uraian */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Uraian Masalah
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {c.description}
                  </p>
                </div>

                {/* Action */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    Sudah dikirim ke WA {guruName}
                  </span>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteLog(c)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 font-bold text-[11px] flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Log
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL SUBMIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" /> Laporkan Kasus Serius
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info WA otomatis */}
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                <p className="font-bold">Auto-format ke WA {guruName}</p>
                <p className="mt-0.5">
                  Setelah klik "Kirim", WhatsApp <strong>{guruName}</strong> akan terbuka otomatis dengan pesan lengkap siap kirim.
                </p>
              </div>
            </div>

            {/* Peringatan serius */}
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
                <strong>Perhatian:</strong> Fitur ini <strong>hanya untuk kasus serius</strong>.
                Laporan palsu dapat dikenakan sanksi. Nama Anda akan terlihat oleh Guru.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Kategori */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Jenis Kasus <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SERIOUS_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const sel = category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`p-2.5 rounded-xl border-2 text-left transition flex items-start gap-2 ${
                          sel
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-rose-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${sel ? cat.color : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className={`text-[11px] font-bold leading-snug ${sel ? 'text-rose-800 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'}`}>
                            {cat.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* Deskripsi kategori terpilih */}
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 italic">
                  {SERIOUS_CATEGORIES.find(c => c.value === category)?.desc}
                </p>
              </div>

              {/* Uraian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Uraian Masalah <span className="text-rose-500">*</span>
                  <span className="font-normal text-[10px] text-slate-500 ml-1">
                    (min. {MIN_CHARS} karakter)
                  </span>
                </label>
                <textarea
                  rows={6}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan dengan jelas:&#10;- Apa yang terjadi?&#10;- Siapa yang terlibat?&#10;- Kapan & di mana kejadiannya?&#10;- Bagaimana dampaknya bagi Anda?"
                  maxLength={MAX_CHARS}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-[10px] font-bold ${
                    charCount === 0
                      ? 'text-slate-400'
                      : isValid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {charCount}/{MAX_CHARS} karakter
                    {charCount > 0 && charCount < MIN_CHARS && ` — kurang ${MIN_CHARS - charCount} lagi`}
                    {isValid && ' ✓'}
                  </p>
                </div>
              </div>

              {/* Link bukti */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Link Bukti (Opsional)
                </label>
                <div className="relative">
                  <ExternalLink className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="https://drive.google.com/... (foto/screenshot/video)"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Kalau tidak ada bukti, biarkan kosong.
                </p>
              </div>

              {/* Preview format WA */}
              {description.trim().length >= MIN_CHARS && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                    📱 Preview Pesan WA:
                  </p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-mono">
                    {`Mohon maaf sebelumnya Pak/Bu ${guruName}, saya izin menyampaikan.\n\nSaya ${user?.displayName} dari kelas ${activeClass?.name}, dengan keperluan terkait ${SERIOUS_CATEGORIES.find(c => c.value === category)?.label}, ingin menyampaikan bahwa saya ingin mengadukan hal berikut:\n\n"${description.trim()}"${evidenceUrl ? `\n\nLink bukti: ${evidenceUrl}` : ''}\n\nMohon arahan dan bantuannya. Terima kasih 🙏`}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isValid}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Mengirim...' : 'Kirim & Buka WA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};