import React from 'react';
import {
  Award, BarChart3, Bell, BookOpen, Calendar, CheckSquare, ClipboardList,
  Database, FileText, HelpCircle, Home, MessageSquare, Music, Activity,
  Package, Palette, Radio, Scissors, Settings, ShieldCheck, Sparkles,
  Star, Timer, Users, Wallet, X, Megaphone,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';

interface SidebarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onNavigate, isOpen, onClose }) => {
  const { user, isGuruPengampu, isAdminRole } = useAuth();
  const role = user?.role || '';

  const guruNavItems = [
    { id: 'informasi', label: 'Papan Informasi', icon: Megaphone, badge: 'Baru' },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: '' },
    { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity, badge: '' },
    { id: 'kelola-tahapan', label: 'Kelola Tahapan', icon: Calendar, badge: '' },
    { id: 'deadline', label: 'Kirim Deadline', icon: Timer, badge: '' },
    { id: 'nilai', label: 'Nilai & Penilaian', icon: Award, badge: '' },
    { id: 'statistik-absensi', label: 'Statistik Presensi', icon: BarChart3, badge: '' },
    { id: 'absensi', label: 'Presensi', icon: ClipboardList, badge: '' },
    { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar, badge: '' },
    { id: 'tugas', label: 'Checklist Tugas', icon: CheckSquare, badge: '' },
    { id: 'struktur', label: 'Struktur Kerabat', icon: Users, badge: '' },
    { id: 'studio', label: 'Studio & Naskah', icon: Sparkles, badge: '' },
    { id: 'broadcast', label: 'Broadcast', icon: Radio, badge: '' },
    { id: 'dokumen', label: 'Dokumen & Arsip', icon: FileText, badge: '' },
    { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare, badge: '' },
    { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle, badge: '' },
    { id: 'backup', label: 'Backup & Restore', icon: Database, badge: '' },
    { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Settings, badge: '' },
  ];

  const adminNavItems = [
    { id: 'admin-dashboard', label: 'Dashboard Admin', icon: ShieldCheck, badge: '' },
    { id: 'informasi', label: 'Papan Informasi', icon: Megaphone, badge: '' },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: '' },
    { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity, badge: '' },
    { id: 'backup', label: 'Backup & Restore', icon: Database, badge: '' },
    { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Settings, badge: '' },
  ];

  const getKoordinatorMenu = () => {
    const base = [
      { id: 'informasi', label: 'Papan Informasi', icon: Megaphone, badge: '' },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: '' },
      { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity, badge: '' },
      { id: 'nilai', label: 'Nilai Anggota', icon: Award, badge: '' },
      { id: 'absensi', label: 'Absensi Divisi', icon: ClipboardList, badge: '' },
      { id: 'jadwal', label: 'Jadwal Internal', icon: Calendar, badge: '' },
      { id: 'tugas', label: 'Tugas Divisi', icon: CheckSquare, badge: '' },
      { id: 'deadline', label: 'Kirim Deadline', icon: Timer, badge: '' },
      { id: 'broadcast', label: 'Broadcast Divisi', icon: Radio, badge: '' },
    ];

    const specific: Record<string, any[]> = {
      'Koordinator Perlengkapan': [{ id: 'properti', label: 'Properti & Inventaris', icon: Package, badge: '' }],
      'Koordinator Publikasi': [{ id: 'dokumen', label: 'Dokumentasi', icon: FileText, badge: '' }],
      'Koordinator Tata Panggung': [{ id: 'properti', label: 'Properti & Inventaris', icon: Package, badge: '' }],
      'Koordinator Tata Rias': [{ id: 'rias', label: 'Face Chart Rias', icon: Palette, badge: '' }],
      'Koordinator Tata Busana': [{ id: 'busana', label: 'Desain Kostum', icon: Scissors, badge: '' }],
      'Koordinator Tata Musik': [{ id: 'musik', label: 'Cue Sheet Musik', icon: Music, badge: '' }],
    };

    const extras = specific[role] || [];
    const tail = [
      { id: 'struktur', label: 'Struktur Kerabat', icon: Users, badge: '' },
      { id: 'studio', label: 'Studio & Naskah', icon: Sparkles, badge: '' },
      { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare, badge: '' },
      { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle, badge: '' },
      { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings, badge: '' },
    ];

    return [...base, ...extras, ...tail];
  };

  const getAnggotaMenu = () => {
    const specific: Record<string, any[]> = {
      'Anggota Perlengkapan': [{ id: 'properti', label: 'Properti & Inventaris', icon: Package, badge: '' }],
      'Anggota Publikasi': [{ id: 'dokumen', label: 'Upload Media', icon: FileText, badge: '' }],
      'Anggota Tata Panggung': [{ id: 'properti', label: 'Properti & Inventaris', icon: Package, badge: '' }],
      'Anggota Tata Rias': [{ id: 'rias', label: 'Face Chart Rias', icon: Palette, badge: '' }],
      'Anggota Tata Busana': [{ id: 'busana', label: 'Desain Kostum', icon: Scissors, badge: '' }],
      'Anggota Tata Musik': [{ id: 'musik', label: 'Cue Sheet Musik', icon: Music, badge: '' }],
    };
    const extras = specific[role] || [];

    return [
      { id: 'informasi', label: 'Papan Informasi', icon: Megaphone, badge: '' },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: '' },
      { id: 'tugas', label: 'Tugas Saya', icon: CheckSquare, badge: '' },
      { id: 'deadline', label: 'Deadline Saya', icon: Timer, badge: '' },
      { id: 'nilai-saya', label: 'Nilai Saya', icon: Award, badge: '' },
      { id: 'nilai', label: 'Nilai Rekan', icon: Star, badge: '' },
      ...extras,
      { id: 'absensi', label: 'Presensi', icon: ClipboardList, badge: '' },
      { id: 'kas', label: 'Kas Saya', icon: Wallet, badge: '' },
      { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar, badge: '' },
      { id: 'struktur', label: 'Struktur Kerabat', icon: Users, badge: '' },
      { id: 'studio', label: 'Studio & Naskah', icon: Sparkles, badge: '' },
      { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare, badge: '' },
      { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle, badge: '' },
      { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings, badge: '' },
    ];
  };

  const pemainNavItems = [
    { id: 'informasi', label: 'Papan Informasi', icon: Megaphone, badge: '' },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: '' },
    { id: 'studio', label: 'Naskah & Blocking', icon: Sparkles, badge: '' },
    { id: 'jadwal', label: 'Jadwal Latihan', icon: Calendar, badge: '' },
    { id: 'tugas', label: 'Tugas Saya', icon: CheckSquare, badge: '' },
    { id: 'deadline', label: 'Deadline Saya', icon: Timer, badge: '' },
    { id: 'nilai-saya', label: 'Nilai Saya', icon: Award, badge: '' },
    { id: 'nilai', label: 'Nilai Rekan', icon: Star, badge: '' },
    { id: 'absensi', label: 'Presensi', icon: ClipboardList, badge: '' },
    { id: 'kas', label: 'Kas Saya', icon: Wallet, badge: '' },
    { id: 'struktur', label: 'Struktur Kerabat', icon: Users, badge: '' },
    { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare, badge: '' },
    { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle, badge: '' },
    { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings, badge: '' },
  ];

  let navItems: any[] = pemainNavItems;

  if (isAdminRole) navItems = adminNavItems;
  else if (isGuruPengampu) navItems = guruNavItems;
  else if (role.startsWith('Koordinator ')) navItems = getKoordinatorMenu();
  else if (role.startsWith('Anggota ')) navItems = getAnggotaMenu();
  else if (role === 'Pemain') navItems = pemainNavItems;
  else {
    navItems = [
      { id: 'informasi', label: 'Papan Informasi', icon: Megaphone, badge: '' },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: '' },
      { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity, badge: '' },
      { id: 'dashboard', label: 'Dashboard', icon: Home, badge: '' },
      { id: 'nilai', label: 'Nilai & Penilaian', icon: Award, badge: '' },
      { id: 'deadline', label: 'Deadline', icon: Timer, badge: '' },
      { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar, badge: '' },
      { id: 'absensi', label: 'Presensi', icon: ClipboardList, badge: '' },
      { id: 'tugas', label: 'Checklist Tugas', icon: CheckSquare, badge: '' },
      { id: 'struktur', label: 'Struktur Kerabat', icon: Users, badge: '' },
      { id: 'studio', label: 'Studio & Naskah', icon: Sparkles, badge: '' },
      { id: 'broadcast', label: 'Broadcast', icon: Radio, badge: '' },
      { id: 'dokumen', label: 'Dokumen', icon: FileText, badge: '' },
      { id: 'kas', label: 'Kas', icon: Wallet, badge: '' },
      { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare, badge: '' },
      { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle, badge: '' },
      { id: 'pengaturan', label: 'Pengaturan', icon: Settings, badge: '' },
    ];
  }

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
            <span className="font-extrabold text-base text-amber-600">Menu</span>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={`p-4 m-3 rounded-2xl text-white shadow-md ${
            isAdminRole ? 'bg-gradient-to-br from-blue-900 to-blue-800' : 'bg-gradient-to-br from-slate-900 to-slate-800'
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
            {!isAdminRole && user?.divisionName && (
              <p className="text-[10px] text-slate-400 mt-2 truncate font-medium">
                Divisi: <span className="text-slate-200">{user.divisionName}</span>
              </p>
            )}
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              return (
                <button key={item.id}
                  onClick={() => { onNavigate(item.id); onClose(); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? isAdminRole
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${
                      isActive ? (isAdminRole ? 'text-white' : 'text-slate-950') : 'text-slate-500 dark:text-slate-400'
                    }`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                      isActive
                        ? isAdminRole ? 'bg-white text-blue-700' : 'bg-slate-950 text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-center">
            <p className="text-[10px] font-semibold text-slate-400">SP-PPT (c) 2026 SMPN 10 Samarinda</p>
          </div>
        </div>
      </aside>
    </>
  );
};
