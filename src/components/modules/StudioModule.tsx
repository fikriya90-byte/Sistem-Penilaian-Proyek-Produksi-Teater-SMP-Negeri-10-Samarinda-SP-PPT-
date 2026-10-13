import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, Clock, Mic, Music, Play, Save,
  Sparkles, Square, Users, ExternalLink, Upload, Link2,
  FileText, X, BookOpen, Wand2, Trash2, Edit3, AlertTriangle,
  Rocket, Globe, Download, Eye, Lock, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIALOG_PRACTICE_STEPS } from '../../core/constants';
import { UserProfile } from '../../core/types';
import { fetchUsersByClass, recordAuditLog } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import {
  doc, setDoc, onSnapshot, deleteDoc, getDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

const SANDIMA_GENERATOR_URL = 'https://spanluh-sandima-generator-naskah.netlify.app/';

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

// ═══════════════════════════════════════════════════════
// Helper: Ekstrak Google Drive File ID dari URL
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
  // Fallback: pakai Google Docs Viewer untuk URL umum
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

function buildDownloadUrl(url: string): string {
  const id = getDriveFileId(url);
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  return url;
}

export const StudioModule: React.FC = () => {
  const { user, activeClass, isSutradara, isAsisten, isTeacher, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'script' | 'dialog' | 'recorder' | 'timers'>('script');
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

  // ═══════════════════════════════════════════════════════
  // ✅ PERMISSION: Upload/Ganti/Hapus naskah = Sutradara, Astrada, Guru/Admin
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

  // Semua role yang login bisa lihat + download
  const canViewScript = !!user;

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(u => {
      setActors(u.filter(s =>
        s.role === 'Pemeran' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara'
      ));
    });
  }, [activeClass]);

  // Subscribe naskah dari Firestore
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
    if (!scriptUrl.includes('drive.google.com') && !scriptUrl.includes('docs.google.com')) {
      showToast('Link harus dari Google Drive/Docs.', 'warning');
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
    if (!confirm('Hapus naskah kelas ini? Semua anggota tidak akan bisa lihat naskah lagi sampai di-upload ulang.')) return;

    setDeletingScript(true);
    try {
      await deleteDoc(doc(db, 'scripts', activeClass.id));
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'Script', targetId: activeClass.id,
        details: `Hapus naskah kelas`,
      });
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
                Naskah, Perekam Suara, Latihan 10 Langkah, & Timer
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300">
          <button onClick={() => setActiveTab('script')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'script' ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            📜 Naskah
          </button>
          <button onClick={() => setActiveTab('dialog')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'dialog' ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            🗣️ 10 Langkah
          </button>
          <button onClick={() => setActiveTab('recorder')}
            className={`px-3 py-1.5 rounded-xl transition ${activeTab === 'recorder' ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            🎙️ Rekam Suara
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

          {/* Tombol Generator Sandima */}
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
                  <h3 className="text-lg font-black mt-1">
                    Generator Naskah Teater SANDIMA
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Sandiwara Mamanda Samarinda Berbasis Kecerdasan Artifisial
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenGenerator}
                className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shrink-0 transition hover:scale-105"
              >
                <Rocket className="w-4 h-4" />
                Buka Generator
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* INFO AKSES */}
          {canViewScript && (
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              {canManageScript ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                    <strong>Akses Anda: {user?.role}.</strong> Anda dapat <strong>mengupload, mengganti, dan menghapus</strong> naskah kelas ini.
                    Semua anggota kelas dapat <strong>melihat</strong> dan <strong>mendownload</strong> naskah.
                  </p>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                    <strong>Mode Lihat.</strong> Anda dapat <strong>melihat & mendownload</strong> naskah.
                    Yang berhak mengelola (upload/ganti/hapus): <strong>Sutradara, Asisten Sutradara, & Guru</strong>.
                  </p>
                </>
              )}
            </div>
          )}

          {/* NASKAH KELAS */}
          {scriptLoading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slate-400">Memuat naskah...</p>
            </div>
          ) : script ? (
            /* SUDAH ADA NASKAH */
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

              {/* Info Bar */}
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

              {/* Tombol Aksi */}
              <div className="px-6 pb-4 flex flex-wrap gap-2">
                {/* Preview (semua role) */}
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  <Eye className="w-4 h-4" /> Pratinjau Naskah
                </button>

                {/* Download (semua role) */}
                <button
                  onClick={handleDownloadScript}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  <Download className="w-4 h-4" /> Download
                </button>

                {/* Buka di tab baru (semua role) */}
                <a
                  href={script.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  <ExternalLink className="w-4 h-4" /> Buka di Tab Baru
                </a>

                {/* Ganti & Hapus — hanya pengelola */}
                {canManageScript && (
                  <>
                    <button
                      onClick={() => handleOpenScriptModal(script)}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition"
                    >
                      <Edit3 className="w-4 h-4" /> Ganti Naskah
                    </button>
                    <button
                      onClick={handleDeleteScript}
                      disabled={deletingScript}
                      className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> {deletingScript ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </>
                )}
              </div>

              {/* Preview Inline (embed langsung di halaman) */}
              <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="p-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
                  <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Pratinjau Naskah
                  </span>
                </div>
                <div className="aspect-[4/5] sm:aspect-video w-full bg-slate-100 dark:bg-slate-900">
                  {(() => {
                    const previewUrl = buildPreviewUrl(script.fileUrl);
                    if (!previewUrl) {
                      return (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 p-4 text-center">
                          Preview tidak tersedia. Klik "Buka di Tab Baru".
                        </div>
                      );
                    }
                    return (
                      <iframe
                        src={previewUrl}
                        title="Preview Naskah"
                        className="w-full h-full border-0"
                        allow="autoplay"
                        loading="lazy"
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            /* BELUM ADA NASKAH */
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-600 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                Belum Ada Naskah Diupload
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                {canManageScript
                  ? 'Upload naskah drama kelas lewat Google Drive agar semua anggota bisa melihat & mendownload. Klik "Upload Naskah" untuk memulai.'
                  : 'Naskah belum diupload oleh Sutradara / Asisten Sutradara / Guru. Tunggu info dari pengurus.'}
              </p>

              {canManageScript && (
                <div className="flex flex-wrap gap-2 justify-center mt-5">
                  <button
                    onClick={() => handleOpenScriptModal()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition"
                  >
                    <Upload className="w-4 h-4" /> Upload Naskah
                  </button>
                  <button
                    onClick={handleOpenGenerator}
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                  >
                    <Wand2 className="w-4 h-4" /> Buat dengan AI
                  </button>
                </div>
              )}

              {!canManageScript && (
                <div className="inline-flex items-center gap-1.5 mt-5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                  Hanya Sutradara, Asisten Sutradara, & Guru yang dapat mengupload
                </div>
              )}
            </div>
          )}

          {/* Panduan Upload */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <strong>Cara upload naskah:</strong>
                <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                  <li>Upload file naskah (PDF/DOCX) ke Google Drive kelas</li>
                  <li>Klik kanan file → Share → ubah jadi "Anyone with the link can view"</li>
                  <li>Copy link → paste di form Upload Naskah</li>
                  <li>Naskah akan langsung tampil di halaman ini (pratinjau) + bisa di-download</li>
                </ol>
              </div>
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

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <strong>Tips:</strong> Belum punya naskah? Gunakan
                <button type="button"
                  onClick={handleOpenGenerator}
                  className="font-bold underline text-blue-700 dark:text-blue-300 ml-1">
                  Generator Naskah SANDIMA
                </button>
                untuk membuat naskah AI, lalu upload ke Google Drive.
              </p>
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
              <p className="text-[10px] text-slate-400 mt-1">
                Pastikan izin file: "Anyone with the link can view"
              </p>
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
                placeholder="Contoh: Fokus latihan Babak 1-2 dulu, Babak 3 menyusul minggu depan."
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
      {/* MODAL PREVIEW FULL SCREEN */}
      {/* ============================================ */}
      {isPreviewOpen && script && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 backdrop-blur-md">
          {/* Header */}
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
              <button
                onClick={handleDownloadScript}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <a
                href={script.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Tab Baru
              </a>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — Embed iframe */}
          <div className="flex-1 bg-slate-950">
            {(() => {
              const previewUrl = buildPreviewUrl(script.fileUrl);
              if (!previewUrl) {
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white p-6 text-center">
                    <FileText className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-sm font-bold">Preview tidak tersedia</p>
                    <p className="text-xs text-slate-400 mt-1">Gunakan tombol "Tab Baru" atau "Download".</p>
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