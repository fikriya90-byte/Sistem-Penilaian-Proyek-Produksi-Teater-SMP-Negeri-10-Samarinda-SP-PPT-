// ===================================================
// REMINDER OTOMATIS
// Cek deadline/jadwal yang mendekat → kirim notifikasi
// ===================================================

import { collection, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../core/firebase';
import { fetchUsersByClass } from '../services/firestoreService';

// ==========================================
// REMINDER DEADLINE
// ==========================================
export async function checkDeadlineReminders(classId: string) {
  try {
    const now = Date.now();
    const deadQ = query(collection(db, 'deadlines'), where('classId', '==', classId));
    const deadSnap = await getDocs(deadQ);

    const batch = writeBatch(db);

    for (const d of deadSnap.docs) {
      const deadline = d.data();
      const dueTime = new Date(deadline.dueDate).getTime();
      const diff = dueTime - now;

      // H-3 (72 jam): antara 66-72 jam
      // H-1 (24 jam): antara 20-24 jam
      // H-1jam: antara 30-90 menit
      let reminderKey = '';
      if (diff > 66 * 3600000 && diff <= 72 * 3600000) reminderKey = 'H3';
      else if (diff > 20 * 3600000 && diff <= 24 * 3600000) reminderKey = 'H1';
      else if (diff > 30 * 60000 && diff <= 90 * 60000) reminderKey = 'H1JAM';
      else if (diff < 0 && diff > -24 * 3600000) reminderKey = 'OVERDUE';

      if (!reminderKey) continue;

      // Cek apakah reminder sudah pernah dikirim
      const sentQ = query(
        collection(db, 'reminderLog'),
        where('itemId', '==', d.id),
        where('reminderKey', '==', reminderKey)
      );
      const sentSnap = await getDocs(sentQ);
      if (!sentSnap.empty) continue;

      // Kirim reminder ke penerima
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
          title: reminderKey === 'OVERDUE' ? '⚠️ Deadline Terlewat!' : '⏰ Reminder Deadline',
          message: `"${deadline.title}" — ${label}`,
          category: 'Reminder',
          read: false,
          link: 'deadline',
          createdAt: new Date().toISOString(),
        });
      });

      // Tandai reminder sudah terkirim
      const logRef = doc(collection(db, 'reminderLog'));
      batch.set(logRef, {
        id: logRef.id,
        itemId: d.id,
        itemType: 'deadline',
        reminderKey,
        sentAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  } catch (err) {
    console.warn('Non-fatal reminder deadline error:', err);
  }
}

// ==========================================
// REMINDER JADWAL
// ==========================================
export async function checkScheduleReminders(classId: string) {
  try {
    const now = Date.now();
    const schedQ = query(collection(db, 'schedules'), where('classId', '==', classId));
    const schedSnap = await getDocs(schedQ);

    const batch = writeBatch(db);

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
          title: '📅 Reminder Jadwal',
          message: `"${schedule.title}" — ${label} (${schedule.location})`,
          category: 'Reminder',
          read: false,
          link: 'jadwal',
          createdAt: new Date().toISOString(),
        });
      });

      const logRef = doc(collection(db, 'reminderLog'));
      batch.set(logRef, {
        id: logRef.id,
        itemId: s.id,
        itemType: 'schedule',
        reminderKey,
        sentAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  } catch (err) {
    console.warn('Non-fatal reminder schedule error:', err);
  }
}

// ==========================================
// REMINDER KAS
// ==========================================
export async function checkKasReminders(classId: string) {
  try {
    const now = Date.now();
    // Ambil setting kas aktif
    const kasQ = query(collection(db, 'kasSettings'), where('classId', '==', classId));
    const kasSnap = await getDocs(kasQ);

    if (kasSnap.empty) return;

    const batch = writeBatch(db);

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

      // Ambil siswa yang belum bayar
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
          title: reminderKey === 'OVERDUE' ? '⚠️ Kas Terlambat' : '💰 Reminder Kas',
          message: `Pembayaran kas "${setting.title}" (Rp ${Number(setting.amount).toLocaleString('id-ID')}) — ${label}`,
          category: 'Reminder',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
      });

      // Notif ke Bendahara & Guru
      const teachers = users.filter(u =>
        u.role === 'Bendahara' || u.role === 'Guru Pengampu' || u.role === 'Guru Pembina'
      );
      teachers.forEach(t => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: t.uid,
          classId,
          title: '📊 Laporan Kas',
          message: `${unpaid.length} siswa belum bayar kas "${setting.title}" — ${label}`,
          category: 'Keuangan',
          read: false,
          link: 'kas',
          createdAt: new Date().toISOString(),
        });
      });

      const logRef = doc(collection(db, 'reminderLog'));
      batch.set(logRef, {
        id: logRef.id,
        itemId: k.id,
        itemType: 'kas',
        reminderKey,
        sentAt: new Date().toISOString(),
      });
    }

    await batch.commit();
  } catch (err) {
    console.warn('Non-fatal reminder kas error:', err);
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
  ]);
}
