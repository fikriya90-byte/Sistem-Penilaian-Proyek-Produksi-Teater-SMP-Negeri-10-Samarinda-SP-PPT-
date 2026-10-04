import React from 'react';
import {
  Award,
  Calendar,
  CheckSquare,
  ClipboardList,
  FileText,
  HelpCircle,
  Home,
  MessageSquare,
  Radio,
  Settings,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../core/authContext';

interface SidebarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onNavigate, isOpen, onClose }) => {
  const { user, isTeacher } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, badge: '' },
    { id: 'nilai', label: 'Nilai & Penilaian', icon: Award, badge: isTeacher ? 'Multi-Penilai' : '' },
    { id: 'jadwal', label: 'Jadwal & Agenda', icon: Calendar, badge: '' },
    { id: 'absensi', label: 'Presensi / Absensi', icon: ClipboardList, badge: '' },
    { id: 'tugas', label: 'Checklist & Deadline', icon: CheckSquare, badge: '' },
    { id: 'struktur', label: 'Struktur Kerabat', icon: Users, badge: '7 Divisi' },
    { id: 'studio', label: 'Studio & Naskah', icon: Sparkles, badge: 'Khusus' },
    { id: 'broadcast', label: 'Broadcast Pesan', icon: Radio, badge: '' },
    { id: 'dokumen', label: 'Dokumen & Arsip', icon: FileText, badge: '' },
    { id: 'aduan', label: 'Aduan & Saran', icon: MessageSquare, badge: '' },
    { id: 'panduan', label: 'Panduan & FAQ', icon: HelpCircle, badge: '' },
    { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Settings, badge: '' },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          
          {/* Header inside mobile drawer */}
          <div className="p-4 flex items-center justify-between border-b border-slate-100 lg:hidden">
            <span className="font-extrabold text-base text-amber-600">Menu Navigasi</span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User miniature banner */}
          <div className="p-4 m-3 rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 text-white shadow-md">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-amber-400"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-900 font-bold flex items-center justify-center">
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-white">{user?.displayName || 'Pengguna'}</p>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 mt-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {user?.role || 'Siswa'}
                </span>
              </div>
            </div>
            {user?.divisionName && (
              <p className="text-[10px] text-slate-400 mt-2 truncate font-medium">
                Divisi: <span className="text-slate-200">{user.divisionName}</span>
              </p>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                        isActive
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer note */}
          <div className="p-3 border-t border-slate-100 text-center">
            <p className="text-[10px] font-semibold text-slate-400">
              SP-PPT © 2026 SMPN 10 Samarinda
            </p>
          </div>

        </div>
      </aside>
    </>
  );
};
