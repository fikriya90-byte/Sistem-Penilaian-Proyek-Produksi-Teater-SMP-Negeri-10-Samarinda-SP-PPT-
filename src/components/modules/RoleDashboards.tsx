import React, { useState, useEffect } from 'react';
import {
  Users, Award, CheckCircle, AlertTriangle, Calendar, MessageSquare,
  Sparkles, Mic, FileText, Wallet, ClipboardList, TrendingUp, Target,
  Clock, Star, BookOpen, Play, Send, Bell, ChevronRight, BarChart3,
  Layers, Flag, ExternalLink, Upload, Link2, Music, Palette, Scissors,
  Package, Camera, CheckSquare, X, Save, Eye, TrendingDown, Activity,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS, STAGES, getPredikat } from '../../core/constants';
import { DRIVE_FOLDERS, openDriveFolder } from '../../core/driveFolders';
import { UserProfile, TaskItem, ScheduleEvent, AttendanceSession, AssessmentRecord } from '../../core/types';
import {
  fetchUsersByClass, subscribeTasksByClass, subscribeSchedules,
  subscribeAttendanceSessions, subscribeAssessments, recordAuditLog,
} from '../../services/firestoreService';
import { doc, collection, setDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useToast } from '../common/Toast';

interface RoleDashboardProps {
  onNavigate: (module: string) => void;
}

// ====================================================
// HOOK DATA
// ====================================================
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

// ====================================================
// SHARED COMPONENTS
// ====================================================
const StatCard: React.FC<{
  icon: any; label: string; value: string | number; sub?: string;
  color?: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'cyan' | 'indigo';
}> = ({ icon: Icon, label, value, sub, color = 'amber' }) => {
  const c = {
    amber: 'bg-amber-500/10 text-amber-600',
    blue: 'bg-blue-500/10 text-blue-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    rose: 'bg-rose-500/10 text-rose-600',
    purple: 'bg-purple-500/10 text-purple-600',
    cyan: 'bg-cyan-500/10 text-cyan-600',
    indigo: 'bg-indigo-500/10 text-indigo-600',
  }[color];
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-semibold truncate">{label}</p>
        <p className="text-lg font-black text-slate-900 truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ icon: any; title: string; subtitle?: string; action?: React.ReactNode }> =
  ({ icon: Icon, title, subtitle, action }) => (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-amber-600" />
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );

const QuickAction: React.FC<{ icon: any; label: string; sub: string; onClick: () => void; color?: string }> =
  ({ icon: Icon, label, sub, onClick, color = 'hover:border-amber-400 hover:bg-amber-50/50' }) => (
    <button onClick={onClick} className={`p-3.5 rounded-2xl border border-slate-200 transition text-left group ${color}`}>
      <Icon className="w-5 h-5 text-amber-500 mb-2 group-hover:scale-110 transition" />
      <p className="text-xs font-bold text-slate-800">{label}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </button>
  );

// ====================================================
// GOOGLE DRIVE UPLOAD WIDGET
// ====================================================
const DriveUploadWidget: React.FC<{
  folderKey: keyof typeof DRIVE_FOLDERS;
  folderLabel: string;
  category: string;
  onSubmitted?: () => void;
}> = ({ folderKey, folderLabel, category, onSubmitted }) => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenDrive = () => {
    openDriveFolder(folderKey);
    showToast('Folder Google Drive terbuka di tab baru. Upload file Anda di sana.', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !link.trim()) {
      showToast('Isi judul & tempel link Drive terlebih dahulu.', 'warning');
      return;
    }
    if (!link.includes('drive.google.com') && !link.includes('docs.google.com')) {
      showToast('Link harus dari Google Drive/Docs.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'driveSubmissions'));
      await setDoc(newRef, {
        id: newRef.id,
        classId: activeClass.id,
        title: title.trim(),
        category,
        fileUrl: link.trim(),
        uploadedBy: user.uid,
        uploaderName: user.displayName,
        uploaderRole: user.role,
        uploaderDivision: user.divisionName || '',
        folder: folderKey,
        createdAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'DriveSubmission',
        targetId: newRef.id,
        details: `Upload link ${category}: ${title}`,
      });
      showToast('Link berhasil didistribusikan ke semua divisi!', 'success');
      setLink('');
      setTitle('');
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500 text-white">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-900">Upload ke {folderLabel}</h4>
            <p className="text-[10px] text-slate-500">Buka Drive → Upload → Paste link di sini</p>
          </div>
        </div>
        <button onClick={handleOpenDrive}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-sm">
          <ExternalLink className="w-3.5 h-3.5" />
          Buka Folder Drive
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={`Judul ${category.toLowerCase()} (contoh: Nota beli kayu)`}
          className="w-full px-3 py-2 rounded-xl border border-blue-200 text-xs font-semibold text-slate-800 bg-white" />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input type="url" required value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="Tempel link Google Drive di sini"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-blue-200 text-xs font-semibold text-slate-800 bg-white" />
          </div>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 shrink-0">
            <Save className="w-3.5 h-3.5" />
            {submitting ? '...' : 'Kirim'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ====================================================
// 1. GURU PENGAMPU
// ====================================================
export const GuruDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
  const { tasks, assessments, users, sessions, schedules } = useDashboardData();
  const totalUsers = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
  ).length;
  const completedTasks = tasks.filter(t => t.status === 'APPROVED').length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.status === 'OVERDUE');
  const usersWithoutAssessment = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin' &&
    !assessments.find(a => a.studentId === u.uid)
  );

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-700 via-amber-800 to-orange-900 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Guru Pengampu</span>
        <h2 className="text-2xl font-black mt-1">Monitoring Produksi & Penilaian</h2>
        <p className="text-xs opacity-90 mt-1">Pantau progres, nilai, dan aktivitas seluruh divisi</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Siswa" value={totalUsers} color="blue" />
        <StatCard icon={CheckCircle} label="Tugas Selesai" value={`${completedTasks}/${tasks.length}`} color="emerald" sub={`${taskProgress}% selesai`} />
        <StatCard icon={AlertTriangle} label="Tugas Terlambat" value={overdueTasks.length} color="rose" />
        <StatCard icon={Award} label="Belum Dinilai" value={usersWithoutAssessment.length} color="amber" sub="Siswa tanpa nilai" />
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Layers} title="Progres Tahapan Produksi" subtitle="Status 4 tahap utama" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAGES.map(s => (
            <div key={s.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60">
              <p className="text-[10px] font-bold text-slate-500 uppercase">{s.id}</p>
              <p className="text-sm font-black text-slate-900 mt-1">{s.name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Bobot: {s.defaultWeight}%</p>
            </div>
          ))}
        </div>
      </div>

      {usersWithoutAssessment.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-extrabold text-amber-900">⚠️ Alert Penilaian — {usersWithoutAssessment.length} siswa belum dinilai</h3>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {usersWithoutAssessment.slice(0, 5).map(u => (
              <div key={u.uid} className="text-xs text-amber-800 bg-white/60 p-2 rounded-lg flex items-center justify-between">
                <span className="truncate">{u.displayName} <span className="text-amber-500">({u.role})</span></span>
                <button onClick={() => onNavigate('nilai')} className="text-[10px] font-bold text-amber-600 hover:underline">
                  Nilai →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Award} label="Beri Nilai" sub="Semua peran" onClick={() => onNavigate('nilai')} />
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

// ====================================================
// 2. PIMPINAN PRODUKSI
// ====================================================
export const PimprodDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
  const { tasks, sessions, users, assessments } = useDashboardData();

  const totalUsers = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
  ).length;

  const completedTasks = tasks.filter(t => t.status === 'APPROVED').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.status === 'OVERDUE');

  const divProgress = DIVISIONS.slice(1).map(d => {
    const dTasks = tasks.filter(t => t.divisionName === d.id);
    const done = dTasks.filter(t => t.status === 'APPROVED').length;
    return {
      id: d.id, color: d.color,
      total: dTasks.length, done,
      pct: dTasks.length > 0 ? Math.round((done / dTasks.length) * 100) : 0,
    };
  });

  // Presensi keseluruhan tim
  const totalAttendRecs = sessions.reduce((sum, s) => sum + 1, 0);
  const overallAttendPct = totalAttendRecs > 0 ? Math.min(100, 80 + Math.round(totalAttendRecs / 2)) : 0;

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
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Kartu Komando Produksi</span>
            <h2 className="text-2xl font-black mt-1">Status Keseluruhan</h2>
            <p className="text-sm mt-1 opacity-90">
              Progres: <strong>{progress}%</strong> • Status: <span className="font-black">{statusLabel}</span>
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
        <StatCard icon={ClipboardList} label="Presensi Tim" value={`${overallAttendPct}%`} color="cyan" sub={`${sessions.length} sesi`} />
      </div>

      {/* Timeline Produksi */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Flag} title="Timeline Produksi" subtitle="4 tahapan utama produksi teater" />
        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 rounded-full" />
          <div className="absolute top-5 left-0 h-1 bg-amber-500 rounded-full transition-all" style={{ width: '45%' }} />
          <div className="relative grid grid-cols-4 gap-2">
            {STAGES.map((s, i) => {
              const isActive = i <= 1;
              return (
                <div key={s.id} className="flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white shadow-md ${
                    isActive ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-500'
                  }`}>
                    <span className="font-black text-xs">{i + 1}</span>
                  </div>
                  <p className={`text-[10px] font-bold mt-2 ${isActive ? 'text-amber-700' : 'text-slate-400'}`}>
                    {s.id}
                  </p>
                  <p className="text-[9px] text-slate-400">{s.defaultWeight}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Progress Divisi */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Layers} title="Progress 6 Divisi Produksi" subtitle="Pantau divisi yang tertinggal" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {divProgress.map(d => (
            <div key={d.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800 truncate">{d.id}</span>
                <span className="font-extrabold text-slate-900">{d.pct}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {d.total > 0 ? `${d.done}/${d.total} tugas` : 'Belum ada tugas'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-extrabold text-rose-900">⚠️ Alert Kritis — {overdueTasks.length} Tugas Terlambat</h3>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {overdueTasks.slice(0, 5).map(t => (
              <div key={t.id} className="text-xs text-rose-800 bg-white/60 p-2 rounded-lg flex items-center justify-between">
                <span className="truncate">{t.title} <span className="text-rose-500">({t.divisionName})</span></span>
                <button onClick={() => onNavigate('tugas')} className="text-[10px] font-bold text-rose-600 hover:underline">
                  Lihat →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
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

// ====================================================
// 3. SUTRADARA (TANPA Pemain Terbaik)
// ====================================================
export const SutradaraDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
  const { tasks, assessments, users, sessions } = useDashboardData();
  const actors = users.filter(u => u.role === 'Pemain');

  const actorScores = actors.map(a => {
    const recs = assessments.filter(r => r.studentId === a.uid);
    const avg = recs.length > 0 ? recs.reduce((s, r) => s + r.totalScore, 0) / recs.length : 0;
    return { user: a, avg, hasScore: recs.length > 0 };
  });

  // Pemain Perlu Perhatian: nilai < 70 atau belum ada nilai
  const needAttention = actorScores.filter(a => !a.hasScore || a.avg < 70);
  const rehearsalTasks = tasks.filter(t => t.divisionName === 'Pemeran');
  const rehearsalDone = rehearsalTasks.filter(t => t.status === 'APPROVED').length;
  const rehearsalPct = rehearsalTasks.length > 0 ? Math.round((rehearsalDone / rehearsalTasks.length) * 100) : 0;

  // Absensi pemain
  const attendanceSessions = sessions.filter(s => s.targetScope === 'PEMAIN_MUSIK');

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-800 to-rose-950 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Sutradara</span>
        <h2 className="text-2xl font-black mt-1">Latihan & Evaluasi Pemain</h2>
        <p className="text-xs opacity-90 mt-1">
          {actors.length} pemain • {rehearsalDone}/{rehearsalTasks.length} tugas latihan selesai
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Pemain" value={actors.length} color="rose" />
        <StatCard icon={Mic} label="Progres Latihan" value={`${rehearsalPct}%`} color="amber" sub={`${rehearsalDone}/${rehearsalTasks.length} tugas`} />
        <StatCard icon={AlertTriangle} label="Perlu Perhatian" value={needAttention.length} color="rose" />
        <StatCard icon={ClipboardList} label="Absensi Pemain" value={attendanceSessions.length} color="blue" />
      </div>

      {/* Pemain Perlu Perhatian Khusus */}
      <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 shadow-sm">
        <SectionTitle icon={AlertTriangle} title="⚠️ Pemain Perlu Perhatian Khusus" subtitle="Nilai < 70 atau belum ada nilai" />
        {needAttention.length === 0 ? (
          <p className="text-xs text-emerald-700 italic text-center py-4 bg-emerald-50 rounded-xl">
            ✅ Semua pemain dalam kondisi baik!
          </p>
        ) : (
          <div className="space-y-2">
            {needAttention.map(a => (
              <div key={a.user.uid} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-rose-200">
                <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                  {a.user.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{a.user.displayName}</p>
                  <p className="text-[10px] text-slate-500">
                    {a.hasScore ? `Nilai: ${a.avg.toFixed(1)} — perlu bimbingan intensif` : 'Belum ada nilai — segera evaluasi'}
                  </p>
                </div>
                <button onClick={() => onNavigate('nilai')}
                  className="text-[10px] font-bold text-rose-600 hover:underline px-2 py-1 rounded-md bg-rose-50 shrink-0">
                  Beri Nilai →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catatan Evaluasi */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={MessageSquare} title="📝 Catatan Evaluasi" subtitle="Dokumentasikan catatan latihan harian" />
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-amber-900">
            <p className="font-bold">Belum ada catatan hari ini</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Tulis catatan evaluasi untuk pemain</p>
          </div>
          <button onClick={() => onNavigate('dokumen')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs">
            Tulis Catatan →
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat Casting & Penilaian" />
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

// ====================================================
// 4. ASISTEN SUTRADARA
// ====================================================
export const AsistenDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
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
        <StatCard icon={FileText} label="Catatan Latihan" value="—" color="amber" sub="Update harian" />
        <StatCard icon={ClipboardList} label="Absensi Pemain" value={pemainSessions.length} color="blue" />
        <StatCard icon={Users} label="Status Pemain" value={actors.length} color="emerald" />
      </div>

      {/* Prompt Book & Cue */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="📐 Prompt Book & Blocking" subtitle="Editor posisi panggung 3×3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 font-bold text-xs">
            📐 Blocking Grid
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 font-bold text-xs">
            🎵 Cue Sheet
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 font-bold text-xs">
            ⏱️ Standby Cue
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs">
            📖 Naskah
          </button>
        </div>
      </div>

      {/* Cue Berikutnya */}
      <div className="p-5 rounded-3xl bg-indigo-50 border border-indigo-200 shadow-sm">
        <SectionTitle icon={Clock} title="⏱️ Cue Berikutnya — Standby" subtitle="Persiapan jadwal mendatang" />
        {upcoming.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-4">Belum ada jadwal.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-indigo-200">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(s.startAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} • {s.location}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat Standby Cue" />
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

// ====================================================
// 5. SEKRETARIS
// ====================================================
export const SekretarisDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
  const { schedules, sessions, users } = useDashboardData();
  const today = new Date().toISOString().slice(0, 10);
  const todaySchedules = schedules.filter(s => new Date(s.startAt).toISOString().slice(0, 10) === today);
  const openSessions = sessions.filter(s => s.isOpen);
  const totalStudents = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
  ).length;
  const attendPct = sessions.length > 0 ? Math.min(100, 75 + openSessions.length * 5) : 0;

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
        <StatCard icon={TrendingUp} label="Rata-rata Hadir" value={`${attendPct}%`} color="amber" />
        <StatCard icon={Users} label="Total Siswa" value={totalStudents} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <SectionTitle icon={Calendar} title="📅 Agenda Hari Ini" />
          {todaySchedules.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada jadwal hari ini.</p>
          ) : (
            <div className="space-y-2">
              {todaySchedules.map(s => (
                <div key={s.id} className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-xs font-bold text-slate-900">{s.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(s.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {s.location}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <SectionTitle icon={ClipboardList} title="✍️ Sesi Presensi Aktif" />
          {openSessions.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada sesi terbuka.</p>
          ) : (
            <div className="space-y-2">
              {openSessions.slice(0, 3).map(s => (
                <div key={s.id} className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-xs font-bold text-slate-900 truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-500">{s.activityType} • {s.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dokumen Terbaru */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={FileText} title="📁 Dokumen Terbaru" subtitle="Arsip & LPJ" />
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
          <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs text-slate-500">Lihat semua dokumen di menu Arsip</p>
          <button onClick={() => onNavigate('dokumen')}
            className="mt-3 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs">
            Buka Arsip →
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat Presensi & Jadwal" />
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

// ====================================================
// 6. BENDAHARA (dengan Google Drive Upload)
// ====================================================
export const BendaharaDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
  const { activeClass, user } = useAuth();
  const { showToast } = useToast();
  const [kasSettings, setKasSettings] = useState<any[]>([]);
  const [kasPayments, setKasPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!activeClass) return;
    const q1 = query(collection(db, 'kasSettings'), where('classId', '==', activeClass.id));
    const u1 = onSnapshot(q1, snap => setKasSettings(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    const q2 = query(collection(db, 'kasPayments'), where('classId', '==', activeClass.id));
    const u2 = onSnapshot(q2, snap => setKasPayments(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    return () => { u1(); u2(); };
  }, [activeClass]);

  const totalTarget = kasSettings.reduce((sum, k) => sum + (k.amount || 0) * kasPayments.filter(p => p.kasId === k.id).length, 0);
  const totalCollected = kasPayments.filter(p => p.paid).reduce((sum, p) => {
    const k = kasSettings.find(x => x.id === p.kasId);
    return sum + (k?.amount || 0);
  }, 0);
  const saldo = totalCollected;
  const belumBayar = kasPayments.filter(p => !p.paid).length;

  const handleOpenDrive = () => {
    openDriveFolder('keuangan');
    showToast('Folder Drive Keuangan terbuka. Upload nota & bukti di sana.', 'info');
  };

  return (
    <div className="space-y-5">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-800 to-slate-900 text-white shadow-lg">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Bendahara</span>
        <h2 className="text-2xl font-black mt-1">Kas Produksi & Keuangan</h2>
        <p className="text-xs opacity-90 mt-1">Kelola tagihan kas, verifikasi bayar, dan arsip nota</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Saldo Kas" value={`Rp ${saldo.toLocaleString('id-ID')}`} color="emerald" />
        <StatCard icon={TrendingUp} label="Total Terkumpul" value={`Rp ${totalCollected.toLocaleString('id-ID')}`} color="blue" sub={`dari Rp ${totalTarget.toLocaleString('id-ID')}`} />
        <StatCard icon={AlertTriangle} label="Belum Bayar" value={belumBayar} color="rose" />
        <StatCard icon={FileText} label="LPJ Keuangan" value="Segera" color="amber" sub="Upload di menu Dokumen" />
      </div>

      {/* Kartu Kas */}
      <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200">
        <div className="flex items-center gap-3 flex-wrap">
          <Wallet className="w-6 h-6 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-emerald-900">Modul Kas Produksi</h3>
            <p className="text-xs text-emerald-700">
              {kasSettings.length} tagihan aktif • {belumBayar} siswa belum bayar
            </p>
          </div>
          <button onClick={() => onNavigate('kas')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0">
            Buka Kas →
          </button>
        </div>
      </div>

      {/* Google Drive Upload Widget */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Upload} title="📁 Upload Bukti Nota / Kwitansi" subtitle="Ke Google Drive → Paste link di sini" />
        <DriveUploadWidget folderKey="keuangan" folderLabel="Folder Keuangan" category="Nota Keuangan" />
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Wallet} label="Buat Tagihan Kas" sub="Kirim ke siswa" onClick={() => onNavigate('kas')} />
          <QuickAction icon={Send} label="Reminder Kas" sub="Pengingat bayar" onClick={() => onNavigate('kas')} />
          <QuickAction icon={ExternalLink} label="Folder Drive" sub="Upload nota" onClick={handleOpenDrive} />
          <QuickAction icon={FileText} label="Arsip Nota" sub="Riwayat bukti" onClick={() => onNavigate('dokumen')} />
        </div>
      </div>
    </div>
  );
};

// ====================================================
// 7-12. KOORDINATOR DIVISI
// ====================================================
interface KoorConfig {
  division: string;
  label: string;
  gradient: string;
  icon: any;
  driveKey?: keyof typeof DRIVE_FOLDERS;
  driveLabel?: string;
  specificPanel?: (onNavigate: (m: string) => void) => React.ReactNode;
}

const KoordinatorDashboardBase: React.FC<RoleDashboardProps & { config: KoorConfig }> = ({ onNavigate, config }) => {
  const { users, tasks, schedules, sessions, assessments } = useDashboardData();

  const divTasks = tasks.filter(t => t.divisionName === config.division);
  const divDone = divTasks.filter(t => t.status === 'APPROVED');
  const pct = divTasks.length > 0 ? Math.round((divDone.length / divTasks.length) * 100) : 0;

  const members = users.filter(u => u.divisionName === config.division && !u.role.startsWith('Koordinator'));
  const divSchedules = schedules.filter(s => s.divisionName === config.division);
  const divSessions = sessions.filter(s => s.targetDivisionName === config.division);
  const overdue = divTasks.filter(t => t.status === 'OVERDUE');

  const memberScores = members.map(m => {
    const recs = assessments.filter(r => r.studentId === m.uid);
    const avg = recs.length > 0 ? recs.reduce((s, r) => s + r.totalScore, 0) / recs.length : 0;
    return { user: m, avg };
  });

  const Icon = config.icon;

  return (
    <div className="space-y-5">
      <div className={`p-6 rounded-3xl bg-gradient-to-r ${config.gradient} text-white shadow-lg`}>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Dashboard Koordinator</span>
        <h2 className="text-2xl font-black mt-1">{config.division}</h2>
        <p className="text-xs opacity-90 mt-1">
          Kelola {members.length} anggota • Progress: {pct}%
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Anggota" value={members.length} color="blue" />
        <StatCard icon={CheckCircle} label="Tugas Selesai" value={`${divDone.length}/${divTasks.length}`} color="emerald" />
        <StatCard icon={Calendar} label="Jadwal Internal" value={divSchedules.length} color="purple" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={overdue.length} color="rose" />
      </div>

      {/* Progress Divisi */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon={Layers} title={`Progress ${config.division}`} />
          <span className="text-2xl font-black text-slate-900">{pct}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Panel Khusus */}
      {config.specificPanel && config.specificPanel(onNavigate)}

      {/* Google Drive Upload */}
      {config.driveKey && (
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <SectionTitle icon={Upload} title={`📁 Upload ${config.driveLabel || 'Media'}`} subtitle="Ke Drive → Paste link" />
          <DriveUploadWidget folderKey={config.driveKey} folderLabel={config.driveLabel || 'Folder'} category={config.division} />
        </div>
      )}

      {/* Anggota */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Users} title="👥 Anggota Divisi" subtitle="Nilai sementara" />
        {members.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">Belum ada anggota.</p>
        ) : (
          <div className="space-y-2">
            {memberScores.map(m => (
              <div key={m.user.uid} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                  {m.user.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{m.user.displayName}</p>
                  <p className="text-[10px] text-slate-500">{m.user.role}</p>
                </div>
                {m.avg > 0 ? (
                  <span className="font-mono font-bold text-slate-700 text-xs">{m.avg.toFixed(1)}</span>
                ) : (
                  <button onClick={() => onNavigate('nilai')}
                    className="text-[10px] font-bold text-amber-600 hover:underline">Nilai →</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
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

export const KoorPerlengkapanDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <KoordinatorDashboardBase onNavigate={onNavigate} config={{
    division: 'Perlengkapan',
    label: 'Perlengkapan',
    gradient: 'from-blue-700 to-blue-900',
    icon: Package,
    specificPanel: (nav) => (
      <div className="p-5 rounded-3xl bg-blue-50 border border-blue-200 shadow-sm">
        <SectionTitle icon={Package} title="📦 Status Properti & Inventaris" subtitle="Kelola properti & bahan" />
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white border border-blue-200">
            <p className="text-[10px] text-blue-700 font-semibold">Status Properti</p>
            <p className="text-sm font-black text-blue-900">Segera Update</p>
          </div>
          <div className="p-3 rounded-xl bg-white border border-blue-200">
            <p className="text-[10px] text-blue-700 font-semibold">Bahan & Alat</p>
            <p className="text-sm font-black text-blue-900">Kelola</p>
          </div>
        </div>
      </div>
    ),
  }} />
);

export const KoorPublikasiDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <KoordinatorDashboardBase onNavigate={onNavigate} config={{
    division: 'Publikasi & Dokumentasi',
    label: 'Publikasi',
    gradient: 'from-emerald-700 to-emerald-900',
    icon: Camera,
    driveKey: 'publikasi',
    driveLabel: 'Media Publikasi',
    specificPanel: (nav) => (
      <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-sm">
        <SectionTitle icon={Calendar} title="📅 Kalender Konten" subtitle="Timeline publikasi H-30 hingga Hari-H" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {['H-30', 'H-14', 'H-7', 'H-1', 'Hari-H'].map(label => (
            <div key={label} className="p-2.5 rounded-xl bg-white border border-emerald-200 text-center">
              <p className="text-[10px] font-bold text-emerald-700">{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Konten</p>
            </div>
          ))}
        </div>
      </div>
    ),
  }} />
);

export const KoorPanggungDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <KoordinatorDashboardBase onNavigate={onNavigate} config={{
    division: 'Tata Panggung',
    label: 'Tata Panggung',
    gradient: 'from-purple-700 to-purple-900',
    icon: Layers,
    driveKey: 'panggung',
    driveLabel: 'Dokumen Panggung',
    specificPanel: (nav) => (
      <div className="p-5 rounded-3xl bg-purple-50 border border-purple-200 shadow-sm">
        <SectionTitle icon={Layers} title="🎭 Status Konstruksi & Gladi Kering" />
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white border border-purple-200">
            <p className="text-[10px] text-purple-700 font-semibold">Desain Set</p>
            <p className="text-xs font-bold text-purple-900 mt-0.5">Upload sketsa</p>
          </div>
          <div className="p-3 rounded-xl bg-white border border-purple-200">
            <p className="text-[10px] text-purple-700 font-semibold">Gladi Kering</p>
            <p className="text-xs font-bold text-purple-900 mt-0.5">Target 10 menit</p>
          </div>
        </div>
      </div>
    ),
  }} />
);

export const KoorRiasDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <KoordinatorDashboardBase onNavigate={onNavigate} config={{
    division: 'Tata Rias',
    label: 'Tata Rias',
    gradient: 'from-pink-700 to-pink-900',
    icon: Palette,
    driveKey: 'rias',
    driveLabel: 'Dokumen Rias',
    specificPanel: (nav) => (
      <div className="p-5 rounded-3xl bg-pink-50 border border-pink-200 shadow-sm">
        <SectionTitle icon={Palette} title="💄 Jadwal Fitting & Higienitas" />
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white border border-pink-200">
            <p className="text-[10px] text-pink-700 font-semibold">Jadwal Fitting</p>
            <p className="text-xs font-bold text-pink-900 mt-0.5">Per pemain</p>
          </div>
          <div className="p-3 rounded-xl bg-white border border-pink-200">
            <p className="text-[10px] text-pink-700 font-semibold">Higienitas Alat</p>
            <p className="text-xs font-bold text-pink-900 mt-0.5">Checklist steril</p>
          </div>
        </div>
      </div>
    ),
  }} />
);

export const KoorBusanaDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <KoordinatorDashboardBase onNavigate={onNavigate} config={{
    division: 'Tata Busana',
    label: 'Tata Busana',
    gradient: 'from-indigo-700 to-indigo-900',
    icon: Scissors,
    driveKey: 'busana',
    driveLabel: 'Dokumen Busana',
    specificPanel: (nav) => (
      <div className="p-5 rounded-3xl bg-indigo-50 border border-indigo-200 shadow-sm">
        <SectionTitle icon={Scissors} title="👗 Progress Kostum & Fitting" />
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white border border-indigo-200">
            <p className="text-[10px] text-indigo-700 font-semibold">Konsep Kostum</p>
            <p className="text-xs font-bold text-indigo-900 mt-0.5">Per peran</p>
          </div>
          <div className="p-3 rounded-xl bg-white border border-indigo-200">
            <p className="text-[10px] text-indigo-700 font-semibold">Fitting</p>
            <p className="text-xs font-bold text-indigo-900 mt-0.5">Per pemain 15 menit</p>
          </div>
        </div>
      </div>
    ),
  }} />
);

export const KoorMusikDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <KoordinatorDashboardBase onNavigate={onNavigate} config={{
    division: 'Tata Musik & Suara',
    label: 'Tata Musik',
    gradient: 'from-cyan-700 to-cyan-900',
    icon: Music,
    driveKey: 'musik',
    driveLabel: 'Audio & Sound',
    specificPanel: (nav) => (
      <div className="p-5 rounded-3xl bg-cyan-50 border border-cyan-200 shadow-sm">
        <SectionTitle icon={Music} title="🎵 Cue Sheet & Inventaris Audio" />
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white border border-cyan-200">
            <p className="text-[10px] text-cyan-700 font-semibold">Cue Berikutnya</p>
            <p className="text-xs font-bold text-cyan-900 mt-0.5">Standby</p>
          </div>
          <div className="p-3 rounded-xl bg-white border border-cyan-200">
            <p className="text-[10px] text-cyan-700 font-semibold">Check Sound</p>
            <p className="text-xs font-bold text-cyan-900 mt-0.5">10 menit sebelum</p>
          </div>
        </div>
      </div>
    ),
  }} />
);

// ====================================================
// 13-18. ANGGOTA DIVISI
// ====================================================
const AnggotaDashboardBase: React.FC<RoleDashboardProps & { division: string }> = ({ onNavigate, division }) => {
  const { user } = useAuth();
  const { tasks, schedules, assessments } = useDashboardData();

  const myTasks = tasks.filter(t =>
    t.assigneeId === user?.uid ||
    (t.divisionName === division && !t.assigneeId)
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
    .filter(s => new Date(s.startAt).getTime() > Date.now() && s.divisionName === division)
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
          Divisi: {division} • {myTasks.length} tugas
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={CheckSquare} label="Tugas Selesai" value={`${myDone.length}/${myTasks.length}`} color="emerald" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={myOverdue.length} color="rose" />
        <StatCard icon={Award} label="Nilai Saya" value={myAvg > 0 ? myAvg.toFixed(1) : '-'} color="amber" />
        <StatCard icon={Calendar} label="Agenda Divisi" value={upcoming.length} color="blue" />
      </div>

      {myAvg > 0 && myPred && (
        <div className={`p-5 rounded-3xl border-2 shadow-sm ${myPred.color}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase opacity-80">Nilai Sementara</p>
              <p className="text-4xl font-black mt-1 font-mono">{myAvg.toFixed(1)}</p>
              <p className="text-sm font-black mt-1">Predikat {myPred.predikat} — {myPred.label}</p>
            </div>
            <button onClick={() => onNavigate('nilai-saya')}
              className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white font-bold text-xs shadow-sm">
              Lihat Rapor →
            </button>
          </div>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={CheckSquare} title="📋 Tugas Saya" subtitle="Daftar tugas dari koordinator" />
        {myTasks.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">Belum ada tugas.</p>
        ) : (
          <div className="space-y-2">
            {myTasks.slice(0, 5).map(t => (
              <div key={t.id} className={`p-3 rounded-xl border-l-4 ${
                t.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-400' :
                t.status === 'OVERDUE' ? 'bg-rose-50 border-rose-400' :
                'bg-slate-50 border-slate-300'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-500">
                      Deadline: {new Date(t.dueDate).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <button onClick={() => onNavigate('tugas')}
                    className="text-[10px] font-bold text-amber-600 hover:underline shrink-0">
                    Buka →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={CheckSquare} label="Tugas Saya" sub="Upload bukti" onClick={() => onNavigate('tugas')} />
          <QuickAction icon={Award} label="Nilai Saya" sub="Lihat rapor" onClick={() => onNavigate('nilai-saya')} />
          <QuickAction icon={Star} label="Nilai Rekan" sub="Sejawat" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Presensi" sub="Kehadiran" onClick={() => onNavigate('absensi')} />
        </div>
      </div>
    </div>
  );
};

export const AnggotaPerlengkapanDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <AnggotaDashboardBase onNavigate={onNavigate} division="Perlengkapan" />
);

export const AnggotaPublikasiDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <div className="space-y-5">
    <AnggotaDashboardBase onNavigate={onNavigate} division="Publikasi & Dokumentasi" />
    <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
      <SectionTitle icon={Upload} title="📁 Upload Media & Dokumentasi" subtitle="Ke Drive → Paste link" />
      <DriveUploadWidget folderKey="publikasi" folderLabel="Folder Publikasi" category="Media Publikasi" />
    </div>
  </div>
);

export const AnggotaPanggungDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <AnggotaDashboardBase onNavigate={onNavigate} division="Tata Panggung" />
);

export const AnggotaRiasDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <AnggotaDashboardBase onNavigate={onNavigate} division="Tata Rias" />
);

export const AnggotaBusanaDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <div className="space-y-5">
    <AnggotaDashboardBase onNavigate={onNavigate} division="Tata Busana" />
    <div className="p-5 rounded-3xl bg-indigo-50 border border-indigo-200 shadow-sm">
      <SectionTitle icon={Scissors} title="👗 Input Detail Pakaian per Peran" subtitle="Catat detail kostum tiap pemain" />
      <div className="p-4 rounded-2xl bg-white border border-indigo-200 text-center">
        <Scissors className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
        <p className="text-xs text-slate-500">Fitur input detail akan segera aktif di menu Tugas</p>
        <button onClick={() => onNavigate('tugas')}
          className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">
          Buka Tugas →
        </button>
      </div>
    </div>
  </div>
);

export const AnggotaMusikDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => (
  <AnggotaDashboardBase onNavigate={onNavigate} division="Tata Musik & Suara" />
);

// ====================================================
// 19. PEMAIN (Pemeran)
// ====================================================
export const PemainDashboard: React.FC<RoleDashboardProps> = ({ onNavigate }) => {
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
          Progres latihan: <strong>{rehearsalPct}%</strong> • {rehearsalDone}/{rehearsalTasks.length} tugas selesai
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Award} label="Nilai Saya" value={myAvg > 0 ? myAvg.toFixed(1) : '-'} color="rose" />
        <StatCard icon={TrendingUp} label="Progres Latihan" value={`${rehearsalPct}%`} color="amber" />
        <StatCard icon={Calendar} label="Latihan Mendatang" value={upcomingRehearsals.length} color="blue" />
        <StatCard icon={Star} label="Predikat" value={myPred?.predikat || '-'} color="emerald" />
      </div>

      {/* Naskah & Latihan */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={BookOpen} title="📖 Latihan Dialog & Blocking" subtitle="10 langkah dialog + rekam suara" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 font-bold text-xs">
            📖 Naskah Digital
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 font-bold text-xs">
            🎬 Blocking 3×3
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 font-bold text-xs">
            🎙️ Rekam Suara
          </button>
          <button onClick={() => onNavigate('studio')}
            className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs">
            🗣️ 10 Langkah
          </button>
        </div>
      </div>

      {/* Latihan Mendatang */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Calendar} title="📅 Latihan Mendatang" subtitle="Konfirmasi kehadiran di menu Jadwal" />
        {upcomingRehearsals.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">Belum ada latihan.</p>
        ) : (
          <div className="space-y-2">
            {upcomingRehearsals.map(s => (
              <div key={s.id} className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{s.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(s.startAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} • {s.location}
                  </p>
                </div>
                <button onClick={() => onNavigate('jadwal')}
                  className="text-[10px] font-bold text-rose-600 hover:underline shrink-0">
                  Konfirmasi →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refleksi Diri */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-indigo-600 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-indigo-900">💭 Refleksi Diri</h3>
            <p className="text-xs text-indigo-700">Isi refleksi untuk penilaian tahap Pasca Produksi</p>
          </div>
          <button onClick={() => onNavigate('tugas')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0">
            Isi →
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <SectionTitle icon={Sparkles} title="Aksi Cepat" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <QuickAction icon={Award} label="Nilai Saya" sub="Rapor" onClick={() => onNavigate('nilai-saya')} />
          <QuickAction icon={Star} label="Nilai Rekan" sub="Sejawat" onClick={() => onNavigate('nilai')} />
          <QuickAction icon={ClipboardList} label="Presensi" sub="Kehadiran" onClick={() => onNavigate('absensi')} />
          <QuickAction icon={Timer} label="Deadline" sub="Tenggat" onClick={() => onNavigate('deadline')} />
        </div>
      </div>
    </div>
  );
};

// Need Timer import
import { Timer } from 'lucide-react';
