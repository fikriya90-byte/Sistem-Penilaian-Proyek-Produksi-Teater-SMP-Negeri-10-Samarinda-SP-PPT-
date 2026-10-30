import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, CheckCircle, Clock, Lock, MapPin, PlusCircle, UserCheck,
  Users, XCircle, X, Save, Info, ShieldAlert, BookOpen, Filter, MessageCircle, Edit3,
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
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const isFirstLoad = useRef(true);

  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<ScheduleType>('Latihan');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [location, setLocation] = useState('Panggung Terbuka SMPN 10');
  const [targetScope, setTargetScope] = useState<'SEMUA' | 'PEMAIN_MUSIK' | 'DIVISI'>('SEMUA');
  const [attendanceMode, setAttendanceMode] = useState<'MANDIRI' | 'MANUAL'>('MANDIRI');

  const [myStatus, setMyStatus] = useState<AttendanceStatus>('Hadir');
  const [myNote, setMyNote] = useState('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);

  const isTeacherOrStaff = isTeacher || isGuruPengampu || isAdminRole || isPimprod || isSekretaris || isSutradara || isAsisten || isKoordinator;

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeAttendanceSessions(activeClass.id, (sess) => {
      const uniqueSessions = Array.from(new Map(sess.map(s => [s.id, s])).values());
      setSessions(uniqueSessions);
      if (uniqueSessions.length > 0 && isFirstLoad.current) {
        setActiveSessionId(uniqueSessions[0].id);
        isFirstLoad.current = false;
      }
    });
    fetchUsersByClass(activeClass.id).then(u => setClassStudents(u));
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!sessions.length) return;
    const checkExpiredSessions = () => {
      const now = new Date();
      sessions.forEach(session => {
        if (session.isOpen) {
          const [eh, em] = session.endTime.split(':').map(Number);
          const endDateTime = new Date(`${session.date}T${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`);
          if (now.getTime() > endDateTime.getTime()) closeAttendanceSession(session.id).catch(() => {});
        }
      });
    };
    const timer = setInterval(checkExpiredSessions, 60000);
    return () => clearInterval(timer);
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId) { setRecords([]); return; }
    const unsub = subscribeAttendanceRecords(activeSessionId, setRecords);
    return () => unsub();
  }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const myRecord = records.find(r => r.studentId === user?.uid);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || startTime >= endTime) return showToast('Periksa kembali jam dan judul.', 'warning');
    setIsSubmittingSession(true);
    try {
      const newId = await createAttendanceSession({
        title: title.trim(), classId: activeClass.id, activityType, date, startTime, endTime,
        location: location.trim(), targetScope, 
        targetDivisionId: targetScope === 'DIVISI' ? user.divisionId : '',
        targetDivisionName: targetScope === 'DIVISI' ? user.divisionName : '',
        createdBy: user.uid, creatorRole: user.role, creatorName: user.displayName,
        agenda: '', isOpen: true, attendanceMode
      } as any);
      showToast('Sesi presensi dibuka!', 'success');
      setIsCreatingSession(false);
    } catch (err: any) { showToast(err.message, 'error'); } 
    finally { setIsSubmittingSession(false); }
  };

  const handleCheckin = async () => {
    if (!user || !activeSession || !activeClass) return;
    setIsSubmittingCheckin(true);
    try {
      await submitAttendanceRecord({
        sessionId: activeSession.id, classId: activeClass.id, studentId: user.uid,
        studentName: user.displayName, role: user.role, divisionName: user.divisionName,
        status: myStatus, note: myNote.trim(), timestamp: new Date().toISOString(),
      });
      showToast('Kehadiran dicatat!', 'success');
    } catch (err: any) { showToast(err.message, 'error'); } 
    finally { setIsSubmittingCheckin(false); }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white border shadow-sm flex justify-between items-center">
        <h2 className="text-xl font-bold">Presensi Digital</h2>
        {(canCreateGeneralAttendance || isTeacher) && (
          <button onClick={() => setIsCreatingSession(true)} className="px-4 py-2 bg-amber-500 rounded-xl font-bold text-xs">Buat Sesi</button>
        )}
      </div>

      {isCreatingSession && (
        <form onSubmit={handleCreateSession} className="p-4 bg-white rounded-3xl border shadow-sm space-y-3">
          <input type="text" placeholder="Judul Sesi" value={title} onChange={e=>setTitle(e.target.value)} className="w-full border p-2 text-xs" required />
          <div className="flex gap-2">
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border p-2 text-xs" />
            <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="border p-2 text-xs" />
            <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="border p-2 text-xs" />
          </div>
          <button type="submit" disabled={isSubmittingSession} className="bg-amber-500 px-4 py-2 rounded font-bold text-xs">Simpan</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} onClick={() => setActiveSessionId(s.id)} className={`p-3 rounded-xl border cursor-pointer ${s.id===activeSessionId?'bg-amber-50':''}`}>
              <p className="text-sm font-bold">{s.title}</p>
              <p className="text-xs text-slate-500">{s.date}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {activeSession && (
            <div className="p-6 bg-white rounded-3xl border space-y-4">
              <h3 className="text-xl font-bold">{activeSession.title}</h3>
              {!myRecord && activeSession.isOpen && (
                <div className="p-4 bg-amber-50 rounded-xl">
                   <select onChange={e=>setMyStatus(e.target.value as any)} className="p-2 border rounded text-xs">
                     <option value="Hadir">Hadir</option><option value="Izin">Izin</option><option value="Sakit">Sakit</option>
                   </select>
                   <button onClick={handleCheckin} disabled={isSubmittingCheckin} className="ml-2 bg-slate-900 text-white px-4 py-2 rounded text-xs">Absen</button>
                </div>
              )}
              {myRecord && <p className="text-emerald-600 text-sm font-bold">Anda sudah absen: {myRecord.status}</p>}
              
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b"><th>Nama</th><th>Status</th></tr></thead>
                <tbody>
                  {classStudents.map(st => {
                    const rec = records.find(r => r.studentId === st.uid);
                    return <tr key={st.uid} className="border-b"><td className="p-2">{st.displayName}</td><td className="p-2">{rec ? rec.status : 'Belum'}</td></tr>
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};