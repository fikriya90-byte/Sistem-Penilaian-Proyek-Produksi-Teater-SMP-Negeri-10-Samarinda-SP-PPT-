import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, Clock, Mic, Music, Play, Save,
  Sparkles, Square, Users, ExternalLink, Upload, Link2,
  FileText, X, Wand2, Trash2, Edit3, AlertTriangle,
  Rocket, Download, Eye, Lock, ShieldAlert, Search, Filter,
  PlusCircle, Headphones, Volume2,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIALOG_PRACTICE_STEPS } from '../../core/constants';
import { UserProfile } from '../../core/types';
import { fetchUsersByClass, recordAuditLog } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import {
  doc, setDoc, onSnapshot, deleteDoc, collection, query, where,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

const SANDIMA_GENERATOR_URL = 'https://spanluh-sandima-generator-naskah.netlify.app/';

// ═══════════════════════════════════════════════════════
// TIPE DATA
// ═══════════════════════════════════════════════════════
interface ScriptData {
  id: string;
  classId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  notes: string;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole: string;
  uploadedAt: string;
}

type MusicCategory = 'PEMBUKA' | 'PENUTUP' | 'ILUSTRASI' | 'TRANSISI' | 'TARI' | 'LAINNYA';
type MusicSource = 'SANDIMA' | 'TRADISIONAL' | 'MODERN' | 'EKSTERNAL' | 'LAINNYA';

interface MusicReference {
  id: string;
  classId: string;
  title: string;
  description: string;
  audioUrl: string;
  category: MusicCategory;
  source: MusicSource;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole: string;
  createdAt: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════════
// KONFIGURASI
// ═══════════════════════════════════════════════════════
const CATEGORY_CONFIG: Record<MusicCategory, { label: string; color: string }> = {
  PEMBUKA:   { label: 'Musik Pembuka',    color: 'bg-amber-100 text-amber-800 border-amber-300' },
  PENUTUP:   { label: 'Musik Penutup',    color: 'bg-rose-100 text-rose-800 border-rose-300' },
  ILUSTRASI: { label: 'Musik Ilustrasi',  color: 'bg-blue-100 text-blue-800 border-blue-300' },
  TRANSISI:  { label: 'Musik Transisi',   color: 'bg-purple-100 text-purple-800 border-purple-300' },
  TARI:      { label: 'Musik Tari',       color: 'bg-pink-100 text-pink-800 border-pink-300' },
  LAINNYA:   { label: 'Lainnya',          color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const SOURCE_CONFIG: Record<MusicSource, { label: string; color: string }> = {
  SANDIMA:     { label: 'Sandima',         color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  TRADISIONAL: { label: 'Tradisional',     color: 'bg-orange-100 text-orange-800 border-orange-300' },
  MODERN:      { label: 'Modern',          color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  EKSTERNAL:   { label: 'Eksternal',       color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  LAINNYA:     { label: 'Lainnya',         color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

// ═══════════════════════════════════════════════════════
// HELPER URL
// ═══════════════════════════════════════════════════════
function getDriveFileId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([^/?]+)/,
    /\/d\/([^/?]+)/,
    /id=([^&]+)/,
    /folders\/([^/?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function buildPreviewUrl(url: string): string | null {
  const id = getDriveFileId(url);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

// Link download langsung (tanpa buka Drive viewer)
function buildDownloadUrl(url: string): string {
  const id = getDriveFileId(url);
  if (id) {
    // Format direct download dari Google Drive
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return url;
}

function isDirectAudioUrl(url: string): boolean {
  if (!url) return false;
  return /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)(\?|#|$)/i.test(url);
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

type PlayableType = 'audio' | 'youtube' | 'drive' | 'external';

function getPlayableType(url: string): PlayableType {
  if (!url) return 'external';
  if (isDirectAudioUrl(url)) return 'audio';
  if (getYouTubeId(url)) return 'youtube';
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) return 'drive';
  return 'external';
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export const StudioModule: React.FC = () => {
  const { user, activeClass, isSutradara, isAsisten, isTeacher, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'script' | 'music' | 'dialog' | 'recorder' | 'timers'>('script');
  const [actors, setActors] = useState<UserProfile[]>([]);

  // ============ SCRIPT / NASKAH ============
  const [script, setScript] = useState<ScriptData | null>(null);
  const [scriptLoading, setScriptLoading] = useState(true);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [scriptFileName, setScriptFileName] = useState('');
  const [scriptNotes, setScriptNotes] = useState('');
  const [savingScript, setSavingScript] = useState(false);
  const [deletingScript, setDeletingScript] = useState(false);

  // ============ RECORDER ============
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ============ TIMER ============
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // ============ MUSIC REFERENCE ============
  const [musicRefs, setMusicRefs] = useState<MusicReference[]>([]);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [editingMusic, setEditingMusic] = useState<MusicReference | null>(null);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicDescription, setMusicDescription] = useState('');
  const [musicUrl, setMusicUrl] = useState('');
  const [musicCategory, setMusicCategory] = useState<MusicCategory>('ILUSTRASI');
  const [musicSource, setMusicSource] = useState<MusicSource>('SANDIMA');
  const [savingMusic, setSavingMusic] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const [musicFilterCategory, setMusicFilterCategory] = useState<'ALL' | MusicCategory>('ALL');

  // ═══════════════════════════════════════════════════════
  // PERMISSION
  // ═══════════════════════════════════════════════════════
  const canManageScript = !!user && (
    isSutradara ||
    isAsisten ||
    isGuruPengampu ||
    isTeacher ||
    isAdminRole ||
    user.role === 'Guru Pengampu' ||
    user.role === 'Guru Pembina' ||
    user.role === 'Admin' ||
    user.role === 'Super Admin'
  );

  const canViewScript = !!user;

  const canManageMusic = !!user && (
    isGuruPengampu ||
    isTeacher ||
    isAdminRole ||
    isSutradara ||
    isAsisten ||
    user.role === 'Guru Pengampu' ||
    user.role === 'Guru Pembina' ||
    user.role === 'Admin' ||
    user.role === 'Super Admin' ||
    user.role === 'Koordinator Tata Musik' ||
    user.role === 'Anggota Tata Musik'
  );

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(u => {
      setActors(u.filter(s =>
        s.role === 'Pemeran' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara'
      ));
    });
  }, [activeClass]);

  // Subscribe naskah
  useEffect(() => {
    if (!activeClass) return;
    setScriptLoading(true);
    const ref = doc(db, 'scripts', activeClass.id);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setScript({ ...snap.data(), id: snap.id } as ScriptData);
      } else {
        setScript(null);
      }
      setScriptLoading(false);
    });
    return () => unsub();
  }, [activeClass]);

  // Subscribe musik
  useEffect(() => {
    if (!activeClass) return;
    const q = query(
      collection(db, 'musicReferences'),
      where('classId', '==', activeClass.id)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as MusicReference));
      list.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setMusicRefs(list);
    });
    return () => unsub();
  }, [activeClass]);

  // ============ SCRIPT HANDLERS ============
  const handleOpenScriptModal = (existing?: ScriptData) => {
    if (!canManageScript) {
      showToast('Hanya Sutradara, Asisten Sutradara, dan Guru yang dapat mengelola naskah.', 'warning');
      return;
    }
    if (existing) {
      setScriptTitle(existing.title);
      setScriptUrl(existing.fileUrl);
      setScriptFileName(existing.fileName);
      setScriptNotes(existing.notes);
    } else {
      setScriptTitle('');
      setScriptUrl('');
      setScriptFileName('');
      setScriptNotes('');
    }
    setIsScriptModalOpen(true);
  };

  const handleSaveScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!canManageScript) {
      showToast('Anda tidak berwenang mengelola naskah.', 'warning');
      return;
    }
    if (!scriptTitle.trim() || !scriptUrl.trim()) {
      showToast('Judul dan link naskah wajib diisi.', 'warning');
      return;
    }

    setSavingScript(true);
    try {
      const ref = doc(db, 'scripts', activeClass.id);
      await setDoc(ref, {
        id: activeClass.id,
        classId: activeClass.id,
        title: scriptTitle.trim(),
        fileUrl: scriptUrl.trim(),
        fileName: scriptFileName.trim() || 'naskah.pdf',
        notes: scriptNotes.trim(),
        uploadedBy: user.uid,
        uploaderName: user.displayName,
        uploaderRole: user.role,
        uploadedAt: new Date().toISOString(),
      }, { merge: true });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: script ? 'UPDATE' : 'CREATE',
        targetType: 'Script', targetId: activeClass.id,
        details: `${script ? 'Update' : 'Upload'} naskah: "${scriptTitle}"`,
      });

      showToast('Naskah berhasil disimpan!', 'success');
      setIsScriptModalOpen(false);
    } catch (err: any) {
      showToast('Gagal simpan naskah: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSavingScript(false);
    }
  };

  const handleDeleteScript = async () => {
    if (!activeClass || !user) return;
    if (!canManageScript) {
      showToast('Anda tidak berwenang menghapus naskah.', 'warning');
      return;
    }
    if (!confirm('Hapus naskah kelas ini?')) return;

    setDeletingScript(true);
    try {
      await deleteDoc(doc(db, 'scripts', activeClass.id));
      showToast('Naskah dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setDeletingScript(false);
    }
  };

  const handleOpenGenerator = () => {
    window.open(SANDIMA_GENERATOR_URL, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadScript = () => {
    if (!script?.fileUrl) return;
    const url = buildDownloadUrl(script.fileUrl);
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('Naskah diunduh / dibuka di tab baru.', 'info');
  };

  // ============ MUSIC HANDLERS ============
  const openCreateMusic = () => {
    if (!canManageMusic) {
      showToast('Hanya Guru, Sutradara, dan Divisi Tata Musik yang dapat mengelola referensi musik.', 'warning');
      return;
    }
    setEditingMusic(null);
    setMusicTitle('');
    setMusicDescription('');
    setMusicUrl('');
    setMusicCategory('ILUSTRASI');
    setMusicSource('SANDIMA');
    setIsMusicModalOpen(true);
  };

  const openEditMusic = (item: MusicReference) => {
    if (!canManageMusic) return;
    setEditingMusic(item);
    setMusicTitle(item.title);
    setMusicDescription(item.description || '');
    setMusicUrl(item.audioUrl);
    setMusicCategory(item.category);
    setMusicSource(item.source);
    setIsMusicModalOpen(true);
  };

  const handleSaveMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!canManageMusic) {
      showToast('Anda tidak berwenang mengelola referensi musik.', 'warning');
      return;
    }
    if (!musicTitle.trim()) {
      showToast('Judul referensi wajib diisi.', 'warning');
      return;
    }
    if (!musicUrl.trim()) {
      showToast('Link audio wajib diisi.', 'warning');
      return;
    }
    if (!musicUrl.startsWith('http')) {
      showToast('Link harus dimulai dengan http:// atau https://', 'warning');
      return;
    }

    setSavingMusic(true);
    try {
      const id = editingMusic?.id || doc(collection(db, 'musicReferences')).id;
      const data: MusicReference = {
        id,
        classId: activeClass.id,
        title: musicTitle.trim(),
        description: musicDescription.trim(),
        audioUrl: musicUrl.trim(),
        category: musicCategory,
        source: musicSource,
        uploadedBy: editingMusic?.uploadedBy || user.uid,
        uploaderName: editingMusic?.uploaderName || user.displayName,
        uploaderRole: editingMusic?.uploaderRole || user.role,
        createdAt: editingMusic?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'musicReferences', id), data, { merge: true });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editingMusic ? 'UPDATE' : 'CREATE',
        targetType: 'MusicReference', targetId: id,
        details: `${editingMusic ? 'Edit' : 'Tambah'} referensi musik: "${musicTitle}"`,
      });

      showToast(`Referensi musik ${editingMusic ? 'diperbarui' : 'ditambahkan'}!`, 'success');
      setIsMusicModalOpen(false);
    } catch (err: any) {
      showToast('Gagal simpan: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSavingMusic(false);
    }
  };

  const handleDeleteMusic = async (item: MusicReference) => {
    if (!user || !canManageMusic) return;
    if (!confirm(`Hapus referensi "${item.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'musicReferences', item.id));
      showToast('Referensi dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // 🎯 DOWNLOAD AUDIO — PRIORITAS UTAMA UNTUK SISWA
  const handleDownloadMusic = (item: MusicReference) => {
    const type = getPlayableType(item.audioUrl);

    if (type === 'youtube') {
      // YouTube tidak bisa download langsung — arahkan ke YouTube
      showToast('YouTube tidak bisa diunduh langsung. Buka YouTube dan download via app/web.', 'info');
      window.open(item.audioUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Semua tipe lain: pakai buildDownloadUrl (khusus Drive → direct download)
    const downloadUrl = buildDownloadUrl(item.audioUrl);
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    showToast(`🎵 "${item.title}" sedang diunduh...`, 'success');
  };

  const filteredMusic = musicRefs.filter(m => {
    if (musicFilterCategory !== 'ALL' && m.category !== musicFilterCategory) return false;
    if (musicSearch.trim()) {
      const q = musicSearch.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.uploaderName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ============ RECORDER ============
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      showToast('Perekaman suara dialog dimulai...', 'info');
    } catch (err) {
      showToast('Izin mikrofon diperlukan.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      showToast('Rekaman suara disimpan sementara!', 'success');
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => setTimerSeconds(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Sparkles className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Studio Teater & Peranti Artistik
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Naskah, Referensi Musik, Perekam Suara, Latihan 10 Langkah, & Timer
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300">
          <button onClick={() => setActiveTab('script')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'script' ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            📜 Naskah
          </button>
          <button onClick={() => setActiveTab('music')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'music' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            🎵 Referensi Musik
          </button>
          <button onClick={() => setActiveTab('dialog')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'dialog' ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            🗣️ 10 Langkah
          </button>
          <button onClick={() => setActiveTab('recorder')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'recorder' ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            🎙️ Rekam
          </button>
          <button onClick={() => setActiveTab('timers')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'timers' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            ⏱️ Timer
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* TAB: NASKAH */}
      {/* ============================================ */}
      {activeTab === 'script' && (
        <div className="space-y-5">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white shadow-xl border border-indigo-500/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="p-3 rounded-2xl bg-white/10 border border-white/20 shrink-0">
                  <Wand2 className="w-7 h-7 text-amber-300" />
                </span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    Generator AI
                  </span>
                  <h3 className="text-lg font-black mt-1">Generator Naskah Teater SANDIMA</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Sandiwara Mamanda Samarinda Berbasis Kecerdasan Artifisial
                  </p>
                </div>
              </div>
              <button onClick={handleOpenGenerator}
                className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shrink-0 transition hover:scale-105">
                <Rocket className="w-4 h-4" />
                Buka Generator
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {scriptLoading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slate-400">Memuat naskah...</p>
            </div>
          ) : script ? (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <span className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                        Naskah Aktif
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
                        {script.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <Users className="w-3.5 h-3.5" />
                        <strong className="text-slate-700 dark:text-slate-300">{script.uploaderName}</strong>
                        <span>({script.uploaderRole})</span>
                        <span className="text-slate-400">•</span>
                        <Clock className="w-3 h-3" />
                        {new Date(script.uploadedAt).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                    {script.fileName}
                  </span>
                </div>

                {script.notes && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 italic">
                    "{script.notes}"
                  </div>
                )}
              </div>

              <div className="px-6 pb-4 flex flex-wrap gap-2">
                <button onClick={handleDownloadScript}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition">
                  <Download className="w-4 h-4" /> Download Naskah
                </button>
                <button onClick={() => setIsPreviewOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition">
                  <Eye className="w-4 h-4" /> Pratinjau
                </button>
                <a href={script.fileUrl} target="_blank" rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition">
                  <ExternalLink className="w-4 h-4" /> Buka di Tab Baru
                </a>

                {canManageScript && (
                  <>
                    <button onClick={() => handleOpenScriptModal(script)}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition">
                      <Edit3 className="w-4 h-4" /> Ganti Naskah
                    </button>
                    <button onClick={handleDeleteScript} disabled={deletingScript}
                      className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-50">
                      <Trash2 className="w-4 h-4" /> {deletingScript ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-600 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                Belum Ada Naskah Diupload
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                {canManageScript
                  ? 'Upload naskah drama kelas lewat Google Drive agar semua anggota bisa melihat & mendownload.'
                  : 'Naskah belum diupload oleh Sutradara / Asisten Sutradara / Guru.'}
              </p>

              {canManageScript && (
                <div className="flex flex-wrap gap-2 justify-center mt-5">
                  <button onClick={() => handleOpenScriptModal()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition">
                    <Upload className="w-4 h-4" /> Upload Naskah
                  </button>
                  <button onClick={handleOpenGenerator}
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition">
                    <Wand2 className="w-4 h-4" /> Buat dengan AI
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: REFERENSI MUSIK */}
      {/* ============================================ */}
      {activeTab === 'music' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-700 via-orange-800 to-rose-900 text-white shadow-xl border border-amber-500/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="p-3 rounded-2xl bg-white/10 border border-white/20 shrink-0">
                  <Headphones className="w-7 h-7 text-amber-300" />
                </span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    Referensi Audio
                  </span>
                  <h3 className="text-lg font-black mt-1">Referensi Musik Sandima</h3>
                  <p className="text-xs text-slate-200 mt-0.5">
                    🎯 Klik tombol <strong className="text-amber-300">DOWNLOAD</strong> untuk simpan audio ke perangkat Anda
                  </p>
                </div>
              </div>
              {canManageMusic && (
                <button onClick={openCreateMusic}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shrink-0 transition hover:scale-105">
                  <PlusCircle className="w-4 h-4" />
                  Tambah Referensi
                </button>
              )}
            </div>
          </div>

          {/* Info akses */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
            {canManageMusic ? (
              <>
                <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Akses Anda: {user?.role}.</strong> Anda dapat <strong>menambah, mengedit, dan menghapus</strong> referensi musik.
                </p>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Mode Siswa:</strong> klik tombol <strong>DOWNLOAD</strong> pada setiap referensi untuk menyimpan audio ke perangkat.
                  Anda juga dapat memutar audio langsung di halaman ini (jika link-nya mendukung).
                </p>
              </>
            )}
          </div>

          {/* Search + Filter */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cari judul musik, deskripsi, atau uploader..."
                value={musicSearch}
                onChange={(e) => setMusicSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={musicFilterCategory}
                onChange={(e) => setMusicFilterCategory(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              >
                <option value="ALL">Semua Kategori</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Statistik kecil */}
          {musicRefs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                Total: {musicRefs.length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                Sandima: {musicRefs.filter(m => m.source === 'SANDIMA').length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-bold">
                Tradisional: {musicRefs.filter(m => m.source === 'TRADISIONAL').length}
              </span>
            </div>
          )}

          {/* List */}
          {filteredMusic.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <Music className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                {musicRefs.length === 0 ? 'Belum Ada Referensi Musik' : 'Tidak Ada Hasil'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {canManageMusic
                  ? 'Klik "Tambah Referensi" untuk mulai mengoleksi audio musik referensi.'
                  : 'Tunggu Divisi Tata Musik menambah referensi.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMusic.map(item => {
                const catCfg = CATEGORY_CONFIG[item.category];
                const srcCfg = SOURCE_CONFIG[item.source];
                const playType = getPlayableType(item.audioUrl);
                const ytId = playType === 'youtube' ? getYouTubeId(item.audioUrl) : null;
                const drivePreview = playType === 'drive' ? buildPreviewUrl(item.audioUrl) : null;

                return (
                  <div key={item.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition space-y-3">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catCfg.color}`}>
                        {catCfg.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${srcCfg.color}`}>
                        {srcCfg.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>

                    {/* Description */}
                    {item.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                        {item.description}
                      </p>
                    )}

                    {/* 🎯 DOWNLOAD BUTTON — PRIORITAS UTAMA */}
                    <button
                      onClick={() => handleDownloadMusic(item)}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98]"
                    >
                      <Download className="w-5 h-5" />
                      DOWNLOAD AUDIO
                    </button>

                    {/* Player (opsional, sekunder) */}
                    {playType === 'audio' && (
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                          <Volume2 className="w-3 h-3" /> Pratinjau (opsional)
                        </p>
                        <audio controls src={item.audioUrl} className="w-full" preload="none">
                          Browser Anda tidak mendukung pemutar audio.
                        </audio>
                      </div>
                    )}

                    {playType === 'youtube' && ytId && (
                      <details className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <summary className="p-2.5 cursor-pointer text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5" /> Pratinjau YouTube (klik untuk buka)
                        </summary>
                        <div className="aspect-video bg-black">
                          <iframe
                            src={`https://www.youtube.com/embed/${ytId}`}
                            title={item.title}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </details>
                    )}

                    {playType === 'drive' && drivePreview && (
                      <details className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <summary className="p-2.5 cursor-pointer text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5" /> Pratinjau Google Drive (klik untuk buka)
                        </summary>
                        <div className="aspect-video bg-slate-100 dark:bg-slate-900">
                          <iframe
                            src={drivePreview}
                            title={item.title}
                            className="w-full h-full border-0"
                            allow="autoplay"
                          />
                        </div>
                      </details>
                    )}

                    {playType === 'external' && (
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                          Link eksternal — tombol DOWNLOAD di atas akan membuka link sumber.
                        </p>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        <strong className="text-slate-700 dark:text-slate-300">{item.uploaderName}</strong>
                        <span>({item.uploaderRole})</span>
                        <span className="text-slate-400">•</span>
                        <span>
                          {new Date(item.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </span>
                    </div>

                    {/* Aksi tambahan */}
                    <div className="flex items-center gap-2">
                      <a href={item.audioUrl} target="_blank" rel="noreferrer"
                        className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition">
                        <ExternalLink className="w-3.5 h-3.5" /> Buka Sumber
                      </a>

                      {canManageMusic && (
                        <>
                          <button onClick={() => openEditMusic(item)}
                            className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                            title="Edit referensi">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteMusic(item)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                            title="Hapus referensi">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tips download */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <strong>💡 Cara siswa mengunduh audio:</strong>
              <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                <li>Klik tombol <strong>DOWNLOAD AUDIO</strong> di card referensi</li>
                <li>File akan ter-download ke perangkat (HP/laptop) siswa</li>
                <li>Untuk Google Drive: tombol download akan buka link download langsung</li>
                <li>Untuk YouTube: tombol akan buka YouTube — download via app YouTube Premium atau screen record</li>
                <li>Untuk MP3 langsung: file akan ter-download otomatis</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: 10 LANGKAH DIALOG */}
      {/* ============================================ */}
      {activeTab === 'dialog' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs space-y-5">
          <div>
            <span className="text-xs font-bold text-amber-600 uppercase">Panduan Aktor</span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Metode 10 Langkah Penguasaan Dialog
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {DIALOG_PRACTICE_STEPS.map(item => (
              <div key={item.step}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-start gap-3 hover:border-amber-400 transition">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-sm shadow-xs">
                  {item.step}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">{item.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{item.tip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: REKAM SUARA */}
      {/* ============================================ */}
      {activeTab === 'recorder' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs space-y-6 max-w-2xl mx-auto text-center">
          <div>
            <span className="text-xs font-bold text-rose-600 uppercase">Studio Vokal Mandiri</span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
              Perekam Suara Latihan Dialog
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rekam pembacaan dialog dan evaluasi intonasi suara.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-rose-600 animate-ping' : 'bg-slate-800 border-2 border-slate-700'
            }`}>
              <Mic className="w-10 h-10 text-white" />
            </div>

            <div>
              <p className="text-3xl font-black font-mono text-amber-400">
                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                {(recordingTime % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isRecording ? 'Sedang merekam...' : 'Siap merekam'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button onClick={startRecording}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition">
                  <Play className="w-4 h-4 fill-white" />
                  <span>Mulai Rekam</span>
                </button>
              ) : (
                <button onClick={stopRecording}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition">
                  <Square className="w-4 h-4 fill-slate-950" />
                  <span>Hentikan</span>
                </button>
              )}
            </div>
          </div>

          {audioUrl && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-left space-y-2">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">Dengar Ulang:</span>
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TAB: TIMER */}
      {/* ============================================ */}
      {activeTab === 'timers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-4">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Tata Busana & Rias</span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Simulasi Quick Change</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Target: pergantian kostum maksimal 2 menit (120 detik).</p>

            <div className="p-6 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
              <p className="text-4xl font-black font-mono text-indigo-950 dark:text-indigo-200">
                {Math.floor(timerSeconds / 60)}m {timerSeconds % 60}d
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">
                {isTimerRunning ? 'Jeda' : 'Mulai'}
              </button>
              <button onClick={() => { setIsTimerRunning(false); setTimerSeconds(0); }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold">
                Reset
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-4">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Tata Panggung & Properti</span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Simulasi Gladi Kering</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Target: pasang set 10 menit, bongkar 5 menit.</p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between font-semibold">
                <span>Pasang Set Babak 1:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Target 10 Menit</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Bongkar (Strike):</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">Target 5 Menit</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Cek Keamanan:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">Sebelum Gladi</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL UPLOAD NASKAH */}
      {/* ============================================ */}
      {isScriptModalOpen && canManageScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveScript}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" />
                {script ? 'Ganti Naskah Kelas' : 'Upload Naskah Kelas'}
              </h3>
              <button type="button" onClick={() => setIsScriptModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Naskah <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={scriptTitle}
                onChange={(e) => setScriptTitle(e.target.value)}
                placeholder="Contoh: Legenda Danau Lipan - Sandiwara Mamanda"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Link Google Drive Naskah <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input type="url" required value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama File (Opsional)
              </label>
              <input type="text" value={scriptFileName}
                onChange={(e) => setScriptFileName(e.target.value)}
                placeholder="naskah_legenda_danau_lipan.pdf"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan / Instruksi Naskah
              </label>
              <textarea rows={2} value={scriptNotes}
                onChange={(e) => setScriptNotes(e.target.value)}
                placeholder="Contoh: Fokus latihan Babak 1-2 dulu..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsScriptModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={savingScript}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {savingScript ? 'Menyimpan...' : (script ? 'Perbarui Naskah' : 'Simpan Naskah')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL TAMBAH/EDIT REFERENSI MUSIK */}
      {/* ============================================ */}
      {isMusicModalOpen && canManageMusic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveMusic}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">

            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Headphones className="w-5 h-5 text-amber-500" />
                {editingMusic ? 'Edit Referensi Musik' : 'Tambah Referensi Musik'}
              </h3>
              <button type="button" onClick={() => setIsMusicModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <strong>Penting:</strong> Siswa akan <strong>mengunduh audio</strong> ini.
                Pastikan link Google Drive di-set <strong>"Anyone with the link can view"</strong> agar siswa bisa download.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Referensi <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={musicTitle}
                onChange={(e) => setMusicTitle(e.target.value)}
                placeholder="Contoh: Sape Pembuka - Nuansa Muara Kaman"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Link Audio <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input type="url" required value={musicUrl}
                  onChange={(e) => setMusicUrl(e.target.value)}
                  placeholder="https://drive.google.com/... atau https://.../audio.mp3"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              {musicUrl.trim().length > 8 && (
                <div className="mt-2">
                  {(() => {
                    const t = getPlayableType(musicUrl);
                    const map: Record<string, { label: string; color: string }> = {
                      audio:    { label: '🎵 MP3 langsung — bisa diputar & diunduh langsung', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                      youtube:  { label: '▶️ YouTube — siswa akan diarahkan ke YouTube (bisa download via app)', color: 'text-rose-700 bg-rose-50 border-rose-200' },
                      drive:    { label: '📁 Google Drive — siswa bisa download langsung dari card', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                      external: { label: '🔗 Link eksternal — tombol download akan buka link', color: 'text-slate-600 bg-slate-50 border-slate-200' },
                    };
                    const info = map[t];
                    return (
                      <p className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${info.color}`}>
                        {info.label}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori <span className="text-rose-500">*</span>
                </label>
                <select value={musicCategory}
                  onChange={(e) => setMusicCategory(e.target.value as MusicCategory)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sumber <span className="text-rose-500">*</span>
                </label>
                <select value={musicSource}
                  onChange={(e) => setMusicSource(e.target.value as MusicSource)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Deskripsi / Catatan Musik
              </label>
              <textarea rows={4} value={musicDescription}
                onChange={(e) => setMusicDescription(e.target.value)}
                placeholder="Contoh: Musik pembuka dengan instrumen sape khas Kutai, tempo lambat, nuansa mistis. Durasi 1:30."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed" />
              <p className="text-[10px] text-slate-400 mt-1">
                Deskripsi bebas — nuansa, instrumen, tempo, durasi, kapan dipakai.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsMusicModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={savingMusic}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {savingMusic ? 'Menyimpan...' : (editingMusic ? 'Perbarui' : 'Simpan Referensi')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL PREVIEW NASKAH */}
      {/* ============================================ */}
      {isPreviewOpen && script && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 backdrop-blur-md">
          <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                <FileText className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Pratinjau Naskah</p>
                <h3 className="text-sm font-black text-white truncate">{script.title}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handleDownloadScript}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button onClick={() => setIsPreviewOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-950">
            {(() => {
              const previewUrl = buildPreviewUrl(script.fileUrl);
              if (!previewUrl) {
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white p-6 text-center">
                    <FileText className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-sm font-bold">Preview tidak tersedia</p>
                  </div>
                );
              }
              return (
                <iframe
                  src={previewUrl}
                  title="Preview Naskah"
                  className="w-full h-full border-0"
                  allow="autoplay"
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};