import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, Package, Plus, X, Save, CheckCircle, XCircle,
  AlertTriangle, Search, Music, Trash2, Edit3, Info,
  Settings as SettingsIcon, Send, ShieldAlert, Building2, User as UserIcon,
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
  addedByName?: string; // ✅ siapa yang tambah manual
}

interface Booking {
  id: string;
  classId: string;
  className: string;          // ✅ NEW: untuk verifikator lihat kelas asal
  equipmentId: string;
  equipmentName: string;
  equipmentCategory: string;  // ✅ NEW: kategori alat
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
  createdAt: string;
}

interface BookingSettings {
  minLeadDays: number;
}

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

// ✅ ROLES YANG HANYA VERIFIKASI
const VERIFIER_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
  'Pimpinan Produksi', 'Koordinator Tata Musik',
];

const REJECTION_TEMPLATES = (minLeadDays: number) => [
  {
    label: `Booking minimal H-${minLeadDays} (${minLeadDays} hari sebelum peminjaman)`,
    reason: 'Tanggal terlalu dekat dengan hari ini',
    guidance: `Sesuai aturan, booking alat musik harus diajukan minimal ${minLeadDays} hari sebelum tanggal peminjaman. Silakan ajukan ulang dengan tanggal yang lebih jauh (H-${minLeadDays} ke atas).`,
  },
  {
    label: 'Alat musik sedang dipakai latihan',
    reason: 'Alat musik sedang dipakai untuk latihan rutin',
    guidance: 'Alat sedang dipinjam divisi lain untuk latihan. Silakan pilih tanggal lain atau koordinasikan dengan Koordinator Tata Musik.',
  },
  {
    label: 'Alat musik rusak / perawatan',
    reason: 'Alat musik sedang dalam perawatan atau rusak',
    guidance: 'Alat tidak dapat dipinjam sampai selesai perbaikan. Silakan hubungi Koordinator Tata Musik untuk informasi ketersediaan alat pengganti.',
  },
  {
    label: 'Bentrok dengan Gladi Resik / Pementasan',
    reason: 'Bentrok dengan jadwal Gladi Resik / Pementasan',
    guidance: 'Alat musik diprioritaskan untuk Gladi Resik & Pementasan utama. Silakan pilih tanggal lain di luar jadwal tersebut.',
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
  const [filterClass, setFilterClass] = useState<string>('ALL'); // untuk verifikator
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // ✅ Tentukan peran
  const isVerifier = !!user && VERIFIER_ROLES.includes(user.role);
  
  // Default tab berdasarkan peran
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

  // Modal settings
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsMinLead, setSettingsMinLead] = useState(2);

  // Form booking
  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookStart, setBookStart] = useState('14:00');
  const [bookEnd, setBookEnd] = useState('16:00');
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
          setSettings({ minLeadDays: data.minLeadDays ?? 2 });
          setSettingsMinLead(data.minLeadDays ?? 2);
        }
      } catch (err) { console.warn('Load settings error:', err); }
    })();
  }, [activeClass]);

  // Subscribe equipment (per active class)
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

  // ✅ Subscribe bookings — berbeda untuk siswa vs verifikator
  useEffect(() => {
    if (!activeClass) return;

    let qBk;
    if (isVerifier) {
      // Verifikator: lihat SEMUA booking dari semua kelas yang mereka ajar
      const classIds = classes.map(c => c.id);
      if (classIds.length > 0 && classIds.length <= 30) {
        qBk = query(collection(db, 'bookings'), where('classId', 'in', classIds));
      } else {
        qBk = query(collection(db, 'bookings'));
      }
    } else {
      // Siswa: hanya booking kelas sendiri
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
      showToast(`Aturan disimpan: minimal H-${settingsMinLead}.`, 'success');
      setIsSettingsModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ============== SISWA: TAMBAH ALAT MANUAL ==============
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

    // Cek duplikat nama
    const exists = equipment.some(e => e.name.toLowerCase() === eqName.trim().toLowerCase());
    if (exists) {
      showToast(`Alat "${eqName}" sudah ada di katalog. Pilih dari daftar.`, 'warning');
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
        details: `Siswa tambah alat musik manual: ${eqName}`,
      });
      showToast(`Alat musik "${eqName}" ditambahkan ke katalog.`, 'success');
      setIsEquipmentModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // ============== SISWA: BOOKING ==============
  const handleOpenBooking = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setBookDate(minBookingDate);
    setBookStart('14:00'); setBookEnd('16:00'); setBookPurpose('');
    setIsBookingOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !selectedEquipment) return;
    if (!bookPurpose.trim()) { showToast('Isi keperluan booking.', 'warning'); return; }
    if (bookStart >= bookEnd) { showToast('Jam selesai harus > jam mulai.', 'warning'); return; }

    const diff = daysDifference(new Date().toISOString().slice(0, 10), bookDate);
    if (diff < minLeadDays) {
      showToast(`Booking minimal H-${minLeadDays}. Tanggal yang Anda pilih hanya ${diff} hari lagi.`, 'error');
      return;
    }

    // Cek bentrok
    const existing = bookings.filter(b =>
      b.equipmentId === selectedEquipment.id && b.date === bookDate && b.status !== 'REJECTED'
    );
    for (const b of existing) {
      if (bookStart < b.endTime && bookEnd > b.startTime) {
        showToast(`Bentrok dengan booking ${b.bookerName} (${b.startTime}-${b.endTime})`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'bookings'));
      await setDoc(newRef, {
        id: newRef.id,
        classId: activeClass.id,
        className: activeClass.name, // ✅ untuk verifikator
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
          message: `${user.displayName} (${activeClass.name}) mengajukan booking "${selectedEquipment.name}" untuk ${bookDate} (${bookStart}-${bookEnd}). Mohon diverifikasi.`,
          category: 'Tugas', link: 'booking', senderName: user.displayName,
        });
      } catch { /* non-fatal */ }

      showToast('Booking diajukan! Menunggu verifikasi guru.', 'success');
      setIsBookingOpen(false);
      setSelectedEquipment(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // ============== VERIFIKATOR: APPROVE / REJECT ==============
  const handleApprove = async (booking: Booking) => {
    if (!user || !isVerifier) return;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'APPROVED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'Booking', targetId: booking.id,
        details: `Setujui booking ${booking.equipmentName} dari ${booking.className}`,
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id, userId: booking.bookedBy, classId: booking.classId,
        title: '✅ Booking Alat Musik Disetujui',
        message: `${user.displayName} menyetujui booking "${booking.equipmentName}" untuk ${booking.date}. Alat siap dipinjam.`,
        category: 'Feedback', read: false, link: 'booking',
        createdAt: new Date().toISOString(),
      });
      showToast('Booking disetujui.', 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
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
        details: `Tolak booking ${rejectingBooking.equipmentName} dari ${rejectingBooking.className}: ${rejectReason}`,
      });

      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id, userId: rejectingBooking.bookedBy, classId: rejectingBooking.classId,
        title: '❌ Booking Alat Musik Ditolak',
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
    if (!(booking.bookedBy === user.uid || isVerifier)) {
      showToast('Tidak berwenang.', 'warning'); return;
    }
    if (!confirm(`Hapus booking "${booking.equipmentName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      showToast('Booking dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ============== FILTER ==============
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

  // =========================================
  // RENDER: MODE VERIFIKATOR (GURU/ADMIN/PIMPOD/KOOR MUSIK)
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
                  Verifikasi Booking
                </span>
                <h2 className="text-xl font-black text-white mt-1">Panel Verifikasi</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {pendingBookings.length} booking menunggu • Aturan: minimal H-{minLeadDays}
                </p>
              </div>
            </div>
            <button onClick={() => { setSettingsMinLead(minLeadDays); setIsSettingsModalOpen(true); }}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
              <SettingsIcon className="w-4 h-4" /> Atur Lead Time (H-{minLeadDays})
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
            Lihat semua pengajuan booking dari semua kelas. Klik <strong>Setujui</strong> atau <strong>Tolak</strong> (dengan arahan). Siswa akan menerima notifikasi otomatis.
          </p>
        </div>

        {/* Tabs Verifikator */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'pending' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
            Perlu Verifikasi ({pendingBookings.length})
          </button>
          <button onClick={() => setActiveTab('semua')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'semua' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
            Semua Booking ({bookings.length})
          </button>
        </div>

        {/* Filter Kelas (untuk tab 'semua') */}
        {activeTab === 'semua' && classes.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white">
              <option value="ALL">Semua Kelas</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {/* List Booking (Verifikator) */}
        <div className="space-y-3">
          {(activeTab === 'pending' ? pendingBookings : allBookingsFiltered).length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                {activeTab === 'pending' ? 'Tidak Ada Booking Menunggu' : 'Belum Ada Booking'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeTab === 'pending' ? 'Semua booking sudah diverifikasi.' : 'Belum ada siswa yang mengajukan booking.'}
              </p>
            </div>
          ) : (
            (activeTab === 'pending' ? pendingBookings : allBookingsFiltered).map(b => {
              const daysLeft = daysDifference(new Date().toISOString().slice(0, 10), b.date);
              return (
                <div key={b.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Header info: status + kelas + alat */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusColor(b.status)}`}>
                          {b.status === 'PENDING' ? 'MENUNGGU' : b.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5" /> {b.className || 'Kelas'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <Music className="w-2.5 h-2.5" /> {b.equipmentName}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${daysLeft < minLeadDays ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          H-{daysLeft}
                        </span>
                      </div>

                      {/* Peminjam */}
                      <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                        {b.bookerName} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({b.bookerRole})</span>
                      </p>

                      {/* Tanggal & jam */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(b.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b.startTime} - {b.endTime}</span>
                      </div>

                      {/* Keperluan */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                        "{b.purpose}"
                      </p>

                      {/* Rejection info */}
                      {b.status === 'REJECTED' && b.rejectionReason && (
                        <div className="mt-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40">
                          <div className="flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-rose-900 dark:text-rose-200 uppercase">Alasan</p>
                              <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">{b.rejectionReason}</p>
                              {b.rejectionGuidance && (
                                <>
                                  <p className="text-[11px] font-black text-rose-900 dark:text-rose-200 uppercase mt-1.5">Arahan</p>
                                  <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5 italic">"{b.rejectionGuidance}"</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {b.approvedBy && b.status === 'APPROVED' && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Disetujui oleh: {b.approvedBy}
                        </p>
                      )}
                    </div>

                    {/* Tombol aksi */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {b.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleApprove(b)}
                            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                            <CheckCircle className="w-4 h-4" /> Setujui
                          </button>
                          <button onClick={() => handleOpenReject(b)}
                            className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                            <XCircle className="w-4 h-4" /> Tolak
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDeleteBooking(b)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        title="Hapus">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Reject */}
        {isRejectModalOpen && rejectingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSubmitReject} className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-500" /> Tolak & Beri Arahan
                </h3>
                <button type="button" onClick={() => setIsRejectModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Booking yang Ditolak:</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" /> {rejectingBooking.equipmentName}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {rejectingBooking.className} • {rejectingBooking.bookerName}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {rejectingBooking.date} ({rejectingBooking.startTime}-{rejectingBooking.endTime})
                </p>
              </div>

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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Alasan Penolakan <span className="text-rose-500">*</span></label>
                <input type="text" required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Tanggal terlalu dekat"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Arahan untuk Siswa <span className="text-rose-500">*</span></label>
                <textarea rows={3} required value={rejectGuidance} onChange={(e) => setRejectGuidance(e.target.value)}
                  placeholder="Contoh: Silakan ajukan ulang dengan tanggal minimal 2 hari sebelum peminjaman..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> {submitting ? 'Menolak...' : 'Tolak & Kirim Arahan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Settings */}
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSaveSettings} className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Minimal Lead Time (H-)</label>
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
                  Booking minimal <strong>H-{settingsMinLead}</strong> sebelum tanggal peminjaman.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Simpan
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // =========================================
  // RENDER: MODE SISWA
  // =========================================
  return (
    <div className="space-y-6">
      {/* Header Siswa */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Music className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Booking Alat Musik
            </span>
            <h2 className="text-xl font-black text-white mt-1">Peminjaman Alat Musik</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {equipment.length} alat tersedia • Booking minimal <strong className="text-amber-300">H-{minLeadDays}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
        <Music className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Katalog default:</strong> Babun, Gong, Gambus. Butuh alat lain? Klik <strong>"Tambah Alat Musik"</strong>.
          Pengajuan booking akan diverifikasi oleh Guru/Koordinator Tata Musik.
        </p>
      </div>

      {/* Tabs Siswa */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setActiveTab('katalog')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'katalog' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
          Katalog ({equipment.length})
        </button>
        <button onClick={() => setActiveTab('saya')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${activeTab === 'saya' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
          Booking Saya ({myBookings.length})
        </button>
      </div>

      {/* Katalog (Siswa) */}
      {activeTab === 'katalog' && (
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Cari alat musik... (babun, gong, gambus...)"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white">
              <option value="ALL">Semua Kategori</option>
              {MUSIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={openAddEquipment}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Tambah Alat
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment.map(eq => {
              const activeBookings = bookings.filter(b => b.equipmentId === eq.id && b.status === 'APPROVED' && b.date >= new Date().toISOString().slice(0, 10)).length;
              return (
                <div key={eq.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:shadow-md transition space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shrink-0">
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug flex items-center gap-1.5 flex-wrap">
                        {eq.name}
                        {eq.isCustom && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40">MANUAL</span>}
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
                  {eq.addedByName && eq.isCustom && (
                    <p className="text-[9px] text-purple-600 dark:text-purple-400 italic">Ditambah oleh: {eq.addedByName}</p>
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
                </div>
              );
            })}
          </div>

          {filteredEquipment.length === 0 && (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Music className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Alat Musik</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Katalog default: Babun, Gong, Gambus. Butuh alat lain?
              </p>
              <button onClick={openAddEquipment}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Tambah Alat Musik
              </button>
            </div>
          )}
        </>
      )}

      {/* Booking Saya */}
      {activeTab === 'saya' && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs">
              Belum ada booking. Buka tab Katalog untuk mulai booking.
            </div>
          ) : (
            myBookings.map(b => {
              const daysLeft = daysDifference(new Date().toISOString().slice(0, 10), b.date);
              return (
                <div key={b.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusColor(b.status)}`}>
                          {b.status === 'PENDING' ? 'MENUNGGU' : b.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <Music className="w-2.5 h-2.5" /> {b.equipmentName}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${daysLeft < minLeadDays ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          H-{daysLeft}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {b.date}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b.startTime} - {b.endTime}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic">"{b.purpose}"</p>
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
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Disetujui oleh: {b.approvedBy}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {b.bookedBy === user?.uid && (
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

      {/* Modal Booking */}
      {isBookingOpen && selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Music className="w-5 h-5 text-indigo-500" /> Booking Alat Musik
              </h3>
              <button onClick={() => setIsBookingOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" /> {selectedEquipment.name}
              </p>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-300">{selectedEquipment.category} • Qty: {selectedEquipment.quantity}</p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <p className="font-black">Minimal H-{minLeadDays}</p>
                <p className="mt-0.5">Tanggal paling cepat: <strong>{new Date(minBookingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
              </div>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Pemakaian <span className="text-rose-500">*</span></label>
                <input type="date" required value={bookDate} min={minBookingDate} onChange={(e) => setBookDate(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl border-2 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white ${daysDifference(new Date().toISOString().slice(0, 10), bookDate) < minLeadDays ? 'border-rose-400 dark:border-rose-500/60' : 'border-slate-200 dark:border-slate-700'}`} />
                {daysDifference(new Date().toISOString().slice(0, 10), bookDate) < minLeadDays && (
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Minimal {new Date(minBookingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jam Mulai <span className="text-rose-500">*</span></label>
                  <input type="time" required value={bookStart} onChange={(e) => setBookStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jam Selesai <span className="text-rose-500">*</span></label>
                  <input type="time" required value={bookEnd} onChange={(e) => setBookEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Keperluan <span className="text-rose-500">*</span></label>
                <textarea rows={3} required value={bookPurpose} onChange={(e) => setBookPurpose(e.target.value)}
                  placeholder="Contoh: Latihan musik pengiring adegan perang, butuh babun & gong..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                <Send className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Booking akan <strong>diverifikasi</strong> oleh Guru/Koordinator Tata Musik. Anda akan menerima notifikasi.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsBookingOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={submitting || daysDifference(new Date().toISOString().slice(0, 10), bookDate) < minLeadDays}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {submitting ? 'Mengajukan...' : 'Ajukan Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Alat (SISWA) */}
      {isEquipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" /> Tambah Alat Musik Manual
              </h3>
              <button onClick={() => setIsEquipmentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
              <Music className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>Katalog default:</strong> Babun, Gong, Gambus. Kalau alat yang Anda butuhkan belum ada, tambahkan di sini agar bisa dipinjam semua siswa.
              </p>
            </div>

            <form onSubmit={handleSaveEquipment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Alat Musik <span className="text-rose-500">*</span></label>
                <input type="text" required value={eqName} onChange={(e) => setEqName(e.target.value)}
                  placeholder="Contoh: Sape, Suling, Biola, Ukulele..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori <span className="text-rose-500">*</span></label>
                <select value={eqCategory} onChange={(e) => setEqCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {MUSIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                  placeholder="Contoh: Alat pinjaman dari Bu Guru / ada di gudang sekolah"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsEquipmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {submitting ? 'Menyimpan...' : 'Tambah ke Katalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};