import React from 'react';
import {
  Award, BarChart3, Bell, Calendar, CheckSquare, ClipboardList,
  Database, FileText, HelpCircle, MessageSquare, Music, Activity,
  Package, Palette, Radio, Scissors, Settings, ShieldCheck, Sparkles,
  Star, Users, Wallet, X, Megaphone, Camera, Film, TrendingUp,
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

  const buildMenu = () => {
    // ADMIN
    if (isAdminRole) return [
      { id: 'admin-dashboard', label: 'Dashboard Admin', icon: ShieldCheck },
      { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
      { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity },
      { id: 'master-timeline', label: 'Master Timeline', icon: Film },
      { id: 'content-schedule', label: 'Jadwal Konten', icon: Camera },
      { id: 'division-schedule', label: 'Jadwal Divisi', icon: Users },
      { id: 'director-timeline', label: 'Timeline Sutradara', icon: Sparkles },
      { id: 'progress-tugas', label: 'Progress Tugas', icon: TrendingUp },
      { id: 'backup', label: 'Backup & Restore', icon: Database },
      { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Settings },
    ];

    // GURU
    if (isGuruPengampu) return [
      { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
      { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity },
      { id: 'kelola-tahapan', label: 'Kelola Tahapan', icon: Calendar },
      { id: 'master-timeline', label: 'Master Timeline', icon: Film },
      { id: 'content-schedule', label: 'Jadwal Konten', icon: Camera },
      { id: 'director-timeline', label: 'Timeline Sutradara', icon: Sparkles },
      { id: 'tugas', label: 'Tugas & Deadline', icon: CheckSquare },
      { id: 'progress-tugas', label: 'Progress Tugas', icon: TrendingUp },
      { id: 'nilai', label: 'Nilai & Penilaian', icon: Award },
      { id: 'statistik-absensi', label: 'Statistik Presensi', icon: BarChart3 },
      { id: 'absensi', label: 'Presensi', icon: ClipboardList },
      { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar },
      { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
      { id: 'studio', label: 'Studio & Naskah', icon: Sparkles },
      { id: 'broadcast', label: 'Broadcast', icon: Radio },
      { id: 'dokumen', label: 'Dokumen & Arsip', icon: FileText },
      { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
      { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle },
      { id: 'backup', label: 'Backup & Restore', icon: Database },
      { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Settings },
    ];

    // KOORDINATOR
    if (role.startsWith('Koordinator ')) {
      const base = [
        { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
        { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
        { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity },
        { id: 'master-timeline', label: 'Master Timeline', icon: Film },
        { id: 'content-schedule', label: 'Jadwal Konten', icon: Camera },
        { id: 'division-schedule', label: 'Jadwal Divisi', icon: Users },
        { id: 'director-timeline', label: 'Timeline Sutradara', icon: Sparkles },
        { id: 'tugas', label: 'Tugas & Deadline', icon: CheckSquare },
        { id: 'progress-tugas', label: 'Progress Divisi', icon: TrendingUp },
        { id: 'nilai', label: 'Nilai Anggota', icon: Award },
        { id: 'absensi', label: 'Absensi Divisi', icon: ClipboardList },
        { id: 'jadwal', label: 'Jadwal Internal', icon: Calendar },
        { id: 'broadcast', label: 'Broadcast Divisi', icon: Radio },
      ];
      const specific: Record<string, any[]> = {
        'Koordinator Perlengkapan': [{ id: 'properti', label: 'Properti', icon: Package }],
        'Koordinator Publikasi': [{ id: 'dokumen', label: 'Dokumentasi', icon: FileText }],
        'Koordinator Tata Panggung': [{ id: 'properti', label: 'Properti', icon: Package }],
        'Koordinator Tata Rias': [{ id: 'rias', label: 'Face Chart', icon: Palette }],
        'Koordinator Tata Busana': [{ id: 'busana', label: 'Kostum', icon: Scissors }],
        'Koordinator Tata Musik': [{ id: 'musik', label: 'Cue Sheet', icon: Music }],
      };
      const extras = specific[role] || [];
      const tail = [
        { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
        { id: 'studio', label: 'Studio & Naskah', icon: Sparkles },
        { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
        { id: 'panduan', label: 'Panduan', icon: HelpCircle },
        { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
      ];
      return [...base, ...extras, ...tail];
    }

    // ANGGOTA
    if (role.startsWith('Anggota ')) {
      const specific: Record<string, any[]> = {
        'Anggota Perlengkapan': [{ id: 'properti', label: 'Properti', icon: Package }],
        'Anggota Publikasi': [{ id: 'dokumen', label: 'Upload Media', icon: FileText }],
        'Anggota Tata Panggung': [{ id: 'properti', label: 'Properti', icon: Package }],
        'Anggota Tata Rias': [{ id: 'rias', label: 'Face Chart', icon: Palette }],
        'Anggota Tata Busana': [{ id: 'busana', label: 'Kostum', icon: Scissors }],
        'Anggota Tata Musik': [{ id: 'musik', label: 'Cue Sheet', icon: Music }],
      };
      const extras = specific[role] || [];
      return [
        { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
        { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
        { id: 'master-timeline', label: 'Master Timeline', icon: Film },
        { id: 'content-schedule', label: 'Jadwal Konten', icon: Camera },
        { id: 'division-schedule', label: 'Jadwal Divisi Saya', icon: Users },
        { id: 'tugas', label: 'Tugas & Deadline', icon: CheckSquare },
        { id: 'nilai-saya', label: 'Nilai Saya', icon: Award },
        { id: 'nilai', label: 'Nilai Rekan', icon: Star },
        ...extras,
        { id: 'absensi', label: 'Presensi', icon: ClipboardList },
        { id: 'kas', label: 'Kas Saya', icon: Wallet },
        { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar },
        { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
        { id: 'studio', label: 'Studio & Naskah', icon: Sparkles },
        { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
        { id: 'panduan', label: 'Panduan', icon: HelpCircle },
        { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
      ];
    }

    // PEMAIN
    if (role === 'Pemain') return [
      { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
      { id: 'master-timeline', label: 'Master Timeline', icon: Film },
      { id: 'content-schedule', label: 'Jadwal Konten', icon: Camera },
      { id: 'director-timeline', label: 'Timeline Sutradara', icon: Sparkles },
      { id: 'studio', label: 'Naskah & Blocking', icon: Sparkles },
      { id: 'jadwal', label: 'Jadwal Latihan', icon: Calendar },
      { id: 'tugas', label: 'Tugas & Deadline', icon: CheckSquare },
      { id: 'nilai-saya', label: 'Nilai Saya', icon: Award },
      { id: 'nilai', label: 'Nilai Rekan', icon: Star },
      { id: 'absensi', label: 'Presensi', icon: ClipboardList },
      { id: 'kas', label: 'Kas Saya', icon: Wallet },
      { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
      { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
      { id: 'panduan', label: 'Panduan', icon: HelpCircle },
      { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
    ];

    // PENGURUS INTI
    if (['Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Sutradara', 'Asisten Sutradara'].includes(role)) {
      return [
        { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
        { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
        { id: 'aktivitas', label: 'Log Aktivitas', icon: Activity },
        { id: 'master-timeline', label: 'Master Timeline', icon: Film },
        { id: 'content-schedule', label: 'Jadwal Konten', icon: Camera },
        { id: 'division-schedule', label: 'Jadwal Divisi', icon: Users },
        { id: 'director-timeline', label: 'Timeline Sutradara', icon: Sparkles },
        { id: 'tugas', label: 'Tugas & Deadline', icon: CheckSquare },
        { id: 'progress-tugas', label: 'Progress Tugas', icon: TrendingUp },
        { id: 'nilai', label: 'Nilai & Penilaian', icon: Award },
        { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar },
        { id: 'absensi', label: 'Presensi', icon: ClipboardList },
        { id: 'kas', label: 'Kas Produksi', icon: Wallet },
        { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
        { id: 'studio', label: 'Studio & Naskah', icon: Sparkles },
        { id: 'broadcast', label: 'Broadcast', icon: Radio },
        { id: 'dokumen', label: 'Dokumen & Arsip', icon: FileText },
        { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
        { id: 'panduan', label: 'Panduan', icon: HelpCircle },
        { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
      ];
    }

    // DEFAULT
    return [
      { id: 'informasi', label: 'Papan Informasi', icon: Megaphone },
      { id: 'notifikasi', label: 'Notifikasi', icon: Bell },
      { id: 'master-timeline', label: 'Master Timeline', icon: Film },
      { id: 'content-schedule', label: 'Jadwal Konten', icon: Camera },
      { id: 'tugas', label: 'Tugas & Deadline', icon: CheckSquare },
      { id: 'nilai', label: 'Nilai & Penilaian', icon: Award },
      { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar },
      { id: 'absensi', label: 'Presensi', icon: ClipboardList },
      { id: 'struktur', label: 'Struktur Kerabat', icon: Users },
      { id: 'studio', label: 'Studio & Naskah', icon: Sparkles },
      { id: 'broadcast', label: 'Broadcast', icon: Radio },
      { id: 'dokumen', label: 'Dokumen', icon: FileText },
      { id: 'kas', label: 'Kas', icon: Wallet },
      { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare },
      { id: 'panduan', label: 'Panduan', icon: HelpCircle },
      { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
    ];
  };

  const navItems = buildMenu();

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
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? isAdminRole
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}>
                  <Icon className={`w-4 h-4 ${
                    isActive ? (isAdminRole ? 'text-white' : 'text-slate-950') : 'text-slate-500 dark:text-slate-400'
                  }`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-center">
            <p className="text-[10px] font-semibold text-slate-400">SP-PPT © 2026 SMPN 10 Samarinda</p>
          </div>
        </div>
      </aside>
    </>
  );
};
