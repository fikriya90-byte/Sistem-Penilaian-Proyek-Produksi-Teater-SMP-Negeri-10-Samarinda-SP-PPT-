// ===================================================
// BACKUP & RESTORE UTILITY
// Export/Import data Firestore ke file JSON
// ===================================================

import {
  collection, getDocs, query, where, doc, setDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../core/firebase';

const BACKUP_COLLECTIONS = [
  'classes',
  'users',
  'productions',
  'tasks',
  'assessments',
  'assessmentHistory',
  'attendanceSessions',
  'attendanceRecords',
  'schedules',
  'scheduleConfirmations',
  'documents',
  'broadcasts',
  'complaints',
  'notifications',
  'promptBooks',
  'deadlines',
  'deadlineSubmissions',
  'kasSettings',
  'kasPayments',
  'properties',
  'musicCues',
  'faceCharts',
  'costumes',
  'auditLogs',
  'reminderLog',
  'driveSubmissions',
];

export interface BackupData {
  version: string;
  createdAt: string;
  classId: string;
  className: string;
  collections: Record<string, any[]>;
  stats: Record<string, number>;
}

// ==========================================
// BACKUP — Export ke JSON
// ==========================================
export async function createBackup(classId: string): Promise<BackupData> {
  const backup: BackupData = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    classId,
    className: '',
    collections: {},
    stats: {},
  };

  for (const col of BACKUP_COLLECTIONS) {
    try {
      const q = query(collection(db, col), where('classId', '==', classId));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      backup.collections[col] = items;
      backup.stats[col] = items.length;
    } catch (err) {
      console.warn(`Skip backup for ${col}:`, err);
      backup.collections[col] = [];
      backup.stats[col] = 0;
    }
  }

  return backup;
}

export function downloadBackupJSON(backup: BackupData, filename?: string) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `spppt-backup-${backup.className || 'kelas'}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// RESTORE — Import dari JSON
// ==========================================
export async function restoreBackup(backup: BackupData): Promise<{ restored: number; errors: string[] }> {
  let restored = 0;
  const errors: string[] = [];

  for (const [col, items] of Object.entries(backup.collections)) {
    if (!Array.isArray(items) || items.length === 0) continue;
    try {
      // Batch dalam ukuran 400 (limit Firestore 500)
      for (let i = 0; i < items.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = items.slice(i, i + 400);
        chunk.forEach((item: any) => {
          if (!item.id) return;
          const ref = doc(db, col, item.id);
          batch.set(ref, item, { merge: true });
        });
        await batch.commit();
        restored += chunk.length;
      }
    } catch (err: any) {
      errors.push(`${col}: ${err?.message || 'Unknown error'}`);
    }
  }

  return { restored, errors };
}

export async function validateBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.version || !data.collections) {
          reject(new Error('File bukan backup SP-PPT yang valid'));
          return;
        }
        resolve(data as BackupData);
      } catch (err) {
        reject(new Error('File JSON rusak atau tidak valid'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file);
  });
}
