import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search,
  Film, Calendar, Package, Clock, X, Info, Users, Layers, Sparkles, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { PageGuideOverlay } from '../common/PageGuideOverlay';

type ActivityType = 'TIMELINE' | 'SCHEDULE' | 'BOOKING' | 'DEADLINE';

interface CalendarActivity {
  id: string;
  type: ActivityType;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  classId: string;
  className?: string;
  extra?: string;
  status?: string;
}

const TYPE_CONFIG: Record<ActivityType, {
  label: string; icon: any; color: string; bg: string; border: string; dot: string;
}> = {
  TIMELINE: { label: 'Timeline', icon: Film, color: 'text-indigo-800 dark:text-indigo-200', bg: 'bg-indigo-100 dark:bg-indigo-500/20', border: 'border-indigo-300 dark:border-indigo-500/40', dot: 'bg-indigo-500' },
  SCHEDULE: { label: 'Agenda', icon: Calendar, color: 'text-blue-800 dark:text-blue-200', bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-blue-300 dark:border-blue-500/40', dot: 'bg-blue-500' },
  BOOKING: { label: 'Booking', icon: Package, color: 'text-purple-800 dark:text-purple-200', bg: 'bg-purple-100 dark:bg-purple-500/20', border: 'border-purple-300 dark:border-purple-500/40', dot: 'bg-purple-500' },
  DEADLINE: { label: 'Deadline', icon: Clock, color: 'text-amber-800 dark:text-amber-200', bg: 'bg-amber-100 dark:bg-amber-500/20', border: 'border-amber-300 dark:border-amber-500/40', dot: 'bg-amber-500' },
};

const CLASS_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
  'bg-indigo-100 text-indigo-800 border-indigo-300',
  'bg-rose-100 text-rose-800 border-rose-300',
];

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const CALENDAR_GUIDE = [
  { title: 'Kalender Terpadu', description: 'Semua jadwal dari berbagai divisi, rapat pleno, hingga deadline tugas dikumpulkan di sini.' },
  { title: 'Filter Warna', description: 'Gunakan filter di atas untuk melihat agenda berdasarkan jenisnya (Timeline, Agenda, Booking, atau Deadline).' },
  { title: 'Detail Tanggal', description: 'Klik tanggal mana saja pada kalender untuk melihat rincian jam dan lokasi kegiatan pada hari tersebut.' }
];

const getMonthDays = (date: Date): (Date | null)[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  const startWeekday = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
  while (days.length % 7 !== 0) days.push(null);
  return days;
};

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isoToDateStr = (iso: string): string => {
  try { return toDateStr(new Date(iso)); } catch { return ''; }
};

const getTimeFromISO = (iso: string): string => {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
};

export const ActivityCalendarModule: React.FC = () => {
  const { user, activeClass, classes, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const canAccess = isGuruPengampu || isAdminRole;

  const [timelineWeeks, setTimelineWeeks] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [divisionSchedules, setDivisionSchedules] = useState<any[]>([]); // ✅ State Baru
  const [bookings, setBookings] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | ActivityType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!canAccess) { setLoading(false); return; }
    let count = 0;
    const checkDone = () => { count++; if (count >= 5) setLoading(false); }; // ✅ Ubah jadi 5

    const unsub1 = onSnapshot(collection(db, 'timelineWeeks'), snap => {
      setTimelineWeeks(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      checkDone();
    }, () => checkDone());

    const unsub2 = onSnapshot(collection(db, 'schedules'), snap => {
      setSchedules(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      checkDone();
    }, () => checkDone());

    // ✅ BARU: Subscription Agenda Divisi
    const unsub3 = onSnapshot(collection(db, 'divisionSchedules'), snap => {
      setDivisionSchedules(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      checkDone();
    }, () => checkDone());

    const unsub4 = onSnapshot(collection(db, 'bookings'), snap => {
      setBookings(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      checkDone();
    }, () => checkDone());

    const unsub5 = onSnapshot(collection(db, 'deadlines'), snap => {
      setDeadlines(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      checkDone();
    }, () => checkDone());

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [canAccess]);

  const allActivities: CalendarActivity[] = useMemo(() => {
    const list: CalendarActivity[] = [];
    const classNameMap: Record<string, string> = {};
    classes.forEach(c => { classNameMap[c.id] = c.name; });

    // 1. Timeline weeks
    timelineWeeks.forEach(w => {
      if (!w.title || !w.title.trim()) return;
      const date = isoToDateStr(w.startDate);
      if (!date) return;
      list.push({
        id: `tw-${w.id}`, type: 'TIMELINE', title: w.title, date,
        startTime: getTimeFromISO(w.startDate), endTime: getTimeFromISO(w.endDate),
        classId: w.classId, className: classNameMap[w.classId],
        extra: `${w.label} • ${w.phase || ''}`.trim(), status: w.status,
      });
    });

    // 2. Schedules Umum
    schedules.forEach(s => {
      const date = isoToDateStr(s.startAt);
      if (!date) return;
      list.push({
        id: `sch-${s.id}`, type: 'SCHEDULE', title: s.title, date,
        startTime: getTimeFromISO(s.startAt), endTime: getTimeFromISO(s.endAt),
        location: s.location, classId: s.classId, className: classNameMap[s.classId],
        extra: s.type || '', status: undefined,
      });
    });

    // ✅ BARU: 2b. Division Schedules (Koordinator)
    divisionSchedules.forEach(ds => {
      if (!ds.date) return;
      list.push({
        id: `ds-${ds.id}`, type: 'SCHEDULE', title: ds.title, date: ds.date,
        startTime: ds.time || '', location: ds.location || '',
        classId: ds.classId, className: classNameMap[ds.classId],
        extra: `Divisi: ${ds.divisionName}`, status: undefined,
      });
    });

    // 3. Bookings
    bookings.forEach(b => {
      if (!b.date || ['REJECTED', 'CANCELLED'].includes(b.status)) return;
      list.push({
        id: `bk-${b.id}`, type: 'BOOKING', title: `${b.equipmentName} — ${b.bookerName}`,
        date: b.date, startTime: b.startTime, endTime: b.endTime,
        classId: b.classId, className: b.className || classNameMap[b.classId],
        extra: b.purpose, status: b.status,
      });
    });

    // 4. Deadlines
    deadlines.forEach(d => {
      if (d.status === 'CANCELLED') return;
      const date = isoToDateStr(d.dueDate);
      if (!date) return;
      list.push({
        id: `dl-${d.id}`, type: 'DEADLINE', title: d.title, date,
        startTime: getTimeFromISO(d.dueDate), classId: d.classId,
        className: classNameMap[d.classId],
        extra: `${d.stage || ''} • ${d.priority || ''}`.trim(), status: d.status,
      });
    });

    return list;
  }, [timelineWeeks, schedules, divisionSchedules, bookings, deadlines, classes]);

  const filteredActivities = useMemo(() => {
    return allActivities.filter(a => {
      if (filterClass !== 'ALL' && a.classId !== filterClass) return false;
      if (filterType !== 'ALL' && a.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) || (a.className || '').toLowerCase().includes(q) ||
          (a.extra || '').toLowerCase().includes(q) || (a.location || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allActivities, filterClass, filterType, searchQuery]);

  const byDate = useMemo(() => {
    const map: Record<string, CalendarActivity[]> = {};
    filteredActivities.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00')));
    return map;
  }, [filteredActivities]);

  const monthStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthItems = filteredActivities.filter(a => a.date.startsWith(prefix));
    return {
      total: monthItems.length,
      byType: {
        TIMELINE: monthItems.filter(a => a.type === 'TIMELINE').length,
        SCHEDULE: monthItems.filter(a => a.type === 'SCHEDULE').length,
        BOOKING: monthItems.filter(a => a.type === 'BOOKING').length,
        DEADLINE: monthItems.filter(a => a.type === 'DEADLINE').length,
      },
    };
  }, [filteredActivities, currentMonth]);

  const goPrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const goNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const goToday = () => { setCurrentMonth(new Date()); setSelectedDate(toDateStr(new Date())); };

  const calendarDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const todayStr = toDateStr(new Date());

  if (!canAccess) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hanya Guru & Admin.</p>
      </div>
    );
  }

  const selectedActivities = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div className="space-y-6">
      <PageGuideOverlay moduleId="activity-calendar" title="Panduan Kalender Kegiatan" steps={CALENDAR_GUIDE} />
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <CalendarIcon className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Kalender Kerabat Kerja
            </span>
            <h2 className="text-xl font-black text-white mt-1">Agenda Lintas Kelas</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Timeline, agenda, booking, dan deadline dari semua kelas terdaftar
            </p>
          </div>
        </div>
      </div>

      {/* Stats per type */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase">Total Bulan Ini</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{monthStats.total}</p>
        </div>
        {(Object.keys(TYPE_CONFIG) as ActivityType[]).map(t => {
          const cfg = TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button key={t} onClick={() => setFilterType(filterType === t ? 'ALL' : t)}
              className={`p-3 rounded-2xl border shadow-sm text-left transition ${
                filterType === t ? `${cfg.bg} ${cfg.border} ring-2 ring-indigo-300` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
              }`}>
              <div className="flex items-center gap-1 mb-1">
                <Icon className={`w-3 h-3 ${cfg.color}`} />
                <p className={`text-[9px] font-semibold uppercase ${cfg.color}`}>{cfg.label}</p>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">{monthStats.byType[t]}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input type="text" placeholder="Cari agenda, kelas, lokasi..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-white" />
        </div>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-white">
          <option value="ALL">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
          className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-white">
          <option value="ALL">Semua Jenis</option>
          {(Object.keys(TYPE_CONFIG) as ActivityType[]).map(t => (
            <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-400">Memuat agenda...</p>
        </div>
      ) : (
        <>
          {/* Calendar */}
          <div className="p-3 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <button onClick={goPrevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={goToday} className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-bold">Hari Ini</button>
                <button onClick={goNextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="py-1.5 text-center text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
                const dateStr = toDateStr(day);
                const dayActivities = byDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const typesPresent = Array.from(new Set(dayActivities.map(a => a.type)));

                return (
                  <button key={i} onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                    className={`aspect-square p-0.5 sm:p-1 rounded-lg border-2 flex flex-col items-center justify-start transition relative ${
                      isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 ring-2 ring-indigo-300'
                        : isToday ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                        : dayActivities.length > 0 ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300'
                        : 'border-slate-100 dark:border-slate-800'
                    }`}>
                    <span className={`text-[10px] sm:text-[11px] font-bold ${isToday ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
                      {day.getDate()}
                    </span>
                    {typesPresent.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {typesPresent.slice(0, 4).map(t => (
                          <span key={t} className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${TYPE_CONFIG[t as ActivityType].dot}`} />
                        ))}
                      </div>
                    )}
                    {dayActivities.length > 0 && (
                      <span className="absolute top-0 right-0.5 text-[8px] font-black text-slate-400 dark:text-slate-500">
                        {dayActivities.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3 flex-wrap">
              {(Object.keys(TYPE_CONFIG) as ActivityType[]).map(t => {
                const cfg = TYPE_CONFIG[t];
                const Icon = cfg.icon;
                return (
                  <div key={t} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <Icon className={`w-3 h-3 ${cfg.color}`} />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail per tanggal */}
          {selectedDate && (
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-500/40 shadow-md">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">Detail Agenda</p>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedActivities.length} agenda</p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedActivities.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-1.5" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tidak ada agenda di tanggal ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedActivities.map(a => {
                    const cfg = TYPE_CONFIG[a.type];
                    const Icon = cfg.icon;
                    const classIdx = classes.findIndex(c => c.id === a.classId);
                    const classColor = classIdx >= 0 ? CLASS_COLORS[classIdx % CLASS_COLORS.length] : 'bg-slate-100 text-slate-600 border-slate-300';

                    return (
                      <div key={a.id} className={`p-3 rounded-xl bg-white dark:bg-slate-800 border-2 ${cfg.border}`}>
                        <div className="flex items-start gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            <Icon className="w-2.5 h-2.5" />
                            {cfg.label}
                          </span>
                          {a.className && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${classColor}`}>
                              {a.className}
                            </span>
                          )}
                          {a.startTime && (
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" /> {a.startTime}{a.endTime ? `-${a.endTime}` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{a.title}</p>
                        {a.location && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5" /> {a.location}
                          </p>
                        )}
                        {a.extra && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 italic">{a.extra}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
              <p className="font-bold mb-0.5">Informasi:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Kalender ini mengumpulkan agenda dari <strong>semua kelas</strong>.</li>
                <li>Titik warna = jenis agenda berbeda di tanggal itu.</li>
                <li>Klik tanggal untuk melihat detail semua agenda.</li>
                <li>Klik kartu statistik di atas untuk filter cepat per jenis.</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
