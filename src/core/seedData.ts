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
    role: 'Guru Pembina',
    classId: 'id_34n2rdaofmuhz74a4',
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
    className: 'IX-C',
    divisionId: 'div-busana',
    divisionName: 'Tata Busana',
    phone: '082233445577',
    photoURL: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    nis: '23240910',
  },
  {
    uid: 'student-naufal',
    email: 'mnaufalnizar08@gmail.com',
    displayName: 'Muhammad Naufal Nizar Farraas',
    role: 'Koordinator Tata Musik',
    classId: 'id_34n2rdaofmuhz74a4',
    className: 'IX-C',
    divisionId: 'div-musik',
    divisionName: 'Tata Musik & Suara',
    phone: '081233221100',
    photoURL: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    nis: '23240911',
  },
  {
    uid: 'student-alpine',
    email: 'alpinealfarizi1@gmail.com',
    displayName: 'alpine alfarizi',
    role: 'Pemain',
    classId: 'id_34n2rdaofmuhz74a4',
    className: 'IX-C',
    divisionId: 'div-pemain',
    divisionName: 'Pemeran',
    phone: '081388776655',
    photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    nis: '23240912',
  },
  {
    uid: 'student-fatan-ix-b',
    email: 'fatan.shezan@gmail.com',
    displayName: 'Muhammad Fatan Nur Azka',
    role: 'Pimpinan Produksi',
    classId: 'id_yep4ny7lzmuhz6tii',
    className: 'IX-B',
    divisionId: 'div-inti',
    divisionName: 'Pengurus Inti',
    phone: '081299883344',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    nis: '23240921',
  },
  {
    uid: 'student-alea-ix-b',
    email: 'alearaika1214@gmail.com',
    displayName: 'Alea Raika Zalfanadhifa R.T.',
    role: 'Sekretaris',
    classId: 'id_yep4ny7lzmuhz6tii',
    className: 'IX-B',
    divisionId: 'div-inti',
    divisionName: 'Pengurus Inti',
    phone: '081388992211',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    nis: '23240922',
  },
  {
    uid: 'student-syamira-ix-b',
    email: 'syamiralouly88@gmail.com',
    displayName: 'Syamira Maulida Humaira',
    role: 'Bendahara',
    classId: 'id_yep4ny7lzmuhz6tii',
    className: 'IX-B',
    divisionId: 'div-inti',
    divisionName: 'Pengurus Inti',
    phone: '085277889900',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    nis: '23240923',
  },
];

export async function checkAndSeedDatabase() {
  try {
    const classesSnap = await getDocs(collection(db, 'classes'));
    if (classesSnap.size > 0) {
      // Kelas sudah ada, jangan timpa
      return;
    }
    console.log('Seeding initial theater database (classes + productions only)...');
    await forceSeedDatabase();
  } catch (error) {
    console.error('Error during database check/seed:', error);
  }
}

export async function forceSeedDatabase() {
  const batch = writeBatch(db);

  // 1. Classes
  for (const c of DEMO_CLASSES) {
    batch.set(doc(db, 'classes', c.id), c);
  }

  // 2. Productions
  for (const p of DEMO_PRODUCTIONS) {
    batch.set(doc(db, 'productions', p.id), p);
  }

  // 3. Tasks & Deadlines (Simulate real due dates: some overdue, some <24h, some upcoming)
  const now = new Date();
  const sampleTasks: TaskItem[] = [
    {
      id: 'task-1',
      classId: 'class-ix-a',
      productionId: 'prod-ix-a',
      stageId: 'PELAKSANAAN',
      divisionId: 'div-pemain',
      divisionName: 'Pemeran',
      role: 'Pemain',
      assigneeId: 'student-pemain-1',
      assigneeName: 'Siti Nurhaliza (Pemeran Ratu Aji Bidara Putih)',
      title: 'Hafalan Penuh Dialog Babak 2 (Adegan Penolakan Lamaran)',
      description: 'Menghafal 3 halaman monolog dan dialog emosional dengan utusan saudagar tanpa membaca naskah.',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      progress: 75,
      dueDate: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString(), // < 24h
      createdBy: 'student-sutradara',
      creatorName: 'Bima Satria Nusantara (Sutradara)',
      createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
    },
    {
      id: 'task-2',
      classId: 'class-ix-a',
      productionId: 'prod-ix-a',
      stageId: 'PELAKSANAAN',
      divisionId: 'div-perlengkapan',
      divisionName: 'Perlengkapan',
      role: 'Koordinator Perlengkapan',
      assigneeId: 'student-kor-perlengkapan',
      assigneeName: 'Rizky Mahendra',
      title: 'Pembuatan Keris Pusaka & Mahkota Ratu Aji (Kertas Mache & Kayu)',
      description: 'Membuat properti simbol kebesaran istana kerajaan Kutai kuno sesuai sketsa artistik.',
      priority: 'HIGH',
      status: 'APPROVED',
      progress: 100,
      dueDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      proofUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
      proofNote: 'Keris selesai dicat emas dan mahkota dilapisi batu imitasi.',
      feedback: 'Sangat rapi dan kokoh untuk digunakan di atas panggung.',
      createdBy: 'student-pimprod',
      creatorName: 'Ahmad Fauzan (Pimprod)',
      createdAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
    },
    {
      id: 'task-3',
      classId: 'class-ix-a',
      productionId: 'prod-ix-a',
      stageId: 'PELAKSANAAN',
      divisionId: 'div-busana',
      divisionName: 'Tata Busana',
      role: 'Koordinator Tata Busana',
      assigneeId: 'student-kor-busana',
      assigneeName: 'Alya Salsabila',
      title: 'Fitting Perdana Gaun Kebesaran Putih & Jubah Panglima',
      description: 'Pengukuran dan penyesuaian kelenturan jahitan agar pemain leluasa bergerak saat adegan silat.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      progress: 60,
      dueDate: new Date(now.getTime() + 3 * 86400000).toISOString(),
      createdBy: 'student-pimprod',
      creatorName: 'Ahmad Fauzan (Pimprod)',
      createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
    },
    {
      id: 'task-4',
      classId: 'class-ix-a',
      productionId: 'prod-ix-a',
      stageId: 'PELAKSANAAN',
      divisionId: 'div-pubdok',
      divisionName: 'Publikasi & Dokumentasi',
      role: 'Koordinator Publikasi',
      assigneeId: 'student-kor-pubdok',
      assigneeName: 'Clarissa Maharani',
      title: 'Peluncuran Poster Resmi Produksi Teater H-30',
      description: 'Cetak poster A3 untuk mading sekolah dan rilis teaser visual feed Instagram.',
      priority: 'MEDIUM',
      status: 'SUBMITTED',
      progress: 90,
      dueDate: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      proofUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      proofNote: 'Poster digital selesai dan sudah di-review tim guru seni.',
      createdBy: 'student-pimprod',
      creatorName: 'Ahmad Fauzan (Pimprod)',
      createdAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
    },
    {
      id: 'task-5',
      classId: 'class-ix-a',
      productionId: 'prod-ix-a',
      stageId: 'PELAKSANAAN',
      divisionId: 'div-musik',
      divisionName: 'Tata Musik & Suara',
      role: 'Koordinator Tata Musik',
      assigneeId: 'student-kor-musik',
      assigneeName: 'Bayu Wibisono',
      title: 'Kompilasi Sound Cue Sheet & Perekaman Sape Pengiring Perang',
      description: 'Menyusun daftar 10 track audio latar dan efek suara gemuruh ombak dan teriakan prajurit.',
      priority: 'HIGH',
      status: 'OVERDUE',
      progress: 40,
      dueDate: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // Past due
      createdBy: 'student-sutradara',
      creatorName: 'Bima Satria Nusantara (Sutradara)',
      createdAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
    },
  ];

  for (const t of sampleTasks) {
    batch.set(doc(db, 'tasks', t.id), t);
  }

  // 4. Attendance Sessions
  const sampleSessions: AttendanceSession[] = [
    {
      id: 'att-session-1',
      title: 'Rapat Pleno Koordinasi Lintas Divisi',
      classId: 'class-ix-a',
      activityType: 'Rapat',
      date: new Date().toISOString().slice(0, 10),
      startTime: '14:30',
      endTime: '16:00',
      location: 'Ruang Teater / Aula Lantai 2 SMPN 10',
      targetScope: 'SEMUA',
      createdBy: 'student-pimprod',
      creatorRole: 'Pimpinan Produksi',
      creatorName: 'Ahmad Fauzan Syahputra',
      agenda: 'Evaluasi progres pekan ke-3 tahap pelaksanaan dan sinkronisasi tata panggung dengan gerak pemain.',
      isOpen: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'att-session-2',
      title: 'Latihan Rutin Blocking Babak 2 & Sound Cue',
      classId: 'class-ix-a',
      activityType: 'Latihan',
      date: new Date().toISOString().slice(0, 10),
      startTime: '16:15',
      endTime: '17:45',
      location: 'Panggung Terbuka SMPN 10 Samarinda',
      targetScope: 'PEMAIN_MUSIK', // Locked for Sutradara
      createdBy: 'student-sutradara',
      creatorRole: 'Sutradara',
      creatorName: 'Bima Satria Nusantara',
      agenda: 'Latihan transisi pemain dan sinkronisasi tempo sape Kalimantan saat babak pertikaian.',
      isOpen: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'att-session-3',
      title: 'Produksi Internal Pembuatan Properti Kerajaan',
      classId: 'class-ix-a',
      activityType: 'Produksi',
      date: new Date().toISOString().slice(0, 10),
      startTime: '13:00',
      endTime: '15:30',
      location: 'Workshop Kesenian SMPN 10',
      targetScope: 'DIVISI', // Locked to Perlengkapan
      targetDivisionId: 'div-perlengkapan',
      targetDivisionName: 'Perlengkapan',
      createdBy: 'student-kor-perlengkapan',
      creatorRole: 'Koordinator Perlengkapan',
      creatorName: 'Rizky Mahendra',
      agenda: 'Finishing cat perisai kayu dan tombak prajurit pengawal istana.',
      isOpen: true,
      createdAt: new Date().toISOString(),
    },
  ];

  for (const s of sampleSessions) {
    batch.set(doc(db, 'attendanceSessions', s.id), s);
  }

  // 5. Schedules
  const sampleSchedules: ScheduleEvent[] = [
    {
      id: 'sch-1',
      title: 'Gladi Kotor Seluruh Babak 1 & 2',
      classId: 'class-ix-a',
      type: 'Gladi',
      startAt: new Date(now.getTime() + 2 * 86400000).toISOString(),
      endAt: new Date(now.getTime() + 2 * 86400000 + 7200000).toISOString(),
      location: 'Gedung Kesenian SMPN 10 Samarinda',
      participants: 'Semua Pemeran, Musik, Busana, dan Panggung',
      pic: 'Bima Satria (Sutradara)',
      description: 'Uji coba transisi babak dan pergantian kostum cepat kurang dari 2 menit.',
      createdBy: 'student-sutradara',
      creatorName: 'Bima Satria Nusantara',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sch-2',
      title: 'Fitting Busana Final & Uji Tata Rias Karakter',
      classId: 'class-ix-a',
      type: 'Fitting',
      startAt: new Date(now.getTime() + 4 * 86400000).toISOString(),
      endAt: new Date(now.getTime() + 4 * 86400000 + 5400000).toISOString(),
      location: 'Ruang Rias & Ganti Panggung',
      participants: 'Divisi Tata Rias, Tata Busana, dan Semua Pemeran',
      pic: 'Alya Salsabila & Tiara Ayuningtyas',
      description: 'Face chart test dan pengecekan ketahanan rias terhadap lampu sorot panggung.',
      createdBy: 'student-kor-busana',
      creatorName: 'Alya Salsabila',
      createdAt: new Date().toISOString(),
    },
  ];

  for (const sc of sampleSchedules) {
    batch.set(doc(db, 'schedules', sc.id), sc);
  }

  // 7. Documents
  const sampleDocs: ProductionDocument[] = [
    {
      id: 'doc-1',
      classId: 'class-ix-a',
      title: 'Naskah Resmi: Titah Ratu Aji Bidara Putih (Edisi Revisi 3)',
      category: 'Naskah Drama',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: '1.8 MB',
      fileType: 'application/pdf',
      uploadedBy: 'student-sutradara',
      uploaderName: 'Bima Satria Nusantara',
      uploaderRole: 'Sutradara',
      createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
    },
    {
      id: 'doc-2',
      classId: 'class-ix-a',
      title: 'Proposal Proyek Produksi Seni Teater Kelas IX A',
      category: 'Proposal',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: '3.4 MB',
      fileType: 'application/pdf',
      uploadedBy: 'student-pimprod',
      uploaderName: 'Ahmad Fauzan Syahputra',
      uploaderRole: 'Pimpinan Produksi',
      createdAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
    },
  ];

  for (const d of sampleDocs) {
    batch.set(doc(db, 'documents', d.id), d);
  }

  // 7. Notifications
  const sampleNotifications: SystemNotification[] = [
    {
      id: 'notif-1',
      userId: 'student-pimprod',
      classId: 'class-ix-a',
      title: 'Tenggat Waktu Kritis (< 24 Jam)',
      message: 'Tugas "Hafalan Penuh Dialog Babak 2" tersisa kurang dari 18 jam.',
      category: 'Urgent',
      read: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      userId: 'student-pimprod',
      classId: 'class-ix-a',
      title: 'Pengingat Rapat Pleno Hari Ini',
      message: 'Rapat Pleno Koordinasi Lintas Divisi dijadwalkan pukul 14:30 di Ruang Teater Aula Lantai 2.',
      category: 'Reminder',
      read: false,
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
    },
    {
      id: 'notif-3',
      userId: 'teacher-fikri',
      classId: 'class-ix-a',
      title: 'Bukti Tugas Dikirim untuk Verifikasi',
      message: 'Koordinator Publikasi telah mengunggah bukti cetak poster promosi.',
      category: 'Tugas',
      read: false,
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
    },
  ];

  for (const n of sampleNotifications) {
    batch.set(doc(db, 'notifications', n.id), n);
  }

  // 8. Prompt book initial scene
  const samplePromptBook: PromptBookScene = {
    id: 'pb-scene-1',
    classId: 'class-ix-a',
    scene: 'Babak 2 Adegan 1: Penolakan Utusan Saudagar Tiongkok',
    gridPositions: {
      'student-pemain-1': 'UC', // Ratu Aji di Upstage Center (Singgasana)
      'student-pemain-2': 'CR', // Panglima di Center Right
    },
    notes: 'Ratu Aji tetap tegak tidak berdiri dari singgasana saat utusan masuk. Suasana hening mencekam.',
    cues: [
      { code: 'CUE-01', action: 'Lampu utama menyorot singgasana putih', timing: '00:00:15', soundLight: 'Spotlight Emas' },
      { code: 'CUE-02', action: 'Petikan lambat sape intro duka', timing: '00:01:10', soundLight: 'Audio Track 03 (Fade In)' },
      { code: 'CUE-03', action: 'Gong istana berbunyi keras tanda penolakan', timing: '00:04:30', soundLight: 'Audio Track 07 (SFX)' },
    ],
    updatedBy: 'student-asisten',
    updatedAt: new Date().toISOString(),
  };

  batch.set(doc(db, 'promptBooks', samplePromptBook.id), samplePromptBook);

  await batch.commit();
  console.log('Database seeded successfully with realistic theater project data!');
}
