import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, Lock, MapPin, PlusCircle, UserCheck,
  Users, XCircle, X, Save, Info, ShieldAlert, BookOpen, Filter, MessageCircle, Edit3
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import {
  AttendanceRecord, AttendanceSession, AttendanceStatus, ScheduleType, UserProfile,
} from '../../core/types';
import {
  closeAttendanceSession, createAttendanceSession, fetchUsersByClass,
  recordAuditLog, submitAttendanceRecord, subscribeAttendanceRecords,
  subscribeAttendanceSessions,
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../core/firebase';

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
  const [targetScope, setTargetScope] = useState<'SEMUA' | 'PEMAIN_MUSIK' | 'DIVISI'>('SEMUA');
  const [attendanceMode, setAttendanceMode] = useState<'MANDIRI' | 'MANUAL'>('MANDIRI');

  const [myStatus, setMyStatus] = useState<AttendanceStatus>('Hadir');
  const [myNote, setMyNote] = useState('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
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

  // AUTO-CLOSE OTOMATIS (Diperbaiki dengan zona waktu lokal)
  useEffect(() => {
    if (!sessions.length) return;
    const checkExpiredSessions = () => {
      const now = new Date();
      sessions.forEach(session => {
        if (session.isOpen) {
          const [eh, em] = session.endTime.split(':').map(Number);
          // Menggunakan new Date(`${date}T${time}`) agar terbaca sebagai waktu LOKAL (WITA)
          const endDateTime = new Date(`${session.date}T${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`);
          
          if (now.getTime() > endDateTime.getTime()) {
            console.log(`Auto-closing session ${session.id} because time is over.`);
            closeAttendanceSession(session.id).catch(() => {});
          }
        }
      });
    };
    const timer = setInterval(checkExpiredSessions, 60000); // Cek tiap 1 menit
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
    if (isSutradara || isAsisten) setTargetScope('PEMAIN_MUSIK');
    else if (isKoordinator && user?.divisionName) setTargetScope('DIVISI');
    else setTargetScope('SEMUA');
    setAttendanceMode('MANDIRI');
    setIsCreatingSession(true);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !startTime || !endTime) { showToast('Lengkapi judul dan jam!', 'warning'); return; }
    if (startTime >= endTime) { showToast('Jam Selesai harus lebih lambat.', 'warning'); return; }

    try {
      const newId = await createAttendanceSession({
        title: title.trim(),
        classId: activeClass.id,
        activityType, date, startTime, endTime,
        location: location.trim(),
        targetScope: targetScope,
        targetDivisionId: targetScope === 'DIVISI' ? user.divisionId : '',
        targetDivisionName: targetScope === 'DIVISI' ? user.divisionName : '',
        createdBy: user.uid,
        creatorRole: user.role,
        creatorName: user.displayName,
        agenda: agenda.trim(),
        isOpen: true,
        // @ts-ignore
        attendanceMode: attendanceMode
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'AttendanceSession', targetId: newId,
        details: `Membuat sesi absensi: ${title} (${attendanceMode})`,
      });

      // NOTIFIKASI (dipindah ke try-catch terpisah agar sesi tetap dibuat jika notif gagal)
      try {
        const recipients = classStudents.filter(s => {
          if (s.role === 'Guru Pengampu' || s.role === 'Admin' || s.role === 'Super Admin') return false;
          if (targetScope === 'SEMUA') return true;
          if (targetScope === 'PEMAIN_MUSIK') return s.role === 'Pemeran' || s.divisionName === 'Tata Musik & Suara';
          if (targetScope === 'DIVISI') return s.divisionId === user.divisionId;
          return false;
        });

        const batch = writeBatch(db);
        recipients.forEach(r => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id, userId: r.uid, classId: activeClass.id,
            title: 'Sesi Presensi Dibuka',
            message: `${user.displayName} membuka presensi: "${title.trim()}". Batas: ${endTime}.`,
            category: 'Reminder', read: false, link: 'absensi', createdAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      } catch (notifErr) {
        console.warn('Gagal kirim notifikasi:', notifErr);
      }

      showToast('Sesi presensi berhasil dibuka!', 'success');
      setIsCreatingSession(false);
      setTitle(''); setAgenda('');
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat sesi presensi', 'error');
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
      showToast(`Kehadiran Anda (${myStatus}) berhasil dicatat!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mencatat kehadiran', 'error');
    } finally { setIsSubmittingCheckin(false); }
  };

  const handleEditStatusManual = async (studentId: string, studentName: string, newStatus: AttendanceStatus) => {
    if (!user || !activeSession || !activeClass) return;
    const isCreator = activeSession.createdBy === user.uid;
    if (!isTeacherOrStaff && !isCreator) {
      showToast('Hanya pembuat sesi atau guru yang bisa mengedit manual.', 'warning');
      return;
    }
    try {
      await submitAttendanceRecord({
        sessionId: activeSession.id, classId: activeClass.id,
        studentId, studentName,
        role: classStudents.find(s => s.uid === studentId)?.role || 'Pemeran',
        status: newStatus, note: `Diedit oleh ${user.displayName}`,
        timestamp: new Date().toISOString(),
      });
      showToast(`Status ${studentName} diubah ke ${newStatus}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal edit status', 'error');
    }
  };

  const handleShareWA = () => {
    if (!activeSession) return;
    const text = `*PRESENSI: ${activeSession.title}*\n\nHari/Tgl: ${activeSession.date}\nWaktu: ${activeSession.startTime} - ${activeSession.endTime}\nLokasi: ${activeSession.location}\n\nMohon segera isi presensi di web SP-PPT sebelum waktu habis. Terima kasih.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const canCreateAnySession = canCreateGeneralAttendance || canCreateRehearsalAttendance || canCreateDivisionAttendance;
  const targetParticipants = classStudents.filter(s => {
    if (!activeSession) return false;
    if (activeSession.targetScope === 'SEMUA') return true;
    if (activeSession.targetScope === 'PEMAIN_MUSIK') return s.role === 'Pemeran' || s.divisionName === 'Tata Musik & Suara' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara';
    if (activeSession.targetScope === 'DIVISI') return s.divisionId === activeSession.targetDivisionId;
    return true;
  });

  const isForMe = (s: AttendanceSession) => s.targetScope === 'SEMUA' || (s.targetScope === 'PEMAIN_MUSIK' && (user?.role === 'Pemeran' || user?.divisionName === 'Tata Musik & Suara')) || (s.targetScope === 'DIVISI' && user?.divisionId === s.targetDivisionId);
  const filteredSessions = sessions.filter(s => {
    if (filterTab === 'MY_TASKS') return isForMe(s);
    if (filterTab === 'PEMAIN') return s.targetScope === 'PEMAIN_MUSIK';
    if (filterTab === 'DIVISI') return s.targetScope === 'DIVISI';
    if (filterTab === 'RAPAT') return s.activityType === 'Rapat';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER & FORM SAMA SEPERTI SEBELUMNYA */}
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="text-xs text-rose-900 leading-relaxed">
          <p className="font-bold text-sm mb-1">Perhatian: Presensi Masuk Akumulasi Nilai!</p>
          <p>Kehadiran Anda di sesi ini sangat mempengaruhi nilai rapor (Kedisiplinan & Kehadiran). Siswa yang tidak mengisi tanpa keterangan akan dianggap Alpa.</p>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600"><UserCheck className="w-6 h-6" /></span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Presensi & Absensi Digital</h2>
            <p className="text-xs text-slate-500 font-medium">Pencatatan kehadiran resmi per kegiatan</p>
          </div>
        </div>
        {canCreateAnySession && (
          <button onClick={openCreateForm} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm">
            <PlusCircle className="w-4 h-4" /> Buat Sesi Presensi
          </button>
        )}
      </div>

      {isCreatingSession && (
        <form onSubmit={handleCreateSession} className="p-6 rounded-3xl bg-white border-2 border-amber-300 shadow-md space-y-4">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="font-extrabold text-sm">Buka Sesi Presensi Baru</h3>
            <button type="button" onClick={() => setIsCreatingSession(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold mb-1">Judul Sesi *</label><input type="text" required value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs" /></div>
            <div><label className="block text-xs font-bold mb-1">Jenis</label><select value={activityType} onChange={e=>setActivityType(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border text-xs"><option value="Latihan">Latihan</option><option value="Rapat">Rapat</option><option value="Gladi">Gladi</option></select></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="block text-xs font-bold mb-1">Tanggal</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs" /></div>
            <div><label className="block text-xs font-bold mb-1">Mulai</label><input type="time" required value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs" /></div>
            <div><label className="block text-xs font-bold mb-1">Selesai</label><input type="time" required value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs" /></div>
            <div><label className="block text-xs font-bold mb-1">Lokasi</label><input type="text" required value={location} onChange={e=>setLocation(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-xs" /></div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
            <div>
              <label className="block text-xs font-bold mb-1">Target Peserta</label>
              <select value={targetScope} onChange={e=>setTargetScope(e.target.value as any)} className="w-full px-2 py-1.5 rounded-lg border text-xs">
                <option value="SEMUA">Semua Siswa</option>
                <option value="PEMAIN_MUSIK">Pemain & Musik</option>
                <option value="DIVISI">Divisi Saya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-rose-600">Metode Presensi</label>
              <select value={attendanceMode} onChange={e=>setAttendanceMode(e.target.value as any)} className="w-full px-2 py-1.5 rounded-lg border text-xs">
                <option value="MANDIRI">Siswa Mengisi Sendiri</option>
                <option value="MANUAL">Pengurus Mengabsenkan</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreatingSession(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 font-bold text-xs"><Save className="w-3.5 h-3.5 inline" /> Buka Sesi</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={()=>setFilterTab('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filterTab==='ALL'?'bg-slate-900 text-white':'bg-white border'}`}>Semua</button>
            <button onClick={()=>setFilterTab('MY_TASKS')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filterTab==='MY_TASKS'?'bg-amber-500 text-slate-950':'bg-white border'}`}>Untuk Saya</button>
          </div>
          {filteredSessions.map(s => (
            <div key={s.id} onClick={() => setActiveSessionId(s.id)} className={`p-4 rounded-2xl border cursor-pointer ${s.id===activeSessionId?'bg-amber-50 border-amber-400':'bg-white'}`}>
              <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold bg-blue-100 px-2 py-0.5 rounded uppercase">{s.activityType}</span></div>
              <p className="text-xs font-bold mt-2">{s.title}</p>
              <p className="text-[10px] text-slate-500">{s.date} • {s.startTime}-{s.endTime}</p>
              {s.isOpen ? <span className="text-[9px] font-bold text-emerald-600 mt-1 block">● Sesi Dibuka</span> : <span className="text-[9px] font-bold text-slate-400 mt-1 block">○ Sesi Ditutup</span>}
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {activeSession ? (
            <div className="p-6 rounded-3xl bg-white border shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row justify-between pb-4 border-b gap-3">
                <div>
                  <h3 className="text-xl font-black">{activeSession.title}</h3>
                  <p className="text-xs text-slate-500">{activeSession.location} • {activeSession.date}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleShareWA} className="px-3 py-1.5 rounded-lg bg-green-500 text-white font-bold text-xs flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Share WA</button>
                  {(isTeacherOrStaff || activeSession.createdBy === user?.uid) && activeSession.isOpen && (
                    <button onClick={async () => { await closeAttendanceSession(activeSession.id); showToast('Sesi ditutup.', 'info'); }} className="px-3 py-1.5 rounded-lg border text-xs font-bold">Tutup Sesi</button>
                  )}
                </div>
              </div>

              {activeSession.isOpen && !isTeacherOrStaff && (activeSession as any).attendanceMode !== 'MANUAL' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-bold mb-2">Formulir Kehadiran Mandiri</p>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map(st => (
                      <button key={st} onClick={() => setMyStatus(st)} className={`py-2 rounded-xl text-xs font-bold ${myStatus===st?'bg-amber-500 text-slate-950':'bg-white border'}`}>{st}</button>
                    ))}
                  </div>
                  {myStatus !== 'Hadir' && <input type="text" placeholder="Alasan..." value={myNote} onChange={e=>setMyNote(e.target.value)} className="w-full mt-2 px-3 py-1.5 rounded-lg border text-xs" />}
                  <button onClick={handleCheckin} disabled={isSubmittingCheckin} className="mt-3 w-full py-2 bg-slate-900 text-white rounded-xl font-bold text-xs">Kirim Kehadiran Saya</button>
                </div>
              )}

              <div>
                <h4 className="text-xs font-extrabold uppercase mb-2">Daftar Peserta ({records.length}/{targetParticipants.length})</h4>
                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b"><tr><th className="py-2 px-3">Nama</th><th className="py-2 px-3 text-center">Status</th><th className="py-2 px-3 text-right">Aksi (Manual)</th></tr></thead>
                    <tbody className="divide-y">
                      {targetParticipants.map(st => {
                        const rec = records.find(r => r.studentId === st.uid);
                        const canEdit = isTeacherOrStaff || activeSession.createdBy === user?.uid;
                        return (
                          <tr key={st.uid}>
                            <td className="py-2 px-3 font-semibold">{st.displayName}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rec?.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' : rec ? 'bg-rose-100 text-rose-800' : 'bg-slate-100'}`}>{rec ? rec.status : 'Belum'}</span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {canEdit ? (
                                <select 
                                  value={rec?.status || ''} 
                                  onChange={(e) => handleEditStatusManual(st.uid, st.displayName, e.target.value as AttendanceStatus)}
                                  className="px-2 py-1 border rounded text-[10px] bg-white font-bold text-blue-600 focus:outline-none"
                                >
                                  <option value="" disabled>Edit Status</option>
                                  <option value="Hadir">Set Hadir</option>
                                  <option value="Izin">Set Izin</option>
                                  <option value="Sakit">Set Sakit</option>
                                  <option value="Alpa">Set Alpa</option>
                                </select>
                              ) : <span className="text-[10px] text-slate-400">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border">Pilih sesi presensi.</div>}
        </div>
      </div>
    </div>
  );
};