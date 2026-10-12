import React, { useState, useEffect } from 'react';
import {
  Globe, Send, Search, MessageSquare, Users, Sparkles,
  RefreshCw, AlertTriangle, CheckCircle, X, Building2,
  Share2, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  collection, query, where, onSnapshot, doc, setDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchAllUsers } from '../../services/firestoreService';

interface CrossMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderClassId: string;
  senderClassName: string;
  title: string;
  content: string;
  priority: 'NORMAL' | 'PENTING' | 'URGENT';
  targetClassIds: string[];
  createdAt: string;
}

const CAN_SEND_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
  'Pimpinan Produksi', 'Sutradara', 'Asisten Sutradara',
];

const PRIORITY_CONFIG = {
  NORMAL: { label: 'Normal', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  PENTING: { label: 'Penting', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  URGENT: { label: 'URGENT', color: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' },
};

export const InterClassCoordModule: React.FC = () => {
  const { user, activeClass, classes } = useAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<CrossMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'PENTING' | 'URGENT'>('NORMAL');
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSend = !!user && CAN_SEND_ROLES.includes(user.role);
  const otherClasses = classes.filter(c => c.id !== activeClass?.id);

  useEffect(() => {
    if (!activeClass) return;
    setLoading(true);
    const q = query(
      collection(db, 'crossClassMessages'),
      where('targetClassIds', 'array-contains', activeClass.id)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as CrossMessage));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(list);
      setLoading(false);
    }, err => {
      console.warn('Cross class error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [activeClass]);

  const openCompose = () => {
    setTitle('');
    setContent('');
    setPriority('NORMAL');
    setTargetClassIds([]);
    setIsComposeOpen(true);
  };

  const toggleClass = (id: string) => {
    setTargetClassIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !content.trim()) {
      showToast('Isi judul & isi pesan.', 'warning');
      return;
    }
    if (targetClassIds.length === 0) {
      showToast('Pilih minimal 1 kelas tujuan.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'crossClassMessages'));
      const newMsg: CrossMessage = {
        id: newRef.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderRole: user.role,
        senderClassId: activeClass.id,
        senderClassName: activeClass.name,
        title: title.trim(),
        content: content.trim(),
        priority,
        targetClassIds,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, newMsg);

      try {
        const allUsers = await fetchAllUsers();
        const recipients = allUsers.filter(u =>
          targetClassIds.includes(u.classId) &&
          ['Pimpinan Produksi', 'Guru Pengampu', 'Guru Pembina', 'Sutradara', 'Asisten Sutradara'].includes(u.role)
        );

        if (recipients.length > 0) {
          const batch = writeBatch(db);
          const nowStr = new Date().toISOString();
          recipients.forEach(r => {
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
              id: notifRef.id,
              userId: r.uid,
              classId: r.classId,
              title: priority === 'URGENT'
                ? `🚨 URGENT — ${title.trim()}`
                : `🌐 ${title.trim()}`,
              message: `Dari ${user.displayName} (${activeClass.name}): ${content.trim().slice(0, 150)}`,
              category: priority === 'URGENT' ? 'Urgent' : 'Pengumuman',
              read: false,
              link: 'inter-class',
              createdAt: nowStr,
            });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Notif gagal:', err);
      }

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'CrossClassMessage',
        targetId: newRef.id,
        details: `Koordinasi lintas kelas: "${title}" ke ${targetClassIds.length} kelas`,
      });

      showToast(`Pesan terkirim ke ${targetClassIds.length} kelas!`, 'success');
      setIsComposeOpen(false);
    } catch (err: any) {
      showToast('Gagal kirim: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Share pesan koordinasi ke WhatsApp
  const handleShareToWA = (msg: CrossMessage) => {
    const targetClassNames = msg.targetClassIds
      .map(id => classes.find(c => c.id === id)?.name || '-')
      .join(', ');

    const text =
      `*${msg.title}*\n\n` +
      `${msg.content}\n\n` +
      `— Dari: ${msg.senderName} (${msg.senderClassName})\n` +
      `— Untuk: ${targetClassNames}\n\n` +
      `_Dikirim via SP-PPT — Sistem Penilaian & Manajemen Proyek Produksi Teater SMPN 10 Samarinda_`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast('WhatsApp terbuka. Pilih kontak tujuan.', 'info');
  };

  const filtered = messages.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.senderName.toLowerCase().includes(q) ||
      m.senderClassName.toLowerCase().includes(q)
    );
  });

  const getPriorityCfg = (p: string) => PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.NORMAL;

  if (!canSend) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Hanya <strong>Pimpinan Produksi</strong>, <strong>Sutradara</strong>,
          <strong> Asisten Sutradara</strong>, dan <strong>Guru Pengampu</strong> yang dapat
          mengirim koordinasi lintas kelas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-900 via-slate-900 to-indigo-900 text-white shadow-xl border border-cyan-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <Globe className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-500/20 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                Koordinasi Lintas Kelas
              </span>
              <h2 className="text-xl font-black text-white mt-1">Kerabat Kerja Antar Kelas</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Kirim pesan koordinasi ke Pimprod, Sutradara, Astrada & Guru di kelas lain
              </p>
            </div>
          </div>
          <button
            onClick={openCompose}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg"
          >
            <Send className="w-4 h-4" /> Kirim Pesan
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Kegunaan:</strong> Kirim pesan koordinasi ke kelas lain (misal: pinjam properti antar kelas,
          jadwal latihan gabungan, kolaborasi pentas). Pesan muncul di menu <strong>Koordinasi Lintas Kelas</strong> kelas tujuan,
          dan Pimprod / Sutradara / Astrada / Guru kelas tujuan menerima notifikasi.
          Ada juga tombol <strong>Bagikan ke WhatsApp</strong> untuk meneruskan pesan via chat pribadi.
        </p>
      </div>

      {/* SEARCH */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Cari pesan koordinasi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white"
        />
      </div>

      {/* LIST */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          <p className="text-xs text-slate-400">Memuat pesan...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Globe className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Pesan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Klik "Kirim Pesan" untuk mulai koordinasi dengan kelas lain.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(msg => {
            const prio = getPriorityCfg(msg.priority);
            const isMine = msg.senderClassId === activeClass?.id;
            return (
              <div
                key={msg.id}
                className={`p-5 rounded-3xl border-2 shadow-sm ${
                  msg.priority === 'URGENT'
                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`p-2.5 rounded-xl border shrink-0 ${
                    isMine
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30'
                  }`}>
                    <Building2 className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${prio.color}`}>
                        {prio.label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                        {msg.senderClassName}
                      </span>
                      {isMine && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                          Dari Kelas Anda
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(msg.createdAt).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{msg.title}</h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5 flex-wrap">
                      <Users className="w-3 h-3" />
                      <strong className="text-slate-700 dark:text-slate-300">{msg.senderName}</strong>
                      <span>({msg.senderRole})</span>
                      <span className="text-slate-400">•</span>
                      <span>dikirim ke {msg.targetClassIds.length} kelas</span>
                    </p>

                    {/* ✅ Tombol Share ke WhatsApp */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => handleShareToWA(msg)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 transition"
                        title="Bagikan ke WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Bagikan ke WhatsApp
                        <Share2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL COMPOSE */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSend}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 bg-gradient-to-r from-cyan-700 to-indigo-800 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
                    <Globe className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                      Kirim dari: {activeClass?.name}
                    </span>
                    <h3 className="text-lg font-black mt-0.5">Koordinasi Lintas Kelas</h3>
                  </div>
                </div>
                <button type="button" onClick={() => setIsComposeOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Pesan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text" required value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Pinjam properti Singgasana untuk gladi resik"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Prioritas
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NORMAL', 'PENTING', 'URGENT'] as const).map(p => {
                    const cfg = PRIORITY_CONFIG[p];
                    const isSel = priority === p;
                    return (
                      <button
                        key={p} type="button" onClick={() => setPriority(p)}
                        className={`p-2.5 rounded-xl border-2 text-xs font-bold transition ${
                          isSel ? cfg.color : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas Tujuan <span className="text-rose-500">*</span>
                </label>
                {otherClasses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">
                    Tidak ada kelas lain di sistem.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {otherClasses.map(c => {
                      const sel = targetClassIds.includes(c.id);
                      return (
                        <button
                          key={c.id} type="button" onClick={() => toggleClass(c.id)}
                          className={`p-3 rounded-xl border-2 text-left transition ${
                            sel
                              ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-200'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <p className="text-xs font-black">{c.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{c.code}</p>
                          {sel && (
                            <p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 mt-1 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Dipilih
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {targetClassIds.length > 0 && (
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                    ✓ {targetClassIds.length} kelas dipilih
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Isi Pesan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5} required value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan detail koordinasi: waktu, tempat, keperluan, kontak PIC..."
                  maxLength={800}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 mt-1">{content.length}/800 karakter</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  Pesan akan masuk ke menu <strong>Koordinasi Lintas Kelas</strong> kelas tujuan.
                  <strong> Pimpinan Produksi, Sutradara, Asisten Sutradara & Guru</strong> di kelas tujuan akan menerima notifikasi.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsComposeOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Batal
              </button>
              <button type="submit" disabled={submitting || targetClassIds.length === 0}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Mengirim...' : `Kirim ke ${targetClassIds.length} Kelas`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};