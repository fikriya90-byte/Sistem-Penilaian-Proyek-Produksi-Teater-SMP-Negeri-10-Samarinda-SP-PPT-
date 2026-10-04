import React, { useState, useEffect } from 'react';
import {
  AlertCircle, Award, Calendar, CheckCircle, Clock, Coins, FileText,
  HelpCircle, Layers, MessageSquare, Mic, PieChart as PieIcon,
  PlusCircle, Radio, Share2, Sparkles, TrendingUp, UserCheck, Users,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, RadialBarChart, RadialBar,
  PolarAngleAxis, Tooltip,
} from 'recharts';
import { useAuth } from '../../core/authContext';
import { DIVISIONS, STAGES } from '../../core/constants';
import { TaskItem, ScheduleEvent, AttendanceSession } from '../../core/types';
import {
  subscribeTasksByClass, subscribeSchedules, subscribeAttendanceSessions,
} from '../../services/firestoreService';

interface DashboardModuleProps {
  onNavigate: (module: string) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const {
    user, activeClass, isTeacher, isPimprod, isSutradara, isAsisten,
    isSekretaris, isBendahara, isKoordinator, isPemain,
  } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const unsubTasks = subscribeTasksByClass(activeClass.id, (t) => setTasks(t));
    const unsubSchedules = subscribeSchedules(activeClass.id, (s) => setSchedules(s));
    const unsubSessions = subscribeAttendanceSessions(activeClass.id, (sess) => setSessions(sess));
    return () => {
      unsubTasks();
      unsubSchedules();
      unsubSessions();
    };
  }, [activeClass]);

  // === FIX: Nilai default sekarang 0, bukan angka palsu ===
  const completedTasks = tasks.filter(t => t.status === 'APPROVED');
  const taskProgressPct = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  const overdueTasks = tasks.filter(t =>
    t.status === 'OVERDUE' ||
    (t.status !== 'APPROVED' && new Date(t.dueDate).getTime() < currentTime.getTime())
  );

  // Attendance rate: hitung dari data sesi nyata, 0 kalau tidak ada
  const totalAttendanceEntries = sessions.length;
  const attendanceRatePct = totalAttendanceEntries > 0
    ? Math.min(100, Math.round((sessions.filter(s => !s.isOpen).length / totalAttendanceEntries) * 100))
    : 0;

  // Budget: belum ada modul RAB, jadi 0 dulu
  const totalBudget = 0;
  const spentBudget = 0;
  const budgetSpentPct = 0;

  // Data source untuk concentric rings
  const concentricRingData = [
    { name: 'Realisasi Anggaran', value: budgetSpentPct, fill: '#10B981', target: 'Belum ada RAB' },
    { name: 'Tingkat Kehadiran', value: attendanceRatePct, fill: '#3B82F6', target: 'Min 80%' },
    { name: 'Progres Tugas', value: taskProgressPct, fill: '#F59E0B', target: '100% Pentas' },
  ];

  const upcomingTasks = [...tasks]
    .filter(t => t.status !== 'APPROVED')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const nearestTask = upcomingTasks[0];

  const formatCountdown = (dueIso: string) => {
    const diff = new Date(dueIso).getTime() - currentTime.getTime();
    if (diff <= 0) return 'Tenggat Waktu Lewat (OVERDUE)';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days} hari ${remHours} jam ${mins} mnt`;
    return `${hours} jam ${mins} mnt ${secs} dtk`;
  };

  const hasAnyData = tasks.length > 0 || sessions.length > 0 || schedules.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-6 sm:p-8 shadow-xl border border-amber-500/20">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {activeClass?.name || 'Belum Ada Kelas'} • Proyek Seni Teater
              </span>
              <span className="text-xs text-slate-400 font-medium">Tahun Ajaran 2025/2026</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Selamat datang, {user?.displayName || 'Sahabat Teater'}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Produksi <span className="font-semibold text-amber-300">"{activeClass?.kerabatKerja || 'Proyek Produksi Teater'}"</span>
              {activeClass && <> ({activeClass.name})</>} saat ini berada pada tahap{' '}
              <span className="font-bold text-white uppercase bg-amber-500/30 px-2 py-0.5 rounded-md">Pelaksanaan</span>.
              Pastikan seluruh progres latihan dan kelengkapan artistik berjalan disiplin.
            </p>

            {/* Banner pengingat kelas aktif — untuk guru/admin */}
            {isTeacher && activeClass && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-xs">
                <Users className="w-3.5 h-3.5 text-blue-300" />
                <span className="text-blue-100">
                  Melihat data: <strong className="text-white">{activeClass.name}</strong>
                </span>
                <span className="text-blue-300 text-[10px]">— ganti kelas di header atas</span>
              </div>
            )}

            <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm max-w-xl text-xs text-amber-200/90 italic flex items-center gap-2">
              <span className="not-italic text-base">💬</span>
              <span>"Teater bukan hanya seni berakting, melainkan cermin kedisiplinan, kejujuran jiwa, dan harmoni kerja sama."</span>
            </div>
          </div>

          {/* Progres Produksi */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-white/10 shrink-0 w-full md:w-72">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-300">Progres Produksi</span>
              <span className="font-extrabold text-amber-400 text-sm">{taskProgressPct}%</span>
            </div>
            <div className="w-full bg-slate-700/60 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${taskProgressPct}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-center mt-2.5 text-slate-400">
              <span>Persiapan</span>
              <span className="text-amber-300 font-extrabold">Pelaksanaan</span>
              <span>Pentas</span>
              <span>Pasca</span>
            </div>
            {tasks.length === 0 && (
              <p className="text-[10px] text-slate-400 text-center mt-2 italic">
                Belum ada tugas yang dibuat
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Banner: Belum ada data sama sekali */}
      {!hasAnyData && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 text-center space-y-2">
          <Sparkles className="w-10 h-10 mx-auto text-amber-500" />
          <h3 className="text-base font-extrabold text-amber-900">
            Kelas {activeClass?.name || ''} belum memiliki aktivitas
          </h3>
          <p className="text-xs text-amber-800 max-w-lg mx-auto leading-relaxed">
            Belum ada tugas, sesi presensi, atau jadwal yang dibuat. Semua grafik di bawah akan terisi otomatis
            setelah aktivitas produksi dimulai.
          </p>
          {isTeacher && (
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button onClick={() => onNavigate('tugas')}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                + Buat Tugas Pertama
              </button>
              <button onClick={() => onNavigate('absensi')}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs">
                + Buat Sesi Presensi
              </button>
              <button onClick={() => onNavigate('jadwal')}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                + Tambah Jadwal
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Deadline Terdekat */}
      {nearestTask && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
          new Date(nearestTask.dueDate).getTime() - currentTime.getTime() < 24 * 3600000
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-600 text-white">
                  Deadline Terdekat
                </span>
                <span className="text-xs font-semibold text-slate-600">{nearestTask.divisionName || 'Produksi'}</span>
              </div>
              <p className="text-sm font-bold text-slate-900 mt-1">{nearestTask.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{nearestTask.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[11px] font-semibold text-slate-500">Sisa Waktu</p>
              <p className="text-sm font-black font-mono text-rose-600">
                {formatCountdown(nearestTask.dueDate)}
              </p>
            </div>
            <button onClick={() => onNavigate('tugas')}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition">
              Lihat Detail
            </button>
          </div>
        </div>
      )}

      {/* 3. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Total Tugas</p>
            <p className="text-xl font-black text-slate-900">{tasks.length}</p>
            <p className="text-[10px] text-emerald-600 font-semibold">{completedTasks.length} Disetujui</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Tugas Terlambat</p>
            <p className="text-xl font-black text-rose-600">{overdueTasks.length}</p>
            <p className="text-[10px] text-slate-400 font-semibold">Perlu tindak lanjut</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Agenda Jadwal</p>
            <p className="text-xl font-black text-blue-600">{schedules.length}</p>
            <p className="text-[10px] text-blue-600 font-semibold">Pekan ini</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Sesi Presensi</p>
            <p className="text-xl font-black text-emerald-600">{sessions.length}</p>
            <p className="text-[10px] text-emerald-600 font-semibold">{sessions.filter(s => s.isOpen).length} sedang dibuka</p>
          </div>
        </div>
      </div>

      {/* 4. Ringkasan Visual — Tampilkan empty state kalau belum ada data */}
      {hasAnyData ? (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <PieIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Ringkasan Visual Progres Proyek Produksi
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Indikator cincin progres sirkular untuk evaluasi performa produksi teater.
                </p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              taskProgressPct >= 50
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${taskProgressPct >= 50 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
              {taskProgressPct >= 50 ? 'Sesuai Target' : 'Perlu Percepatan'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Ring 1: Tasks */}
            <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-amber-500" />
                    Progres Tugas
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Target: 100%
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-900">Penyelesaian Tugas</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Kelengkapan seluruh divisi artistik & manajemen</p>
              </div>

              <div className="relative w-36 h-36 my-3 mx-auto flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Selesai', value: taskProgressPct },
                        { name: 'Sisa', value: Math.max(0, 100 - taskProgressPct) },
                      ]}
                      cx="50%" cy="50%" startAngle={90} endAngle={-270}
                      innerRadius={46} outerRadius={60} dataKey="value" stroke="none">
                      <Cell fill="#F59E0B" />
                      <Cell fill="#E2E8F0" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">{taskProgressPct}%</span>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Tugas</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Disetujui:</span>
                  <span className="font-bold text-emerald-600">{completedTasks.length} / {tasks.length}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Terlambat:</span>
                  <span className={`font-bold ${overdueTasks.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {overdueTasks.length} Item
                  </span>
                </div>
              </div>
            </div>

            {/* Ring 2: Attendance */}
            <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    Tingkat Kehadiran
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Ambang: &gt;80%
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-900">Disiplin Presensi</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Perbandingan sesi selesai vs total sesi</p>
              </div>

              <div className="relative w-36 h-36 my-3 mx-auto flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Selesai', value: attendanceRatePct },
                        { name: 'Sisa', value: Math.max(0, 100 - attendanceRatePct) },
                      ]}
                      cx="50%" cy="50%" startAngle={90} endAngle={-270}
                      innerRadius={46} outerRadius={60} dataKey="value" stroke="none">
                      <Cell fill="#3B82F6" />
                      <Cell fill="#E2E8F0" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">{attendanceRatePct}%</span>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Presensi</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Total Sesi:</span>
                  <span className="font-bold text-slate-900">{sessions.length}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Sesi Aktif:</span>
                  <span className="font-bold text-emerald-600">{sessions.filter(s => s.isOpen).length}</span>
                </div>
              </div>
            </div>

            {/* Ring 3: Budget */}
            <div className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-500" />
                    Realisasi Anggaran
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Belum Aktif
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-900">Kas Produksi</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Modul RAB belum diaktifkan</p>
              </div>

              <div className="relative w-36 h-36 my-3 mx-auto flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ name: 'Kosong', value: 100 }]}
                      cx="50%" cy="50%" startAngle={90} endAngle={-270}
                      innerRadius={46} outerRadius={60} dataKey="value" stroke="none">
                      <Cell fill="#E2E8F0" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-300 tracking-tight">0%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Belum Ada</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Modul RAB:</span>
                  <span className="font-bold">Segera Hadir</span>
                </div>
              </div>
            </div>
          </div>

          {/* Concentric rings summary */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex flex-col lg:flex-row items-center justify-between gap-6 border border-amber-500/20 shadow-md">
            <div className="flex items-center gap-6 w-full lg:w-auto">
              <div className="relative w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%" cy="50%" innerRadius="30%" outerRadius="100%" barSize={10}
                    data={concentricRingData} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar background={{ fill: 'rgba(255, 255, 255, 0.1)' }} dataKey="value" cornerRadius={6} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-950 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700 text-xs">
                              <p className="font-bold text-slate-200">{data.name}</p>
                              <p className="font-mono text-amber-300 font-extrabold text-sm mt-0.5">{data.value}%</p>
                              <p className="text-[10px] text-slate-400">Target: {data.target}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  Pusat Kendali Produksi
                </span>
                <h3 className="text-base font-extrabold text-white mt-1.5">
                  Kinerja Kolaboratif Antar Divisi
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
                  Cincin konsentris mengintegrasikan penyelesaian tugas artistik, kedisiplinan presensi, dan pengelolaan dana kas pementasan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mb-1" />
                <p className="text-[10px] text-slate-400 font-medium">Tugas</p>
                <p className="text-base font-black text-amber-300">{taskProgressPct}%</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 mb-1" />
                <p className="text-[10px] text-slate-400 font-medium">Presensi</p>
                <p className="text-base font-black text-blue-300">{attendanceRatePct}%</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400 mb-1" />
                <p className="text-[10px] text-slate-400 font-medium">Kas RAB</p>
                <p className="text-base font-black text-slate-400">N/A</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <PieIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-extrabold text-slate-700">Grafik Belum Tersedia</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Ringkasan visual progres produksi akan muncul setelah ada data tugas, presensi, dan aktivitas.
          </p>
        </div>
      )}

      {/* 5. Aksi Cepat */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Aksi Cepat: <span className="text-amber-600">{user?.role}</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">Fitur yang dikonfigurasi untuk wewenang Anda.</p>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            Role: {user?.role}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <button onClick={() => onNavigate('nilai')}
            className="p-3.5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition text-left group">
            <Award className="w-5 h-5 text-amber-500 mb-2 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-slate-800">Rapor & Nilai</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Lihat nilai multi-penilai</p>
          </button>

          <button onClick={() => onNavigate('absensi')}
            className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition text-left group">
            <UserCheck className="w-5 h-5 text-blue-500 mb-2 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-slate-800">Presensi</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Check-in atau buat sesi</p>
          </button>

          <button onClick={() => onNavigate('tugas')}
            className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition text-left group">
            <CheckCircle className="w-5 h-5 text-emerald-500 mb-2 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-slate-800">Checklist Tugas</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Kelola & unggah bukti</p>
          </button>

          <button onClick={() => onNavigate('struktur')}
            className="p-3.5 rounded-2xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition text-left group">
            <Users className="w-5 h-5 text-purple-500 mb-2 group-hover:scale-110 transition" />
            <p className="text-xs font-bold text-slate-800">Kerabat Kerja</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Hubungi tim via WhatsApp</p>
          </button>
        </div>
      </div>

      {/* 6. Progres Divisi — hanya muncul kalau ada tugas */}
      {tasks.length > 0 && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <h3 className="text-base font-extrabold text-slate-900 mb-3">
            Pemantauan Kemajuan Divisi Produksi
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DIVISIONS.slice(1).map((div) => {
              const divTasks = tasks.filter(t => t.divisionName === div.id);
              const divDone = divTasks.filter(t => t.status === 'APPROVED');
              const pct = divTasks.length > 0 ? Math.round((divDone.length / divTasks.length) * 100) : 0;

              return (
                <div key={div.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 truncate">{div.id}</span>
                    <span className="font-extrabold text-slate-900">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: div.color }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {divTasks.length > 0 ? `${divDone.length}/${divTasks.length} tugas selesai` : 'Belum ada tugas'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
