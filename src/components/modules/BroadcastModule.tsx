import React, { useState, useEffect } from 'react';
import {
  Bell, Search, CheckCheck, Trash2, Clock, Filter, CheckSquare,
  MessageSquare, Award, AlertTriangle, Wallet, Megaphone, RefreshCw,
  Building2, X, Send, Shield, Reply,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  subscribeNotifications, markNotificationAsRead, markAllNotificationsAsRead,
} from '../../services/firestoreService';
import { SystemNotification } from '../../core/types';
import {
  collection, query, where, doc, deleteDoc, writeBatch, getDocs, setDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

type FilterType = 'ALL' | 'UNREAD' | 'Tugas' | 'Reminder' | 'Pengumuman' | 'Nilai' | 'Urgent' | 'Sistem' | 'Keuangan';

// ============================================================
// FILTER KATA KASAR / MAKIAN
// ============================================================
const BAD_WORDS = [
  // Indonesia umum
  'anjing', 'anjg', 'anjir', 'bangsat', 'bajingan', 'kontol', 'kntl', 'memek', 'mmk',
  'ngentot', 'ngentd', 'pepek', 'peler', 'pler', 'tai', 'taik', 'titit', 'kampang',
  'asu', 'asw', 'babi', 'brengsek', 'sialan', 'setan', 'goblok', 'gblk', 'tolol',
  'tlol', 'idiot', 'dungu', 'bodoh', 'bdh', 'sinting', 'edan', 'gila', 'bgst',
  'pukimak', 'pkmk', 'kimak', 'jancuk', 'jancok', 'cok', 'coeg', 'cuk', 'tolo',
  'goblog', 'lonte', 'pelacur', 'sundal', 'jablay', 'bispak', 'perek',
  // Inggris
  'fuck', 'fck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'pussy', 'cunt',
  'whore', 'slut', 'damn', 'crap', 'wtf', 'stfu',
];

const containsBadWord = (text: string): { has: boolean; found: string[] } => {
  if (!text) return { has: false, found: [] };
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const found: string[] = [];
  BAD_WORDS.forEach(word => {
    // Cek sebagai kata utuh atau bagian dari kata
    const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
    if (regex.test(lower)) {
      if (!found.includes(word)) found.push(word);
    }
  });
  return { has: found.length > 0, found };
};

const sanitizeText = (text: string): string => {
  let result = text;
  BAD_WORDS.forEach(word => {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  });
  return result;
};

export const NotificationPage: React.FC = () => {
  const { user, classes } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reply state
  const [replyTo, setReplyTo] = useState<SystemNotification | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const getClassName = (classId?: string) => {
    if (!classId) return null;
    return classes.find(x => x.id === classId)?.name || null;
  };

  const availableClasses = (() => {
    const map: Record<string, string> = {};
    notifications.forEach(n => {
      if (n.classId) {
        const name = getClassName(n.classId);
        if (name) map[n.classId] = name;
      }
    });
    return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const filtered = notifications.filter(n => {
    if (filter === 'UNREAD' && n.read) return false;
    if (filter !== 'ALL' && filter !== 'UNREAD' && n.category !== filter) return false;
    if (classFilter !== 'ALL' && n.classId !== classFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const classUnreadCount = (cid: string) => notifications.filter(n => !n.read && n.classId === cid).length;

  const handleMarkRead = async (n: SystemNotification) => {
    if (n.read) return;
    try { await markNotificationAsRead(n.id); } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    try {
      const count = await markAllNotificationsAsRead(user.uid);
      showToast(count > 0 ? `${count} notifikasi ditandai.` : 'Tidak ada yang baru.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setMarkingAll(false); }
  };

  const handleDeleteOne = async (n: SystemNotification) => {
    if (!confirm(`Hapus notifikasi "${n.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'notifications', n.id));
      showToast('Notifikasi dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleClearRead = async () => {
    if (!user) return;
    if (!confirm('Hapus semua notifikasi yang sudah dibaca?')) return;
    setClearing(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', true)
      );
      const snap = await getDocs(q);
      if (snap.empty) { showToast('Tidak ada yang bisa dihapus.', 'info'); return; }
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast(`${snap.size} notifikasi dibersihkan.`, 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setClearing(false); }
  };

  // ============================================================
  // KIRIM BALASAN
  // ============================================================
  const handleSendReply = async () => {
    if (!user || !replyTo) return;
    const text = replyText.trim();
    if (!text) { showToast('Tulis balasan dulu.', 'warning'); return; }

    // Cek kata kasar
    const check = containsBadWord(text);
    if (check.has) {
      showToast(`❌ Balasan mengandung kata tidak pantas: ${check.found.join(', ')}. Mohon perbaiki.`, 'error');
      return;
    }

    if (text.length > 300) { showToast('Balasan maksimal 300 karakter.', 'warning'); return; }

    setReplySending(true);
    try {
      const replyRef = doc(collection(db, 'notifications', replyTo.id, 'replies'));
      await setDoc(replyRef, {
        id: replyRef.id,
        notificationId: replyTo.id,
        userId: user.uid,
        userName: user.displayName,
        userRole: user.role,
        text: sanitizeText(text),
        createdAt: new Date().toISOString(),
      });

      // Notifikasi balik ke Guru (kalau yang bales siswa)
      if (user.role !== 'Guru Pengampu' && user.role !== 'Admin' && user.role !== 'Super Admin') {
        try {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: (replyTo as any).senderId || 'teacher-fikri',
            classId: replyTo.classId || '',
            title: `💬 Balasan dari ${user.displayName}`,
            message: text.slice(0, 200),
            category: 'Feedback',
            read: false,
            link: 'notifikasi',
            createdAt: new Date().toISOString(),
          });
        } catch { /* non-fatal */ }
      }

      showToast('✅ Balasan terkirim!', 'success');
      setReplyTo(null);
      setReplyText('');
    } catch (err: any) {
      showToast('Gagal kirim balasan: ' + err.message, 'error');
    } finally { setReplySending(false); }
  };

  const getCategoryStyle = (cat: string) => {
    switch (cat) {
      case 'Tugas': return { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-500/40', Icon: CheckSquare };
      case 'Feedback': return { bg: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-500/40', Icon: MessageSquare };
      case 'Reminder': return { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-500/40', Icon: Clock };
      case 'Urgent': return { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-500/40', Icon: AlertTriangle };
      case 'Pengumuman': return { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-500/40', Icon: Megaphone };
      case 'Nilai': return { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-500/40', Icon: Award };
      case 'Keuangan': return { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-500/40', Icon: Wallet };
      default: return { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600', Icon: Bell };
    }
  };

  const filterOptions: { val: FilterType; label: string }[] = [
    { val: 'ALL', label: `Semua (${notifications.length})` },
    { val: 'UNREAD', label: `Belum (${unreadCount})` },
    { val: 'Pengumuman', label: 'Pengumuman' },
    { val: 'Tugas', label: 'Tugas' },
    { val: 'Reminder', label: 'Reminder' },
    { val: 'Feedback', label: 'Feedback' },
    { val: 'Nilai', label: 'Nilai' },
    { val: 'Urgent', label: 'Urgent' },
    { val: 'Keuangan', label: 'Keuangan' },
    { val: 'Sistem', label: 'Sistem' },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white shadow-xl border border-blue-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30 relative">
              <Bell className="w-7 h-7" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Pusat Notifikasi
              </span>
              <h2 className="text-xl font-black text-white mt-1">Notifikasi Saya</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {notifications.length} total — {unreadCount} belum dibaca
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleMarkAllRead} disabled={markingAll || unreadCount === 0}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
              <CheckCheck className="w-4 h-4" /> Tandai Semua
            </button>
            <button onClick={handleClearRead} disabled={clearing}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Bersihkan
            </button>
          </div>
        </div>
      </div>

      {/* FILTER KELAS */}
      {availableClasses.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filter Kelas:</span>
            {classFilter !== 'ALL' && (
              <button onClick={() => setClassFilter('ALL')} className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setClassFilter('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                classFilter === 'ALL' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              Semua Kelas ({notifications.length})
            </button>
            {availableClasses.map(c => {
              const count = notifications.filter(n => n.classId === c.id).length;
              const unread = classUnreadCount(c.id);
              return (
                <button key={c.id} onClick={() => setClassFilter(c.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                    classFilter === c.id ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}>
                  <span>{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${classFilter === c.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>{count}</span>
                  {unread > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">{unread}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SEARCH + FILTER KATEGORI */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari notifikasi..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map(opt => (
            <button key={opt.val} onClick={() => setFilter(opt.val)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === opt.val ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          <p className="text-xs text-slate-400">Memuat...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Bell className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Tidak Ada Notifikasi</h3>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const style = getCategoryStyle(n.category);
            const Icon = style.Icon;
            const cName = getClassName(n.classId);
            const canReply = ['Pengumuman', 'Feedback', 'Sistem'].includes(n.category);
            return (
              <div key={n.id}
                className={`p-4 rounded-2xl border-2 transition ${
                  n.read ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    : 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40 shadow-sm'
                }`}>
                <div className="flex items-start gap-3">
                  <span className={`p-2 rounded-xl border ${style.bg} ${style.text} ${style.border} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${style.bg} ${style.text} ${style.border}`}>
                        {n.category}
                      </span>
                      {cName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5" /> {cName}
                        </span>
                      )}
                      {!n.read && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">BARU</span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(n.createdAt).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <h4 className={`text-sm leading-snug ${n.read ? 'font-semibold text-slate-700 dark:text-slate-300' : 'font-extrabold text-slate-900 dark:text-white'}`}>
                      {n.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {!n.read && (
                        <button onClick={() => handleMarkRead(n)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" /> Dibaca
                        </button>
                      )}
                      {canReply && (
                        <button onClick={() => { setReplyTo(n); setReplyText(''); }}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 border border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center gap-1">
                          <Reply className="w-3 h-3" /> Balas
                        </button>
                      )}
                      <button onClick={() => handleDeleteOne(n)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-[10px] flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL BALAS */}
      {replyTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Reply className="w-5 h-5 text-blue-500" /> Balas Notifikasi
              </h3>
              <button onClick={() => setReplyTo(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Notifikasi:</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{replyTo.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{replyTo.message}</p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>Penting:</strong> Balasan akan dibaca Guru/Pengurus. Gunakan bahasa sopan.
                Kata kasar/makian otomatis <strong>ditolak sistem</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Balasan Anda <span className="text-rose-500">*</span>
              </label>
              <textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)}
                placeholder="Tulis balasan sopan (maks 300 karakter)..."
                maxLength={300}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-slate-400">
                  {replyText.length}/300 karakter
                </p>
                {replyText && containsBadWord(replyText).has && (
                  <p className="text-[10px] font-bold text-rose-600">
                    ⚠️ Mengandung kata tidak pantas
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setReplyTo(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="button" onClick={handleSendReply}
                disabled={replySending || !replyText.trim() || containsBadWord(replyText).has}
                className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {replySending ? 'Mengirim...' : 'Kirim Balasan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
