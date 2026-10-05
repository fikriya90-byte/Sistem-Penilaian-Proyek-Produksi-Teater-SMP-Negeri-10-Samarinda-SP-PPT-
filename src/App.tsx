import React, { useState, useEffect } from 'react';
import {
  Award, CheckSquare, ClipboardList, Home, MessageSquare, Users, Star, Wallet,
  Megaphone,
} from 'lucide-react';
import { AuthProvider, useAuth } from './core/authContext';
import { ThemeProvider } from './core/themeContext';
import { ToastProvider } from './components/common/Toast';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { LoginModal } from './components/auth/LoginModal';
import { TeacherClassPicker } from './components/common/TeacherClassPicker';

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
import { PropertyModule } from './components/modules/PropertyModule';
import { MusicCueModule } from './components/modules/MusicCueModule';
import { FaceChartModule } from './components/modules/FaceChartModule';
import { CostumeModule } from './components/modules/CostumeModule';
import { BackupModule } from './components/modules/BackupModule';
import { InformationModule } from './components/modules/InformationModule';

const MainLayout: React.FC = () => {
  const { user, loading, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setCurrentModule('dashboard');
  }, [activeClass?.id]);

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
      <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col antialiased pb-16 lg:pb-0">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={setCurrentModule} />
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar currentModule={currentModule} onNavigate={setCurrentModule}
            isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-full">
            {currentModule === 'pengaturan' ? <SettingsModule /> :
             currentModule === 'backup' ? <BackupModule /> :
             currentModule === 'informasi' ? <InformationModule /> :
             <AdminModule />}
          </main>
        </div>
      </div>
    );
  }

  if (isGuruPengampu && !activeClass) return <TeacherClassPicker />;

  const renderCurrentModule = () => {
    switch (currentModule) {
      case 'dashboard': return <DashboardModule onNavigate={setCurrentModule} />;
      case 'nilai-saya': return <MyGradeModule />;
      case 'nilai': return <AssessmentModule />;
      case 'moderasi': return <ModerationModule />;
      case 'statistik-absensi': return <AttendanceStatsModule />;
      case 'kas': return <KasModule />;
      case 'properti': return <PropertyModule />;
      case 'musik': return <MusicCueModule />;
      case 'rias': return <FaceChartModule />;
      case 'busana': return <CostumeModule />;
      case 'backup': return <BackupModule />;
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
      case 'informasi': return <InformationModule />;
      default: return <DashboardModule onNavigate={setCurrentModule} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col antialiased pb-16 lg:pb-0">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={setCurrentModule} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar currentModule={currentModule} onNavigate={setCurrentModule}
          isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-full">
          {renderCurrentModule()}
        </main>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-30 flex flex-col gap-2.5 print:hidden">
        <button
          onClick={() => setCurrentModule('informasi')}
          className="p-3 sm:p-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xl border border-amber-400 flex items-center justify-center transition group hover:scale-105"
          title="Papan Pengumuman"
        >
          <Megaphone className="w-5 h-5" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold px-0 group-hover:px-2">
            Pengumuman
          </span>
        </button>
        <button
          onClick={() => setCurrentModule('struktur')}
          className="p-3 sm:p-3.5 rounded-full bg-slate-900 dark:bg-slate-800 text-amber-400 shadow-xl border border-amber-500/30 flex items-center justify-center transition group hover:scale-105"
          title="Kerabat Kerja"
        >
          <Users className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentModule('aduan')}
          className="p-3 sm:p-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl flex items-center justify-center transition group hover:scale-105"
          title="Aduan Cepat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-700/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-lg print:hidden">
        <button onClick={() => setCurrentModule('dashboard')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'dashboard' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
          <Home className="w-5 h-5" /><span className="text-[10px] mt-0.5">Beranda</span>
        </button>
        <button onClick={() => setCurrentModule('informasi')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'informasi' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
          <Megaphone className="w-5 h-5" /><span className="text-[10px] mt-0.5">Info</span>
        </button>
        <button onClick={() => setCurrentModule('nilai-saya')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'nilai-saya' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
          <Award className="w-5 h-5" /><span className="text-[10px] mt-0.5">Nilai</span>
        </button>
        <button onClick={() => setCurrentModule('kas')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'kas' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
          <Wallet className="w-5 h-5" /><span className="text-[10px] mt-0.5">Kas</span>
        </button>
        <button onClick={() => setCurrentModule('deadline')}
          className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'deadline' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
          <Star className="w-5 h-5" /><span className="text-[10px] mt-0.5">Deadline</span>
        </button>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
