import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, CheckCircle, AlertTriangle,
  Search, Star, Filter, RefreshCw, Clock, Lock, Award,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuth } from '../../core/authContext';
import { STAGES } from '../../core/constants';
import { UserProfile, DeadlineItem, DeadlineSubmission, ProductionStage } from '../../core/types';
import { fetchUsersByClass } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';

type StageFilter = 'ALL' | ProductionStage;

export const TaskProgressModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'per-role' | 'per-divisi' | 'per-siswa'>('per-role');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // ✅ NEW: Filter tahapan — default ke tahap aktif dari stage config
  const [selectedStage, setSelectedStage] = useState<StageFilter>('ALL');
  const [stageConfig, setStageConfig] = useState<any>(null);

  // ═══════════════════════════════════════════════════════
  // SUBSCRIBE: deadlines + deadlineSubmissions + users + stage config
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (!activeClass) return;
    setLoading(true);

    // Subscribe deadlines
    const qDeadlines = query(
      collection(db, 'deadlines'),
      where('classId', '==', activeClass.id)
    );
    const unsub1 = onSnapshot(qDeadlines, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as DeadlineItem));
      setDeadlines(list.filter(d => (d as any).status !== 'CANCELLED'));
      setLoading(false);
    }, err => {
      console.warn('Subscribe deadlines error:', err);
      setLoading(false);
    });

    // Subscribe deadlineSubmissions
    const qSubs = query(
      collection(db, 'deadlineSubmissions'),
      where('classId', '==', activeClass.id)
    );
    const unsub2 = onSnapshot(qSubs, snap => {
      setSubmissions(snap.docs.map(d => ({ ...d.data(), id: d.id } as DeadlineSubmission)));
    }, err => {
      console.warn('Subscribe submissions error:', err);
    });

    // Subscribe stage config untuk auto-select tahap aktif
    const stageRef = collection(db, 'classes');
    const stageDocRef = `classes/${activeClass.id}/config/stageManager`;
    // Karena firestore path dinamis, pakai onSnapshot langsung ke doc
    import('firebase/firestore').then(({ doc }) => {
      const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
      const unsubStage = onSnapshot(ref, snap => {
        if (snap.exists()) {
          const data = snap.data();
          setStageConfig(data);
          // ✅ Auto-set tahap aktif kalau belum dipilih user
          if (selectedStage === 'ALL' && data.currentStage) {
            setSelectedStage(data.currentStage);
          }
        }
      });
      return () => unsubStage();
    });

    // Fetch users
    fetchUsersByClass(activeClass.id).then(setUsers);

    return () => { unsub1(); unsub2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass]);

  // Subscribe stage config — dibutuhkan supaya tahap aktif diketahui
  useEffect(() => {
    if (!activeClass) return;
    const ref = (async () => {
      const { doc } = await import('firebase/firestore');
      return doc(db, 'classes', activeClass.id, 'config', 'stageManager');
    })();
    let unsub: () => void = () => {};
    ref.then(r => {
      unsub = onSnapshot(r, snap => {
        if (snap.exists()) {
          const data = snap.data();
          setStageConfig(data);
        }
      });
    });
    return () => unsub();
  }, [activeClass]);

  // ═══════════════════════════════════════════════════════
  // FILTER DEADLINES BERDASARKAN TAHAP YANG DIPILIH
  // ═══════════════════════════════════════════════════════
  const filteredDeadlines = selectedStage === 'ALL'
    ? deadlines
    : deadlines.filter(d => (d as any).stage === selectedStage);

  // Hitung jumlah deadline per tahap (untuk badge di tab)
  const stageCounts: Record<StageFilter, number> = {
    ALL: deadlines.length,
    PERSIAPAN: deadlines.filter(d => (d as any).stage === 'PERSIAPAN').length,
    PELAKSANAAN: deadlines.filter(d => (d as any).stage === 'PELAKSANAAN').length,
    PERTUNJUKAN: deadlines.filter(d => (d as any).stage === 'PERTUNJUKAN').length,
    PASCA: deadlines.filter(d => (d as any).stage === 'PASCA').length,
  };

  // ═══════════════════════════════════════════════════════
  // HELPER: Apakah deadline ini menargetkan user tertentu?
  // ═══════════════════════════════════════════════════════
  const isDeadlineForUser = (d: DeadlineItem, u: UserProfile): boolean => {
    const scope = d.targetScope as string;
    const targetUserIds: string[] = (d as any).targetUserIds || [];
    const targetRoles: string[] = (d as any).targetRoles || [];
    const targetDivisions: string[] = (d as any).targetDivisions || [];

    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return (d as any).targetRole === u.role;
    if (scope === 'DIVISI') return (d as any).targetDivision === u.divisionName;
    if (scope === 'CUSTOM') {
      if (targetRoles.length > 0 && targetRoles.includes(u.role)) return true;
      if (targetDivisions.length > 0 && u.divisionName && targetDivisions.includes(u.divisionName)) return true;
      if (targetUserIds.length === 0) return true;
      return targetUserIds.includes(u.uid);
    }
    return false;
  };

  const isSubmissionDone = (sub?: DeadlineSubmission): boolean => {
    if (!sub) return false;
    return sub.status === 'SELESAI' || sub.status === 'TERLAMBAT';
  };

  // ═══════════════════════════════════════════════════════
  // HITUNG PROGRESS PER SISWA (pakai filteredDeadlines)
  // ═══════════════════════════════════════════════════════
  const studentProgress = users
    .filter(u =>
      u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
      u.role !== 'Admin' && u.role !== 'Super Admin'
    )
    .map(u => {
      const myDeadlines = filteredDeadlines.filter(d => isDeadlineForUser(d, u));

      const completedSubs = myDeadlines.filter(d => {
        const sub = submissions.find(s => s.deadlineId === d.id && s.studentId === u.uid);
        return isSubmissionDone(sub);
      });

      const completed = completedSubs.length;
      const total = myDeadlines.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      const now = Date.now();
      const overdue = myDeadlines.filter(d => {
        const dueMs = new Date(d.dueDate).getTime();
        const sub = submissions.find(s => s.deadlineId === d.id && s.studentId === u.uid);
        return dueMs < now && !isSubmissionDone(sub);
      }).length;

      return { user: u, completed, total, pct, overdue };
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.pct - a.pct);

  // ═══════════════════════════════════════════════════════
  // HITUNG PROGRESS PER ROLE
  // ═══════════════════════════════════════════════════════
  const roleStats = (() => {
    const byRole: Record<string, { total: number; done: number; count: number }> = {};
    studentProgress.forEach(sp => {
      const role = sp.user.role;
      if (!byRole[role]) byRole[role] = { total: 0, done: 0, count: 0 };
      byRole[role].total += sp.total;
      byRole[role].done += sp.completed;
      byRole[role].count += 1;
    });
    return Object.entries(byRole).map(([role, s]) => ({
      role: role.replace('Koordinator ', 'Koor. ').replace('Anggota ', 'Agg. '),
      fullRole: role,
      total: s.total,
      done: s.done,
      siswa: s.count,
      pct: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
    })).sort((a, b) => b.pct - a.pct);
  })();

  // ═══════════════════════════════════════════════════════
  // HITUNG PROGRESS PER DIVISI
  // ═══════════════════════════════════════════════════════
  const divisiStats = (() => {
    const byDiv: Record<string, { total: number; done: number; count: number }> = {};
    studentProgress.forEach(sp => {
      const div = sp.user.divisionName || 'Pemeran';
      if (!byDiv[div]) byDiv[div] = { total: 0, done: 0, count: 0 };
      byDiv[div].total += sp.total;
      byDiv[div].done += sp.completed;
      byDiv[div].count += 1;
    });
    return Object.entries(byDiv).map(([div, s]) => ({
      divisi: div.replace(' & Dokumentasi', ' & Dok.').replace(' & Suara', ''),
      fullDivisi: div,
      total: s.total,
      done: s.done,
      anggota: s.count,
      pct: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
    })).sort((a, b) => b.pct - a.pct);
  })();

  // ═══════════════════════════════════════════════════════
  // STATISTIK UMUM
  // ═══════════════════════════════════════════════════════
  const totalTaskAssigned = studentProgress.reduce((s, sp) => s + sp.total, 0);
  const totalCompleted = studentProgress.reduce((s, sp) => s + sp.completed, 0);
  const overallPct = totalTaskAssigned > 0 ? Math.round((totalCompleted / totalTaskAssigned) * 100) : 0;

  const belumMulai = studentProgress.filter(s => s.completed === 0).length;
  const tertinggal = studentProgress.filter(s => s.pct > 0 && s.pct < 50).length;
  const onTrack = studentProgress.filter(s => s.pct >= 50 && s.pct < 80).length;
  const mahir = studentProgress.filter(s => s.pct >= 80).length;

  const pieData = [
    { name: 'Belum Mulai', value: belumMulai, color: '#EF4444' },
    { name: 'Tertinggal (<50%)', value: tertinggal, color: '#F59E0B' },
    { name: 'On Track (50-80%)', value: onTrack, color: '#3B82F6' },
    { name: 'Mahir (>=80%)', value: mahir, color: '#10B981' },
  ].filter(d => d.value > 0);

  const filteredStudents = studentProgress.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.user.displayName.toLowerCase().includes(q) ||
           s.user.role.toLowerCase().includes(q) ||
           (s.user.divisionName || '').toLowerCase().includes(q);
  });

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-blue-500';
    if (pct > 0) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getProgressTextColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-700 dark:text-emerald-300';
    if (pct >= 50) return 'text-blue-700 dark:text-blue-300';
    if (pct > 0) return 'text-amber-700 dark:text-amber-300';
    return 'text-rose-700 dark:text-rose-300';
  };

  // ═══════════════════════════════════════════════════════
  // STAGE TAB CONFIG
  // ═══════════════════════════════════════════════════════
  const stageTabs: { id: StageFilter; label: string; icon: any; gradient: string }[] = [
    { id: 'ALL', label: 'Semua Tahap', icon: Award, gradient: 'from-slate-600 to-slate-800' },
    { id: 'PERSIAPAN', label: 'Persiapan', icon: Star, gradient: 'from-amber-500 to-amber-700' },
    { id: 'PELAKSANAAN', label: 'Pelaksanaan', icon: TrendingUp, gradient: 'from-blue-500 to-blue-700' },
    { id: 'PERTUNJUKAN', label: 'Pertunjukan', icon: Star, gradient: 'from-purple-500 to-purple-700' },
    { id: 'PASCA', label: 'Pasca', icon: CheckCircle, gradient: 'from-emerald-500 to-emerald-700' },
  ];

  const currentStageActive = stageConfig?.currentStage as ProductionStage | undefined;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <BarChart3 className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Progress Tugas
              </span>
              <h2 className="text-xl font-black text-white mt-1">Grafik Progress Checklist</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Real-time dari centang tugas siswa — bisa dilihat per tahap
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          STAGE FILTER TABS — INI YANG BARU
          ═══════════════════════════════════════════════════ */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Filter Tahapan:
          </span>
          {currentStageActive && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Aktif sekarang: {currentStageActive}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {stageTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = selectedStage === tab.id;
            const count = stageCounts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStage(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                  isActive
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md`
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  {count}
                </span>
                {tab.id === currentStageActive && (
                  <span className="text-[9px] font-black px-1 py-0.5 rounded bg-white/30">
                    AKTIF
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Info kalau tahap yang dipilih kosong */}
        {selectedStage !== 'ALL' && stageCounts[selectedStage] === 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Belum ada deadline di tahap {selectedStage}.</strong> Progress akan muncul setelah guru/pengurus membuat tugas untuk tahap ini.
            </p>
          </div>
        )}
      </div>

      {/* INFO */}
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Real-time:</strong> Data diambil langsung dari <strong>deadlineSubmissions</strong>.
          Progress otomatis update begitu siswa menandai tugas selesai di menu <strong>Tugas &amp; Deadline</strong>.
          Gunakan filter tahapan di atas untuk melihat per-tahap.
        </p>
      </div>

      {/* STATISTIK RINGKASAN — mengikuti filter tahap */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <Users className="w-5 h-5 mx-auto text-slate-500 dark:text-slate-400 mb-1" />
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Total Tugas</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{totalTaskAssigned}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm text-center">
          <CheckCircle className="w-5 h-5 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">Selesai</p>
          <p className="text-xl font-black text-emerald-800 dark:text-emerald-200">{totalCompleted}</p>
        </div>
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-sm text-center">
          <TrendingUp className="w-5 h-5 mx-auto text-indigo-600 dark:text-indigo-400 mb-1" />
          <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold">Rata-rata</p>
          <p className="text-xl font-black text-indigo-800 dark:text-indigo-200">{overallPct}%</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-amber-600 dark:text-amber-400 mb-1" />
          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">Perlu Perhatian</p>
          <p className="text-xl font-black text-amber-800 dark:text-amber-200">{tertinggal + belumMulai}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-rose-600 dark:text-rose-400 mb-1" />
          <p className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold">Belum Mulai</p>
          <p className="text-xl font-black text-rose-800 dark:text-rose-200">{belumMulai}</p>
        </div>
      </div>

      {/* PIE DISTRIBUSI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md flex flex-col justify-center">
          <TrendingUp className="w-6 h-6 mb-2" />
          <p className="text-xs font-bold opacity-90">
            Rata-rata Progress {selectedStage === 'ALL' ? 'Kelas' : `Tahap ${selectedStage}`}
          </p>
          <p className="text-5xl font-black mt-1">{overallPct}%</p>
          <p className="text-[11px] mt-2 opacity-80">
            {totalCompleted} dari {totalTaskAssigned} centang tugas
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
            Distribusi Status Siswa {selectedStage !== 'ALL' && <span className="text-xs font-normal text-slate-500">— {selectedStage}</span>}
          </h3>
          <div className="w-full h-52">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Belum ada data untuk tahap ini
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('per-role')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-role' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          👤 Per Peran ({roleStats.length})
        </button>
        <button onClick={() => setActiveTab('per-divisi')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-divisi' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          👥 Per Divisi ({divisiStats.length})
        </button>
        <button onClick={() => setActiveTab('per-siswa')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-siswa' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          📋 Per Siswa ({studentProgress.length})
        </button>
      </div>

      {/* TAB: PER ROLE */}
      {activeTab === 'per-role' && (
        <>
          {roleStats.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <BarChart3 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Belum ada data progress untuk filter ini</p>
            </div>
          ) : (
            <>
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                  Progress per Peran (%) {selectedStage !== 'ALL' && <span className="text-xs font-normal text-slate-500">— {selectedStage}</span>}
                </h3>
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roleStats} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="role" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(v: any) => [`${v}%`, 'Progress']} />
                      <Bar dataKey="pct" fill="#6366F1" radius={[6, 6, 0, 0]}>
                        {roleStats.map((entry, i) => (
                          <Cell key={i} fill={
                            entry.pct >= 80 ? '#10B981' :
                            entry.pct >= 50 ? '#3B82F6' :
                            entry.pct > 0 ? '#F59E0B' : '#EF4444'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="py-3.5 px-4">Peran</th>
                        <th className="py-3.5 px-4 text-center">Jumlah Siswa</th>
                        <th className="py-3.5 px-4 text-center">Total Tugas</th>
                        <th className="py-3.5 px-4 text-center">Selesai</th>
                        <th className="py-3.5 px-4 text-center">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {roleStats.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{r.fullRole}</td>
                          <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">{r.siswa}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">{r.total}</td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-700 dark:text-emerald-400">{r.done}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full ${getProgressColor(r.pct)}`}
                                  style={{ width: `${r.pct}%` }} />
                              </div>
                              <span className={`font-bold text-xs ${getProgressTextColor(r.pct)} min-w-[40px] text-right`}>
                                {r.pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB: PER DIVISI */}
      {activeTab === 'per-divisi' && (
        <>
          {divisiStats.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Belum ada data progress divisi untuk filter ini</p>
            </div>
          ) : (
            <>
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                  Progress per Divisi (%) {selectedStage !== 'ALL' && <span className="text-xs font-normal text-slate-500">— {selectedStage}</span>}
                </h3>
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={divisiStats} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="divisi" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(v: any) => [`${v}%`, 'Progress']} />
                      <Bar dataKey="pct" fill="#8B5CF6" radius={[6, 6, 0, 0]}>
                        {divisiStats.map((entry, i) => (
                          <Cell key={i} fill={
                            entry.pct >= 80 ? '#10B981' :
                            entry.pct >= 50 ? '#3B82F6' :
                            entry.pct > 0 ? '#F59E0B' : '#EF4444'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="py-3.5 px-4">Divisi</th>
                        <th className="py-3.5 px-4 text-center">Anggota</th>
                        <th className="py-3.5 px-4 text-center">Total Tugas</th>
                        <th className="py-3.5 px-4 text-center">Selesai</th>
                        <th className="py-3.5 px-4 text-center">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {divisiStats.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{d.fullDivisi}</td>
                          <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">{d.anggota}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">{d.total}</td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-700 dark:text-emerald-400">{d.done}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full ${getProgressColor(d.pct)}`}
                                  style={{ width: `${d.pct}%` }} />
                              </div>
                              <span className={`font-bold text-xs ${getProgressTextColor(d.pct)} min-w-[40px] text-right`}>
                                {d.pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB: PER SISWA */}
      {activeTab === 'per-siswa' && (
        <>
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input type="text" placeholder="Cari nama, peran, atau divisi..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <Star className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Belum ada data progress siswa untuk filter ini</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Nama Siswa</th>
                      <th className="py-3.5 px-4">Peran</th>
                      <th className="py-3.5 px-4">Divisi</th>
                      <th className="py-3.5 px-4 text-center">Selesai</th>
                      <th className="py-3.5 px-4 text-center">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredStudents.map((s) => (
                      <tr key={s.user.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0">
                              {s.user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">{s.user.displayName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">{s.user.role}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">{s.user.divisionName || '-'}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                          {s.completed}/{s.total}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full ${getProgressColor(s.pct)}`}
                                style={{ width: `${s.pct}%` }} />
                            </div>
                            <span className={`font-bold text-xs ${getProgressTextColor(s.pct)} min-w-[40px] text-right`}>
                              {s.pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
