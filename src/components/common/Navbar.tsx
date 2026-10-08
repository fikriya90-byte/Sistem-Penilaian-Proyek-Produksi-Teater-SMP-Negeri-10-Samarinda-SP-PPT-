import React, { useState, useEffect } from 'react';
import {
  Bell, ChevronDown, LogOut, Menu, Sparkles, Users, Sun, Moon, Monitor,
  CheckCheck, Search, ArrowLeft, Home,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useTheme } from '../../core/themeContext';
import { APP_CONFIG } from '../../core/constants';
import {
  subscribeNotifications, markNotificationAsRead, markAllNotificationsAsRead,
} from '../../services/firestoreService';
import { SystemNotification } from '../../core/types';
import { useToast } from './Toast';
import { LogoutConfirmModal } from '../auth/LogoutConfirmModal';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate: (module: string) => void;
  view?: 'welcome' | 'in-class';
  onExitClass?: () => void;
}

type NotifFilter = 'ALL' | 'UNREAD' | 'TUGAS' | 'REMINDER' | 'INFO' | 'URGENT';

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  onNavigate,
  view = 'in-class',
  onExitClass,
}) => {
  const { user, activeClass, classes, setActiveClass, logout, isGuruPengampu, isAdminRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showClassMenu, setShowClassMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifFilter, setNotifFilter] = useState<NotifFilter>('ALL');
  const [notifSearch, setNotifSearch] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const canSwitchClass = (isGuruPengampu || isAdminRole) && view === 'in-class';

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, (notifs) => setNotifications(notifs));
    return () => unsub();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ✅ KLIK NOTIFIKASI → ARAHKAN KE HALAMAN TUJUAN (link) atau ke Notifikasi Saya
  const handleReadNotif = async (n: SystemNotification) => {
    await markNotificationAsRead(n.id);
    setShowNotifMenu(false);

    // Kalau notif punya link target → ke sana
    if (n.link && n.link.trim()) {
      onNavigate(n.link);
    } else {
      onNavigate('notifikasi');
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    try {
      const count = await markAllNotificationsAsRead(user.uid);
      showToast(count > 0 ? `${count} notifikasi ditandai dibaca.` : 'Tidak ada notifikasi baru.', 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    showToast('Anda telah logout dari SP-PPT.', 'info');
  };

  const filteredNotifications = notifications.filter(n => {
    if (notifFilter === 'UNREAD' && n.read) return false;
    if (notifFilter === 'TUGAS' && n.category !== 'Tugas' && n.category !== 'Feedback') return false;
    if (notifFilter === 'REMINDER' && n.category !== 'Reminder') return false;
    if (notifFilter === 'INFO' && n.category !== 'Pengumuman' && n.category !== 'Sistem') return false;
    if (notifFilter === 'URGENT' && n.category !== 'Urgent') return false;
    if (notifSearch.trim()) {
      const q = notifSearch.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Tugas': return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20';
      case 'Feedback': return 'text-pink-700 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/20';
      case 'Reminder': return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/20';
      case 'Urgent': return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/20';
      case 'Pengumuman': return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/20';
      case 'Nilai': return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/20';
      case 'Keuangan': return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/20';
      case 'Sistem': return 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-500/20';
      default: return 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700';
    }
  };

  const themeIcon =
    theme === 'light' ? <Sun className="w-5 h-5" /> :
    theme === 'dark' ? <Moon className="w-5 h-5" /> :
    <Monitor className="w-5 h-5" />;

  const themeLabel =
    theme === 'light' ? 'Terang' :
    theme === 'dark' ? 'Gelap' : 'Auto';

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">

            {/* LEFT */}
            <div className="flex items-center gap-2 sm:gap-3">
              {view === 'in-class' && onExitClass && (
                <button
                  onClick={onExitClass}
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 transition flex items-center gap-1"
                  title="Kembali ke Beranda Utama"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline text-[11px] font-bold">Kembali</span>
                </button>
              )}

              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Toggle menu"
              >
                <Menu className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
                <div className="flex items-center gap-1.5 shrink-0">
                  <img src={APP_CONFIG.logoSchool} alt="SMPN 10" className="w-9 h-9 sm:w-11 sm:h-11 object-contain" />
                  <img src={APP_CONFIG.logoMapel} alt="Seni Budaya" className="w-9 h-9 sm:w-11 sm:h-11 object-contain hidden sm:block" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-amber-600 via-amber-500 to-blue-700 bg-clip-text text-transparent">
                      SP-PPT
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                      Kls IX
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[170px] sm:max-w-xs">
                    {view === 'welcome' ? 'Beranda Utama' : 'SMP Negeri 10 Samarinda'}
                  </p>
                </div>
              </div>
            </div>

            {/* CENTER — Class Switcher */}
            {canSwitchClass && activeClass && (
              <div className="hidden md:flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowClassMenu(!showClassMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{activeClass.name}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {showClassMenu && (
                    <div className="absolute left-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50">
                      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Pilih Kelas Aktif
                      </div>
                      {classes.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setActiveClass(c); setShowClassMenu(false); showToast(`Beralih ke ${c.name}`, 'info'); }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition ${
                            activeClass?.id === c.id
                              ? 'bg-amber-50 dark:bg-amber-500/20 font-bold text-amber-700 dark:text-amber-300'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.code}</span>
                        </button>
                      ))}
                      <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                        <button
                          onClick={() => { setShowClassMenu(false); if (onExitClass) onExitClass(); }}
                          className="w-full text-left px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 flex items-center gap-1.5"
                        >
                          <Home className="w-3.5 h-3.5" /> Kembali ke Beranda
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Di Kelas</span>
                </div>
              </div>
            )}

            {/* RIGHT */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/30 transition"
                title={`Tema: ${themeLabel}`}
              >
                {themeIcon}
                <span className="hidden sm:inline text-[11px] font-bold">{themeLabel}</span>
              </button>

              {/* NOTIFICATION */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifMenu(!showNotifMenu)}
                  className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Notifikasi"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifMenu && (
                  <>
                    <div
                      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 sm:hidden"
                      onClick={() => setShowNotifMenu(false)}
                    />

                    <div className={`
                      fixed sm:absolute z-50
                      right-2 left-2 top-20 sm:left-auto sm:right-0 sm:top-auto sm:mt-2
                      sm:w-[26rem] w-auto
                      bg-white dark:bg-slate-800 sm:rounded-2xl rounded-2xl
                      shadow-2xl border border-slate-200 dark:border-slate-700
                      max-h-[calc(100vh-6rem)] sm:max-h-[85vh]
                      flex flex-col overflow-hidden
                    `}>
                      <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <Bell className="w-4 h-4" /> Notifikasi
                            {unreadCount > 0 && (
                              <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded-full">
                                {unreadCount} baru
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => { onNavigate('notifikasi'); setShowNotifMenu(false); }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            Lihat Semua
                          </button>
                        </div>

                        <button
                          onClick={handleMarkAllRead}
                          disabled={markingAll || unreadCount === 0}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Tandai Semua Dibaca
                        </button>

                        <div className="relative mt-2">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Cari notifikasi..."
                            value={notifSearch}
                            onChange={(e) => setNotifSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-semibold text-slate-800 dark:text-white"
                          />
                        </div>

                        <div className="flex items-center gap-1 mt-2 overflow-x-auto scrollbar-none">
                          {([
                            { val: 'ALL', label: 'Semua' },
                            { val: 'UNREAD', label: 'Belum' },
                            { val: 'TUGAS', label: 'Tugas' },
                            { val: 'REMINDER', label: 'Reminder' },
                            { val: 'INFO', label: 'Info' },
                            { val: 'URGENT', label: 'Urgent' },
                          ] as { val: NotifFilter; label: string }[]).map(f => (
                            <button
                              key={f.val}
                              onClick={() => setNotifFilter(f.val)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                                notifFilter === f.val
                                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredNotifications.length === 0 ? (
                          <p className="text-center text-xs text-slate-400 py-8">
                            {notifFilter === 'UNREAD' ? 'Tidak ada notifikasi belum dibaca.' : 'Tidak ada notifikasi.'}
                          </p>
                        ) : (
                          filteredNotifications.slice(0, 30).map(n => (
                            <div
                              key={n.id}
                              onClick={() => handleReadNotif(n)}
                              className={`p-3 cursor-pointer transition ${
                                n.read ? 'hover:bg-slate-50 dark:hover:bg-slate-700/40' : 'bg-blue-50/40 dark:bg-blue-500/10 hover:bg-blue-50 dark:hover:bg-blue-500/20'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className={`font-bold px-2 py-0.5 rounded-md ${getCategoryColor(n.category)}`}>
                                  {n.category}
                                </span>
                                <span className="text-slate-400">
                                  {new Date(n.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className={`text-xs font-medium line-clamp-1 ${n.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white font-bold'}`}>
                                {n.title}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                {n.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      {filteredNotifications.length > 30 && (
                        <div className="p-2 border-t border-slate-100 dark:border-slate-700 text-center">
                          <button
                            onClick={() => { onNavigate('notifikasi'); setShowNotifMenu(false); }}
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Lihat semua {filteredNotifications.length} notifikasi
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                title="Keluar"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={handleConfirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </>
  );
};