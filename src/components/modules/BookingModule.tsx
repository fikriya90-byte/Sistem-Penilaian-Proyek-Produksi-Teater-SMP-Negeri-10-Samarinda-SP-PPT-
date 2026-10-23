// src/components/modules/BookingModule.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, Package, Plus, X, Save, CheckCircle, XCircle,
  AlertTriangle, Search, Music, Trash2, Edit3, Info,
  Settings as SettingsIcon, Send, ShieldAlert, Building2, User as UserIcon,
  Table, Bell, MapPin, RefreshCw, MessageCircle, Sparkles, Layers,
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

// ═══════════════════════════════════════════════════════
// KONSTANTA
// ═══════════════════════════════════════════════════════
const MAX_BOOKING_MINUTES = 60;
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

const VERIFIER_ROLES = ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'];

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
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [stageConfig, setStageConfig] = useState<any>(null);

  const isVerifier = !!user && VERIFIER_ROLES.includes(user.role);
  const [activeTab, setActiveTab] = useState<string>(isVerifier ? 'pending' : 'katalog');

  // Equipment CRUD
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [eqName, setEqName] = useState('');
  const [eqCategory, setEqCategory] = useState<string>('Alat Musik Tradisional');
  const [eqQuantity, setEqQuantity] = useState(1);
  const [eqCondition, setEqCondition] = useState<'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT'>('BAIK');
  const [eqNotes, setEqNotes] = useState('');

  // Reject / Approve / Settings
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

  // Booking Form
  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookStart, setBookStart] = useState('14:00');
  const [bookEnd, setBookEnd] = useState('15:00');
  const [bookPurpose, setBookPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success modal
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);
  const [successGuru, setSuccessGuru] = useState<{ name: string; phone?: string } | null>(null);
  const [successWAUrl, setSuccessWAUrl] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const minLeadDays = settings.minLeadDays;
  const minBookingDate = calculateMinDate(minLeadDays);

  // ═══════════════════════════════════════════════════════
  // ✅ BUG FIX #1: DEDUPE di UI — meski Firestore masih berisi duplikat,
  // tampilkan hanya versi unik berdasarkan nama (lowercase).
  // Pertahankan yang paling awal createdAt (stabil).
  // ═══════════════════════════════════════════════════════
  const dedupedEquipment = useMemo(() => {
    const map: Record<string, Equipment> = {};
    equipment.forEach(eq => {
      const key = (eq.name || '').trim().toLowerCase();
      if (!key) return;
      const existing = map[key];
      if (!existing) {
        map[key] = eq;
        return;
      }
      // Pertahankan yang lebih awal createdAt (kalau ada), else yang pertama
      const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : Infinity;
      const eqTime = eq.createdAt ? new Date(eq.createdAt).getTime() : Infinity;
      if (eqTime < existingTime) {
        map[key] = eq;
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [equipment]);

  const duplicateCount = equipment.length - dedupedEquipment.length;

  // ═══════════════════════════════════════════════════════
  // LOAD SETTINGS (per kelas)
  // ═══════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════
  // ✅ BUG FIX #2: KATALOG SHARED — seed sekali via getDocs (bukan onSnapshot)
  // Mencegah infinite seed loop.
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    let isCancelled = false;

    // 1. Seed sekali — cek kosong via getDocs
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'equipment'));
        if (snap.empty) {
          const batch = writeBatch(db);
          DEFAULT_INSTRUMENTS.forEach(eq => {
            const newRef = doc(collection(db, 'equipment'));
            batch.set(newRef, {
              id: newRef.id,
              classId: SCHOOL_WIDE,
              isSchoolWide: true,
              isCustom: false,
              createdAt: new Date().toISOString(),
              ...eq,
            });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Seed error:', err);
      }
    })();

    // 2. Subscribe — tanpa logika seed di dalamnya
    const unsub = onSnapshot(collection(db, 'equipment'), snap => {
      if (isCancelled) return;
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Equipment));
      setEquipment(items);
    });

    return () => {
      isCancelled = true;
      unsub();
    };
  }, []);

  // ═══════════════════════════════════════════════════════
  // BOOKINGS SHARED — semua role lihat semua booking
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    const qBk = query(collection(db, 'bookings'));
    const unsubBk = onSnapshot(qBk, snap => {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(items);
    });
    return () => unsubBk();
  }, []);

  // ═══════════════════════════════════════════════════════
  // MIGRASI KE SHARED KATALOG
  // ═══════════════════════════════════════════════════════
  const isMigrated = equipment.length > 0 && equipment.every(e =>
    e.isSchoolWide === true || e.classId === SCHOOL_WIDE
  );

  const handleMigrateToShared = async () => {
    if (!user) return;
    if (isMigrated) {
      showToast('Katalog sudah terintegrasi ke seluruh sekolah.', 'info');
      return;
    }
    if (!confirm(
      'MIGRASI KATALOG KE SELURUH SEKOLAH?\n\n' +
      `• Ditemukan ${equipment.length} alat, akan di-dedupe jadi ${dedupedEquipment.length} alat unik.\n` +
      '• Alat dengan nama sama akan di-dedupe (ID terlama dipertahankan).\n' +
      '• Booking lama tetap valid karena ID alat pertama dipertahankan.\n\n' +
      'Lanjutkan?'
    )) return;

    setSubmitting(true);
    try {
      const snap = await getDocs(collection(db, 'equipment'));
      const byName: Record<string, { id: string; createdAt: string }> = {};
      const toDelete: string[] = [];

      snap.docs.forEach(d => {
        const data = d.data();
        const key = (data.name || '').trim().toLowerCase();
        if (!key) return;
        const createdAt = data.createdAt || '';
        if (!byName[key] || (createdAt && (!byName[key].createdAt || createdAt < byName[key].createdAt))) {
          if (byName[key]) toDelete.push(byName[key].id);
          byName[key] = { id: d.id, createdAt };
        } else {
          toDelete.push(d.id);
        }
      });

      const batch = writeBatch(db);
      Object.values(byName).forEach(entry => {
        batch.update(doc(db, 'equipment', entry.id), {
          classId: SCHOOL_WIDE,
          isSchoolWide: true,
        });
      });
      toDelete.forEach(id => batch.delete(doc(db, 'equipment', id)));
      await batch.commit();

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'EquipmentMigration', targetId: SCHOOL_WIDE,
        details: `Migrasi katalog: ${Object.keys(byName).length} alat unik, ${toDelete.length} duplikat dihapus`,
      });

      showToast(`Migrasi selesai! ${Object.keys(byName).length} alat unik tersimpan.`, 'success');
    } catch (err: any) {
      showToast('Gagal migrasi: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // HANDLERS: SETTINGS
  // ═══════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════
  // HANDLERS: EQUIPMENT CRUD
  // ═══════════════════════════════════════════════════════
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
    if (!user) return;
    if (!eqName.trim()) { showToast('Nama alat wajib.', 'warning'); return; }

    // ✅ Cek nama unik (di dedupedEquipment, bukan equipment — agar konsisten dengan apa yang user lihat)
    const exists = dedupedEquipment.some(e =>
      e.name.toLowerCase() === eqName.trim().toLowerCase() && e.id !== editingEquipment?.id
    );
    if (exists) { showToast(`Alat "${eqName}" sudah ada di katalog.`, 'warning'); return; }

    setSubmitting(true);
    try {
      if (editingEquipment) {
        await updateDoc(doc(db, 'equipment', editingEquipment.id), {
          name: eqName.trim(), category: eqCategory, quantity: eqQuantity,
          condition: eqCondition, notes: eqNotes.trim(),
          updatedAt: new Date().toISOString(),
        });
        showToast(`Alat "${eqName}" diperbarui.`, 'success');
      } else {
        const newRef = doc(collection(db, 'equipment'));
        await setDoc(newRef, {
          id: newRef.id,
          classId: SCHOOL_WIDE,
          isSchoolWide: true,
          name: eqName.trim(),
          category: eqCategory,
          quantity: eqQuantity,
          condition: eqCondition,
          notes: eqNotes.trim(),
          isCustom: true,
          addedByName: user.displayName,
          createdAt: new Date().toISOString(),
        });
        showToast(`Alat "${eqName}" ditambahkan.`, 'success');
      }
      setIsEquipmentModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  // ✅ BUG FIX #4: Hanya verifier yang bisa hapus dari katalog shared
  const handleDeleteEquipment = async (eq: Equipment) => {
    if (!user) return;
    if (!isVerifier) {
      showToast('Hanya Guru/Admin yang dapat menghapus alat dari katalog sekolah.', 'warning');
      return;
    }
    if (!confirm(`Hapus alat "${eq.name}" dari katalog?`)) return;
    try {
      await deleteDoc(doc(db, 'equipment', eq.id));
      showToast('Alat dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ═══════════════════════════════════════════════════════
  // HANDLERS: BOOKING FLOW
  // ═══════════════════════════════════════════════════════
  const handleOpenBooking = (eq: Equipment) => {
    if (!activeClass) {
      showToast('Masuk ke kelas dulu untuk melakukan booking.', 'warning');
      return;
    }
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
    if (dur > MAX_BOOKING_MINUTES) { showToast(`Maksimal ${formatDuration(MAX_BOOKING_MINUTES)}.`, 'error'); return; }

    const diff = daysDifference(new Date().toISOString().slice(0, 10), bookDate);
    if (diff < minLeadDays) { showToast(`Booking minimal H-${minLeadDays}.`, 'error'); return; }

    const existing = bookings.filter(b =>
      b.equipmentId === selectedEquipment.id &&
      b.date === bookDate &&
      b.status !== 'REJECTED'
    );
    for (const b of existing) {
      if (bookStart < b.endTime && bookEnd > b.startTime) {
        showToast(`Bentrok dengan ${b.bookerName} (${b.startTime}-${b.endTime}).`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'bookings'));
      const bookingData: Booking = {
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
        date: bookDate,
        startTime: bookStart,
        endTime: bookEnd,
        purpose: bookPurpose.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      await setDoc(newRef, bookingData);

      // Notif real-time ke guru kelas
      let guruList: any[] = [];
      try {
        const teachers = await fetchUsersByClass(activeClass.id);
        guruList = teachers.filter(t =>
          t.role === 'Guru Pengampu' || t.role === 'Guru Pembina'
        );
        if (guruList.length > 0) {
          const notifBatch = writeBatch(db);
          const nowStr = new Date().toISOString();
          guruList.forEach(g => {
            const nRef = doc(collection(db, 'notifications'));
            notifBatch.set(nRef, {
              id: nRef.id,
              userId: g.uid,
              classId: activeClass.id,
              title: `Booking Baru: ${selectedEquipment.name}`,
              message: `${user.displayName} (${activeClass.name}) mengajukan booking ${selectedEquipment.name} untuk ${bookDate} pukul ${bookStart}-${bookEnd}. Keperluan: ${bookPurpose.trim()}`,
              category: 'Tugas',
              read: false,
              link: 'welcome-booking',
              createdAt: nowStr,
            });
          });
          await notifBatch.commit();
        }
      } catch (err) {
        console.warn('Notif guru gagal:', err);
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Booking', targetId: newRef.id,
        details: `Booking ${selectedEquipment.name} - ${bookDate} ${bookStart}-${bookEnd}`,
      });

      // Build WA info
      const primaryGuru = guruList[0];
      const hasPhone = primaryGuru?.phone;
      let waUrl: string | null = null;

      if (hasPhone) {
        let clean = primaryGuru.phone.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        const equipmentList = [selectedEquipment.name].join('; ');
        const kerabatText = activeClass.kerabatKerja
          ? ` (Kerabat Kerja: ${activeClass.kerabatKerja})`
          : '';
        const formattedDate = new Date(bookDate).toLocaleDateString('id-ID', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const waText =
          `Halo Pak/Bu ${primaryGuru.displayName},\n\n` +
          `Saya ${user.displayName} dari kelas ${activeClass.name}${kerabatText},\n` +
          `sudah mengajukan booking alat:\n\n` +
          `Alat: ${equipmentList}\n` +
          `Tanggal: ${formattedDate}\n` +
          `Waktu: ${bookStart} - ${bookEnd}\n` +
          `Keperluan: ${bookPurpose.trim()}\n\n` +
          `Mohon verifikasi booking saya di SP-PPT. Terima kasih.`;
        waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(waText)}`;
      }

      setSuccessBooking(bookingData);
      setSuccessGuru(primaryGuru ? { name: primaryGuru.displayName, phone: primaryGuru.phone } : null);
      setSuccessWAUrl(waUrl);
      setIsSuccessModalOpen(true);
      setIsBookingOpen(false);
      setSelectedEquipment(null);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // APPROVE / REJECT
  // ═══════════════════════════════════════════════════════
  const handleOpenApprove = (b: Booking) => {
    setApprovingBooking(b);
    setApproveStart(b.startTime);
    setApproveEnd(b.endTime);
    setApproveNote('');
    setApproveError('');
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
      await updateDoc(doc(db, 'bookings', rejectingBooking.id), {
        status: 'REJECTED',
        approvedBy: user.displayName,
        approvedAt: new Date().toISOString(),
        rejectionReason: rejectReason.trim(),
        rejectionGuidance: rejectGuidance.trim(),
      });
      showToast('Booking ditolak.', 'success');
      setIsRejectModalOpen(false);
      setRejectingBooking(null);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteBooking = async (b: Booking) => {
    if (!user || !(b.bookedBy === user.uid || isVerifier)) return;
    if (!confirm(`Hapus booking "${b.equipmentName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'bookings', b.id));
      showToast('Booking dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  // ═══════════════════════════════════════════════════════
  // DATA FILTERS — pakai dedupedEquipment
  // ═══════════════════════════════════════════════════════
  const filteredEquipment = dedupedEquipment.filter(eq => {
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
                  {pendingBookings.length} menunggu • H-{minLeadDays} • Maks 1 jam • {dedupedEquipment.length} alat tersedia
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isMigrated && duplicateCount > 0 && (
                <button onClick={handleMigrateToShared} disabled={submitting}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg disabled:opacity-50">
                  <Sparkles className="w-3.5 h-3.5" /> Migrasi ({duplicateCount} duplikat)
                </button>
              )}
              {isMigrated && (
                <span className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Katalog Terintegrasi
                </span>
              )}
              {activeClass && (
                <button onClick={() => { setSettingsMinLead(minLeadDays); setIsSettingsModalOpen(true); }}
                  className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                  <SettingsIcon className="w-3.5 h-3.5" /> Atur H-{minLeadDays}
                </button>
              )}
            </div>
          </div>
        </div>

        {!isMigrated && duplicateCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                {duplicateCount} Duplikat Terdeteksi di Firestore
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                Katalog sudah menampilkan <strong>{dedupedEquipment.length} alat unik</strong> (duplikat disembunyikan otomatis). Klik <strong>Migrasi</strong> untuk menghapus data duplikat dari database.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'pending' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border'}`}>
            Perlu Verifikasi ({pendingBookings.length})
          </button>
          <button onClick={() => setActiveTab('tabel')} className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'tabel' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}>
            <Table className="w-3.5 h-3.5" /> Tabel Jadwal
          </button>
          <button onClick={() => setActiveTab('kalender')} className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'kalender' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
            <Calendar className="w-3.5 h-3.5" /> Kalender
          </button>
          <button onClick={() => setActiveTab('katalog')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>
            Katalog Alat ({dedupedEquipment.length})
          </button>
        </div>

        {/* Pending */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingBookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-bold">Tidak Ada Antrean</h3>
              </div>
            ) : pendingBookings.map(b => (
              <div key={b.id} className="p-4 rounded-2xl bg-white border-2 shadow-sm flex justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {b.bookerName}
                    <span className="text-xs text-slate-500 ml-1.5">({b.className})</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                    <Music className="w-3 h-3" /> {b.equipmentName} • {b.date} ({b.startTime}-{b.endTime})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 italic">"{b.purpose}"</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenApprove(b)} className="px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-bold">Setujui</button>
                  <button onClick={() => { setRejectingBooking(b); setRejectReason(''); setRejectGuidance(''); setIsRejectModalOpen(true); }} className="px-3 py-1.5 bg-rose-500 text-white rounded text-xs font-bold">Tolak</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabel */}
        {activeTab === 'tabel' && (
          <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3">Tanggal</th><th className="p-3">Waktu</th><th className="p-3">Alat</th>
                  <th className="p-3">Peminjam</th><th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableBookings.map(b => (
                  <tr key={b.id}>
                    <td className="p-3 font-bold">{b.date}</td>
                    <td className="p-3 font-mono">{b.startTime}-{b.endTime}</td>
                    <td className="p-3 text-indigo-600 font-bold">{b.equipmentName}</td>
                    <td className="p-3">{b.bookerName} ({b.className})</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(b.status)}`}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Kalender */}
        {activeTab === 'kalender' && <BookingCalendarModule embedded />}

        {/* Katalog */}
        {activeTab === 'katalog' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-bold text-slate-800">Katalog Alat ({filteredEquipment.length} unik)</h3>
              <button onClick={openAddEquipment} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> Tambah Alat Baru
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
                  {activeClass && (
                    <button onClick={() => handleOpenBooking(eq)} className="w-full py-2 bg-indigo-500 text-white rounded font-bold text-xs">Booking Alat Ini</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modals Approve/Reject/Settings/Equipment */}
        {isApproveModalOpen && approvingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleConfirmApprove} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Setujui / Atur Jam</h3>
              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={approveStart} onChange={e => setApproveStart(e.target.value)} className="px-3 py-2 border rounded-xl" />
                <input type="time" value={approveEnd} onChange={e => setApproveEnd(e.target.value)} className="px-3 py-2 border rounded-xl" />
              </div>
              <textarea rows={2} value={approveNote} onChange={e => setApproveNote(e.target.value)} placeholder="Catatan verifikator (opsional)" className="w-full px-3 py-2 border rounded-xl text-xs" />
              {approveError && <p className="text-xs text-rose-600 font-bold">{approveError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-xs font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-emerald-500 text-white font-bold text-xs rounded-xl">Setujui</button>
              </div>
            </form>
          </div>
        )}

        {isRejectModalOpen && rejectingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
            <form onSubmit={handleSubmitReject} className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Tolak Booking</h3>
              <input type="text" required value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan..." className="w-full px-3 py-2 border rounded-xl text-xs" />
              <textarea required value={rejectGuidance} onChange={e => setRejectGuidance(e.target.value)} placeholder="Arahan..." className="w-full px-3 py-2 border rounded-xl text-xs" />
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
              <h3 className="text-base font-extrabold text-slate-900">Atur Minimal Lead Time</h3>
              <input type="number" min="2" max="30" value={settingsMinLead}
                onChange={e => setSettingsMinLead(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full px-3 py-2 border rounded-xl text-center text-xl font-bold" />
              <p className="text-xs text-amber-600 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Minimal H-2 (tidak dapat diturunkan)
              </p>
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
                    <option value="BAIK">Baik</option>
                    <option value="RUSAK_RINGAN">Rusak Ringan</option>
                    <option value="RUSAK_BERAT">Rusak Berat</option>
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
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER: SISWA
  // ═══════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Music className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Peminjaman Alat Sekolah
            </span>
            <h2 className="text-xl font-black text-white mt-1">Katalog & Jadwal</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {dedupedEquipment.length} alat tersedia • H-{minLeadDays} • Maks 1 Jam
            </p>
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
        <button onClick={() => setActiveTab('katalog')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'katalog' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>
          Katalog Alat ({dedupedEquipment.length})
        </button>
        <button onClick={() => setActiveTab('jadwal')} className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'jadwal' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}`}>
          <Table className="w-3.5 h-3.5" /> Jadwal Peminjaman
        </button>
        <button onClick={() => setActiveTab('kalender')} className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'kalender' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
          <Calendar className="w-3.5 h-3.5" /> Kalender
        </button>
        <button onClick={() => setActiveTab('saya')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'saya' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>
          Booking Saya ({myBookings.length})
        </button>
      </div>

      {activeTab === 'katalog' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input type="text" placeholder="Cari alat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-semibold" />
            </div>
            <button onClick={openAddEquipment} className="px-4 py-2 rounded-xl bg-amber-500 font-bold text-xs flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Tambah Alat
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
                  {/* Siswa hanya bisa edit/delete alat yang mereka tambahkan sendiri */}
                  {eq.addedByName === user?.displayName && (
                    <div className="flex gap-1">
                      <button onClick={() => openEditEquipment(eq)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                    </div>
                  )}
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
            <thead className="bg-slate-50 border-b">
              <tr><th className="p-3">Tanggal</th><th className="p-3">Waktu</th><th className="p-3">Alat</th><th className="p-3">Peminjam</th><th className="p-3">Kelas</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableBookings.map(b => (
                <tr key={b.id}>
                  <td className="p-3 font-bold">{b.date}</td>
                  <td className="p-3 font-mono">{b.startTime}-{b.endTime}</td>
                  <td className="p-3 text-indigo-600 font-bold">{b.equipmentName}</td>
                  <td className="p-3">{b.bookerName}</td>
                  <td className="p-3 text-slate-500">{b.className}</td>
                </tr>
              ))}
              {tableBookings.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Belum ada jadwal.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'kalender' && <BookingCalendarModule embedded />}

      {activeTab === 'saya' && (
        <div className="space-y-3">
          {myBookings.length === 0 ? (
            <div className="p-12 text-center bg-white border rounded-3xl text-slate-400 text-xs">Belum ada booking.</div>
          ) : myBookings.map(b => (
            <div key={b.id} className="p-4 rounded-2xl bg-white border shadow-sm flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(b.status)}`}>{b.status}</span>
                <p className="font-bold text-sm mt-1">{b.equipmentName}</p>
                <p className="text-xs text-slate-500">{b.date} • {b.startTime}-{b.endTime}</p>
              </div>
              {b.bookedBy === user?.uid && b.status === 'PENDING' && (
                <button onClick={() => handleDeleteBooking(b)} className="text-rose-500 p-1"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Booking Form */}
      {isBookingOpen && selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-500" /> Booking {selectedEquipment.name}
            </h3>
            <form onSubmit={handleSubmitBooking} className="space-y-3">
              <input type="date" required value={bookDate} min={minBookingDate} onChange={(e) => setBookDate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs" />
              <div className="grid grid-cols-2 gap-3">
                <input type="time" required value={bookStart} onChange={(e) => setBookStart(e.target.value)} className="px-3 py-2 border rounded-xl text-xs" />
                <input type="time" required value={bookEnd} onChange={(e) => setBookEnd(e.target.value)} className="px-3 py-2 border rounded-xl text-xs" />
              </div>
              <textarea rows={3} required value={bookPurpose} onChange={(e) => setBookPurpose(e.target.value)} placeholder="Keperluan booking..." className="w-full p-3 border rounded-xl text-xs" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsBookingOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-500 text-white rounded-xl font-bold text-xs disabled:opacity-50">
                  {submitting ? 'Mengirim...' : 'Ajukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Equipment Modal untuk Siswa */}
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
                  <option value="BAIK">Baik</option>
                  <option value="RUSAK_RINGAN">Rusak Ringan</option>
                  <option value="RUSAK_BERAT">Rusak Berat</option>
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

      {/* Success Modal + WA */}
      {isSuccessModalOpen && successBooking && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-3">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-black">Booking Berhasil Diajukan</h3>
              <p className="text-xs opacity-90 mt-1">Menunggu verifikasi guru</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Alat:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-right">{successBooking.equipmentName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Tanggal:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-right">
                    {new Date(successBooking.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Waktu:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{successBooking.startTime} - {successBooking.endTime}</span>
                </div>
              </div>

              {successGuru && successWAUrl ? (
                <a
                  href={successWAUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  Hubungi {successGuru.name} via WhatsApp
                </a>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                    <strong>Nomor WA guru belum tersedia.</strong> Silakan hubungi {successGuru?.name || 'guru pengampu'} secara manual untuk konfirmasi booking Anda.
                  </p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  Guru sudah menerima notifikasi booking Anda. Mohon tunggu verifikasi sebelum menggunakan alat.
                </p>
              </div>

              <button
                onClick={() => { setIsSuccessModalOpen(false); setSuccessBooking(null); setSuccessGuru(null); setSuccessWAUrl(null); }}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};