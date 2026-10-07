import React, { useState, useEffect } from 'react';
import {
  Wallet, Plus, CheckCircle, XCircle, Users, Calendar, Clock,
  Bell, Send, TrendingUp, AlertTriangle, X, Save, Search, Download,
  Power, PowerOff, Info, Heart, Settings2, Trash2, BookOpen,
  ArrowDownCircle, ArrowUpCircle, ArrowRight, TrendingDown, DollarSign,
  Edit3,
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

type PeriodType = 'WEEKLY' | 'BIWEEKLY' | 'TEN_DAYS' | 'MANUAL';
type Category = 'DIVISI' | 'PERAN' | 'UMUM';

interface KasSetting {
  id: string; classId: string; title: string; amount: number;
  periodType: PeriodType; deadline: string; description: string;
  active: boolean; createdBy: string; creatorName: string; createdAt: string;
}

interface KasPeriod {
  id: string; kasId: string; classId: string;
  periodNumber: number; label: string;
  startDate: string; endDate: string; deadline: string; createdAt: string;
}

interface KasPayment {
  id: string; kasId: string; periodId: string; classId: string;
  studentId: string; studentName: string;
  paid: boolean; paidAt?: string; verifiedBy?: string;
}

interface CashEntry {
  id: string;
  classId: string;
  type: 'INCOME' | 'EXPENSE';
  category: Category;
  targetName: string;
  itemName: string;
  qty: number;
  unit: string;
  amount: number;
  notes: string;
  date: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
}

const PERIOD_LABELS: Record<PeriodType, string> = {
  WEEKLY: 'Mingguan', BIWEEKLY: 'Dua Mingguan', TEN_DAYS: 'Per 10 Hari', MANUAL: 'Manual',
};
const PERIOD_DAYS: Record<PeriodType, number> = {
  WEEKLY: 7, BIWEEKLY: 14, TEN_DAYS: 10, MANUAL: 0,
};

const DIVISION_LIST = [
  'Pengurus Inti', 'Pemeran', 'Perlengkapan', 'Publikasi & Dokumentasi',
  'Tata Panggung', 'Tata Rias', 'Tata Busana', 'Tata Musik & Suara',
];
const PERAN_LIST = ['Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Sutradara', 'Asisten Sutradara', 'Pemain'];

export const KasModule: React.FC = () => {
  const { user, activeClass, isBendahara, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'periode' | 'buku-kas'>('periode');
  const [kasSetting, setKasSetting] = useState<KasSetting | null>(null);
  const [periods, setPeriods] = useState<KasPeriod[]>([]);
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);

  // Edit period modal
  const [editingPeriod, setEditingPeriod] = useState<KasPeriod | null>(null);
  const [editPeriodLabel, setEditPeriodLabel] = useState('');
  const [editPeriodStart, setEditPeriodStart] = useState('');
  const [editPeriodEnd, setEditPeriodEnd] = useState('');
  const [editPeriodDeadline, setEditPeriodDeadline] = useState('');

  // Cash entry modal
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [editingCash, setEditingCash] = useState<CashEntry | null>(null);
  const [cashType, setCashType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [cashCategory, setCashCategory] = useState<Category>('DIVISI');
  const [cashTarget, setCashTarget] = useState<string>(DIVISION_LIST[0]);
  const [cashItemName, setCashItemName] = useState('');
  const [cashQty, setCashQty] = useState(1);
  const [cashUnit, setCashUnit] = useState('pcs');
  const [cashAmount, setCashAmount] = useState(0);
  const [cashNotes, setCashNotes] = useState('');
  const [cashDate, setCashDate] = useState(new Date().toISOString().slice(0, 10));

  const [actTitle, setActTitle] = useState('Kas Produksi Teater');
  const [actAmount, setActAmount] = useState<number>(0);
  const [actPeriodType, setActPeriodType] = useState<PeriodType>('WEEKLY');
  const [actDeadline, setActDeadline] = useState('');
  const [actDesc, setActDesc] = useState('');

  const [newPeriodLabel, setNewPeriodLabel] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newPeriodDeadline, setNewPeriodDeadline] = useState('');

  const canManage = isBendahara || isGuruPengampu || isAdminRole;
  const isViewOnly = !canManage;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'kasSettings'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) setKasSetting(null);
      else {
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

  useEffect(() => {
    if (!kasSetting) { setPeriods([]); return; }
    const q = query(collection(db, 'kasPeriods'), where('kasId', '==', kasSetting.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as KasPeriod));
      list.sort((a, b) => a.periodNumber - b.periodNumber);
      setPeriods(list);
      if (list.length > 0 && !activePeriodId) setActivePeriodId(list[list.length - 1].id);
    });
    return () => unsub();
  }, [kasSetting]);

  useEffect(() => {
    if (!kasSetting) { setPayments([]); return; }
    const q = query(collection(db, 'kasPayments'), where('kasId', '==', kasSetting.id));
    const unsub = onSnapshot(q, snap => {
      setPayments(snap.docs.map(d => ({ ...d.data(), id: d.id } as KasPayment)));
    });
    return () => unsub();
  }, [kasSetting]);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'cashEntries'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setCashEntries(snap.docs.map(d => ({ ...d.data(), id: d.id } as CashEntry)));
    });
    return () => unsub();
  }, [activeClass]);

  // ==========================================
  // AKTIVASI
  // ==========================================
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!actTitle.trim() || actAmount <= 0) {
      showToast('Lengkapi judul dan nominal per periode.', 'warning'); return;
    }
    if (actPeriodType !== 'MANUAL' && !actDeadline) {
      showToast('Isi tenggat waktu pembayaran.', 'warning'); return;
    }
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'kasSettings'));
      const newKas: KasSetting = {
        id: newRef.id, classId: activeClass.id,
        title: actTitle.trim(), amount: actAmount,
        periodType: actPeriodType,
        deadline: actDeadline ? new Date(actDeadline).toISOString() : '',
        description: actDesc.trim(), active: true,
        createdBy: user.uid, creatorName: user.displayName,
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, newKas);
      await createNextPeriod(newKas, 1);
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Kas', targetId: newRef.id,
        details: `Aktivasi kas: ${actTitle} (Rp ${actAmount.toLocaleString('id-ID')})`,
      });
      showToast('Fitur kas berhasil diaktifkan!', 'success');
      setIsActivating(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSubmitting(false); }
  };

  const createNextPeriod = async (kas: KasSetting, periodNumber: number) => {
    const days = PERIOD_DAYS[kas.periodType] || 7;
    const start = new Date();
    const end = new Date(start.getTime() + days * 86400000);
    const newRef = doc(collection(db, 'kasPeriods'));
    await setDoc(newRef, {
      id: newRef.id, kasId: kas.id, classId: kas.classId,
      periodNumber, label: `Periode ${periodNumber}`,
      startDate: start.toISOString(), endDate: end.toISOString(),
      deadline: kas.deadline || end.toISOString(),
      createdAt: new Date().toISOString(),
    });
  };

  const handleAddAutoPeriod = async () => {
    if (!kasSetting) return;
    const nextNum = periods.length > 0 ? Math.max(...periods.map(p => p.periodNumber)) + 1 : 1;
    try {
      await createNextPeriod(kasSetting, nextNum);
      showToast(`Periode ${nextNum} dibuat.`, 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleAddManualPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasSetting || !newPeriodLabel.trim()) {
      showToast('Isi label periode.', 'warning'); return;
    }
    setSubmitting(true);
    try {
      const nextNum = periods.length > 0 ? Math.max(...periods.map(p => p.periodNumber)) + 1 : 1;
      const newRef = doc(collection(db, 'kasPeriods'));
      await setDoc(newRef, {
        id: newRef.id, kasId: kasSetting.id, classId: kasSetting.classId,
        periodNumber: nextNum, label: newPeriodLabel.trim(),
        startDate: newPeriodStart || new Date().toISOString(),
        endDate: newPeriodEnd || new Date().toISOString(),
        deadline: newPeriodDeadline || newPeriodEnd || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      showToast('Periode ditambahkan.', 'success');
      setIsAddingPeriod(false);
      setNewPeriodLabel(''); setNewPeriodStart(''); setNewPeriodEnd(''); setNewPeriodDeadline('');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // ==========================================
  // EDIT PERIODE (FITUR BARU)
  // ==========================================
  const openEditPeriod = (p: KasPeriod) => {
    setEditingPeriod(p);
    setEditPeriodLabel(p.label);
    setEditPeriodStart(p.startDate ? p.startDate.slice(0, 10) : '');
    setEditPeriodEnd(p.endDate ? p.endDate.slice(0, 10) : '');
    setEditPeriodDeadline(p.deadline ? p.deadline.slice(0, 16) : '');
  };

  const handleSavePeriodEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod || !user) return;
    if (!editPeriodLabel.trim()) {
      showToast('Label periode wajib diisi.', 'warning'); return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'kasPeriods', editingPeriod.id), {
        label: editPeriodLabel.trim(),
        startDate: editPeriodStart ? new Date(editPeriodStart).toISOString() : editingPeriod.startDate,
        endDate: editPeriodEnd ? new Date(editPeriodEnd).toISOString() : editingPeriod.endDate,
        deadline: editPeriodDeadline ? new Date(editPeriodDeadline).toISOString() : editingPeriod.deadline,
        updatedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'KasPeriod', targetId: editingPeriod.id,
        details: `Edit periode ${editingPeriod.periodNumber}: ${editPeriodLabel}`,
      });
      showToast('Periode berhasil diperbarui!', 'success');
      setEditingPeriod(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSubmitting(false); }
  };

  const handleDeletePeriod = async (p: KasPeriod) => {
    if (!user) return;
    // Cek apakah ada pembayaran di periode ini
    const paymentsInPeriod = payments.filter(x => x.periodId === p.id);
    const paidCount = paymentsInPeriod.filter(x => x.paid).length;

    if (paidCount > 0) {
      showToast(
        `Periode ini memiliki ${paidCount} pembayaran. Hapus/batalkan pembayaran dulu jika ingin hapus periode.`,
        'warning'
      );
      return;
    }

    if (!confirm(
      `Hapus periode "${p.label}" (Periode ${p.periodNumber})?\n\n` +
      `Tindakan ini tidak bisa dibatalkan. Data centang kas di periode ini akan hilang.`
    )) return;

    try {
      // Hapus semua payments di periode ini
      const batch = writeBatch(db);
      paymentsInPeriod.forEach(pay => batch.delete(doc(db, 'kasPayments', pay.id)));
      // Hapus periode
      batch.delete(doc(db, 'kasPeriods', p.id));
      await batch.commit();

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'KasPeriod', targetId: p.id,
        details: `Hapus periode ${p.periodNumber}: ${p.label}`,
      });

      showToast('Periode dihapus.', 'info');
      if (activePeriodId === p.id) {
        setActivePeriodId(periods.length > 0 ? periods[0].id : null);
      }
    } catch (err: any) {
      showToast('Gagal hapus periode: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleUpdateSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kasSetting || !user) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'kasSettings', kasSetting.id), {
        title: actTitle.trim(), amount: actAmount,
        periodType: actPeriodType,
        deadline: actDeadline ? new Date(actDeadline).toISOString() : kasSetting.deadline,
        description: actDesc.trim(),
        updatedAt: new Date().toISOString(),
      });
      showToast('Pengaturan kas diperbarui.', 'success');
      setIsEditing(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleToggleActive = async () => {
    if (!kasSetting || !user) return;
    const willBeActive = !kasSetting.active;
    if (!confirm(`${willBeActive ? 'Aktifkan' : 'Nonaktifkan'} fitur kas?`)) return;
    try {
      await updateDoc(doc(db, 'kasSettings', kasSetting.id), {
        active: willBeActive, updatedAt: new Date().toISOString(),
      });
      showToast(`Fitur kas ${willBeActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleResetKas = async () => {
    if (!kasSetting || !user) return;
    if (!confirm('HAPUS semua pengaturan kas, periode, dan riwayat pembayaran? Tidak bisa dibatalkan.')) return;
    try {
      const pSnap = await getDocs(query(collection(db, 'kasPeriods'), where('kasId', '==', kasSetting.id)));
      for (const d of pSnap.docs) await deleteDoc(d.ref);
      const paySnap = await getDocs(query(collection(db, 'kasPayments'), where('kasId', '==', kasSetting.id)));
      for (const d of paySnap.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, 'kasSettings', kasSetting.id));
      showToast('Kas direset.', 'info');
      setKasSetting(null); setPeriods([]); setPayments([]);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleTogglePayment = async (student: UserProfile) => {
    if (!canManage || !user || !kasSetting || !activePeriodId) return;
    const key = `${kasSetting.id}_${activePeriodId}_${student.uid}`;
    const existing = payments.find(p => p.id === key);
    const newPaid = !existing?.paid;
    try {
      await setDoc(doc(db, 'kasPayments', key), {
        id: key, kasId: kasSetting.id, periodId: activePeriodId,
        classId: kasSetting.classId, studentId: student.uid,
        studentName: student.displayName, paid: newPaid,
        paidAt: newPaid ? new Date().toISOString() : null,
        verifiedBy: newPaid ? user.displayName : null,
      });
      if (newPaid) {
        try {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            id: notifRef.id, userId: student.uid, classId: kasSetting.classId,
            title: '✅ Pembayaran Kas Terkonfirmasi',
            message: `Terima kasih! Pembayaran kas "${kasSetting.title}" Anda telah diverifikasi oleh ${user.displayName}.`,
            category: 'Keuangan', read: false, link: 'kas',
            createdAt: new Date().toISOString(),
          });
        } catch { /* non-fatal */ }
      }
      showToast(newPaid ? `✅ ${student.displayName} sudah bayar.` : 'Pembayaran dibatalkan.', 'info');
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
  };

  const handleSendReminder = async () => {
    if (!kasSetting || !activePeriodId || !user || !activeClass) return;
    const activePeriod = periods.find(p => p.id === activePeriodId);
    if (!activePeriod) return;
    if (studentsWithoutPaid.length === 0) {
      showToast('Semua siswa sudah bayar.', 'info'); return;
    }
    if (!confirm(`Kirim reminder SANTUN ke ${studentsWithoutPaid.length} siswa?`)) return;
    try {
      const batch = writeBatch(db);
      studentsWithoutPaid.forEach(s => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id, userId: s.uid, classId: activeClass.id,
          title: '💌 Pengingat Kas',
          message: `Halo ${s.displayName.split(' ')[0]}, kami ingin mengingatkan dengan hormat bahwa kas "${kasSetting.title}" untuk ${activePeriod.label} sebesar Rp ${kasSetting.amount.toLocaleString('id-ID')} belum tercatat. Silakan koordinasikan dengan Bendahara ya. Terima kasih. 🙏`,
          category: 'Reminder', read: false, link: 'kas',
          createdAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      showToast(`Reminder terkirim ke ${studentsWithoutPaid.length} siswa.`, 'success');
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
  };

  const openCashModal = (type: 'INCOME' | 'EXPENSE', editEntry?: CashEntry) => {
    if (editEntry) {
      setEditingCash(editEntry);
      setCashType(editEntry.type);
      setCashCategory(editEntry.category);
      setCashTarget(editEntry.targetName);
      setCashItemName(editEntry.itemName);
      setCashQty(editEntry.qty);
      setCashUnit(editEntry.unit);
      setCashAmount(editEntry.amount);
      setCashNotes(editEntry.notes);
      setCashDate(editEntry.date.slice(0, 10));
    } else {
      setEditingCash(null);
      setCashType(type);
      setCashCategory('DIVISI');
      setCashTarget(DIVISION_LIST[0]);
      setCashItemName('');
      setCashQty(1);
      setCashUnit('pcs');
      setCashAmount(0);
      setCashNotes('');
      setCashDate(new Date().toISOString().slice(0, 10));
    }
    setIsCashModalOpen(true);
  };

  const handleSaveCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!cashItemName.trim() || cashAmount <= 0) {
      showToast('Isi nama item dan nominal.', 'warning'); return;
    }
    setSubmitting(true);
    try {
      const id = editingCash?.id || doc(collection(db, 'cashEntries')).id;
      const data: CashEntry = {
        id, classId: activeClass.id,
        type: cashType, category: cashCategory,
        targetName: cashCategory === 'UMUM' ? 'Umum' : cashTarget,
        itemName: cashItemName.trim(),
        qty: cashQty, unit: cashUnit.trim(),
        amount: cashAmount,
        notes: cashNotes.trim(),
        date: new Date(cashDate).toISOString(),
        createdBy: user.uid, creatorName: user.displayName,
        createdAt: editingCash?.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'cashEntries', id), data, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editingCash ? 'UPDATE' : 'CREATE',
        targetType: 'CashEntry', targetId: id,
        details: `${cashType === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}: ${cashItemName} (Rp ${cashAmount.toLocaleString('id-ID')})`,
      });
      showToast(`${cashType === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} disimpan.`, 'success');
      setIsCashModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteCash = async (entry: CashEntry) => {
    if (!confirm(`Hapus ${entry.type === 'INCOME' ? 'pemasukan' : 'pengeluaran'} "${entry.itemName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'cashEntries', entry.id));
      showToast('Entri dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const students = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
  );
  const activePeriod = periods.find(p => p.id === activePeriodId);
  const activePeriodPayments = payments.filter(p => p.periodId === activePeriodId && p.paid);
  const studentsWithoutPaid = students.filter(s =>
    !payments.find(p => p.periodId === activePeriodId && p.studentId === s.uid && p.paid)
  );
  const totalPaidCount = payments.filter(p => p.paid).length;
  const saldoKasSiswa = kasSetting ? totalPaidCount * kasSetting.amount : 0;
  const totalIncome = cashEntries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.qty * e.amount, 0);
  const totalExpense = cashEntries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.qty * e.amount, 0);
  const saldoAkhir = totalIncome - totalExpense + saldoKasSiswa;
  const activePct = students.length > 0 ? Math.round((activePeriodPayments.length / students.length) * 100) : 0;
  const activeDeadline = activePeriod ? new Date(activePeriod.deadline) : null;
  const isOverdue = activeDeadline ? activeDeadline.getTime() < now.getTime() : false;

  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.displayName.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
  });

  const filteredCashEntries = cashEntries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExportBukuKas = () => {
    const sheet1 = {
      name: 'Pemasukan',
      headers: ['Tanggal', 'Kategori', 'Target', 'Item', 'Qty', 'Satuan', 'Nominal', 'Total', 'Catatan', 'Dicatat Oleh'],
      rows: cashEntries.filter(e => e.type === 'INCOME').map(e => [
        new Date(e.date).toLocaleDateString('id-ID'),
        e.category, e.targetName, e.itemName, e.qty, e.unit,
        e.amount, e.qty * e.amount, e.notes || '-', e.creatorName,
      ]),
    };
    const sheet2 = {
      name: 'Pengeluaran',
      headers: ['Tanggal', 'Kategori', 'Target', 'Item', 'Qty', 'Satuan', 'Nominal', 'Total', 'Catatan', 'Dicatat Oleh'],
      rows: cashEntries.filter(e => e.type === 'EXPENSE').map(e => [
        new Date(e.date).toLocaleDateString('id-ID'),
        e.category, e.targetName, e.itemName, e.qty, e.unit,
        e.amount, e.qty * e.amount, e.notes || '-', e.creatorName,
      ]),
    };
    const sheet3 = {
      name: 'Rekap Periode',
      headers: ['Periode', 'Label', 'Tgl Mulai', 'Tgl Selesai', 'Deadline', 'Sudah Bayar', 'Belum Bayar', 'Total Terkumpul'],
      rows: periods.map(p => {
        const paid = payments.filter(x => x.periodId === p.id && x.paid).length;
        return [
          p.periodNumber, p.label,
          new Date(p.startDate).toLocaleDateString('id-ID'),
          new Date(p.endDate).toLocaleDateString('id-ID'),
          new Date(p.deadline).toLocaleDateString('id-ID'),
          paid, students.length - paid,
          paid * (kasSetting?.amount || 0),
        ];
      }),
    };
    const sheet4 = {
      name: 'Ringkasan',
      headers: ['Metrik', 'Nilai'],
      rows: [
        ['Judul Kas', kasSetting?.title || '-'],
        ['Nominal per Periode', kasSetting?.amount || 0],
        ['Total Periode', periods.length],
        ['Total dari Kas Siswa', saldoKasSiswa],
        ['Total Pemasukan Manual', totalIncome],
        ['Total Pengeluaran', totalExpense],
        ['SALDO AKHIR', saldoAkhir],
      ],
    };
    exportMultiSheetXLSX(
      `BukuKas_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.xls`,
      [sheet4, sheet1, sheet2, sheet3]
    );
    showToast('Buku kas diexport ke Excel!', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-800 text-white shadow-xl border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Wallet className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Kas & Buku Kas
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Manajemen Keuangan {activeClass?.name || ''}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {isViewOnly ? 'Mode lihat — hanya Bendahara yang dapat mengubah' : 'Kelola kas, pemasukan, pengeluaran, dan saldo'}
              </p>
            </div>
          </div>

          {canManage && kasSetting && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleToggleActive}
                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ${
                  kasSetting.active ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}>
                {kasSetting.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                {kasSetting.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20">
                <Settings2 className="w-3.5 h-3.5" /> Pengaturan
              </button>
              <button onClick={handleResetKas}
                className="px-3 py-2 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {kasSetting && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md">
            <DollarSign className="w-5 h-5 mb-1 opacity-90" />
            <p className="text-[10px] font-bold uppercase opacity-90">Saldo Akhir</p>
            <p className="text-lg font-black">Rp {saldoAkhir.toLocaleString('id-ID')}</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
            <ArrowDownCircle className="w-5 h-5 text-emerald-600 mb-1" />
            <p className="text-[10px] font-semibold text-emerald-700">Pemasukan</p>
            <p className="text-base font-black text-emerald-800">Rp {totalIncome.toLocaleString('id-ID')}</p>
            <p className="text-[9px] text-emerald-600 mt-0.5">Kas siswa: Rp {saldoKasSiswa.toLocaleString('id-ID')}</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
            <ArrowUpCircle className="w-5 h-5 text-rose-600 mb-1" />
            <p className="text-[10px] font-semibold text-rose-700">Pengeluaran</p>
            <p className="text-base font-black text-rose-800">Rp {totalExpense.toLocaleString('id-ID')}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <TrendingUp className="w-5 h-5 text-slate-600 mb-1" />
            <p className="text-[10px] font-semibold text-slate-600">Capaian Kas</p>
            <p className="text-base font-black text-slate-800">{activePct}%</p>
            <p className="text-[9px] text-slate-500 mt-0.5">{activePeriodPayments.length}/{students.length} periode aktif</p>
          </div>
        </div>
      )}

      {kasSetting && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setActiveTab('periode')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'periode' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            <Users className="w-3.5 h-3.5" /> Periode & Centang Kas
          </button>
          <button onClick={() => setActiveTab('buku-kas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'buku-kas' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            <BookOpen className="w-3.5 h-3.5" /> Buku Kas (Pemasukan/Pengeluaran)
          </button>
          <button onClick={handleExportBukuKas}
            className="ml-auto px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
        </div>
      )}

      {activeTab === 'periode' && kasSetting && kasSetting.active && (
        <>
          {isOverdue && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/40 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-900 dark:text-rose-200">
                <p className="font-extrabold">⏰ Sudah Melewati Tenggat</p>
                <p className="mt-0.5">Periode {activePeriod?.periodNumber} sudah melewati tenggat. Bendahara akan mengirim pengingat santun.</p>
              </div>
            </div>
          )}

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900">{kasSetting.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{kasSetting.description || 'Kas produksi teater'}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Diaktifkan <strong>{kasSetting.creatorName}</strong> • Tipe: {PERIOD_LABELS[kasSetting.periodType]}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] text-emerald-700 font-semibold">💰 Saldo Kas Siswa</p>
                <p className="text-sm font-black text-emerald-800">Rp {saldoKasSiswa.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-[10px] text-amber-700 font-semibold">📅 Nominal/Periode</p>
                <p className="text-sm font-black text-amber-800">Rp {kasSetting.amount.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-[10px] text-blue-700 font-semibold">✅ Sudah Bayar</p>
                <p className="text-sm font-black text-blue-800">{activePeriodPayments.length}/{students.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <p className="text-[10px] text-rose-700 font-semibold">⏳ Belum Bayar</p>
                <p className="text-sm font-black text-rose-800">{students.length - activePeriodPayments.length}</p>
              </div>
            </div>
            <div className="mt-3 w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${activePct}%` }} />
            </div>
          </div>

          {isEditing && canManage && (
            <form onSubmit={handleUpdateSetting} className="p-5 rounded-3xl bg-white border-2 border-amber-300 shadow-md space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">⚙️ Edit Pengaturan Kas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Kas</label>
                  <input type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nominal/Periode (Rp)</label>
                  <input type="number" min="1000" step="1000" value={actAmount || ''}
                    onChange={(e) => setActAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Periode</label>
                  <select value={actPeriodType} onChange={(e) => setActPeriodType(e.target.value as PeriodType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white">
                    <option value="WEEKLY">Mingguan</option>
                    <option value="BIWEEKLY">Dua Mingguan</option>
                    <option value="TEN_DAYS">Per 10 Hari</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tenggat</label>
                  <input type="datetime-local" value={actDeadline} onChange={(e) => setActDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi</label>
                <textarea rows={2} value={actDesc} onChange={(e) => setActDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50">
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          )}

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-xs font-bold text-slate-600 uppercase">📅 Pilih Periode</h3>
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
                      <Plus className="w-3 h-3" /> Lanjut Periode
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
                  const pc = payments.filter(x => x.periodId === p.id && x.paid).length;
                  return (
                    <div key={p.id} className="relative shrink-0">
                      <button onClick={() => setActivePeriodId(p.id)}
                        className={`min-w-[160px] p-3 rounded-2xl border-2 text-left transition ${
                          isActive ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'
                        }`}>
                        <p className="text-[10px] font-bold text-slate-500">Periode {p.periodNumber}</p>
                        <p className="text-xs font-black text-slate-900 truncate mt-0.5">{p.label}</p>
                        <p className="text-[10px] text-emerald-700 font-bold mt-1">{pc}/{students.length} bayar</p>
                      </button>
                      {canManage && (
                        <div className="absolute top-1 right-1 flex gap-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditPeriod(p); }}
                            className="p-1 rounded-md bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                            title="Edit periode">
                            <Edit3 className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePeriod(p); }}
                            className="p-1 rounded-md bg-rose-500 text-white hover:bg-rose-600 shadow-sm"
                            title="Hapus periode">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isAddingPeriod && kasSetting.periodType === 'MANUAL' && (
            <form onSubmit={handleAddManualPeriod} className="p-5 rounded-3xl bg-white border-2 border-emerald-300 shadow-md space-y-3">
              <h3 className="text-sm font-extrabold">➕ Tambah Periode Manual</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Label</label>
                  <input type="text" required value={newPeriodLabel}
                    onChange={(e) => setNewPeriodLabel(e.target.value)}
                    placeholder="Contoh: Kas Konsumsi Gladi"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mulai</label>
                  <input type="date" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selesai</label>
                  <input type="date" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsAddingPeriod(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs disabled:opacity-50">
                  {submitting ? '...' : 'Tambah'}
                </button>
              </div>
            </form>
          )}

          {canManage && studentsWithoutPaid.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-amber-600" />
                <p className="text-xs text-amber-900">
                  <strong>{studentsWithoutPaid.length} siswa</strong> belum bayar. Kirim pengingat santun?
                </p>
              </div>
              <button onClick={handleSendReminder}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Kirim Pengingat
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari nama siswa..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-xs font-semibold border-0 focus:outline-none" />
              {activePeriod && <span className="text-[10px] text-slate-500">{activePeriod.label}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">Nama</th>
                    <th className="py-3 px-4">Role / Divisi</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Tgl Bayar</th>
                    {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(s => {
                    const p = payments.find(x => x.periodId === activePeriodId && x.studentId === s.uid);
                    return (
                      <tr key={s.uid} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-800">{s.displayName}</td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {s.role}<br /><span className="text-slate-400">{s.divisionName || '-'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p?.paid ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✅ Sudah
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
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => handleTogglePayment(s)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] ${
                                p?.paid ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              }`}>
                              {p?.paid ? 'Batal' : 'Centang'}
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

      {activeTab === 'buku-kas' && kasSetting && (
        <>
          {canManage && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => openCashModal('INCOME')}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <ArrowDownCircle className="w-4 h-4" /> Catat Pemasukan
              </button>
              <button onClick={() => openCashModal('EXPENSE')}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <ArrowUpCircle className="w-4 h-4" /> Catat Pengeluaran
              </button>
            </div>
          )}

          {filteredCashEntries.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Entri Buku Kas</h3>
              <p className="text-xs text-slate-500 mt-1">
                {canManage ? 'Klik tombol di atas untuk mencatat pemasukan atau pengeluaran.' : 'Tunggu Bendahara mencatat transaksi.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">Jenis</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4 text-center">Qty</th>
                      <th className="py-3 px-4 text-right">Nominal</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4">Catatan</th>
                      {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCashEntries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[10px]">
                          {new Date(e.date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 w-fit ${
                            e.type === 'INCOME'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {e.type === 'INCOME' ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                            {e.type === 'INCOME' ? 'Masuk' : 'Keluar'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {e.category} • {e.targetName}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{e.itemName}</td>
                        <td className="py-3 px-4 text-center text-slate-600 text-[11px]">{e.qty} {e.unit}</td>
                        <td className="py-3 px-4 text-right font-mono text-[11px]">Rp {e.amount.toLocaleString('id-ID')}</td>
                        <td className={`py-3 px-4 text-right font-mono font-bold text-xs ${
                          e.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {e.type === 'INCOME' ? '+' : '-'}Rp {(e.qty * e.amount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[10px] max-w-[150px] truncate">{e.notes || '-'}</td>
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => openCashModal(e.type, e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteCash(e)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!kasSetting && (
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-center">
          <Wallet className="w-16 h-16 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-extrabold text-slate-800">
            {canManage ? 'Fitur Kas Belum Diaktifkan' : 'Kas Belum Diaktifkan'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
            {canManage
              ? 'Kas adalah kesepakatan kelas. Sebelum diaktifkan, pastikan nominal dan periode pengumpulan sudah disepakati bersama.'
              : 'Bendahara belum mengaktifkan fitur kas untuk kelas ini.'}
          </p>
          {canManage && (
            <button onClick={() => setIsActivating(true)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md">
              <Power className="w-4 h-4" /> Aktifkan Fitur Kas
            </button>
          )}
        </div>
      )}

      {kasSetting && !kasSetting.active && (
        <div className="p-8 rounded-3xl bg-amber-50 border-2 border-amber-300 text-center">
          <PowerOff className="w-14 h-14 mx-auto text-amber-500 mb-3" />
          <h3 className="text-base font-extrabold text-amber-900">Fitur Kas Nonaktif</h3>
          <p className="text-xs text-amber-700 mt-1">Data historis tetap tersimpan.</p>
          {canManage && (
            <button onClick={handleToggleActive}
              className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-2">
              <Power className="w-4 h-4" /> Aktifkan Kembali
            </button>
          )}
        </div>
      )}

      {isActivating && !kasSetting && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleActivate} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Power className="w-5 h-5 text-emerald-500" /> Aktivasi Fitur Kas
              </h3>
              <button type="button" onClick={() => setIsActivating(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 mb-4">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900">
                <strong>Kesepakatan Kelas:</strong> Pastikan nominal dan periode sudah disepakati.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Kas <span className="text-rose-500">*</span></label>
                <input type="text" required value={actTitle} onChange={(e) => setActTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nominal (Rp) <span className="text-rose-500">*</span></label>
                  <input type="number" required min="1000" step="1000" value={actAmount || ''}
                    onChange={(e) => setActAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Periode <span className="text-rose-500">*</span></label>
                  <select value={actPeriodType} onChange={(e) => setActPeriodType(e.target.value as PeriodType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white">
                    <option value="WEEKLY">Mingguan</option>
                    <option value="BIWEEKLY">Dua Mingguan</option>
                    <option value="TEN_DAYS">Per 10 Hari</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
              </div>
              {actPeriodType !== 'MANUAL' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tenggat Periode Pertama <span className="text-rose-500">*</span></label>
                  <input type="datetime-local" required value={actDeadline}
                    onChange={(e) => setActDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi</label>
                <textarea rows={2} value={actDesc} onChange={(e) => setActDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t">
              <button type="button" onClick={() => setIsActivating(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                <Power className="w-3.5 h-3.5" /> {submitting ? 'Mengaktifkan...' : 'Aktifkan Kas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDIT PERIODE — FITUR BARU */}
      {editingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSavePeriodEdit}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 my-auto max-h-[92vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-500" /> Edit Periode {editingPeriod.periodNumber}
              </h3>
              <button type="button" onClick={() => setEditingPeriod(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900">
                Edit label, tanggal mulai/selesai, dan tenggat waktu periode ini. Perubahan langsung terlihat oleh siswa.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Label Periode <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={editPeriodLabel}
                onChange={(e) => setEditPeriodLabel(e.target.value)}
                placeholder="Contoh: Kas Konsumsi Gladi Resik"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai</label>
                <input type="date" value={editPeriodStart}
                  onChange={(e) => setEditPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai</label>
                <input type="date" value={editPeriodEnd}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tenggat Pembayaran</label>
              <input type="datetime-local" value={editPeriodDeadline}
                onChange={(e) => setEditPeriodDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setEditingPeriod(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isCashModalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveCash} className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 my-auto max-h-[92vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                {cashType === 'INCOME'
                  ? <><ArrowDownCircle className="w-5 h-5 text-emerald-500" /> Catat Pemasukan</>
                  : <><ArrowUpCircle className="w-5 h-5 text-rose-500" /> Catat Pengeluaran</>
                }
              </h3>
              <button type="button" onClick={() => setIsCashModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
              <div className="grid grid-cols-3 gap-2">
                {(['DIVISI', 'PERAN', 'UMUM'] as Category[]).map(c => (
                  <button key={c} type="button" onClick={() => {
                    setCashCategory(c);
                    if (c === 'DIVISI') setCashTarget(DIVISION_LIST[0]);
                    else if (c === 'PERAN') setCashTarget(PERAN_LIST[0]);
                    else setCashTarget('Umum');
                  }}
                    className={`p-2.5 rounded-xl border-2 text-xs font-bold ${
                      cashCategory === c ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {cashCategory === 'DIVISI' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Divisi</label>
                <select value={cashTarget} onChange={(e) => setCashTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white">
                  {DIVISION_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            {cashCategory === 'PERAN' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Peran</label>
                <select value={cashTarget} onChange={(e) => setCashTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white">
                  {PERAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal</label>
              <input type="date" required value={cashDate} onChange={(e) => setCashDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Item <span className="text-rose-500">*</span></label>
              <input type="text" required value={cashItemName} onChange={(e) => setCashItemName(e.target.value)}
                placeholder="Contoh: Kertas Karton A3"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Qty</label>
                <input type="number" required min="1" value={cashQty}
                  onChange={(e) => setCashQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Satuan</label>
                <input type="text" value={cashUnit} onChange={(e) => setCashUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nominal</label>
                <input type="number" required min="0" step="500" value={cashAmount || ''}
                  onChange={(e) => setCashAmount(parseInt(e.target.value) || 0)}
                  placeholder="15000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${
              cashType === 'INCOME' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}>
              <p className={`text-[11px] font-bold ${
                cashType === 'INCOME' ? 'text-emerald-900' : 'text-rose-900'
              }`}>
                Total: Rp {(cashQty * cashAmount).toLocaleString('id-ID')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
              <input type="text" value={cashNotes} onChange={(e) => setCashNotes(e.target.value)}
                placeholder="Contoh: beli di Toko ABC"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setIsCashModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
              <button type="submit" disabled={submitting}
                className={`px-5 py-2 rounded-xl font-bold text-xs text-white disabled:opacity-50 flex items-center gap-1.5 ${
                  cashType === 'INCOME' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                }`}>
                <Save className="w-3.5 h-3.5" /> {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};