import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, MapPin, PlusCircle, Trash2, UserCheck,
  Users, ChevronLeft, ChevronRight, Check, X, Pencil, Filter, MessageCircle, Building2
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { ScheduleEvent, ScheduleType, UserProfile } from '../../core/types';
import {
  createSchedule, deleteSchedule, recordAuditLog, subscribeSchedules, fetchUsersByClass, fetchClasses
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { doc, setDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';

interface AttendanceConfirm {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  status: 'HADIR' | 'TIDAK_HADIR';
  confirmedAt: string;
}

const ALL_DIVISIONS = [
  'Pengurus Inti', 'Pemeran', 'Perlengkapan', 'Publikasi & Dokumentasi', 
  'Tata Panggung', 'Tata Rias', 'Tata Busana', 'Tata Musik & Suara'
];

const ARTISTIK_DIVISIONS = ['Tata Panggung', 'Tata Rias', 'Tata Busana', 'Tata Musik & Suara', 'Pemeran'];

const ALL_ROLES = [
  'Pimpinan Produksi', 'Sekretaris', 'Bendahara', 
  'Sutradara', 'Asisten Sutradara', 'Pemeran',
  'Koordinator Perlengkapan', 'Anggota Perlengkapan',
  'Koordinator Publikasi', 'Anggota Publikasi',
  'Koordinator Tata Panggung', 'Anggota Tata Panggung',
  'Koordinator Tata Rias', 'Anggota Tata Rias',
  'Koordinator Tata Busana', 'Anggota Tata Busana',
  'Koordinator Tata Musik', 'Anggota Tata Musik'
];

const ARTISTIK_ROLES = [
  'Sutradara', 'Asisten Sutradara', 'Pemeran',
  'Koordinator Tata Panggung', 'Anggota Tata Panggung',
  'Koordinator Tata Rias', 'Anggota Tata Rias',
  'Koordinator Tata Busana', 'Anggota Tata Busana',
  'Koordinator Tata Musik', 'Anggota Tata Musik'
];

export const ScheduleModule: React.FC = () => {
  const { 
    user, activeClass, classes, isGuruPengampu, isAdminRole, 
    isPimprod, isSekretaris, isSutradara, isAsisten
  } = useAuth();
  const { showToast } = useToast();

  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [confirmations, setConfirmations] = useState<AttendanceConfirm[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Filter Khusus Guru
  const [filterClass, setFilterClass] = useState<string>('ALL');
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEvent | null>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ScheduleType>('Rapat');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('Ruang Teater SMPN 10');
  const [description, setDescription] = useState('');

  // State Khusus Taglist Target
  const [targetMode, setTargetMode] = useState<'ALL' | 'MANUAL'>('ALL');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // HAK AKSES PEMBUATAN (Koordinator DIHAPUS dari sini)
  const canCreateGeneral = isPimprod || isSekretaris || isGuruPengampu || isAdminRole;
  const canCreateArtistic = isSutradara || isAsisten;
  const canCreate = canCreateGeneral || canCreateArtistic;
  const canSeeAllClasses = isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!activeClass || !user) return;

    let unsubSchedules: () => void;

    if (canSeeAllClasses) {
      const q = query(collection(db, 'schedules'));
      unsubSchedules = onSnapshot(q, snap => {
        setSchedules(snap.docs.map(d => ({ ...d.data(), id: d.id } as ScheduleEvent)));
      });
    } else {
      unsubSchedules = subscribeSchedules(activeClass.id, setSchedules);
    }

    fetchUsersByClass(activeClass.id).then(setClassStudents);
    
    const qConf = query(collection(db, 'scheduleConfirmations'), where('classId', '==', activeClass.id));
    const unsubConf = onSnapshot(qConf, snap => {
      setConfirmations(snap.docs.map(d => ({ ...d.data(), id: d.id } as any)));
    });

    return () => { unsubSchedules(); unsubConf(); };
  }, [activeClass, user, canSeeAllClasses]);

  const formatLocalDatetime = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const openCreate = () => {
    setEditingSchedule(null);
    setTitle('');
    setType('Rapat');
    setStartAt('');
    setEndAt('');
    setLocation('Ruang Teater SMPN 10');
    setDescription('');
    
    setTargetMode('ALL');
    setSelectedUserIds([]);
    setSelectedDivisions([]);
    setSelectedRoles([]);

    setIsModalOpen(true);
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingSchedule(event);
    setTitle(event.title);
    setType(event.type);
    setStartAt(formatLocalDatetime(event.startAt));
    setEndAt(formatLocalDatetime(event.endAt));
    setLocation(event.location);
    setDescription(event.description || '');
    
    const tIds = (event as any).targetUserIds || [];
    setSelectedUserIds(tIds);
    if (tIds.length === classStudents.length) setTargetMode('ALL');
    else setTargetMode('MANUAL');
    
    setSelectedDivisions([]);
    setSelectedRoles([]);
    setIsModalOpen(true);
  };

  const computeTargetIds = (): string[] => {
    let ids: string[] = [];
    const validStudents = classStudents.filter(s => !['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'].includes(s.role));

    if (targetMode === 'ALL') {
      if (canCreateGeneral) {
        ids = validStudents.map(s => s.uid);
      } else if (canCreateArtistic) {
        ids = validStudents.filter(s => 
          ARTISTIK_DIVISIONS.includes(s.divisionName || '') || 
          ARTISTIK_ROLES.includes(s.role)
        ).map(s => s.uid);
      }
    } else if (targetMode === 'MANUAL') {
      validStudents.forEach(s => {
        const isDivMatch = selectedDivisions.length > 0 && selectedDivisions.includes(s.divisionName || '');
        const isRoleMatch = selectedRoles.length > 0 && selectedRoles.includes(s.role);
        const isUserMatch = selectedUserIds.includes(s.uid);
        
        if (isDivMatch || isRoleMatch || isUserMatch) ids.push(s.uid);
      });
    }
    return Array.from(new Set(ids));
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !canCreate) return;
    
    if (!title.trim() || !startAt || !endAt) {
      showToast('Harap lengkapi judul dan waktu.', 'warning');
      return;
    }

    const finalTargetIds = computeTargetIds();
    if (finalTargetIds.length === 0) {
      showToast('Target peserta kosong. Centang minimal 1 orang/divisi.', 'warning');
      return;
    }

    try {
      const payload = {
        title: title.trim(),
        classId: activeClass.id,
        className: activeClass.name,
        type,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        location: location.trim(),
        participants: 'Sesuai Target', 
        targetUserIds: finalTargetIds, 
        divisionName: '', 
        pic: user.displayName,
        description: description.trim(),
      };

      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.id), payload);
        await recordAuditLog({
          userId: user.uid, userName: user.displayName, role: user.role,
          action: 'UPDATE', targetType: 'Schedule', targetId: editingSchedule.id,
          details: `Mengubah kalender kegiatan: ${title} (${finalTargetIds.length} target)`,
        });
        showToast('Kalender diperbarui!', 'success');
      } else {
        const newId = await createSchedule({
          ...payload,
          createdBy: user.uid,
          creatorName: user.displayName,
        });
        await recordAuditLog({
          userId: user.uid, userName: user.displayName, role: user.role,
          action: 'CREATE', targetType: 'Schedule', targetId: newId,
          details: `Membuat kalender kegiatan: ${title} (${finalTargetIds.length} target)`,
        });
        showToast(`Kegiatan ditambahkan!`, 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const handleDelete = async (event: ScheduleEvent) => {
    const canDelete = event.createdBy === user?.uid || isGuruPengampu || isAdminRole;
    if (!canDelete) {
      showToast('Anda tidak berwenang menghapus jadwal ini.', 'warning');
      return;
    }
    if (!confirm(`Hapus agenda "${event.title}"?`)) return;
    try {
      await deleteSchedule(event.id);
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
        id, scheduleId: schedule.id, classId: schedule.classId,
        userId: user.uid, userName: user.displayName,
        status, confirmedAt: new Date().toISOString(),
      });
      showToast(`Konfirmasi: ${status === 'HADIR' ? 'Hadir' : 'Tidak Hadir'}`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const handleShareWA = (event: ScheduleEvent) => {
    const text = `*AGENDA KEGIATAN: ${event.title}*\n\nHari/Tgl: ${new Date(event.startAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\nWaktu: ${new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\nLokasi: ${event.location}\n\nMohon konfirmasi kehadiran Anda di web SP-PPT sebelum acara. Terima kasih.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const mySchedules = schedules.filter(s => {
    if (canSeeAllClasses) {
       if (filterClass !== 'ALL' && s.classId !== filterClass) return false;
    } else {
       if (s.classId !== activeClass?.id) return false;
    }

    if (!canSeeAllClasses) {
      const targets = (s as any).targetUserIds || [];
      if (targets.length === 0) return true;
      return targets.includes(user?.uid || '');
    }
    return true; 
  });

  const filteredSchedules = mySchedules.filter(s => {
    if (selectedType !== 'ALL' && s.type !== selectedType) return false;
    if (viewMode === 'calendar' && selectedDate) {
      const sDate = new Date(s.startAt).toISOString().slice(0, 10);
      if (sDate !== selectedDate) return false;
    }
    return true;
  });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    const startWeekday = firstDay.getDay();
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const calendarDays = getDaysInMonth(currentMonth);
  const todayStr = new Date().toISOString().slice(0, 10);

  const schedulesForDay = (date: Date) => {
    const dateStr = date.toISOString().slice(0, 10);
    return mySchedules.filter(s => new Date(s.startAt).toISOString().slice(0, 10) === dateStr);
  };

  const myConfirmation = (scheduleId: string) => confirmations.find(c => c.scheduleId === scheduleId && c.userId === user?.uid);

  const typeColor = (t: string) => {
    const map: Record<string, string> = {
      Rapat: 'border-blue-400 bg-blue-50',
      Latihan: 'border-orange-400 bg-orange-50',
      Gladi: 'border-red-400 bg-red-50',
      Pementasan: 'border-amber-500 bg-amber-50',
      Fitting: 'border-pink-400 bg-pink-50',
      Produksi: 'border-green-400 bg-green-50',
    };
    return map[t] || 'border-slate-300 bg-slate-50';
  };

  const renderTargetSelector = () => {
    if (!canCreate) return null;
    const allowedUsers = classStudents.filter(s => !['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'].includes(s.role));

    // Pembatasan untuk Sutradara (Hanya Artistik)
    const availableDivisions = canCreateGeneral ? ALL_DIVISIONS : ARTISTIK_DIVISIONS;
    const availableRoles = canCreateGeneral ? ALL_ROLES : ARTISTIK_ROLES;

    return (
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-amber-600" /> Target Peserta Kegiatan <span className="text-rose-500">*</span>
        </label>

        <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setTargetMode('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${targetMode === 'ALL' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-white text-slate-600'}`}>
              {canCreateGeneral ? 'Pilih Semua Siswa' : 'Pilih Semua Tim Artistik'}
            </button>
            <button type="button" onClick={() => setTargetMode('MANUAL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${targetMode === 'MANUAL' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-white text-slate-600'}`}>
              Pilih Spesifik (Checklist)
            </button>
        </div>

        {targetMode === 'MANUAL' && (
          <div className="mt-3 space-y-4 max-h-72 overflow-y-auto p-1 custom-scrollbar">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Berdasarkan Divisi</p>
              <div className="flex flex-wrap gap-1.5">
                {availableDivisions.map(div => (
                  <label key={div} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selectedDivisions.includes(div)} onChange={(e) => {
                      if (e.target.checked) setSelectedDivisions([...selectedDivisions, div]);
                      else setSelectedDivisions(selectedDivisions.filter(d => d !== div));
                    }} className="rounded text-amber-500 focus:ring-amber-500" />
                    <span className="text-[11px] font-semibold text-slate-700">{div}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Berdasarkan Peran Spesifik</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {availableRoles.map(role => (
                  <label key={role} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selectedRoles.includes(role)} onChange={(e) => {
                      if (e.target.checked) setSelectedRoles([...selectedRoles, role]);
                      else setSelectedRoles(selectedRoles.filter(r => r !== role));
                    }} className="rounded text-amber-500 focus:ring-amber-500" />
                    <span className="text-[11px] font-semibold text-slate-700 truncate">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Centang Nama Spesifik</p>
              <div className="grid grid-cols-2 gap-1.5">
                {allowedUsers.filter(s => {
                  if (canCreateArtistic && !canCreateGeneral) {
                    return ARTISTIK_DIVISIONS.includes(s.divisionName || '') || ARTISTIK_ROLES.includes(s.role);
                  }
                  return true;
                }).map(s => (
                  <label key={s.uid} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selectedUserIds.includes(s.uid)} onChange={(e) => {
                      if (e.target.checked) setSelectedUserIds([...selectedUserIds, s.uid]);
                      else setSelectedUserIds(selectedUserIds.filter(id => id !== s.uid));
                    }} className="rounded text-amber-500 focus:ring-amber-500" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 truncate">{s.displayName}</p>
                      <p className="text-[9px] text-slate-500 truncate">{s.role}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-200">
           <p className="text-xs font-bold text-emerald-700">
             ✅ Total: {computeTargetIds().length} orang akan menerima jadwal ini.
           </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
            <CalendarIcon className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {canSeeAllClasses ? 'Kalender Kegiatan (Semua Kelas)' : 'Kalender Kegiatan'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {canSeeAllClasses 
                ? 'Memantau seluruh agenda lintas kelas yang Anda ampu.' 
                : 'Agenda rapat, gladi, dan acara besar (Bukan jadwal harian divisi).'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>📋 List</button>
            <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>📅 Kalender</button>
          </div>
          {canCreate && (
            <button onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm">
              <PlusCircle className="w-4 h-4" /> Tambah Agenda
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none flex-1">
          {['ALL', 'Rapat', 'Gladi', 'Pementasan', 'Briefing'].map(t => (
            <button key={t} onClick={() => setSelectedType(t)} className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${selectedType === t ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
              {t === 'ALL' ? 'Semua Agenda' : t}
            </button>
          ))}
        </div>
        
        {canSeeAllClasses && classes.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select 
              value={filterClass} 
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-blue-400"
            >
              <option value="ALL">Semua Kelas ({classes.length})</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {viewMode === 'calendar' && (
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 rounded-xl hover:bg-slate-100"><ChevronLeft className="w-5 h-5" /></button>
            <h3 className="text-base font-black text-slate-900">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 rounded-xl hover:bg-slate-100"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map(d => <div key={d} className="py-2 text-[11px] font-bold text-slate-500">{d}</div>)}
            {calendarDays.map((day, i) => {
              if (!day) return <div key={i} className="aspect-square" />;
              const dateStr = day.toISOString().slice(0, 10);
              const daySchedules = schedulesForDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <button key={i} onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)} className={`aspect-square p-1 rounded-xl border text-xs transition flex flex-col items-center justify-start ${isSelected ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300' : isToday ? 'border-blue-400 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <span className={`font-bold text-[11px] ${isToday ? 'text-blue-700' : 'text-slate-800'}`}>{day.getDate()}</span>
                  <div className="flex gap-0.5 mt-0.5">
                    {daySchedules.slice(0, 3).map((s, j) => <span key={j} className={`w-1.5 h-1.5 rounded-full ${s.type === 'Rapat' ? 'bg-blue-500' : s.type === 'Gladi' ? 'bg-red-500' : 'bg-slate-400'}`} />)}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedDate && (
             <div className="mt-4 pt-4 border-t border-slate-100">
               <p className="text-xs font-bold mb-2">Agenda: {new Date(selectedDate).toLocaleDateString('id-ID')}</p>
               {filteredSchedules.map(s => {
                 const myConf = myConfirmation(s.id);
                 const canDelete = s.createdBy === user?.uid || isGuruPengampu || isAdminRole;
                 return (
                   <div key={s.id} className={`p-3 mb-2 rounded-xl border-l-4 ${typeColor(s.type)}`}>
                     <div className="flex items-center gap-2 mb-1">
                       <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-white text-slate-600">{(s as any).className || 'Kelas'}</span>
                       <p className="text-xs font-bold text-slate-900">{s.title}</p>
                     </div>
                     <p className="text-[10px] text-slate-500">{new Date(s.startAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {s.location}</p>
                     <div className="flex justify-between mt-2 items-center">
                       <div className="flex gap-1">
                          {myConf ? <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">{myConf.status}</span> : 
                           <><button onClick={() => handleConfirm(s, 'HADIR')} className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500 text-white rounded">Saya Akan Datang</button>
                             <button onClick={() => handleConfirm(s, 'TIDAK_HADIR')} className="text-[10px] font-bold px-2 py-0.5 bg-rose-500 text-white rounded">Berhalangan</button></>
                          }
                       </div>
                       {canDelete && (
                         <div className="flex gap-1">
                           <button onClick={() => handleShareWA(s)} className="p-1 text-green-600 hover:bg-green-50 rounded"><MessageCircle className="w-3.5 h-3.5"/></button>
                           <button onClick={() => handleDelete(s)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
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

      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredSchedules.length === 0 ? <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border">Tidak ada agenda untuk Anda.</div> : 
            filteredSchedules.map(event => {
              const startObj = new Date(event.startAt);
              const endObj = new Date(event.endAt);
              const myConf = myConfirmation(event.id);
              const canDelete = event.createdBy === user?.uid || isGuruPengampu || isAdminRole;
              const targets = (event as any).targetUserIds || [];
              let targetLabel = 'Anda';
              if (targets.length > 5) targetLabel = 'Banyak Peserta';
              else if (targets.length === 1 && targets[0] === user?.uid) targetLabel = 'Anda Spesifik';

              return (
                <div key={event.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-center shrink-0 min-w-[60px]">
                      <span className="text-[10px] font-bold uppercase block text-amber-700">{startObj.toLocaleDateString('id-ID', { month: 'short' })}</span>
                      <span className="text-lg font-black block leading-none">{startObj.getDate()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {canSeeAllClasses && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {(event as any).className || 'Kelas'}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">{event.type}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">Untuk: {targetLabel}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{startObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900">{event.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {(!canSeeAllClasses || event.classId === activeClass?.id) && (
                      myConf ? (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${myConf.status === 'HADIR' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'}`}>
                          {myConf.status === 'HADIR' ? '✅ Hadir' : '❌ Tidak Hadir'}
                        </span>
                      ) : (
                        <>
                          <button onClick={() => handleConfirm(event, 'HADIR')} className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saya Akan Datang</button>
                          <button onClick={() => handleConfirm(event, 'TIDAK_HADIR')} className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1"><X className="w-3.5 h-3.5" /> Berhalangan</button>
                        </>
                      )
                    )}
                    {canDelete && (
                      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                        <button onClick={() => handleShareWA(event)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Bagikan ke WA"><MessageCircle className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(event)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Edit Agenda"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(event)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Hapus Agenda"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {isModalOpen && canCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900">
              {editingSchedule ? 'Edit Agenda Kegiatan' : 'Tambah Agenda ke Kalender'}
            </h3>

            <form onSubmit={handleSaveSchedule} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Agenda <span className="text-rose-500">*</span></label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Rapat Pleno Evaluasi Mingguan"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Agenda</label>
                  <select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <option value="Rapat">Rapat</option>
                    <option value="Gladi">Gladi Bersih / Kotor</option>
                    <option value="Pementasan">Pementasan Resmi</option>
                    <option value="Briefing">Briefing Singkat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi</label>
                  <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
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

              {canSeeAllClasses && (
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 shrink-0" />
                  Agenda ini disimpan untuk kelas: <strong>{activeClass?.name}</strong>
                </div>
              )}

              {renderTargetSelector()}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan</label>
                <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Poin penting..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm">
                  {editingSchedule ? 'Perbarui Agenda' : 'Simpan Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
