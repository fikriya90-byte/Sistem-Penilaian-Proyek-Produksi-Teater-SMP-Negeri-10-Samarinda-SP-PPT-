import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, Lock, MapPin, PlusCircle, UserCheck,
  Users, XCircle, X, Save, Info,
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

  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<ScheduleType>('Latihan');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [location, setLocation] = useState('Panggung Terbuka SMPN 10');
  const [agenda, setAgenda] = useState('');

  const [myStatus, setMyStatus] = useState<AttendanceStatus>('Hadir');
  const [myNote, setMyNote] = useState('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);

  // Apakah user adalah Guru/Pengurus (tidak isi presensi)
  const isTeacherOrStaff = isTeacher || isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeAttendanceSessions(activeClass.id, (sess) => {
      setSessions(sess);
      if (sess.length > 0 && !activeSessionId) setActiveSessionId(sess[0].id);
    });
    fetchUsersByClass(activeClass.id).then(u => setClassStudents(u));
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!activeSessionId) return;
    const unsub = subscribeAttendanceRecords(activeSessionId, (recs) => {
      setRecords(recs);
    });
    return () => unsub();
  }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const getCreatorScope = () => {
    if (isSutradara || isAsisten) {
      return { scope: 'PEMAIN_MUSIK' as const, label: 'Pemain + Tata Musik & Suara' };
    }
    if (isKoordinator) {
      return { scope: 'DIVISI' as const, label: `${user?.divisionName} (Anggota Divisi)` };
    }
    return { scope: 'SEMUA' as const, label: 'Semua Anggota Produksi' };
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim()) {
      showToast('Harap masukkan judul sesi presensi.', 'warning');
      return;
    }

    const { scope, label } = getCreatorScope();

    try {
      const newId = await createAttendanceSession({
        title: title.trim(),
        classId: activeClass.id,
        activityType,
        date,
        startTime,
        endTime,
        location: location.trim(),
        targetScope: scope,
        targetDivisionId: user.divisionId,
        targetDivisionName: user.divisionName,
        createdBy: user.uid,
        creatorRole: user.role,
        creatorName: user.displayName,
        agenda: agenda.trim(),
        isOpen: true,
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'AttendanceSession',
        targetId: newId,
        details: `Membuat sesi absensi: ${title} (${scope})`,
      });

      // === NOTIFIKASI KE PESERTA ===
      try {
        const recipients = classStudents.filter(s => {
          if (s.role === 'Guru Pengampu' || s.role === 'Guru Pembina') return false;
          if (s.role === 'Admin' || s.role === 'Super Admin') return false;
          if (scope === 'SEMUA') return true;
          if (scope === 'PEMAIN_MUSIK') {
            return s.role === 'Pemain' || s.divisionName === 'Tata Musik & Suara' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara';
          }
          if (scope === 'DIVISI') return s.divisionId === user.divisionId;
          return false;
        });

        const { writeBatch } = await import('firebase/firestore');
        const { doc, collection } = await import('firebase/firestore');
        const { db } = await import('../../core/firebase');
        const batch = writeBatch(db);
        recipients.forEach(r => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: r.uid,
            classId: activeClass.id,
            title: 'Sesi Presensi Baru',
            message: `${user.displayName} membuka: "${title.trim()}" (${label})`,
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

      showToast('Sesi absensi baru berhasil dibuka!', 'success');
      setIsCreatingSession(false);
      setTitle('');
      setAgenda('');
    } catch (err: any) {
      showToast('Gagal membuat sesi: ' + err.message, 'error');
    }
  };

  const handleCheckin = async () => {
    if (!user || !activeSession || !activeClass) return;
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
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'AttendanceRecord',
        targetId: activeSession.id,
        details: `Mengisi presensi "${activeSession.title}": ${myStatus}`,
      });

      // === NOTIFIKASI KE GURU ===
      try {
        await notifyTeachers(activeClass.id, {
          title: 'Presensi Siswa Baru',
          message: `${user.displayName} (${user.role}) mengisi presensi "${activeSession.title}" dengan status: ${myStatus}`,
          category: 'Sistem',
          link: 'absensi',
          senderName: user.displayName,
        });
      } catch (err) {
        console.warn('Notif guru gagal:', err);
      }

      showToast(`Kehadiran Anda (${myStatus}) berhasil dicatat!`, 'success');
    } catch (err: any) {
      showToast('Gagal mengirim presensi: ' + err.message, 'error');
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  const canCreateAnySession =
    canCreateGeneralAttendance || canCreateRehearsalAttendance || canCreateDivisionAttendance;

  const targetParticipants = classStudents.filter(s => {
    if (!activeSession) return false;
    if (activeSession.targetScope === 'SEMUA') return true;
    if (activeSession.targetScope === 'PEMAIN_MUSIK') {
      return s.role === 'Pemain' || s.divisionName === 'Tata Musik & Suara' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara';
    }
    if (activeSession.targetScope === 'DIVISI') {
      return s.divisionId === activeSession.targetDivisionId;
    }
    return true;
  });

  const myRecord = records.find(r => r.studentId === user?.uid);

  return (
    <div className="space-y-6">
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
                {isTeacherOrStaff
                  ? 'Kelola sesi presensi & pantau kehadiran siswa'
                  : 'Pencatatan kehadiran resmi per kegiatan latihan, rapat, dan produksi'}
              </p>
            </div>
          </div>
        </div>

        {canCreateAnySession && (
          <button
            onClick={() => setIsCreatingSession(!isCreatingSession)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Sesi Presensi Baru</span>
          </button>
        )}
      </div>

      {isCreatingSession && (
        <form onSubmit={handleCreateSession} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500/40 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Buka Sesi Presensi Baru
            </h3>
            <button type="button" onClick={() => setIsCreatingSession(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Sesi Kegiatan <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Latihan Rutin Blocking Babak 2"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jenis Kegiatan</label>
              <select value={activityType} onChange={(e) => setActivityType(e.target.value as ScheduleType)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                <option value="Latihan">Latihan</option>
                <option value="Rapat">Rapat</option>
                <option value="Gladi">Gladi Resik / Kotor</option>
                <option value="Produksi">Produksi Divisi</option>
                <option value="Fitting">Fitting Busana / Rias</option>
                <option value="Briefing">Briefing Singkat</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mulai</label>
              <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selesai</label>
              <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lokasi</label>
              <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Cakupan Peserta:
            </span>
            <span className="font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              {getCreatorScope().label}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Agenda / Catatan</label>
            <textarea rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)}
              placeholder="Poin penting yang akan dibahas..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreatingSession(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
            <button type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Buka Sesi Presensi
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Daftar Sesi Presensi</h3>

          {sessions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 dark:text-slate-500">
              Belum ada sesi presensi.
            </div>
          ) : (
            sessions.map(s => {
              const isSelected = s.id === activeSessionId;
              return (
                <div key={s.id} onClick={() => setActiveSessionId(s.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500/40 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/20">
                      {s.activityType}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.isOpen ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {s.isOpen ? 'Terbuka' : 'Ditutup'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">{s.title}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {s.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.startTime}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Oleh: {s.creatorName} ({s.creatorRole})
                  </p>
                </div>
              );
            })
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {activeSession ? (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                      {activeSession.activityType}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      {activeSession.date} - {activeSession.startTime}-{activeSession.endTime}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">{activeSession.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {activeSession.location}
                  </p>
                </div>

                {(isTeacher || isGuruPengampu || isAdminRole) && activeSession.isOpen && (
                  <button
                    onClick={async () => {
                      await closeAttendanceSession(activeSession.id);
                      showToast('Sesi presensi ditutup.', 'info');
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
                  >
                    Tutup Sesi
                  </button>
                )}
              </div>

              {/* ================================================== */}
              {/* FORM CHECK-IN UNTUK SISWA SAJA */}
              {/* ================================================== */}
              {activeSession.isOpen && !isTeacherOrStaff && (
                <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Formulir Kehadiran Mandiri
                    </span>
                    {myRecord && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                        Status: {myRecord.status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
                      <button key={st} type="button" onClick={() => setMyStatus(st)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                          myStatus === st
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}>
                        {st}
                      </button>
                    ))}
                  </div>

                  {myStatus !== 'Hadir' && (
                    <input type="text" placeholder="Keterangan..." value={myNote} onChange={(e) => setMyNote(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
                  )}

                  <div className="flex justify-end">
                    <button type="button" disabled={isSubmittingCheckin} onClick={handleCheckin}
                      className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs transition disabled:opacity-50">
                      {isSubmittingCheckin ? 'Menyimpan...' : 'Kirim Kehadiran Saya'}
                    </button>
                  </div>
                </div>
              )}

              {/* ================================================== */}
              {/* INFO PANEL UNTUK GURU / ADMIN — TIDAK PERLU ISI PRESENSI */}
              {/* ================================================== */}
              {activeSession.isOpen && isTeacherOrStaff && (
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                    <p className="font-bold">
                      Anda sebagai {user?.role} tidak perlu mengisi presensi.
                    </p>
                    <p className="text-[11px] mt-0.5">
                      Tugas Anda adalah <strong>membuka / menutup sesi</strong> dan <strong>memantau rekap kehadiran</strong> siswa di tabel bawah ini.
                      Untuk melihat statistik lengkap, buka menu <strong>Statistik Presensi</strong>.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Daftar Peserta ({records.length} terisi dari {targetParticipants.length})
                </h4>

                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Peran</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Waktu / Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {targetParticipants.map(student => {
                        const rec = records.find(r => r.studentId === student.uid);
                        return (
                          <tr key={student.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{student.displayName}</td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{student.role}</td>
                            <td className="py-2.5 px-3 text-center">
                              {rec ? (
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  rec.status === 'Hadir' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' :
                                  rec.status === 'Izin' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300' :
                                  rec.status === 'Sakit' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' :
                                  'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                                }`}>
                                  {rec.status}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Belum</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-400 dark:text-slate-500">
                              {rec ? (
                                <span>{new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {rec.note ? `- ${rec.note}` : ''}</span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs">
              Pilih salah satu sesi presensi untuk melihat rekap kehadiran.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};