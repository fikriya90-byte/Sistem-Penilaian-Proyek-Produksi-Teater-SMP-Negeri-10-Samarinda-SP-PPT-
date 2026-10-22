import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search,
  CheckCircle, XCircle, Clock, Users, Layers, X, Info,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface BookingEvent {
  id: string;
  classId: string;
  className: string;
  equipmentId?: string;
  equipmentName: string;
  bookerName: string;
  bookerRole: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  rejectionReason?: string;
  verifierNote?: string;
  wasRescheduledByVerifier?: boolean;
  originalStartTime?: string;
  originalEndTime?: string;
  createdAt: string;
}

// ✅ Palette warna per kelas
const CLASS_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-400 dark:border-blue-500/50', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-400 dark:border-emerald-500/50', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-400 dark:border-amber-500/50', dot: 'bg-amber-500' },
  { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-400 dark:border-purple-500/50', dot: 'bg-purple-500' },
  { bg: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-800 dark:text-pink-200', border: 'border-pink-400 dark:border-pink-500/50', dot: 'bg-pink-500' },
  { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-800 dark:text-cyan-200', border: 'border-cyan-400 dark:border-cyan-500/50', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-800 dark:text-indigo-200', border: 'border-indigo-400 dark:border-indigo-500/50', dot: 'bg-indigo-500' },
  { bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-400 dark:border-rose-500/50', dot: 'bg-rose-500' },
];

const STATUS_CONFIG = {
  PENDING: { label: 'Menunggu', bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300 dark:border-amber-500/40' },
  APPROVED: { label: 'Disetujui', bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-300 dark:border-emerald-500/40' },
  REJECTED: { label: 'Ditolak', bg: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-300 dark:border-rose-500/40' },
};

// ✅ Helper
const getMonthDays = (date: Date): (Date | null)[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  const startWeekday = (firstDay.getDay() + 6) % 7; // Senin = 0
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
};

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface Props {
  embedded?: boolean;
  onClose?: () => void;
}

export const BookingCalendarModule: React.FC<Props> = ({ embedded = false, onClose }) => {
  const { user, classes, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [bookings, setBookings] = useState<BookingEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [filterEquipment, setFilterEquipment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const canVerify =
    isGuruPengampu ||
    isAdminRole ||
    user?.role === 'Pimpinan Produksi' ||
    user?.role === 'Koordinator Tata Musik' ||
    user?.role === 'Guru Pembina' ||
    user?.role === 'Super Admin';

  // Subscribe bookings — semua kelas
  useEffect(() => {
    const classIds = classes.map(c => c.id);
    if (classIds.length === 0) { setLoading(false); return; }

    let q;
    if (classIds.length <= 30) {
      q = query(collection(db, 'bookings'), where('classId', 'in', classIds));
    } else {
      q = query(collection(db, 'bookings'));
    }

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        const cls = classes.find(c => c.id === data.classId);
        return {
          id: d.id,
          ...data,
          className: data.className || cls?.name || 'Kelas',
        } as BookingEvent;
      });
      setBookings(list);
      setLoading(false);
    }, err => {
      console.warn('Subscribe bookings error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [classes]);

  // Map classId → color
  const classColorMap = useMemo(() => {
    const map: Record<string, typeof CLASS_COLORS[0]> = {};
    classes.forEach((c, i) => {
      map[c.id] = CLASS_COLORS[i % CLASS_COLORS.length];
    });
    return map;
  }, [classes]);

  // Unique equipment names
  const uniqueEquipments = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach(b => set.add(b.equipmentName));
    return Array.from(set).sort();
  }, [bookings]);

  // Filter
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (filterClass !== 'ALL' && b.classId !== filterClass) return false;
      if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
      if (filterEquipment !== 'ALL' && b.equipmentName !== filterEquipment) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.bookerName.toLowerCase().includes(q) ||
          b.equipmentName.toLowerCase().includes(q) ||
          (b.className || '').toLowerCase().includes(q) ||
          (b.purpose || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bookings, filterClass, filterStatus, filterEquipment, searchQuery]);

  // Group by date
  const bookingsByDate = useMemo(() => {
    const map: Record<string, BookingEvent[]> = {};
    filteredBookings.forEach(b => {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [filteredBookings]);

  // Stats bulan ini
  const monthStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthBookings = filteredBookings.filter(b => b.date.startsWith(prefix));
    return {
      total: monthBookings.length,
      approved: monthBookings.filter(b => b.status === 'APPROVED').length,
      pending: monthBookings.filter(b => b.status === 'PENDING').length,
      rejected: monthBookings.filter(b => b.status === 'REJECTED').length,
      byClass: classes.map(c => ({
        class: c,
        count: monthBookings.filter(b => b.classId === c.id).length,
      })).filter(x => x.count > 0),
    };
  }, [filteredBookings, currentMonth, classes]);

  const goPrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const goNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const goToday = () => { setCurrentMonth(new Date()); setSelectedDate(toDateStr(new Date())); };

  const calendarDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const todayStr = toDateStr(new Date());

  const handleApproveInline = async (booking: BookingEvent) => {
    if (!user || !canVerify) return;
    if (!confirm(`Setujui booking "${booking.equipmentName}" dari ${booking.className}?\n\n${booking.date} ${booking.startTime}-${booking.endTime}`)) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'APPROVED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Booking', targetId: booking.id,
        details: `Setujui via kalender: ${booking.equipmentName} (${booking.className})`,
      });
      showToast('Booking disetujui.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const handleRejectInline = async (booking: BookingEvent) => {
    if (!user || !canVerify) return;
    const reason = prompt(`Alasan tolak "${booking.equipmentName}" (${booking.className})?`);
    if (!reason || !reason.trim()) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'REJECTED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
        rejectionReason: reason.trim(),
        rejectionGuidance: 'Silakan ajukan ulang sesuai kesepakatan.',
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Booking', targetId: booking.id,
        details: `Tolak via kalender: ${booking.equipmentName} (${booking.className})`,
      });
      showToast('Booking ditolak.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const selectedBookings = selectedDate ? (bookingsByDate[selectedDate] || []) : [];

  return (
    <div className="space-y-4">
      {/* HEADER (kalau tidak embedded) */}
      {!embedded && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white shadow-xl border border-indigo-500/20">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <CalendarIcon className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Kalender Lintas Kelas
                </span>
                <h2 className="text-lg font-black text-white mt-0.5">Kalender Booking Alat Musik</h2>
                <p className="text-[11px] text-slate-300">
                  Semua peminjaman dari {classes.length} kelas dalam satu kalender
                </p>
              </div>
            </div>
            {onClose && (
              <button onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">Total Bulan Ini</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{monthStats.total}</p>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
          <p className="text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold uppercase">Disetujui</p>
          <p className="text-lg sm:text-xl font-black text-emerald-800 dark:text-emerald-200">{monthStats.approved}</p>
        </div>
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
          <p className="text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase">Menunggu</p>
          <p className="text-lg sm:text-xl font-black text-amber-800 dark:text-amber-200">{monthStats.pending}</p>
        </div>
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm">
          <p className="text-[9px] sm:text-[10px] text-rose-700 dark:text-rose-300 font-semibold uppercase">Ditolak</p>
          <p className="text-lg sm:text-xl font-black text-rose-800 dark:text-rose-200">{monthStats.rejected}</p>
        </div>
      </div>

      {/* FILTER */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input type="text" placeholder="Cari peminjam, alat, atau keperluan..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-white" />
        </div>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-white">
          <option value="ALL">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-white">
          <option value="ALL">Semua Status</option>
          <option value="PENDING">Menunggu</option>
          <option value="APPROVED">Disetujui</option>
          <option value="REJECTED">Ditolak</option>
        </select>
        <select value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)}
          className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-white">
          <option value="ALL">Semua Alat</option>
          {uniqueEquipments.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* CALENDAR */}
      <div className="p-3 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Nav */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={goPrevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center flex-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={goToday}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-bold">
              Hari Ini
            </button>
            <button onClick={goNextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-1.5 text-center text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
            const dateStr = toDateStr(day);
            const dayBookings = bookingsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const uniqueClassIds = Array.from(new Set(dayBookings.map(b => b.classId)));

            return (
              <button key={i} onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                className={`aspect-square p-0.5 sm:p-1 rounded-lg border-2 flex flex-col items-center justify-start transition relative ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 ring-2 ring-indigo-300'
                    : isToday
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                      : dayBookings.length > 0
                        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50'
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                }`}>
                <span className={`text-[10px] sm:text-[11px] font-bold ${
                  isToday ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {day.getDate()}
                </span>
                {dayBookings.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    {uniqueClassIds.slice(0, 3).map(cid => {
                      const color = classColorMap[cid];
                      return (
                        <span key={cid} className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${color?.dot || 'bg-slate-400'}`} />
                      );
                    })}
                    {uniqueClassIds.length > 3 && (
                      <span className="text-[7px] text-slate-400 leading-none">+{uniqueClassIds.length - 3}</span>
                    )}
                  </div>
                )}
                {dayBookings.length > 0 && (
                  <span className="absolute top-0 right-0.5 text-[8px] font-black text-slate-400 dark:text-slate-500">
                    {dayBookings.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* LEGEND */}
      {monthStats.byClass.length > 0 && (
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
            <Layers className="w-3 h-3" /> Legend Kelas ({monthStats.byClass.length} aktif bulan ini)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {monthStats.byClass.map(({ class: cls, count }) => {
              const color = classColorMap[cls.id] || CLASS_COLORS[0];
              return (
                <button key={cls.id} onClick={() => setFilterClass(filterClass === cls.id ? 'ALL' : cls.id)}
                  className={`p-2 rounded-lg border-2 text-left transition ${
                    filterClass === cls.id
                      ? `${color.bg} ${color.border} ring-1 ring-indigo-300`
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} />
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {cls.name}
                    </span>
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 ml-auto">
                      {count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL HARI TERPILIH */}
      {selectedDate && (
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-500/40 shadow-md">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div>
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">
                Detail Booking
              </p>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedBookings.length} booking
              </p>
            </div>
            <button onClick={() => setSelectedDate(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedBookings.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 dark:bg-slate-800 rounded-xl">
              <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-1.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Tidak ada booking di tanggal ini</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedBookings.map(b => {
                const color = classColorMap[b.classId] || CLASS_COLORS[0];
                const statusCfg = STATUS_CONFIG[b.status];
                return (
                  <div key={b.id} className={`p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-4 ${color.border}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${color.bg} ${color.text} ${color.border}`}>
                            {b.className}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            {statusCfg.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {b.startTime}–{b.endTime}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          🎵 {b.equipmentName}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Peminjam: <strong>{b.bookerName}</strong> ({b.bookerRole})
                        </p>
                        {b.purpose && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-1">
                            "{b.purpose}"
                          </p>
                        )}
                      </div>
                      {canVerify && b.status === 'PENDING' && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleApproveInline(b)}
                            className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" title="Setujui">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRejectInline(b)}
                            className="p-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white" title="Tolak">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* INFO */}
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <p className="font-bold mb-0.5">💡 Tips:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Klik tanggal untuk melihat detail booking hari itu.</li>
            <li>Klik badge kelas di legend untuk filter cepat.</li>
            <li>Titik berwarna = kelas berbeda. Angka kecil di pojok = jumlah booking.</li>
            {canVerify && <li>Tombol <strong>✓ / ✗</strong> langsung di detail untuk verifikasi cepat.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};
