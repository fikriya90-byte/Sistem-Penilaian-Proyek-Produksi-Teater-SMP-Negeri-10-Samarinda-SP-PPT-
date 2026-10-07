import React, { useState, useEffect } from 'react';
import {
  Bell, X, CheckSquare, Calendar, Wallet, AlertCircle, Check,
  Clock, Users, ChevronDown, ChevronRight, Sparkles, Info,
  ListChecks, Trash2, Eye, EyeOff, TrendingUp, Award,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { subscribeTasksByClass, subscribeSchedules } from '../../services/firestoreService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { TaskItem, ScheduleEvent } from '../../core/types';

type ReminderType = 'SUMMARY' | 'TASK_PENDING' | 'TASK_DONE' | 'SCHEDULE' | 'KAS';

interface ReminderItem {
  id: string;
  type: ReminderType;
  title: string;
  description: string;
  priority?: string;
  actionLink: string;
  icon: any;
  color: string;
}

const TYPE_CONFIG: Record<Exclude<ReminderType, 'SUMMARY'>, { label: string; icon: any; color: string; gradient: string }> = {
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

export const DashboardReminder: React.FC<{
  onNavigate: (module: string) => void;
}> = ({ onNavigate }) => {
  const { user, activeClass, isTeacher, isAdminRole } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completions, setCompletions] = useState<Record<string, any>>({});
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [kas, setKas] = useState<any>(null);
  const [expanded, setExpanded] = useState<Record<Exclude<ReminderType, 'SUMMARY'>, boolean>>({
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

  // Subscriptions
  useEffect(() => {
    if (!user || !activeClass || isTeacher || isAdminRole) return;
    const u1 = subscribeTasksByClass(activeClass.id, setTasks);
    const u2 = subscribeSchedules(activeClass.id, setSchedules);

    let unsub3 = () => {};
    (async () => {
      const q = query(collection(db, 'taskCompletions'), where('classId', '==', activeClass.id));
      unsub3 = onSnapshot(q, snap => {
        const map: Record<string, any> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          map[`${data.taskId}_${data.studentId}`] = data;
        });
        setCompletions(map);
      });
    })();

    return () => { u1(); u2(); unsub3(); };
  }, [user, activeClass, isTeacher, isAdminRole]);

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

  // ============================================================
  // HITUNG STATISTIK TUGAS
  // ============================================================
  const taskStats = (() => {
    if (!user) return { total: 0, done: 0, pending: 0, pct: 0, overdue: 0 };
    const myTasks = tasks.filter(t =>
      t.assigneeId === user.uid ||
      (t as any).targetRole === user.role ||
      (t as any).targetDivision === user.divisionName ||
      t.assigneeName === 'Semua Siswa' ||
      t.assigneeName === 'Semua Anggota Divisi'
    );
    const doneTasks = myTasks.filter(t => completions[`${t.id}_${user.uid}`]?.completed);
    const pendingTasks = myTasks.filter(t => !completions[`${t.id}_${user.uid}`]?.completed);
    const overdue = pendingTasks.filter(t => new Date(t.dueDate).getTime() < Date.now()).length;
    const pct = myTasks.length > 0 ? Math.round((doneTasks.length / myTasks.length) * 100) : 0;
    return {
      total: myTasks.length,
      done: doneTasks.length,
      pending: pendingTasks.length,
      overdue,
      pct,
    };
  })();

  const buildItems = (): ReminderItem[] => {
    if (!user || isTeacher || isAdminRole) return [];
    const items: ReminderItem[] = [];

    const myTasks = tasks.filter(t =>
      t.assigneeId === user.uid ||
      (t as any).targetRole === user.role ||
      (t as any).targetDivision === user.divisionName ||
      t.assigneeName === 'Semua Siswa' ||
      t.assigneeName === 'Semua Anggota Divisi'
    );

    const pending = myTasks.filter(t => !completions[`${t.id}_${user.uid}`]?.completed);
    const done = myTasks.filter(t => completions[`${t.id}_${user.uid}`]?.completed);

    pending.slice(0, 8).forEach(t => {
      const dueMs = new Date(t.dueDate).getTime();
      const isOverdue = dueMs < Date.now();
      items.push({
        id: `task-pending-${t.id}`,
        type: 'TASK_PENDING',
        title: t.title,
        description: isOverdue
          ? `⏰ Terlambat! Deadline ${new Date(t.dueDate).toLocaleDateString('id-ID')}`
          : `Deadline ${new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
        priority: t.priority,
        actionLink: 'tugas',
        icon: Clock,
        color: 'text-rose-700',
      });
    });

    done.slice(0, 5).forEach(t => {
      items.push({
        id: `task-done-${t.id}`,
        type: 'TASK_DONE',
        title: t.title,
        description: `✅ Selesai — ${completions[`${t.id}_${user.uid}`]?.completedAt ? new Date(completions[`${t.id}_${user.uid}`].completedAt).toLocaleDateString('id-ID') : ''}`,
        actionLink: 'tugas',
        icon: CheckSquare,
        color: 'text-emerald-700',
      });
    });

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
        items.push({
          id: `schedule-${s.id}`,
          type: 'SCHEDULE',
          title: s.title,
          description: `${new Date(s.startAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — ${s.location}`,
          actionLink: 'jadwal',
          icon: Calendar,
          color: 'text-blue-700',
        });
      });

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

  // Auto-open sekali per session
  useEffect(() => {
    if (visibleItems.length === 0) return;
    const sessionKey = user ? `spppt-reminder-shown-${user.uid}-${today}` : '';
    if (!sessionKey) return;
    try {
      if (sessionStorage.getItem(sessionKey) === '1') return;
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem(sessionKey, '1');
      }, 1200);
      return () => clearTimeout(timer);
    } catch { /* ignore */ }
  }, [visibleItems.length, user, today]);

  // Jangan render kalau tidak ada item DAN tidak ada tugas sama sekali
  if (visibleItems.length === 0 && taskStats.total === 0) return null;

  const grouped: Record<Exclude<ReminderType, 'SUMMARY'>, ReminderItem[]> = {
    TASK_PENDING: visibleItems.filter(i => i.type === 'TASK_PENDING'),
    TASK_DONE: visibleItems.filter(i => i.type === 'TASK_DONE'),
    SCHEDULE: visibleItems.filter(i => i.type === 'SCHEDULE'),
    KAS: visibleItems.filter(i => i.type === 'KAS'),
  };

  // Banner kecil kalau modal tertutup
  if (!isOpen) {
    const totalItems = visibleItems.length;
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 lg:bottom-32 right-4 sm:right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs shadow-2xl hover:scale-105 transition animate-pulse print:hidden"
      >
        <Bell className="w-4 h-4" />
        <span>
          {totalItems > 0 ? `${totalItems} Pengingat` : 'Progress Tugas'}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
              <Bell className="w-6 h-6" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Selamat datang kembali</p>
              <h3 className="text-base font-black">Pengingat Hari Ini</h3>
              <p className="text-[11px] opacity-90">{visibleItems.length} item perlu perhatian Anda</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* ============================================================ */}
          {/* SUMMARY CARD — RINGKASAN PROGRESS TUGAS */}
          {/* ============================================================ */}
          {taskStats.total > 0 && (
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
                  <p className="text-4xl font-black leading-none">{taskStats.done}<span className="text-2xl opacity-70">/{taskStats.total}</span></p>
                  <p className="text-[11px] opacity-90 mt-1">Tugas selesai</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black leading-none">{taskStats.pct}%</p>
                  <p className="text-[11px] opacity-90 mt-1">Progress</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    taskStats.pct >= 80 ? 'bg-emerald-300' :
                    taskStats.pct >= 50 ? 'bg-amber-300' :
                    taskStats.pct > 0 ? 'bg-orange-300' : 'bg-rose-300'
                  }`}
                  style={{ width: `${taskStats.pct}%` }}
                />
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm text-center">
                  <p className="text-[10px] opacity-90 font-bold">Selesai</p>
                  <p className="text-lg font-black text-emerald-200">{taskStats.done}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm text-center">
                  <p className="text-[10px] opacity-90 font-bold">Belum</p>
                  <p className="text-lg font-black text-amber-200">{taskStats.pending}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/15 backdrop-blur-sm text-center">
                  <p className="text-[10px] opacity-90 font-bold">Terlambat</p>
                  <p className={`text-lg font-black ${taskStats.overdue > 0 ? 'text-rose-200' : 'text-slate-200'}`}>{taskStats.overdue}</p>
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

          {/* Kalau tidak ada tugas sama sekali */}
          {taskStats.total === 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
              <CheckSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Belum ada tugas untuk Anda saat ini.
              </p>
            </div>
          )}

          {/* ============================================================ */}
          {/* GROUPS: TASK_PENDING / TASK_DONE / SCHEDULE / KAS */}
          {/* ============================================================ */}
          {(Object.keys(grouped) as Exclude<ReminderType, 'SUMMARY'>[]).map(type => {
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
                    <span className="text-[10px] font-bold bg-white/25 px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
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
                      return (
                        <div key={item.id} className="p-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <ItemIcon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color} dark:opacity-90`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                {item.title}
                              </p>
                              {item.priority && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${prioColor}`}>
                                  {item.priority}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.description}
                            </p>
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
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
            💡 Klik "Buka" untuk langsung menuju halaman terkait
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