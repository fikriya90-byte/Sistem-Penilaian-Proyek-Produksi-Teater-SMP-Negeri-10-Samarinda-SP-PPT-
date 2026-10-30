import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const originalMsg = (error instanceof Error ? error.message : String(error));
  console.error(`Firestore Error [${operationType}] on ${path}:`, originalMsg);

  // ✅ PERBAIKAN: Jangan lempar JSON panjang ke UI. Berikan pesan yang bisa dibaca siswa/guru.
  if (originalMsg.includes('Missing or insufficient permissions')) {
    throw new Error('Akses ditolak oleh aturan keamanan. Hubungi Admin/Guru.');
  }
  if (originalMsg.includes('requires an index')) {
    throw new Error('Database sedang sibuk/menyiapkan data. Tunggu 1 menit lalu coba lagi.');
  }
  if (originalMsg.includes('Unsupported field value: undefined')) {
    throw new Error('Data tidak lengkap (ada form yang kosong). Mohon periksa kembali.');
  }

  throw new Error(originalMsg || 'Terjadi kesalahan sistem.');
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection warning: client appears offline.');
    }
  }
}
testConnection();