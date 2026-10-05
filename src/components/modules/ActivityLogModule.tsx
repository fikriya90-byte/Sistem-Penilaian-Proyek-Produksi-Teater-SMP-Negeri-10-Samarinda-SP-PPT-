import React, { useState, useEffect } from 'react';
import {
  Activity, Search, RefreshCw, User, Clock, Tag, FileText,
  LogIn, LogOut, PlusCircle, Edit3, Trash2, Award, Send,
  CheckCircle, Filter, Users,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../core/firebase';

interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}

type ActionFilter = 'ALL' | 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSESS' | 'SUBMIT';

export const ActivityLogModule: React.FC = () => {
  const { user, isGuruPengampu, isAdminRole, isPimprod, isSutradara, isSekretaris } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [loading, setLoading] = useState(true);

  const canSeeAll = isGuruPengampu || isAdminRole || isPimprod || isSutradara || isSekretaris;

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const logsRef = collection(db, 'auditLogs');
    // Guru/admin/pimprod lihat semua, siswa hanya lihat aktivitasnya sendiri
    const q = canSeeAll
      ? query(logsRef, orderBy('timestamp', 'desc'), limit(500))
      : query(logsRef, where('userId', '==', user.uid), limit(200));

    const unsub = onSnapshot(
      q,
      snap => {
        const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as LogEntry));
        items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setLogs(items);
        setLoading(false);
      },
      error => {
        console.warn('Activity log error:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, canSeeAll]);

  const filtered = logs.filter(log => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (log.userName || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q) ||
        (log.role || '').toLowerCase().includes(q) ||
        (log.targetType || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'LOGIN': return { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-500/40', Icon: LogIn };
      case 'LOGOUT': return { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600', Icon: LogOut };
      case 'CREATE': return { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-500/40', Icon: PlusCircle };
      case 'UPDATE': return { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-500/40', Icon: Edit3 };
      case 'DELETE': return { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-500/40', Icon: Trash2 };
      case 'ASSESS': return { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-500/40', Icon: Award };
      case 'SUBMIT': return { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-300 dark:border-cyan-500/40', Icon: Send };
      default: return { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600', Icon: Activity };
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-950 text-white shadow-xl border border-purple-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Activity className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
              Log Aktivitas
            </span>
            <h2 className="text-xl font-black text-white mt-1">Riwayat Aktivitas Sistem</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {canSeeAll ? 'Semua aktivitas pengguna tercatat di sini' : 'Riwayat aktivitas Anda'}
            </p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama pengguna, aksi, atau detail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { val: 'ALL', label: 'Semua' },
            { val: 'LOGIN', label: 'Login' },
            { val: 'LOGOUT', label: 'Logout' },
            { val: 'CREATE', label: 'Buat' },
            { val: 'UPDATE', label: 'Edit' },
            { val: 'DELETE', label: 'Hapus' },
            { val: 'ASSESS', label: 'Nilai' },
            { val: 'SUBMIT', label: 'Submit' },
          ] as { val: ActionFilter; label: string }[]).map(f => (
            <button
              key={f.val}
              onClick={() => setActionFilter(f.val)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                actionFilter === f.val
                  ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Counter */}
      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" />
          Menampilkan {filtered.length} dari {logs.length} log
        </span>
        {loading && (
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-3 h-3 animate-spin" /> Memuat...
          </span>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-400 dark:text-slate-500">Memuat log...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Activity className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Aktivitas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Log aktivitas akan muncul setelah ada kegiatan di sistem.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map(log => {
              const style = getActionStyle(log.action);
              const Icon = style.Icon;
              return (
                <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <div className="flex items-start gap-3">
                    <span className={`p-2 rounded-xl border ${style.bg} ${style.text} ${style.border} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${style.bg} ${style.text} ${style.border}`}>
                          {log.action}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {log.userName}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          ({log.role})
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatTime(log.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed">
                        {log.details}
                      </p>

                      {log.targetType && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Target: <span className="font-mono">{log.targetType}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
