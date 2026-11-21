// src/core/seedData.ts
import { doc, getDoc, getDocs, collection, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import {
  AttendanceSession,
  ClassRoom,
  ProductionDocument,
  ProductionProject,
  PromptBookScene,
  ScheduleEvent,
  SystemNotification,
  TaskItem,
  UserProfile,
} from './types';
import { ensureAdminAccount } from './adminBootstrap';

// ============================================================
// FLAG SEED — v5
// ============================================================
const SEED_FLAG_KEY = 'spppt_seed_done_v5';

export const DEMO_CLASSES: ClassRoom[] = [
  {
    id: 'id_34n2rdaofmuhz74a4',
    name: 'IX-C',
    code: 'IXC-8912',
    academicYear: '2025/2026',
    teacherId: 'teacher-fikri',
    teacherName: 'Fikri Yassaar Arrazaq, S.Sn.',
    totalStudents: 30,
    kerabatKerja: 'Gema Senandika Production',
  },
  {
    id: 'id_yep4ny7lzmuhz6tii',
    name: 'IX-B',
    code: 'IXB-3645',
    academicYear: '2025/2026',
    teacherId: 'teacher-fikri',
    teacherName: 'Fikri Yassaar Arrazaq, S.Sn.',
    totalStudents: 34,
  },
  {
    id: 'id_nvtmvj2w6muhz6l57',
    name: 'IX-A',
    code: 'IXA-4927',
    academicYear: '2025/2026',
    teacherId: 'teacher-fikri',
    teacherName: 'Fikri Yassaar Arrazaq, S.Sn.',
    totalStudents: 32,
  },
  {
    id: 'id_0fg1ase2fmuhz7b19',
    name: 'IX-D',
    code: 'IXD-7812',
    academicYear: '2025/2026',
    teacherId: 'teacher-fikri',
    teacherName: 'Fikri Yassaar Arrazaq, S.Sn.',
    totalStudents: 28,
  },
  {
    id: 'id_ztljq7w5omuhz7mkf',
    name: 'IX-E',
    code: 'IXE-5683',
    academicYear: '2025/2026',
    teacherId: 'teacher-fikri',
    teacherName: 'Fikri Yassaar Arrazaq, S.Sn.',
    totalStudents: 30,
  },
  {
    id: 'id_xsxwnvlqemuhz7stj',
    name: 'IX-F',
    code: 'IXF-6780',
    academicYear: '2025/2026',
    teacherId: 'teacher-fikri',
    teacherName: 'Fikri Yassaar Arrazaq, S.Sn.',
    totalStudents: 32,
  },
];

export const DEMO_PRODUCTIONS: ProductionProject[] = [
  {
    id: 'prod-ix-c',
    title: 'Gema Senandika: Titah Sang Ratu Aji Berdarah Putih',
    classId: 'id_34n2rdaofmuhz74a4',
    className: 'IX-C',
    schoolYear: '2025/2026',
    status: 'ACTIVE',
    currentStage: 'PELAKSANAAN',
    synopsis: 'Adaptasi folklor Kalimantan Timur tentang keteguhan Ratu Aji Bidara Putih menolak lamaran Raja Tiongkok demi menjaga kedaulatan tanah Muara Kaman.',
    theme: 'Keberanian, Kearifan Lokal, dan Harga Diri Bangsa',
    directorVision: 'Penyutradaraan bertumpu pada perpaduan gerak tari tradisi Kutai-Dayak dengan tata pencahayaan dramatik kontras tinggi.',
    startDate: '2026-08-01',
    performanceDate: '2026-11-20',
    endDate: '2026-12-05',
    createdAt: new Date().toISOString(),
  },
];

export const DEMO_USERS: UserProfile[] = [
  {
    uid: 'teacher-fikri',
    email: 'fikriya90@gmail.com',
    secondaryEmail: 'fikri.yassaar15@guru.smp.belajar.id',
    displayName: 'Fikri Yassaar Arrazaq, S.Sn.',
    role: 'Guru Pengampu',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    phone: '081255558899',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    nis: '198402152010011002',
  },
  {
    uid: 'student-dude',
    email: 'dude.masyud@gmail.com',
    displayName: 'Dude Masyud Tualeka',
    role: 'Pimpinan Produksi',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-inti',
    divisionName: 'Pengurus Inti',
    phone: '082199887766',
    photoURL: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    nis: '23240901',
  },
  {
    uid: 'student-chantika',
    email: 'chantikasetiawan18@icloud.com',
    displayName: 'Chantika Juliana Setiawan',
    role: 'Sekretaris',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-inti',
    divisionName: 'Pengurus Inti',
    phone: '081344556677',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    nis: '23240902',
  },
  {
    uid: 'student-naswa',
    email: 'indiatinaswa11@gmail.com',
    displayName: 'Naswa Izdihar',
    role: 'Bendahara',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-inti',
    divisionName: 'Pengurus Inti',
    phone: '085233445566',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    nis: '23240903',
  },
  {
    uid: 'student-nur-kasih',
    email: 'knur141011@gmail.com',
    displayName: 'Nur Kasih Oktavia',
    role: 'Sutradara',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-pemain',
    divisionName: 'Pemeran',
    phone: '081266778899',
    photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    nis: '23240904',
  },
  {
    uid: 'student-gredy',
    email: 'otnielgredy@gmail.com',
    displayName: 'Gredy Otniel Yeoh',
    role: 'Asisten Sutradara',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-pemain',
    divisionName: 'Pemeran',
    phone: '085288990011',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    nis: '23240905',
  },
  {
    uid: 'student-jelita',
    email: 'jelitathata1@gmail.com',
    displayName: 'Jelita Ramadhani Khotim',
    role: 'Koordinator Perlengkapan',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-perlengkapan',
    divisionName: 'Perlengkapan',
    phone: '081377889900',
    photoURL: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    nis: '23240906',
  },
  {
    uid: 'student-rivana',
    email: 'rusdirivana@gmail.com',
    displayName: 'Rivana Adelia Rusdi',
    role: 'Koordinator Publikasi',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-pubdok',
    divisionName: 'Publikasi & Dokumentasi',
    phone: '082166554433',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    nis: '23240907',
  },
  {
    uid: 'student-anjani',
    email: 'i.g562@sd.belajar.id',
    displayName: 'I.G.A.istri mas anjani Saraswati',
    role: 'Koordinator Tata Panggung',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-panggung',
    divisionName: 'Tata Panggung',
    phone: '085311223344',
    photoURL: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    nis: '23240908',
  },
  {
    uid: 'student-shaqinah',
    email: 'shalvat0reez@gmail.com',
    displayName: 'Shaqinah Adeela',
    role: 'Koordinator Tata Rias',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-rias',
    divisionName: 'Tata Rias',
    phone: '081299881122',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    nis: '23240909',
  },
  {
    uid: 'student-chika',
    email: 'chikaaimutlucuu@gmail.com',
    displayName: 'Al Chika Imeydita Mustika',
    role: 'Koordinator Tata Busana',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-busana',
    divisionName: 'Tata Busana',
    phone: '082177889911',
    nis: '23240910',
  },
  {
    uid: 'student-musik-koor',
    email: 'koor.musik@example.com',
    displayName: 'Rafi Pratama',
    role: 'Koordinator Tata Musik',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-musik',
    divisionName: 'Tata Musik & Suara',
    phone: '085244556677',
    nis: '23240911',
  },
  {
    uid: 'student-pemeran-1',
    email: 'pemeran1@example.com',
    displayName: 'Alya Putri',
    role: 'Pemeran',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-pemain',
    divisionName: 'Pemeran',
    phone: '082188990011',
    nis: '23240912',
  },
  {
    uid: 'student-pemeran-2',
    email: 'pemeran2@example.com',
    displayName: 'Budi Santoso',
    role: 'Pemeran',
    classId: 'id_34n2rdaofmuhz74a4',
    classIds: ['id_34n2rdaofmuhz74a4'],
    className: 'IX-C',
    divisionId: 'div-pemain',
    divisionName: 'Pemeran',
    phone: '082122334455',
    nis: '23240913',
  },
];

export const DEMO_TASKS: TaskItem[] = [];
export const DEMO_SCHEDULES: ScheduleEvent[] = [];
export const DEMO_NOTIFICATIONS: SystemNotification[] = [];
export const DEMO_PROMPT_BOOK: PromptBookScene[] = [];
export const DEMO_DOCUMENTS: ProductionDocument[] = [];
export const DEMO_ATTENDANCE: AttendanceSession[] = [];

// ============================================================
// CHECK AND SEED
// ============================================================
export async function checkAndSeedDatabase(): Promise<void> {
  try {
    // 1. Cek flag di localStorage
    const flagExists = (() => {
      try { return localStorage.getItem(SEED_FLAG_KEY) === 'done'; }
      catch { return false; }
    })();

    // 2. Cek apakah kelas demo sudah ada di Firestore
    let classExists = false;
    try {
      const classSnap = await getDoc(doc(db, 'classes', DEMO_CLASSES[0].id));
      classExists = classSnap.exists();
    } catch (err) {
      console.warn('Gagal cek kelas demo:', err);
    }

    // 3. Kalau sudah ada & flag sudah done → skip seed, tapi tetap coba bootstrap admin
    if (flagExists && classExists) {
      try { await ensureAdminAccount(); } catch (err) { console.warn('Admin bootstrap error:', err); }
      return;
    }

    // 4. Kalau belum ada → seed
    await performSeed();

    try { await ensureAdminAccount(); } catch (err) { console.warn('Admin bootstrap error:', err); }

    try { localStorage.setItem(SEED_FLAG_KEY, 'done'); }
    catch { /* ignore */ }
  } catch (err) {
    console.warn('checkAndSeedDatabase non-fatal error:', err);
  }
}

async function performSeed(): Promise<void> {
  const batch = writeBatch(db);

  DEMO_CLASSES.forEach(c => {
    const ref = doc(db, 'classes', c.id);
    batch.set(ref, c, { merge: true });
  });

  DEMO_PRODUCTIONS.forEach(p => {
    const ref = doc(db, 'productions', p.id);
    batch.set(ref, p, { merge: true });
  });

  DEMO_USERS.forEach(u => {
    const ref = doc(db, 'users', u.uid);
    batch.set(ref, u, { merge: true });
  });

  await batch.commit();
  console.log('Database seeded successfully.');
}

export async function forceSeedDatabase(): Promise<void> {
  try {
    try { localStorage.removeItem(SEED_FLAG_KEY); }
    catch { /* ignore */ }

    const batch = writeBatch(db);

    DEMO_CLASSES.forEach(c => {
      const ref = doc(db, 'classes', c.id);
      batch.set(ref, c, { merge: true });
    });

    DEMO_PRODUCTIONS.forEach(p => {
      const ref = doc(db, 'productions', p.id);
      batch.set(ref, p, { merge: true });
    });

    DEMO_USERS.forEach(u => {
      const ref = doc(db, 'users', u.uid);
      batch.set(ref, u, { merge: true });
    });

    await batch.commit();

    try { localStorage.setItem(SEED_FLAG_KEY, 'done'); }
    catch { /* ignore */ }

    console.log('Database force-seeded successfully.');
  } catch (err) {
    console.warn('forceSeedDatabase error:', err);
    throw err;
  }
}
