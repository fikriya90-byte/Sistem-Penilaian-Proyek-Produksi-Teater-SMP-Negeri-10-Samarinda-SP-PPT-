import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Package, Plus, X, Save, CheckCircle, XCircle,
  AlertTriangle, Search, Music, Trash2, Edit3, Info,
  Settings as SettingsIcon, Send, ShieldAlert, Building2, User as UserIcon,
  Table, Bell, MapPin, RefreshCw
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
const MAX_BOOKING_MINUTES = 60;

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

const MUSIC_CATEGORIES = [
  'Alat Musik Tradisional',
  'Alat Musik Modern',
  'Aksesoris & Perlengkapan Musik',
  'Lainnya',
];

// ✅ ALAT DEFAULT (Sesuai instruksi)
const DEFAULT_INSTRUMENTS: Omit<Equipment, 'id' | 'classId'>[] = [
  { name: 'Gambus', category: 'Alat Musik Tradisional', quantity: 1, condition: 'BAIK', notes: 'Alat musik petik khas Kalimantan' },
  { name: 'Babun', category: 'Alat Musik Tradisional', quantity: 1, condition: 'BAIK', notes: 'Gendang tradisional Kalimantan' },
  { name: 'Gong', category: 'Alat Musik Tradisional', quantity: 2, condition: 'BAIK', notes: 'Gong untuk pementasan' },
  { name: 'Stand Gong & Pemukul', category: 'Aksesoris & Perlengkapan Musik', quantity: 1, condition: 'BAIK', notes: 'Stand besi dan pemukul gong' },
];

const VERIFIER_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'
];

const REJECTION_TEMPLATES = (minLeadDays: number) => [
  { label: `Minimal H-${minLeadDays}`, reason: 'Tanggal terlalu dekat', guidance: `Booking minimal ${minLeadDays} hari sebelum peminjaman.` },
  { label: 'Sedang dipakai latihan', reason: 'Dipakai latihan', guidance: 'Silakan pilih tanggal lain.' },
  { label: 'Rusak / perawatan', reason: 'Rusak / perawatan', guidance: 'Alat tidak dapat dipinjam.' },
  { label: 'Bentrok Gladi/Pementasan', reason: 'Bentrok jadwal', guidance: 'Prioritas untuk Gladi/Pementasan.' },
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

  const isVerifier = !!user && VERIFIER_ROLES.includes(user.role);
  const [activeTab, setActiveTab] = useState<string>(isVerifier ? 'pending' : 'katalog');

  // Modals & Forms
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [eqName, setEqName] = useState('');
  const [eqCategory, setEqCategory] = useState<string>('Alat Musik Tradisional');
  const [eqQuantity, setEqQuantity] = useState(1);
  const [eqCondition, setEqCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'>('BAIK');
  const [eqNotes, setEqNotes] = useState('');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectGuidance, setRejectGuidance] = useState('');

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvingBooking, setApprovingBooking] = useState<Booking | null>(null);
  const [approveStart, setApproveStart] = useState('');
  const [approveEnd, setApproveEnd] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [approveError, setApproveError] = useState('');

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsMinLead, setSettingsMinLead] = useState(2);

  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookStart, setBookStart] = useState('14:00');
  const [bookEnd, setBookEnd] = useState('15:00');
  const [bookPurpose, setBookPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const minLeadDays = settings.minLeadDays;
  const minBookingDate = calculateMinDate(minLeadDays);

  useEffect(() => {
    if (!activeClass) return;
    (async () => {
      try {
        const ref = doc(db, 'classes', activeClass.id, 'config', 'booking');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const loadedMin = Math.max(2, Number(data.minLeadDays ?? 2));
          setSettings({ minLeadDays: loadedMin });
          setSettingsMinLead(loadedMin);
        }
      } catch (err) { console.warn('Load settings error:', err); }
    })();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = onSnapshot(doc(db, 'classes', activeClass.id, 'config', 'stageManager'), snap => {
      if (snap.exists()) setStageConfig(snap.data());
    });
    return () => unsub();
  }, [activeClass]);

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

  useEffect(() => {
    if (!activeClass) return;
    let qBk;
    if (isVerifier) {
      const classIds = classes.map(c => c.id);
      qBk = classIds.length > 0 && classIds.length <= 30
        ? query(collection(db, 'bookings'), where('classId', 'in', classIds))
        : query(collection(db, 'bookings'));
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

  // ============== HANDLERS ==============
  const handleResetCatalog = async () => {
    if (!user || !activeClass) return;
    if (!confirm('Hapus SEMUA alat di katalog dan ganti dengan 4 alat default (Gambus, Babun, Gong, Stand Gong)?')) return;
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      equipment.forEach(eq => batch.delete(doc(db, 'equipment', eq.id)));
      
      DEFAULT_INSTRUMENTS.forEach(eq => {
        const newRef = doc(collection(db, 'equipment'));
        batch.set(newRef, {
          id: newRef.id, classId: activeClass.id, isCustom: false, ...eq,
        });
      });
      
      await batch.commit();
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'Equipment', targetId: activeClass.id,
        details: `Reset katalog ke default (Gambus, Babun, Gong, Stand)`,
      });
      showToast('Katalog berhasil di-reset ke default.', 'success');
    } catch (err: any) {
      showToast('Gagal reset: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

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
      showToast(`Aturan disimpan: minimal H-${settingsMinLead}.`, 'success');
      setIsSettingsModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const openAddEquipment = () => {
    setEqName(''); setEqCategory('Alat Musik Tradisional'); setEqQuantity(1); setEqCondition('BAIK'); setEqNotes(''); setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!eqName.trim()) { showToast('Nama alat musik wajib.', 'warning'); return; }
    
    const exists = equipment.some(e => e.name.toLowerCase() === eqName.trim().toLowerCase());
    if (exists) { showToast(`Alat "${eqName}" sudah ada di katalog.`, 'warning'); return; }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'equipment'));
      await setDoc(newRef, {
        id: newRef.id, classId: activeClass.id, name: eqName.trim(), category: eqCategory, quantity: eqQuantity,
        condition: eqCondition, notes: eqNotes.trim(), isCustom: true, addedByName: user.displayName,
      });
      showToast(`Alat musik "${eqName}" ditambahkan.`, 'success');
      setIsEquipmentModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteEquipment = async (eq: Equipment) => {
    if (!user) return;
    if (!(isVerifier || eq.addedByName === user.displayName)) {
      showToast('Tidak berwenang menghapus.', 'warning'); return;
    }
    if (!confirm(`Hapus alat "${eq.name}" dari katalog?`)) return;
    try {
      await deleteDoc(doc(db, 'equipment', eq.id));
      showToast('Alat dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleOpenBooking = (eq: Equipment) => {
    setSelectedEquipment(eq); setBookDate(minBookingDate); setBookStart('14:00'); setBookEnd('15:00'); setBookPurpose(''); setIsBookingOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !selectedEquipment) return;
    if (!bookPurpose.trim()) { showToast('Isi keperluan booking.', 'warning'); return; }

    const dur = getDurationMinutes(bookStart, bookEnd);
    if (dur <= 0) { showToast('Jam selesai harus > jam mulai.', 'warning'); return; }
    if (dur > MAX_BOOKING_MINUTES) { showToast(`Maksimal ${formatDuration(MAX_BOOKING_MINUTES)} per booking.`, 'error'); return; }

    const diff = daysDifference(new Date().toISOString().slice(0, 10), bookDate);
    if (diff < minLeadDays) { showToast(`Booking minimal H-${minLeadDays}.`, 'error'); return; }

    const existing = bookings.filter(b => b.equipmentId === selectedEquipment.id && b.date === bookDate && b.status !== 'REJECTED');
    for (const b of existing) {
      if (bookStart < b.endTime && bookEnd > b.startTime) { showToast(`Bentrok dengan ${b.bookerName} (${b.startTime}-${b.endTime}).`, 'error'); return; }
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'bookings'));
      await setDoc(newRef, {
        id: newRef.id, classId: activeClass.id, className: activeClass.name, equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name, equipmentCategory: selectedEquipment.category, bookedBy: user.uid,
        bookerName: user.displayName, bookerRole: user.role, bookerDivision: user.divisionName || '',
        date: bookDate, startTime: bookStart, endTime: bookEnd, purpose: bookPurpose.trim(), status: 'PENDING', createdAt: new Date().toISOString(),
      } as Booking);
      showToast('Booking diajukan!', 'success');
      setIsBookingOpen(false); setSelectedEquipment(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleOpenApprove = (b: Booking) => {
    setApprovingBooking(b); setApproveStart(b.startTime); setApproveEnd(b.endTime); setApproveNote(''); setApproveError(''); setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !approvingBooking || !isVerifier) return;

    const dur = getDurationMinutes(approveStart, approveEnd);
    if (dur <= 0) { setApproveError('Jam selesai harus > jam mulai.'); return; }
    if (dur > MAX_BOOKING_MINUTES) { setApproveError(`Maksimal 1 jam.`); return; }

    const conflicting = bookings.filter(b => b.id !== approvingBooking.id && b.equipmentId === approvingBooking.equipmentId && b.date === approvingBooking.date && b.status === 'APPROVED').find(b => approveStart < b.endTime && approveEnd > b.startTime);
    if (conflicting) { setApproveError(`Bentrok dengan ${conflicting.bookerName}.`); return; }

    setApproveError(''); setSubmitting(true);
    try {
      const wasRescheduled = approveStart !== approvingBooking.startTime || approveEnd !== approvingBooking.endTime;
      await updateDoc(doc(db, 'bookings', approvingBooking.id), {
        status: 'APPROVED', startTime: approveStart, endTime: approveEnd, approvedBy: user.displayName,
        approvedAt: new Date().toISOString(), verifierNote: approveNote.trim() || null,
        originalStartTime: approvingBooking.startTime, originalEndTime: approvingBooking.endTime, wasRescheduledByVerifier: wasRescheduled,
      });
      showToast('Booking disetujui.', 'success'); setIsApproveModalOpen(false); setApprovingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectingBooking || !isVerifier) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'bookings', rejectingBooking.id), {
        status: 'REJECTED', approvedBy: user.displayName, approvedAt: new Date().toISOString(),
        rejectionReason: rejectReason.trim(), rejectionGuidance: rejectGuidance.trim(),
      });
      showToast('Booking ditolak.', 'success'); setIsRejectModalOpen(false); setRejectingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    if (!user || !(booking.bookedBy === user.uid || isVerifier)) return;
    if (!confirm(`Hapus booking "${booking.equipmentName}"?`)) return;
    try { await deleteDoc(doc(db, 'bookings', booking.id)); showToast('Booking dihapus.', 'info'); }
    catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ============== DATA FILTERS ==============
  const filteredEquipment = equipment.filter(eq => {
    if (filterCategory !== 'ALL' && eq.category !== filterCategory) return false;
    if (searchQuery.trim()) return eq.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const myBookings = bookings.filter(b => b.bookedBy === user?.uid);
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');
  const allBookingsFiltered = bookings.filter(b => filterClass === 'ALL' || b.classId === filterClass);

  const tableBookings = useMemo(() => {
    return [...bookings].filter(b => b.status !== 'REJECTED').sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [bookings]);

  const getConditionColor = (cond: string) => {
    if (cond === 'BAIK') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (cond === 'RUSAK_RINGAN') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
  };

  const getStatusColor = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (status === 'REJECTED') return 'bg-rose-100 text-rose-800 border-rose-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
  };

  // =========================================
  // RENDER: VERIFIKATOR (GURU / ADMIN)
  // =========================================
  if (isVerifier) {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-800 text-white shadow-xl border border-emerald-500/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldAlert className="w-7 h-7" />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">Panel Guru / Admin</span>
                <h2 className="text-xl font-black text-white mt-1">Verifikasi Booking</h2>
                <p className="text-xs text-slate-300 mt-0.5">{pendingBookings.length} menunggu • H-{minLeadDays} • Maks 1 jam</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleResetCatalog} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                <RefreshCw className="w-3.5 h-3.5" /> Reset Katalog
              </button>
              <button onClick={() => { setSettingsMinLead(minLeadDays); setIsSettingsModalOpen(true); }} className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                <SettingsIcon className="w-3.5 h-3.5" /> Atur H-{minLeadDays}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'pending' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border'}`}>Perlu Verifikasi ({pendingBookings.length})</button>
          <button onClick={() => setActiveTab('tabel')} className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'tabel' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}><Table className="w-3.5 h-3.5" /> Tabel Jadwal</button>
          <button onClick={() => setActiveTab('kalender')} className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'kalender' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}><Calendar className="w-3.5 h-3.5" /> Kalender</button>
          <button onClick={() => setActiveTab('katalog')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>Katalog & Pinjam</button>
        </div>

        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingBookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border"><CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" /><h3 className="font-bold">Tidak Ada Antrean</h3></div>
            ) : pendingBookings.map(b => (
              <div key={b.id} className="p-4 rounded-2xl bg-white border-2 shadow-sm flex justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{b.bookerName} ({b.className})</p>
                  <p className="text-xs text-slate-600 mt-1">{b.equipmentName} • {b.date} ({b.startTime}-{b.endTime})</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenApprove(b)} className="px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-bold">Setujui</button>
                  <button onClick={() => { setRejectingBooking(b); setRejectReason(''); setRejectGuidance(''); setIsRejectModalOpen(true); }} className="px-3 py-1.5 bg-rose-500 text-white rounded text-xs font-bold">Tolak</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tabel' && (
          <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b"><tr><th className="p-3">Tanggal</th><th className="p-3">Waktu</th><th className="p-3">Alat</th><th className="p-3">Peminjam</th><th className="p-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {tableBookings.map(b => (
                  <tr key={b.id}><td className="p-3 font-bold">{b.date}</td><td className="p-3 font-mono">{b.startTime}-{b.endTime}</td><td className="p-3 text-indigo-600 font-bold">{b.equipmentName}</td><td className="p-3">{b.bookerName} ({b.className})</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(b.status)}`}>{b.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'kalender' && <BookingCalendarModule embedded />}

        {activeTab === 'katalog' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment.map(eq => (
              <div key={eq.id} className="p-4 rounded-2xl bg-white border shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div><h4 className="font-bold">{eq.name}</h4><p className="text-[10px] text-slate-500">{eq.category} (Qty: {eq.quantity})</p></div>
                  <button onClick={() => handleDeleteEquipment(eq)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
                <button onClick={() => handleOpenBooking(eq)} className="w-full py-2 bg-indigo-500 text-white rounded font-bold text-xs">Booking Alat Ini</button>
              </div>
            ))}
          </div>
        )}

        {isApproveModalOpen && approvingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleConfirmApprove} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Setujui / Atur Jam</h3>
              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={approveStart} onChange={e => setApproveStart(e.target.value)} className="px-3 py-2 border rounded-xl" />
                <input type="time" value={approveEnd} onChange={e => setApproveEnd(e.target.value)} className="px-3 py-2 border rounded-xl" />
              </div>
              {approveError && <p className="text-xs text-rose-600 font-bold">{approveError}</p>}
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button><button type="submit" className="px-5 py-2 bg-emerald-500 text-white font-bold text-xs rounded-xl">Setujui</button></div>
            </form>
          </div>
        )}

        {isRejectModalOpen && rejectingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSubmitReject} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Tolak Booking</h3>
              <input type="text" required value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan..." className="w-full px-3 py-2 border rounded-xl text-xs" />
              <textarea required value={rejectGuidance} onChange={e => setRejectGuidance(e.target.value)} placeholder="Arahan..." className="w-full px-3 py-2 border rounded-xl text-xs" />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button><button type="submit" className="px-5 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl">Tolak</button></div>
            </form>
          </div>
        )}

        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSaveSettings} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Atur Minimal Lead Time (H-)</h3>
              <input type="number" min="2" max="30" value={settingsMinLead} onChange={e => setSettingsMinLead(Math.max(2, parseInt(e.target.value)||2))} className="w-full px-3 py-2 border rounded-xl text-center text-xl font-bold" />
              <p className="text-xs text-amber-600 font-bold">🔒 Minimal H-2 (Tidak dapat diturunkan).</p>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button><button type="submit" className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">Simpan</button></div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // =========================================
  // RENDER: PEMINJAM (SISWA, PIMPROD, SUTRADARA, DLL)
  // =========================================
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Music className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">Peminjaman Alat</span>
            <h2 className="text-xl font-black text-white mt-1">Katalog & Jadwal</h2>
            <p className="text-xs text-slate-300 mt-0.5">{equipment.length} alat tersedia • H-{minLeadDays} • Maks 1 Jam</p>
          </div>
        </div>
      </div>

      {user?.role === 'Koordinator Tata Musik' && stageConfig?.currentStage === 'PERSIAPAN' && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3 shadow-sm">
          <Bell className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
          <div>
            <h4 className="text-sm font-extrabold text-amber-900">Pengingat Tata Musik (Persiapan)</h4>
            <p className="text-xs text-amber-800 mt-1">Pastikan Anda telah membooking alat musik. Peminjaman maks 1 jam per booking.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setActiveTab('katalog')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>Katalog Alat ({equipment.length})</button>
        <button onClick={() => setActiveTab('jadwal')} className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'jadwal' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}><Table className="w-3.5 h-3.5" /> Jadwal Peminjaman</button>
        <button onClick={() => setActiveTab('saya')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'saya' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>Booking Saya ({myBookings.length})</button>
      </div>

      {activeTab === 'katalog' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input type="text" placeholder="Cari alat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-semibold" /></div>
            <button onClick={openAddEquipment} className="px-4 py-2 rounded-xl bg-amber-500 font-bold text-xs flex items-center justify-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Tambah Alat</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment.map(eq => (
              <div key={eq.id} className="p-4 rounded-2xl bg-white border shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div><h4 className="font-bold">{eq.name}</h4><p className="text-[10px] text-slate-500">{eq.category}</p></div>
                  {(isVerifier || eq.addedByName === user?.displayName) && (<button onClick={() => handleDeleteEquipment(eq)} className="text-rose-500 p-1"><Trash2 className="w-4 h-4" /></button>)}
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className={`px-2 py-0.5 rounded border font-bold ${getConditionColor(eq.condition)}`}>{eq.condition}</span>
                  <span className="font-bold">Qty: {eq.quantity}</span>
                </div>
                <button onClick={() => handleOpenBooking(eq)} className="w-full py-2 bg-indigo-500 text-white rounded-xl font-bold text-xs">Booking Alat Ini</button>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'jadwal' && (
        <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b"><tr><th className="p-3">Tanggal</th><th className="p-3">Waktu</th><th className="p-3">Alat</th><th className="p-3">Peminjam</th><th className="p-3">Kelas</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tableBookings.map(b => (
                <tr key={b.id}><td className="p-3 font-bold">{b.date}</td><td className="p-3 font-mono">{b.startTime}-{b.endTime}</td><td className="p-3 text-indigo-600 font-bold">{b.equipmentName}</td><td className="p-3">{b.bookerName}</td><td className="p-3 text-slate-500">{b.className}</td></tr>
              ))}
              {tableBookings.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-slate-400">Belum ada jadwal.</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'saya' && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (<div className="p-12 text-center bg-white border rounded-3xl text-slate-400 text-xs">Belum ada booking.</div>) : myBookings.map(b => (
            <div key={b.id} className="p-4 rounded-2xl bg-white border shadow-sm flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(b.status)}`}>{b.status}</span>
                <p className="font-bold text-sm mt-1">{b.equipmentName}</p>
                <p className="text-xs text-slate-500">{b.date} • {b.startTime}-{b.endTime}</p>
              </div>
              {b.bookedBy === user?.uid && <button onClick={() => handleDeleteBooking(b)} className="text-rose-500 p-1"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      )}

      {isBookingOpen && selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Booking {selectedEquipment.name}</h3>
            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <input type="date" required value={bookDate} min={minBookingDate} onChange={(e) => setBookDate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs" />
              <div className="grid grid-cols-2 gap-3"><input type="time" required value={bookStart} onChange={(e) => setBookStart(e.target.value)} className="px-3 py-2 border rounded-xl text-xs" /><input type="time" required value={bookEnd} onChange={(e) => setBookEnd(e.target.value)} className="px-3 py-2 border rounded-xl text-xs" /></div>
              <textarea rows={3} required value={bookPurpose} onChange={(e) => setBookPurpose(e.target.value)} placeholder="Keperluan..." className="w-full p-3 border rounded-xl text-xs" />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsBookingOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button><button type="submit" className="px-5 py-2 bg-indigo-500 text-white rounded-xl font-bold text-xs">Ajukan</button></div>
            </form>
          </div>
        </div>
      )}

      {isEquipmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-3">
            <h3 className="text-base font-extrabold text-slate-900">Tambah Alat</h3>
            <form onSubmit={handleSaveEquipment} className="space-y-3">
              <input type="text" required value={eqName} onChange={(e) => setEqName(e.target.value)} placeholder="Nama Alat" className="w-full px-3 py-2 border rounded-xl text-xs" />
              <input type="number" required value={eqQuantity} onChange={(e) => setEqQuantity(parseInt(e.target.value)||1)} placeholder="Qty" className="w-full px-3 py-2 border rounded-xl text-xs" />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsEquipmentModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button><button type="submit" className="px-5 py-2 bg-amber-500 rounded-xl font-bold text-xs">Simpan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};