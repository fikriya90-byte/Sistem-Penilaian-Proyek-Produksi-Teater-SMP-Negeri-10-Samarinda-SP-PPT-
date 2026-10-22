import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Package, Plus, X, Save, CheckCircle, XCircle,
  AlertTriangle, Search, Users, Filter, Mic, Speaker, Box,
  Music, Palette, Scissors, RefreshCw, Trash2, Edit3,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { recordAuditLog, notifyTeachers } from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc,
  deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

interface Equipment {
  id: string;
  classId: string;
  name: string;
  category: string;
  quantity: number;
  condition: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';
  notes: string;
  isCustom?: boolean; // ✅ NEW: tandai alat custom (bukan default)
}

interface Booking {
  id: string;
  classId: string;
  equipmentId: string;
  equipmentName: string;
  bookedBy: string;
  bookerName: string;
  bookerRole: string;
  bookerDivision: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

// ✅ NEW: Tambah kategori "Alat Musik"
const EQUIPMENT_CATEGORIES = [
  'Sound System', 'Alat Musik', 'Properti', 'Kostum', 'Alat Rias', 'Alat Panggung', 'Lainnya',
];

// ✅ NEW: Babun, Gambus, Gong + alat musik lain
const DEFAULT_EQUIPMENT: Omit<Equipment, 'id' | 'classId'>[] = [
  // ---- Sound System ----
  { name: 'Speaker Portable', category: 'Sound System', quantity: 2, condition: 'BAIK', notes: '' },
  { name: 'Microphone Wireless', category: 'Sound System', quantity: 4, condition: 'BAIK', notes: '' },
  { name: 'Mic Clip-on', category: 'Sound System', quantity: 4, condition: 'BAIK', notes: '' },
  { name: 'Mixer Audio', category: 'Sound System', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kabel XLR 10m', category: 'Sound System', quantity: 8, condition: 'BAIK', notes: '' },
  { name: 'Proyektor', category: 'Sound System', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Laptop Operator', category: 'Sound System', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Headset Monitoring', category: 'Sound System', quantity: 2, condition: 'BAIK', notes: '' },

  // ---- Alat Musik (BARU) ----
  { name: 'Babun', category: 'Alat Musik', quantity: 2, condition: 'BAIK', notes: 'Alat musik tradisional Kalimantan (gendang)' },
  { name: 'Gambus', category: 'Alat Musik', quantity: 2, condition: 'BAIK', notes: 'Alat musik petik tradisional Kalimantan' },
  { name: 'Gong', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Alat musik pukul tradisional' },
  { name: 'Kempul', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Gong kecil (opsional)' },
  { name: 'Angklung', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Alat musik bambu (opsional)' },
  { name: 'Sape', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Alat musik petik Dayak (opsional)' },

  // ---- Properti ----
  { name: 'Keris Pusaka', category: 'Properti', quantity: 2, condition: 'BAIK', notes: 'Adegan Ratu' },
  { name: 'Mahkota Ratu', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Singgasana', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Meja Tamu Kerajaan', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Payung Kerajaan', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },

  // ---- Kostum ----
  { name: 'Kostum Ratu Putih', category: 'Kostum', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kostum Panglima', category: 'Kostum', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kostum Utusan', category: 'Kostum', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kostum Dayang', category: 'Kostum', quantity: 3, condition: 'BAIK', notes: '' },

  // ---- Alat Rias ----
  { name: 'Kotak Rias Lengkap', category: 'Alat Rias', quantity: 3, condition: 'BAIK', notes: '' },
  { name: 'Face Chart Set', category: 'Alat Rias', quantity: 1, condition: 'BAIK', notes: '' },

  // ---- Alat Panggung ----
  { name: 'Lampu Sorot', category: 'Alat Panggung', quantity: 4, condition: 'BAIK', notes: '' },
  { name: 'Lampu LED Par', category: 'Alat Panggung', quantity: 6, condition: 'BAIK', notes: '' },
  { name: 'Backdrop Kayu', category: 'Alat Panggung', quantity: 1, condition: 'BAIK', notes: '' },
];

// ✅ NEW: Siapa yang boleh tambah/edit/hapus alat
const CAN_MANAGE_EQUIPMENT_ROLES = [
  'Koordinator Perlengkapan', 'Guru Pengampu', 'Guru Pembina',
  'Admin', 'Super Admin', 'Pimpinan Produksi',
];

const CAN_APPROVE_ROLES = ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin', 'Pimpinan Produksi'];

export const BookingModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'alat' | 'saya' | 'semua' | 'pending'>('alat');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // ✅ NEW: State untuk tambah/edit alat custom
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [eqName, setEqName] = useState('');
  const [eqCategory, setEqCategory] = useState<string>('Lainnya');
  const [eqQuantity, setEqQuantity] = useState(1);
  const [eqCondition, setEqCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'>('BAIK');
  const [eqNotes, setEqNotes] = useState('');

  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookStart, setBookStart] = useState('14:00');
  const [bookEnd, setBookEnd] = useState('16:00');
  const [bookPurpose, setBookPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canApprove = user && CAN_APPROVE_ROLES.includes(user.role);
  const canManageEquipment = user && CAN_MANAGE_EQUIPMENT_ROLES.includes(user.role);

  useEffect(() => {
    if (!activeClass) return;

    const qEq = query(collection(db, 'equipment'), where('classId', '==', activeClass.id));
    const unsubEq = onSnapshot(qEq, async snap => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Equipment));

      if (items.length === 0 && !isSeeding) {
        setIsSeeding(true);
        try {
          const batch = writeBatch(db);
          DEFAULT_EQUIPMENT.forEach(eq => {
            const newRef = doc(collection(db, 'equipment'));
            batch.set(newRef, {
              id: newRef.id,
              classId: activeClass.id,
              isCustom: false,
              ...eq,
            });
          });
          await batch.commit();
        } catch (err) {
          console.warn('Seed equipment gagal:', err);
        } finally {
          setIsSeeding(false);
        }
      } else {
        setEquipment(items);
      }
    });

    const qBk = query(collection(db, 'bookings'), where('classId', '==', activeClass.id));
    const unsubBk = onSnapshot(qBk, snap => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(items);
    });

    return () => { unsubEq(); unsubBk(); };
  }, [activeClass, isSeeding]);

  // ✅ NEW: Handler tambah/edit alat
  const openAddEquipment = () => {
    setEditingEquipment(null);
    setEqName(''); setEqCategory('Lainnya'); setEqQuantity(1);
    setEqCondition('BAIK'); setEqNotes('');
    setIsEquipmentModalOpen(true);
  };

  const openEditEquipment = (eq: Equipment) => {
    setEditingEquipment(eq);
    setEqName(eq.name); setEqCategory(eq.category); setEqQuantity(eq.quantity);
    setEqCondition(eq.condition); setEqNotes(eq.notes);
    setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!eqName.trim()) { showToast('Nama alat wajib diisi.', 'warning'); return; }
    if (eqQuantity < 1) { showToast('Jumlah minimal 1.', 'warning'); return; }

    setSubmitting(true);
    try {
      if (editingEquipment) {
        await updateDoc(doc(db, 'equipment', editingEquipment.id), {
          name: eqName.trim(),
          category: eqCategory,
          quantity: eqQuantity,
          condition: eqCondition,
          notes: eqNotes.trim(),
        });
        await recordAuditLog({
          userId: user.uid, userName: user.displayName, role: user.role,
          action: 'UPDATE', targetType: 'Equipment', targetId: editingEquipment.id,
          details: `Edit alat: ${eqName}`,
        });
        showToast('Alat berhasil diperbarui.', 'success');
      } else {
        const newRef = doc(collection(db, 'equipment'));
        await setDoc(newRef, {
          id: newRef.id,
          classId: activeClass.id,
          name: eqName.trim(),
          category: eqCategory,
          quantity: eqQuantity,
          condition: eqCondition,
          notes: eqNotes.trim(),
          isCustom: true,
        });
        await recordAuditLog({
          userId: user.uid, userName: user.displayName, role: user.role,
          action: 'CREATE', targetType: 'Equipment', targetId: newRef.id,
          details: `Tambah alat baru: ${eqName}`,
        });
        showToast(`Alat "${eqName}" ditambahkan.`, 'success');
      }
      setIsEquipmentModalOpen(false);
      setEditingEquipment(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEquipment = async (eq: Equipment) => {
    if (!user) return;
    // Cek apakah alat sedang di-booking aktif
    const activeBookings = bookings.filter(b =>
      b.equipmentId === eq.id && b.status === 'APPROVED'
    );
    if (activeBookings.length > 0) {
      showToast(`Tidak bisa hapus: ${activeBookings.length} booking aktif.`, 'warning');
      return;
    }
    if (!confirm(`Hapus alat "${eq.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'equipment', eq.id));
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'Equipment', targetId: eq.id,
        details: `Hapus alat: ${eq.name}`,
      });
      showToast('Alat dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const checkConflict = (
    equipmentId: string,
    date: string,
    start: string,
    end: string,
    excludeBookingId?: string
  ): Booking | null => {
    const existing = bookings.filter(b =>
      b.equipmentId === equipmentId &&
      b.date === date &&
      b.status !== 'REJECTED' &&
      b.id !== excludeBookingId
    );
    for (const b of existing) {
      if (start < b.endTime && end > b.startTime) return b;
    }
    return null;
  };

  const handleOpenBooking = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setBookDate(new Date().toISOString().slice(0, 10));
    setBookStart('14:00');
    setBookEnd('16:00');
    setBookPurpose('');
    setIsBookingOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !selectedEquipment) return;
    if (!bookPurpose.trim()) { showToast('Isi keperluan booking.', 'warning'); return; }
    if (bookStart >= bookEnd) { showToast('Jam selesai harus lebih besar dari jam mulai.', 'warning'); return; }

    const conflict = checkConflict(selectedEquipment.id, bookDate, bookStart, bookEnd);
    if (conflict) {
      showToast(`Bentrok dengan booking "${conflict.bookerName}" (${conflict.startTime}-${conflict.endTime})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'bookings'));
      const newBooking: Booking = {
        id: newRef.id,
        classId: activeClass.id,
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name,
        bookedBy: user.uid,
        bookerName: user.displayName,
        bookerRole: user.role,
        bookerDivision: user.divisionName || '',
        date: bookDate,
        startTime: bookStart,
        endTime: bookEnd,
        purpose: bookPurpose.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, newBooking);

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Booking', targetId: newRef.id,
        details: `Booking ${selectedEquipment.name} (${bookDate} ${bookStart}-${bookEnd})`,
      });

      try {
        await notifyTeachers(activeClass.id, {
          title: 'Booking Alat Baru',
          message: `${user.displayName} booking "${selectedEquipment.name}" tanggal ${bookDate} (${bookStart}-${bookEnd})`,
          category: 'Tugas',
          link: 'booking',
          senderName: user.displayName,
        });
      } catch { /* non-fatal */ }

      showToast('Booking berhasil diajukan! Menunggu persetujuan.', 'success');
      setIsBookingOpen(false);
      setSelectedEquipment(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (booking: Booking) => {
    if (!user || !canApprove) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'APPROVED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Booking', targetId: booking.id,
        details: `Setujui booking ${booking.equipmentName}`,
      });
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id, userId: booking.bookedBy, classId: booking.classId,
        title: 'Booking Disetujui',
        message: `${user.displayName} menyetujui booking "${booking.equipmentName}" (${booking.date})`,
        category: 'Feedback', read: false, link: 'booking',
        createdAt: new Date().toISOString(),
      });
      showToast('Booking disetujui.', 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleReject = async (booking: Booking) => {
    if (!user || !canApprove) return;
    const reason = prompt('Alasan penolakan:');
    if (reason === null) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'REJECTED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
        rejectionReason: reason.trim() || 'Tanpa alasan',
      });
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id, userId: booking.bookedBy, classId: booking.classId,
        title: 'Booking Ditolak',
        message: `${user.displayName} menolak booking "${booking.equipmentName}": ${reason.trim()}`,
        category: 'Urgent', read: false, link: 'booking',
        createdAt: new Date().toISOString(),
      });
      showToast('Booking ditolak.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    if (!user) return;
    const canDel = booking.bookedBy === user.uid || isGuruPengampu || isAdminRole;
    if (!canDel) { showToast('Anda tidak berwenang.', 'warning'); return; }
    if (!confirm(`Hapus booking "${booking.equipmentName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      showToast('Booking dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filteredEquipment = equipment.filter(eq => {
    if (filterCategory !== 'ALL' && eq.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      return eq.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const myBookings = bookings.filter(b => b.bookedBy === user?.uid);
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');
  const allBookings = bookings;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Sound System': return Speaker;
      case 'Alat Musik': return Music;   // ✅ NEW
      case 'Properti': return Box;
      case 'Kostum': return Scissors;
      case 'Alat Rias': return Palette;
      case 'Alat Panggung': return Mic;
      default: return Package;
    }
  };

  const getConditionColor = (cond: string) => {
    switch (cond) {
      case 'BAIK': return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40';
      case 'RUSAK_RINGAN': return 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40';
      case 'RUSAK_BERAT': return 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40';
      case 'REJECTED': return 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40';
      default: return 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Package className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Booking Alat
              </span>
              <h2 className="text-xl font-black text-white mt-1">Peminjaman Alat Produksi</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Speaker, mic, <strong className="text-amber-300">alat musik tradisional</strong>, properti, kostum, dll
              </p>
            </div>
          </div>
          {canManageEquipment && (
            <button onClick={openAddEquipment}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <Plus className="w-4 h-4" /> Tambah Alat Lain
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setActiveTab('alat')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'alat' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Daftar Alat ({equipment.length})
        </button>
        <button onClick={() => setActiveTab('saya')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'saya' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Booking Saya ({myBookings.length})
        </button>
        <button onClick={() => setActiveTab('semua')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            activeTab === 'semua' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Semua Booking ({allBookings.length})
        </button>
        {canApprove && (
          <button onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === 'pending' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'
            }`}>
            Perlu Approval ({pendingBookings.length})
          </button>
        )}
      </div>

      {activeTab === 'alat' && (
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Cari nama alat..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white">
              <option value="ALL">Semua Kategori</option>
              {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment.map(eq => {
              const Icon = getCategoryIcon(eq.category);
              const activeBookings = bookings.filter(b =>
                b.equipmentId === eq.id &&
                b.status === 'APPROVED' &&
                b.date >= new Date().toISOString().slice(0, 10)
              ).length;

              return (
                <div key={eq.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:shadow-md transition space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug flex items-center gap-1.5 flex-wrap">
                        {eq.name}
                        {eq.isCustom && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40">
                            CUSTOM
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{eq.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`px-2 py-0.5 rounded-md border font-bold ${getConditionColor(eq.condition)}`}>
                      {eq.condition === 'BAIK' ? 'Baik' : eq.condition === 'RUSAK_RINGAN' ? 'Rusak Ringan' : 'Rusak Berat'}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-bold">
                      Qty: {eq.quantity}
                    </span>
                  </div>

                  {eq.notes && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-2">{eq.notes}</p>
                  )}

                  {activeBookings > 0 && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-500/30">
                      {activeBookings} booking aktif
                    </p>
                  )}

                  <button onClick={() => handleOpenBooking(eq)}
                    className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition">
                    <Plus className="w-3.5 h-3.5" /> Booking Alat Ini
                  </button>

                  {canManageEquipment && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <button onClick={() => openEditEquipment(eq)}
                        className="flex-1 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 text-[10px] font-bold flex items-center justify-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => handleDeleteEquipment(eq)}
                        className="flex-1 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 text-[10px] font-bold flex items-center justify-center gap-1">
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredEquipment.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Tidak ada alat yang cocok.</p>
            </div>
          )}
        </>
      )}

      {(activeTab === 'saya' || activeTab === 'semua' || activeTab === 'pending') && (
        <div className="space-y-3">
          {(activeTab === 'saya' ? myBookings : activeTab === 'pending' ? pendingBookings : allBookings).length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs">
              Belum ada booking di kategori ini.
            </div>
          ) : (
            (activeTab === 'saya' ? myBookings : activeTab === 'pending' ? pendingBookings : allBookings).map(b => (
              <div key={b.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusColor(b.status)}`}>
                        {b.status}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                        {b.equipmentName}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {b.bookerName} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({b.bookerRole})</span>
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {b.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b.startTime} - {b.endTime}</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic">"{b.purpose}"</p>

                    {b.rejectionReason && (
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-2 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-lg border border-rose-200 dark:border-rose-500/30">
                        <strong>Ditolak:</strong> {b.rejectionReason}
                      </p>
                    )}

                    {b.approvedBy && b.status === 'APPROVED' && (
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1">Disetujui oleh: {b.approvedBy}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canApprove && b.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleApprove(b)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Setujui
                        </button>
                        <button onClick={() => handleReject(b)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Tolak
                        </button>
                      </>
                    )}
                    {(b.bookedBy === user?.uid || isGuruPengampu || isAdminRole) && (
                      <button onClick={() => handleDeleteBooking(b)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        title="Hapus">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========== MODAL BOOKING ========== */}
      {isBookingOpen && selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" /> Booking Alat
              </h3>
              <button onClick={() => setIsBookingOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">{selectedEquipment.name}</p>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                {selectedEquipment.category} - Qty: {selectedEquipment.quantity}
              </p>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Pemakaian <span className="text-rose-500">*</span>
                </label>
                <input type="date" required value={bookDate} onChange={(e) => setBookDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jam Mulai <span className="text-rose-500">*</span>
                  </label>
                  <input type="time" required value={bookStart} onChange={(e) => setBookStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jam Selesai <span className="text-rose-500">*</span>
                  </label>
                  <input type="time" required value={bookEnd} onChange={(e) => setBookEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Keperluan <span className="text-rose-500">*</span>
                </label>
                <textarea rows={3} required value={bookPurpose} onChange={(e) => setBookPurpose(e.target.value)}
                  placeholder="Contoh: Latihan blocking adegan Ratu di panggung utama..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Sistem otomatis mendeteksi bentrok jadwal. Booking harus disetujui Guru/Pimpinan Produksi.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsBookingOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Mengajukan...' : 'Ajukan Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== MODAL TAMBAH/EDIT ALAT ========== */}
      {isEquipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                {editingEquipment ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-amber-500" />}
                {editingEquipment ? 'Edit Alat' : 'Tambah Alat Baru'}
              </h3>
              <button onClick={() => { setIsEquipmentModalOpen(false); setEditingEquipment(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editingEquipment && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  <strong>Alat yang belum ada di daftar default?</strong> Tambahkan di sini — bisa untuk alat musik tradisional (babun, gambus, sape, dll), properti khusus, atau alat lainnya.
                </p>
              </div>
            )}

            <form onSubmit={handleSaveEquipment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Alat <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={eqName} onChange={(e) => setEqName(e.target.value)}
                  placeholder="Contoh: Bedug, Suling, Biola..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori <span className="text-rose-500">*</span>
                </label>
                <select value={eqCategory} onChange={(e) => setEqCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah <span className="text-rose-500">*</span>
                  </label>
                  <input type="number" min="1" required value={eqQuantity}
                    onChange={(e) => setEqQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kondisi</label>
                  <select value={eqCondition} onChange={(e) => setEqCondition(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    <option value="BAIK">Baik</option>
                    <option value="RUSAK_RINGAN">Rusak Ringan</option>
                    <option value="RUSAK_BERAT">Rusak Berat</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan (Opsional)</label>
                <textarea rows={2} value={eqNotes} onChange={(e) => setEqNotes(e.target.value)}
                  placeholder="Contoh: Dipakai untuk adegan perang di Babak 2"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => { setIsEquipmentModalOpen(false); setEditingEquipment(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : (editingEquipment ? 'Simpan Perubahan' : 'Tambah Alat')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};