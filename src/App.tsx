import React, { useState, useEffect } from 'react';
import {
  Award, CheckSquare, ClipboardList, Home, MessageSquare, Sparkles, Users, Star, Wallet,
} from 'lucide-react';
import { AuthProvider, useAuth } from './core/authContext';
import { ToastProvider } from './components/common/Toast';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { LoginModal } from './components/auth/LoginModal';
import { TeacherClassPicker } from './components/common/TeacherClassPicker';

// Modules
import { DashboardModule } from './components/modules/DashboardModule';
import { AssessmentModule } from './components/modules/AssessmentModule';
import { MyGradeModule } from './components/modules/MyGradeModule';
import { AttendanceModule } from './components/modules/AttendanceModule';
import { ScheduleModule } from './components/modules/ScheduleModule';
import { TaskDeadlineModule } from './components/modules/TaskDeadlineModule';
import { StructureModule } from './components/modules/StructureModule';
import { StudioModule } from './components/modules/StudioModule';
import { BroadcastModule } from './components/modules/BroadcastModule';
import { DocumentModule } from './components/modules/DocumentModule';
import { ComplaintModule } from './components/modules/ComplaintModule';
import { GuideModule } from './components/modules/GuideModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { AdminModule } from './components/modules/AdminModule';
import { ManageClassModule } from './components/modules/ManageClassModule';
import { StageManagerModule } from './components/modules/StageManagerModule';
import { DeadlineModule } from './components/modules/DeadlineModule';
import { ModerationModule } from './components/modules/ModerationModule';
import { AttendanceStatsModule } from './components/modules/AttendanceStatsModule';
import { KasModule } from './components/modules/KasModule';

const MainLayout: React.FC = () => {
  const { user, loading, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setCurrentModule('dashboard');
  }, [activeClass?.id]);

  // Auto-run reminders setiap kali aktif kelas berubah
  useEffect(() => {
    if (!activeClass) return;
    import('./utils/reminder').then(({ runAllReminders }) => {
      runAllReminders(activeClass.id).catch(() => { /* non-fatal */ });
    });
    const interval = setInterval(() => {
      import('./utils/reminder').then(({ runAllReminders }) => {
        runAllReminders(activeClass.id).catch(() => { /* non-fatal */ });
      });
    }, 15 * 60 * 1000); // setiap 15 menit
    return () => clearInterval(interval);
  }, [activeClass]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
        <div className="w-14 h-14 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-black tracking-tight text-amber-400">Memuat SP-PPT...</h2>
        <p className="text-xs text-slate-400 mt-1">Sistem Penilaian Produksi Teater SMPN 10 Samarinda</p>
      </div>
    );
  }

  if (!user) return <LoginModal />;

  if (isAdminRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col antialiased pb-16 lg:pb-0">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={setCurrentModule} />
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar
            currentModule={currentModule}
            onNavigate={setCurrentModule}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-full">
            {currentModule === 'pengaturan' ? <SettingsModule /> : <AdminModule />}
          </main>
        </div>
      </div>
    );
  }

  if (isGuruPengampu && !activeClass) {
    return <TeacherClassPicker />;
  }

  const renderCurrentModule = () => {
    switch (currentModule) {
      case 'dashboard': return <DashboardModule onNavigate={setCurrentModule} />;
      case 'nilai-saya': return <MyGradeModule />;
      case 'nilai': return <AssessmentModule />;
      case 'moderasi': return <ModerationModule />;
      case 'statistik-absensi': return <AttendanceStatsModule />;
      case 'kas': return <KasModule />;
      case 'jadwal': return <ScheduleModule />;
      case 'absensi': return <AttendanceModule />;
      case 'tugas': return <TaskDeadlineModule />;
      case 'struktur': return <StructureModule />;
      case 'studio': return <StudioModule />;
      case 'broadcast': return <BroadcastModule />;
      case 'dokumen': return <DocumentModule />;
      case 'aduan': return <ComplaintModule />;
      case 'panduan': return <GuideModule />;
      case 'pengaturan': return <SettingsModule />;
      case 'kelola-kelas': return <ManageClassModule />;
      case 'kelola-tahapan': return <StageManagerModule />;
      case 'deadline': return <DeadlineModule />;
      default: return <DashboardModule onNavigate={setCurrentModule} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased selection:bg-amber-500/20 selection:text-amber-900 pb-16 lg:pb-0">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={setCurrentModule} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentModule={currentModule}
          onNavigate={setCurrentModule}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-full">
          {renderCurrentModule()}
        </main>
      </div>

      <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-30 flex flex-col gap-2.5 print:hidden">
        <button onClick={() => setCurrentModule('struktur')}
          className="p-3 sm:p-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-amber-400 shadow-xl border border-amber-500/30 flex items-center justify-center transition group hover:scale-105"
          title="Buka Kerabat Kerja">
          <Users className="w-5 h-5" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold text-white px-0 group-hover:px-2">
            Kerabat Kerja
          </span>
        </button>
        <button onClick={() => setCurrentModule('aduan')}
          className="p-3 sm:p-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl flex items-center justify-center transition group hover:scale-105"
          title="Aduan Cepat & Bantuan">
          <MessageSquare className="w-5 h-5" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold px-0 group-hover:px-2">
            Aduan Cepat
          </span>
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-lg print:hidden">
        <button onClick={() => setCurrentModule('dashboard')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'dashboard' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
          <Home className="w-5 h-5" /><span className="text-[10px] mt-0.5">Beranda</span>
        </button>
        <button onClick={() => setCurrentModule('nilai-saya')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'nilai-saya' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
          <Award className="w-5 h-5" /><span className="text-[10px] mt-0.5">Nilai</span>
        </button>
        <button onClick={() => setCurrentModule('kas')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'kas' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
          <Wallet className="w-5 h-5" /><span className="text-[10px] mt-0.5">Kas</span>
        </button>
        <button onClick={() => setCurrentModule('tugas')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'tugas' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
          <CheckSquare className="w-5 h-5" /><span className="text-[10px] mt-0.5">Tugas</span>
        </button>
        <button onClick={() => setCurrentModule('deadline')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'deadline' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
          <Star className="w-5 h-5" /><span className="text-[10px] mt-0.5">Deadline</span>
        </button>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ToastProvider>
  );
}
