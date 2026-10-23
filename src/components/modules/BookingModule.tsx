// src/components/modules/BookingModule.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Package, Plus, X, Save, CheckCircle, XCircle,
  AlertTriangle, Search, Music, Trash2, Edit3, Info,
  Settings as SettingsIcon, Send, ShieldAlert, Building2, User as UserIcon,
  Table, Bell, MapPin, RefreshCw, MessageCircle, Sparkles, Layers,
  Camera, RotateCcw, BookOpen, CheckSquare, Square, Ban, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc,
  deleteDoc, writeBatch, getDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { BookingCalendarModule } from './BookingCalendarModule';
import { BookingGuideModal } from './BookingGuideModal';
import { PhotoEvidenceUploader, PhotoEvidence, checkPhotoContent } from '../common/PhotoEvidenceUploader';

// ═══════════════════════════════════════════════════════
// TIPE DATA
// ═══════════════════════════════════════════════════════
interface Equipment {
  id: string;
  classId: string;
  name: string;
  category: string;
  quantity: number;
  condition: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';
  notes: string;
  isCustom?: boolean;
  isSchoolWide?: boolean;
  addedByName?: string;
  createdAt?: string;
}

type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CHECKED_OUT' | 'RETURNED' | 'OVERDUE';

interface Booking {
  id: string;
  sessionId: string;
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
  status: BookingStatus;

  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  rejectionGuidance?: string;
  recommendedDate?: string;
  recommendedStartTime?: string;
  recommendedEndTime?: string;

  checkedOutAt?: string;
  checkoutPhotoUrl?: string;
  checkoutNote?: string;

  returnedAt?: string;
  returnPhotoUrl?: string;
  returnCondition?: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';
  returnNote?: string;
  isLateReturn?: boolean;

  cancelledAt?: string;
  cancelledBy?: string;
  cancelledReason?: string;

  verifierNote?: string;
  wasRescheduledByVerifier?: boolean;
  originalStartTime?: string;
  originalEndTime?: string;

  createdAt: string;
}

interface BookingSettings {
  minLeadDays: number;
}

// ═══════════════════════════════════════════════════════
// KONSTANTA
// ═══════════════════════════════════════════════════════
const MAX_BOOKING_MINUTES = 60;
const RETURN_TOLERANCE_MINUTES = 10;
const SCHOOL_WIDE = 'SCHOOL_WIDE';

const timeToMinutes = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const getDurationMinutes = (s: string, e: string): number => timeToMinutes(e) - timeToMinutes(s);
const formatDuration = (min: number): string => {
  if (min <= 0) return '0 menit';
  const h = Math.floor(min / 60), m = min % 60;
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

const DEFAULT_INSTRUMENTS: Omit<Equipment, 'id' | 'classId'>[] = [
  { name: 'Gambus', category: 'Alat Musik Tradisional', quantity: 1, condition: 'BAIK', notes: 'Alat musik petik khas Kalimantan' },
  { name: 'Babun', category: 'Alat Musik Tradisional', quantity: 1, condition: 'BAIK', notes: 'Gendang tradisional Kalimantan' },
  { name: 'Gong', category: 'Alat Musik Tradisional', quantity: 2, condition: 'BAIK', notes: 'Gong untuk pementasan' },
  { name: 'Stand Gong & Pemukul', category: 'Aksesoris & Perlengkapan Musik', quantity: 1, condition: 'BAIK', notes: 'Stand besi dan pemukul gong' },
];

const VERIFIER_ROLES = ['Guru Pengampu', 'Admin', 'Super Admin'];

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

const generateSessionId = (): string => {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

// ═══════════════════════════════════════════════════════
// KOMPONEN UTAMA
// ═══════════════════════════════════════════════════════
export const BookingModule: React.FC = () => {
  const { user, activeClass, classes, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<BookingSettings>({ minLeadDays: 2 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [stageConfig, setStageConfig] = useState<any>(null);
  const [now, setNow] = useState(new Date());

  const isVerifier = !!user && VERIFIER_ROLES.includes(user.role);
  const [activeTab, setActiveTab] = useState<string>(isVerifier ? 'pending' : 'katalog');

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Multi-select booking
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookStart, setBookStart] = useState('14:00');
  const [bookEnd, setBookEnd] = useState('15:00');
  const [bookPurpose, setBookPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Checkout / Return modals
  const [checkoutSession, setCheckoutSession] = useState<Booking[] | null>(null);
  const [checkoutPhotos, setCheckoutPhotos] = useState<PhotoEvidence[]>([]);
  const [checkoutNote, setCheckoutNote] = useState('');
  const [returnSession, setReturnSession] = useState<Booking[] | null>(null);
  const [returnPhotos, setReturnPhotos] = useState<PhotoEvidence[]>([]);
  const [returnCondition, setReturnCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'>('BAIK');
  const [returnNote, setReturnNote] = useState('');

  // Success modal
  const [successSession, setSuccessSession] = useState<{ className: string; equipNames: string[]; date: string; startTime: string; endTime: string } | null>(null);
  const [successGuru, setSuccessGuru] = useState<{
    name: string; phone?: string; className: string; role: string;
    hasPhone: boolean; found: boolean;
  } | null>(null);
  const [successWAUrl, setSuccessWAUrl] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // Equipment CRUD
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [eqName, setEqName] = useState('');
  const [eqCategory, setEqCategory] = useState<string>('Alat Musik Tradisional');
  const [eqQuantity, setEqQuantity] = useState(1);
  const [eqCondition, setEqCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'>('BAIK');
  const [eqNotes, setEqNotes] = useState('');

  // Reject with recommendation
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingBooking, setRejectingBooking] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectGuidance, setRejectGuidance] = useState('');
  const [rejectRecDate, setRejectRecDate] = useState('');
  const [rejectRecStart, setRejectRecStart] = useState('');
  const [rejectRecEnd, setRejectRecEnd] = useState('');

  // Approve
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvingBooking, setApprovingBooking] = useState<Booking | null>(null);
  const [approveStart, setApproveStart] = useState('');
  const [approveEnd, setApproveEnd] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [approveError, setApproveError] = useState('');

  // Settings
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsMinLead, setSettingsMinLead] = useState(2);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<{ session: Booking[]; reason: string } | null>(null);

  const minLeadDays = settings.minLeadDays;
  const minBookingDate = calculateMinDate(minLeadDays);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      const key = `spppt-booking-guide-read-${user.uid}`;
      if (localStorage.getItem(key) !== 'done') {
        const t = setTimeout(() => setIsGuideOpen(true), 800);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [user]);

  // DEDUPE KATALOG
  const dedupedEquipment = useMemo(() => {
    const map: Record<string, Equipment> = {};
    equipment.forEach(eq => {
      const key = (eq.name || '').trim().toLowerCase();
      if (!key) return;
      const existing = map[key];
      if (!existing) { map[key] = eq; return; }
      const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : Infinity;
      const eqTime = eq.createdAt ? new Date(eq.createdAt).getTime() : Infinity;
      if (eqTime < existingTime) map[key] = eq;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [equipment]);

  const duplicateCount = equipment.length - dedupedEquipment.length;

  // SUBSCRIPTIONS
  useEffect(() => {
    if (!activeClass) return;
    (async () => {
      try {
        const ref = doc(db, 'classes', activeClass.id, 'config', 'booking');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const loadedMin = Math.max(2, Number(snap.data().minLeadDays ?? 2));
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
    let isCancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'equipment'));
        if (snap.empty) {
          const batch = writeBatch(db);
          DEFAULT_INSTRUMENTS.forEach(eq => {
            const newRef = doc(collection(db, 'equipment'));
            batch.set(newRef, {
              id: newRef.id, classId: SCHOOL_WIDE, isSchoolWide: true,
              isCustom: false, createdAt: new Date().toISOString(), ...eq,
            });
          });
          await batch.commit();
        }
      } catch (err) { console.warn('Seed error:', err); }
    })();

    const unsub = onSnapshot(collection(db, 'equipment'), snap => {
      if (isCancelled) return;
      setEquipment(snap.docs.map(d => ({ ...d.data(), id: d.id } as Equipment)));
    });
    return () => { isCancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    const qBk = query(collection(db, 'bookings'));
    const unsubBk = onSnapshot(qBk, snap => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(items);
    });
    return () => unsubBk();
  }, []);

  // HELPERS
  const isLate = (b: Booking): boolean => {
    if (b.status !== 'CHECKED_OUT' && b.status !== 'OVERDUE') return false;
    if (!b.checkedOutAt) return false;
    const [eh, em] = b.endTime.split(':').map(Number);
    const endDateTime = new Date(b.date);
    endDateTime.setHours(eh || 0, em || 0, 0, 0);
    const deadline = endDateTime.getTime() + RETURN_TOLERANCE_MINUTES * 60000;
    return now.getTime() > deadline;
  };

  const isMigrated = equipment.length > 0 && equipment.every(e =>
    e.isSchoolWide === true || e.classId === SCHOOL_WIDE
  );

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'REJECTED': return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'CANCELLED': return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'CHECKED_OUT': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'RETURNED': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'OVERDUE': return 'bg-rose-600 text-white border-rose-700';
      default: return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  const getStatusLabel = (status: BookingStatus) => {
    const map: Record<BookingStatus, string> = {
      PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak',
      CANCELLED: 'Dibatalkan', CHECKED_OUT: 'Diambil', RETURNED: 'Dikembalikan', OVERDUE: 'Terlambat',
    };
    return map[status] || status;
  };

  const getConditionColor = (c: string) => {
    if (c === 'BAIK') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (c === 'RUSAK_RINGAN') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
  };

  const groupBySession = (list: Booking[]): Record<string, Booking[]> => {
    const groups: Record<string, Booking[]> = {};
    list.forEach(b => {
      const sid = b.sessionId || b.id;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(b);
    });
    return groups;
  };

  // MIGRATE
  const handleMigrateToShared = async () => {
    if (!user) return;
    if (isMigrated) { showToast('Katalog sudah terintegrasi.', 'info'); return; }
    if (!confirm(`MIGRASI KATALOG?\n\n${equipment.length} alat akan di-dedupe jadi ${dedupedEquipment.length} alat unik. Booking lama tetap valid.`)) return;

    setSubmitting(true);
    try {
      const snap = await getDocs(collection(db, 'equipment'));
      const byName: Record<string, { id: string; createdAt: string }> = {};
      const toDelete: string[] = [];
      snap.docs.forEach(d => {
        const key = (d.data().name || '').trim().toLowerCase();
        if (!key) return;
        const createdAt = d.data().createdAt || '';
        if (!byName[key] || (createdAt && (!byName[key].createdAt || createdAt < byName[key].createdAt))) {
          if (byName[key]) toDelete.push(byName[key].id);
          byName[key] = { id: d.id, createdAt };
        } else toDelete.push(d.id);
      });

      const batch = writeBatch(db);
      Object.values(byName).forEach(entry => {
        batch.update(doc(db, 'equipment', entry.id), { classId: SCHOOL_WIDE, isSchoolWide: true });
      });
      toDelete.forEach(id => batch.delete(doc(db, 'equipment', id)));
      await batch.commit();

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'EquipmentMigration', targetId: SCHOOL_WIDE,
        details: `Migrasi: ${Object.keys(byName).length} unik, ${toDelete.length} hapus`,
      });
      showToast(`Migrasi selesai! ${Object.keys(byName).length} alat unik.`, 'success');
    } catch (err: any) { showToast('Gagal: ' + (err?.message || 'Unknown'), 'error'); }
    finally { setSubmitting(false); }
  };

  // SETTINGS
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (settingsMinLead < 2 || settingsMinLead > 30) { showToast('Minimal H-2, maksimal H-30.', 'warning'); return; }
    try {
      await setDoc(doc(db, 'classes', activeClass.id, 'config', 'booking'), {
        minLeadDays: settingsMinLead, updatedAt: new Date().toISOString(), updatedBy: user.displayName,
      }, { merge: true });
      setSettings({ minLeadDays: settingsMinLead });
      showToast(`Aturan: minimal H-${settingsMinLead}.`, 'success');
      setIsSettingsModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // EQUIPMENT CRUD
  const openAddEquipment = () => {
    setEditingEquipment(null);
    setEqName(''); setEqCategory('Alat Musik Tradisional'); setEqQuantity(1);
    setEqCondition('BAIK'); setEqNotes('');
    setIsEquipmentModalOpen(true);
  };

  const openEditEquipment = (eq: Equipment) => {
    setEditingEquipment(eq);
    setEqName(eq.name); setEqCategory(eq.category); setEqQuantity(eq.quantity);
    setEqCondition(eq.condition); setEqNotes(eq.notes || '');
    setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eqName.trim()) return;
    const exists = dedupedEquipment.some(e => e.name.toLowerCase() === eqName.trim().toLowerCase() && e.id !== editingEquipment?.id);
    if (exists) { showToast(`Alat "${eqName}" sudah ada.`, 'warning'); return; }

    setSubmitting(true);
    try {
      if (editingEquipment) {
        await updateDoc(doc(db, 'equipment', editingEquipment.id), {
          name: eqName.trim(), category: eqCategory, quantity: eqQuantity,
          condition: eqCondition, notes: eqNotes.trim(), updatedAt: new Date().toISOString(),
        });
        showToast('Alat diperbarui.', 'success');
      } else {
        const newRef = doc(collection(db, 'equipment'));
        await setDoc(newRef, {
          id: newRef.id, classId: SCHOOL_WIDE, isSchoolWide: true,
          name: eqName.trim(), category: eqCategory, quantity: eqQuantity,
          condition: eqCondition, notes: eqNotes.trim(), isCustom: true,
          addedByName: user.displayName, createdAt: new Date().toISOString(),
        });
        showToast('Alat ditambahkan.', 'success');
      }
      setIsEquipmentModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteEquipment = async (eq: Equipment) => {
    if (!user || !isVerifier) { showToast('Hanya Guru/Admin.', 'warning'); return; }
    if (!confirm(`Hapus alat "${eq.name}"?`)) return;
    try { await deleteDoc(doc(db, 'equipment', eq.id)); showToast('Alat dihapus.', 'info'); }
    catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // BOOKING MODAL
  const openMultiBooking = (preselected?: Equipment) => {
    if (!activeClass) { showToast('Masuk ke kelas dulu.', 'warning'); return; }
    setSelectedEquipmentIds(preselected ? [preselected.id] : []);
    setBookDate(minBookingDate);
    setBookStart('14:00');
    setBookEnd('15:00');
    setBookPurpose('');
    setIsBookingOpen(true);
  };

  const toggleEquipmentSelection = (id: string) => {
    setSelectedEquipmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (selectedEquipmentIds.length === 0) { showToast('Pilih minimal 1 alat.', 'warning'); return; }
    if (!bookPurpose.trim()) { showToast('Isi keperluan.', 'warning'); return; }

    const dur = getDurationMinutes(bookStart, bookEnd);
    if (dur <= 0) { showToast('Jam selesai harus > jam mulai.', 'warning'); return; }
    if (dur > MAX_BOOKING_MINUTES) { showToast(`Maksimal ${formatDuration(MAX_BOOKING_MINUTES)}.`, 'error'); return; }

    const diff = daysDifference(new Date().toISOString().slice(0, 10), bookDate);
    if (diff < minLeadDays) { showToast(`Booking minimal H-${minLeadDays}.`, 'error'); return; }

    for (const eqId of selectedEquipmentIds) {
      const sameEq = bookings.filter(b =>
        b.equipmentId === eqId &&
        b.date === bookDate &&
        !['REJECTED', 'CANCELLED'].includes(b.status)
      );
      for (const b of sameEq) {
        if (bookStart < b.endTime && bookEnd > b.startTime) {
          showToast(`Bentrok: "${b.equipmentName}" sudah dipinjam ${b.bookerName} jam ${b.startTime}-${b.endTime}.`, 'error');
          return;
        }
      }

      const cancelledByMe = bookings.find(b =>
        b.equipmentId === eqId &&
        b.date === bookDate &&
        b.classId === activeClass.id &&
        b.status === 'CANCELLED' &&
        bookStart < b.endTime && bookEnd > b.startTime
      );
      if (cancelledByMe) {
        const eq = dedupedEquipment.find(e => e.id === eqId);
        showToast(`Kelas Anda sudah membatalkan slot ${bookStart}-${bookEnd} untuk "${eq?.name}". Tidak bisa dipesan ulang.`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const sessionId = generateSessionId();
      const nowIso = new Date().toISOString();
      const batch = writeBatch(db);
      const equipNames: string[] = [];

      for (const eqId of selectedEquipmentIds) {
        const eq = dedupedEquipment.find(e => e.id === eqId);
        if (!eq) continue;
        equipNames.push(eq.name);
        const newRef = doc(collection(db, 'bookings'));
        const bookingData: Booking = {
          id: newRef.id,
          sessionId,
          classId: activeClass.id,
          className: activeClass.name,
          equipmentId: eq.id,
          equipmentName: eq.name,
          equipmentCategory: eq.category,
          bookedBy: user.uid,
          bookerName: user.displayName,
          bookerRole: user.role,
          bookerDivision: user.divisionName || '',
          date: bookDate,
          startTime: bookStart,
          endTime: bookEnd,
          purpose: bookPurpose.trim(),
          status: 'PENDING',
          createdAt: nowIso,
        };
        batch.set(newRef, bookingData);
      }
      await batch.commit();

      // ✅ CARI GURU PENGAMPU — support multi-kelas (classId ATAU classIds.includes)
      let primaryGuru: any = null;
      try {
        const teachers = await fetchUsersByClass(activeClass.id);
        primaryGuru = teachers.find(t =>
          t.role === 'Guru Pengampu' && (
            t.classId === activeClass.id ||
            (Array.isArray(t.classIds) && t.classIds.includes(activeClass.id))
          )
        ) || null;

        if (primaryGuru) {
          const notifBatch = writeBatch(db);
          const nowStr = new Date().toISOString();
          const nRef = doc(collection(db, 'notifications'));
          notifBatch.set(nRef, {
            id: nRef.id,
            userId: primaryGuru.uid,
            classId: activeClass.id,
            title: `Booking Baru: ${equipNames.length} Alat`,
            message: `${user.displayName} (${activeClass.name}) mengajukan booking ${equipNames.join('; ')} untuk ${bookDate} pukul ${bookStart}-${bookEnd}. Keperluan: ${bookPurpose.trim()}`,
            category: 'Tugas',
            read: false,
            link: 'welcome-booking',
            createdAt: nowStr,
          });
          await notifBatch.commit();
        }
      } catch (err) {
        console.warn('Fetch guru error:', err);
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'BookingSession', targetId: sessionId,
        details: `Session ${equipNames.length} alat: ${equipNames.join('; ')}${primaryGuru ? ` → Guru: ${primaryGuru.displayName}` : ' (guru tidak ditemukan)'}`,
      });

      // ✅ BUILD WA INFO
      let waUrl: string | null = null;
      let guruInfoForModal: {
        name: string; phone?: string; className: string; role: string;
        hasPhone: boolean; found: boolean;
      } | null = null;

      if (primaryGuru) {
        const guruName = primaryGuru.displayName || 'Guru Pengampu';
        const guruPhone = primaryGuru.phone;
        const hasPhone = !!guruPhone && guruPhone.trim().length > 0;

        if (hasPhone) {
          let clean = guruPhone.replace(/\D/g, '');
          if (clean.startsWith('0')) clean = '62' + clean.slice(1);
          const kerabatText = activeClass.kerabatKerja ? `\n(Kerabat Kerja: ${activeClass.kerabatKerja})` : '';
          const fmtDate = new Date(bookDate).toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          });
          const waText =
            `Halo Pak/Bu ${guruName},\n\n` +
            `Saya ${user.displayName} dari kelas ${activeClass.name}${kerabatText}\n` +
            `sudah mengajukan booking alat:\n\n` +
            equipNames.map((n, i) => `${i + 1}. ${n}`).join('\n') + '\n\n' +
            `Tanggal: ${fmtDate}\n` +
            `Waktu: ${bookStart} - ${bookEnd}\n` +
            `Keperluan: ${bookPurpose.trim()}\n\n` +
            `Mohon verifikasi booking saya di SP-PPT. Terima kasih.`;
          waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(waText)}`;
        }

        guruInfoForModal = {
          name: guruName,
          phone: guruPhone,
          className: activeClass.name,
          role: 'Guru Pengampu',
          hasPhone,
          found: true,
        };
      }

      setSuccessSession({
        className: activeClass.name,
        equipNames,
        date: bookDate,
        startTime: bookStart,
        endTime: bookEnd,
      });
      setSuccessGuru(guruInfoForModal);
      setSuccessWAUrl(waUrl);
      setIsSuccessModalOpen(true);
      setIsBookingOpen(false);
      setSelectedEquipmentIds([]);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // APPROVE / REJECT
  const handleOpenApprove = (b: Booking) => {
    setApprovingBooking(b);
    setApproveStart(b.startTime); setApproveEnd(b.endTime);
    setApproveNote(''); setApproveError('');
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !approvingBooking || !isVerifier) return;

    const dur = getDurationMinutes(approveStart, approveEnd);
    if (dur <= 0) { setApproveError('Jam selesai harus > jam mulai.'); return; }
    if (dur > MAX_BOOKING_MINUTES) { setApproveError('Maksimal 1 jam.'); return; }

    const conflicting = bookings.filter(b =>
      b.id !== approvingBooking.id &&
      b.equipmentId === approvingBooking.equipmentId &&
      b.date === approvingBooking.date &&
      b.status === 'APPROVED'
    ).find(b => approveStart < b.endTime && approveEnd > b.startTime);
    if (conflicting) { setApproveError(`Bentrok dengan ${conflicting.bookerName}.`); return; }

    setApproveError(''); setSubmitting(true);
    try {
      const wasRescheduled = approveStart !== approvingBooking.startTime || approveEnd !== approvingBooking.endTime;
      await updateDoc(doc(db, 'bookings', approvingBooking.id), {
        status: 'APPROVED',
        startTime: approveStart, endTime: approveEnd,
        approvedBy: user.displayName, approvedAt: new Date().toISOString(),
        verifierNote: approveNote.trim() || null,
        originalStartTime: approvingBooking.startTime,
        originalEndTime: approvingBooking.endTime,
        wasRescheduledByVerifier: wasRescheduled,
      });
      showToast('Booking disetujui.', 'success');
      setIsApproveModalOpen(false);
      setApprovingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleSubmitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectingBooking || !isVerifier) return;
    setSubmitting(true);
    try {
      const updateData: any = {
        status: 'REJECTED',
        approvedBy: user.displayName, approvedAt: new Date().toISOString(),
        rejectionReason: rejectReason.trim(),
        rejectionGuidance: rejectGuidance.trim(),
      };
      if (rejectRecDate) {
        updateData.recommendedDate = rejectRecDate;
        updateData.recommendedStartTime = rejectRecStart || rejectingBooking.startTime;
        updateData.recommendedEndTime = rejectRecEnd || rejectingBooking.endTime;
      }
      await updateDoc(doc(db, 'bookings', rejectingBooking.id), updateData);
      showToast('Booking ditolak.', 'success');
      setIsRejectModalOpen(false); setRejectingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // CHECKOUT
  const openCheckout = (session: Booking[]) => {
    setCheckoutSession(session);
    setCheckoutPhotos([]);
    setCheckoutNote('');
  };

  const handleCheckout = async () => {
    if (!user || !checkoutSession) return;
    if (checkoutPhotos.length === 0) { showToast('Wajib foto alat.', 'warning'); return; }
    for (const p of checkoutPhotos) {
      if (p.caption && checkPhotoContent(p.caption).has) { showToast('Kata tidak pantas di keterangan foto.', 'error'); return; }
    }

    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      const photoUrl = checkoutPhotos[0].dataUrl;
      const note = checkoutNote.trim() || checkoutPhotos[0].caption || '';

      for (const b of checkoutSession) {
        batch.update(doc(db, 'bookings', b.id), {
          status: 'CHECKED_OUT',
          checkedOutAt: nowIso,
          checkoutPhotoUrl: photoUrl,
          checkoutNote: note,
        });
      }
      await batch.commit();
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'BookingSession', targetId: checkoutSession[0]?.sessionId || '',
        details: `Checkout ${checkoutSession.length} alat`,
      });
      showToast(`Pengambilan ${checkoutSession.length} alat dilaporkan.`, 'success');
      setCheckoutSession(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // RETURN
  const openReturn = (session: Booking[]) => {
    setReturnSession(session);
    setReturnPhotos([]);
    setReturnCondition('BAIK');
    setReturnNote('');
  };

  const handleReturn = async () => {
    if (!user || !returnSession || !activeClass) return;
    if (returnPhotos.length === 0) { showToast('Wajib foto pengembalian.', 'warning'); return; }
    for (const p of returnPhotos) {
      if (p.caption && checkPhotoContent(p.caption).has) { showToast('Kata tidak pantas di keterangan foto.', 'error'); return; }
    }

    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      const photoUrl = returnPhotos[0].dataUrl;
      const note = returnNote.trim() || returnPhotos[0].caption || '';

      const lateIds: string[] = [];
      for (const b of returnSession) {
        const [eh, em] = b.endTime.split(':').map(Number);
        const endDateTime = new Date(b.date);
        endDateTime.setHours(eh || 0, em || 0, 0, 0);
        const deadline = endDateTime.getTime() + RETURN_TOLERANCE_MINUTES * 60000;
        const isLate = Date.now() > deadline;
        if (isLate) lateIds.push(b.id);

        batch.update(doc(db, 'bookings', b.id), {
          status: 'RETURNED',
          returnedAt: nowIso,
          returnPhotoUrl: photoUrl,
          returnCondition,
          returnNote: note,
          isLateReturn: isLate,
        });
      }

      const nextClassNotifs: { classId: string; equipNames: string[]; time: string }[] = [];
      for (const b of returnSession) {
        const sameDaySameEq = bookings.filter(x =>
          x.equipmentId === b.equipmentId &&
          x.date === b.date &&
          x.classId !== b.classId &&
          x.status === 'APPROVED' &&
          x.startTime >= b.endTime
        );
        for (const next of sameDaySameEq) {
          const existing = nextClassNotifs.find(n => n.classId === next.classId);
          if (existing) existing.equipNames.push(next.equipmentName);
          else nextClassNotifs.push({ classId: next.classId, equipNames: [next.equipmentName], time: next.startTime });
        }
      }
      await batch.commit();

      if (nextClassNotifs.length > 0) {
        const notifBatch = writeBatch(db);
        const nowStr = new Date().toISOString();
        for (const grp of nextClassNotifs) {
          try {
            const nextUsers = await fetchUsersByClass(grp.classId);
            nextUsers.forEach(u => {
              if (u.uid === user.uid) return;
              const nRef = doc(collection(db, 'notifications'));
              notifBatch.set(nRef, {
                id: nRef.id, userId: u.uid, classId: grp.classId,
                title: 'Alat Diserahkan dari Kelas Sebelumnya',
                message: `${activeClass.name} sudah menyerahkan ${grp.equipNames.join('; ')} untuk jadwal ${grp.time}. Silakan konfirmasi terima & gunakan via Koordinasi Lintas Kelas.`,
                category: 'Sistem', read: false, link: 'inter-class', createdAt: nowStr,
              });
            });
          } catch { /* skip */ }
        }
        await notifBatch.commit();
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'BookingSession', targetId: returnSession[0]?.sessionId || '',
        details: `Return ${returnSession.length} alat${lateIds.length > 0 ? ` (${lateIds.length} terlambat)` : ''}`,
      });

      if (lateIds.length > 0) {
        showToast(`Pengembalian dilaporkan. ${lateIds.length} alat terlambat.`, 'warning');
      } else {
        showToast(`Pengembalian ${returnSession.length} alat dilaporkan.`, 'success');
      }
      setReturnSession(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // CANCEL
  const openCancel = (session: Booking[], reason = '') => {
    setCancelTarget({ session, reason });
  };

  const handleConfirmCancel = async () => {
    if (!user || !cancelTarget) return;
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();
      for (const b of cancelTarget.session) {
        batch.update(doc(db, 'bookings', b.id), {
          status: 'CANCELLED',
          cancelledAt: nowIso,
          cancelledBy: user.displayName,
          cancelledReason: cancelTarget.reason.trim() || 'Dibatalkan oleh peminjam',
        });
      }
      await batch.commit();
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'BookingSession', targetId: cancelTarget.session[0]?.sessionId || '',
        details: `Cancel ${cancelTarget.session.length} alat. Slot dikunci untuk kelas ini.`,
      });
      showToast(`Booking dibatalkan. Slot dikunci untuk kelas Anda.`, 'info');
      setCancelTarget(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // WA OVERDUE
  const handleWAOverdue = (b: Booking) => {
    (async () => {
      try {
        const users = await fetchUsersByClass(b.classId);
        const booker = users.find(u => u.uid === b.bookedBy);
        if (!booker?.phone) { showToast('Nomor WA peminjam tidak tersedia.', 'warning'); return; }

        let clean = booker.phone.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);

        const overdue = Math.max(0, Math.round((now.getTime() - (new Date(`${b.date}T${b.endTime}:00`).getTime() + RETURN_TOLERANCE_MINUTES * 60000)) / 60000));
        const text =
          `Halo ${b.bookerName},\n\n` +
          `Booking "${b.equipmentName}" untuk ${b.date} pukul ${b.startTime}-${b.endTime} sudah melewati batas pengembalian (${overdue} menit).\n\n` +
          `Mohon segera kembalikan alat dan lapor pengembalian di SP-PPT.\n\nTerima kasih.`;
        window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, '_blank');
      } catch { showToast('Gagal buka WA.', 'error'); }
    })();
  };

  // DATA
  const filteredEquipment = dedupedEquipment.filter(eq => {
    if (filterCategory !== 'ALL' && eq.category !== filterCategory) return false;
    if (searchQuery.trim()) return eq.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const mySessions = useMemo(() => {
    const mine = bookings.filter(b => b.bookedBy === user?.uid);
    return groupBySession(mine);
  }, [bookings, user?.uid]);

  const pendingBookings = bookings.filter(b => b.status === 'PENDING');
  const overdueBookings = bookings.filter(b => isLate(b));

  const tableBookings = useMemo(() => {
    return [...bookings]
      .filter(b => !['REJECTED', 'CANCELLED'].includes(b.status))
      .sort((a, b) => {
        const dc = a.date.localeCompare(b.date);
        if (dc !== 0) return dc;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [bookings]);

  // ═══════════════════════════════════════════════════════
  // RENDER: VERIFIKATOR
  // ═══════════════════════════════════════════════════════
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Panel Guru / Admin
                </span>
                <h2 className="text-xl font-black text-white mt-1">Verifikasi Booking</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {pendingBookings.length} menunggu • {overdueBookings.length} terlambat • {dedupedEquipment.length} alat
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isMigrated && duplicateCount > 0 && (
                <button onClick={handleMigrateToShared} disabled={submitting}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg disabled:opacity-50">
                  <Sparkles className="w-3.5 h-3.5" /> Migrasi ({duplicateCount})
                </button>
              )}
              {isMigrated && (
                <span className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Terintegrasi
                </span>
              )}
              {activeClass && (
                <button onClick={() => { setSettingsMinLead(minLeadDays); setIsSettingsModalOpen(true); }}
                  className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                  <SettingsIcon className="w-3.5 h-3.5" /> H-{minLeadDays}
                </button>
              )}
            </div>
          </div>
        </div>

        {overdueBookings.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
                {overdueBookings.length} Booking Terlambat Dikembalikan
              </p>
              <p className="text-xs text-rose-800 dark:text-rose-300 mt-1">Buka tab "Terlambat" untuk kirim WA pengingat.</p>
            </div>
          </div>
        )}

        {!isMigrated && duplicateCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">{duplicateCount} Duplikat Terdeteksi</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">Klik Migrasi untuk bersihkan.</p>
            </div>
          </div>
        )}

        <div className="relative">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none touch-pan-x snap-x snap-mandatory">
            <button onClick={() => setActiveTab('pending')}
              className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'pending' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border'}`}>
              Pending ({pendingBookings.length})
            </button>
            {overdueBookings.length > 0 && (
              <button onClick={() => setActiveTab('overdue')}
                className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${activeTab === 'overdue' ? 'bg-rose-700 text-white' : 'bg-white text-rose-600 border border-rose-300'}`}>
                <AlertCircle className="w-3.5 h-3.5" /> Terlambat ({overdueBookings.length})
              </button>
            )}
            <button onClick={() => setActiveTab('tabel')}
              className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'tabel' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}>
              <Table className="w-3.5 h-3.5" /> Tabel
            </button>
            <button onClick={() => setActiveTab('kalender')}
              className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'kalender' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
              <Calendar className="w-3.5 h-3.5" /> Kalender
            </button>
            <button onClick={() => setActiveTab('katalog')}
              className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>
              Katalog ({dedupedEquipment.length})
            </button>
          </div>
        </div>

        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingBookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-bold">Tidak Ada Antrean</h3>
              </div>
            ) : pendingBookings.map(b => {
              const cls = classes.find(c => c.id === b.classId);
              return (
                <div key={b.id} className="p-4 rounded-2xl bg-white border-2 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                          {b.className || cls?.name || '-'}
                        </span>
                        {cls?.kerabatKerja && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> {cls.kerabatKerja}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900">{b.bookerName}</p>
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                        <Music className="w-3 h-3" /> {b.equipmentName}
                        <span className="text-slate-400">•</span>
                        <span className="font-mono">{b.date}</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono">{b.startTime}-{b.endTime}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 italic">"{b.purpose}"</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleOpenApprove(b)}
                        className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Setujui
                      </button>
                      <button onClick={() => { setRejectingBooking(b); setRejectReason(''); setRejectGuidance(''); setRejectRecDate(''); setRejectRecStart(''); setRejectRecEnd(''); setIsRejectModalOpen(true); }}
                        className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Tolak
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'overdue' && (
          <div className="space-y-3">
            {overdueBookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-bold">Tidak Ada Terlambat</h3>
              </div>
            ) : overdueBookings.map(b => {
              const cls = classes.find(c => c.id === b.classId);
              return (
                <div key={b.id} className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-sm">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" /> TERLAMBAT
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                          {b.className || cls?.name || '-'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-rose-900">{b.bookerName}</p>
                      <p className="text-xs text-rose-800 mt-1 flex items-center gap-1.5 flex-wrap">
                        <Music className="w-3 h-3" /> {b.equipmentName}
                        <span>•</span>
                        <span className="font-mono">{b.date}</span>
                        <span>•</span>
                        <span className="font-mono">{b.startTime}-{b.endTime}</span>
                      </p>
                    </div>
                    <button onClick={() => handleWAOverdue(b)}
                      className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0">
                      <MessageCircle className="w-3.5 h-3.5" /> WA Pengingat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'tabel' && (
          <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Alat</th>
                    <th className="p-3">Peminjam</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">Kerabat Kerja</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableBookings.map(b => {
                    const cls = classes.find(c => c.id === b.classId);
                    const late = isLate(b);
                    const displayStatus = late ? 'OVERDUE' : b.status;
                    return (
                      <tr key={b.id}>
                        <td className="p-3 font-bold">{b.date}</td>
                        <td className="p-3 font-mono">{b.startTime}-{b.endTime}</td>
                        <td className="p-3 text-indigo-600 font-bold">{b.equipmentName}</td>
                        <td className="p-3">{b.bookerName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            {b.className || cls?.name || '-'}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600 italic">{cls?.kerabatKerja || '-'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(displayStatus as BookingStatus)}`}>
                            {getStatusLabel(displayStatus as BookingStatus)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {tableBookings.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-400">Belum ada jadwal.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'kalender' && <BookingCalendarModule embedded />}

        {activeTab === 'katalog' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-bold text-slate-800">Katalog Alat ({filteredEquipment.length} unik)</h3>
              <button onClick={openAddEquipment} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> Tambah Alat
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEquipment.map(eq => (
                <div key={eq.id} className="p-4 rounded-2xl bg-white border shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold">{eq.name}</h4>
                      <p className="text-[10px] text-slate-500">{eq.category} (Qty: {eq.quantity})</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditEquipment(eq)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteEquipment(eq)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className={`px-2 py-0.5 rounded border font-bold ${getConditionColor(eq.condition)}`}>{eq.condition}</span>
                    <span className="font-bold">Qty: {eq.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
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
              <textarea rows={2} value={approveNote} onChange={e => setApproveNote(e.target.value)} placeholder="Catatan (opsional)" className="w-full px-3 py-2 border rounded-xl text-xs" />
              {approveError && <p className="text-xs text-rose-600 font-bold">{approveError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-500 text-white font-bold text-xs rounded-xl">Setujui</button>
              </div>
            </form>
          </div>
        )}

        {isRejectModalOpen && rejectingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <form onSubmit={handleSubmitReject} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-3 my-auto max-h-[95vh] overflow-y-auto">
              <h3 className="text-base font-extrabold text-slate-900">Tolak Booking</h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alasan <span className="text-rose-500">*</span></label>
                <input type="text" required value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan penolakan..." className="w-full px-3 py-2 border rounded-xl text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Arahan untuk Siswa <span className="text-rose-500">*</span></label>
                <textarea required value={rejectGuidance} onChange={e => setRejectGuidance(e.target.value)} placeholder="Apa yang harus dilakukan siswa..." className="w-full px-3 py-2 border rounded-xl text-xs" />
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-[11px] font-bold text-blue-900 mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Rekomendasi Waktu Alternatif (Opsional)
                </p>
                <div className="space-y-2">
                  <input type="date" value={rejectRecDate} onChange={e => setRejectRecDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="time" value={rejectRecStart} onChange={e => setRejectRecStart(e.target.value)} className="px-3 py-2 border rounded-lg text-xs" placeholder="Mulai" />
                    <input type="time" value={rejectRecEnd} onChange={e => setRejectRecEnd(e.target.value)} className="px-3 py-2 border rounded-lg text-xs" placeholder="Selesai" />
                  </div>
                  <p className="text-[10px] text-blue-700 italic">Siswa akan melihat rekomendasi ini di "Booking Saya".</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl">Tolak</button>
              </div>
            </form>
          </div>
        )}

        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSaveSettings} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Minimal Lead Time</h3>
              <input type="number" min="2" max="30" value={settingsMinLead}
                onChange={e => setSettingsMinLead(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full px-3 py-2 border rounded-xl text-center text-xl font-bold" />
              <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Minimal H-2</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">Simpan</button>
              </div>
            </form>
          </div>
        )}

        {isEquipmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-3">
              <h3 className="text-base font-extrabold text-slate-900">{editingEquipment ? 'Edit Alat' : 'Tambah Alat'}</h3>
              <form onSubmit={handleSaveEquipment} className="space-y-3">
                <input type="text" required value={eqName} onChange={e => setEqName(e.target.value)} placeholder="Nama Alat" className="w-full px-3 py-2 border rounded-xl text-xs" />
                <select value={eqCategory} onChange={e => setEqCategory(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs bg-white">
                  {MUSIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" required value={eqQuantity} onChange={e => setEqQuantity(parseInt(e.target.value) || 1)} placeholder="Qty" className="w-full px-3 py-2 border rounded-xl text-xs" />
                  <select value={eqCondition} onChange={e => setEqCondition(e.target.value as any)} className="w-full px-3 py-2 border rounded-xl text-xs bg-white">
                    <option value="BAIK">Baik</option><option value="RUSAK_RINGAN">Rusak Ringan</option><option value="RUSAK_BERAT">Rusak Berat</option>
                  </select>
                </div>
                <textarea rows={2} value={eqNotes} onChange={e => setEqNotes(e.target.value)} placeholder="Catatan (opsional)" className="w-full px-3 py-2 border rounded-xl text-xs" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsEquipmentModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 bg-amber-500 rounded-xl font-bold text-xs">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isGuideOpen && <BookingGuideModal onClose={() => setIsGuideOpen(false)} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: SISWA
  // ═══════════════════════════════════════════════════════
  const mySessionsList = Object.entries(mySessions).map(([sid, list]) => ({ sid, list }));
  mySessionsList.sort((a, b) => new Date(b.list[0]?.createdAt || 0).getTime() - new Date(a.list[0]?.createdAt || 0).getTime());

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Music className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Peminjaman Alat
              </span>
              <h2 className="text-xl font-black text-white mt-1">Katalog & Jadwal</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {dedupedEquipment.length} alat • H-{minLeadDays} • Maks 1 jam • Toleransi 10 menit
              </p>
            </div>
          </div>
          <button onClick={() => setIsGuideOpen(true)}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Panduan
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none touch-pan-x snap-x snap-mandatory">
          <button onClick={() => setActiveTab('katalog')}
            className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>
            Katalog ({dedupedEquipment.length})
          </button>
          <button onClick={() => setActiveTab('jadwal')}
            className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'jadwal' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}>
            <Table className="w-3.5 h-3.5" /> Jadwal
          </button>
          <button onClick={() => setActiveTab('kalender')}
            className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'kalender' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
            <Calendar className="w-3.5 h-3.5" /> Kalender
          </button>
          <button onClick={() => setActiveTab('saya')}
            className={`snap-start shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'saya' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>
            Booking Saya ({mySessionsList.length})
          </button>
        </div>
      </div>

      {activeTab === 'katalog' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input type="text" placeholder="Cari alat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-semibold" />
            </div>
            <button onClick={() => openMultiBooking()} className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Booking Multi-Alat
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEquipment.map(eq => (
              <div key={eq.id} className="p-4 rounded-2xl bg-white border shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold">{eq.name}</h4>
                    <p className="text-[10px] text-slate-500">{eq.category}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className={`px-2 py-0.5 rounded border font-bold ${getConditionColor(eq.condition)}`}>{eq.condition}</span>
                  <span className="font-bold">Qty: {eq.quantity}</span>
                </div>
                <button onClick={() => openMultiBooking(eq)} className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs">
                  Booking Alat Ini
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'jadwal' && (
        <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3">Tanggal</th><th className="p-3">Waktu</th>
                  <th className="p-3">Alat</th><th className="p-3">Peminjam</th>
                  <th className="p-3">Kelas</th><th className="p-3">Kerabat Kerja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableBookings.map(b => {
                  const cls = classes.find(c => c.id === b.classId);
                  return (
                    <tr key={b.id}>
                      <td className="p-3 font-bold">{b.date}</td>
                      <td className="p-3 font-mono">{b.startTime}-{b.endTime}</td>
                      <td className="p-3 text-indigo-600 font-bold">{b.equipmentName}</td>
                      <td className="p-3">{b.bookerName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          {b.className || cls?.name || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 italic">{cls?.kerabatKerja || '-'}</td>
                    </tr>
                  );
                })}
                {tableBookings.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Belum ada jadwal.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'kalender' && <BookingCalendarModule embedded />}

      {activeTab === 'saya' && (
        <div className="space-y-3">
          {mySessionsList.length === 0 ? (
            <div className="p-12 text-center bg-white border rounded-3xl text-slate-400 text-xs">Belum ada booking.</div>
          ) : mySessionsList.map(({ sid, list }) => {
            const first = list[0];
            const allPending = list.every(b => b.status === 'PENDING');
            const allApproved = list.every(b => b.status === 'APPROVED');
            const anyCheckedOut = list.some(b => b.status === 'CHECKED_OUT' || b.status === 'OVERDUE');
            const anyReturned = list.every(b => b.status === 'RETURNED');
            const anyRejected = list.some(b => b.status === 'REJECTED');
            const anyCancelled = list.every(b => b.status === 'CANCELLED');
            const sessionLate = list.some(b => isLate(b));
            const cls = classes.find(c => c.id === first.classId);

            let sessionStatus: BookingStatus = 'PENDING';
            let sessionLabel = 'Menunggu Persetujuan';
            if (anyCancelled) { sessionStatus = 'CANCELLED'; sessionLabel = 'Dibatalkan'; }
            else if (anyRejected) { sessionStatus = 'REJECTED'; sessionLabel = 'Ditolak Sebagian'; }
            else if (anyReturned) { sessionStatus = 'RETURNED'; sessionLabel = 'Selesai'; }
            else if (anyCheckedOut) { sessionStatus = sessionLate ? 'OVERDUE' : 'CHECKED_OUT'; sessionLabel = sessionLate ? 'TERLAMBAT' : 'Sedang Dipakai'; }
            else if (allApproved) { sessionStatus = 'APPROVED'; sessionLabel = 'Disetujui — Siap Diambil'; }
            else if (allPending) { sessionStatus = 'PENDING'; sessionLabel = 'Menunggu Persetujuan'; }

            return (
              <div key={sid} className="p-4 rounded-2xl bg-white border-2 shadow-sm space-y-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(sessionStatus)}`}>
                    {sessionLabel}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                    {first.className || cls?.name || '-'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-300">
                    {list.length} alat
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-600 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5" />
                  <strong>{first.date}</strong>
                  <span>•</span>
                  <strong>{first.startTime} - {first.endTime}</strong>
                </div>

                {cls?.kerabatKerja && (
                  <p className="text-[10px] text-slate-400 italic flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> {cls.kerabatKerja}
                  </p>
                )}

                <div className="space-y-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
                  {list.map(b => (
                    <div key={b.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Music className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-bold truncate">{b.equipmentName}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getStatusColor(b.status)}`}>
                        {getStatusLabel(b.status)}
                      </span>
                    </div>
                  ))}
                </div>

                {list.some(b => b.recommendedDate) && (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-[10px] font-bold text-blue-900 mb-1">Rekomendasi Guru:</p>
                    {list.filter(b => b.recommendedDate).map(b => (
                      <p key={b.id} className="text-[11px] text-blue-800">
                        {b.equipmentName}: <strong>{b.recommendedDate}</strong> pukul {b.recommendedStartTime}-{b.recommendedEndTime}
                      </p>
                    ))}
                    <button
                      onClick={() => {
                        const rec = list.find(b => b.recommendedDate);
                        if (rec) {
                          openMultiBooking();
                          setSelectedEquipmentIds(list.map(x => x.equipmentId));
                          setBookDate(rec.recommendedDate!);
                          setBookStart(rec.recommendedStartTime || '14:00');
                          setBookEnd(rec.recommendedEndTime || '15:00');
                        }
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold">
                      Ajukan Ulang Sesuai Rekomendasi
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                  {allApproved && (
                    <button onClick={() => openCheckout(list)}
                      className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> Lapor Pengambilan
                    </button>
                  )}
                  {anyCheckedOut && !anyReturned && (
                    <button onClick={() => openReturn(list)}
                      className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Lapor Pengembalian
                    </button>
                  )}
                  {(allPending || allApproved) && (
                    <button onClick={() => openCancel(list)}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5" /> Batalkan
                    </button>
                  )}
                  {first.checkoutPhotoUrl && (
                    <a href={first.checkoutPhotoUrl} target="_blank" rel="noreferrer"
                      className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Foto Ambil
                    </a>
                  )}
                  {first.returnPhotoUrl && (
                    <a href={first.returnPhotoUrl} target="_blank" rel="noreferrer"
                      className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Foto Kembali
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Modal Multi-Alat */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Music className="w-5 h-5 text-indigo-500" /> Booking Alat ({selectedEquipmentIds.length})
              </h3>
              <button onClick={() => setIsBookingOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Pilih Alat <span className="text-rose-500">*</span>
                  <span className="text-slate-400 font-normal ml-1">({dedupedEquipment.length} tersedia)</span>
                </label>
                <div className="max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  {dedupedEquipment.map(eq => {
                    const isSelected = selectedEquipmentIds.includes(eq.id);
                    return (
                      <button key={eq.id} type="button" onClick={() => toggleEquipmentSelection(eq.id)}
                        className={`w-full p-2 rounded-lg text-left text-xs transition flex items-center gap-2 ${
                          isSelected ? 'bg-indigo-100 border border-indigo-300' : 'bg-white border border-slate-200'
                        }`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-indigo-500 text-white' : 'border-2 border-slate-300'
                        }`}>
                          {isSelected && <CheckSquare className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{eq.name}</p>
                          <p className="text-[9px] text-slate-500">{eq.category}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedEquipmentIds.length > 0 && (
                  <p className="text-[10px] text-indigo-600 font-bold mt-1">
                    {selectedEquipmentIds.length} alat dipilih
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal <span className="text-rose-500">*</span></label>
                <input type="date" required value={bookDate} min={minBookingDate}
                  onChange={(e) => setBookDate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mulai</label>
                  <input type="time" required value={bookStart} onChange={(e) => setBookStart(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selesai</label>
                  <input type="time" required value={bookEnd} onChange={(e) => setBookEnd(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keperluan <span className="text-rose-500">*</span></label>
                <textarea rows={2} required value={bookPurpose} onChange={(e) => setBookPurpose(e.target.value)}
                  placeholder="Contoh: Latihan adegan 3, properti panggung..." className="w-full p-2.5 border rounded-xl text-xs" />
              </div>

              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800 leading-relaxed">
                <strong>Catatan:</strong> Guru akan verifikasi <strong>per alat</strong>. Semua alat bisa disetujui berbeda. Pengambilan & pengembalian dilakukan per sesi.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsBookingOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                <button type="submit" disabled={submitting || selectedEquipmentIds.length === 0}
                  className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs disabled:opacity-50">
                  {submitting ? 'Mengirim...' : `Ajukan ${selectedEquipmentIds.length} Alat`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutSession && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-500" /> Lapor Pengambilan
              </h3>
              <button onClick={() => setCheckoutSession(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
              <p className="font-bold text-blue-900 mb-1">Alat yang diambil:</p>
              <ul className="list-disc pl-5 text-blue-800 space-y-0.5">
                {checkoutSession.map(b => <li key={b.id}>{b.equipmentName}</li>)}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Foto Alat <span className="text-rose-500">*</span></label>
              <PhotoEvidenceUploader
                photos={checkoutPhotos}
                onChange={setCheckoutPhotos}
                maxPhotos={2}
                required
                hint="Foto alat sebelum dipakai — tampak keseluruhan + close-up kondisi"
                maxWidth={600}
                quality={0.5}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
              <textarea rows={2} value={checkoutNote} onChange={e => setCheckoutNote(e.target.value)}
                placeholder="Kondisi awal alat, keperluan, dll"
                className="w-full p-2.5 border rounded-xl text-xs" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCheckoutSession(null)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleCheckout} disabled={submitting || checkoutPhotos.length === 0}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-xs disabled:opacity-50">
                {submitting ? 'Menyimpan...' : 'Lapor Pengambilan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnSession && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-500" /> Lapor Pengembalian
              </h3>
              <button onClick={() => setReturnSession(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <p className="font-bold text-emerald-900 mb-1">Alat yang dikembalikan:</p>
              <ul className="list-disc pl-5 text-emerald-800 space-y-0.5">
                {returnSession.map(b => <li key={b.id}>{b.equipmentName}</li>)}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Foto Alat <span className="text-rose-500">*</span></label>
              <PhotoEvidenceUploader
                photos={returnPhotos}
                onChange={setReturnPhotos}
                maxPhotos={2}
                required
                hint="Foto alat setelah dipakai — pastikan kerusakan (jika ada) terlihat jelas"
                maxWidth={600}
                quality={0.5}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kondisi Akhir <span className="text-rose-500">*</span></label>
              <select value={returnCondition} onChange={e => setReturnCondition(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-white">
                <option value="BAIK">Baik (sama seperti awal)</option>
                <option value="RUSAK_RINGAN">Rusak Ringan</option>
                <option value="RUSAK_BERAT">Rusak Berat</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
              <textarea rows={2} value={returnNote} onChange={e => setReturnNote(e.target.value)}
                placeholder="Kondisi alat, kerusakan, dll"
                className="w-full p-2.5 border rounded-xl text-xs" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReturnSession(null)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleReturn} disabled={submitting || returnPhotos.length === 0}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs disabled:opacity-50">
                {submitting ? 'Menyimpan...' : 'Lapor Pengembalian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-3">
            <h3 className="text-base font-extrabold text-rose-900 flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" /> Batalkan Booking?
            </h3>
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
              <strong>Perhatian:</strong> Setelah dibatalkan, kelas Anda <strong>tidak bisa memesan slot yang sama</strong> untuk alat yang sama di tanggal & jam ini. Kelas lain tetap bisa.
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <p className="font-bold text-slate-700 mb-1">Alat yang dibatalkan:</p>
              <ul className="list-disc pl-5 text-slate-600">
                {cancelTarget.session.map(b => <li key={b.id}>{b.equipmentName}</li>)}
              </ul>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alasan (opsional)</label>
              <textarea rows={2} value={cancelTarget.reason} onChange={e => setCancelTarget({ ...cancelTarget, reason: e.target.value })}
                placeholder="Kenapa ingin batalkan?"
                className="w-full p-2.5 border rounded-xl text-xs" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCancelTarget(null)} className="px-4 py-2 text-xs font-bold text-slate-600">Tidak</button>
              <button onClick={handleConfirmCancel} disabled={submitting}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl disabled:opacity-50">
                {submitting ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal + WA */}
      {isSuccessModalOpen && successSession && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl my-auto overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-3">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-black">Booking Berhasil Diajukan</h3>
              <p className="text-xs opacity-90 mt-1">{successSession.equipNames.length} alat menunggu verifikasi</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <p className="font-bold text-slate-500 text-[10px] uppercase">Alat</p>
                <ul className="space-y-1">
                  {successSession.equipNames.map((n, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <Music className="w-3 h-3 text-indigo-500" /> <strong>{n}</strong>
                    </li>
                  ))}
                </ul>
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Kelas:</span>
                    <span className="font-bold">{successSession.className}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Tanggal:</span>
                    <span className="font-bold">{new Date(successSession.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Waktu:</span>
                    <span className="font-bold">{successSession.startTime}-{successSession.endTime}</span>
                  </div>
                </div>
              </div>

              {/* ✅ 3 KONDISI WA */}
              {successGuru && successGuru.hasPhone && successWAUrl ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> Guru Pengampu Kelas {successGuru.className}
                    </p>
                    <p className="font-bold text-emerald-900 text-sm">{successGuru.name}</p>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Guru Pengampu Seni Teater</p>
                  </div>
                  <a href={successWAUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition">
                    <MessageCircle className="w-4 h-4" />
                    Hubungi {successGuru.name.split(',')[0]} via WA
                  </a>
                </div>
              ) : successGuru && !successGuru.hasPhone ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-900 leading-relaxed flex-1">
                    <p className="font-bold mb-1.5">Nomor WA Guru Pengampu belum terdaftar:</p>
                    <div className="p-2 rounded-lg bg-white/60 border border-amber-200 mb-1.5">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Guru Pengampu Kelas {successGuru.className}</p>
                      <p className="font-bold text-amber-900 text-sm">{successGuru.name}</p>
                    </div>
                    <p className="italic text-[10px]">
                      Silakan hubungi guru secara <strong>langsung</strong> atau minta guru untuk mendaftarkan nomor WA di menu <strong>Pengaturan Akun</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-rose-900 leading-relaxed">
                    <p className="font-bold mb-1">Guru Pengampu Kelas {successSession?.className} belum terdaftar.</p>
                    <p className="italic">Hubungi wali kelas atau admin sekolah untuk mendaftarkan guru pengampu.</p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Guru akan verifikasi per alat. Setelah disetujui, lakukan <strong>Lapor Pengambilan</strong> dari menu "Booking Saya".
                </p>
              </div>

              <button onClick={() => { setIsSuccessModalOpen(false); setSuccessSession(null); setSuccessGuru(null); setSuccessWAUrl(null); }}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {isGuideOpen && <BookingGuideModal onClose={() => setIsGuideOpen(false)} />}
    </div>
  );
};