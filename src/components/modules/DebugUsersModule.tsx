import React, { useState, useEffect } from 'react';
import {
  Bug, RefreshCw, Search, Users, Database, AlertTriangle,
  CheckCircle, Wrench,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  collection, getDocs, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

export const DebugUsersModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'NO_CLASS' | 'MATCH_CLASS'>('ALL');
  const [fixing, setFixing] = useState(false);

  const loadAllUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
      setAllUsers(list);
    } catch (err: any) {
      showToast('Gagal load users: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAllUsers(); }, []);

  const filtered = allUsers.filter(u => {
    if (filterMode === 'NO_CLASS') {
      if (u.classId && u.classId.trim()) return false;
    }
    if (filterMode === 'MATCH_CLASS' && activeClass) {
      const matchId = u.classId === activeClass.id;
      const matchName = (u.className || '').toLowerCase().trim() === activeClass.name.toLowerCase().trim();
      if (!matchId && !matchName) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        (u.classId || '').toLowerCase().includes(q) ||
        (u.className || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleFixAll = async () => {
    if (!activeClass) {
      showToast('Masuk ke kelas dulu untuk fix.', 'warning');
      return;
    }

    const toFix = allUsers.filter(u => {
      const matchName = (u.className || '').toLowerCase().trim() === activeClass.name.toLowerCase().trim();
      const matchId = u.classId === activeClass.id;
      return (matchName && !matchId) || (matchId && !matchName);
    });

    if (toFix.length === 0) {
      showToast('Tidak ada user yang perlu diperbaiki.', 'info');
      return;
    }

    if (!confirm(`Perbaiki ${toFix.length} user agar classId & className match dengan "${activeClass.name}"?`)) return;

    setFixing(true);
    let fixed = 0;
    try {
      for (const u of toFix) {
        try {
          await updateDoc(doc(db, 'users', u.uid), {
            classId: activeClass.id,
            className: activeClass.name,
            updatedAt: new Date().toISOString(),
          });
          fixed++;
        } catch (err) {
          console.warn('Fix error:', u.displayName, err);
        }
      }

      if (user) {
        await recordAuditLog({
          userId: user.uid, userName: user.displayName, role: user.role,
          action: 'UPDATE', targetType: 'UsersBulkFix', targetId: activeClass.id,
          details: `Perbaiki ${fixed} user → kelas ${activeClass.name}`,
        });
      }

      showToast(`${fixed} user berhasil diperbaiki!`, 'success');
      await loadAllUsers();
    } catch (err: any) {
      showToast('Gagal fix: ' + err.message, 'error');
    } finally {
      setFixing(false);
    }
  };

  const handleFixOne = async (u: any) => {
    if (!activeClass) {
      showToast('Masuk ke kelas dulu.', 'warning');
      return;
    }
    if (!confirm(`Pindahkan ${u.displayName} ke kelas ${activeClass.name}?`)) return;
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        classId: activeClass.id,
        className: activeClass.name,
        updatedAt: new Date().toISOString(),
      });
      showToast(`${u.displayName} → ${activeClass.name}`, 'success');
      await loadAllUsers();
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const stats = {
    total: allUsers.length,
    noClass: allUsers.filter(u => !u.classId || !u.classId.trim()).length,
    matchActive: activeClass
      ? allUsers.filter(u => {
          const matchId = u.classId === activeClass.id;
          const matchName = (u.className || '').toLowerCase().trim() === activeClass.name.toLowerCase().trim();
          return matchId || matchName;
        }).length
      : 0,
    students: allUsers.filter(u =>
      u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
      u.role !== 'Admin' && u.role !== 'Super Admin'
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-900 text-white shadow-xl border border-purple-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Bug className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                Debug & Repair
              </span>
              <h2 className="text-xl font-black text-white mt-1">Cek Data User Firestore</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Lihat semua user & perbaiki yang classId-nya kosong
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadAllUsers}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {activeClass && (
              <button
                onClick={handleFixAll}
                disabled={fixing}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                <Wrench className="w-3.5 h-3.5" /> {fixing ? 'Memperbaiki...' : `Fix ke ${activeClass.name}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* INFO */}
      <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
          <p><strong>Cara pakai:</strong></p>
          <ol className="list-decimal pl-4 mt-1 space-y-0.5">
            <li>Masuk ke kelas yang bermasalah</li>
            <li>Lihat daftar user di bawah</li>
            <li>Cari user dengan <strong className="text-rose-600">classId KOSONG</strong> (baris merah)</li>
            <li>Klik tombol <strong>"Fix ke [kelas]"</strong> di atas → otomatis perbaiki semua</li>
            <li>Refresh halaman Presensi → siswa harusnya sudah muncul</li>
          </ol>
          <p className="mt-1.5"><strong>Kalau user TIDAK ADA sama sekali di list:</strong> berarti profil Firestore-nya belum dibuat → siswa harus <strong>daftar ulang</strong> (log out dulu, lalu register ulang dengan kode kelas).</p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <Database className="w-5 h-5 text-slate-500 mb-1" />
          <p className="text-[10px] text-slate-500 font-semibold">Total Users</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 mb-1" />
          <p className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold">Tanpa classId</p>
          <p className="text-2xl font-black text-rose-800 dark:text-rose-200">{stats.noClass}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1" />
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
            Match {activeClass?.name || '-'}
          </p>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{stats.matchActive}</p>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 shadow-sm">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
          <p className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold">Total Siswa</p>
          <p className="text-2xl font-black text-blue-800 dark:text-blue-200">{stats.students}</p>
        </div>
      </div>

      {/* FILTER */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, email, classId, className..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {(['ALL', 'NO_CLASS', 'MATCH_CLASS'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterMode(f)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filterMode === f
                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {f === 'ALL' ? `Semua (${stats.total})` :
               f === 'NO_CLASS' ? `Tanpa classId (${stats.noClass})` :
               `Match ${activeClass?.name || '-'} (${stats.matchActive})`}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          Memuat data user...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">Tidak ada user dengan filter ini</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-3 px-3">Nama</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">classId</th>
                  <th className="py-3 px-3">className</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(u => {
                  const noClass = !u.classId || !u.classId.trim();
                  const noName = !u.className || !u.className.trim();
                  const needsFix = activeClass && (noClass || noName || u.classId !== activeClass.id);
                  return (
                    <tr key={u.uid} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${noClass ? 'bg-rose-50/40 dark:bg-rose-500/5' : ''}`}>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{u.displayName || '-'}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                        {u.email || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40">
                          {u.role || '?'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {noClass ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-500/20 px-2 py-0.5 rounded-md">
                            ❌ KOSONG
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">{u.classId}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400">
                        {u.className || <span className="text-rose-600 font-bold">❌ KOSONG</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {needsFix && activeClass ? (
                          <button
                            onClick={() => handleFixOne(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 ml-auto"
                            title={`Pindahkan ke ${activeClass.name}`}
                          >
                            <Wrench className="w-3 h-3" /> Fix
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};