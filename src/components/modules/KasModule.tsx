import React, { useState, useEffect } from 'react';
import {
  Wallet, Plus, CheckCircle, XCircle, Users, Calendar, Clock,
  Bell, Send, TrendingUp, AlertTriangle, X, Save, Search, Download,
  Power, PowerOff, Info, Heart, ChevronRight, Settings2, Trash2,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { UserProfile } from '../../core/types';
import {
  doc, collection, setDoc, updateDoc, deleteDoc, getDocs, query, where,
  onSnapshot, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

// =====================================================
// TIPE DATA
// =====================================================
type PeriodType = 'WEEKLY' | 'BIWEEKLY' | 'TEN_DAYS' | 'MANUAL';

interface KasSetting {
  id: string;
  classId: string;
  title: string;
  amount: number;
  periodType: PeriodType;
  deadline: string;
  description: string;
  active: boolean;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt?: string;
}

interface KasPeriod {
  id: string;
  kasId: string;
  classId: string;
  periodNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  deadline: string;
  createdAt: string;
}

interface KasPayment {
  id: string;
  kasId: string;
  periodId: string;
  classId: string;
  studentId: string;
  studentName: string;
  paid: boolean;
  paidAt?: string;
  verifiedBy?: string;
  note?: string;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  WEEKLY: 'Mingguan',
  BIWEEKLY: 'Dua Mingguan',
  TEN_DAYS: 'Per 10 Hari',
  MANUAL: 'Manual',
};

const PERIOD_DAYS: Record<PeriodType, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  TEN_DAYS: 10,
  MANUAL: 0,
};

export const KasModule: React.FC = () => {
  const { user, activeClass, isBendahara, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [kasSetting, setKasSetting] = useState<KasSetting | null>(null);
  const [periods, setPeriods] = useState<KasPeriod[]>([]);
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  // Form Aktivasi
  const [actTitle, setActTitle] = useState('Kas Produksi Teater');
  const [actAmount, setActAmount] = useState<number>(0);
  const [actPeriodType, setActPeriodType] = useState<PeriodType>('WEEKLY');
  const [actDeadline, setActDeadline] = useState('');
  const [actDesc, setActDesc] = useState('');

  // Form Tambah Periode (untuk MANUAL)
  const [newPeriodLabel, setNewPeriodLabel] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newPeriodDeadline, setNewPeriodDeadline] = useState('');

  const canManage = isBendahara || isGuruPengampu || isAdminRole;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe ke setting kas kelas ini
  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'kasSettings'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) {
        setKasSetting(null);
      } else {
        const data = { ...snap.docs[0].data(), id: snap.docs[0].id } as KasSetting;
        setKasSetting(data);
        setActTitle(data.title);
        setActAmount(data.amount);
        setActPeriodType(data.periodType);
        setActDeadline(data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : '');
        setActDesc(data.description);
      }
    });
    fetchUsersByClass(activeClass.id).then(setUsers);
    return () => unsub();
  }, [activeClass]);

  // Subscribe ke periods
  useEffect(() => {
    if (!kasSetting) { setPeriods([]); return; }
    const q = query(collection(db, 'kasPeriods'), where('kasId', '==', kasSetting.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as KasPeriod));
      list.sort((a, b) => a.periodNumber - b.periodNumber);
      setPeriods(list);
      if (list.length > 0 && !activePeriodId) {
        const last = list[list.length - 1];
        setActivePeriodId(last.id);
      }
    });
    return () => unsub();
  }, [kasSetting]);

  // Subscribe ke payments untuk semua periode kas ini
  useEffect(() => {
    if (!kasSetting) { setPayments([]); return; }
    const q = query(collection(db, 'kasPayments'), where('kasId', '==', kasSetting.id));
    const unsub = onSnapshot(q, snap => {
      setPayments(snap.docs.map(d => ({ ...d.data(), id: d.id } as KasPayment)));
    });
    return () => unsub();
  }, [kasSetting]);

  // ==========================================
  // AKTIVASI KAS — kesepakatan kelas
  // ==========================================
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!actTitle.trim() || actAmount <= 0) {
      showToast('Lengkapi judul dan nominal per periode.', 'warning');
      return;
    }
    if (actPeriodType !== 'MANUAL' && !actDeadline) {
      showToast('Isi tenggat waktu pembayaran.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'kasSettings'));
      const newKas: KasSetting = {
        id: newRef.id,
        classId: activeClass.id,
        title: actTitle.trim(),
        amount: actAmount,
        periodType: actPeriodType,
        deadline: actDeadline ? new Date(actDeadline).toISOString() : '',
        description: actDesc.trim(),
        active: true,
        createdBy: user.uid,
        creatorName: user.displayName,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, newKas);

      // Auto-generate periode pertama
      await createNextPeriod(newKas, 1);

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Kas',
        targetId: newRef.id,
        details: `Aktivasi kas: ${actTitle} (Rp ${actAmount.toLocaleString('id-ID')}, ${PERIOD_LABELS[actPeriodType]})`,
      });

      showToast('Fitur kas berhasil diaktifkan! Kesepakatan kelas dicatat.', 'success');
      setIsActivating(false);
    } catch (err: any) {
      showToast('Gagal mengaktifkan kas: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const createNextPeriod = async (kas: KasSetting, periodNumber: number) => {
    const days = PERIOD_DAYS[kas.periodType] || 7;
    const start = new Date();
    const end = new Date(start.getTime() + days * 86400000);
    const newRef = doc(collection(db, 'kasPeriods'));

    const period: KasPeriod = {
      id: newRef.id,
      kasId: kas.id,
      classId: kas.classId,
      periodNumber,
      label: `Periode ${periodNumber}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      deadline: kas.deadline || end.toISOString(),
      createdAt: new Date().toISOString(),
    };
    await setDoc(newRef, period);
    return period;
  };

  const handleAddManualPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasSetting || !newPeriodLabel.trim()) {
      showToast('Isi label periode.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const nextNum = periods.length > 0 ? Math.max(...periods.map(p => p.periodNumber)) + 1 : 1;
      const newRef = doc(collection(db, 'kasPeriods'));
      await setDoc(newRef, {
        id: newRef.id,
        kasId: kasSetting.id,
        classId: kasSetting.classId,
        periodNumber: nextNum,
        label: newPeriodLabel.trim(),
        startDate: newPeriodStart || new Date().toISOString(),
        endDate: newPeriodEnd || new Date().toISOString(),
        deadline: newPeriodDeadline || newPeriodEnd || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      showToast('Periode baru ditambahkan.', 'success');
      setIsAddingPeriod(false);
      setNewPeriodLabel('');
      setNewPeriodStart('');
      setNewPeriodEnd('');
      setNewPeriodDeadline('');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAutoPeriod = async () => {
    if (!kasSetting) return;
    const nextNum = periods.length > 0 ? Math.max(...periods.map(p => p.periodNumber)) + 1 : 1;
    try {
      const p = await createNextPeriod(kasSetting, nextNum);
      setActivePeriodId(p.id);
      showToast(`Periode ${nextNum} berhasil dibuat.`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  // ==========================================
  // UPDATE PENGATURAN KAS
  // ==========================================
  const handleUpdateSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasSetting || !user) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'kasSettings', kasSetting.id), {
        title: actTitle.trim(),
        amount: actAmount,
        periodType: actPeriodType,
        deadline: actDeadline ? new Date(actDeadline).toISOString() : kasSetting.deadline,
        description: actDesc.trim(),
        updatedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Kas',
        targetId: kasSetting.id,
        details: `Update pengaturan kas`,
      });
      showToast('Pengaturan kas diperbarui.', 'success');
      setIsEditing(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!kasSetting || !user) return;
    const willBeActive = !kasSetting.active;
    if (!confirm(`${willBeActive ? 'Aktifkan' : 'Nonaktifkan'} fitur kas?`)) return;
    try {
      await updateDoc(doc(db, 'kasSettings', kasSetting.id), {
        active: willBeActive,
        updatedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'Kas',
        targetId: kasSetting.id,
        details: `${willBeActive ? 'Aktifkan' : 'Nonaktifkan'} kas`,
      });
      showToast(`Fitur kas ${willBeActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const handleResetKas = async () => {
    if (!kasSetting || !user) return;
    if (!confirm('HAPUS semua pengaturan kas, periode, dan riwayat pembayaran? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      // Hapus periods dan payments
      const pq = query(collection(db, 'kasPeriods'), where('kasId', '==', kasSetting.id));
      const pSnap = await getDocs(pq);
      for (const d of pSnap.docs) await deleteDoc(d.ref);

      const payq = query(collection(db, 'kasPayments'), where('kasId', '==', kasSetting.id));
      const paySnap = await getDocs(payq);
      for (const d of paySnap.docs) await deleteDoc(d.ref);

      await deleteDoc(doc(db, 'kasSettings', kasSetting.id));
      showToast('Kas berhasil direset.', 'info');
      setKasSetting(null);
      setPeriods([]);
      setPayments([]);
    } catch (err: any) {
      showToast('Gagal reset: ' + err.message, 'error');
    }
  };

  // ==========================================
  // CENTANG PEMBAYARAN
  // ==========================================
  const handleTogglePayment = async (student: UserProfile) => {
    if (!canManage || !user || !kasSetting || !activePeriodId) return;
    const key = `${kasSetting.id}_${activePeriodId}_${student.uid}`;
    const existing = payments.find(p => p.id === key);
    const newPaid = !existing?.paid;

    try {
      await setDoc(doc(db, 'kasPayments', key), {
        id: key,
        kasId: kasSetting.id,
        periodId: activePeriodId,
        classId: kasSetting.classId,
        studentId: student.uid,
        studentName: student.displayName,
        paid: newPaid,
        paidAt: newPaid ? new Date().toISOString() : null,
        verifiedBy: newPaid ? user.displayName : null,
      });

      // Notif ke siswa jika baru dicentang
      if (newPaid) {
        try {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: student.uid,
            classId: kasSetting.classId,
            title: '✅ Pembayaran Kas Terkonfirmasi',
            message: `Terima kasih! Pembayaran kas ${kasSetting.title} Anda telah diverifikasi oleh ${user.displayName}.`,
            category: 'Keuangan',
            read: false,
            link: 'kas',
            createdAt: new Date().toISOString(),
          });
        } catch { /* non-fatal */ }
      }

      showToast(newPaid ? `✅ ${student.displayName} ditandai sudah bayar.` : 'Pembayaran dibatalkan.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // ==========================================
  // KIRIM REMINDER SANTUN
  // ==========================================
  const handleSendReminder = async () => {
    if (!kasSetting || !activePeriodId || !user || !activeClass) return;
    const activePeriod = periods.find(p => p.id === activePeriodId);
    if (!activePeriod) return;

    const unpaid = studentsWithoutPaid;
    if (unpaid.length === 0) {
      showToast('Semua siswa sudah membayar. Tidak ada reminder yang dikirim.', 'info');
      return;
    }

    if (!confirm(`Kirim reminder SANTUN ke ${unpaid.length} siswa yang belum bayar?`)) return;

    try {
      const batch = writeBatch(db);
      unpaid.forEach(s => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: s.uid,
          classId: activeClass.id,
          title: '💌 Pengingat Kas',
          message: `Halo ${s.displayName.split(' ')[0]}, kami ingin mengingatkan dengan hormat bahwa kas "${kasSetting.title}" untuk ${activePeriod.label} sebesar Rp ${kasSetting.amount.toLocaleString('id-ID')} belum tercatat. Silakan koordinasikan dengan Bendahara ya. Terima kasih. 🙏`,
          category: 'Reminder',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      showToast(`Reminder santun terkirim ke ${unpaid.length} siswa.`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // ==========================================
  // HITUNG STATISTIK
  // ==========================================
  const students = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
  );

  const activePeriod = periods.find(p => p.id === activePeriodId);
  const activePeriodPayments = payments.filter(p => p.periodId === activePeriodId && p.paid);
  const studentsWithoutPaid = students.filter(s =>
    !payments.find(p => p.periodId === activePeriodId && p.studentId === s.uid && p.paid)
  );

  // Saldo terakumulasi (semua periode)
  const totalPaidCount = payments.filter(p => p.paid).length;
  const saldoTerkumpul = kasSetting ? totalPaidCount * kasSetting.amount : 0;

  const activePaidCount = activePeriodPayments.length;
  const activePct = students.length > 0 ? Math.round((activePaidCount / students.length) * 100) : 0;

  // Cek lewat tenggat
  const activeDeadline = activePeriod ? new Date(activePeriod.deadline) : null;
  const isOverdue = activeDeadline ? activeDeadline.getTime() < now.getTime() : false;

  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.displayName.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
  });

  const handleExport = () => {
    if (!kasSetting || !activePeriod) return;
    const sheet1 = {
      name: `Periode ${activePeriod.periodNumber}`,
      headers: ['Nama', 'Role', 'Divisi', 'Status', 'Tanggal Bayar', 'Diverifikasi'],
      rows: filteredStudents.map(s => {
        const p = payments.find(x => x.periodId === activePeriodId && x.studentId === s.uid);
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
        ['Judul Kas', kasSetting.title],
        ['Nominal per Periode', kasSetting.amount],
        ['Tipe Periode', PERIOD_LABELS[kasSetting.periodType]],
        ['Total Periode', periods.length],
        ['Total Terkumpul (Rp)', saldoTerkumpul],
        ['Sudah Bayar Periode Aktif', activePaidCount],
        ['Belum Bayar Periode Aktif', students.length - activePaidCount],
        ['Persentase Periode Aktif', `${activePct}%`],
      ],
    };
    exportMultiSheetXLSX(`Kas_${kasSetting.title.replace(/\s+/g, '_')}.xls`, [sheet2, sheet1]);
    showToast('Rekap kas diekspor!', 'success');
  };

  // ==========================================
  // RENDER
  // ==========================================
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
                Kesepakatan kelas — centang per periode — saldo terakumulasi otomatis
              </p>
            </div>
          </div>

          {canManage && kasSetting && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleToggleActive}
                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ${
                  kasSetting.active
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {kasSetting.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                {kasSetting.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20"
              >
                <Settings2 className="w-3.5 h-3.5" /> Pengaturan
              </button>
              <button
                onClick={handleResetKas}
                className="px-3 py-2 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============ BELUM ADA KAS ============ */}
      {!kasSetting && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <Wallet className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
            Fitur Kas Belum Diaktifkan
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg mx-auto">
            Kas adalah kesepakatan kelas. Sebelum diaktifkan, pastikan nominal dan periode pengumpulan
            sudah disepakati bersama.
          </p>
          {canManage && (
            <button
              onClick={() => setIsActivating(true)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 mx-auto shadow-md"
            >
              <Power className="w-4 h-4" /> Aktifkan Fitur Kas
            </button>
          )}
        </div>
      )}

      {/* ============ KAS AKTIF ============ */}
      {kasSetting && kasSetting.active && (
        <>
          {/* Status banner */}
          <div className={`p-4 rounded-2xl border-2 flex items-start gap-3 ${
            isOverdue
              ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40'
              : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
          }`}>
            {isOverdue ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className={`text-xs ${isOverdue ? 'text-rose-900 dark:text-rose-200' : 'text-emerald-900 dark:text-emerald-200'}`}>
              <p className="font-extrabold">
                {isOverdue ? '⏰ Sudah Melewati Tenggat Waktu' : '💰 Kas Sedang Berjalan'}
              </p>
              <p className="mt-0.5 leading-relaxed">
                {isOverdue
                  ? `Periode ${activePeriod?.periodNumber} sudah melewati tenggat. Bendahara akan segera mengirim pengingat yang santun.`
                  : `Periode aktif: ${activePeriod?.label} — Tenggat ${activeDeadline ? activeDeadline.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}`}
              </p>
            </div>
          </div>

          {/* Kartu Pengaturan Kas */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white">{kasSetting.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{kasSetting.description || 'Kas produksi teater'}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Diaktifkan oleh <strong>{kasSetting.creatorName}</strong> • Tipe: {PERIOD_LABELS[kasSetting.periodType]}
                </p>
              </div>
              {canManage && (
                <button onClick={handleExport}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-bold text-[11px] flex items-center gap-1">
                  <Download className="w-3 h-3" /> Export XLSX
                </button>
              )}
            </div>

            {/* Stats Utama */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">💰 Saldo Terkumpul</p>
                <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">Rp {saldoTerkumpul.toLocaleString('id-ID')}</p>
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">{totalPaidCount} × Rp {kasSetting.amount.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">📅 Nominal/Periode</p>
                <p className="text-sm font-black text-amber-800 dark:text-amber-200">Rp {kasSetting.amount.toLocaleString('id-ID')}</p>
                <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">{PERIOD_LABELS[kasSetting.periodType]}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                <p className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold">✅ Sudah Bayar</p>
                <p className="text-sm font-black text-blue-800 dark:text-blue-200">{activePaidCount}/{students.length}</p>
                <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-0.5">Periode aktif</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
                <p className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold">⏳ Belum Bayar</p>
                <p className="text-sm font-black text-rose-800 dark:text-rose-200">{students.length - activePaidCount}</p>
                <p className="text-[9px] text-rose-600 dark:text-rose-400 mt-0.5">Periode aktif</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                style={{ width: `${activePct}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-right">
              {activePct}% siswa sudah bayar periode ini
            </p>
          </div>

          {/* ============ FORM EDIT (Khusus Bendahara) ============ */}
          {isEditing && canManage && (
            <form onSubmit={handleUpdateSetting} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500/40 shadow-md space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">⚙️ Edit Pengaturan Kas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Kas</label>
                  <input type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nominal per Periode (Rp)</label>
                  <input type="number" min="1000" step="1000" value={actAmount || ''}
                    onChange={(e) => setActAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tipe Periode</label>
                  <select value={actPeriodType} onChange={(e) => setActPeriodType(e.target.value as PeriodType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    <option value="WEEKLY">Mingguan (7 hari)</option>
                    <option value="BIWEEKLY">Dua Mingguan (14 hari)</option>
                    <option value="TEN_DAYS">Per 10 Hari</option>
                    <option value="MANUAL">Manual (Bendahara atur sendiri)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tenggat</label>
                  <input type="datetime-local" value={actDeadline} onChange={(e) => setActDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi</label>
                <textarea rows={2} value={actDesc} onChange={(e) => setActDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          )}

          {/* ============ PILIH PERIODE ============ */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                📅 Pilih Periode
              </h3>
              {canManage && (
                <div className="flex gap-2">
                  {kasSetting.periodType === 'MANUAL' ? (
                    <button onClick={() => setIsAddingPeriod(!isAddingPeriod)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Tambah Periode
                    </button>
                  ) : (
                    <button onClick={handleAddAutoPeriod}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Lanjut ke Periode Baru
                    </button>
                  )}
                </div>
              )}
            </div>

            {periods.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">Belum ada periode.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {periods.map(p => {
                  const isActive = p.id === activePeriodId;
                  const periodPaidCount = payments.filter(x => x.periodId === p.id && x.paid).length;
                  return (
                    <button key={p.id} onClick={() => setActivePeriodId(p.id)}
                      className={`min-w-[140px] p-3 rounded-2xl border-2 text-left transition ${
                        isActive
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-amber-300'
                      }`}>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Periode {p.periodNumber}
                      </p>
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                        {p.label}
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold mt-1">
                        {periodPaidCount}/{students.length} bayar
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ============ FORM TAMBAH PERIODE MANUAL ============ */}
          {isAddingPeriod && kasSetting.periodType === 'MANUAL' && (
            <form onSubmit={handleAddManualPeriod} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-500/40 shadow-md space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">➕ Tambah Periode Manual</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Label Periode</label>
                  <input type="text" required value={newPeriodLabel}
                    onChange={(e) => setNewPeriodLabel(e.target.value)}
                    placeholder="Contoh: Periode Konsumsi Gladi"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Mulai</label>
                  <input type="date" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Selesai</label>
                  <input type="date" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tenggat</label>
                  <input type="datetime-local" value={newPeriodDeadline} onChange={(e) => setNewPeriodDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsAddingPeriod(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs disabled:opacity-50">
                  {submitting ? 'Menyimpan...' : 'Tambah Periode'}
                </button>
              </div>
            </form>
          )}

          {/* ============ REMINDER ============ */}
          {canManage && studentsWithoutPaid.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  <strong>{studentsWithoutPaid.length} siswa</strong> belum bayar periode ini. Kirim pengingat dengan bahasa santun?
                </p>
              </div>
              <button onClick={handleSendReminder}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Send className="w-3.5 h-3.5" /> Kirim Pengingat
              </button>
            </div>
          )}

          {/* ============ TABEL SISWA PER PERIODE ============ */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari nama siswa..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-xs font-semibold border-0 focus:outline-none bg-transparent text-slate-800 dark:text-white placeholder:text-slate-400" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {activePeriod ? `Periode ${activePeriod.periodNumber}` : ''}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-3 px-4">Nama</th>
                    <th className="py-3 px-4">Role / Divisi</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Tgl Bayar</th>
                    {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredStudents.map(s => {
                    const p = payments.find(x => x.periodId === activePeriodId && x.studentId === s.uid);
                    return (
                      <tr key={s.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{s.displayName}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                          {s.role}<br /><span className="text-slate-400 dark:text-slate-500">{s.divisionName || '-'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p?.paid ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                              ✅ Sudah Bayar
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">
                              ⏳ Belum
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                          {p?.paidAt ? new Date(p.paidAt).toLocaleDateString('id-ID') : '-'}
                        </td>
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => handleTogglePayment(s)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] ${
                                p?.paid
                                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              }`}>
                              {p?.paid ? 'Batal' : 'Centang Bayar'}
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
        </>
      )}

      {/* ============ KAS ADA TAPI NONAKTIF ============ */}
      {kasSetting && !kasSetting.active && (
        <div className="p-8 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 text-center">
          <PowerOff className="w-14 h-14 mx-auto text-amber-500 mb-3" />
          <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">Fitur Kas Sedang Nonaktif</h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Kas "{kasSetting.title}" telah dinonaktifkan. Data historis tetap tersimpan.
          </p>
          {canManage && (
            <button onClick={handleToggleActive}
              className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md">
              <Power className="w-4 h-4" /> Aktifkan Kembali
            </button>
          )}
        </div>
      )}

      {/* ============ MODAL AKTIVASI KAS ============ */}
      {isActivating && !kasSetting && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleActivate}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Power className="w-5 h-5 text-emerald-500" /> Aktivasi Fitur Kas
              </h3>
              <button type="button" onClick={() => setIsActivating(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2 mb-4">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>Kesepakatan Kelas:</strong> Sebelum mengaktifkan, pastikan nominal dan periode
                pengumpulan sudah disepakati bersama seluruh siswa.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Kas <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={actTitle} onChange={(e) => setActTitle(e.target.value)}
                  placeholder="Contoh: Kas Produksi Teater Kelas IX-C"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nominal per Periode (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input type="number" required min="1000" step="1000" value={actAmount || ''}
                    onChange={(e) => setActAmount(parseInt(e.target.value) || 0)}
                    placeholder="10000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Periode Pengumpulan <span className="text-rose-500">*</span>
                  </label>
                  <select value={actPeriodType} onChange={(e) => setActPeriodType(e.target.value as PeriodType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    <option value="WEEKLY">Mingguan (7 hari)</option>
                    <option value="BIWEEKLY">Dua Mingguan (14 hari)</option>
                    <option value="TEN_DAYS">Per 10 Hari</option>
                    <option value="MANUAL">Manual (atur sendiri nanti)</option>
                  </select>
                </div>
              </div>

              {actPeriodType !== 'MANUAL' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tenggat Periode Pertama <span className="text-rose-500">*</span>
                  </label>
                  <input type="datetime-local" required value={actDeadline} onChange={(e) => setActDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi (Opsional)</label>
                <textarea rows={2} value={actDesc} onChange={(e) => setActDesc(e.target.value)}
                  placeholder="Contoh: Untuk pembelian properti dan kostum"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsActivating(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Power className="w-3.5 h-3.5" />
                {submitting ? 'Mengaktifkan...' : 'Aktifkan Kas'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
