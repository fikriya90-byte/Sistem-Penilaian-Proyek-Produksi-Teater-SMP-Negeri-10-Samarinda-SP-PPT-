import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, CheckCircle, AlertTriangle,
  Search, Star, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuth } from '../../core/authContext';
import { DIVISIONS } from '../../core/constants';
import { TaskItem, UserProfile } from '../../core/types';
import { fetchUsersByClass, subscribeTasksByClass } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';

export const TaskProgressModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completions, setCompletions] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'per-role' | 'per-divisi' | 'per-siswa'>('per-role');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!activeClass) return;

    const unsub1 = subscribeTasksByClass(activeClass.id, setTasks);
    fetchUsersByClass(activeClass.id).then(setUsers);

    let unsub2 = () => {};
    (async () => {
      const q = query(collection(db, 'taskCompletions'), where('classId', '==', activeClass.id));
      unsub2 = onSnapshot(q, (snap) => {
        const map: Record<string, any> = {};
        snap.docs.forEach((d: any) => {
          const data = d.data();
          map[`${data.taskId}_${data.studentId}`] = data;
        });
        setCompletions(map);
      });
    })();

    return () => { unsub1(); unsub2(); };
  }, [activeClass]);

  // ==========================================
  // HITUNG PROGRESS PER SISWA
  // ==========================================
  const studentProgress = users
    .filter(u => u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
                 u.role !== 'Admin' && u.role !== 'Super Admin')
    .map(u => {
      // Tugas yang jadi tanggung jawab siswa ini
      const myTasks = tasks.filter(t =>
        t.assigneeId === u.uid ||
        t.targetRole === u.role ||
        t.targetDivision === u.divisionName ||
        t.assigneeName === 'Semua Siswa' ||
        t.assigneeName === 'Semua Anggota Divisi'
      );
      const completed = myTasks.filter(t => completions[`${t.id}_${u.uid}`]?.completed).length;
      const total = myTasks.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { user: u, completed, total, pct };
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.pct - a.pct);

  // ==========================================
  // HITUNG PROGRESS PER ROLE
  // ==========================================
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

  // ==========================================
  // HITUNG PROGRESS PER DIVISI
  // ==========================================
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

  // ==========================================
  // STATISTIK UMUM
  // ==========================================
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
    if (pct >= 80) return 'text-emerald-700';
    if (pct >= 50) return 'text-blue-700';
    if (pct > 0) return 'text-amber-700';
    return 'text-rose-700';
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl">
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
              Tolak ukur dari centang tugas siswa — per peran, per divisi, per siswa
            </p>
          </div>
        </div>
      </div>

      {/* STATISTIK RINGKASAN */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
          <Users className="w-5 h-5 mx-auto text-slate-500 mb-1" />
          <p className="text-[10px] text-slate-500 font-semibold">Total Tugas</p>
          <p className="text-xl font-black text-slate-900">{totalTaskAssigned}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm text-center">
          <CheckCircle className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
          <p className="text-[10px] text-emerald-700 font-semibold">Selesai</p>
          <p className="text-xl font-black text-emerald-800">{totalCompleted}</p>
        </div>
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-sm text-center">
          <TrendingUp className="w-5 h-5 mx-auto text-indigo-600 mb-1" />
          <p className="text-[10px] text-indigo-700 font-semibold">Rata-rata</p>
          <p className="text-xl font-black text-indigo-800">{overallPct}%</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-amber-600 mb-1" />
          <p className="text-[10px] text-amber-700 font-semibold">Perlu Perhatian</p>
          <p className="text-xl font-black text-amber-800">{tertinggal + belumMulai}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-rose-600 mb-1" />
          <p className="text-[10px] text-rose-700 font-semibold">Belum Mulai</p>
          <p className="text-xl font-black text-rose-800">{belumMulai}</p>
        </div>
      </div>

      {/* PIE DISTRIBUSI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md flex flex-col justify-center">
          <TrendingUp className="w-6 h-6 mb-2" />
          <p className="text-xs font-bold opacity-90">Rata-rata Progress Kelas</p>
          <p className="text-5xl font-black mt-1">{overallPct}%</p>
          <p className="text-[11px] mt-2 opacity-80">
            {totalCompleted} dari {totalTaskAssigned} centang tugas
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">
            Distribusi Status Siswa
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
                Belum ada data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('per-role')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-role' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          👤 Per Peran ({roleStats.length})
        </button>
        <button onClick={() => setActiveTab('per-divisi')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-divisi' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          👥 Per Divisi ({divisiStats.length})
        </button>
        <button onClick={() => setActiveTab('per-siswa')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-siswa' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          📋 Per Siswa ({studentProgress.length})
        </button>
      </div>

      {/* TAB: PER ROLE */}
      {activeTab === 'per-role' && (
        <>
          {roleStats.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <BarChart3 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Belum ada data progress</p>
            </div>
          ) : (
            <>
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3">
                  Progress per Peran (%)
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

              {/* Tabel detail */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-3.5 px-4">Peran</th>
                        <th className="py-3.5 px-4 text-center">Jumlah Siswa</th>
                        <th className="py-3.5 px-4 text-center">Total Tugas</th>
                        <th className="py-3.5 px-4 text-center">Selesai</th>
                        <th className="py-3.5 px-4 text-center">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roleStats.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">{r.fullRole}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{r.siswa}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-700">{r.total}</td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-700">{r.done}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
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
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Belum ada data progress divisi</p>
            </div>
          ) : (
            <>
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3">
                  Progress per Divisi (%)
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

              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-3.5 px-4">Divisi</th>
                        <th className="py-3.5 px-4 text-center">Anggota</th>
                        <th className="py-3.5 px-4 text-center">Total Tugas</th>
                        <th className="py-3.5 px-4 text-center">Selesai</th>
                        <th className="py-3.5 px-4 text-center">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {divisiStats.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">{d.fullDivisi}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{d.anggota}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-700">{d.total}</td>
                          <td className="py-3 px-4 text-center font-mono text-emerald-700">{d.done}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
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
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <Star className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Belum ada data progress siswa</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Nama Siswa</th>
                      <th className="py-3.5 px-4">Peran</th>
                      <th className="py-3.5 px-4">Divisi</th>
                      <th className="py-3.5 px-4 text-center">Selesai</th>
                      <th className="py-3.5 px-4 text-center">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s) => (
                      <tr key={s.user.uid} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {s.user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900">{s.user.displayName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">{s.user.role}</td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">{s.user.divisionName || '-'}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-700">
                          {s.completed}/{s.total}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
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
