import React, { useState, useEffect } from 'react';
import {
  Wallet, Plus, CheckCircle, XCircle, Users, Calendar, Clock,
  Bell, Send, TrendingUp, AlertTriangle, X, Save, Search, Download,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { UserProfile, SystemNotification } from '../../core/types';
import { doc, collection, setDoc, updateDoc, deleteDoc, getDocs, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

interface KasSetting {
  id: string;
  classId: string;
  title: string;
  amount: number;
  deadline: string;
  description: string;
  active: boolean;
  createdBy: string;
  creatorName: string;
  createdAt: string;
}

interface KasPayment {
  id: string;
  kasId: string;
  classId: string;
  studentId: string;
  studentName: string;
  paid: boolean;
  paidAt?: string;
  note?: string;
  verifiedBy?: string;
}

export const KasModule: React.FC = () => {
  const { user, activeClass, isBendahara, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [kasList, setKasList] = useState<KasSetting[]>([]);
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedKas, setSelectedKas] = useState<KasSetting | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(new Date());

  // Form
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newDeadline, setNewDeadline] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = isBendahara || isGuruPengampu || isAdminRole;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'kasSettings'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as KasSetting));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setKasList(items);
      if (items.length > 0 && !selectedKas) setSelectedKas(items[0]);
    });
    fetchUsersByClass(activeClass.id).then(setUsers);
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!selectedKas) return;
    const q = query(collection(db, 'kasPayments'), where('kasId', '==', selectedKas.id));
    const unsub = onSnapshot(q, snap => {
      setPayments(snap.docs.map(d => ({ ...d.data(), id: d.id } as KasPayment)));
    });
    return () => unsub();
  }, [selectedKas]);

  const getCountdown = (deadline: string) => {
    const diff = new Date(deadline).getTime() - now.getTime();
    if (diff <= 0) {
      const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      return { text: `Terlambat ${days} hari`, color: 'text-rose-700 bg-rose-100 border-rose-300' };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (hours < 24) return { text: `${hours} jam lagi`, color: 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse font-bold' };
    if (hours <= 72) return { text: `${days} hari lagi`, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { text: `${days} hari lagi`, color: 'text-slate-700 bg-slate-50 border-slate-200' };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!newTitle.trim() || newAmount <= 0 || !newDeadline) {
      showToast('Lengkapi judul, nominal, dan deadline.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'kasSettings'));
      const newKas: KasSetting = {
        id: newRef.id,
        classId: activeClass.id,
        title: newTitle.trim(),
        amount: newAmount,
        deadline: new Date(newDeadline).toISOString(),
        description: newDesc.trim(),
        active: true,
        createdBy: user.uid,
        creatorName: user.displayName,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, newKas);

      // Auto-create payment records untuk semua siswa
      const allUsers = await fetchUsersByClass(activeClass.id);
      const students = allUsers.filter(u =>
        u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
        u.role !== 'Admin' && u.role !== 'Super Admin'
      );

      const batch = writeBatch(db);
      students.forEach(s => {
        const payRef = doc(db, 'kasPayments', `${newRef.id}_${s.uid}`);
        batch.set(payRef, {
          id: payRef.id,
          kasId: newRef.id,
          classId: activeClass.id,
          studentId: s.uid,
          studentName: s.displayName,
          paid: false,
        });

        // Notif ke siswa
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: s.uid,
          classId: activeClass.id,
          title: '💰 Tagihan Kas Baru',
          message: `"${newKas.title}" — Rp ${newAmount.toLocaleString('id-ID')} • Batas: ${new Date(newDeadline).toLocaleDateString('id-ID')}`,
          category: 'Keuangan',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
      });
      await batch.commit();

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Kas',
        targetId: newRef.id,
        details: `Buat tagihan kas: ${newTitle} (Rp ${newAmount.toLocaleString('id-ID')})`,
      });

      showToast('Tagihan kas berhasil dibuat & notifikasi terkirim ke semua siswa!', 'success');
      setIsCreateOpen(false);
      setNewTitle('');
      setNewAmount(0);
      setNewDeadline('');
      setNewDesc('');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePayment = async (p: KasPayment) => {
    if (!canManage || !user) return;
    try {
      await updateDoc(doc(db, 'kasPayments', p.id), {
        paid: !p.paid,
        paidAt: !p.paid ? new Date().toISOString() : null,
        verifiedBy: !p.paid ? user.displayName : null,
      });

      if (!p.paid) {
        // Notif ke siswa bahwa pembayaran diverifikasi
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          userId: p.studentId,
          classId: p.classId,
          title: '✅ Pembayaran Kas Diverifikasi',
          message: `Pembayaran kas Anda telah dikonfirmasi oleh ${user.displayName}`,
          category: 'Keuangan',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
      }

      showToast(!p.paid ? 'Pembayaran dikonfirmasi' : 'Pembayaran dibatalkan', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleSendReminder = async () => {
    if (!selectedKas || !user || !activeClass) return;
    if (!confirm(`Kirim reminder ke ${unpaid.length} siswa yang belum bayar?`)) return;

    try {
      const batch = writeBatch(db);
      unpaid.forEach(s => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: s.uid,
          classId: activeClass.id,
          title: '🔔 Reminder Kas',
          message: `Jangan lupa bayar kas "${selectedKas.title}" (Rp ${selectedKas.amount.toLocaleString('id-ID')}) sebelum deadline!`,
          category: 'Reminder',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      showToast(`Reminder terkirim ke ${unpaid.length} siswa.`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleDeleteKas = async (kas: KasSetting) => {
    if (!confirm(`Hapus tagihan "${kas.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'kasSettings', kas.id));
      const payQ = query(collection(db, 'kasPayments'), where('kasId', '==', kas.id));
      const paySnap = await getDocs(payQ);
      for (const p of paySnap.docs) await deleteDoc(p.ref);
      showToast('Tagihan kas dihapus', 'info');
      setSelectedKas(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // Stats
  const paidCount = payments.filter(p => p.paid).length;
  const unpaidCount = payments.filter(p => !p.paid).length;
  const totalCollected = paidCount * (selectedKas?.amount || 0);
  const totalTarget = payments.length * (selectedKas?.amount || 0);
  const collectedPct = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0;

  const students = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina' &&
    u.role !== 'Admin' && u.role !== 'Super Admin'
  );

  const unpaid = students.filter(s =>
    !payments.find(p => p.studentId === s.uid && p.paid)
  );

  const myPayment = payments.find(p => p.studentId === user?.uid);
  const isStudent = !canManage;

  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.displayName.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
  });

  const handleExport = () => {
    if (!selectedKas) return;
    const sheet1 = {
      name: 'Rekap Kas',
      headers: ['Nama', 'Role', 'Divisi', 'Status', 'Tanggal Bayar', 'Diverifikasi Oleh'],
      rows: filteredStudents.map(s => {
        const p = payments.find(x => x.studentId === s.uid);
        return [
          s.displayName,
          s.role,
          s.divisionName || '-',
          p?.paid ? 'Sudah Bayar' : 'Belum Bayar',
          p?.paidAt ? new Date(p.paidAt).toLocaleDateString('id-ID') : '-',
          p?.verifiedBy || '-',
        ];
      }),
    };
    const sheet2 = {
      name: 'Ringkasan',
      headers: ['Metrik', 'Nilai'],
      rows: [
        ['Judul Kas', selectedKas.title],
        ['Nominal per Siswa', selectedKas.amount],
        ['Total Target', totalTarget],
        ['Total Terkumpul', totalCollected],
        ['Siswa Sudah Bayar', paidCount],
        ['Siswa Belum Bayar', unpaidCount],
        ['Persentase', `${collectedPct}%`],
      ],
    };
    exportMultiSheetXLSX(`Kas_${selectedKas.title.replace(/\s+/g, '_')}.xls`, [sheet2, sheet1]);
    showToast('Rekap kas diekspor!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-800 text-white shadow-xl border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Wallet className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Kas Produksi
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Manajemen Uang Kas {activeClass?.name || ''}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Tagihan kas, konfirmasi pembayaran, reminder otomatis
              </p>
            </div>
          </div>

          {canManage && (
            <button onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition">
              <Plus className="w-4 h-4" />
              <span>Buat Tagihan Kas</span>
            </button>
          )}
        </div>
      </div>

      {/* List Kas */}
      {kasList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Wallet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Tagihan Kas</h3>
          <p className="text-xs text-slate-500 mt-1">
            {canManage ? 'Klik "Buat Tagihan Kas" untuk membuat tagihan pertama.' : 'Tunggu informasi dari Bendahara.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* List */}
            <div className="lg:col-span-1 space-y-2">
              <h3 className="text-xs font-bold text-slate-600 uppercase">Daftar Tagihan</h3>
              {kasList.map(k => {
                const cd = getCountdown(k.deadline);
                const isActive = selectedKas?.id === k.id;
                return (
                  <button key={k.id} onClick={() => setSelectedKas(k)}
                    className={`w-full p-4 rounded-2xl border text-left transition ${
                      isActive ? 'bg-emerald-50 border-emerald-400 shadow-sm' : 'bg-white border-slate-200 hover:border-emerald-300'
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${k.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {k.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(k.createdAt).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 truncate">{k.title}</p>
                    <p className="text-xs text-emerald-700 font-bold mt-0.5">
                      Rp {k.amount.toLocaleString('id-ID')}
                    </p>
                    <div className={`mt-2 p-1.5 rounded-lg border text-[10px] font-bold text-center ${cd.color}`}>
                      {cd.text}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail */}
            {selectedKas && (
              <div className="lg:col-span-2 space-y-4">
                {/* Info + Stats */}
                <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <h3 className="text-base font-black text-slate-900">{selectedKas.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{selectedKas.description}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Dibuat oleh <strong>{selectedKas.creatorName}</strong> • Deadline:{' '}
                        {new Date(selectedKas.deadline).toLocaleString('id-ID')}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1.5">
                        <button onClick={handleExport}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] flex items-center gap-1">
                          <Download className="w-3 h-3" /> Export
                        </button>
                        <button onClick={() => handleDeleteKas(selectedKas)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1">
                          <X className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-[10px] text-emerald-700 font-semibold">Sudah Bayar</p>
                      <p className="text-xl font-black text-emerald-800">{paidCount}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-[10px] text-rose-700 font-semibold">Belum Bayar</p>
                      <p className="text-xl font-black text-rose-800">{unpaidCount}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <p className="text-[10px] text-blue-700 font-semibold">Terkumpul</p>
                      <p className="text-xs font-black text-blue-800">Rp {totalCollected.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] text-slate-600 font-semibold">Progress</p>
                      <p className="text-xl font-black text-slate-800">{collectedPct}%</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                      style={{ width: `${collectedPct}%` }} />
                  </div>
                </div>

                {/* Reminder Button */}
                {canManage && unpaidCount > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-amber-600" />
                      <p className="text-xs text-amber-900">
                        <strong>{unpaidCount} siswa</strong> belum bayar — kirim reminder manual?
                      </p>
                    </div>
                    <button onClick={handleSendReminder}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                      <Send className="w-3.5 h-3.5" />
                      Kirim Reminder
                    </button>
                  </div>
                )}

                {/* Student's own view */}
                {isStudent && myPayment && (
                  <div className={`p-5 rounded-3xl border ${
                    myPayment.paid ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      {myPayment.paid ? (
                        <>
                          <CheckCircle className="w-10 h-10 text-emerald-600" />
                          <div>
                            <p className="text-sm font-black text-emerald-900">Sudah Bayar ✅</p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              Dikonfirmasi {myPayment.paidAt ? new Date(myPayment.paidAt).toLocaleString('id-ID') : ''}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-10 h-10 text-rose-600" />
                          <div>
                            <p className="text-sm font-black text-rose-900">Belum Bayar</p>
                            <p className="text-xs text-rose-700 mt-0.5">
                              Nominal: Rp {selectedKas.amount.toLocaleString('id-ID')} — Bayar ke Bendahara
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Tabel Siswa */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Cari nama siswa..."
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 text-xs font-semibold border-0 focus:outline-none" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-3 px-4">Nama</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4">Tgl Bayar</th>
                          {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map(s => {
                          const p = payments.find(x => x.studentId === s.uid);
                          return (
                            <tr key={s.uid} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-bold text-slate-800">{s.displayName}</td>
                              <td className="py-3 px-4 text-slate-600 text-[11px]">{s.role}</td>
                              <td className="py-3 px-4 text-center">
                                {p?.paid ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    ✅ Sudah Bayar
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                                    ⏳ Belum
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                                {p?.paidAt ? new Date(p.paidAt).toLocaleDateString('id-ID') : '-'}
                              </td>
                              {canManage && p && (
                                <td className="py-3 px-4 text-right">
                                  <button onClick={() => handleTogglePayment(p)}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] ${
                                      p.paid ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                    }`}>
                                    {p.paid ? 'Batal' : 'Konfirmasi'}
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Create */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" /> Buat Tagihan Kas Baru
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Tagihan <span className="text-rose-500">*</span></label>
                <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Kas Produksi Minggu 1"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nominal per Siswa (Rp) <span className="text-rose-500">*</span></label>
                <input type="number" required min="1000" step="1000" value={newAmount || ''}
                  onChange={(e) => setNewAmount(parseInt(e.target.value) || 0)}
                  placeholder="10000"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deadline <span className="text-rose-500">*</span></label>
                <input type="datetime-local" required value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan</label>
                <textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Contoh: Untuk pembelian properti keris..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800" />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900">
                  Notifikasi tagihan akan otomatis dikirim ke semua siswa. Reminder otomatis H-3, H-1, dan setelah deadline.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : 'Buat Tagihan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
