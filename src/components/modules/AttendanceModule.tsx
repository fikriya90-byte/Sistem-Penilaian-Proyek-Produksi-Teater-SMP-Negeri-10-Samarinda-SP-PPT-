import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, Lock, MapPin, PlusCircle, UserCheck,
  Users, XCircle, X, Save, Info, ShieldAlert, BookOpen, Filter, ListFilter,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import {
  AttendanceRecord, AttendanceSession, AttendanceStatus, ScheduleType, UserProfile,
} from '../../core/types';
import {
  closeAttendanceSession, createAttendanceSession, fetchUsersByClass,
  recordAuditLog, submitAttendanceRecord, subscribeAttendanceRecords,
  subscribeAttendanceSessions, notifyTeachers,
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const AttendanceModule: React.FC = () => {
  const {
    user, activeClass, isTeacher, isGuruPengampu, isAdminRole,
    isPimprod, isSekretaris, isSutradara, isAsisten, isKoordinator,
    canCreateGeneralAttendance, canCreateRehearsalAttendance, canCreateDivisionAttendance,
  } = useAuth();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<ScheduleType>('Latihan');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [location, setLocation] = useState('Panggung Terbuka SMPN 10');
  const [agenda, setAgenda] = useState('');
  
  // State untuk memilih cakupan peserta (Scope)
  const [targetScope, setTargetScope] = useState<'SEMUA' | 'PEMAIN_MUSIK' | 'DIVISI'>('SEMUA');

  const [myStatus, setMyStatus] = useState<AttendanceStatus>('Hadir');
  const [myNote, setMyNote] = useState('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);

  // Filter Tab untuk Daftar Sesi
  const [filterTab, setFilterTab] = useState<'ALL' | 'MY_TASKS' | 'PEMAIN' | 'DIVISI' | 'RAPAT'>('ALL');

  const isTeacherOrStaff = isTeacher || isGuruPengampu || isAdminRole || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator;

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeAttendanceSessions(activeClass.id, (sess) => {
      setSessions(sess);
      if (sess.length > 0 && !activeSessionId) setActiveSessionId(sess[0].id);
    });
    fetchUsersByClass(activeClass.id).then(u => setClassStudents(u));
    return () => unsub();
  }, [activeClass]);

  // AUTO-CLOSE OTOMATIS JIKA WAKTU HABIS
  useEffect(() => {
    if (!sessions.length) return;
    const checkExpiredSessions = () => {
      const now = new Date();
      sessions.forEach(session => {
        if (session.isOpen) {
          const [eh, em] = session.endTime.split(':').map(Number);
          const endDateTime = new Date(session.date);
          endDateTime.setHours(eh || 0, em || 0, 0, 0);
          if (now > endDateTime) {
            closeAttendanceSession(session.id).catch(() => {});
          }
        }
      });
    };
    const timer = setInterval(checkExpiredSessions, 30000);
    checkExpiredSessions();
    return () => clearInterval(timer);
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    const unsub = subscribeAttendanceRecords(activeSessionId, (recs) => {
      setRecords(recs);
    });
    return () => unsub();
  }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const openCreateForm = () => {
    if (isSutradara || isAsisten) {
      setTargetScope('PEMAIN_MUSIK');
    } else if (isKoordinator && user?.divisionName) {
      setTargetScope('DIVISI');
    } else {
      setTargetScope('SEMUA');
    }
    setIsCreatingSession(true);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;

    if (!title.trim()) { showToast('Harap masukkan judul sesi presensi.', 'warning'); return; }
    if (!startTime || !endTime) { showToast('Jam Mulai dan Jam Selesai WAJIB diisi!', 'warning'); return; }
    if (startTime >= endTime) { showToast('Jam Selesai harus lebih lambat dari Jam Mulai.', 'warning'); return; }
    if (targetScope === 'DIVISI' && !user.divisionId) { showToast('Data divisi Anda tidak ditemukan.', 'warning'); return; }

    try {
      const newId = await createAttendanceSession({
        title: title.trim(),
        classId: activeClass.id,
        activityType,
        date,
        startTime,
        endTime,
        location: location.trim(),
        targetScope: targetScope,
        targetDivisionId: targetScope === 'DIVISI' ? user.divisionId : undefined,
        targetDivisionName: targetScope === 'DIVISI' ? user.divisionName : undefined,
        createdBy: user.uid,
        creatorRole: user.role,
        creatorName: user.displayName,
        agenda: agenda.trim(),
        isOpen: true,
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'AttendanceSession', targetId: newId,
        details: `Membuat sesi absensi: ${title} (${targetScope})`,
      });

      // NOTIFIKASI KE PESERTA
      try {
        const recipients = classStudents.filter(s => {
          if (s.role === 'Guru Pengampu' || s.role === 'Guru Pembina') return false;
          if (s.role === 'Admin' || s.role === 'Super Admin') return false;
          if (targetScope === 'SEMUA') return true;
          if (targetScope === 'PEMAIN_MUSIK') {
            return s.role === 'Pemeran' || s.divisionName === 'Tata Musik & Suara' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara';
          }
          if (targetScope === 'DIVISI') return s.divisionId === user.divisionId;
          return false;
        });

        const { writeBatch } = await import('firebase/firestore');
        const { doc, collection } = await import('firebase/firestore');
        const { db } = await import('../../core/firebase');
        const batch = writeBatch(db);
        
        let targetLabel = targetScope === 'SEMUA' ? 'Semua Anggota' : targetScope === 'PEMAIN_MUSIK' ? 'Pemain & Musik' : `Divisi ${user.divisionName}`;
        
        recipients.forEach(r => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: r.uid,
            classId: activeClass.id,
            title: 'Sesi Presensi Dibuka',
            message: `${user.displayName} membuka presensi: "${title.trim()}" untuk ${targetLabel}. Batas waktu: ${endTime}.`,
            category: 'Reminder',
            read: false,
            link: 'absensi',
            createdAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      } catch (err) {
        console.warn('Notif presensi gagal:', err);
      }

      showToast('Sesi presensi baru berhasil dibuka!', 'success');
      setIsCreatingSession(false);
      setTitle('');
      setAgenda('');
    } catch (err: any) {
      showToast('Gagal membuat sesi: ' + err.message, 'error');
    }
  };

  const handleCheckin = async () => {
    if (!user || !activeSession || !activeClass) return;
    
    const [eh, em] = activeSession.endTime.split(':').map(Number);
    const endDateTime = new Date(activeSession.date);
    endDateTime.setHours(eh || 0, em || 0, 0, 0);
    if (new Date() > endDateTime) {
      showToast('Waktu presensi sudah habis. Anda tidak bisa absen.', 'error');
      return;
    }

    setIsSubmittingCheckin(true);

    try {
      await submitAttendanceRecord({
        sessionId: activeSession.id,
        classId: activeClass.id,
        studentId: user.uid,
        studentName: user.displayName,
        role: user.role,
        divisionName: user.divisionName,
        status: myStatus,
        note: myNote.trim(),
        timestamp: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'AttendanceRecord', targetId: activeSession.id,
        details: `Mengisi presensi "${activeSession.title}": ${myStatus}`,
      });

      showToast(`Kehadiran Anda (${myStatus}) berhasil dicatat!`, 'success');
    } catch (err: any) {
      showToast('Gagal mengirim presensi: ' + err.message, 'error');
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  const canCreateAnySession = canCreateGeneralAttendance || canCreateRehearsalAttendance || canCreateDivisionAttendance;

  const targetParticipants = classStudents.filter(s => {
    if (!activeSession) return false;
    if (activeSession.targetScope === 'SEMUA') return true;
    if (activeSession.targetScope === 'PEMAIN_MUSIK') {
      return s.role === 'Pemeran' || s.divisionName === 'Tata Musik & Suara' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara';
    }
    if (activeSession.targetScope === 'DIVISI') return s.divisionId === activeSession.targetDivisionId;
    return true;
  });

  const myRecord = records.find(r => r.studentId === user?.uid);

  // FUNGSI FILTER UNTUK DAFTAR SESI
  const isForMe = (s: AttendanceSession) => {
    if (s.targetScope === 'SEMUA') return true;
    if (s.targetScope === 'PEMAIN_MUSIK') {
      return user?.role === 'Pemeran' || user?.divisionName === 'Tata Musik & Suara' || user?.role === 'Sutradara' || user?.role === 'Asisten Sutradara';
    }
    if (s.targetScope === 'DIVISI') return user?.divisionId === s.targetDivisionId;
    return false;
  };

  const filteredSessions = sessions.filter(s => {
    if (filterTab === 'MY_TASKS') return isForMe(s);
    if (filterTab === 'PEMAIN') return s.targetScope === 'PEMAIN_MUSIK';
    if (filterTab === 'DIVISI') return s.targetScope === 'DIVISI';
    if (filterTab === 'RAPAT') return s.activityType === 'Rapat';
    return true;
  });

  // FUNGSI HELPER BADGE
  const renderScopeBadge = (s: AttendanceSession) => {
    if (s.targetScope === 'PEMAIN_MUSIK') {
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1"><Users className="w-3 h-3" /> PEMAIN & MUSIK</span>;
    }
    if (s.targetScope === 'DIVISI') {
      return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> DIVISI {s.targetDivisionName?.toUpperCase()}</span>;
    }
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> SEMUA SISWA</span>;
  };

  return (
    <div className="space-y-6">
      {/* PANEL PANDUAN LENGKAP */}
      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
          <p className="font-bold text-sm mb-1">Panduan Cepat Presensi Digital</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Wajib isi waktu:</strong> Sesi akan <strong>tertutup otomatis</strong> saat jam selesai lewat.</li>
            <li><strong>Hak Akses Pembuatan:</strong> 
              <ul className="list-circle pl-4 mt-0.5 text-[11px]">
                <li><strong>Sutradara/Astrada:</strong> Khusus Pemain & Tata Musik.</li>
                <li><strong>Koordinator:</strong> Khusus anggota divisinya sendiri.</li>
                <li><strong>Produser/Sekretaris/Guru:</strong> Semua anggota.</li>
              </ul>
            </li>
            <li>Siswa tidak perlu diabsen manual. Siswa cukup klik tombol Hadir/Izin/Sakit di layar mereka.</li>
          </ul>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <UserCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Presensi & Absensi Digital
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isTeacherOrStaff ? 'Kelola sesi presensi & pantau kehadiran siswa' : 'Pencatatan kehadiran resmi per kegiatan'}
              </p>
            </div>
          </div>
        </div>

        {canCreateAnySession && (
          <button
            onClick={openCreateForm}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Sesi Presensi Baru</span>
          </button>
        )}
      </div>

      {/* FORM BUAT SESI */}
      {isCreatingSession && (
        <form onSubmit={handleCreateSession} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500/40 shadow-md space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Buka Sesi Presensi Baru</h3>
            <button type="button" onClick={() => setIsCreatingSession(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Sesi Kegiatan <span className="text-rose-500">*</span></label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Latihan Rutin Blocking Babak 2"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jenis Kegiatan</label>
              <select value={activityType} onChange={(e) => setActivityType(e.target.value as ScheduleType)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold">
                <option value="Latihan">Latihan</option>
                <option value="Rapat">Rapat</option>
                <option value="Gladi">Gladi Resik / Kotor</option>
                <option value="Produksi">Produksi Divisi</option>
                <option value="Fitting">Fitting Busana / Rias</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal <span className="text-rose-500">*</span></label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mulai <span className="text-rose-500">*</span></label>
              <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selesai <span className="text-rose-500">*</span></label>
              <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lokasi</label>
              <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold" />
            </div>
          </div>

          {/* PILIHAN SCOPE */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" /> Pilih Cakupan Peserta <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className={`flex items-start gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition ${targetScope === 'SEMUA' ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'} ${(!isGuruPengampu && !isAdminRole && !isPimprod && !isSekretaris && targetScope !== 'SEMUA') ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input type="radio" name="scope" value="SEMUA" checked={targetScope === 'SEMUA'} onChange={() => setTargetScope('SEMUA')} disabled={!isTeacherOrStaff && (isSutradara || isAsisten || isKoordinator)} className="mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Semua Anggota</p>
                  <p className="text-[10px] text-slate-500">Seluruh siswa di kelas</p>
                </div>
              </label>

              <label className={`flex items-start gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition ${targetScope === 'PEMAIN_MUSIK' ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'} ${(!isGuruPengampu && !isAdminRole && !isSutradara && !isAsisten) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input type="radio" name="scope" value="PEMAIN_MUSIK" checked={targetScope === 'PEMAIN_MUSIK'} onChange={() => setTargetScope('PEMAIN_MUSIK')} disabled={!isTeacherOrStaff && (isPimprod || isSekretaris || isKoordinator)} className="mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Pemain & Musik</p>
                  <p className="text-[10px] text-slate-500">Khusus akting & musik</p>
                </div>
              </label>

              <label className={`flex items-start gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition ${targetScope === 'DIVISI' ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'} ${(!isGuruPengampu && !isAdminRole && !isKoordinator) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input type="radio" name="scope" value="DIVISI" checked={targetScope === 'DIVISI'} onChange={() => setTargetScope('DIVISI')} disabled={!isTeacherOrStaff && !isKoordinator} className="mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Divisi Saja</p>
                  <p className="text-[10px] text-slate-500">{user?.divisionName || 'Divisi Anda'}</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Agenda / Catatan (Opsional)</label>
            <textarea rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Poin penting yang akan dibahas..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreatingSession(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Buka Sesi Presensi
            </button>
          </div>
        </form>
      )}

      {/* LIST & DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI: DAFTAR SESI DENGAN TAB FILTER */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Daftar Sesi</h3>
          </div>
          
          {/* TAB FILTER */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setFilterTab('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterTab === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Semua</button>
            <button onClick={() => setFilterTab('MY_TASKS')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterTab === 'MY_TASKS' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-amber-700 border border-amber-300'}`}>Untuk Saya</button>
            <button onClick={() => setFilterTab('PEMAIN')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterTab === 'PEMAIN' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Pemain</button>
            <button onClick={() => setFilterTab('DIVISI')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterTab === 'DIVISI' ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Divisi</button>
            <button onClick={() => setFilterTab('RAPAT')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterTab === 'RAPAT' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>Rapat</button>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-400">Tidak ada sesi presensi di tab ini.</div>
          ) : (
            filteredSessions.map(s => {
              const isSelected = s.id === activeSessionId;
              const [eh, em] = s.endTime.split(':').map(Number);
              const endDateTime = new Date(s.date); endDateTime.setHours(eh || 0, em || 0, 0, 0);
              const isExpired = new Date() > endDateTime;
              const isOpenUI = s.isOpen && !isExpired;

              return (
                <div key={s.id} onClick={() => setActiveSessionId(s.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${isSelected ? 'bg-amber-500/10 border-amber-400 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                  
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600 px-2 py-0.5 rounded-md bg-blue-50 text-[10px] uppercase">{s.activityType}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpenUI ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {isOpenUI ? 'Dibuka' : 'Ditutup / Habis'}
                      </span>
                    </div>
                    {/* BADGE SCOPE DITAMBAHKAN DI SINI */}
                    <div className="mt-1">{renderScopeBadge(s)}</div>
                  </div>

                  <p className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">{s.title}</p>
                  
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {s.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.startTime}-{s.endTime}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-2">Oleh: {s.creatorName} ({s.creatorRole})</p>
                </div>
              );
            })
          )}
        </div>

        {/* KOLOM KANAN: DETAIL & CHECK-IN */}
        <div className="lg:col-span-2 space-y-4">
          {activeSession ? (
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase">{activeSession.activityType}</span>
                    {renderScopeBadge(activeSession)}
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{activeSession.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {activeSession.location} • {activeSession.date} ({activeSession.startTime}-{activeSession.endTime})</p>
                </div>
                {(isTeacher || isGuruPengampu || isAdminRole) && activeSession.isOpen && (
                  <button onClick={async () => { await closeAttendanceSession(activeSession.id); showToast('Sesi ditutup.', 'info'); }}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition">Tutup Sesi Manual</button>
                )}
              </div>

              {activeSession.isOpen && !isTeacherOrStaff && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5"><UserCheck className="w-4 h-4" /> Formulir Kehadiran</span>
                    {myRecord && <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">Status: {myRecord.status}</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
                      <button key={st} type="button" onClick={() => setMyStatus(st)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition ${myStatus === st ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}`}>{st}</button>
                    ))}
                  </div>
                  {myStatus !== 'Hadir' && <input type="text" placeholder="Keterangan..." value={myNote} onChange={(e) => setMyNote(e.target.value)} className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium" />}
                  <div className="flex justify-end">
                    <button type="button" disabled={isSubmittingCheckin} onClick={handleCheckin} className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs disabled:opacity-50">{isSubmittingCheckin ? 'Menyimpan...' : 'Kirim Kehadiran Saya'}</button>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Daftar Peserta ({records.length} terisi dari {targetParticipants.length})</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr><th className="py-2.5 px-3">Nama</th><th className="py-2.5 px-3">Peran</th><th className="py-2.5 px-3 text-center">Status</th><th className="py-2.5 px-3">Waktu</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {targetParticipants.map(student => {
                        const rec = records.find(r => r.studentId === student.uid);
                        return (
                          <tr key={student.uid}>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{student.displayName}</td>
                            <td className="py-2.5 px-3 text-slate-500">{student.role}</td>
                            <td className="py-2.5 px-3 text-center">
                              {rec ? (
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${rec.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' : rec.status === 'Izin' ? 'bg-blue-100 text-blue-800' : rec.status === 'Sakit' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{rec.status}</span>
                              ) : <span className="text-[11px] text-slate-400 italic">Belum</span>}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-400">{rec ? new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">Pilih sesi presensi di sebelah kiri untuk melihat detail.</div>
          )}
        </div>
      </div>
    </div>
  );
};
