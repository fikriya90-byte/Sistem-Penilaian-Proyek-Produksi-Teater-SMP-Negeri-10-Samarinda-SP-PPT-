import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, MapPin, PlusCircle, Trash2, UserCheck,
  Users, ChevronLeft, ChevronRight, Check, X,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS } from '../../core/constants';
import { DivisionType, ScheduleEvent, ScheduleType } from '../../core/types';
import {
  createSchedule, deleteSchedule, recordAuditLog, subscribeSchedules,
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { doc, setDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';

interface AttendanceConfirm {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  status: 'HADIR' | 'TIDAK_HADIR';
  confirmedAt: string;
}

export const ScheduleModule: React.FC = () => {
  const { user, activeClass, isTeacher, canCreateGeneralSchedule, canCreateInternalSchedule } = useAuth();
  const { showToast } = useToast();

  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [confirmations, setConfirmations] = useState<AttendanceConfirm[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ScheduleType>('Latihan');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('Panggung Terbuka SMPN 10');
  const [participants, setParticipants] = useState('Semua Anggota');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeSchedules(activeClass.id, setSchedules);
    const q = query(collection(db, 'scheduleConfirmations'), where('classId', '==', activeClass.id));
    const unsub2 = onSnapshot(q, snap => {
      setConfirmations(snap.docs.map(d => ({ ...d.data(), id: d.id } as any)));
    });
    return () => { unsub(); unsub2(); };
  }, [activeClass]);

  const canCreate = canCreateGeneralSchedule || canCreateInternalSchedule;

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !startAt || !endAt) {
      showToast('Harap lengkapi judul dan waktu.', 'warning');
      return;
    }
    try {
      const newId = await createSchedule({
        title: title.trim(),
        classId: activeClass.id,
        type,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        location: location.trim(),
        participants: participants.trim(),
        divisionName: user.divisionName,
        pic: user.displayName,
        description: description.trim(),
        createdBy: user.uid,
        creatorName: user.displayName,
      });
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Schedule',
        targetId: newId,
        details: `Membuat jadwal ${type}: ${title}`,
      });
      showToast('Jadwal berhasil disimpan!', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus agenda "${title}"?`)) return;
    try {
      await deleteSchedule(id);
      showToast('Jadwal dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const handleConfirm = async (schedule: ScheduleEvent, status: 'HADIR' | 'TIDAK_HADIR') => {
    if (!user) return;
    try {
      const id = `${schedule.id}_${user.uid}`;
      await setDoc(doc(db, 'scheduleConfirmations', id), {
        id,
        scheduleId: schedule.id,
        classId: schedule.classId,
        userId: user.uid,
        userName: user.displayName,
        status,
        confirmedAt: new Date().toISOString(),
      });
      showToast(`Konfirmasi kehadiran: ${status === 'HADIR' ? 'Hadir' : 'Tidak Hadir'}`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const filteredSchedules = schedules.filter(s => {
    if (selectedType !== 'ALL' && s.type !== selectedType) return false;
    if (viewMode === 'calendar' && selectedDate) {
      const sDate = new Date(s.startAt).toISOString().slice(0, 10);
      if (sDate !== selectedDate) return false;
    }
    return true;
  });

  // Kalender helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    const startWeekday = firstDay.getDay();
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const calendarDays = getDaysInMonth(currentMonth);
  const todayStr = new Date().toISOString().slice(0, 10);

  const schedulesForDay = (date: Date) => {
    const dateStr = date.toISOString().slice(0, 10);
    return schedules.filter(s => new Date(s.startAt).toISOString().slice(0, 10) === dateStr);
  };

  const myConfirmation = (scheduleId: string) =>
    confirmations.find(c => c.scheduleId === scheduleId && c.userId === user?.uid);

  const typeColor = (t: string) => {
    const map: Record<string, string> = {
      Rapat: 'border-blue-400 bg-blue-50',
      Latihan: 'border-orange-400 bg-orange-50',
      Gladi: 'border-red-400 bg-red-50',
      Pementasan: 'border-amber-500 bg-amber-50',
      Evaluasi: 'border-purple-400 bg-purple-50',
      Produksi: 'border-green-400 bg-green-50',
      Fitting: 'border-pink-400 bg-pink-50',
      Briefing: 'border-cyan-400 bg-cyan-50',
    };
    return map[t] || 'border-slate-300 bg-slate-50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
            <CalendarIcon className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Master Jadwal & Kalender</h2>
            <p className="text-xs text-slate-500 font-medium">
              Jadwal produksi, agenda, konfirmasi kehadiran & reminder otomatis
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              📋 List
            </button>
            <button onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              📅 Kalender
            </button>
          </div>
          {canCreate && (
            <button onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition">
              <PlusCircle className="w-4 h-4" /> Tambah Jadwal
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {['ALL', 'Rapat', 'Latihan', 'Gladi', 'Pementasan', 'Fitting', 'Produksi'].map(t => (
          <button key={t} onClick={() => setSelectedType(t)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedType === t ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {t === 'ALL' ? 'Semua' : t}
          </button>
        ))}
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 rounded-xl hover:bg-slate-100">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-black text-slate-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 rounded-xl hover:bg-slate-100">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map(d => (
              <div key={d} className="py-2 text-[11px] font-bold text-slate-500">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (!day) return <div key={i} className="aspect-square" />;
              const dateStr = day.toISOString().slice(0, 10);
              const daySchedules = schedulesForDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <button key={i} onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  className={`aspect-square p-1 rounded-xl border text-xs transition flex flex-col items-center justify-start ${
                    isSelected ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300' :
                    isToday ? 'border-blue-400 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'
                  }`}>
                  <span className={`font-bold text-[11px] ${isToday ? 'text-blue-700' : 'text-slate-800'}`}>
                    {day.getDate()}
                  </span>
                  <div className="flex gap-0.5 mt-0.5">
                    {daySchedules.slice(0, 3).map((s, j) => (
                      <span key={j} className={`w-1.5 h-1.5 rounded-full ${
                        s.type === 'Rapat' ? 'bg-blue-500' :
                        s.type === 'Latihan' ? 'bg-orange-500' :
                        s.type === 'Gladi' ? 'bg-red-500' :
                        s.type === 'Pementasan' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`} />
                    ))}
                    {daySchedules.length > 3 && (
                      <span className="text-[8px] text-slate-400">+{daySchedules.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700">
                  Jadwal: {new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <button onClick={() => setSelectedDate(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {filteredSchedules.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada jadwal.</p>
              ) : (
                <div className="space-y-2">
                  {filteredSchedules.map(s => {
                    const myConf = myConfirmation(s.id);
                    return (
                      <div key={s.id} className={`p-3 rounded-xl border-l-4 ${typeColor(s.type)}`}>
                        <p className="text-xs font-bold text-slate-900">{s.title}</p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(s.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(s.endAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {' • '}{s.location}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {myConf ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              myConf.status === 'HADIR' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {myConf.status === 'HADIR' ? '✅ Konfirmasi: Hadir' : '❌ Konfirmasi: Tidak Hadir'}
                            </span>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => handleConfirm(s, 'HADIR')}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white">
                                Hadir
                              </button>
                              <button onClick={() => handleConfirm(s, 'TIDAK_HADIR')}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500 text-white">
                                Tidak
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
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredSchedules.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              Belum ada jadwal.
            </div>
          ) : (
            filteredSchedules.map(event => {
              const startObj = new Date(event.startAt);
              const endObj = new Date(event.endAt);
              const myConf = myConfirmation(event.id);

              return (
                <div key={event.id} className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-center shrink-0 min-w-[70px]">
                      <span className="text-[10px] font-bold uppercase block text-amber-700">
                        {startObj.toLocaleDateString('id-ID', { month: 'short' })}
                      </span>
                      <span className="text-xl font-black block">{startObj.getDate()}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700">{event.type}</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {startObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {endObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900">{event.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 mt-2">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {event.participants}</span>
                        <span>PIC: <strong className="text-slate-700">{event.pic}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                    {myConf ? (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                        myConf.status === 'HADIR' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}>
                        {myConf.status === 'HADIR' ? '✅ Hadir' : '❌ Tidak Hadir'}
                      </span>
                    ) : (
                      <>
                        <button onClick={() => handleConfirm(event, 'HADIR')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Hadir
                        </button>
                        <button onClick={() => handleConfirm(event, 'TIDAK_HADIR')}
                          className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Tidak
                        </button>
                      </>
                    )}
                    {isTeacher && (
                      <button onClick={() => handleDelete(event.id, event.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal Create */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900">Buat Agenda Kegiatan Baru</h3>

            <form onSubmit={handleCreateSchedule} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kegiatan <span className="text-rose-500">*</span></label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Gladi Bersih Panggung Penuh"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jenis</label>
                <select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                  <option value="Latihan">Latihan</option>
                  <option value="Rapat">Rapat Koordinasi</option>
                  <option value="Gladi">Gladi Bersih / Kotor</option>
                  <option value="Pementasan">Pementasan Resmi</option>
                  <option value="Fitting">Fitting Busana / Rias</option>
                  <option value="Produksi">Produksi Divisi</option>
                  <option value="Briefing">Briefing Ringkas</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mulai <span className="text-rose-500">*</span></label>
                  <input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selesai <span className="text-rose-500">*</span></label>
                  <input type="datetime-local" required value={endAt} onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi</label>
                  <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Peserta</label>
                  <input type="text" required value={participants} onChange={(e) => setParticipants(e.target.value)}
                    placeholder="Semua / Divisi Tertentu"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan</label>
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm">
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
