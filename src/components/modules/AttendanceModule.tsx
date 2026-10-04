import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle,
  Clock,
  Lock,
  MapPin,
  PlusCircle,
  UserCheck,
  Users,
  XCircle
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { AttendanceRecord, AttendanceSession, AttendanceStatus, ScheduleType, UserProfile } from '../../core/types';
import {
  closeAttendanceSession,
  createAttendanceSession,
  fetchUsersByClass,
  recordAuditLog,
  submitAttendanceRecord,
  subscribeAttendanceRecords,
  subscribeAttendanceSessions
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const AttendanceModule: React.FC = () => {
  const {
    user,
    activeClass,
    isTeacher,
    isPimprod,
    isSekretaris,
    isSutradara,
    isAsisten,
    isKoordinator,
    canCreateGeneralAttendance,
    canCreateRehearsalAttendance,
    canCreateDivisionAttendance
  } = useAuth();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // New session form
  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<ScheduleType>('Latihan');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [location, setLocation] = useState('Panggung Terbuka SMPN 10');
  const [agenda, setAgenda] = useState('');

  // Check-in state
  const [myStatus, setMyStatus] = useState<AttendanceStatus>('Hadir');
  const [myNote, setMyNote] = useState('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeAttendanceSessions(activeClass.id, (sess) => {
      setSessions(sess);
      if (sess.length > 0 && !activeSessionId) {
        setActiveSessionId(sess[0].id);
      }
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

  // Determine allowed participants for creator role
  const getCreatorScope = () => {
    if (isSutradara || isAsisten) {
      return { scope: 'PEMAIN_MUSIK' as const, label: 'Pemeran + Tata Musik & Suara (Terkunci Otomatis)' };
    }
    if (isKoordinator) {
      return { scope: 'DIVISI' as const, label: `${user?.divisionName} (Terkunci ke Anggota Divisi)` };
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

    const { scope } = getCreatorScope();

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

      showToast(`Kehadiran Anda (${myStatus}) berhasil dicatat!`, 'success');
    } catch (err: any) {
      showToast('Gagal mengirim presensi: ' + err.message, 'error');
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  const canCreateAnySession =
    canCreateGeneralAttendance || canCreateRehearsalAttendance || canCreateDivisionAttendance;

  // Filter participants relevant to this session
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
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <UserCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Presensi & Absensi Digital Terkendali
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Pencatatan kehadiran resmi per kegiatan latihan, rapat, dan produksi
              </p>
            </div>
          </div>
        </div>

        {canCreateAnySession && (
          <button
            onClick={() => setIsCreatingSession(!isCreatingSession)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Sesi Presensi Baru</span>
          </button>
        )}
      </div>

      {/* Create Session Form Drawer/Box */}
      {isCreatingSession && (
        <form onSubmit={handleCreateSession} className="p-6 rounded-3xl bg-white border border-amber-300 shadow-md space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900">
              Buka Sesi Presensi Baru
            </h3>
            <button
              type="button"
              onClick={() => setIsCreatingSession(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Judul Sesi Kegiatan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Latihan Rutin Blocking Babak 2"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jenis Kegiatan
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ScheduleType)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
              >
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mulai</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Selesai</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Panggung Terbuka"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* Locked participant banner according to role */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              Cakupan Peserta:
            </span>
            <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              {getCreatorScope().label}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Agenda / Catatan Khusus</label>
            <textarea
              rows={2}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Catatan poin penting yang akan dibahas atau dilatih..."
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingSession(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
            >
              Buka Sesi Presensi
            </button>
          </div>
        </form>
      )}

      {/* Main Grid: Sessions List & Active Session Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Sessions List */}
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-800">Daftar Sesi Presensi</h3>
          
          {sessions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-400">
              Belum ada sesi presensi yang dibuat.
            </div>
          ) : (
            sessions.map(s => {
              const isSelected = s.id === activeSessionId;

              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-blue-600 px-2 py-0.5 rounded-md bg-blue-50">
                      {s.activityType}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.isOpen ? 'Sesi Terbuka' : 'Ditutup'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{s.title}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {s.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {s.startTime}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Oleh: {s.creatorName} ({s.creatorRole})
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Active Session Roll Call & Student Check-in */}
        <div className="lg:col-span-2 space-y-4">
          {activeSession ? (
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
              
              {/* Session Meta Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      {activeSession.activityType}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {activeSession.date} • {activeSession.startTime} - {activeSession.endTime} WITA
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-1">{activeSession.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {activeSession.location}
                  </p>
                </div>

                {isTeacher && activeSession.isOpen && (
                  <button
                    onClick={async () => {
                      await closeAttendanceSession(activeSession.id);
                      showToast('Sesi presensi resmi ditutup.', 'info');
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Tutup Sesi
                  </button>
                )}
              </div>

              {/* Student Self Check-in Banner */}
              {activeSession.isOpen && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-600" /> Formulir Kehadiran Mandiri Anda
                    </span>
                    {myRecord && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Status Saat Ini: {myRecord.status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setMyStatus(st)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          myStatus === st
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {myStatus !== 'Hadir' && (
                    <input
                      type="text"
                      placeholder="Keterangan izin atau sakit..."
                      value={myNote}
                      onChange={(e) => setMyNote(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                    />
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isSubmittingCheckin}
                      onClick={handleCheckin}
                      className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition disabled:opacity-50"
                    >
                      {isSubmittingCheckin ? 'Menyimpan...' : 'Kirim Kehadiran Saya'}
                    </button>
                  </div>
                </div>
              )}

              {/* Attendance Table Recap for this session */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Daftar Presensi Peserta ({records.length} terisi dari {targetParticipants.length})
                </h4>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Peran</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Waktu / Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {targetParticipants.map(student => {
                        const rec = records.find(r => r.studentId === student.uid);

                        return (
                          <tr key={student.uid} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {student.displayName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {student.role}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {rec ? (
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  rec.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                                  rec.status === 'Izin' ? 'bg-blue-100 text-blue-800' :
                                  rec.status === 'Sakit' ? 'bg-amber-100 text-amber-800' :
                                  'bg-rose-100 text-rose-800'
                                }`}>
                                  {rec.status}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Belum Mengisi</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-400">
                              {rec ? (
                                <span>{new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {rec.note ? `• ${rec.note}` : ''}</span>
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
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              Pilih salah satu sesi presensi untuk melihat rekap kehadiran.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
