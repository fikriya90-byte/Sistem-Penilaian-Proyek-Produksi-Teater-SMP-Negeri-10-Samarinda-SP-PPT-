import React, { useState, useEffect } from 'react';
import {
  BarChart3, Users, Calendar, TrendingUp, CheckCircle, XCircle,
  Clock, AlertCircle, Download, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { AttendanceRecord, AttendanceSession } from '../../core/types';
import {
  subscribeAttendanceSessions, subscribeAllAttendanceRecords, fetchUsersByClass,
} from '../../services/firestoreService';
import { UserProfile } from '../../core/types';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

export const AttendanceStatsModule: React.FC = () => {
  const { activeClass } = useAuth();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'per-siswa' | 'per-divisi' | 'per-jenis'>('per-siswa');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!activeClass) return;
    const unsub1 = subscribeAttendanceSessions(activeClass.id, setSessions);
    const unsub2 = subscribeAllAttendanceRecords(activeClass.id, setRecords);
    fetchUsersByClass(activeClass.id).then(setUsers);
    return () => { unsub1(); unsub2(); };
  }, [activeClass]);

  const statsPerSiswa = users
    .filter(u => u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin')
    .map(u => {
      const myRecords = records.filter(r => r.studentId === u.uid);
      const hadir = myRecords.filter(r => r.status === 'Hadir').length;
      const izin = myRecords.filter(r => r.status === 'Izin').length;
      const sakit = myRecords.filter(r => r.status === 'Sakit').length;
      const alpa = myRecords.filter(r => r.status === 'Alpa').length;
      const total = myRecords.length;
      const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;
      return { user: u, hadir, izin, sakit, alpa, total, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const statsPerDivisi = (() => {
    const byDiv: Record<string, { name: string; hadir: number; total: number }> = {};
    records.forEach(r => {
      const key = r.divisionName || 'Lainnya';
      if (!byDiv[key]) byDiv[key] = { name: key, hadir: 0, total: 0 };
      byDiv[key].total += 1;
      if (r.status === 'Hadir') byDiv[key].hadir += 1;
    });
    return Object.values(byDiv).map(d => ({
      divisi: d.name,
      kehadiran: d.total > 0 ? Math.round((d.hadir / d.total) * 100) : 0,
      total: d.total,
    })).sort((a, b) => b.kehadiran - a.kehadiran);
  })();

  const statsPerJenis = (() => {
    const byType: Record<string, { hadir: number; total: number }> = {};
    sessions.forEach(s => {
      const sessionRecs = records.filter(r => r.sessionId === s.id);
      const hadir = sessionRecs.filter(r => r.status === 'Hadir').length;
      if (!byType[s.activityType]) byType[s.activityType] = { hadir: 0, total: 0 };
      byType[s.activityType].hadir += hadir;
      byType[s.activityType].total += sessionRecs.length;
    });
    return Object.entries(byType).map(([jenis, d]) => ({
      jenis,
      kehadiran: d.total > 0 ? Math.round((d.hadir / d.total) * 100) : 0,
      total: d.total,
    })).sort((a, b) => b.kehadiran - a.kehadiran);
  })();

  const overallStats = {
    totalSessions: sessions.length,
    totalRecords: records.length,
    hadir: records.filter(r => r.status === 'Hadir').length,
    izin: records.filter(r => r.status === 'Izin').length,
    sakit: records.filter(r => r.status === 'Sakit').length,
    alpa: records.filter(r => r.status === 'Alpa').length,
  };
  const overallPct = overallStats.totalRecords > 0
    ? Math.round((overallStats.hadir / overallStats.totalRecords) * 100)
    : 0;

  const pieData = [
    { name: 'Hadir', value: overallStats.hadir, color: '#10B981' },
    { name: 'Izin', value: overallStats.izin, color: '#3B82F6' },
    { name: 'Sakit', value: overallStats.sakit, color: '#F59E0B' },
    { name: 'Alpa', value: overallStats.alpa, color: '#EF4444' },
  ].filter(d => d.value > 0);

  const filteredSiswa = statsPerSiswa.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.user.displayName.toLowerCase().includes(q) || s.user.role.toLowerCase().includes(q);
  });

  const handleExportXLSX = () => {
    const sheet1 = {
      name: 'Per Siswa',
      headers: ['Nama', 'Role', 'Divisi', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Total Sesi', '% Kehadiran'],
      rows: statsPerSiswa.map(s => [
        s.user.displayName, s.user.role, s.user.divisionName || '-',
        s.hadir, s.izin, s.sakit, s.alpa, s.total, s.pct,
      ]),
    };

    const sheet2 = {
      name: 'Per Divisi',
      headers: ['Divisi', 'Total Kehadiran', 'Total Sesi', '% Kehadiran'],
      rows: statsPerDivisi.map(d => [d.divisi, d.kehadiran, d.total, d.kehadiran]),
    };

    const sheet3 = {
      name: 'Per Jenis Kegiatan',
      headers: ['Jenis Kegiatan', '% Kehadiran', 'Total Sesi'],
      rows: statsPerJenis.map(d => [d.jenis, d.kehadiran, d.total]),
    };

    const sheet4 = {
      name: 'Ringkasan',
      headers: ['Metrik', 'Nilai'],
      rows: [
        ['Total Sesi', overallStats.totalSessions],
        ['Total Entri Presensi', overallStats.totalRecords],
        ['Hadir', overallStats.hadir],
        ['Izin', overallStats.izin],
        ['Sakit', overallStats.sakit],
        ['Alpa', overallStats.alpa],
        ['Rata-rata Kehadiran', `${overallPct}%`],
      ],
    };

    exportMultiSheetXLSX(
      `Statistik_Presensi_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.xls`,
      [sheet4, sheet1, sheet2, sheet3]
    );
    showToast('Statistik presensi berhasil diekspor ke Excel!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-slate-900 to-slate-800 text-white shadow-xl border border-blue-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <BarChart3 className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Statistik Presensi
              </span>
              <h2 className="text-xl font-black text-white mt-1">Analisis Kehadiran {activeClass?.name || ''}</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Per siswa, per divisi, dan per jenis kegiatan
              </p>
            </div>
          </div>

          <button onClick={handleExportXLSX}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition">
            <Download className="w-4 h-4" />
            <span>Export XLSX</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
          <Calendar className="w-5 h-5 mx-auto text-slate-500 mb-1" />
          <p className="text-[10px] text-slate-500 font-semibold">Total Sesi</p>
          <p className="text-xl font-black text-slate-900">{overallStats.totalSessions}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm text-center">
          <CheckCircle className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
          <p className="text-[10px] text-emerald-700 font-semibold">Hadir</p>
          <p className="text-xl font-black text-emerald-800">{overallStats.hadir}</p>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm text-center">
          <Clock className="w-5 h-5 mx-auto text-blue-600 mb-1" />
          <p className="text-[10px] text-blue-700 font-semibold">Izin</p>
          <p className="text-xl font-black text-blue-800">{overallStats.izin}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm text-center">
          <AlertCircle className="w-5 h-5 mx-auto text-amber-600 mb-1" />
          <p className="text-[10px] text-amber-700 font-semibold">Sakit</p>
          <p className="text-xl font-black text-amber-800">{overallStats.sakit}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm text-center">
          <XCircle className="w-5 h-5 mx-auto text-rose-600 mb-1" />
          <p className="text-[10px] text-rose-700 font-semibold">Alpa</p>
          <p className="text-xl font-black text-rose-800">{overallStats.alpa}</p>
        </div>
      </div>

      {/* Persentase + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md flex flex-col justify-center">
          <TrendingUp className="w-6 h-6 mb-2" />
          <p className="text-xs font-bold opacity-90">Rata-rata Kehadiran</p>
          <p className="text-5xl font-black mt-1">{overallPct}%</p>
          <p className="text-[11px] mt-2 opacity-80">
            Dari {overallStats.totalRecords} entri presensi di {overallStats.totalSessions} sesi
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">Distribusi Kehadiran</h3>
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
                Belum ada data presensi
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('per-siswa')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'per-siswa' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          <Users className="w-3.5 h-3.5" /> Per Siswa
        </button>
        <button onClick={() => setActiveTab('per-divisi')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-divisi' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          Per Divisi
        </button>
        <button onClick={() => setActiveTab('per-jenis')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'per-jenis' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
          }`}>
          Per Jenis Kegiatan
        </button>
      </div>

      {/* Content */}
      {activeTab === 'per-siswa' && (
        <>
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input type="text" placeholder="Cari nama siswa..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Nama</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4 text-center">Hadir</th>
                    <th className="py-3.5 px-4 text-center">Izin</th>
                    <th className="py-3.5 px-4 text-center">Sakit</th>
                    <th className="py-3.5 px-4 text-center">Alpa</th>
                    <th className="py-3.5 px-4 text-center">% Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSiswa.map(s => (
                    <tr key={s.user.uid} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{s.user.displayName}</td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">{s.user.role}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">{s.hadir}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700">{s.izin}</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-700">{s.sakit}</td>
                      <td className="py-3 px-4 text-center font-bold text-rose-700">{s.alpa}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full ${
                              s.pct >= 80 ? 'bg-emerald-500' :
                              s.pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`} style={{ width: `${s.pct}%` }} />
                          </div>
                          <span className="font-bold text-slate-800 text-[11px]">{s.pct}%</span>
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

      {activeTab === 'per-divisi' && (
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">Kehadiran per Divisi</h3>
          {statsPerDivisi.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">Belum ada data</p>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsPerDivisi} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="divisi" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="kehadiran" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {activeTab === 'per-jenis' && (
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">Kehadiran per Jenis Kegiatan</h3>
          {statsPerJenis.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">Belum ada data</p>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsPerJenis} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="jenis" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="kehadiran" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
