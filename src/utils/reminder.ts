// src/utils/reminder.ts
import { collection, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../core/firebase';
import { fetchUsersByClass } from '../services/firestoreService';

const RETURN_TOLERANCE_MINUTES = 10;

// ==========================================
// 1. REMINDER DEADLINE (Tugas Siswa)
// ==========================================
export async function checkDeadlineReminders(classId: string) {
  try {
    const now = Date.now();
    const deadQ = query(collection(db, 'deadlines'), where('classId', '==', classId));
    const deadSnap = await getDocs(deadQ);

    const batch = writeBatch(db);
    let hasNotif = false;

    for (const d of deadSnap.docs) {
      const deadline = d.data();
      const dueTime = new Date(deadline.dueDate).getTime();
      const diff = dueTime - now;

      let reminderKey = '';
      if (diff > 66 * 3600000 && diff <= 72 * 3600000) reminderKey = 'H3';
      else if (diff > 20 * 3600000 && diff <= 24 * 3600000) reminderKey = 'H1';
      else if (diff > 30 * 60000 && diff <= 90 * 60000) reminderKey = 'H1JAM';
      else if (diff < 0 && diff > -24 * 3600000) reminderKey = 'OVERDUE';

      if (!reminderKey) continue;

      const sentQ = query(
        collection(db, 'reminderLog'),
        where('itemId', '==', d.id),
        where('reminderKey', '==', reminderKey)
      );
      const sentSnap = await getDocs(sentQ);
      if (!sentSnap.empty) continue;

      const users = await fetchUsersByClass(classId);
      const recipients = users.filter(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return false;
        if (u.role === 'Admin' || u.role === 'Super Admin') return false;
        if (deadline.targetScope === 'SEMUA') return true;
        if (deadline.targetScope === 'DIVISI') return u.divisionName === deadline.targetDivision;
        if (deadline.targetScope === 'PERAN') return u.role === deadline.targetRole;
        return false;
      });

      const label = reminderKey === 'H3' ? '3 hari lagi'
        : reminderKey === 'H1' ? 'besok'
        : reminderKey === 'H1JAM' ? 'kurang dari 1 jam'
        : 'sudah terlewat';

      recipients.forEach(r => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: r.uid,
          classId,
          title: reminderKey === 'OVERDUE' ? 'Deadline Terlewat' : 'Reminder Deadline',
          message: `"${deadline.title}" — ${label}`,
          category: 'Reminder',
          read: false,
          link: 'tugas',
          createdAt: new Date().toISOString(),
        });
        hasNotif = true;
      });

      const logRef = doc(collection(db, 'reminderLog'));
      batch.set(logRef, {
        id: logRef.id,
        itemId: d.id,
        itemType: 'deadline',
        reminderKey,
        sentAt: new Date().toISOString(),
      });
      hasNotif = true;
    }

    if (hasNotif) await batch.commit();
  } catch (err) {
    console.warn('Non-fatal reminder deadline error:', err);
  }
}

// ==========================================
// 2. REMINDER JADWAL
// ==========================================
export async function checkScheduleReminders(classId: string) {
  try {
    const now = Date.now();
    const schedQ = query(collection(db, 'schedules'), where('classId', '==', classId));
    const schedSnap = await getDocs(schedQ);

    const batch = writeBatch(db);
    let hasNotif = false;

    for (const s of schedSnap.docs) {
      const schedule = s.data();
      const startTime = new Date(schedule.startAt).getTime();
      const diff = startTime - now;

      let reminderKey = '';
      if (diff > 20 * 3600000 && diff <= 24 * 3600000) reminderKey = 'H1';
      else if (diff > 30 * 60000 && diff <= 90 * 60000) reminderKey = 'H1JAM';
      if (!reminderKey) continue;

      const sentQ = query(
        collection(db, 'reminderLog'),
        where('itemId', '==', s.id),
        where('reminderKey', '==', reminderKey)
      );
      const sentSnap = await getDocs(sentQ);
      if (!sentSnap.empty) continue;

      const users = await fetchUsersByClass(classId);
      const recipients = users.filter(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return false;
        if (u.role === 'Admin' || u.role === 'Super Admin') return false;
        return true;
      });

      const label = reminderKey === 'H1' ? 'besok' : 'kurang dari 1 jam';

      recipients.forEach(r => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: r.uid,
          classId,
          title: 'Reminder Jadwal',
          message: `"${schedule.title}" — ${label} (${schedule.location})`,
          category: 'Reminder',
          read: false,
          link: 'jadwal',
          createdAt: new Date().toISOString(),
        });
        hasNotif = true;
      });

      const logRef = doc(collection(db, 'reminderLog'));
      batch.set(logRef, {
        id: logRef.id,
        itemId: s.id,
        itemType: 'schedule',
        reminderKey,
        sentAt: new Date().toISOString(),
      });
      hasNotif = true;
    }

    if (hasNotif) await batch.commit();
  } catch (err) {
    console.warn('Non-fatal reminder schedule error:', err);
  }
}

// ==========================================
// 3. REMINDER KAS
// ==========================================
export async function checkKasReminders(classId: string) {
  try {
    const now = Date.now();
    const kasQ = query(collection(db, 'kasSettings'), where('classId', '==', classId));
    const kasSnap = await getDocs(kasQ);

    if (kasSnap.empty) return;

    const batch = writeBatch(db);
    let hasNotif = false;

    for (const k of kasSnap.docs) {
      const setting = k.data();
      if (!setting.active) continue;

      const deadline = setting.deadline ? new Date(setting.deadline).getTime() : null;
      if (!deadline) continue;

      const diff = deadline - now;
      let reminderKey = '';
      if (diff > 66 * 3600000 && diff <= 72 * 3600000) reminderKey = 'H3';
      else if (diff > 20 * 3600000 && diff <= 24 * 3600000) reminderKey = 'H1';
      else if (diff < 0 && diff > -72 * 3600000) reminderKey = 'OVERDUE';
      if (!reminderKey) continue;

      const payQ = query(collection(db, 'kasPayments'), where('kasId', '==', k.id));
      const paySnap = await getDocs(payQ);
      const paidIds = new Set(paySnap.docs.filter(p => p.data().paid).map(p => p.data().studentId));

      const users = await fetchUsersByClass(classId);
      const unpaid = users.filter(u => {
        if (u.role === 'Guru Pengampu' || u.role === 'Guru Pembina') return false;
        if (u.role === 'Admin' || u.role === 'Super Admin') return false;
        return !paidIds.has(u.uid);
      });

      const label = reminderKey === 'H3' ? '3 hari lagi'
        : reminderKey === 'H1' ? 'besok'
        : 'sudah terlewat';

      unpaid.forEach(r => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: r.uid,
          classId,
          title: reminderKey === 'OVERDUE' ? 'Kas Terlambat' : 'Reminder Kas',
          message: `Pembayaran kas "${setting.title}" (Rp ${Number(setting.amount).toLocaleString('id-ID')}) — ${label}`,
          category: 'Reminder',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
        hasNotif = true;
      });

      const teachers = users.filter(u =>
        u.role === 'Bendahara' || u.role === 'Guru Pengampu' || u.role === 'Guru Pembina'
      );
      teachers.forEach(t => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: t.uid,
          classId,
          title: 'Laporan Kas',
          message: `${unpaid.length} siswa belum bayar kas "${setting.title}" — ${label}`,
          category: 'Keuangan',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
        hasNotif = true;
      });

      const logRef = doc(collection(db, 'reminderLog'));
      batch.set(logRef, {
        id: logRef.id,
        itemId: k.id,
        itemType: 'kas',
        reminderKey,
        sentAt: new Date().toISOString(),
      });
      hasNotif = true;
    }

    if (hasNotif) await batch.commit();
  } catch (err) {
    console.warn('Non-fatal reminder kas error:', err);
  }
}

// ==========================================
// 4. REMINDER BOOKING PENDING (>12 jam)
// ==========================================
export async function checkBookingReminders(classId: string) {
  try {
    const now = Date.now();

    const qBook = query(
      collection(db, 'bookings'),
      where('classId', '==', classId),
      where('status', '==', 'PENDING')
    );
    const bookSnap = await getDocs(qBook);
    if (bookSnap.empty) return;

    const users = await fetchUsersByClass(classId);
    const teachers = users.filter(u =>
      u.role === 'Guru Pengampu' || u.role === 'Guru Pembina' || u.role === 'Admin' || u.role === 'Super Admin'
    );
    if (teachers.length === 0) return;

    const batch = writeBatch(db);
    let hasNotif = false;

    for (const b of bookSnap.docs) {
      const booking = b.data();
      const createdTime = new Date(booking.createdAt).getTime();
      const hoursPending = (now - createdTime) / 3600000;

      if (hoursPending >= 12) {
        const reminderKey = 'PENDING_TEACHER_12H';

        const sentQ = query(
          collection(db, 'reminderLog'),
          where('itemId', '==', b.id),
          where('reminderKey', '==', reminderKey)
        );
        const sentSnap = await getDocs(sentQ);
        if (!sentSnap.empty) continue;

        teachers.forEach(t => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: t.uid,
            classId,
            title: 'Booking Menunggu Verifikasi',
            message: `Booking "${booking.equipmentName}" oleh ${booking.bookerName} sudah menunggu lebih dari 12 jam. Mohon segera diverifikasi.`,
            category: 'Tugas',
            read: false,
            link: 'welcome-booking',
            createdAt: new Date().toISOString(),
          });
          hasNotif = true;
        });

        const logRef = doc(collection(db, 'reminderLog'));
        batch.set(logRef, {
          id: logRef.id,
          itemId: b.id,
          itemType: 'booking',
          reminderKey,
          sentAt: new Date().toISOString(),
        });
        hasNotif = true;
      }
    }

    if (hasNotif) await batch.commit();
  } catch (err) {
    console.warn('Non-fatal reminder booking error:', err);
  }
}

// ==========================================
// 5. REMINDER BOOKING OVERDUE (BARU)
// Auto-mark CHECKED_OUT yang lewat toleransi 10 menit jadi OVERDUE
// ==========================================
export async function checkOverdueBookings(classId: string) {
  try {
    const now = Date.now();
    const q = query(collection(db, 'bookings'), where('classId', '==', classId));
    const snap = await getDocs(q);
    if (snap.empty) return;

    // Deteksi item overdue
    const overdueItems: any[] = [];
    snap.docs.forEach(d => {
      const b = d.data();
      if (b.status !== 'CHECKED_OUT' && b.status !== 'OVERDUE') return;

      const [eh, em] = (b.endTime || '00:00').split(':').map(Number);
      const endDt = new Date(b.date);
      endDt.setHours(eh || 0, em || 0, 0, 0);
      const deadline = endDt.getTime() + RETURN_TOLERANCE_MINUTES * 60000;

      if (now > deadline) {
        overdueItems.push({ id: d.id, ...b, overdueMs: now - deadline });
      }
    });

    if (overdueItems.length === 0) return;

    // Ambil guru untuk notifikasi
    const users = await fetchUsersByClass(classId);
    const teachers = users.filter(u =>
      u.role === 'Guru Pengampu' ||
      u.role === 'Guru Pembina' ||
      u.role === 'Admin' ||
      u.role === 'Super Admin'
    );

    const batch = writeBatch(db);
    let hasUpdate = false;

    for (const item of overdueItems) {
      const reminderKey = 'OVERDUE_BOOKING';

      // Cek log agar tidak spam
      const sentQ = query(
        collection(db, 'reminderLog'),
        where('itemId', '==', item.id),
        where('reminderKey', '==', reminderKey)
      );
      const sentSnap = await getDocs(sentQ);
      if (!sentSnap.empty) continue;

      // Tandai status OVERDUE jika masih CHECKED_OUT
      if (item.status === 'CHECKED_OUT') {
        batch.update(doc(db, 'bookings', item.id), {
          status: 'OVERDUE',
          markedOverdueAt: new Date().toISOString(),
        });
      }

      // Notif ke guru
      teachers.forEach(t => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: t.uid,
          classId,
          title: `Alat Terlambat: ${item.equipmentName}`,
          message: `${item.bookerName} (${item.className}) belum mengembalikan ${item.equipmentName}. Batas waktu ${item.endTime}, sudah terlewat. Segera hubungi siswa untuk pengembalian.`,
          category: 'Urgent',
          read: false,
          link: 'welcome-booking',
          createdAt: new Date().toISOString(),
        });
      });

      // Log
      const logRef = doc(collection(db, 'reminderLog'));
      batch.set(logRef, {
        id: logRef.id,
        itemId: item.id,
        itemType: 'booking_overdue',
        reminderKey,
        sentAt: new Date().toISOString(),
      });
      hasUpdate = true;
    }

    if (hasUpdate) await batch.commit();
  } catch (err) {
    console.warn('Non-fatal overdue booking error:', err);
  }
}

// ==========================================
// TRIGGER SEMUA REMINDER
// ==========================================
export async function runAllReminders(classId: string) {
  await Promise.allSettled([
    checkDeadlineReminders(classId),
    checkScheduleReminders(classId),
    checkKasReminders(classId),
    checkBookingReminders(classId),
    checkOverdueBookings(classId),
  ]);
}