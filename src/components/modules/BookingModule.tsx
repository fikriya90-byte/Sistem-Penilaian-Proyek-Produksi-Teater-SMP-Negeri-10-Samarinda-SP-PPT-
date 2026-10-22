import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Package, Plus, X, Save, CheckCircle, XCircle,
  AlertTriangle, Search, Mic, Speaker, Box, Music, Palette, Scissors,
  Trash2, Edit3, Info, Settings as SettingsIcon, Send, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { recordAuditLog, notifyTeachers } from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc,
  deleteDoc, writeBatch, getDoc,
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
  isCustom?: boolean;
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
  rejectionGuidance?: string;   // ✅ NEW: arahan dari guru
  createdAt: string;
}

interface BookingSettings {
  minLeadDays: number;          // ✅ NEW: minimal H-X sebelum peminjaman
}

const EQUIPMENT_CATEGORIES = [
  'Sound System', 'Alat Musik', 'Properti', 'Kostum', 'Alat Rias', 'Alat Panggung', 'Lainnya',
];

const DEFAULT_EQUIPMENT: Omit<Equipment, 'id' | 'classId'>[] = [
  // Sound System
  { name: 'Speaker Portable', category: 'Sound System', quantity: 2, condition: 'BAIK', notes: '' },
  { name: 'Microphone Wireless', category: 'Sound System', quantity: 4, condition: 'BAIK', notes: '' },
  { name: 'Mic Clip-on', category: 'Sound System', quantity: 4, condition: 'BAIK', notes: '' },
  { name: 'Mixer Audio', category: 'Sound System', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kabel XLR 10m', category: 'Sound System', quantity: 8, condition: 'BAIK', notes: '' },
  { name: 'Proyektor', category: 'Sound System', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Laptop Operator', category: 'Sound System', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Headset Monitoring', category: 'Sound System', quantity: 2, condition: 'BAIK', notes: '' },
  // Alat Musik
  { name: 'Babun', category: 'Alat Musik', quantity: 2, condition: 'BAIK', notes: 'Alat musik tradisional Kalimantan (gendang)' },
  { name: 'Gambus', category: 'Alat Musik', quantity: 2, condition: 'BAIK', notes: 'Alat musik petik tradisional Kalimantan' },
  { name: 'Gong', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Alat musik pukul tradisional' },
  { name: 'Kempul', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Gong kecil (opsional)' },
  { name: 'Angklung', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Alat musik bambu (opsional)' },
  { name: 'Sape', category: 'Alat Musik', quantity: 1, condition: 'BAIK', notes: 'Alat musik petik Dayak (opsional)' },
  // Properti
  { name: 'Keris Pusaka', category: 'Properti', quantity: 2, condition: 'BAIK', notes: 'Adegan Ratu' },
  { name: 'Mahkota Ratu', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Singgasana', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Meja Tamu Kerajaan', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Payung Kerajaan', category: 'Properti', quantity: 1, condition: 'BAIK', notes: '' },
  // Kostum
  { name: 'Kostum Ratu Putih', category: 'Kostum', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kostum Panglima', category: 'Kostum', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kostum Utusan', category: 'Kostum', quantity: 1, condition: 'BAIK', notes: '' },
  { name: 'Kostum Dayang', category: 'Kostum', quantity: 3, condition: 'BAIK', notes: '' },
  // Alat Rias
  { name: 'Kotak Rias Lengkap', category: 'Alat Rias', quantity: 3, condition: 'BAIK', notes: '' },
  { name: 'Face Chart Set', category: 'Alat Rias', quantity: 1, condition: 'BAIK', notes: '' },
  // Alat Panggung
  { name: 'Lampu Sorot', category: 'Alat Panggung', quantity: 4, condition: 'BAIK', notes: '' },
  { name: 'Lampu LED Par', category: 'Alat Panggung', quantity: 6, condition: 'BAIK', notes: '' },
  { name: 'Backdrop Kayu', category: 'Alat Panggung', quantity: 1, condition: 'BAIK', notes: '' },
];

const CAN_MANAGE_EQUIPMENT_ROLES = [
  'Koordinator Perlengkapan', 'Guru Pengampu', 'Guru Pembina',
  'Admin', 'Super Admin', 'Pimpinan Produksi',
];

const CAN_APPROVE_ROLES = ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin', 'Pimpinan Produksi'];

// ✅ NEW: Template arahan penolakan
const REJECTION_TEMPLATES = (minLeadDays: number) => [
  {
    label: `Booking minimal H-${minLeadDays} (${minLeadDays} hari sebelum peminjaman)`,
    reason: 'Tanggal terlalu dekat dengan hari ini',
    guidance: `Sesuai aturan, booking alat harus diajukan minimal ${minLeadDays} hari sebelum tanggal peminjaman. Silakan ajukan ulang dengan tanggal yang lebih jauh (H-${minLeadDays} ke atas).`,
  },
  {
    label: 'Alat sedang digunakan kegiatan lain',
    reason: 'Alat sedang dipakai untuk kegiatan lain pada tanggal tersebut',
    guidance: 'Mohon pilih tanggal lain atau koordinasikan dengan peminjam sebelumnya. Cek jadwal ketersediaan di menu Booking.',
  },
  {
    label: 'Alat dalam perawatan / rusak',
    reason: 'Alat sedang dalam perawatan atau rusak',
    guidance: 'Alat tidak dapat dipinjam sampai selesai perbaikan. Silakan hubungi Koordinator Perlengkapan untuk informasi ketersediaan.',
  },
  {
    label: 'Bentrok dengan jadwal pementasan',
    reason: 'Bentrok dengan jadwal pementasan utama',
    guidance: 'Alat diprioritaskan untuk pementasan utama. Silakan pilih tanggal lain setelah pementasan.',
  },
];

// Helper: hitung tanggal minimum booking
const calculateMinDate = (minLeadDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + minLeadDays);
  return d.toISOString().slice(0, 10);
};

// Helper: hitung selisih hari
const daysDifference = (fromDate: string, toDate: string): number => {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  return Math.ceil((to - from) / 86400000);
};

export const BookingModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<BookingSettings>({ minLeadDays: 2 });
  const [activeTab, setActiveTab] = useState<'alat' | 'saya' | 'semua' | 'pending'>('alat');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Modal alat
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [eqName, setEqName] = useState('');
  const [eqCategory, setEqCategory] = useState<string>('Lainnya');
  const [eqQuantity, setEqQuantity] = useState(1);
  const [eqCondition, setEqCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'>('BAIK');
  const [eqNotes, setEqNotes] = useState('');

  // ✅ NEW: Modal reject dengan arahan
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectGuidance, setRejectGuidance] = useState('');

  // ✅ NEW: Modal settings (min lead days)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsMinLead, setSettingsMinLead] = useState(2);

  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookStart, setBookStart] = useState('14:00');
  const [bookEnd, setBookEnd] = useState('16:00');
  const [bookPurpose, setBookPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canApprove = user && CAN_APPROVE_ROLES.includes(user.role);
  const canManageEquipment = user && CAN_MANAGE_EQUIPMENT_ROLES.includes(user.role);
  const minLeadDays = settings.minLeadDays;
  const minBookingDate = calculateMinDate(minLeadDays);

  // Load settings
  useEffect(() => {
    if (!activeClass) return;
    (async () => {
      try {
        const ref = doc(db, 'classes', activeClass.id, 'config', 'booking');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setSettings({ minLeadDays: data.minLeadDays ?? 2 });
          setSettingsMinLead(data.minLeadDays ?? 2);
        }
      } catch (err) { console.warn('Load settings error:', err); }
    })();
  }, [activeClass]);

  // Subscribe equipment + bookings
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
              id: newRef.id, classId: activeClass.id, isCustom: false, ...eq,
            });
          });
          await batch.commit();
        } catch (err) { console.warn('Seed error:', err); }
        finally { setIsSeeding(false); }
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

  // ========== SETTINGS ==========
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (settingsMinLead < 0 || settingsMinLead > 30) {
      showToast('Rentang H- harus 0-30 hari.', 'warning');
      return;
    }
    try {
      await setDoc(doc(db, 'classes', activeClass.id, 'config', 'booking'), {
        minLeadDays: settingsMinLead,
        updatedAt: new Date().toISOString(),
        updatedBy: user.displayName,
      }, { merge: true });
      setSettings({ minLeadDays: settingsMinLead });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'BookingSettings', targetId: activeClass.id,
        details: `Set minimal lead time booking: H-${settingsMinLead}`,
      });
      showToast(`Pengaturan disimpan: minimal H-${settingsMinLead}.`, 'success');
      setIsSettingsModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ========== EQUIPMENT ==========
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
    if (!eqName.trim()) { showToast('Nama alat wajib.', 'warning'); return; }
    if (eqQuantity < 1) { showToast('Jumlah minimal 1.', 'warning'); return; }

    setSubmitting(true);
    try {
      if (editingEquipment) {
        await updateDoc(doc(db, 'equipment', editingEquipment.id), {
          name: eqName.trim(), category: eqCategory, quantity: eqQuantity,
          condition: eqCondition, notes: eqNotes.trim(),
        });
        await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'UPDATE', targetType: 'Equipment', targetId: editingEquipment.id, details: `Edit alat: ${eqName}` });
        showToast('Alat diperbarui.', 'success');
      } else {
        const newRef = doc(collection(db, 'equipment'));
        await setDoc(newRef, {
          id: newRef.id, classId: activeClass.id,
          name: eqName.trim(), category: eqCategory, quantity: eqQuantity,
          condition: eqCondition, notes: eqNotes.trim(), isCustom: true,
        });
        await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'CREATE', targetType: 'Equipment', targetId: newRef.id, details: `Tambah alat: ${eqName}` });
        showToast(`Alat "${eqName}" ditambahkan.`, 'success');
      }
      setIsEquipmentModalOpen(false);
      setEditingEquipment(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteEquipment = async (eq: Equipment) => {
    if (!user) return;
    const activeBookings = bookings.filter(b => b.equipmentId === eq.id && b.status === 'APPROVED');
    if (activeBookings.length > 0) { showToast(`Tidak bisa hapus: ${activeBookings.length} booking aktif.`, 'warning'); return; }
    if (!confirm(`Hapus alat "${eq.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'equipment', eq.id));
      showToast('Alat dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ========== BOOKING ==========
  const checkConflict = (equipmentId: string, date: string, start: string, end: string): Booking | null => {
    const existing = bookings.filter(b => b.equipmentId === equipmentId && b.date === date && b.status !== 'REJECTED');
    for (const b of existing) {
      if (start < b.endTime && end > b.startTime) return b;
    }
    return null;
  };

  const handleOpenBooking = (eq: Equipment) => {
    setSelectedEquipment(eq);
    // ✅ Auto-set bookDate ke tanggal minimum yang diperbolehkan
    setBookDate(minBookingDate);
    setBookStart('14:00'); setBookEnd('16:00'); setBookPurpose('');
    setIsBookingOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !selectedEquipment) return;

    if (!bookPurpose.trim()) { showToast('Isi keperluan booking.', 'warning'); return; }
    if (bookStart >= bookEnd) { showToast('Jam selesai harus > jam mulai.', 'warning'); return; }

    // ✅ VALIDASI LEAD TIME
    const diff = daysDifference(new Date().toISOString().slice(0, 10), bookDate);
    if (diff < minLeadDays) {
      showToast(
        `Booking minimal H-${minLeadDays} (${minLeadDays} hari sebelum peminjaman). Tanggal yang Anda pilih hanya ${diff} hari lagi.`,
        'error'
      );
      return;
    }

    const conflict = checkConflict(selectedEquipment.id, bookDate, bookStart, bookEnd);
    if (conflict) {
      showToast(`Bentrok dengan booking "${conflict.bookerName}" (${conflict.startTime}-${conflict.endTime})`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'bookings'));
      await setDoc(newRef, {
        id: newRef.id, classId: activeClass.id,
        equipmentId: selectedEquipment.id, equipmentName: selectedEquipment.name,
        bookedBy: user.uid, bookerName: user.displayName, bookerRole: user.role,
        bookerDivision: user.divisionName || '',
        date: bookDate, startTime: bookStart, endTime: bookEnd,
        purpose: bookPurpose.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      } as Booking);

      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'CREATE', targetType: 'Booking', targetId: newRef.id, details: `Booking ${selectedEquipment.name} (${bookDate} ${bookStart}-${bookEnd})` });

      try {
        await notifyTeachers(activeClass.id, {
          title: '📦 Booking Alat Baru',
          message: `${user.displayName} mengajukan booking "${selectedEquipment.name}" untuk ${bookDate} (${bookStart}-${bookEnd}). Mohon diverifikasi.`,
          category: 'Tugas', link: 'booking', senderName: user.displayName,
        });
      } catch { /* non-fatal */ }

      showToast('Booking diajukan! Menunggu verifikasi guru.', 'success');
      setIsBookingOpen(false);
      setSelectedEquipment(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async (booking: Booking) => {
    if (!user || !canApprove) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'APPROVED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
      });
      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'UPDATE', targetType: 'Booking', targetId: booking.id, details: `Setujui booking ${booking.equipmentName}` });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id, userId: booking.bookedBy, classId: booking.classId,
        title: '✅ Booking Disetujui',
        message: `${user.displayName} menyetujui booking "${booking.equipmentName}" untuk ${booking.date}. Alat siap dipinjam.`,
        category: 'Feedback', read: false, link: 'booking',
        createdAt: new Date().toISOString(),
      });
      showToast('Booking disetujui.', 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ✅ NEW: Buka modal reject
  const handleOpenReject = (booking: Booking) => {
    setRejectingBooking(booking);
    setRejectReason('');
    setRejectGuidance('');
    setIsRejectModalOpen(true);
  };

  // ✅ NEW: Submit reject dengan arahan
  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectingBooking) return;
    if (!rejectReason.trim()) { showToast('Isi alasan penolakan.', 'warning'); return; }
    if (!rejectGuidance.trim()) { showToast('Isi arahan untuk siswa.', 'warning'); return; }

    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'bookings', rejectingBooking.id), {
        status: 'REJECTED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
        rejectionReason: rejectReason.trim(),
        rejectionGuidance: rejectGuidance.trim(),
      });
      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'UPDATE', targetType: 'Booking', targetId: rejectingBooking.id, details: `Tolak booking ${rejectingBooking.equipmentName}: ${rejectReason}` });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id, userId: rejectingBooking.bookedBy, classId: rejectingBooking.classId,
        title: '❌ Booking Ditolak',
        message: `"${rejectingBooking.equipmentName}" (${rejectingBooking.date}): ${rejectReason}. Arahan: ${rejectGuidance}`,
        category: 'Urgent', read: false, link: 'booking',
        createdAt: new Date().toISOString(),
      });

      showToast('Booking ditolak. Siswa menerima arahan.', 'success');
      setIsRejectModalOpen(false);
      setRejectingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    if (!user) return;
    if (!(booking.bookedBy === user.uid || isGuruPengampu || isAdminRole)) { showToast('Tidak berwenang.', 'warning'); return; }
    if (!confirm(`Hapus booking "${booking.equipmentName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      showToast('Booking dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filteredEquipment = equipment.filter(eq => {
    if (filterCategory !== 'ALL' && eq.category !== filterCategory) return false;
    if (searchQuery.trim()) return eq.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const myBookings = bookings.filter(b => b.bookedBy === user?.uid);
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Sound System': return Speaker;
      case 'Alat Musik': return Music;
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
                Booking <strong className="text-amber-300">minimal H-{minLeadDays}</strong> sebelum tanggal peminjaman
              </p>
            </div>
          </div>
          {canManageEquipment && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setSettingsMinLead(minLeadDays); setIsSettingsModalOpen(true); }}
                className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                <SettingsIcon className="w-3.5 h-3.5" /> Aturan
              </button>
              <button onClick={openAddEquipment}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
                <Plus className="w-4 h-4" /> Tambah Alat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Aturan booking:</strong> Ajukan minimal <strong>H-{minLeadDays}</strong> ({minLeadDays} hari sebelum peminjaman).
          Booking mendadak akan ditolak. Booking yang diajukan akan diverifikasi oleh Guru/Pimpinan Produksi.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setActiveTab('alat')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'alat' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
          Daftar Alat ({equipment.length})
        </button>
        <button onClick={() => setActiveTab('saya')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'saya' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
          Booking Saya ({myBookings.length})
        </button>
        <button onClick={() => setActiveTab('semua')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'semua' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
          Semua ({bookings.length})
        </button>
        {canApprove && (
          <button onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'pending' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'}`}>
            Perlu Verifikasi ({pendingBookings.length})
          </button>
        )}
      </div>

      {/* Daftar Alat */}
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
              const activeBookings = bookings.filter(b => b.equipmentId === eq.id && b.status === 'APPROVED' && b.date >= new Date().toISOString().slice(0, 10)).length;
              return (
                <div key={eq.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:shadow-md transition space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug flex items-center gap-1.5 flex-wrap">
                        {eq.name}
                        {eq.isCustom && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40">CUSTOM</span>}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{eq.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`px-2 py-0.5 rounded-md border font-bold ${getConditionColor(eq.condition)}`}>
                      {eq.condition === 'BAIK' ? 'Baik' : eq.condition === 'RUSAK_RINGAN' ? 'Rusak Ringan' : 'Rusak Berat'}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-bold">Qty: {eq.quantity}</span>
                  </div>
                  {eq.notes && <p className="text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-2">{eq.notes}</p>}
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
        </>
      )}

      {/* List Bookings */}
      {(activeTab === 'saya' || activeTab === 'semua' || activeTab === 'pending') && (
        <div className="space-y-3">
          {(activeTab === 'saya' ? myBookings : activeTab === 'pending' ? pendingBookings : bookings).length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs">
              Belum ada booking.
            </div>
          ) : (
            (activeTab === 'saya' ? myBookings : activeTab === 'pending' ? pendingBookings : bookings).map(b => {
              const daysLeft = daysDifference(new Date().toISOString().slice(0, 10), b.date);
              return (
                <div key={b.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusColor(b.status)}`}>
                          {b.status === 'PENDING' ? 'MENUNGGU' : b.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                          {b.equipmentName}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${daysLeft < minLeadDays ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          H-{daysLeft}
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

                      {/* ✅ REJECTION dengan ARAHAN */}
                      {b.status === 'REJECTED' && b.rejectionReason && (
                        <div className="mt-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40">
                          <div className="flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-rose-900 dark:text-rose-200 uppercase">Alasan Penolakan</p>
                              <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">{b.rejectionReason}</p>
                              {b.rejectionGuidance && (
                                <>
                                  <p className="text-[11px] font-black text-rose-900 dark:text-rose-200 uppercase mt-2">Arahan Guru</p>
                                  <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5 italic">"{b.rejectionGuidance}"</p>
                                </>
                              )}
                              <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Ditolak oleh: {b.approvedBy}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {b.approvedBy && b.status === 'APPROVED' && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1">Disetujui oleh: {b.approvedBy}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {canApprove && b.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleApprove(b)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Setujui
                          </button>
                          <button onClick={() => handleOpenReject(b)}
                            className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Tolak
                          </button>
                        </>
                      )}
                      {(b.bookedBy === user?.uid || isGuruPengampu || isAdminRole) && (
                        <button onClick={() => handleDeleteBooking(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Hapus">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL BOOKING */}
      {isBookingOpen && selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 max-h-[95vh] overflow-y-auto">
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
              <p className="text-[10px] text-indigo-700 dark:text-indigo-300">{selectedEquipment.category} - Qty: {selectedEquipment.quantity}</p>
            </div>

            {/* Warning aturan lead time */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <p className="font-black">Aturan Booking: Minimal H-{minLeadDays}</p>
                <p className="mt-0.5">Tanggal peminjaman paling cepat: <strong>{new Date(minBookingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
              </div>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Pemakaian <span className="text-rose-500">*</span>
                </label>
                <input type="date" required value={bookDate}
                  min={minBookingDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl border-2 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white ${
                    daysDifference(new Date().toISOString().slice(0, 10), bookDate) < minLeadDays
                      ? 'border-rose-400 dark:border-rose-500/60'
                      : 'border-slate-200 dark:border-slate-700'
                  }`} />
                {daysDifference(new Date().toISOString().slice(0, 10), bookDate) < minLeadDays && (
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Terlalu dekat. Minimal {new Date(minBookingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </p>
                )}
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
                <Send className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Booking akan <strong>diverifikasi</strong> oleh Guru/Pimpinan Produksi. Anda akan menerima notifikasi hasilnya.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsBookingOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                  Batal
                </button>
                <button type="submit" disabled={submitting || daysDifference(new Date().toISOString().slice(0, 10), bookDate) < minLeadDays}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Mengajukan...' : 'Ajukan Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== MODAL REJECT DENGAN ARAHAN ========== */}
      {isRejectModalOpen && rejectingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <form onSubmit={handleSubmitReject}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-500" /> Tolak & Beri Arahan
              </h3>
              <button type="button" onClick={() => setIsRejectModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Booking:</p>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">{rejectingBooking.equipmentName}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {rejectingBooking.bookerName} • {rejectingBooking.date} ({rejectingBooking.startTime}-{rejectingBooking.endTime})
              </p>
            </div>

            {/* Template cepat */}
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Template Cepat:</p>
              <div className="space-y-1.5">
                {REJECTION_TEMPLATES(minLeadDays).map((tpl, i) => (
                  <button key={i} type="button" onClick={() => { setRejectReason(tpl.reason); setRejectGuidance(tpl.guidance); }}
                    className="w-full p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-left hover:bg-amber-100 dark:hover:bg-amber-500/20 transition">
                    <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">⚡ {tpl.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Tanggal terlalu dekat"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Arahan untuk Siswa <span className="text-rose-500">*</span>
              </label>
              <textarea rows={3} required value={rejectGuidance}
                onChange={(e) => setRejectGuidance(e.target.value)}
                placeholder="Contoh: Silakan ajukan ulang dengan tanggal minimal 2 hari sebelum peminjaman..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Arahan ini akan tampil jelas di dashboard siswa.</p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                {submitting ? 'Menolak...' : 'Tolak & Kirim Arahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========== MODAL SETTINGS (Aturan Lead Time) ========== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <form onSubmit={handleSaveSettings}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" /> Aturan Booking
              </h3>
              <button type="button" onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Minimal Lead Time (H-)
              </label>
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => setSettingsMinLead(Math.max(0, settingsMinLead - 1))}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700">−</button>
                <input type="number" min="0" max="30" value={settingsMinLead}
                  onChange={(e) => setSettingsMinLead(parseInt(e.target.value) || 0)}
                  className="flex-1 px-3 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-black text-center text-slate-800 dark:text-white" />
                <button type="button" onClick={() => setSettingsMinLead(Math.min(30, settingsMinLead + 1))}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700">+</button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Booking harus diajukan minimal <strong>H-{settingsMinLead}</strong> ({settingsMinLead} hari) sebelum tanggal peminjaman. Contoh: jika H-2, booking tanggal 25 Okt paling lambat diajukan pada 23 Okt.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-900 dark:text-blue-200">
                Siswa tidak akan bisa submit booking jika tanggal peminjaman kurang dari H-{settingsMinLead}. Guru tetap bisa menolak manual dengan arahan tambahan.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit"
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Simpan Aturan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========== MODAL EQUIPMENT (Tambah/Edit Alat) ========== */}
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
            <form onSubmit={handleSaveEquipment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Alat <span className="text-rose-500">*</span></label>
                <input type="text" required value={eqName} onChange={(e) => setEqName(e.target.value)}
                  placeholder="Contoh: Bedug, Suling, Biola..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori <span className="text-rose-500">*</span></label>
                <select value={eqCategory} onChange={(e) => setEqCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jumlah <span className="text-rose-500">*</span></label>
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
                  {submitting ? 'Menyimpan...' : (editingEquipment ? 'Simpan' : 'Tambah Alat')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};