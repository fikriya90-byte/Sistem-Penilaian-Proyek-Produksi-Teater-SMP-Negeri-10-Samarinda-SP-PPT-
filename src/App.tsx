import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home, MessageSquare, Users, Wallet, Megaphone, Bell, Calculator,
  Plus, X,
} from 'lucide-react';

import { AuthProvider, useAuth } from './core/authContext';
import { ThemeProvider } from './core/themeContext';
import { ToastProvider } from './components/common/Toast';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { LoginModal } from './components/auth/LoginModal';
import { LoginConfirmModal } from './components/auth/LoginConfirmModal';
import { StudentWelcomePage } from './components/welcome/StudentWelcomePage';
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
import { ManageStudentModule } from './components/modules/ManageStudentModule';
import { StageManagerModule } from './components/modules/StageManagerModule';
import { AssessmentScheduleModule } from './components/modules/AssessmentScheduleModule';
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
import { DeadlineModule } from './components/modules/DeadlineModule';
import { NotulensiModule } from './components/modules/NotulensiModule';
import { BookingModule } from './components/modules/BookingModule';
import { InterClassCoordModule } from './components/modules/InterClassCoordModule';
import { DebugUsersModule } from './components/modules/DebugUsersModule';
import { RABModule } from './components/modules/RABModule';
import { WelcomeBroadcastModule } from './components/modules/WelcomeBroadcastModule';
import { GradeRecapModule } from './components/modules/GradeRecapModule';
import { TemplateHubModule } from './components/modules/TemplateHubModule';

const NAV_STORAGE_KEY = 'spppt-current-module';
const VIEW_STORAGE_KEY = 'spppt-view';

const WELCOME_MODULES = [
  'dashboard', 'informasi', 'notifikasi', 'panduan', 'pengaturan',
  'aktivitas', 'notulensi', 'backup', 'inter-class', 'debug-users', 'welcome-broadcast',
];

const IN_CLASS_MODULES = [
  'nilai', 'nilai-saya', 'absensi', 'statistik-absensi', 'kas', 'rab', 'tugas',
  'progress-tugas', 'jadwal', 'master-timeline', 'content-schedule', 'division-schedule',
  'director-timeline', 'properti', 'musik', 'rias', 'busana', 'broadcast', 'aduan',
  'dokumen', 'struktur', 'studio', 'kelola-siswa', 'kelola-tahapan', 'jadwal-penilaian',
  'moderasi', 'booking', 'admin-dashboard', 'rekap-nilai', 'template-hub',
];

const LoadingScreen = ({ text }: { text: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
    <div className="w-14 h-14 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
    <h2 className="text-lg font-black tracking-tight text-amber-400">{text}</h2>
    <p className="text-xs text-slate-400 mt-1">Sistem Penilaian Produksi Teater SMPN 10 Samarinda</p>
  </div>
);

const WelcomeLayout: React.FC<{
  onEnterClass: (c: any) => void;
  onNavigate: (m: string) => void;
  currentModule: string;
}> = ({ onEnterClass, onNavigate, currentModule }) => {
  const { isGuruPengampu, isAdminRole } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderWelcomeModule = () => {
    switch (currentModule) {
      case 'informasi': return <InformationModule />;
      case 'notifikasi': return <NotificationPage />;
      case 'aktivitas': return <ActivityLogModule />;
      case 'notulensi': return <NotulensiModule />;
      case 'backup': return <BackupModule />;
      case 'panduan': return <GuideModule />;
      case 'pengaturan': return <SettingsModule />;
      case 'inter-class': return <InterClassCoordModule />;
      case 'debug-users': return <DebugUsersModule />;
      case 'welcome-broadcast': return <WelcomeBroadcastModule />;
      case 'dashboard':
      default:
        return isGuruPengampu || isAdminRole ? (
          <ManageClassModule embedded onEnterClass={onEnterClass} />
        ) : (
          <StudentWelcomePage onEnterClass={onEnterClass} onNavigate={onNavigate} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col antialiased pb-16 lg:pb-0">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={onNavigate} view="welcome" />
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar currentModule={currentModule} onNavigate={onNavigate} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} mode="welcome" />
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-32 lg:pb-24 overflow-y-auto max-w-full">
          {renderWelcomeModule()}
        </main>
      </div>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const { user, loading, activeClass, isGuruPengampu, isAdminRole, logout, setActiveClass } = useAuth();

  const [currentModule, setCurrentModule] = useState<string>(() => {
    try { return localStorage.getItem(NAV_STORAGE_KEY) || 'dashboard'; } catch { return 'dashboard'; }
  });
  const [view, setView] = useState<'welcome' | 'in-class'>(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === 'in-class' || saved === 'welcome') return saved;
    } catch { /* ignore */ }
    return 'welcome';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLoginConfirm, setShowLoginConfirm] = useState(false);
  const [showFloatingTools, setShowFloatingTools] = useState(false);
  const viewInitRef = useRef(false);

  const stateRef = useRef({ activeClass, isGuruPengampu, isAdminRole, view });
  useEffect(() => {
    stateRef.current = { activeClass, isGuruPengampu, isAdminRole, view };
  }, [activeClass, isGuruPengampu, isAdminRole, view]);

  useEffect(() => { try { localStorage.setItem(NAV_STORAGE_KEY, currentModule); } catch { /* ignore */ } }, [currentModule]);
  useEffect(() => { try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ } }, [view]);

  useEffect(() => {
    if (user && sessionStorage.getItem('spppt-just-logged-in') === '1') setShowLoginConfirm(true);
  }, [user]);

  useEffect(() => { viewInitRef.current = false; }, [user?.uid]);

  // ✅ FIX: AUTO-ENTER CLASS (TIDAK MELEMPAR GURU KE WELCOME SAAT REFRESH)
  useEffect(() => {
    if (!user) return;
    if (loading) return;
    if (viewInitRef.current) return;
    
    const isGuruOrAdmin = isGuruPengampu || isAdminRole;
    let savedView: 'welcome' | 'in-class' = 'welcome';
    try {
      const s = localStorage.getItem(VIEW_STORAGE_KEY);
      if (s === 'in-class' || s === 'welcome') savedView = s;
    } catch { /* ignore */ }

    if (isGuruOrAdmin) {
      if (activeClass && savedView === 'in-class') {
        setView('in-class');
        viewInitRef.current = true;
      } else if (activeClass && savedView === 'welcome') {
        setView('welcome');
        viewInitRef.current = true;
      } else if (!activeClass && savedView !== 'in-class') {
        // Jika belum ada activeClass dan tidak berniat masuk kelas, tampilkan welcome
        setView('welcome');
        viewInitRef.current = true;
      }
      // Jika !activeClass tapi savedView === 'in-class', kita BIARKAN (tunggu loading di bawah)
    } else {
      // Siswa logic (sama seperti sebelumnya)
      if (!user.classId || activeClass) {
        setView(activeClass ? 'in-class' : 'welcome');
        viewInitRef.current = true;
      }
    }
  }, [user?.uid, isGuruPengampu, isAdminRole, activeClass, loading, user?.classId]);

  useEffect(() => {
    if (!user || !activeClass) return;
    const timer = setTimeout(() => {
      import('./utils/reminder').then(({ runAllReminders }) => {
        runAllReminders(activeClass.id).catch(err => console.warn('Reminder error:', err));
      }).catch(err => console.warn('Reminder import error:', err));
    }, 3000);
    return () => clearTimeout(timer);
  }, [user?.uid, activeClass?.id]);

  const handleNavigate = useCallback((target: string) => {
    const st = stateRef.current;
    const needsClass = IN_CLASS_MODULES.includes(target);
    const isWelcomeOnly = WELCOME_MODULES.includes(target);

    if (needsClass && !st.activeClass) { setView('welcome'); setCurrentModule(target); return; }
    if (needsClass && st.activeClass) { setView('in-class'); setCurrentModule(target); return; }
    if (isWelcomeOnly) { setCurrentModule(target); return; }
    setCurrentModule(target);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.module) handleNavigate(detail.module);
    };
    window.addEventListener('spppt-navigate', handler);
    return () => window.removeEventListener('spppt-navigate', handler);
  }, [handleNavigate]);

  const handleEnterClass = (c: any) => { setActiveClass(c); setView('in-class'); setCurrentModule('dashboard'); };
  const handleExitClass = () => { setView('welcome'); setCurrentModule('dashboard'); };

  if (loading) return <LoadingScreen text="Memuat SP-PPT..." />;
  if (!user) return <LoginModal />;

  // ✅ FIX: Tahan tampilan (Loading) jika seharusnya masuk kelas tapi activeClass belum siap
  const isClassLoading = view === 'in-class' && !activeClass;
  if (isClassLoading) return <LoadingScreen text="Menyiapkan Kelas Anda..." />;

  const handleLoginConfirmYes = () => { try { sessionStorage.removeItem('spppt-just-logged-in'); } catch {} setShowLoginConfirm(false); };
  const handleLoginConfirmNo = async () => { try { sessionStorage.removeItem('spppt-just-logged-in'); } catch {} setShowLoginConfirm(false); await logout(); };

  if (isAdminRole) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col antialiased pb-16 lg:pb-0">
          <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={handleNavigate} />
          <div className="flex-1 flex max-w-7xl w-full mx-auto">
            <Sidebar currentModule={currentModule} onNavigate={handleNavigate} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-32 lg:pb-24 overflow-y-auto max-w-full">
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
               currentModule === 'notulensi' ? <NotulensiModule /> :
               currentModule === 'booking' ? <BookingModule /> :
               currentModule === 'inter-class' ? <InterClassCoordModule /> :
               currentModule === 'debug-users' ? <DebugUsersModule /> :
               currentModule === 'rab' ? <RABModule /> :
               currentModule === 'rekap-nilai' ? <GradeRecapModule /> :
               currentModule === 'template-hub' ? <TemplateHubModule /> :
               <AdminModule />}
            </main>
          </div>
        </div>
        {showLoginConfirm && user && <LoginConfirmModal user={user} onYes={handleLoginConfirmYes} onNo={handleLoginConfirmNo} />}
      </>
    );
  }

  if (view === 'welcome') {
    return <WelcomeLayout onEnterClass={handleEnterClass} onNavigate={handleNavigate} currentModule={currentModule} />;
  }

  const renderCurrentModule = () => {
    switch (currentModule) {
      case 'dashboard': return <DashboardModule onNavigate={handleNavigate} />;
      case 'nilai-saya': return <MyGradeModule />;
      case 'nilai': return <AssessmentModule />;
      case 'moderasi': return <ModerationModule />;
      case 'rekap-nilai': return <GradeRecapModule />;
      case 'absensi': return <AttendanceModule />;
      case 'statistik-absensi': return <AttendanceStatsModule />;
      case 'kas': return <KasModule />;
      case 'rab': return <RABModule />;
      case 'tugas': return <DeadlineModule />;
      case 'progress-tugas': return <TaskProgressModule />;
      case 'jadwal': return <ScheduleModule />;
      case 'master-timeline': return <MasterTimelineModule />;
      case 'content-schedule': return <ContentScheduleModule />;
      case 'division-schedule': return <DivisionScheduleModule />;
      case 'director-timeline': return <DirectorTimelineModule />;
      case 'properti': return <PropertyModule />;
      case 'musik': return <MusicCueModule />;
      case 'rias': return <FaceChartModule />;
      case 'busana': return <CostumeModule />;
      case 'informasi': return <InformationModule />;
      case 'notifikasi': return <NotificationPage />;
      case 'broadcast': return <BroadcastModule />;
      case 'aduan': return <ComplaintModule />;
      case 'dokumen': return <DocumentModule />;
      case 'struktur': return <StructureModule />;
      case 'studio': return <StudioModule />;
      case 'kelola-siswa': return <ManageStudentModule onNavigate={handleNavigate} />;
      case 'kelola-tahapan': return <StageManagerModule />;
      case 'jadwal-penilaian': return <AssessmentScheduleModule />;
      case 'aktivitas': return <ActivityLogModule />;
      case 'backup': return <BackupModule />;
      case 'pengaturan': return <SettingsModule />;
      case 'panduan': return <GuideModule />;
      case 'notulensi': return <NotulensiModule />;
      case 'booking': return <BookingModule />;
      case 'inter-class': return <InterClassCoordModule />;
      case 'debug-users': return <DebugUsersModule />;
      case 'template-hub': return <TemplateHubModule />;
      default: return <DashboardModule onNavigate={handleNavigate} />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-transparent flex flex-col antialiased pb-16 lg:pb-0">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onNavigate={handleNavigate} view="in-class" onExitClass={handleExitClass} />
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar currentModule={currentModule} onNavigate={handleNavigate} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} mode="in-class" />
          <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-32 lg:pb-24 overflow-y-auto max-w-full">
            {renderCurrentModule()}
          </main>
        </div>

        <DashboardReminder onNavigate={handleNavigate} />

        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-30 print:hidden flex flex-col items-end gap-2.5">
          {showFloatingTools && (
            <>
              <button onClick={() => { handleNavigate('informasi'); setShowFloatingTools(false); }} className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-amber-500 text-slate-950 shadow-xl border-2 border-amber-400"><Megaphone className="w-4 h-4" /><span className="text-[11px] font-bold">Papan Info</span></button>
              <button onClick={() => { handleNavigate('struktur'); setShowFloatingTools(false); }} className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-slate-900 text-amber-400 shadow-xl border-2 border-amber-500/40"><Users className="w-4 h-4" /><span className="text-[11px] font-bold">Kerabat Kerja</span></button>
              <button onClick={() => { handleNavigate('aduan'); setShowFloatingTools(false); }} className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-rose-600 text-white shadow-xl"><MessageSquare className="w-4 h-4" /><span className="text-[11px] font-bold">Aduan Cepat</span></button>
            </>
          )}
          <button onClick={() => setShowFloatingTools(!showFloatingTools)} className={`p-3.5 rounded-full shadow-2xl border-2 flex items-center justify-center transition-all ${showFloatingTools ? 'bg-slate-900 text-white border-amber-400' : 'bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 border-amber-400'}`}>
            {showFloatingTools ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-lg print:hidden">
          <button onClick={() => handleNavigate('dashboard')} className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'dashboard' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}><Home className="w-5 h-5" /><span className="text-[10px] mt-0.5">Beranda</span></button>
          <button onClick={() => handleNavigate('informasi')} className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'informasi' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}><Megaphone className="w-5 h-5" /><span className="text-[10px] mt-0.5">Info</span></button>
          <button onClick={() => handleNavigate('notifikasi')} className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'notifikasi' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}><Bell className="w-5 h-5" /><span className="text-[10px] mt-0.5">Notif</span></button>
          <button onClick={() => handleNavigate('kas')} className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'kas' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}><Wallet className="w-5 h-5" /><span className="text-[10px] mt-0.5">Kas</span></button>
          <button onClick={() => handleNavigate('rab')} className={`flex flex-col items-center p-1 rounded-xl transition ${currentModule === 'rab' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}><Calculator className="w-5 h-5" /><span className="text-[10px] mt-0.5">RAB</span></button>
        </div>
      </div>
      {showLoginConfirm && user && <LoginConfirmModal user={user} onYes={handleLoginConfirmYes} onNo={handleLoginConfirmNo} />}
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