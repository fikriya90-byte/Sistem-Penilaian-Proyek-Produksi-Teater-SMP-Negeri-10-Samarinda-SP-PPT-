import React, { useState } from 'react';
import {
  Award, BarChart3, Bell, Calendar, CheckSquare, ClipboardList,
  Database, FileText, HelpCircle, MessageSquare, Music, Activity,
  Package, Palette, Radio, Scissors, Settings, ShieldCheck, Sparkles,
  Star, Users, Wallet, X, Megaphone, Camera, Film, TrendingUp, Calculator,
  GraduationCap, Home, BookOpen, Globe, Bug, ChevronDown, ChevronRight,
  Info, LayoutGrid, Layers, Target, Library, CalendarCheck, CalendarDays,
  UserCheck, Play, ListChecks, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';

interface SidebarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'welcome' | 'in-class';
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  badge?: string;
}

interface MenuGroup {
  title: string;
  icon: any;
  items: MenuItem[];
  collapsible?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule, onNavigate, isOpen, onClose, mode = 'in-class',
}) => {
  const { user, isGuruPengampu, isAdminRole } = useAuth();
  const role = user?.role || '';

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const buildWelcomeMenu = (): MenuGroup[] => {
    if (isGuruPengampu || isAdminRole) {
      return [
        {
          title: 'Utama',
          icon: Home,
          items: [
            { id: 'dashboard', label: 'Kelola Kelas', icon: BookOpen },
            { id: 'welcome-booking', label: 'Verifikasi Booking', icon: CalendarCheck },
            { id: 'activity-calendar', label: 'Kalender Kerabat Kerja', icon: CalendarDays },
          ],
        },
        {
          title: 'Komunikasi',
          icon: MessageSquare,
          items: [
            { id: 'welcome-broadcast', label: 'Broadcast Lintas Kelas', icon: Radio },
            { id: 'inter-class', label: 'Koordinasi Lintas Kelas', icon: Globe },
            { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
            { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
          ],
        },
        {
          title: 'Administrasi',
          icon: FileText,
          items: [
            { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity },
            { id: 'notulensi', label: 'Notulensi Rapat', icon: FileText },
          ],
        },
        {
          title: 'Sistem',
          icon: Settings,
          items: [
            { id: 'backup', label: 'Backup & Restore', icon: Database },
            { id: 'debug-users', label: 'Debug Users', icon: Bug },
            { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle },
            { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings },
          ],
        },
      ];
    }
    return [
      {
        title: 'Utama',
        icon: Home,
        items: [{ id: 'dashboard', label: 'Beranda Saya', icon: Home }],
      },
      {
        title: 'Info & Komunikasi',
        icon: MessageSquare,
        items: [
          { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
          { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
        ],
      },
      {
        title: 'Bantuan',
        icon: HelpCircle,
        items: [
          { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle },
          { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings },
        ],
      },
    ];
  };

  const buildInClassMenu = (): MenuGroup[] => {
    // ---------- ADMIN & GURU ----------
    if (isAdminRole) {
      return [
        { title: 'Utama', icon: Home, items: [{ id: 'admin-dashboard', label: 'Dashboard Admin', icon: ShieldCheck }] },
        { title: 'Info & Komunikasi', icon: MessageSquare, items: [
            { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
            { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
            { id: 'inter-class', label: 'Koordinasi Lintas Kelas', icon: Globe },
        ]},
        { title: 'Monitoring', icon: TrendingUp, items: [
            { id: 'activity-calendar', label: 'Kalender Kerabat Kerja', icon: CalendarDays },
            { id: 'master-timeline', label: 'Master Timeline', icon: Film },
            { id: 'progress-tugas', label: 'Progress Tugas', icon: TrendingUp },
            { id: 'rekap-nilai', label: 'Rekap Nilai Akhir', icon: BarChart3 },
            { id: 'booking', label: 'Booking Alat', icon: Package },
        ]},
        { title: 'Keuangan', icon: Wallet, items: [{ id: 'rab', label: 'RAB Digital', icon: Calculator }] },
        { title: 'Administrasi', icon: FileText, items: [
            { id: 'template-hub', label: 'Template & Hasil Karya', icon: Library },
            { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity },
            { id: 'notulensi', label: 'Notulensi Rapat', icon: FileText },
        ]},
        { title: 'Sistem', icon: Settings, items: [
            { id: 'debug-users', label: 'Debug Users', icon: Bug },
            { id: 'backup', label: 'Backup & Restore', icon: Database },
            { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Settings },
        ]},
      ];
    }

    if (isGuruPengampu) {
      return [
        { title: 'Utama', icon: Home, items: [{ id: 'dashboard', label: 'Dashboard', icon: Home }] },
        { title: 'Info & Komunikasi', icon: MessageSquare, items: [
            { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
            { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
            { id: 'broadcast', label: 'Broadcast', icon: Radio },
            { id: 'inter-class', label: 'Koordinasi Lintas Kelas', icon: Globe },
            { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
        ]},
        { title: 'Kelola Kelas', icon: GraduationCap, items: [
            { id: 'kelola-siswa', label: 'Kelola Siswa', icon: GraduationCap },
            { id: 'kelola-tahapan', label: 'Kelola Tahapan', icon: Calendar },
            { id: 'jadwal-penilaian', label: 'Jadwal Penilaian', icon: CalendarCheck },
        ]},
        { title: 'Tugas & Penilaian', icon: ListChecks, items: [
            { id: 'tugas', label: 'Tugas & Deadline', icon: CheckSquare },
            { id: 'nilai', label: 'Nilai & Penilaian', icon: Award },
            { id: 'moderasi', label: 'Moderasi', icon: ShieldCheck },
            { id: 'rekap-nilai', label: 'Rekap Nilai Akhir', icon: BarChart3 },
        ]},
        { title: 'Presensi', icon: UserCheck, items: [
            { id: 'absensi', label: 'Presensi', icon: ClipboardList },
            { id: 'statistik-absensi', label: 'Statistik Presensi', icon: BarChart3 },
        ]},
        { title: 'Jadwal & Timeline', icon: CalendarDays, items: [
            { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar },
            { id: 'activity-calendar', label: 'Kalender Kerabat Kerja', icon: CalendarDays },
            { id: 'master-timeline', label: 'Master Timeline', icon: Film },
        ]},
        { title: 'Produksi', icon: Layers, items: [
            { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
            { id: 'studio', label: 'Studio & Naskah', icon: Sparkles },
            { id: 'booking', label: 'Booking Alat', icon: Package },
        ]},
        { title: 'Dokumen & Administrasi', icon: FileText, items: [
            { id: 'dokumen', label: 'Dokumen & Arsip', icon: FileText },
            { id: 'template-hub', label: 'Template & Hasil Karya', icon: Library },
            { id: 'notulensi', label: 'Notulensi Rapat', icon: FileText },
            { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity },
        ]},
        { title: 'Sistem', icon: Settings, items: [
            { id: 'debug-users', label: 'Debug Users', icon: Bug },
            { id: 'backup', label: 'Backup & Restore', icon: Database },
            { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle },
            { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
        ]},
      ];
    }

    // ---------- SISWA (PIMPINAN, SEKRETARIS, SUTARDARA, KOOR, ANGGOTA, PEMERAN) ----------
    const isKoor = role.startsWith('Koordinator ');
    const isAnggota = role.startsWith('Anggota ') || role === 'Pemeran';
    const isPengurusInti = ['Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Sutradara', 'Asisten Sutradara'].includes(role);

    // Menu spesifik per divisi
    const divisionMenu: MenuItem[] = [];
    if (role.includes('Perlengkapan')) divisionMenu.push({ id: 'properti', label: 'Properti', icon: Package });
    if (role.includes('Publikasi')) divisionMenu.push({ id: 'dokumen', label: 'Dokumentasi', icon: FileText });
    if (role.includes('Panggung')) divisionMenu.push({ id: 'properti', label: 'Properti Panggung', icon: Package });
    if (role.includes('Rias')) divisionMenu.push({ id: 'rias', label: 'Face Chart', icon: Palette });
    if (role.includes('Busana')) divisionMenu.push({ id: 'busana', label: 'Kostum', icon: Scissors });
    if (role.includes('Musik')) divisionMenu.push({ id: 'musik', label: 'Cue Sheet', icon: Music });

    return [
      {
        title: 'Utama',
        icon: Home,
        items: [
          { id: 'dashboard', label: 'Beranda', icon: Home },
          { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
          { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
        ],
      },
      {
        title: 'Tugas & Penilaian',
        icon: ListChecks,
        items: [
          { id: 'tugas', label: 'Tugas Saya', icon: CheckSquare },
          { id: 'nilai-saya', label: 'Nilai Saya', icon: Award },
          { id: 'nilai', label: 'Penilaian Rekan', icon: Star },
          { id: 'rekap-nilai', label: 'Rekap Nilai', icon: BarChart3 },
        ],
      },
      {
        title: 'Kehadiran',
        icon: UserCheck,
        items: [
          { id: 'absensi', label: 'Presensi', icon: ClipboardList },
        ],
      },
      {
        title: 'Jadwal & Agenda',
        icon: CalendarDays,
        items: [
          { id: 'jadwal', label: 'Kalender Umum', icon: Calendar },
          { id: 'division-schedule', label: 'Agenda Divisi', icon: Users },
          { id: 'master-timeline', label: 'Master Timeline', icon: Film },
        ],
      },
      {
        title: 'Divisi & Produksi',
        icon: Layers,
        items: [
          ...divisionMenu,
          { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
          { id: 'studio', label: 'Studio Teater', icon: Sparkles },
          { id: 'booking', label: 'Booking Alat', icon: CalendarCheck },
          ...(isKoor ? [{ id: 'progress-tugas', label: 'Progres Divisi', icon: TrendingUp }] : []),
        ],
      },
      {
        title: 'Administrasi',
        icon: FileText,
        items: [
          { id: 'kas', label: 'Kas Saya', icon: Wallet },
          { id: 'template-hub', label: 'Template Dokumen', icon: Library },
          { id: 'notulensi', label: 'Notulen Rapat', icon: FileText },
          { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
        ],
      },
      {
        title: 'Sistem',
        icon: Settings,
        items: [
          { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle },
          { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings },
        ],
      },
    ];
  };

  const menuGroups = mode === 'welcome' ? buildWelcomeMenu() : buildInClassMenu();

  React.useEffect(() => {
    const group = menuGroups.find(g => g.items.some(i => i.id === currentModule));
    if (group && collapsedGroups[group.title]) {
      setCollapsedGroups(prev => ({ ...prev, [group.title]: false }));
    }
  }, [currentModule]);

  return (
    <>
      {isOpen && (
        <div onClick={onClose} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-700/80 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 lg:hidden">
            <span className="font-extrabold text-base text-amber-600">
              {mode === 'welcome' ? 'Menu Beranda' : 'Menu Kelas'}
            </span>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={`p-4 m-3 rounded-2xl text-white shadow-md shrink-0 ${
            isAdminRole ? 'bg-gradient-to-br from-blue-900 to-blue-800' :
            mode === 'welcome' ? 'bg-gradient-to-br from-amber-700 to-orange-800' :
            'bg-gradient-to-br from-slate-900 to-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-400" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-900 font-bold flex items-center justify-center">
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-white">{user?.displayName || 'Pengguna'}</p>
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 mt-0.5 rounded-full border ${
                  isAdminRole ? 'bg-blue-400/20 text-blue-200 border-blue-400/30' : 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                }`}>
                  {user?.role || 'Siswa'}
                </span>
              </div>
            </div>
            {!isAdminRole && user?.divisionName && mode === 'in-class' && (
              <p className="text-[10px] text-slate-400 mt-2 truncate font-medium">
                Divisi: <span className="text-slate-200">{user.divisionName}</span>
              </p>
            )}
          </div>

          <nav className="flex-1 px-3 py-2 overflow-y-auto">
            {menuGroups.map((group) => {
              const GroupIcon = group.icon;
              const isCollapsed = collapsedGroups[group.title] || false;
              const hasActiveItem = group.items.some(i => i.id === currentModule);

              return (
                <div key={group.title} className="mb-3">
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition group ${
                      hasActiveItem
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GroupIcon className="w-3 h-3 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider truncate">
                        {group.title}
                      </span>
                    </div>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-0.5 mt-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentModule === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => { onNavigate(item.id); onClose(); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                              isActive
                                ? isAdminRole
                                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                                  : 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${
                              isActive
                                ? isAdminRole ? 'text-white' : 'text-slate-950'
                                : 'text-slate-500 dark:text-slate-400'
                            }`} />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-center shrink-0">
            <p className="text-[10px] font-semibold text-slate-400">SP-PPT © 2026 SMPN 10 Samarinda</p>
          </div>
        </div>
      </aside>
    </>
  );
};
