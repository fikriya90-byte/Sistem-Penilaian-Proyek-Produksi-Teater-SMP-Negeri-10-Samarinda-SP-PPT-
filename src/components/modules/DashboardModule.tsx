import React, { useState, useEffect } from 'react';
import {
  Sparkles, Award, Bell, BarChart3, BookOpen, Calendar, Send,
  Wallet, FileText, Timer, MessageSquare, Mic, Palette, Scissors,
  Camera, Flag, Users, CheckCircle, AlertTriangle, Layers,
  TrendingUp, ClipboardList, Target, Star, Play, Package, Music,
  RefreshCw, Plus, X, Save,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { DIVISIONS, STAGES, getPredikat } from '../../core/constants';
import { UserProfile, TaskItem, ScheduleEvent, AttendanceSession, AssessmentRecord, DivisionType, UserRole } from '../../core/types';
import {
  fetchUsersByClass, subscribeTasksByClass, subscribeSchedules,
  subscribeAttendanceSessions, subscribeAssessments, recordAuditLog,
} from '../../services/firestoreService';
import { doc, collection, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';

interface DashboardModuleProps {
  onNavigate: (module: string) => void;
}

// =====================================================
// HOOK: Dashboard Data
// =====================================================
function useDashboardData() {
  const { activeClass } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!activeClass) return;
    const u1 = subscribeTasksByClass(activeClass.id, setTasks);
    const u2 = subscribeSchedules(activeClass.id, setSchedules);
    const u3 = subscribeAttendanceSessions(activeClass.id, setSessions);
    const u4 = subscribeAssessments(activeClass.id, setAssessments);
    fetchUsersByClass(activeClass.id).then(setUsers);
    return () => { u1(); u2(); u3(); u4(); };
  }, [activeClass]);

  return { tasks, schedules, sessions, assessments, users };
}

// =====================================================
// Komponen: StatCard
// =====================================================
const StatCard: React.FC<{
  icon: any; label: string; value: string | number; sub?: string;
  color?: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'cyan' | 'indigo';
}> = ({ icon: Icon, label, value, sub, color = 'amber' }) => {
  const c = {
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  }[color];
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate">{label}</p>
        <p className="text-lg font-black text-slate-900 dark:text-white truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
};

// =====================================================
// Komponen: SectionTitle
// =====================================================
const SectionTitle: React.FC<{ icon: any; title: string; subtitle?: string }> =
  ({ icon: Icon, title, subtitle }) => (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      <div>
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );

// =====================================================
// Komponen: QuickAction
// =====================================================
const QuickAction: React.FC<{
  icon: any; label: string; sub: string; onClick: () => void;
}> = ({ icon: Icon, label, sub, onClick }) => (
  <button
    onClick={onClick}
    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/10 transition text-left group"
  >
    <Icon className="w-5 h-5 text-amber-500 dark:text-amber-400 mb-2 group-hover:scale-110 transition" />
    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{label}</p>
    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
  </button>
);

// =====================================================
// Komponen: TemplateCard (untuk Template Deadline)
// =====================================================
const TemplateCard: React.FC<{
  icon: any; label: string; sub: string; onClick: () => void;
  color?: 'blue' | 'amber' | 'purple' | 'rose' | 'emerald' | 'indigo';
}> = ({ icon: Icon, label, sub, onClick, color = 'blue' }) => {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
    rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30',
  };
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-2xl border-2 ${colorMap[color]} hover:scale-[1.02] transition text-left`}
    >
      <Icon className="w-5 h-5 mb-2" />
      <p className="text-xs font-extrabold text-slate-900 dark:text-white">{label}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>
    </button>
  );
};

// =====================================================
// Universal Header
// =====================================================
const UniversalHeader: React.FC = () => {
  const { user, activeClass } = useAuth();
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-6 sm:p-8 shadow-xl border border-amber-500/20 mb-5">
      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {activeClass?.name || 'Belum Ada Kelas'} - Proyek Seni Teater
          </span>
          <span className="text-xs text-slate-400 font-medium">Tahun Ajaran 2025/2026</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Selamat datang, {user?.displayName || 'Sahabat Teater'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
          <strong>{user?.role}</strong>
          {user?.divisionName ? ` - ${user.divisionName}` : ''}
          {activeClass ? ` - ${activeClass.name}` : ''}
        </p>
        <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10 max-w-xl text-xs text-amber-200/90 italic flex items-center gap-2">
          <span className="not-italic text-base">
            <MessageSquare className="w-4 h-4 inline text-amber-400" />
          </span>
          <span>"Teater bukan hanya seni berakting, melainkan cermin kedisiplinan, kejujuran jiwa, dan harmoni kerja sama."</span>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 1. GURU PENGAMPU DASHBOARD
// =====================================================
const GuruDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const { tasks, assessments, users, sessions } = useDashboardData();
  const [templateLoading, setTemplateLoading] = useState(false);

  const totalUsers = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin'
  ).length;

  const completedTasks = tasks.filter(t => t.status === 'APPROVED').length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.status === 'OVERDUE');
  const usersWithoutAssessment = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin' &&
    !assessments.find(a => a.studentId === u.uid)
  );

  // Fungsi buat deadline dari template
  const createDeadlineFromTemplate = async (
    title: string,
    description: string,
    daysFromNow: number,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    target: 'SEMUA' | 'DIVISI' | 'PERAN',
    targetDivision?: DivisionType,
    targetRole?: UserRole
  ) => {
    if (!user || !activeClass) return;
    setTemplateLoading(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysFromNow);
      dueDate.setHours(23, 59, 0, 0);

      const newRef = doc(collection(db, 'deadlines'));
      await setDoc(newRef, {
        id: newRef.id,
        classId: activeClass.id,
        title,
        description,
        dueDate: dueDate.toISOString(),
        priority,
        targetScope: target,
        targetDivision,
        targetRole,
        createdBy: user.uid,
        creatorName: user.displayName,
        creatorRole: user.role,
        createdAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Deadline',
        targetId: newRef.id,
        details: `Buat deadline template: ${title}`,
      });

      showToast(`Deadline "${title}" berhasil dibuat! Cek di menu Deadline.`, 'success');
      setTimeout(() => onNavigate('deadline'), 800);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setTemplateLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero Guru */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-700 via-amber-800 to-orange-900 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
          Dashboard Guru Pengampu
        </span>
        <h2 className="text-2xl font-black mt-1">Monitoring Produksi & Penilaian</h2>
        <p className="text-xs opacity-90 mt-1">
          Pantau progres, nilai, dan aktivitas seluruh divisi
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Siswa" value={totalUsers} color="blue" />
        <StatCard icon={CheckCircle} label="Tugas Selesai" value={`${completedTasks}/${tasks.length}`} color="emerald" sub={`${taskProgress}% selesai`} />
        <StatCard icon={AlertTriangle} label="Tugas Terlambat" value={overdueTasks.length} color="rose" />
        <StatCard icon={Award} label="Belum Dinilai" value={usersWithoutAssessment.length} color="amber" sub="Siswa tanpa nilai" />
      </div>

      {/* Progress Tahapan */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Layers} title="Progres Tahapan Produksi" subtitle="Status 4 tahap utama" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAGES.map(s => (
            <div key={s.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{s.id}</p>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{s.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Bobot: {s.defaultWeight}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Penilaian */}
      {usersWithoutAssessment.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
              Alert Penilaian - {usersWithoutAssessment.length} siswa belum dinilai
            </h3>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {usersWithoutAssessment.slice(0, 5).map(u => (
              <div key={u.uid} className="text-xs text-amber-800 dark:text-amber-200 bg-white/70 dark:bg-slate-800/70 p-2 rounded-lg flex items-center justify-between">
                <span className="truncate">
                  {u.displayName} <span className="text-amber-500 dark:text-amber-400">({u.role})</span>
                </span>
                <button onClick={() => onNavigate('nilai')}
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline shrink-0">
                  Nilai
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Deadline Cepat */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Timer} title="Template Deadline Cepat" subtitle="Klik untuk buat deadline otomatis - langsung terkirim ke siswa" />
        {templateLoading && (
          <div className="mb-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Mengirim deadline...
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <TemplateCard
            icon={MessageSquare}
            label="Rapat Pleno"
            sub="Semua siswa - 1 hari - Prioritas Kritis"
            color="blue"
            onClick={() => createDeadlineFromTemplate(
              'Rapat Pleno Koordinasi',
              'Rapat pleno seluruh tim produksi teater. Wajib hadir tepat waktu.',
              1, 'CRITICAL', 'SEMUA'
            )}
          />
          <TemplateCard
            icon={Mic}
            label="Latihan Rutin"
            sub="Pemain & Musik - 3 hari - Prioritas Tinggi"
            color="amber"
            onClick={() => createDeadlineFromTemplate(
              'Latihan Rutin Blocking',
              'Latihan rutin blocking dan dialog untuk seluruh pemain.',
              3, 'HIGH', 'DIVISI', 'Pemeran'
            )}
          />
          <TemplateCard
            icon={Palette}
            label="Produksi Divisi"
            sub="Semua divisi - 7 hari - Prioritas Sedang"
            color="purple"
            onClick={() => createDeadlineFromTemplate(
              'Produksi Internal Divisi',
              'Setiap divisi menyelesaikan pekerjaan internal sesuai jadwal.',
              7, 'MEDIUM', 'SEMUA'
            )}
          />
          <TemplateCard
            icon={Camera}
            label="Fitting & Rias"
            sub="Pemain - 5 hari - Prioritas Tinggi"
            color="rose"
            onClick={() => createDeadlineFromTemplate(
              'Fitting Kostum & Rias',
              'Fitting kostum dan uji coba rias untuk seluruh pemain.',
              5, 'HIGH', 'PERAN', undefined, 'Pemain'
            )}
          />
          <TemplateCard
            icon={Scissors}
            label="Desain Kostum"
            sub="Divisi Busana - 14 hari - Prioritas Sedang"
            color="emerald"
            onClick={() => createDeadlineFromTemplate(
              'Desain & Jahit Kostum',
              'Tim busana menyelesaikan desain, potong, dan jahit kostum seluruh tokoh.',
              14, 'MEDIUM', 'DIVISI', 'Tata Busana'
            )}
          />
          <TemplateCard
            icon={Flag}
            label="Gladi Resik"
            sub="Semua - 2 hari - Prioritas Kritis"
            color="indigo"
            onClick={() => createDeadlineFromTemplate(
              'Gladi Resik Panggung Penuh',
              'Gladi resik lengkap dengan kostum, properti, dan tata panggung. Wajib hadir.',
              2, 'CRITICAL', 'SEMUA'
            )}
          />
        </div>
      </div>
{/* WIDGET PROGRESS TUGAS */}
<div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-500 to-indigo-700 text-white shadow-lg">
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      <TrendingUp className="w-5 h-5" />
      <span className="text-sm font-bold">Progress Tugas Saya</span>
    </div>
    <span className="text-2xl font-black">
      {tasks.length > 0 ? Math.round((tasks.filter((t: any) => t.status === 'APPROVED').length / tasks.length) * 100) : 0}%
    </span>
  </div>
  <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
    <div className="h-full bg-white rounded-full transition-all"
      style={{ width: `${tasks.length > 0 ? Math.round((tasks.filter((t: any) => t.status === 'APPROVED').length / tasks.length) * 100) : 0}%` }} />
  </div>
  <button onClick={() => onNavigate('tugas')}
    className="mt-3 w-full py-2 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-xs">
    Lihat Detail Tugas →
  </button>
</div>
      {/* Aksi Cepat */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Award} label="Beri Nilai" sub="Semua siswa" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={Bell} label="Moderasi" sub="Cek anomali" onClick={() => onNavigate('moderasi')} />
          <QuickAction icon={BarChart3} label="Statistik" sub="Absensi & nilai" onClick={() => onNavigate('statistik-absensi')} />
          <QuickAction icon={BookOpen} label="Kelola Kelas" sub="Siswa & kode" onClick={() => onNavigate('kelola-kelas')} />
          <QuickAction icon={Calendar} label="Tahapan" sub="Deadline tahap" onClick={() => onNavigate('kelola-tahapan')} />
          <QuickAction icon={Send} label="Broadcast" sub="Kirim pesan" onClick={() => onNavigate('broadcast')} />
          <QuickAction icon={Wallet} label="Kas Produksi" sub="Lihat kas" onClick={() => onNavigate('kas')} />
          <QuickAction icon={FileText} label="Dokumen" sub="Arsip LPJ" onClick={() => onNavigate('dokumen')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 2. PIMPINAN PRODUKSI DASHBOARD
// =====================================================
const PimprodDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { tasks, sessions, users } = useDashboardData();

  const totalUsers = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin'
  ).length;

  const completedTasks = tasks.filter(t => t.status === 'APPROVED').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.status === 'OVERDUE');

  const divProgress = DIVISIONS.slice(1).map(d => {
    const dTasks = tasks.filter(t => t.divisionName === d.id);
    const done = dTasks.filter(t => t.status === 'APPROVED').length;
    return {
      id: d.id,
      color: d.color || '#94a3b8',
      total: dTasks.length,
      done,
      pct: dTasks.length > 0 ? Math.round((done / dTasks.length) * 100) : 0,
    };
  });

  const statusColor = progress >= 75 ? 'emerald' : progress >= 40 ? 'amber' : 'rose';
  const statusLabel = progress >= 75 ? 'On Track' : progress >= 40 ? 'Perlu Perhatian' : 'Kritis';

  return (
    <div className="space-y-5">
      <div className={`p-6 rounded-3xl bg-gradient-to-r text-white shadow-lg ${
        statusColor === 'emerald' ? 'from-emerald-700 to-emerald-900' :
        statusColor === 'amber' ? 'from-amber-700 to-amber-900' : 'from-rose-700 to-rose-900'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
              Kartu Komando Produksi
            </span>
            <h2 className="text-2xl font-black mt-1">Status Keseluruhan</h2>
            <p className="text-sm mt-1 opacity-90">
              Progres: <strong>{progress}%</strong> - Status: <span className="font-black">{statusLabel}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black">{progress}%</p>
            <p className="text-[11px] opacity-80">Penyelesaian Tugas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Anggota" value={totalUsers} color="blue" />
        <StatCard icon={CheckCircle} label="Tugas Selesai" value={`${completedTasks}/${tasks.length}`} color="emerald" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={overdueTasks.length} color="rose" />
        <StatCard icon={ClipboardList} label="Presensi Tim" value={sessions.length} color="cyan" sub="Sesi total" />
      </div>

      {/* Timeline */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Flag} title="Timeline Produksi" subtitle="4 tahapan utama produksi teater" />
        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
          <div className="absolute top-5 left-0 h-1 bg-amber-500 rounded-full transition-all" style={{ width: '45%' }} />
          <div className="relative grid grid-cols-4 gap-2">
            {STAGES.map((s, i) => {
              const isActive = i <= 1;
              return (
                <div key={s.id} className="flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white dark:border-slate-900 shadow-md ${
                    isActive ? 'bg-amber-500 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                  }`}>
                    <span className="font-black text-xs">{i + 1}</span>
                  </div>
                  <p className={`text-[10px] font-bold mt-2 ${isActive ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {s.id}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">{s.defaultWeight}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Progress Divisi */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Layers} title="Progress 6 Divisi Produksi" subtitle="Pantau divisi yang tertinggal" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {divProgress.map(d => (
            <div key={d.id} className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{d.id}</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{d.pct}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                {d.total > 0 ? `${d.done}/${d.total} tugas` : 'Belum ada tugas'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Kritis */}
      {overdueTasks.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
              Alert Kritis - {overdueTasks.length} Tugas Terlambat
            </h3>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {overdueTasks.slice(0, 5).map(t => (
              <div key={t.id} className="text-xs text-rose-800 dark:text-rose-200 bg-white/70 dark:bg-slate-800/70 p-2 rounded-lg flex items-center justify-between">
                <span className="truncate">{t.title} <span className="text-rose-500">({t.divisionName})</span></span>
                <button onClick={() => onNavigate('tugas')} className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline">
                  Lihat
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Award} label="Beri Nilai" sub="Sekretaris, Bendahara, Koor" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Buat Absensi" sub="Rapat & briefing" onClick={() => onNavigate('absensi')} />
          <QuickAction icon={Calendar} label="Tambah Jadwal" sub="Lintas divisi" onClick={() => onNavigate('jadwal')} />
          <QuickAction icon={Send} label="Broadcast" sub="Kirim pesan" onClick={() => onNavigate('broadcast')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 3. SUTRADARA DASHBOARD
// =====================================================
const SutradaraDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { tasks, assessments, users, sessions } = useDashboardData();
  const actors = users.filter(u => u.role === 'Pemain');

  const actorScores = actors.map(a => {
    const recs = assessments.filter(r => r.studentId === a.uid);
    const avg = recs.length > 0 ? recs.reduce((s, r) => s + r.totalScore, 0) / recs.length : 0;
    return { user: a, avg, hasScore: recs.length > 0 };
  });

  const needAttention = actorScores.filter(a => !a.hasScore || a.avg < 70);
  const rehearsalTasks = tasks.filter(t => t.divisionName === 'Pemeran');
  const rehearsalDone = rehearsalTasks.filter(t => t.status === 'APPROVED').length;
  const rehearsalPct = rehearsalTasks.length > 0 ? Math.round((rehearsalDone / rehearsalTasks.length) * 100) : 0;
  const attendanceSessions = sessions.filter(s => s.targetScope === 'PEMAIN_MUSIK');

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-800 to-rose-950 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Sutradara</span>
        <h2 className="text-2xl font-black mt-1">Latihan & Evaluasi Pemain</h2>
        <p className="text-xs opacity-90 mt-1">
          {actors.length} pemain - {rehearsalDone}/{rehearsalTasks.length} tugas latihan selesai
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Pemain" value={actors.length} color="rose" />
        <StatCard icon={Mic} label="Progres Latihan" value={`${rehearsalPct}%`} color="amber" sub={`${rehearsalDone}/${rehearsalTasks.length} tugas`} />
        <StatCard icon={AlertTriangle} label="Perlu Perhatian" value={needAttention.length} color="rose" />
        <StatCard icon={ClipboardList} label="Absensi Pemain" value={attendanceSessions.length} color="blue" />
      </div>

      <div className="p-5 rounded-3xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm">
        <SectionTitle icon={AlertTriangle} title="Pemain Perlu Perhatian Khusus" subtitle="Nilai < 70 atau belum ada nilai" />
        {needAttention.length === 0 ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 italic text-center py-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
            Semua pemain dalam kondisi baik
          </p>
        ) : (
          <div className="space-y-2">
            {needAttention.map(a => (
              <div key={a.user.uid} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-500/30">
                <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                  {a.user.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{a.user.displayName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {a.hasScore ? `Nilai: ${a.avg.toFixed(1)} - perlu bimbingan` : 'Belum ada nilai - segera evaluasi'}
                  </p>
                </div>
                <button onClick={() => onNavigate('nilai')}
                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-500/20 shrink-0">
                  Beri Nilai
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Award} label="Nilai Pemain" sub="6 kriteria akting" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Absensi Latihan" sub="Pemain + Musik" onClick={() => onNavigate('absensi')} />
          <QuickAction icon={Calendar} label="Jadwal Latihan" sub="Agenda akting" onClick={() => onNavigate('jadwal')} />
          <QuickAction icon={Sparkles} label="Prompt Book" sub="Blocking + Cue" onClick={() => onNavigate('studio')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 4. ASISTEN SUTRADARA DASHBOARD
// =====================================================
const AsistenDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { tasks, schedules, users, sessions } = useDashboardData();
  const actors = users.filter(u => u.role === 'Pemain');
  const upcoming = schedules
    .filter(s => new Date(s.startAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);
  const pemainSessions = sessions.filter(s => s.targetScope === 'PEMAIN_MUSIK');

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-800 to-indigo-900 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Asisten Sutradara</span>
        <h2 className="text-2xl font-black mt-1">Prompt Book & Catatan Latihan</h2>
        <p className="text-xs opacity-90 mt-1">Blocking, cue sheet, dan standby pertunjukan</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Play} label="Prompt Book" value="Aktif" color="purple" sub="Editor blocking 3x3" />
        <StatCard icon={FileText} label="Catatan Latihan" value={tasks.length} color="amber" sub="Update harian" />
        <StatCard icon={ClipboardList} label="Absensi Pemain" value={pemainSessions.length} color="blue" />
        <StatCard icon={Users} label="Status Pemain" value={actors.length} color="emerald" />
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Prompt Book & Blocking" subtitle="Editor posisi panggung 3x3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 text-purple-900 dark:text-purple-300 font-bold text-xs">
            Blocking Grid
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-300 font-bold text-xs">
            Cue Sheet
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-300 font-bold text-xs">
            Standby Cue
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 font-bold text-xs">
            Naskah
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-sm">
        <SectionTitle icon={Timer} title="Cue Berikutnya - Standby" subtitle="Persiapan jadwal mendatang" />
        {upcoming.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic text-center py-4">Belum ada jadwal.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(s.startAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} - {s.location}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Sparkles} label="Prompt Book" sub="Editor blocking" onClick={() => onNavigate('studio')} />
          <QuickAction icon={Award} label="Nilai Pemain" sub="Aspek teknis" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Absensi Pemain" sub="Pemain + Musik" onClick={() => onNavigate('absensi')} />
          <QuickAction icon={FileText} label="Catatan" sub="Upload evaluasi" onClick={() => onNavigate('dokumen')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 5. SEKRETARIS DASHBOARD
// =====================================================
const SekretarisDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { schedules, sessions, users } = useDashboardData();
  const today = new Date().toISOString().slice(0, 10);
  const todaySchedules = schedules.filter(s => new Date(s.startAt).toISOString().slice(0, 10) === today);
  const openSessions = sessions.filter(s => s.isOpen);
  const totalStudents = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' && u.role !== 'Admin' && u.role !== 'Super Admin'
  ).length;

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-800 to-slate-900 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Sekretaris</span>
        <h2 className="text-2xl font-black mt-1">Presensi & Administrasi</h2>
        <p className="text-xs opacity-90 mt-1">Kelola presensi, jadwal, arsip, dan LPJ</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ClipboardList} label="Sesi Terbuka" value={openSessions.length} color="emerald" />
        <StatCard icon={Calendar} label="Agenda Hari Ini" value={todaySchedules.length} color="blue" />
        <StatCard icon={FileText} label="Total Sesi" value={sessions.length} color="amber" />
        <StatCard icon={Users} label="Total Siswa" value={totalStudents} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <SectionTitle icon={Calendar} title="Agenda Hari Ini" />
          {todaySchedules.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Tidak ada jadwal hari ini.</p>
          ) : (
            <div className="space-y-2">
              {todaySchedules.map(s => (
                <div key={s.id} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{s.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(s.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {s.location}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <SectionTitle icon={ClipboardList} title="Sesi Presensi Aktif" />
          {openSessions.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Tidak ada sesi terbuka.</p>
          ) : (
            <div className="space-y-2">
              {openSessions.slice(0, 3).map(s => (
                <div key={s.id} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{s.activityType} - {s.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={ClipboardList} label="Isi Presensi" sub="Manual cepat" onClick={() => onNavigate('absensi')} />
          <QuickAction icon={Calendar} label="Buat Jadwal" sub="Rapat & briefing" onClick={() => onNavigate('jadwal')} />
          <QuickAction icon={FileText} label="Arsip Dokumen" sub="Upload & kelola" onClick={() => onNavigate('dokumen')} />
          <QuickAction icon={Send} label="Broadcast" sub="Pengumuman" onClick={() => onNavigate('broadcast')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 6. BENDAHARA DASHBOARD
// =====================================================
const BendaharaDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-800 to-slate-900 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Bendahara</span>
        <h2 className="text-2xl font-black mt-1">Kas Produksi & Keuangan</h2>
        <p className="text-xs opacity-90 mt-1">Kelola tagihan kas, verifikasi bayar, dan arsip nota</p>
      </div>

      <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
        <div className="flex items-center gap-3 flex-wrap">
          <Wallet className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">Modul Kas Produksi</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Buat tagihan, kirim reminder, verifikasi pembayaran, dan export laporan keuangan.
            </p>
          </div>
          <button onClick={() => onNavigate('kas')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0">
            Buka Kas
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Wallet} label="Buat Tagihan Kas" sub="Kirim ke siswa" onClick={() => onNavigate('kas')} />
          <QuickAction icon={Send} label="Reminder Kas" sub="Pengingat bayar" onClick={() => onNavigate('kas')} />
          <QuickAction icon={FileText} label="Arsip Nota" sub="Upload bukti" onClick={() => onNavigate('dokumen')} />
          <QuickAction icon={Send} label="Broadcast" sub="Info keuangan" onClick={() => onNavigate('broadcast')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 7. KOORDINATOR DASHBOARD (Generic)
// =====================================================
const KoordinatorDashboard: React.FC<DashboardModuleProps & { division: string }> =
  ({ onNavigate, division }) => {
  const { tasks, schedules, sessions, assessments, users } = useDashboardData();

  const divTasks = tasks.filter(t => t.divisionName === division);
  const divDone = divTasks.filter(t => t.status === 'APPROVED');
  const pct = divTasks.length > 0 ? Math.round((divDone.length / divTasks.length) * 100) : 0;
  const members = users.filter(u => u.divisionName === division && !u.role.startsWith('Koordinator'));
  const divSchedules = schedules.filter(s => s.divisionName === division);
  const divSessions = sessions.filter(s => s.targetDivisionName === division || s.targetScope === 'DIVISI');
  const overdue = divTasks.filter(t => t.status === 'OVERDUE');

  const memberScores = members.map(m => {
    const recs = assessments.filter(r => r.studentId === m.uid);
    const avg = recs.length > 0 ? recs.reduce((s, r) => s + r.totalScore, 0) / recs.length : 0;
    return { user: m, avg };
  });

  const divColors: Record<string, string> = {
    'Perlengkapan': 'from-blue-700 to-blue-900',
    'Publikasi & Dokumentasi': 'from-emerald-700 to-emerald-900',
    'Tata Panggung': 'from-purple-700 to-purple-900',
    'Tata Rias': 'from-pink-700 to-pink-900',
    'Tata Busana': 'from-indigo-700 to-indigo-900',
    'Tata Musik & Suara': 'from-cyan-700 to-cyan-900',
    'Pemeran': 'from-rose-700 to-rose-900',
  };
  const gradClass = divColors[division] || 'from-slate-700 to-slate-900';

  return (
    <div className="space-y-5">
      <div className={`p-6 rounded-3xl bg-gradient-to-r ${gradClass} text-white shadow-lg`}>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Koordinator</span>
        <h2 className="text-2xl font-black mt-1">{division}</h2>
        <p className="text-xs opacity-90 mt-1">
          Kelola {members.length} anggota - Progress: {pct}%
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Anggota" value={members.length} color="blue" />
        <StatCard icon={CheckCircle} label="Tugas Selesai" value={`${divDone.length}/${divTasks.length}`} color="emerald" />
        <StatCard icon={Calendar} label="Jadwal Internal" value={divSchedules.length} color="purple" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={overdue.length} color="rose" />
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon={Layers} title={`Progress ${division}`} />
          <span className="text-2xl font-black text-slate-900 dark:text-white">{pct}%</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Users} title="Anggota Divisi" subtitle="Nilai sementara" />
        {members.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Belum ada anggota.</p>
        ) : (
          <div className="space-y-2">
            {memberScores.map(m => (
              <div key={m.user.uid} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                  {m.user.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.user.displayName}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{m.user.role}</p>
                </div>
                {m.avg > 0 ? (
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">{m.avg.toFixed(1)}</span>
                ) : (
                  <button onClick={() => onNavigate('nilai')}
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                    Nilai
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Award} label="Nilai Anggota" sub="+ Sutradara" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Absensi Divisi" sub="Anggota" onClick={() => onNavigate('absensi')} />
          <QuickAction icon={Calendar} label="Jadwal Internal" sub="Agenda" onClick={() => onNavigate('jadwal')} />
          <QuickAction icon={Send} label="Broadcast" sub="Info anggota" onClick={() => onNavigate('broadcast')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 8. ANGGOTA DASHBOARD (Generic)
// =====================================================
const AnggotaDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { tasks, schedules, assessments } = useDashboardData();

  const myTasks = tasks.filter(t =>
    t.assigneeId === user?.uid ||
    (t.divisionName === user?.divisionName && !t.assigneeId)
  );
  const myDone = myTasks.filter(t => t.status === 'APPROVED');
  const myOverdue = myTasks.filter(t =>
    t.status === 'OVERDUE' || (t.status !== 'APPROVED' && new Date(t.dueDate).getTime() < Date.now())
  );

  const myAssessment = assessments.filter(a => a.studentId === user?.uid);
  const myAvg = myAssessment.length > 0
    ? myAssessment.reduce((s, a) => s + a.totalScore, 0) / myAssessment.length : 0;
  const myPred = myAvg > 0 ? getPredikat(myAvg) : null;

  const upcoming = schedules
    .filter(s => new Date(s.startAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-700 to-orange-800 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
          Dashboard {user?.role}
        </span>
        <h2 className="text-2xl font-black mt-1">Tugas & Progres Saya</h2>
        <p className="text-xs opacity-90 mt-1">
          Divisi: {user?.divisionName || '-'} - {myTasks.length} tugas
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CheckSquare} label="Tugas Selesai" value={`${myDone.length}/${myTasks.length}`} color="emerald" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={myOverdue.length} color="rose" />
        <StatCard icon={Award} label="Nilai Saya" value={myAvg > 0 ? myAvg.toFixed(1) : '-'} color="amber" />
        <StatCard icon={Calendar} label="Agenda Mendatang" value={upcoming.length} color="blue" />
      </div>

      {myAvg > 0 && myPred && (
        <div className={`p-5 rounded-3xl border-2 shadow-sm ${myPred.color}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase opacity-80">Nilai Sementara</p>
              <p className="text-4xl font-black mt-1 font-mono">{myAvg.toFixed(1)}</p>
              <p className="text-sm font-black mt-1">Predikat {myPred.predikat} - {myPred.label}</p>
            </div>
            <button onClick={() => onNavigate('nilai-saya')}
              className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white font-bold text-xs shadow-sm">
              Lihat Rapor
            </button>
          </div>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={CheckSquare} title="Tugas Saya" subtitle="Daftar tugas dari koordinator" />
        {myTasks.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Belum ada tugas.</p>
        ) : (
          <div className="space-y-2">
            {myTasks.slice(0, 5).map(t => (
              <div key={t.id} className={`p-3 rounded-xl border-l-4 ${
                t.status === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400' :
                t.status === 'OVERDUE' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-400' :
                'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Deadline: {new Date(t.dueDate).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <button onClick={() => onNavigate('tugas')}
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0">
                    Buka
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={CheckSquare} label="Tugas Saya" sub="Upload bukti" onClick={() => onNavigate('tugas')} />
          <QuickAction icon={Award} label="Nilai Saya" sub="Rapor lengkap" onClick={() => onNavigate('nilai-saya')} />
          <QuickAction icon={Star} label="Nilai Rekan" sub="Penilaian sejawat" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Presensi" sub="Kehadiran" onClick={() => onNavigate('absensi')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 9. PEMAIN DASHBOARD
// =====================================================
const PemainDashboard: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { tasks, schedules, assessments } = useDashboardData();

  const myAssessment = assessments.filter(a => a.studentId === user?.uid);
  const myAvg = myAssessment.length > 0
    ? myAssessment.reduce((s, a) => s + a.totalScore, 0) / myAssessment.length : 0;
  const myPred = myAvg > 0 ? getPredikat(myAvg) : null;

  const rehearsalTasks = tasks.filter(t =>
    t.divisionName === 'Pemeran' && (t.assigneeId === user?.uid || !t.assigneeId)
  );
  const rehearsalDone = rehearsalTasks.filter(t => t.status === 'APPROVED').length;
  const rehearsalPct = rehearsalTasks.length > 0 ? Math.round((rehearsalDone / rehearsalTasks.length) * 100) : 0;

  const upcomingRehearsals = schedules
    .filter(s => new Date(s.startAt).getTime() > Date.now() &&
      (s.participants.toLowerCase().includes('pemain') ||
       s.participants.toLowerCase().includes('pemeran') ||
       s.type === 'Latihan' || s.type === 'Gladi'))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-700 to-pink-900 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Pemain</span>
        <h2 className="text-2xl font-black mt-1">Naskah, Blocking & Latihan</h2>
        <p className="text-xs opacity-90 mt-1">
          Progres latihan: <strong>{rehearsalPct}%</strong> - {rehearsalDone}/{rehearsalTasks.length} tugas selesai
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Award} label="Nilai Saya" value={myAvg > 0 ? myAvg.toFixed(1) : '-'} color="rose" />
        <StatCard icon={TrendingUp} label="Progres Latihan" value={`${rehearsalPct}%`} color="amber" />
        <StatCard icon={Calendar} label="Latihan Mendatang" value={upcomingRehearsals.length} color="blue" />
        <StatCard icon={Star} label="Predikat" value={myPred?.predikat || '-'} color="emerald" />
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={BookOpen} title="Latihan Dialog & Blocking" subtitle="10 langkah dialog + rekam suara" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-300 font-bold text-xs">
            Naskah Digital
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 text-purple-900 dark:text-purple-300 font-bold text-xs">
            Blocking 3x3
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-300 font-bold text-xs">
            Rekam Suara
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 font-bold text-xs">
            10 Langkah
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Calendar} title="Latihan Mendatang" subtitle="Konfirmasi kehadiran di menu Jadwal" />
        {upcomingRehearsals.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Belum ada latihan.</p>
        ) : (
          <div className="space-y-2">
            {upcomingRehearsals.map(s => (
              <div key={s.id} className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(s.startAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} - {s.location}
                  </p>
                </div>
                <button onClick={() => onNavigate('jadwal')}
                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0">
                  Konfirmasi
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-sm">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">Refleksi Diri</h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Isi refleksi untuk penilaian tahap Pasca Produksi
            </p>
          </div>
          <button onClick={() => onNavigate('tugas')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0">
            Isi
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Award} label="Nilai Saya" sub="Rapor lengkap" onClick={() => onNavigate('nilai-saya')} />
          <QuickAction icon={Star} label="Nilai Rekan" sub="Penilaian sejawat" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Presensi" sub="Kehadiran" onClick={() => onNavigate('absensi')} />
          <QuickAction icon={Timer} label="Deadline" sub="Tenggat waktu" onClick={() => onNavigate('deadline')} />
        </div>
      </div>
    </div>
  );
};

// =====================================================
// MAIN DASHBOARD MODULE — ROUTER
// =====================================================
export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { user, isGuruPengampu, isAdminRole } = useAuth();
  const role = user?.role || '';

  const renderRoleDashboard = () => {
    if (isGuruPengampu && !isAdminRole) {
      return <GuruDashboard onNavigate={onNavigate} />;
    }

    switch (role) {
      case 'Pimpinan Produksi': return <PimprodDashboard onNavigate={onNavigate} />;
      case 'Sutradara': return <SutradaraDashboard onNavigate={onNavigate} />;
      case 'Asisten Sutradara': return <AsistenDashboard onNavigate={onNavigate} />;
      case 'Sekretaris': return <SekretarisDashboard onNavigate={onNavigate} />;
      case 'Bendahara': return <BendaharaDashboard onNavigate={onNavigate} />;

      case 'Koordinator Perlengkapan': return <KoordinatorDashboard onNavigate={onNavigate} division="Perlengkapan" />;
      case 'Koordinator Publikasi': return <KoordinatorDashboard onNavigate={onNavigate} division="Publikasi & Dokumentasi" />;
      case 'Koordinator Tata Panggung': return <KoordinatorDashboard onNavigate={onNavigate} division="Tata Panggung" />;
      case 'Koordinator Tata Rias': return <KoordinatorDashboard onNavigate={onNavigate} division="Tata Rias" />;
      case 'Koordinator Tata Busana': return <KoordinatorDashboard onNavigate={onNavigate} division="Tata Busana" />;
      case 'Koordinator Tata Musik': return <KoordinatorDashboard onNavigate={onNavigate} division="Tata Musik & Suara" />;

      case 'Anggota Perlengkapan':
      case 'Anggota Publikasi':
      case 'Anggota Tata Panggung':
      case 'Anggota Tata Rias':
      case 'Anggota Tata Busana':
      case 'Anggota Tata Musik':
        return <AnggotaDashboard onNavigate={onNavigate} />;

      case 'Pemain': return <PemainDashboard onNavigate={onNavigate} />;

      default: return <GuruDashboard onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <UniversalHeader />
      {renderRoleDashboard()}
    </div>
  );
};
