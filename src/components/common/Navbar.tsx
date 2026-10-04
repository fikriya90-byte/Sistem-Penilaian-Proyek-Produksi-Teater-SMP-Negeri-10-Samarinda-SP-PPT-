import React, { useState, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { APP_CONFIG } from '../../core/constants';
import { subscribeNotifications, markNotificationAsRead } from '../../services/firestoreService';
import { SystemNotification } from '../../core/types';
import { useToast } from './Toast';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate: (module: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigate }) => {
  const { user, activeClass, classes, setActiveClass, logout } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showClassMenu, setShowClassMenu] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, (notifs) => setNotifications(notifs));
    return () => unsub();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleReadNotif = async (n: SystemNotification) => {
    await markNotificationAsRead(n.id);
    if (n.link) onNavigate(n.link);
    setShowNotifMenu(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center gap-3">
            <button onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle menu">
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
              <div className="flex items-center gap-1.5 shrink-0">
                <img src={APP_CONFIG.logoSchool} alt="SMPN 10 Samarinda" className="w-9 h-9 sm:w-11 sm:h-11 object-contain" />
                <img src={APP_CONFIG.logoMapel} alt="Mapel Seni Budaya" className="w-9 h-9 sm:w-11 sm:h-11 object-contain hidden sm:block" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-amber-600 via-amber-500 to-blue-700 bg-clip-text text-transparent">
                    SP-PPT
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    Kls IX
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[170px] sm:max-w-xs">
                  SMP Negeri 10 Samarinda
                </p>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowClassMenu(!showClassMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>{activeClass?.name || 'Pilih Kelas'}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showClassMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Pilih Kelas Aktif
                  </div>
                  {classes.map(c => (
                    <button key={c.id}
                      onClick={() => { setActiveClass(c); setShowClassMenu(false); showToast(`Beralih ke ${c.name}`, 'info'); }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition ${
                        activeClass?.id === c.id ? 'bg-amber-50 font-bold text-amber-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}>
                      <span>{c.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{c.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Tahap: Pelaksanaan</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                aria-label="Notifikasi">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-sm text-slate-900">Notifikasi</span>
                    <button onClick={() => onNavigate('notifikasi')} className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                      Lihat Semua
                    </button>
                  </div>
                  <div className="py-2 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">Tidak ada notifikasi baru.</p>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div key={n.id} onClick={() => handleReadNotif(n)}
                          className={`p-2.5 rounded-xl cursor-pointer transition ${
                            n.read ? 'opacity-60 hover:bg-slate-50' : 'bg-blue-50/60 hover:bg-blue-50'
                          }`}>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-blue-700">{n.category}</span>
                            <span className="text-slate-400">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 line-clamp-1">{n.title}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={async () => { await logout(); showToast('Anda telah logout dari SP-PPT.', 'info'); }}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Keluar dari Akun">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
