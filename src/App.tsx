import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Home, MessageSquare, Users, Wallet, Megaphone, Bell, Calculator,
  Loader2,
} from 'lucide-react';
import { AuthProvider, useAuth } from './core/authContext';
import { ThemeProvider } from './core/themeContext';
import { ToastProvider } from './components/common/Toast';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { LoginModal } from './components/auth/LoginModal';
import { LoginConfirmModal } from './components/auth/LoginConfirmModal';
import { TeacherClassPicker } from './components/common/TeacherClassPicker';
import { DashboardReminder } from './components/common/DashboardReminder';

import { DashboardModule } from './components/modules/DashboardModule';
import { AssessmentModule } from './components/modules/AssessmentModule';
import { MyGradeModule } from './components/modules/MyGradeModule';
import { AttendanceModule } from './components/modules/AttendanceModule';
import { ScheduleModule } from './components/modules/ScheduleModule';
import { TaskProgressModule } from './components/modules/TaskProgressModule';
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
import { ModerationModule } from './components/modules/ModerationModule';
import { AttendanceStatsModule } from './components/modules/AttendanceStatsModule';
import { KasModule } from './components/modules/KasModule';
import { PropertyModule } from './components/modules/PropertyModule';
import { MusicCueModule } from './components/modules/MusicCueModule';
import { FaceChartModule } from './components/modules/FaceChartModule';
import { CostumeModule } from './components/modules/CostumeModule';
import { BackupModule } from './components/modules/BackupModule';
import { InformationModule } from './components/modules/InformationModule';
import { NotificationPage } from './components/modules/NotificationPage';
import { ActivityLogModule } from './components/modules/ActivityLogModule';
import { MasterTimelineModule } from './components/modules/MasterTimelineModule';
import { ContentScheduleModule } from './components/modules/ContentScheduleModule';
import { DivisionScheduleModule } from './components/modules/DivisionScheduleModule';
import { DirectorTimelineModule } from './components/modules/DirectorTimelineModule';

// ============================================================
// LAZY LOADING untuk modul-modul yang berpotensi circular dep
// ============================================================
const DeadlineModule = lazy(() =>
  import('./components/modules/DeadlineModule')
    .then(m => ({ default: m.DeadlineModule }))
    .catch(err => {
      console.warn('Gagal load DeadlineModule, fallback ke TaskDeadlineModule:', err);
      return import('./components/modules/TaskDeadlineModule')
        .then(m => ({ default: m.TaskDeadlineModule }));
    })
);

const RABModule = lazy(() =>
  import('./components/modules/RABModule')
    .then(m => ({ default: m.RABModule }))
    .catch(err => {
      console.warn('RABModule belum tersedia:', err);
      return Promise.resolve({
        default: () => (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
            <Calculator className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Modul RAB belum tersedia
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Silakan hubungi developer.
            </p>
          </div>
        ),
      });
    })
);

// ============================================================
// LOADING FALLBACK
// ============================================================
const LoadingFallback: React.FC = () => (
  <div className="p-12 text-center">
    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-500" />
    <p className="text-xs text-slate-500 dark:text-slate-400">Memuat modul...</p>
  </div>
);

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<LoadingFallback />}>{element}</Suspense>
);

// ============================================================
// MAIN LAYOUT
// ============================================================
const MainLayout: React.FC = () => {
  const { user, loading, activeClass, isGuruPengampu, isAdminRole, logout } = useAuth();
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLoginConfirm, setShowLoginConfirm] = useState(false);

  useEffect(() => {
    if (user && sessionStorage.getItem('spppt-just-logged-in') === '1') {
      setShowLoginConfirm(true);
    }
  }, [user]);

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

  const handleLoginConfirmYes = () => {
    try { sessionStorage.removeItem('spppt-just-logged-in'); } catch { /* ignore */ }
    setShowLoginConfirm(false);
  };

  const handleLoginConfirmNo = async () => {
    try { sessionStorage.removeItem('spppt-just-logged-in'); } catch { /* ignore */ }
    setShowLoginConfirm(false);
    await logout();
  };

  // ============================================================
  // ADMIN LAYOUT
  // ============================================================
  if (isAdminRole) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col antialiased pb-16 lg:pb-0">
          <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={setCurrentModule} />
          <div className="flex-1 flex max-w-7xl w-full mx-auto">
            <Sidebar currentModule={currentModule} onNavigate={setCurrentModule}
              isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-full">
              {currentModule === 'pengaturan' ? <SettingsModule /> :
               currentModule === 'backup' ? <BackupModule /> :
               currentModule === 'informasi' ? <InformationModule /> :
               currentModule === 'notifikasi' ? <NotificationPage /> :
               currentModule === 'aktivitas' ? <ActivityLogModule /> :
               currentModule === 'master-timeline' ? <MasterTimelineModule /> :
               currentModule === 'content-schedule' ? <ContentScheduleModule /> :
               currentModule === 'division-schedule' ? <DivisionScheduleModule /> :
               currentModule === 'director-timeline' ? <DirectorTimelineModule /> :
               currentModule === 'progress-tugas' ? <TaskProgressModule /> :
               currentModule === 'rab' ? withSuspense(<RABModule />) :
               <AdminModule />}
            </main>
          </div>
        </div>

        {showLoginConfirm && user && (
          <LoginConfirmModal
            user={user}
            onYes={handleLoginConfirmYes}
            onNo={handleLoginConfirmNo}
          />
        )}
      </>
    );
  }

  if (isGuruPengampu && !activeClass) return <TeacherClassPicker />;

  // ============================================================
  // ROUTER MODULE (GURU & SISWA)
  // ============================================================
  const renderCurrentModule = () => {
    switch (currentModule) {
      case 'dashboard': return <DashboardModule onNavigate={setCurrentModule} />;
      case 'nilai-saya': return <MyGradeModule />;
      case 'nilai': return <AssessmentModule />;
      case 'moderasi': return <ModerationModule />;
      case 'statistik-absensi': return <AttendanceStatsModule />;
      case 'kas': return <KasModule />;
      case 'rab': return withSuspense(<RABModule />);
      case 'properti': return <PropertyModule />;
      case 'musik': return <MusicCueModule />;
      case 'rias': return <FaceChartModule />;
      case 'busana': return <CostumeModule />;
      case 'backup': return <BackupModule />;
      case 'jadwal': return <ScheduleModule />;
      case 'absensi': return <AttendanceModule />;
      case 'tugas': return withSuspense(<DeadlineModule />);
      case 'progress-tugas': return <TaskProgressModule />;
      case 'struktur': return <StructureModule />;
      case 'studio': return <StudioModule />;
      case 'broadcast': return <BroadcastModule />;
      case 'dokumen': return <DocumentModule />;
      case 'aduan': return <ComplaintModule />;
      case 'panduan': return <GuideModule />;
      case 'pengaturan': return <SettingsModule />;
      case 'kelola-kelas': return <ManageClassModule onNavigate={setCurrentModule} />;
      case 'kelola-tahapan': return <StageManagerModule />;
      case 'informasi': return <InformationModule />;
      case 'notifikasi': return <NotificationPage />;
      case 'aktivitas': return <ActivityLogModule />;
      case 'master-timeline': return <MasterTimelineModule />;
      case 'content-schedule': return <ContentScheduleModule />;
      case 'division-schedule': return <DivisionScheduleModule />;
      case 'director-timeline': return <DirectorTimelineModule />;
      default: return <DashboardModule onNavigate={setCurrentModule} />;
    }
  };

  // ============================================================
  // MAIN LAYOUT
  // ============================================================
  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col antialiased pb-16 lg:pb-0">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={setCurrentModule} />

        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar currentModule={currentModule} onNavigate={setCurrentModule}
            isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-full">
            {renderCurrentModule()}
          </main>
        </div>

        <DashboardReminder onNavigate={setCurrentModule} />

        {/* FAB */}
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-30 flex flex-col gap-2.5 print:hidden">
          <button
            onClick={() => setCurrentModule('informasi')}
            className="p-3 sm:p-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xl border border-amber-400 flex items-center justify-center transition group hover:scale-105"
            title="Papan Pengumuman"
          >
            <Megaphone className="w-5 h-5" />
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
          <button onClick={() => setCurrentModule('notifikasi')}
            className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'notifikasi' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
            <Bell className="w-5 h-5" /><span className="text-[10px] mt-0.5">Notif</span>
          </button>
          <button onClick={() => setCurrentModule('kas')}
            className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'kas' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
            <Wallet className="w-5 h-5" /><span className="text-[10px] mt-0.5">Kas</span>
          </button>
          <button onClick={() => setCurrentModule('rab')}
            className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'rab' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
            <Calculator className="w-5 h-5" /><span className="text-[10px] mt-0.5">RAB</span>
          </button>
        </div>
      </div>

      {showLoginConfirm && user && (
        <LoginConfirmModal
          user={user}
          onYes={handleLoginConfirmYes}
          onNo={handleLoginConfirmNo}
        />
      )}
    </>
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
