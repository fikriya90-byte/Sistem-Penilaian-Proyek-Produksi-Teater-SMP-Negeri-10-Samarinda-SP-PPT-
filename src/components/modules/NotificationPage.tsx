import React, { useState, useEffect } from 'react';
import {
  Bell, Search, CheckCheck, Trash2, Clock, Filter, CheckSquare,
  MessageSquare, Award, AlertTriangle, Wallet, Megaphone, RefreshCw,
  Building2, X,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  subscribeNotifications, markNotificationAsRead, markAllNotificationsAsRead,
} from '../../services/firestoreService';
import { SystemNotification } from '../../core/types';
import {
  collection, query, where, doc, deleteDoc, writeBatch, getDocs,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

type FilterType = 'ALL' | 'UNREAD' | 'Tugas' | 'Reminder' | 'Pengumuman' | 'Nilai' | 'Urgent' | 'Sistem' | 'Keuangan';

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
    const c = classes.find(x => x.id === classId);
    return c?.name || null;
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
    if (classFilter !== 'ALL') {
      if (n.classId !== classFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const classUnreadCount = (cid: string) =>
    notifications.filter(n => !n.read && n.classId === cid).length;

  const handleMarkRead = async (n: SystemNotification) => {
    if (n.read) return;
    try { await markNotificationAsRead(n.id); } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    try {
      const count = await markAllNotificationsAsRead(user.uid);
      showToast(count > 0 ? `${count} notifikasi ditandai dibaca.` : 'Tidak ada notifikasi baru.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setMarkingAll(false); }
  };

  const handleDeleteOne = async (n: SystemNotification) => {
    if (!confirm(`Hapus notifikasi "${n.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'notifications', n.id));
      showToast('Notifikasi dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
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
      if (snap.empty) {
        showToast('Tidak ada notifikasi dibaca untuk dihapus.', 'info');
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast(`${snap.size} notifikasi dibersihkan.`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setClearing(false); }
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
    { val: 'UNREAD', label: `Belum Dibaca (${unreadCount})` },
    { val: 'Tugas', label: 'Tugas' },
    { val: 'Reminder', label: 'Reminder' },
    { val: 'Pengumuman', label: 'Pengumuman' },
    { val: 'Nilai', label: 'Nilai' },
    { val: 'Urgent', label: 'Urgent' },
    { val: 'Keuangan', label: 'Keuangan' },
    { val: 'Sistem', label: 'Sistem' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
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
              <h2 className="text-xl font-black text-white mt-1">Semua Notifikasi Saya</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {notifications.length} total - {unreadCount} belum dibaca
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCheck className="w-4 h-4" />
              {markingAll ? 'Memproses...' : 'Tandai Semua Dibaca'}
            </button>
            <button onClick={handleClearRead} disabled={clearing}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50">
              <Trash2 className="w-4 h-4" />
              {clearing ? 'Membersihkan...' : 'Hapus Yang Dibaca'}
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
              <button onClick={() => setClassFilter('ALL')}
                className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setClassFilter('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                classFilter === 'ALL'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              Semua Kelas ({notifications.length})
            </button>
            {availableClasses.map(c => {
              const count = notifications.filter(n => n.classId === c.id).length;
              const unread = classUnreadCount(c.id);
              return (
                <button key={c.id} onClick={() => setClassFilter(c.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                    classFilter === c.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}>
                  <span>{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    classFilter === c.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {count}
                  </span>
                  {unread > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search + Filter Kategori */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari notifikasi..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map(opt => (
            <button key={opt.val} onClick={() => setFilter(opt.val)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === opt.val
                  ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Counter */}
      {(classFilter !== 'ALL' || filter !== 'ALL' || searchQuery) && (
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 flex items-center justify-between text-xs">
          <span className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" />
            Menampilkan {filtered.length} dari {notifications.length} notifikasi
            {classFilter !== 'ALL' && (
              <span className="bg-purple-200 dark:bg-purple-500/30 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-md">
                Kelas: {availableClasses.find(c => c.id === classFilter)?.name}
              </span>
            )}
          </span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          <p className="text-xs text-slate-400">Memuat notifikasi...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Bell className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
            {filter === 'UNREAD' ? 'Tidak Ada Notifikasi Belum Dibaca' :
             searchQuery ? 'Tidak Ada Hasil Pencarian' :
             'Belum Ada Notifikasi'}
          </h3>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const style = getCategoryStyle(n.category);
            const Icon = style.Icon;
            const cName = getClassName(n.classId);
            return (
              <div key={n.id}
                className={`p-4 rounded-2xl border-2 transition ${
                  n.read
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
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
                          <Building2 className="w-2.5 h-2.5" />
                          {cName}
                        </span>
                      )}
                      {!n.read && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">
                          BARU
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(n.createdAt).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h4 className={`text-sm leading-snug ${
                      n.read ? 'font-semibold text-slate-700 dark:text-slate-300' : 'font-extrabold text-slate-900 dark:text-white'
                    }`}>
                      {n.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {!n.read && (
                        <button onClick={() => handleMarkRead(n)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" /> Tandai Dibaca
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
    </div>
  );
};
