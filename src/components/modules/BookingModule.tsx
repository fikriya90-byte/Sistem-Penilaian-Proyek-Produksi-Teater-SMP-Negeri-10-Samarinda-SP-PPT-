import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Package, Plus, X, Save, CheckCircle, XCircle,
  AlertTriangle, Search, Music, Trash2, Edit3, Info,
  Settings as SettingsIcon, Send, ShieldAlert, Building2, User as UserIcon,
  Table, Bell, MapPin
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { recordAuditLog, notifyTeachers } from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc,
  deleteDoc, writeBatch, getDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { BookingCalendarModule } from './BookingCalendarModule';

interface Equipment {
  id: string;
  classId: string;
  name: string;
  category: string;
  quantity: number;
  condition: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';
  notes: string;
  isCustom?: boolean;
  addedByName?: string;
}

interface Booking {
  id: string;
  classId: string;
  className: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCategory: string;
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
  rejectionGuidance?: string;
  originalStartTime?: string;
  originalEndTime?: string;
  verifierNote?: string;
  wasRescheduledByVerifier?: boolean;
  createdAt: string;
}

interface BookingSettings {
  minLeadDays: number;
}

// ✅ Aturan peminjaman
const MAX_BOOKING_MINUTES = 60; // Maksimal 1 jam per booking

// ✅ Helper waktu
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getDurationMinutes = (start: string, end: string): number => {
  return timeToMinutes(end) - timeToMinutes(start);
};

const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return '0 menit';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
};

// ✅ Kategori
const MUSIC_CATEGORIES = [
  'Alat Musik Tradisional',
  'Alat Musik Modern',
  'Aksesoris & Perlengkapan Musik',
  'Lainnya',
];

// ✅ HANYA 3 ALAT DEFAULT
const DEFAULT_INSTRUMENTS: Omit<Equipment, 'id' | 'classId'>[] = [
  { name: 'Babun', category: 'Alat Musik Tradisional', quantity: 2, condition: 'BAIK', notes: 'Gendang tradisional Kalimantan' },
  { name: 'Gong', category: 'Alat Musik Tradisional', quantity: 1, condition: 'BAIK', notes: 'Gong untuk pementasan' },
  { name: 'Gambus', category: 'Alat Musik Tradisional', quantity: 2, condition: 'BAIK', notes: 'Alat musik petik khas Kalimantan' },
];

// ✅ HANYA GURU & ADMIN YANG BISA VERIFIKASI
const VERIFIER_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'
];

const REJECTION_TEMPLATES = (minLeadDays: number) => [
  {
    label: `Booking minimal H-${minLeadDays} (${minLeadDays} hari sebelum peminjaman)`,
    reason: 'Tanggal terlalu dekat dengan hari ini',
    guidance: `Sesuai aturan, booking alat musik harus diajukan minimal ${minLeadDays} hari sebelum tanggal peminjaman. Silakan ajukan ulang dengan tanggal yang lebih jauh.`,
  },
  {
    label: 'Alat musik sedang dipakai latihan',
    reason: 'Alat musik sedang dipakai untuk latihan rutin',
    guidance: 'Alat sedang dipinjam divisi lain untuk latihan. Silakan pilih tanggal lain atau koordinasikan dengan Koordinator Tata Musik.',
  },
  {
    label: 'Alat musik rusak / perawatan',
    reason: 'Alat musik sedang dalam perawatan atau rusak',
    guidance: 'Alat tidak dapat dipinjam sampai selesai perbaikan. Silakan hubungi Koordinator Tata Musik.',
  },
  {
    label: 'Bentrok dengan Gladi Resik / Pementasan',
    reason: 'Bentrok dengan jadwal Gladi Resik / Pementasan',
    guidance: 'Alat musik diprioritaskan untuk Gladi Resik & Pementasan utama. Silakan pilih tanggal lain.',
  },
];

const calculateMinDate = (minLeadDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + minLeadDays);
  return d.toISOString().slice(0, 10);
};

const daysDifference = (fromDate: string, toDate: string): number => {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  return Math.ceil((to - from) / 86400000);
};

export const BookingModule: React.FC = () => {
  const { user, activeClass, classes, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<BookingSettings>({ minLeadDays: 2 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [stageConfig, setStageConfig] = useState<any>(null);

  // ✅ Tentukan peran (Hanya Guru & Admin yang jadi Verifikator)
  const isVerifier = !!user && VERIFIER_ROLES.includes(user.role);

  // Default tab: Guru -> verifikasi, Siswa/Pengurus -> katalog
  const [activeTab, setActiveTab] = useState<string>(isVerifier ? 'pending' : 'katalog');

  // Modal tambah alat (HANYA untuk siswa)
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [eqName, setEqName] = useState('');
  const [eqCategory, setEqCategory] = useState<string>('Alat Musik Tradisional');
  const [eqQuantity, setEqQuantity] = useState(1);
  const [eqCondition, setEqCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'>('BAIK');
  const [eqNotes, setEqNotes] = useState('');

  // Modal reject (untuk verifikator)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectGuidance, setRejectGuidance] = useState('');

  // Modal approve (guru bisa sesuaikan jam)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvingBooking, setApprovingBooking] = useState<Booking | null>(null);
  const [approveStart, setApproveStart] = useState('');
  const [approveEnd, setApproveEnd] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [approveError, setApproveError] = useState('');

  // Modal settings
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsMinLead, setSettingsMinLead] = useState(2);

  // Form booking
  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookStart, setBookStart] = useState('14:00');
  const [bookEnd, setBookEnd] = useState('15:00');
  const [bookPurpose, setBookPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          // ✅ Paksa minimal H-2
          const loadedMin = Math.max(2, Number(data.minLeadDays ?? 2));
          setSettings({ minLeadDays: loadedMin });
          setSettingsMinLead(loadedMin);
        }
      } catch (err) { console.warn('Load settings error:', err); }
    })();
  }, [activeClass]);

  // Load stage config (untuk reminder tahap persiapan)
  useEffect(() => {
    if (!activeClass) return;
    const unsub = onSnapshot(doc(db, 'classes', activeClass.id, 'config', 'stageManager'), snap => {
      if (snap.exists()) setStageConfig(snap.data());
    });
    return () => unsub();
  }, [activeClass]);

  // Subscribe equipment
  useEffect(() => {
    if (!activeClass) return;
    const qEq = query(collection(db, 'equipment'), where('classId', '==', activeClass.id));
    const unsubEq = onSnapshot(qEq, async snap => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Equipment));
      if (items.length === 0 && !isSeeding) {
        setIsSeeding(true);
        try {
          const batch = writeBatch(db);
          DEFAULT_INSTRUMENTS.forEach(eq => {
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
    return () => unsubEq();
  }, [activeClass, isSeeding]);

  // Subscribe bookings
  useEffect(() => {
    if (!activeClass) return;

    let qBk;
    if (isVerifier) {
      const classIds = classes.map(c => c.id);
      if (classIds.length > 0 && classIds.length <= 30) {
        qBk = query(collection(db, 'bookings'), where('classId', 'in', classIds));
      } else {
        qBk = query(collection(db, 'bookings'));
      }
    } else {
      qBk = query(collection(db, 'bookings'), where('classId', '==', activeClass.id));
    }

    const unsubBk = onSnapshot(qBk, snap => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(items);
    });
    return () => unsubBk();
  }, [activeClass, isVerifier, classes]);

  // ============== SETTINGS ==============
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (settingsMinLead < 2 || settingsMinLead > 30) {
      showToast('Minimal H-2 dan maksimal H-30 hari.', 'warning');
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
      showToast(`Aturan disimpan: minimal H-${settingsMinLead}.`, 'success');
      setIsSettingsModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ============== TAMBAH ALAT ==============
  const openAddEquipment = () => {
    setEqName(''); setEqCategory('Alat Musik Tradisional'); setEqQuantity(1);
    setEqCondition('BAIK'); setEqNotes('');
    setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!eqName.trim()) { showToast('Nama alat musik wajib.', 'warning'); return; }
    if (eqQuantity < 1) { showToast('Jumlah minimal 1.', 'warning'); return; }

    const exists = equipment.some(e => e.name.toLowerCase() === eqName.trim().toLowerCase());
    if (exists) {
      showToast(`Alat "${eqName}" sudah ada di katalog.`, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'equipment'));
      await setDoc(newRef, {
        id: newRef.id, classId: activeClass.id,
        name: eqName.trim(), category: eqCategory, quantity: eqQuantity,
        condition: eqCondition, notes: eqNotes.trim(),
        isCustom: true,
        addedByName: user.displayName,
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Equipment', targetId: newRef.id,
        details: `Tambah alat musik manual: ${eqName}`,
      });
      showToast(`Alat musik "${eqName}" ditambahkan.`, 'success');
      setIsEquipmentModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // ============== BOOKING ==============
  const handleOpenBooking = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setBookDate(minBookingDate);
    setBookStart('14:00');
    setBookEnd('15:00');
    setBookPurpose('');
    setIsBookingOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !selectedEquipment) return;
    if (!bookPurpose.trim()) { showToast('Isi keperluan booking.', 'warning'); return; }

    const dur = getDurationMinutes(bookStart, bookEnd);
    if (dur <= 0) { showToast('Jam selesai harus > jam mulai.', 'warning'); return; }
    if (dur > MAX_BOOKING_MINUTES) {
      showToast(`Maksimal ${formatDuration(MAX_BOOKING_MINUTES)} per booking.`, 'error');
      return;
    }

    const diff = daysDifference(new Date().toISOString().slice(0, 10), bookDate);
    if (diff < minLeadDays) {
      showToast(`Booking minimal H-${minLeadDays}. Tanggal dipilih hanya ${diff} hari lagi.`, 'error');
      return;
    }

    const existing = bookings.filter(b =>
      b.equipmentId === selectedEquipment.id && b.date === bookDate && b.status !== 'REJECTED'
    );
    for (const b of existing) {
      if (bookStart < b.endTime && bookEnd > b.startTime) {
        showToast(`Bentrok dengan booking ${b.bookerName} (${b.startTime}-${b.endTime}).`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'bookings'));
      await setDoc(newRef, {
        id: newRef.id,
        classId: activeClass.id,
        className: activeClass.name,
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name,
        equipmentCategory: selectedEquipment.category,
        bookedBy: user.uid,
        bookerName: user.displayName,
        bookerRole: user.role,
        bookerDivision: user.divisionName || '',
        date: bookDate, startTime: bookStart, endTime: bookEnd,
        purpose: bookPurpose.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      } as Booking);

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Booking', targetId: newRef.id,
        details: `Booking ${selectedEquipment.name} (${bookDate} ${bookStart}-${bookEnd})`,
      });

      try {
        await notifyTeachers(activeClass.id, {
          title: '🎵 Booking Alat Musik Baru',
          message: `${user.displayName} (${activeClass.name}) mengajukan booking "${selectedEquipment.name}" untuk ${bookDate} (${bookStart}-${bookEnd}).`,
          category: 'Tugas', link: 'booking', senderName: user.displayName,
        });
      } catch { /* non-fatal */ }

      showToast('Booking diajukan! Menunggu verifikasi guru.', 'success');
      setIsBookingOpen(false);
      setSelectedEquipment(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // ============== VERIFIKATOR ==============
  const handleOpenApprove = (booking: Booking) => {
    setApprovingBooking(booking);
    setApproveStart(booking.startTime);
    setApproveEnd(booking.endTime);
    setApproveNote('');
    setApproveError('');
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !approvingBooking || !isVerifier) return;

    const dur = getDurationMinutes(approveStart, approveEnd);
    if (dur <= 0) { setApproveError('Jam selesai harus > jam mulai.'); return; }
    if (dur > MAX_BOOKING_MINUTES) { setApproveError(`Maksimal ${formatDuration(MAX_BOOKING_MINUTES)}.`); return; }

    const conflicting = bookings
      .filter(b =>
        b.id !== approvingBooking.id &&
        b.equipmentId === approvingBooking.equipmentId &&
        b.date === approvingBooking.date &&
        b.status === 'APPROVED'
      )
      .find(b => approveStart < b.endTime && approveEnd > b.startTime);

    if (conflicting) {
      setApproveError(`Bentrok dengan booking ${conflicting.bookerName} (${conflicting.startTime}-${conflicting.endTime}).`);
      return;
    }

    setApproveError('');
    setSubmitting(true);
    try {
      const wasRescheduled = approveStart !== approvingBooking.startTime || approveEnd !== approvingBooking.endTime;

      await updateDoc(doc(db, 'bookings', approvingBooking.id), {
        status: 'APPROVED',
        startTime: approveStart,
        endTime: approveEnd,
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
        verifierNote: approveNote.trim() || null,
        originalStartTime: approvingBooking.startTime,
        originalEndTime: approvingBooking.endTime,
        wasRescheduledByVerifier: wasRescheduled,
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Booking', targetId: approvingBooking.id,
        details: `Setujui booking ${approvingBooking.equipmentName}${wasRescheduled ? ' (jam diubah)' : ''}`,
      });

      try {
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id, userId: approvingBooking.bookedBy, classId: approvingBooking.classId,
          title: wasRescheduled ? '✅ Booking Disetujui (Jam Disesuaikan)' : '✅ Booking Disetujui',
          message: wasRescheduled
            ? `${user.displayName} menyetujui "${approvingBooking.equipmentName}". Jam disesuaikan menjadi ${approveStart}-${approveEnd}.`
            : `${user.displayName} menyetujui "${approvingBooking.equipmentName}" (${approveStart}-${approveEnd}).`,
          category: 'Feedback', read: false, link: 'booking',
          createdAt: new Date().toISOString(),
        });
      } catch { /* non-fatal */ }

      showToast(wasRescheduled ? 'Booking disetujui dengan jam baru.' : 'Booking disetujui.', 'success');
      setIsApproveModalOpen(false);
      setApprovingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleOpenReject = (booking: Booking) => {
    setRejectingBooking(booking);
    setRejectReason(''); setRejectGuidance('');
    setIsRejectModalOpen(true);
  };

  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectingBooking || !isVerifier) return;
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
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Booking', targetId: rejectingBooking.id,
        details: `Tolak booking ${rejectingBooking.equipmentName}: ${rejectReason}`,
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id, userId: rejectingBooking.bookedBy, classId: rejectingBooking.classId,
        title: '❌ Booking Ditolak',
        message: `"${rejectingBooking.equipmentName}": ${rejectReason}. Arahan: ${rejectGuidance}`,
        category: 'Urgent', read: false, link: 'booking',
        createdAt: new Date().toISOString(),
      });

      showToast('Booking ditolak.', 'success');
      setIsRejectModalOpen(false);
      setRejectingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    if (!user) return;
    if (!(booking.bookedBy === user.uid || isVerifier)) {
      showToast('Tidak berwenang.', 'warning'); return;
    }
    if (!confirm(`Hapus booking "${booking.equipmentName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      showToast('Booking dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ============== FILTER & LIST DATA ==============
  const filteredEquipment = equipment.filter(eq => {
    if (filterCategory !== 'ALL' && eq.category !== filterCategory) return false;
    if (searchQuery.trim()) return eq.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const myBookings = bookings.filter(b => b.bookedBy === user?.uid);
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');
  const allBookingsFiltered = bookings.filter(b => {
    if (filterClass !== 'ALL' && b.classId !== filterClass) return false;
    return true;
  });

  // Urutkan untuk tabel jadwal
  const tableBookings = useMemo(() => {
    return [...bookings]
      .filter(b => b.status !== 'REJECTED')
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [bookings]);

  const getConditionColor = (cond: string) => {
    switch (cond) {
      case 'BAIK': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'RUSAK_RINGAN': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'RUSAK_BERAT': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'REJECTED': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  // =========================================
  // RENDER: MODE VERIFIKATOR (GURU / ADMIN)
  // =========================================
  if (isVerifier) {
    return (
      <div className="space-y-6">
        {/* Header Verifikator */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-800 text-white shadow-xl border border-emerald-500/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldAlert className="w-7 h-7" />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Panel Guru / Admin
                </span>
                <h2 className="text-xl font-black text-white mt-1">Verifikasi Booking</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {pendingBookings.length} booking menunggu • Aturan: minimal H-{minLeadDays}, maksimal 1 jam
                </p>
              </div>
            </div>
            <button onClick={() => { setSettingsMinLead(minLeadDays); setIsSettingsModalOpen(true); }}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
              <SettingsIcon className="w-4 h-4" /> Atur Lead Time (H-{minLeadDays})
            </button>
          </div>
        </div>

        {/* Tabs Verifikator */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'pending' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Perlu Verifikasi ({pendingBookings.length})
          </button>
          <button onClick={() => setActiveTab('tabel')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${activeTab === 'tabel' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
            <Table className="w-3.5 h-3.5" /> Tabel Jadwal
          </button>
          <button onClick={() => setActiveTab('kalender')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${activeTab === 'kalender' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
            <Calendar className="w-3.5 h-3.5" /> Kalender Lintas Kelas
          </button>
          <button onClick={() => setActiveTab('katalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Katalog & Pinjam
          </button>
        </div>

        {/* Content Verifikator */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingBookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                <h3 className="text-sm font-extrabold text-slate-700">Tidak Ada Booking Menunggu</h3>
              </div>
            ) : (
              pendingBookings.map(b => (
                <div key={b.id} className="p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{b.className}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">{b.equipmentName}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{b.bookerName} <span className="text-xs font-normal text-slate-500">({b.bookerRole})</span></p>
                    <p className="text-xs text-slate-600 mt-1">{b.date} • {b.startTime} - {b.endTime}</p>
                    <p className="text-xs text-slate-500 italic mt-1">"{b.purpose}"</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 sm:flex-col sm:items-end">
                    <button onClick={() => handleOpenApprove(b)} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Setujui
                    </button>
                    <button onClick={() => handleOpenReject(b)} className="px-4 py-2 rounded-lg bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Tolak
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'tabel' && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Alat</th>
                    <th className="py-3 px-4">Peminjam</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableBookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{b.date}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{b.startTime} - {b.endTime}</td>
                      <td className="py-3 px-4 font-bold text-indigo-600">{b.equipmentName}</td>
                      <td className="py-3 px-4 text-slate-800">{b.bookerName}</td>
                      <td className="py-3 px-4 text-slate-500">{b.className}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getStatusColor(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {tableBookings.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">Belum ada jadwal.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'kalender' && <BookingCalendarModule embedded />}

        {activeTab === 'katalog' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment.map(eq => (
              <div key={eq.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-sm font-extrabold text-slate-900">{eq.name}</h4>
                <button onClick={() => handleOpenBooking(eq)} className="w-full py-2 rounded-xl bg-indigo-500 text-white font-bold text-xs">
                  Booking Alat Ini (Guru)
                </button>
              </div>
            ))}
          </div>
        )}

        {/* MODAL APPROVE (Guru atur jam) */}
        {isApproveModalOpen && approvingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleConfirmApprove} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Setujui / Atur Jam</h3>
              <div className="p-3 rounded-xl bg-slate-50 border text-xs">
                <p className="font-bold">{approvingBooking.equipmentName} - {approvingBooking.className}</p>
                <p className="text-slate-500">Asli: {approvingBooking.startTime} - {approvingBooking.endTime}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={approveStart} onChange={e => setApproveStart(e.target.value)} className="px-3 py-2 border rounded-xl" />
                <input type="time" value={approveEnd} onChange={e => setApproveEnd(e.target.value)} className="px-3 py-2 border rounded-xl" />
              </div>
              {approveError && <p className="text-xs text-rose-600 font-bold">{approveError}</p>}
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-500 text-white font-bold text-xs rounded-xl">Setujui</button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL REJECT */}
        {isRejectModalOpen && rejectingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSubmitReject} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Tolak Booking</h3>
              <input type="text" required value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan..." className="w-full px-3 py-2 border rounded-xl text-xs" />
              <textarea required value={rejectGuidance} onChange={e => setRejectGuidance(e.target.value)} placeholder="Arahan untuk siswa..." className="w-full px-3 py-2 border rounded-xl text-xs" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl">Tolak</button>
              </div>
            </form>
          </div>
        )}
        
        {/* MODAL SETTINGS */}
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSaveSettings} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Atur Lead Time Minimal</h3>
              <input type="number" min="2" max="30" value={settingsMinLead} onChange={e => setSettingsMinLead(Math.max(2, parseInt(e.target.value)||2))} className="w-full px-3 py-2 border rounded-xl text-center text-xl font-bold" />
              <p className="text-xs text-amber-600 font-bold">🔒 Minimal H-2 (Tidak dapat diturunkan).</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">Simpan</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // =========================================
  // RENDER: MODE PEMINJAM (SISWA, PIMPROD, SUTRADARA, DLL)
  // =========================================
  return (
    <div className="space-y-6">
      {/* Header Peminjam */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Music className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Peminjaman Alat Musik
            </span>
            <h2 className="text-xl font-black text-white mt-1">Katalog & Booking</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {equipment.length} alat tersedia • Minimal <strong>H-{minLeadDays}</strong> • Maks <strong>1 jam</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ✅ REMINDER KHUSUS KOOR MUSIK DI TAHAP PERSIAPAN */}
      {user?.role === 'Koordinator Tata Musik' && stageConfig?.currentStage === 'PERSIAPAN' && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3 shadow-sm">
          <Bell className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
          <div>
            <h4 className="text-sm font-extrabold text-amber-900">Pengingat Tata Musik (Persiapan)</h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Anda sedang di tahap **Persiapan**. Pastikan Anda telah membooking alat musik yang dibutuhkan untuk latihan. 
              Peminjaman dibatasi **maks 1 jam per booking**. Jika butuh waktu lebih lama, silakan buat booking terpisah di jam yang berbeda.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Peminjam */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setActiveTab('katalog')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
          Katalog Alat ({equipment.length})
        </button>
        <button onClick={() => setActiveTab('saya')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'saya' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}>
          Booking Saya ({myBookings.length})
        </button>
      </div>

      {/* Katalog */}
      {activeTab === 'katalog' && (
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Cari alat musik..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
            </div>
            <button onClick={openAddEquipment} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Tambah Alat
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment.map(eq => (
              <div key={eq.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{eq.name}</h4>
                    <p className="text-[10px] text-slate-500">{eq.category}</p>
                  </div>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className={`px-2 py-0.5 rounded border font-bold ${getConditionColor(eq.condition)}`}>
                    {eq.condition}
                  </span>
                  <span className="font-bold text-slate-600">Qty: {eq.quantity}</span>
                </div>
                <button onClick={() => handleOpenBooking(eq)} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition">
                  Booking Alat Ini
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Booking Saya */}
      {activeTab === 'saya' && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              Belum ada booking.
            </div>
          ) : (
            myBookings.map(b => (
              <div key={b.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(b.status)}`}>
                        {b.status}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{b.equipmentName}</span>
                    </div>
                    <p className="text-xs text-slate-600">{b.date} • {b.startTime} - {b.endTime}</p>
                    <p className="text-xs italic text-slate-500 mt-1">"{b.purpose}"</p>
                  </div>
                  {b.bookedBy === user?.uid && (
                    <button onClick={() => handleDeleteBooking(b)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL BOOKING */}
      {isBookingOpen && selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900">Booking {selectedEquipment.name}</h3>
            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <input type="date" required value={bookDate} min={minBookingDate} onChange={(e) => setBookDate(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <div className="grid grid-cols-2 gap-3">
                <input type="time" required value={bookStart} onChange={(e) => setBookStart(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
                <input type="time" required value={bookEnd} onChange={(e) => setBookEnd(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              </div>
              <textarea rows={3} required value={bookPurpose} onChange={(e) => setBookPurpose(e.target.value)} placeholder="Keperluan..." className="w-full p-3 rounded-xl border border-slate-200 text-xs" />
              
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsBookingOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-500 text-white font-bold text-xs">Ajukan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH ALAT */}
      {isEquipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-3">
            <h3 className="text-base font-extrabold text-slate-900">Tambah Alat Musik Manual</h3>
            <form onSubmit={handleSaveEquipment} className="space-y-3">
              <input type="text" required value={eqName} onChange={(e) => setEqName(e.target.value)} placeholder="Nama Alat" className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <input type="number" required value={eqQuantity} onChange={(e) => setEqQuantity(parseInt(e.target.value)||1)} placeholder="Qty" className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsEquipmentModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};