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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // ✅ PERBAIKAN: Lempar pesan yang mudah dibaca ke Toast UI, 
  // jangan lempar JSON panjang.
  const originalMsg = (error instanceof Error ? error.message : String(error));
  
  if (originalMsg.includes('Missing or insufficient permissions')) {
    throw new Error('Akses ditolak oleh aturan keamanan (Rules). Hubungi Admin.');
  }
  if (originalMsg.includes('requires an index')) {
    throw new Error('Database belum siap (index belum dibangun). Tunggu 1-2 menit lalu coba lagi.');
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