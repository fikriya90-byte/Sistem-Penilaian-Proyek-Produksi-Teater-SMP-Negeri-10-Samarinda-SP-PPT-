import React, { useState, useEffect } from 'react';
import {
  Bell, X, CheckSquare, Calendar, Wallet, AlertCircle, Check,
  Clock, Users, ChevronDown, ChevronRight, Sparkles, Info,
  Trash2, Eye, EyeOff, TrendingUp, Award, Flame, AlarmClock,
  Megaphone, Radio, Star, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  subscribeSchedules,
  subscribeDeadlinesByClass,
  subscribeDeadlineSubmissionsByClass,
} from '../../services/firestoreService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { ScheduleEvent } from '../../core/types';

type ReminderType =
  | 'URGENT'
  | 'NOTIF_PENTING'
  | 'PENGUMUMAN'
  | 'BROADCAST'
  | 'TASK_PENDING'
  | 'TASK_DONE'
  | 'SCHEDULE'
  | 'KAS';

interface ReminderItem {
  id: string;
  type: ReminderType;
  title: string;
  description: string;
  priority?: string;
  daysLeft?: number;
  actionLink: string;
  icon: any;
  color: string;
}

const TYPE_CONFIG: Record<
  Exclude<ReminderType, 'URGENT' | 'NOTIF_PENTING'>,
  { label: string; icon: any; color: string; gradient: string }
> = {
  PENGUMUMAN: {
    label: 'Pengumuman Penting',
    icon: Megaphone,
    color: 'text-amber-700 dark:text-amber-300',
    gradient: 'from-amber-500 to-amber-700',
  },
  BROADCAST: {
    label: 'Broadcast Terbaru',
    icon: Radio,
    color: 'text-purple-700 dark:text-purple-300',
    gradient: 'from-purple-500 to-purple-700',
  },
  TASK_PENDING: {
    label: 'Tugas Belum Dikerjakan',
    icon: Clock,
    color: 'text-rose-700 dark:text-rose-300',
    gradient: 'from-rose-500 to-rose-700',
  },
  TASK_DONE: {
    label: 'Tugas Sudah Dikerjakan',
    icon: CheckSquare,
    color: 'text-emerald-700 dark:text-emerald-300',
    gradient: 'from-emerald-500 to-emerald-700',
  },
  SCHEDULE: {
    label: 'Agenda 7 Hari ke Depan',
    icon: Calendar,
    color: 'text-blue-700 dark:text-blue-300',
    gradient: 'from-blue-500 to-blue-700',
  },
  KAS: {
    label: 'Kas & Tagihan',
    icon: Wallet,
    color: 'text-amber-700 dark:text-amber-300',
    gradient: 'from-amber-500 to-amber-700',
  },
};

// ============================================================
// FORMAT COUNTDOWN
// ============================================================
const formatDaysLeft = (daysLeft: number): { text: string; color: string; bg: string; border: string } => {
  if (daysLeft < 0) {
    const late = Math.abs(daysLeft);
    return { text: `Terlambat ${late} hari`, color: 'text-white', bg: 'bg-rose-600', border: 'border-rose-700' };
  }
  if (daysLeft === 0) return { text: 'HARI INI!', color: 'text-white', bg: 'bg-rose-500', border: 'border-rose-600' };
  if (daysLeft === 1) return { text: 'BESOK', color: 'text-white', bg: 'bg-orange-500', border: 'border-orange-600' };
  if (daysLeft <= 3) return { text: `${daysLeft} hari lagi`, color: 'text-white', bg: 'bg-amber-500', border: 'border-amber-600' };
  if (daysLeft <= 7) return { text: `${daysLeft} hari lagi`, color: 'text-slate-900', bg: 'bg-yellow-200', border: 'border-yellow-400' };
  return {
    text: `${daysLeft} hari lagi`,
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-700',
    border: 'border-slate-300 dark:border-slate-600',
  };
};

const getDaysLeft = (dateString: string): number => {
  const due = new Date(dateString).getTime();
  const now = Date.now();
  const diff = due - now;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getDaysAgo = (dateString: string): number => {
  const past = new Date(dateString).getTime();
  const now = Date.now();
  const diff = now - past;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const DashboardReminder: React.FC<{
  onNavigate: (module: string) => void;
}> = ({ onNavigate }) => {
  const { user, activeClass, isTeacher, isAdminRole } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // ✅ FIX: Gunakan deadlines (bukan tasks)
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [kas, setKas] = useState<any>(null);

  // Pengumuman, broadcast, notifikasi
  const [informations, setInformations] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [expanded, setExpanded] = useState<Record<Exclude<ReminderType, 'URGENT' | 'NOTIF_PENTING'>, boolean>>({
    PENGUMUMAN: true,
    BROADCAST: true,
    TASK_PENDING: true,
    TASK_DONE: false,
    SCHEDULE: true,
    KAS: true,
  });

  const today = new Date().toISOString().slice(0, 10);
  const storageKey = user ? `spppt-reminder-dismissed-${user.uid}-${today}` : '';

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDismissed(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [storageKey]);

  const persistDismissed = (ids: string[]) => {
    setDismissed(ids);
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* ignore */ }
  };

  const handleDismiss = (id: string) => {
    persistDismissed([...dismissed, id]);
    showToast('Pengingat disembunyikan.', 'info');
  };

  const handleDismissAll = () => {
    const all = buildItems().map(i => i.id);
    persistDismissed([...dismissed, ...all]);
    showToast('Semua pengingat disembunyikan.', 'info');
    setIsOpen(false);
  };

  // ============================================================
  // ✅ SUBSCRIPTIONS — DEADLINES (BUKAN TASKS)
  // ============================================================
  useEffect(() => {
    if (!user || !activeClass) return;

    const u1 = subscribeDeadlinesByClass(activeClass.id, setDeadlines);
    const u2 = subscribeSchedules(activeClass.id, setSchedules);

    let unsub3 = () => {};
    unsub3 = subscribeDeadlineSubmissionsByClass(activeClass.id, (subs: any[]) => {
      const map: Record<string, any> = {};
      subs.forEach((data: any) => {
        map[`${data.deadlineId}_${data.studentId}`] = {
          ...data,
          completed: data.status === 'SELESAI' || data.status === 'TERLAMBAT',
          completedAt: data.submittedAt,
        };
      });
      setSubmissions(map);
    });

    return () => { u1(); u2(); unsub3(); };
  }, [user, activeClass]);

  // Kas subscription
  useEffect(() => {
    if (!user || !activeClass || isTeacher || isAdminRole) return;
    const q = query(collection(db, 'kasSettings'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) { setKas(null); return; }
      const s = { ...snap.docs[0].data(), id: snap.docs[0].id };
      setKas(s.active ? s : null);
    });
    return () => unsub();
  }, [user, activeClass, isTeacher, isAdminRole]);

  // Subscribe informasi (pengumuman)
  useEffect(() => {
    if (!user || !activeClass) return;
    const q = query(collection(db, 'information'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setInformations(list);
    });
    return () => unsub();
  }, [user, activeClass]);

  // Subscribe broadcasts
  useEffect(() => {
    if (!user || !activeClass) return;
    const q = query(collection(db, 'broadcasts'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBroadcasts(list);
    });
    return () => unsub();
  }, [user, activeClass]);

  // Subscribe notifications
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setNotifications(list);
    });
    return () => unsub();
  }, [user]);

  // ============================================================
  // STATISTIK TUGAS — pakai deadlines
  // ============================================================
  const isDeadlineForUser = (d: any, u: any): boolean => {
    if (d.status === 'CANCELLED') return false;
    const scope = d.targetScope;
    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return d.targetRole === u.role;
    if (scope === 'DIVISI') return d.targetDivision === u.divisionName;
    if (scope === 'CUSTOM') {
      const tr: string[] = d.targetRoles || [], td: string[] = d.targetDivisions || [], tu: string[] = d.targetUserIds || [];
      if (tr.length > 0 && tr.includes(u.role)) return true;
      if (td.length > 0 && u.divisionName && td.includes(u.divisionName)) return true;
      if (tu.length === 0) return true;
      return tu.includes(u.uid);
    }
    return false;
  };

  const taskStats = (() => {
    if (!user) return { total: 0, done: 0, pending: 0, pct: 0, overdue: 0, urgent: 0, today: 0 };
    const myDeadlines = deadlines.filter(d => isDeadlineForUser(d, user));
    const doneDeadlines = myDeadlines.filter(d => submissions[`${d.id}_${user.uid}`]?.completed);
    const pendingDeadlines = myDeadlines.filter(d => !submissions[`${d.id}_${user.uid}`]?.completed);
    const overdue = pendingDeadlines.filter(d => getDaysLeft(d.dueDate) < 0).length;
    const todayCount = pendingDeadlines.filter(d => getDaysLeft(d.dueDate) === 0).length;
    const urgent = pendingDeadlines.filter(d => {
      const dl = getDaysLeft(d.dueDate);
      return dl >= 0 && dl <= 3;
    }).length;
    const pct = myDeadlines.length > 0 ? Math.round((doneDeadlines.length / myDeadlines.length) * 100) : 0;
    return {
      total: myDeadlines.length,
      done: doneDeadlines.length,
      pending: pendingDeadlines.length,
      overdue, urgent, today: todayCount, pct,
    };
  })();

  // ============================================================
  // BUILD ITEMS
  // ============================================================
  const buildItems = (): ReminderItem[] => {
    if (!user) return [];
    const items: ReminderItem[] = [];

    // ✅ 1. NOTIFIKASI PENTING (Urgent / Nilai / Feedback) yang belum dibaca
    const importantNotifs = notifications.filter(n =>
      !n.read &&
      ['Urgent', 'Nilai', 'Feedback'].includes(n.category) &&
      getDaysAgo(n.createdAt) <= 7
    );
    importantNotifs.forEach(n => {
      const isUrgent = n.category === 'Urgent';
      items.push({
        id: `notif-${n.id}`,
        type: 'NOTIF_PENTING',
        title: n.title,
        description: n.message?.slice(0, 120) || '',
        daysLeft: 0,
        actionLink: n.link || 'notifikasi',
        icon: isUrgent ? AlertCircle : (n.category === 'Nilai' ? Award : Star),
        color: isUrgent ? 'text-rose-700' : 'text-amber-700',
      });
    });

    // ✅ 2. PENGUMUMAN
    const importantInfos = informations.filter(i =>
      i.isPinned ||
      i.category === 'URGENT' ||
      i.priority === 'HIGH' ||
      getDaysAgo(i.createdAt) <= 3
    ).slice(0, 5);

    importantInfos.forEach(info => {
      const ago = getDaysAgo(info.createdAt);
      const timeStr = ago === 0 ? 'Hari ini' : ago === 1 ? 'Kemarin' : `${ago} hari lalu`;
      items.push({
        id: `info-${info.id}`,
        type: 'PENGUMUMAN',
        title: info.title,
        description: `${info.isPinned ? '📌 DISEMATKAN • ' : ''}${timeStr} • oleh ${info.authorName} (${info.authorRole})`,
        priority: info.priority,
        actionLink: 'informasi',
        icon: info.isPinned ? Star : Megaphone,
        color: info.category === 'URGENT' ? 'text-rose-700' : 'text-amber-700',
      });
    });

    // ✅ 3. BROADCAST
    const recentBroadcasts = broadcasts.filter(b =>
      getDaysAgo(b.createdAt) <= 3 && b.senderId !== user.uid
    ).slice(0, 3);

    recentBroadcasts.forEach(b => {
      const ago = getDaysAgo(b.createdAt);
      const timeStr = ago === 0 ? 'Hari ini' : ago === 1 ? 'Kemarin' : `${ago} hari lalu`;
      items.push({
        id: `broadcast-${b.id}`,
        type: 'BROADCAST',
        title: b.title,
        description: `${timeStr} • oleh ${b.senderName} (${b.senderRole})`,
        priority: b.priority,
        actionLink: 'broadcast',
        icon: Radio,
        color: b.priority === 'URGENT' ? 'text-rose-700' : 'text-purple-700',
      });
    });

    // Kalau Guru/Admin, berhenti di sini
    if (isTeacher || isAdminRole) return items;

    // ✅ 4. TASKS (deadlines) untuk siswa
    const myDeadlines = deadlines.filter(d => isDeadlineForUser(d, user));
    const pending = myDeadlines.filter(d => !submissions[`${d.id}_${user.uid}`]?.completed);
    const done = myDeadlines.filter(d => submissions[`${d.id}_${user.uid}`]?.completed);

    const sortedPending = [...pending].sort((a, b) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

    sortedPending.forEach(t => {
      const daysLeft = getDaysLeft(t.dueDate);
      const isUrgent = daysLeft <= 3;
      items.push({
        id: `task-pending-${t.id}`,
        type: isUrgent ? 'URGENT' : 'TASK_PENDING',
        title: t.title,
        description: isUrgent
          ? `${daysLeft < 0 ? '⚠️ Terlambat' : daysLeft === 0 ? '🔥 Deadline HARI INI' : daysLeft === 1 ? '⚡ Deadline BESOK' : `🔥 ${daysLeft} hari lagi`}`
          : `Deadline: ${new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        priority: t.priority,
        daysLeft,
        actionLink: 'tugas',
        icon: isUrgent ? Flame : Clock,
        color: isUrgent ? 'text-rose-700' : 'text-slate-600',
      });
    });

    done.slice(0, 5).forEach(t => {
      items.push({
        id: `task-done-${t.id}`,
        type: 'TASK_DONE',
        title: t.title,
        description: `✅ Selesai — ${submissions[`${t.id}_${user.uid}`]?.completedAt ? new Date(submissions[`${t.id}_${user.uid}`].completedAt).toLocaleDateString('id-ID') : ''}`,
        actionLink: 'tugas',
        icon: CheckSquare,
        color: 'text-emerald-700',
      });
    });

    // ✅ 5. SCHEDULES
    const now = Date.now();
    const next7 = now + 7 * 86400000;
    schedules
      .filter(s => {
        const t = new Date(s.startAt).getTime();
        return t >= now && t <= next7;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 5)
      .forEach(s => {
        const daysLeft = getDaysLeft(s.startAt);
        items.push({
          id: `schedule-${s.id}`,
          type: 'SCHEDULE',
          title: s.title,
          description: `${daysLeft === 0 ? 'Hari ini' : daysLeft === 1 ? 'Besok' : `${daysLeft} hari lagi`} • ${new Date(s.startAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — ${s.location}`,
          daysLeft,
          actionLink: 'jadwal',
          icon: Calendar,
          color: 'text-blue-700',
        });
      });

    // ✅ 6. KAS
    if (kas) {
      items.push({
        id: `kas-${kas.id}`,
        type: 'KAS',
        title: `Kas: ${kas.title}`,
        description: `Rp ${kas.amount.toLocaleString('id-ID')} • Cek status pembayaran Anda`,
        actionLink: 'kas',
        icon: Wallet,
        color: 'text-amber-700',
      });
    }

    return items;
  };

  const allItems = buildItems();
  const visibleItems = allItems.filter(i => !dismissed.includes(i.id));

  useEffect(() => {
    if (visibleItems.length === 0) return;
    const timer = setTimeout(() => setIsOpen(true), 800);
    return () => clearTimeout(timer);
  }, [visibleItems.length]);

  if (visibleItems.length === 0 && taskStats.total === 0) return null;

  const grouped: Record<Exclude<ReminderType, 'URGENT' | 'NOTIF_PENTING'>, ReminderItem[]> = {
    PENGUMUMAN: visibleItems.filter(i => i.type === 'PENGUMUMAN'),
    BROADCAST: visibleItems.filter(i => i.type === 'BROADCAST'),
    TASK_PENDING: visibleItems.filter(i => i.type === 'TASK_PENDING'),
    TASK_DONE: visibleItems.filter(i => i.type === 'TASK_DONE'),
    SCHEDULE: visibleItems.filter(i => i.type === 'SCHEDULE'),
    KAS: visibleItems.filter(i => i.type === 'KAS'),
  };

  const urgentItems = visibleItems.filter(i => i.type === 'URGENT');
  const importantNotifItems = visibleItems.filter(i => i.type === 'NOTIF_PENTING');

  // Banner kecil kalau modal tertutup
  if (!isOpen) {
    const totalItems = visibleItems.length;
    const urgentCount = urgentItems.length + importantNotifItems.length;
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 lg:bottom-32 right-4 sm:right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full font-bold text-xs shadow-2xl hover:scale-105 transition print:hidden ${
          urgentCount > 0
            ? 'bg-gradient-to-r from-rose-500 to-rose-700 text-white animate-pulse'
            : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
        }`}
      >
        {urgentCount > 0 ? <Flame className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        <span>
          {urgentCount > 0
            ? `${urgentCount} Info Penting!`
            : totalItems > 0 ? `${totalItems} Pengingat` : 'Progress Tugas'}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`p-5 text-white flex items-center justify-between shrink-0 ${
          urgentItems.length + importantNotifItems.length > 0
            ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-orange-600'
            : 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600'
        }`}>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
              {urgentItems.length + importantNotifItems.length > 0
                ? <Flame className="w-6 h-6" />
                : <Bell className="w-6 h-6" />}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Selamat datang kembali</p>
              <h3 className="text-base font-black">
                {urgentItems.length + importantNotifItems.length > 0
                  ? '🔥 Ada Info Penting!'
                  : 'Pengingat Hari Ini'}
              </h3>
              <p className="text-[11px] opacity-90">
                {urgentItems.length + importantNotifItems.length > 0
                  ? `${urgentItems.length + importantNotifItems.length} item butuh perhatian segera`
                  : `${visibleItems.length} item perlu perhatian Anda`}
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* SUMMARY CARD */}
          {taskStats.total > 0 && !isTeacher && !isAdminRole && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Progress Tugas Anda</span>
                </div>
                <Award className="w-5 h-5 opacity-80" />
              </div>

              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-4xl font-black leading-none">
                    {taskStats.done}<span className="text-2xl opacity-70">/{taskStats.total}</span>
                  </p>
                  <p className="text-[11px] opacity-90 mt-1">Tugas selesai</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black leading-none">{taskStats.pct}%</p>
                  <p className="text-[11px] opacity-90 mt-1">Progress</p>
                </div>
              </div>

              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  taskStats.pct >= 80 ? 'bg-emerald-300' :
                  taskStats.pct >= 50 ? 'bg-amber-300' :
                  taskStats.pct > 0 ? 'bg-orange-300' : 'bg-rose-300'
                }`} style={{ width: `${taskStats.pct}%` }} />
              </div>

              <div className="grid grid-cols-4 gap-2 mt-3">
                <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm text-center">
                  <p className="text-[9px] opacity-90 font-bold">Selesai</p>
                  <p className="text-base font-black text-emerald-200">{taskStats.done}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm text-center">
                  <p className="text-[9px] opacity-90 font-bold">Belum</p>
                  <p className="text-base font-black text-amber-200">{taskStats.pending}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm text-center">
                  <p className="text-[9px] opacity-90 font-bold">Mendesak</p>
                  <p className={`text-base font-black ${taskStats.urgent > 0 ? 'text-rose-200' : 'text-slate-200'}`}>{taskStats.urgent}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm text-center">
                  <p className="text-[9px] opacity-90 font-bold">Terlambat</p>
                  <p className={`text-base font-black ${taskStats.overdue > 0 ? 'text-rose-200' : 'text-slate-200'}`}>{taskStats.overdue}</p>
                </div>
              </div>

              <button
                onClick={() => { onNavigate('tugas'); setIsOpen(false); }}
                className="w-full mt-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Buka Tugas Saya
              </button>
            </div>
          )}

          {/* NOTIFIKASI PENTING */}
          {importantNotifItems.length > 0 && (
            <div className="rounded-2xl border-2 border-rose-400 dark:border-rose-500/60 overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  🔔 Notifikasi Penting ({importantNotifItems.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {importantNotifItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-rose-50/40 dark:hover:bg-rose-500/5 transition">
                      <span className="p-1.5 rounded-lg bg-rose-500 text-white shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => { onNavigate(item.actionLink); setIsOpen(false); }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Buka
                          </button>
                          <button onClick={() => handleDismiss(item.id)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <EyeOff className="w-3 h-3 inline" /> Sembunyikan
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* URGENT (tugas deadline ≤3 hari) */}
          {urgentItems.length > 0 && (
            <div className="rounded-2xl border-2 border-rose-400 dark:border-rose-500/60 overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-3 bg-gradient-to-r from-rose-500 to-rose-700 text-white flex items-center gap-2">
                <Flame className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-extrabold uppercase tracking-wide">🔥 Deadline Mendesak (≤3 hari)</span>
                <span className="text-[10px] font-bold bg-white/25 px-2 py-0.5 rounded-full ml-auto">{urgentItems.length}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {urgentItems.map(item => {
                  const daysInfo = formatDaysLeft(item.daysLeft ?? 0);
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-rose-50/40 dark:hover:bg-rose-500/5 transition">
                      <span className={`p-1.5 rounded-lg ${daysInfo.bg} shrink-0`}>
                        <Icon className={`w-4 h-4 ${daysInfo.color}`} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${daysInfo.bg} ${daysInfo.color} ${daysInfo.border}`}>
                            {daysInfo.text}
                          </span>
                          {item.priority === 'CRITICAL' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">
                              KRITIS
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.title}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => { onNavigate(item.actionLink); setIsOpen(false); }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Kerjakan
                          </button>
                          <button onClick={() => handleDismiss(item.id)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <EyeOff className="w-3 h-3 inline" /> Sembunyikan
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NORMAL GROUPS */}
          {(Object.keys(grouped) as Exclude<ReminderType, 'URGENT' | 'NOTIF_PENTING'>[]).map(type => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const cfg = TYPE_CONFIG[type];
            const isExpanded = expanded[type];
            const Icon = cfg.icon;

            return (
              <div key={type} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpanded({ ...expanded, [type]: !isExpanded })}
                  className={`w-full p-3 flex items-center justify-between bg-gradient-to-r ${cfg.gradient} text-white`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-extrabold uppercase tracking-wide">{cfg.label}</span>
                    <span className="text-[10px] font-bold bg-white/25 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map(item => {
                      const ItemIcon = item.icon;
                      const prioColor =
                        item.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                        item.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700';
                      const daysInfo = item.daysLeft !== undefined && (item.type === 'TASK_PENDING' || item.type === 'SCHEDULE')
                        ? formatDaysLeft(item.daysLeft)
                        : null;

                      return (
                        <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <ItemIcon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color} dark:opacity-90`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {daysInfo && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${daysInfo.bg} ${daysInfo.color} ${daysInfo.border}`}>
                                  {daysInfo.text}
                                </span>
                              )}
                              {item.priority && item.type !== 'TASK_DONE' && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${prioColor}`}>
                                  {item.priority}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate mt-1">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => { onNavigate(item.actionLink); setIsOpen(false); }}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Buka
                              </button>
                              <button
                                onClick={() => handleDismiss(item.id)}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1"
                              >
                                <EyeOff className="w-3 h-3" /> Sembunyikan
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDismiss(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition shrink-0"
                            title="Sembunyikan"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Kalau benar-benar kosong */}
          {taskStats.total === 0 && visibleItems.length === 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <CheckSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada pengingat untuk Anda saat ini.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
            💡 Muncul otomatis setiap login/refresh
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDismissAll}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Sembunyikan Semua
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-bold"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
