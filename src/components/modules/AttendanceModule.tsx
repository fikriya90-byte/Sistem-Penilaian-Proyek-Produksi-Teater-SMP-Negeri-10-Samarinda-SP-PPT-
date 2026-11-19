// src/components/modules/AttendanceModule.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Plus, X, CheckCircle, Clock, Users, Calendar,
  Loader2, Lock, Unlock, UserCheck, AlertTriangle, BarChart3,
  Filter, Search, ChevronDown, ChevronRight, Save, Trash2,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { UserProfile, AttendanceSession, AttendanceRecord } from '../../core/types';
import {
  subscribeAttendanceSessions,
  subscribeAllAttendanceRecords,
  subscribeAttendanceRecords,
  createAttendanceSession,
  closeAttendanceSession,
  submitAttendanceRecord,
  bulkFillAttendance,
  fetchUsersByClass,
  recordAuditLog,
} from '../../services/firestoreService';
import {
  canCreateGeneralSession,
  canCreateRehearsalSession,
  canCreateDivisionSession,
  canFillOnBehalf,
  filterSessionsForUser,
  getAttendanceRoster,
  summarizeAttendance,
} from '../../services/attendanceService';

// ================================================
// KONFIG
// ================================================
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Hadir: { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  Izin:  { bg: 'bg-amber-500',   text: 'text-white', border: 'border-amber-600' },
  Sakit: { bg: 'bg-blue-500',    text: 'text-white', border: 'border-blue-600' },
  Alpa:  { bg: 'bg-rose-500',    text: 'text-white', border: 'border-rose-600' },
  BELUM: { bg: 'bg-slate-200',   text: 'text-slate-600', border: 'border-slate-300' },
};

const ACTIVITY_TYPES = [
  'Rapat', 'Latihan', 'Gladi', 'Pementasan', 'Briefing', 'Evaluasi',
] as const;

const TARGET_SCOPES = [
  { id: 'SEMUA', label: 'Semua Siswa' },
  { id: 'PEMAIN_MUSIK', label: 'Pemeran + Musik' },
  { id: 'PENGURUS_INTI', label: 'Pengurus Inti' },
  { id: 'DIVISI', label: 'Per Divisi' },
  { id: 'PERAN', label: 'Per Peran' },
] as const;

const DIVISIONS = [
  'Pengurus Inti', 'Pemeran', 'Perlengkapan', 'Publikasi & Dokumentasi',
  'Tata Panggung', 'Tata Rias', 'Tata Busana', 'Tata Musik & Suara',
];

const STAGES = ['PERSIAPAN', 'PELAKSANAAN', 'PERTUNJUKAN', 'PASCA'] as const;

const ROLES_LIST = [
  'Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Sutradara',
  'Asisten Sutradara', 'Pemeran',
  'Koordinator Perlengkapan', 'Koordinator Publikasi',
  'Koordinator Tata Panggung', 'Koordinator Tata Rias',
  'Koordinator Tata Busana', 'Koordinator Tata Musik',
  'Anggota Perlengkapan', 'Anggota Publikasi',
  'Anggota Tata Panggung', 'Anggota Tata Rias',
  'Anggota Tata Busana', 'Anggota Tata Musik',
];

// ================================================
// KOMPONEN UTAMA
// ================================================
export const AttendanceModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<'ALL' | typeof STAGES[number]>('ALL');
  const [filterOpen, setFilterOpen] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Create form
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formActivityType, setFormActivityType] = useState<typeof ACTIVITY_TYPES[number]>('Latihan');
  const [formStage, setFormStage] = useState<typeof STAGES[number]>('PELAKSANAAN');
  const [formScope, setFormScope] = useState<typeof TARGET_SCOPES[number]['id']>('SEMUA');
  const [formDivision, setFormDivision] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Detail modal state
  const [detailSession, setDetailSession] = useState<AttendanceSession | null>(null);
  const [detailRecords, setDetailRecords] = useState<AttendanceRecord[]>([]);
  const [fillMode, setFillMode] = useState<'SELF' | 'ON_BEHALF'>('SELF');
  const [bulkEntries, setBulkEntries] = useState<Record<string, 'Hadir' | 'Izin' | 'Sakit' | 'Alpa'>>({});
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const role = user?.role || '';
  const canCreate =
    canCreateGeneralSession(role) ||
    canCreateRehearsalSession(role) ||
    canCreateDivisionSession(role);
  const canOnBehalf = canFillOnBehalf(role);

  // ================================================
  // SUBSCRIPTIONS
  // ================================================
  useEffect(() => {
    if (!activeClass) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const u1 = subscribeAttendanceSessions(activeClass.id, list => {
      setSessions(list);
      setLoading(false);
    });
    const u2 = subscribeAllAttendanceRecords(activeClass.id, setAllRecords);
    fetchUsersByClass(activeClass.id).then(setUsers);
    return () => { u1(); u2(); };
  }, [activeClass]);

  // Subscribe records untuk detail session
  useEffect(() => {
    if (!detailSession) { setDetailRecords([]); return; }
    const unsub = subscribeAttendanceRecords(detailSession.id, setDetailRecords);
    return () => unsub();
  }, [detailSession?.id]);

  // ================================================
  // HANDLERS
  // ================================================
  const openCreate = () => {
    setFormTitle('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormActivityType('Latihan');
    setFormStage('PELAKSANAAN');
    setFormScope('SEMUA');
    setFormDivision('');
    setFormRole('');
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !formTitle.trim()) {
      showToast('Judul sesi wajib diisi.', 'warning');
      return;
    }
    if (formScope === 'DIVISI' && !formDivision) {
      showToast('Pilih divisi tujuan.', 'warning');
      return;
    }
    if (formScope === 'PERAN' && !formRole) {
      showToast('Pilih peran tujuan.', 'warning');
      return;
    }

    // Validasi role boleh buat sesi ini
    if (formScope === 'PEMAIN_MUSIK' && !canCreateRehearsalSession(role)) {
      showToast('Anda tidak berhak membuat sesi latihan.', 'error');
      return;
    }
    if (formScope === 'DIVISI' && !canCreateDivisionSession(role)) {
      showToast('Anda tidak berhak membuat sesi divisi.', 'error');
      return;
    }
    if (formScope === 'SEMUA' && !canCreateGeneralSession(role)) {
      showToast('Anda tidak berhak membuat sesi umum.', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      await createAttendanceSession({
        classId: activeClass.id,
        title: formTitle.trim(),
        date: formDate,
        activityType: formActivityType,
        stage: formStage,
        targetScope: formScope as any,
        targetDivision: formScope === 'DIVISI' ? formDivision : undefined,
        targetRole: formScope === 'PERAN' ? formRole : undefined,
        isOpen: true,
      } as any, { uid: user.uid, displayName: user.displayName, role: user.role });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'AttendanceSession', targetId: activeClass.id,
        details: `Buat sesi presensi: ${formTitle} (${formScope})`,
      });

      showToast('Sesi presensi dibuat!', 'success');
      setIsCreateOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCloseSession = async (session: AttendanceSession) => {
    if (!confirm(
      `Tutup sesi "${session.title}"?\n\n` +
      `Siswa yang belum mengisi akan OTOMATIS ditandai ALPA.\n` +
      `(Hanya siswa yang menjadi target sesi ini.)`
    )) return;
    setClosingId(session.id);
    try {
      const result = await closeAttendanceSession(session.id);
      showToast(
        `✅ Sesi ditutup. ${result.autoMarked}/${result.expectedCount} siswa otomatis ALPA.`,
        'success'
      );
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setClosingId(null);
    }
  };

  const handleSubmitSelf = async (session: AttendanceSession, status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa') => {
    if (!user || !activeClass) return;
    try {
      await submitAttendanceRecord({
        sessionId: session.id,
        studentId: user.uid,
        studentName: user.displayName,
        classId: activeClass.id,
        status,
      });
      showToast(`Absen tercatat: ${status}`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleBulkSave = async (session: AttendanceSession) => {
    if (!user) return;
    const roster = getAttendanceRoster(session, users, detailRecords);
    const entries = roster
      .map(({ student }) => {
        const status = bulkEntries[student.uid];
        if (!status) return null;
        return { studentId: student.uid, studentName: student.displayName, status };
      })
      .filter(Boolean) as Array<{ studentId: string; studentName: string; status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa' }>;

    if (entries.length === 0) {
      showToast('Pilih status minimal 1 siswa.', 'warning');
      return;
    }

    setBulkSubmitting(true);
    try {
      const result = await bulkFillAttendance(
        session.id,
        { uid: user.uid, displayName: user.displayName, role: user.role },
        entries
      );
      if (result.errors.length > 0) {
        showToast(`${result.filled} tersimpan, ${result.errors.length} gagal.`, 'warning');
      } else {
        showToast(`✅ ${result.filled} absen tersimpan.`, 'success');
      }
      setBulkEntries({});
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // ================================================
  // DERIVED DATA
  // ================================================
  const mySessions = useMemo(() => filterSessionsForUser(sessions, user), [sessions, user]);

  const filteredSessions = useMemo(() => {
    return mySessions.filter(s => {
      if (filterStage !== 'ALL') {
        const sStage = (s as any).stage;
        if (sStage && sStage !== filterStage) return false;
      }
      if (filterOpen === 'OPEN' && !s.isOpen) return false;
      if (filterOpen === 'CLOSED' && s.isOpen) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return s.title.toLowerCase().includes(q) ||
          ((s as any).activityType || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [mySessions, filterStage, filterOpen, searchQuery]);

  // ================================================
  // RENDER
  // ================================================
  if (!activeClass) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Pilih kelas aktif terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-800 to-indigo-900 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Presensi</span>
            <h2 className="text-2xl font-black mt-1">Presensi & Kehadiran</h2>
            <p className="text-xs opacity-90 mt-1">
              {canCreate ? 'Buat sesi, isi manual, atau tutup sesi kapan saja' : 'Isi kehadiran Anda di sesi yang tersedia'}
            </p>
          </div>
          {canCreate && (
            <button
              onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" /> Buat Sesi Baru
            </button>
          )}
        </div>
      </div>

      {/* FILTER */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari sesi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
          />
        </div>
        <select
          value={filterStage}
          onChange={e => setFilterStage(e.target.value as any)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
        >
          <option value="ALL">Semua Tahap</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterOpen}
          onChange={e => setFilterOpen(e.target.value as any)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
        >
          <option value="ALL">Semua Status</option>
          <option value="OPEN">Terbuka</option>
          <option value="CLOSED">Ditutup</option>
        </select>
      </div>

      {/* SESSION LIST */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-500" />
          <p className="text-xs text-slate-400">Memuat sesi presensi...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Sesi Presensi</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canCreate ? 'Klik "Buat Sesi Baru" untuk memulai.' : 'Tunggu guru/pimpro membuat sesi.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map(s => {
            const sessionRecords = allRecords.filter(r => r.sessionId === s.id);
            const summary = {
              hadir: sessionRecords.filter(r => r.status === 'Hadir').length,
              izin: sessionRecords.filter(r => r.status === 'Izin').length,
              sakit: sessionRecords.filter(r => r.status === 'Sakit').length,
              alpa: sessionRecords.filter(r => r.status === 'Alpa').length,
            };
            const myRecord = user ? sessionRecords.find(r => r.studentId === user.uid) : null;
            return (
              <div key={s.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    s.isOpen
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}>
                    {s.isOpen ? '🟢 TERBUKA' : '🔒 DITUTUP'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                    {(s as any).activityType || 'Latihan'}
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-2">
                  {s.title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(s.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>

                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10">
                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">H</p>
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-200">{summary.hadir}</p>
                  </div>
                  <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-500/10">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">I</p>
                    <p className="text-xs font-black text-amber-800 dark:text-amber-200">{summary.izin}</p>
                  </div>
                  <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-500/10">
                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">S</p>
                    <p className="text-xs font-black text-blue-800 dark:text-blue-200">{summary.sakit}</p>
                  </div>
                  <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-500/10">
                    <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300">A</p>
                    <p className="text-xs font-black text-rose-800 dark:text-rose-200">{summary.alpa}</p>
                  </div>
                </div>

                {/* Mode SELF: tombol langsung */}
                {s.isOpen && !canOnBehalf && user && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    {myRecord ? (
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Status Anda</p>
                        <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold ${STATUS_COLORS[myRecord.status]?.bg} ${STATUS_COLORS[myRecord.status]?.text}`}>
                          {myRecord.status}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1">
                        {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => handleSubmitSelf(s, st)}
                            className={`py-1.5 rounded-md text-[10px] font-bold ${STATUS_COLORS[st].bg} ${STATUS_COLORS[st].text}`}
                          >
                            {st === 'Hadir' ? 'H' : st === 'Izin' ? 'I' : st === 'Sakit' ? 'S' : 'A'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                  <button
                    onClick={() => { setDetailSession(s); setFillMode('SELF'); setBulkEntries({}); }}
                    className="flex-1 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                  >
                    <Users className="w-3 h-3" /> Detail
                  </button>
                  {canCreate && s.isOpen && (
                    <button
                      onClick={() => handleCloseSession(s)}
                      disabled={closingId === s.id}
                      className="py-1.5 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {closingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                      Tutup
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================
          MODAL: CREATE SESSION
      ================================================ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleCreate}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" /> Buat Sesi Presensi
              </h3>
              <button type="button" onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Sesi *</label>
              <input type="text" required value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Contoh: Latihan Babak 1"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal</label>
                <input type="date" value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jenis Kegiatan</label>
                <select value={formActivityType}
                  onChange={e => setFormActivityType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tahap</label>
              <select value={formStage}
                onChange={e => setFormStage(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Peserta</label>
              <select value={formScope}
                onChange={e => setFormScope(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                {TARGET_SCOPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            {formScope === 'DIVISI' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Divisi</label>
                <select value={formDivision}
                  onChange={e => setFormDivision(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  <option value="">— Pilih divisi —</option>
                  {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {formScope === 'PERAN' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Peran</label>
                <select value={formRole}
                  onChange={e => setFormRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  <option value="">— Pilih peran —</option>
                  {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={formSubmitting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {formSubmitting ? 'Menyimpan...' : 'Buat Sesi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================
          MODAL: DETAIL SESSION
      ================================================ */}
      {detailSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2.5 rounded-xl bg-white/20">
                    <ClipboardList className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase opacity-90">Detail Presensi</p>
                    <h3 className="text-base font-black truncate">{detailSession.title}</h3>
                  </div>
                </div>
                <button onClick={() => setDetailSession(null)}
                  className="p-1.5 rounded-lg hover:bg-white/20 shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Toggle mode — hanya kalau user berhak on-behalf dan session terbuka */}
              {canOnBehalf && detailSession.isOpen && (
                <div className="flex gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    onClick={() => setFillMode('SELF')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                      fillMode === 'SELF'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    ✋ Isi Sendiri
                  </button>
                  <button
                    onClick={() => setFillMode('ON_BEHALF')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                      fillMode === 'ON_BEHALF'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    👥 Isi untuk Semua
                  </button>
                </div>
              )}

              {/* Roster */}
              {(() => {
                const roster = getAttendanceRoster(detailSession, users, detailRecords);
                const summary = summarizeAttendance(roster);

                if (roster.length === 0) {
                  return (
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400 italic py-6">
                      Tidak ada siswa yang sesuai dengan target sesi ini.
                    </p>
                  );
                }

                return (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-5 gap-2">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
                        <p className="text-[9px] font-bold text-slate-500">Total</p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200">{summary.total}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-center">
                        <p className="text-[9px] font-bold text-emerald-600">Hadir</p>
                        <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">{summary.hadir}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-center">
                        <p className="text-[9px] font-bold text-amber-600">Izin</p>
                        <p className="text-sm font-black text-amber-800 dark:text-amber-200">{summary.izin}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-center">
                        <p className="text-[9px] font-bold text-blue-600">Sakit</p>
                        <p className="text-sm font-black text-blue-800 dark:text-blue-200">{summary.sakit}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-center">
                        <p className="text-[9px] font-bold text-rose-600">Alpa</p>
                        <p className="text-sm font-black text-rose-800 dark:text-rose-200">{summary.alpa}</p>
                      </div>
                    </div>

                    {/* List */}
                    {fillMode === 'SELF' ? (
                      <div className="space-y-2">
                        {roster.map(({ student, currentStatus }) => (
                          <div key={student.uid}
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {student.displayName}
                                {student.uid === user?.uid && (
                                  <span className="ml-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950">Anda</span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {student.role} — {student.divisionName || '-'}
                              </p>
                            </div>
                            {currentStatus !== 'BELUM' ? (
                              <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${STATUS_COLORS[currentStatus]?.bg} ${STATUS_COLORS[currentStatus]?.text}`}>
                                {currentStatus}
                              </span>
                            ) : student.uid === user?.uid && detailSession.isOpen ? (
                              <div className="flex items-center gap-1">
                                {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as const).map(st => (
                                  <button
                                    key={st}
                                    onClick={() => handleSubmitSelf(detailSession, st)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold ${STATUS_COLORS[st].bg} ${STATUS_COLORS[st].text}`}
                                  >
                                    {st === 'Hadir' ? 'H' : st === 'Izin' ? 'I' : st === 'Sakit' ? 'S' : 'A'}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                BELUM
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {roster.map(({ student, currentStatus }) => {
                          const selected = bulkEntries[student.uid] || (currentStatus !== 'BELUM' ? currentStatus : null);
                          return (
                            <div key={student.uid}
                              className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {student.displayName}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {student.role} — {student.divisionName || '-'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as const).map(status => (
                                  <button
                                    key={status}
                                    onClick={() => setBulkEntries(prev => ({ ...prev, [student.uid]: status }))}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold border transition ${
                                      selected === status
                                        ? `${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].text} ${STATUS_COLORS[status].border}`
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                                    }`}
                                  >
                                    {status === 'Hadir' ? 'H' : status === 'Izin' ? 'I' : status === 'Sakit' ? 'S' : 'A'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                        <button
                          onClick={() => handleBulkSave(detailSession)}
                          disabled={bulkSubmitting || Object.keys(bulkEntries).length === 0}
                          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                        >
                          {bulkSubmitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                          ) : (
                            <><Save className="w-4 h-4" /> Simpan Semua ({Object.keys(bulkEntries).length} siswa)</>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-2 shrink-0">
              <button onClick={() => setDetailSession(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Tutup
              </button>
              {canCreate && detailSession.isOpen && (
                <button
                  onClick={() => handleCloseSession(detailSession)}
                  disabled={closingId === detailSession.id}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {closingId === detailSession.id ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menutup...</>
                  ) : (
                    <><Lock className="w-3.5 h-3.5" /> Tutup Sesi & Auto-Alpa</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
