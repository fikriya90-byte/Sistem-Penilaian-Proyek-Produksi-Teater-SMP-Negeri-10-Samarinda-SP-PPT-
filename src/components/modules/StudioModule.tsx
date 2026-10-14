import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, Clock, Mic, Music, Play, Save,
  Sparkles, Square, Users, ExternalLink, Upload, Link2,
  FileText, X, Wand2, Trash2, Edit3, AlertTriangle,
  Rocket, Download, Eye, Lock, ShieldAlert, Search, Filter,
  PlusCircle, Headphones, Volume2, Youtube, Copy, ChevronRight, ChevronLeft,
  Check, Square as SquareIcon, CheckSquare, Info, Loader2,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIALOG_PRACTICE_STEPS } from '../../core/constants';
import { UserProfile, ClassRoom } from '../../core/types';
import { fetchUsersByClass, recordAuditLog } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import {
  doc, setDoc, onSnapshot, deleteDoc, collection, query, where, getDocs,
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
  duplicatedFrom?: string;
  duplicatedAt?: string;
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
  const patterns = [/\/file\/d\/([^/?]+)/, /\/d\/([^/?]+)/, /id=([^&]+)/, /folders\/([^/?]+)/];
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

function buildDownloadUrl(url: string): string {
  const id = getDriveFileId(url);
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
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

function getYouTubeThumbnail(videoId: string, quality: 'max' | 'hq' = 'max'): string {
  if (quality === 'max') return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// ═══════════════════════════════════════════════════════
// KOMPONEN: YouTube Thumbnail
// ═══════════════════════════════════════════════════════
const YouTubeThumbnail: React.FC<{
  videoId: string;
  title: string;
  onClick?: () => void;
  className?: string;
}> = ({ videoId, title, onClick, className = '' }) => {
  const [src, setSrc] = useState(getYouTubeThumbnail(videoId, 'max'));
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer overflow-hidden rounded-2xl bg-slate-900 ${className}`}
      onClick={onClick}
    >
      {!errored && (
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover transition group-hover:scale-105"
          onError={() => {
            if (src.includes('maxresdefault')) setSrc(getYouTubeThumbnail(videoId, 'hq'));
            else setErrored(true);
          }}
        />
      )}
      {errored && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400">
          <Youtube className="w-12 h-12 mb-2" />
          <p className="text-xs font-bold">YouTube Video</p>
        </div>
      )}
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition">
          <Play className="w-7 h-7 text-white fill-white ml-1" />
        </div>
      </div>
      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
        <Youtube className="w-3 h-3" /> YOUTUBE
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// KOMPONEN: DUPLIKAT MODAL
// ═══════════════════════════════════════════════════════
const MusicCopyModal: React.FC<{
  allClasses: ClassRoom[];
  currentClassId: string;
  musicRefs: MusicReference[];
  onClose: () => void;
  onSuccess?: (count: number) => void;
}> = ({ allClasses, currentClassId, musicRefs, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const otherClasses = allClasses.filter(c => c.id !== currentClassId);

  // Auto-select semua referensi saat pertama buka
  useEffect(() => {
    setSelectedRefIds(musicRefs.map(r => r.id));
  }, [musicRefs]);

  const toggleRef = (id: string) => {
    setSelectedRefIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleClass = (id: string) => {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllRefs = () => setSelectedRefIds(musicRefs.map(r => r.id));
  const deselectAllRefs = () => setSelectedRefIds([]);
  const selectAllClasses = () => setSelectedClassIds(otherClasses.map(c => c.id));
  const deselectAllClasses = () => setSelectedClassIds([]);

  const handleDuplicate = async () => {
    if (!user) return;
    if (selectedRefIds.length === 0) {
      showToast('Pilih minimal 1 referensi.', 'warning');
      return;
    }
    if (selectedClassIds.length === 0) {
      showToast('Pilih minimal 1 kelas tujuan.', 'warning');
      return;
    }

    setSubmitting(true);
    let totalCreated = 0;
    const errors: string[] = [];

    try {
      for (const targetClassId of selectedClassIds) {
        for (const refId of selectedRefIds) {
          const source = musicRefs.find(r => r.id === refId);
          if (!source) continue;

          try {
            const newRef = doc(collection(db, 'musicReferences'));
            await setDoc(newRef, {
              id: newRef.id,
              classId: targetClassId,
              title: source.title,
              description: source.description,
              audioUrl: source.audioUrl,
              category: source.category,
              source: source.source,
              uploadedBy: user.uid,
              uploaderName: user.displayName,
              uploaderRole: user.role,
              createdAt: new Date().toISOString(),
              duplicatedFrom: source.id,
              duplicatedFromClassName: allClasses.find(c => c.id === currentClassId)?.name || '-',
              duplicatedAt: new Date().toISOString(),
            });
            totalCreated++;
          } catch (err: any) {
            errors.push(`${source.title} → ${targetClassId}: ${err?.message || 'unknown'}`);
          }
        }
      }

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'MusicReferenceDuplicate',
        targetId: currentClassId,
        details: `Duplikat ${totalCreated} referensi musik ke ${selectedClassIds.length} kelas`,
      });

      if (errors.length === 0) {
        showToast(`✅ ${totalCreated} referensi musik berhasil diduplikat!`, 'success');
      } else {
        showToast(`⚠️ ${totalCreated} berhasil, ${errors.length} gagal.`, 'warning');
        console.warn('Duplikasi musik errors:', errors);
      }

      onSuccess?.(totalCreated);
      onClose();
    } catch (err: any) {
      showToast('Gagal duplikat: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalToCreate = selectedRefIds.length * selectedClassIds.length;
  const targetClassNames = selectedClassIds
    .map(id => allClasses.find(c => c.id === id)?.name || '-')
    .join(', ');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-800 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
                <Copy className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  Duplikat Referensi Musik
                </span>
                <h3 className="text-lg font-black mt-0.5">Langkah {step} dari 3</h3>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* STEP 1: Pilih referensi */}
          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Pilih Referensi yang Mau Diduplikat
                </h4>
                <div className="flex items-center gap-2">
                  <button onClick={selectAllRefs}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                    <Check className="w-3 h-3" /> Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAllRefs}
                    className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Hapus
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                {selectedRefIds.length} dari {musicRefs.length} dipilih
              </p>

              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {musicRefs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-8">
                    Belum ada referensi musik di kelas ini.
                  </p>
                ) : (
                  musicRefs.map(item => {
                    const isSelected = selectedRefIds.includes(item.id);
                    const catCfg = CATEGORY_CONFIG[item.category];
                    const playType = getPlayableType(item.audioUrl);

                    return (
                      <button key={item.id} onClick={() => toggleRef(item.id)}
                        className={`w-full p-3 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}>
                        <div className={`p-0.5 rounded-md shrink-0 mt-0.5 ${
                          isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'
                        }`}>
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <SquareIcon className="w-4 h-4 text-transparent" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${catCfg.color}`}>
                              {catCfg.label}
                            </span>
                            {playType === 'youtube' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 flex items-center gap-0.5">
                                <Youtube className="w-2.5 h-2.5" /> YT
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-2">
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* STEP 2: Pilih kelas tujuan */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Pilih Kelas Tujuan
                </h4>
                <div className="flex items-center gap-2">
                  <button onClick={selectAllClasses}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                    <Check className="w-3 h-3" /> Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAllClasses}
                    className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Hapus
                  </button>
                </div>
              </div>

              {otherClasses.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada kelas lain di sistem. Buat kelas lain dulu di menu <strong>Kelola Kelas</strong>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {otherClasses.map(c => {
                    const isSelected = selectedClassIds.includes(c.id);
                    return (
                      <button key={c.id} onClick={() => toggleClass(c.id)}
                        className={`p-4 rounded-2xl border-2 text-left transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-0.5 rounded-md shrink-0 mt-0.5 ${
                            isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'
                          }`}>
                            {isSelected ? <CheckSquare className="w-4 h-4" /> : <SquareIcon className="w-4 h-4 text-transparent" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              Kode: {c.code}
                            </p>
                            {c.kerabatKerja && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5 truncate">
                                🎭 {c.kerabatKerja}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* STEP 3: Konfirmasi */}
          {step === 3 && (
            <>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">
                Konfirmasi Duplikasi
              </h4>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-2 border-purple-200 dark:border-purple-500/30 space-y-4">

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Referensi</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{selectedRefIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Kelas</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{selectedClassIds.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Total Salinan</p>
                    <p className="text-2xl font-black text-purple-900 dark:text-purple-200">{totalToCreate}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-purple-200 dark:border-purple-500/30 space-y-2 text-xs">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Kelas Tujuan:</p>
                    <p className="font-bold text-purple-900 dark:text-purple-200">{targetClassNames}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Referensi yang Diduplikat:</p>
                    <ul className="list-disc pl-4 text-purple-900 dark:text-purple-200 max-h-32 overflow-y-auto">
                      {selectedRefIds.map(id => {
                        const r = musicRefs.find(x => x.id === id);
                        return r ? <li key={id} className="truncate">{r.title}</li> : null;
                      })}
                    </ul>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    Referensi akan disalin ke kelas tujuan. Kelas asal <strong>tidak akan berubah</strong>.
                    Link audio tetap sama, jadi tidak perlu upload ulang.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
            Batal
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as any)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                <ChevronLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            )}
            {step < 3 && (
              <button onClick={() => setStep((step + 1) as any)}
                disabled={
                  (step === 1 && selectedRefIds.length === 0) ||
                  (step === 2 && selectedClassIds.length === 0)
                }
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {step === 3 && (
              <button onClick={handleDuplicate} disabled={submitting || totalToCreate === 0}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                {submitting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menduplikat...</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Duplikat ke {selectedClassIds.length} Kelas</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export const StudioModule: React.FC = () => {
  const { user, activeClass, classes, isSutradara, isAsisten, isTeacher, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'script' | 'music' | 'dialog' | 'recorder' | 'timers'>('script');
  const [actors, setActors] = useState<UserProfile[]>([]);

  // SCRIPT
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

  // RECORDER
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // TIMER
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // MUSIC
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

  // MUSIC COPY MODAL
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  // YOUTUBE PLAYER MODAL
  const [playingYoutube, setPlayingYoutube] = useState<{ videoId: string; title: string } | null>(null);

  // PERMISSIONS
  const canManageScript = !!user && (
    isSutradara || isAsisten || isGuruPengampu || isTeacher || isAdminRole ||
    user.role === 'Guru Pengampu' || user.role === 'Guru Pembina' ||
    user.role === 'Admin' || user.role === 'Super Admin'
  );

  const canManageMusic = !!user && (
    isGuruPengampu || isTeacher || isAdminRole || isSutradara || isAsisten ||
    user.role === 'Guru Pengampu' || user.role === 'Guru Pembina' ||
    user.role === 'Admin' || user.role === 'Super Admin' ||
    user.role === 'Koordinator Tata Musik' || user.role === 'Anggota Tata Musik'
  );

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(u => {
      setActors(u.filter(s =>
        s.role === 'Pemeran' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara'
      ));
    });
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    setScriptLoading(true);
    const ref = doc(db, 'scripts', activeClass.id);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) setScript({ ...snap.data(), id: snap.id } as ScriptData);
      else setScript(null);
      setScriptLoading(false);
    });
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'musicReferences'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as MusicReference));
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setMusicRefs(list);
    });
    return () => unsub();
  }, [activeClass]);

  // SCRIPT HANDLERS
  const handleOpenScriptModal = (existing?: ScriptData) => {
    if (!canManageScript) {
      showToast('Hanya Sutradara, Asisten Sutradara, dan Guru yang dapat mengelola naskah.', 'warning');
      return;
    }
    if (existing) {
      setScriptTitle(existing.title); setScriptUrl(existing.fileUrl);
      setScriptFileName(existing.fileName); setScriptNotes(existing.notes);
    } else {
      setScriptTitle(''); setScriptUrl(''); setScriptFileName(''); setScriptNotes('');
    }
    setIsScriptModalOpen(true);
  };

  const handleSaveScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!canManageScript) { showToast('Anda tidak berwenang.', 'warning'); return; }
    if (!scriptTitle.trim() || !scriptUrl.trim()) { showToast('Judul dan link wajib diisi.', 'warning'); return; }

    setSavingScript(true);
    try {
      const ref = doc(db, 'scripts', activeClass.id);
      await setDoc(ref, {
        id: activeClass.id, classId: activeClass.id,
        title: scriptTitle.trim(), fileUrl: scriptUrl.trim(),
        fileName: scriptFileName.trim() || 'naskah.pdf',
        notes: scriptNotes.trim(), uploadedBy: user.uid,
        uploaderName: user.displayName, uploaderRole: user.role,
        uploadedAt: new Date().toISOString(),
      }, { merge: true });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: script ? 'UPDATE' : 'CREATE', targetType: 'Script', targetId: activeClass.id,
        details: `${script ? 'Update' : 'Upload'} naskah: "${scriptTitle}"`,
      });
      showToast('Naskah berhasil disimpan!', 'success');
      setIsScriptModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSavingScript(false); }
  };

  const handleDeleteScript = async () => {
    if (!activeClass || !user || !canManageScript) return;
    if (!confirm('Hapus naskah kelas ini?')) return;
    setDeletingScript(true);
    try {
      await deleteDoc(doc(db, 'scripts', activeClass.id));
      showToast('Naskah dihapus.', 'info');
    } catch (err: any) { showToast('Gagal hapus: ' + err.message, 'error'); }
    finally { setDeletingScript(false); }
  };

  const handleDownloadScript = () => {
    if (!script?.fileUrl) return;
    window.open(buildDownloadUrl(script.fileUrl), '_blank', 'noopener,noreferrer');
    showToast('Naskah diunduh.', 'info');
  };

  // MUSIC HANDLERS
  const openCreateMusic = () => {
    if (!canManageMusic) { showToast('Akses terbatas.', 'warning'); return; }
    setEditingMusic(null); setMusicTitle(''); setMusicDescription('');
    setMusicUrl(''); setMusicCategory('ILUSTRASI'); setMusicSource('SANDIMA');
    setIsMusicModalOpen(true);
  };

  const openEditMusic = (item: MusicReference) => {
    if (!canManageMusic) return;
    setEditingMusic(item);
    setMusicTitle(item.title); setMusicDescription(item.description || '');
    setMusicUrl(item.audioUrl); setMusicCategory(item.category); setMusicSource(item.source);
    setIsMusicModalOpen(true);
  };

  const handleSaveMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !canManageMusic) return;
    if (!musicTitle.trim() || !musicUrl.trim()) { showToast('Judul & link wajib diisi.', 'warning'); return; }
    if (!musicUrl.startsWith('http')) { showToast('Link harus http:// atau https://', 'warning'); return; }

    setSavingMusic(true);
    try {
      const id = editingMusic?.id || doc(collection(db, 'musicReferences')).id;
      const data: MusicReference = {
        id, classId: activeClass.id,
        title: musicTitle.trim(), description: musicDescription.trim(),
        audioUrl: musicUrl.trim(), category: musicCategory, source: musicSource,
        uploadedBy: editingMusic?.uploadedBy || user.uid,
        uploaderName: editingMusic?.uploaderName || user.displayName,
        uploaderRole: editingMusic?.uploaderRole || user.role,
        createdAt: editingMusic?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'musicReferences', id), data, { merge: true });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editingMusic ? 'UPDATE' : 'CREATE', targetType: 'MusicReference', targetId: id,
        details: `${editingMusic ? 'Edit' : 'Tambah'} referensi musik: "${musicTitle}"`,
      });
      showToast(`Referensi ${editingMusic ? 'diperbarui' : 'ditambahkan'}!`, 'success');
      setIsMusicModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSavingMusic(false); }
  };

  const handleDeleteMusic = async (item: MusicReference) => {
    if (!user || !canManageMusic) return;
    if (!confirm(`Hapus referensi "${item.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'musicReferences', item.id));
      showToast('Referensi dihapus.', 'info');
    } catch (err: any) { showToast('Gagal hapus: ' + err.message, 'error'); }
  };

  const handleDownloadMusic = (item: MusicReference) => {
    const type = getPlayableType(item.audioUrl);
    if (type === 'youtube') {
      showToast('YouTube tidak bisa diunduh langsung. Membuka YouTube...', 'info');
      window.open(item.audioUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    window.open(buildDownloadUrl(item.audioUrl), '_blank', 'noopener,noreferrer');
    showToast(`🎵 "${item.title}" sedang diunduh...`, 'success');
  };

  const filteredMusic = musicRefs.filter(m => {
    if (musicFilterCategory !== 'ALL' && m.category !== musicFilterCategory) return false;
    if (musicSearch.trim()) {
      const q = musicSearch.toLowerCase();
      return m.title.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  // RECORDER
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch { showToast('Izin mikrofon diperlukan.', 'error'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      showToast('Rekaman disimpan sementara!', 'success');
    }
  };

  useEffect(() => {
    let i: any = null;
    if (isRecording) i = setInterval(() => setRecordingTime(p => p + 1), 1000);
    return () => clearInterval(i);
  }, [isRecording]);

  useEffect(() => {
    let i: any = null;
    if (isTimerRunning) i = setInterval(() => setTimerSeconds(p => p + 1), 1000);
    return () => clearInterval(i);
  }, [isTimerRunning]);

  const modalYoutubeId = getYouTubeId(musicUrl);
  const modalPlayType = musicUrl.trim().length > 8 ? getPlayableType(musicUrl) : null;

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
                Naskah, Referensi Musik, Perekam Suara, Latihan, & Timer
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300">
          {[
            { id: 'script', label: '📜 Naskah' },
            { id: 'music', label: '🎵 Referensi Musik' },
            { id: 'dialog', label: '🗣️ 10 Langkah' },
            { id: 'recorder', label: '🎙️ Rekam' },
            { id: 'timers', label: '⏱️ Timer' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl transition ${activeTab === t.id ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============ TAB: NASKAH ============ */}
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
                </div>
              </div>
              <button onClick={() => window.open(SANDIMA_GENERATOR_URL, '_blank')}
                className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shrink-0">
                <Rocket className="w-4 h-4" /> Buka Generator
              </button>
            </div>
          </div>

          {scriptLoading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-500" />
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
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">{script.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <strong>{script.uploaderName}</strong> ({script.uploaderRole}) •{' '}
                        {new Date(script.uploadedAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>
                {script.notes && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 italic">
                    "{script.notes}"
                  </div>
                )}
              </div>

              <div className="px-6 pb-4 flex flex-wrap gap-2">
                <button onClick={handleDownloadScript}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm">
                  <Download className="w-4 h-4" /> Download Naskah
                </button>
                <button onClick={() => setIsPreviewOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm">
                  <Eye className="w-4 h-4" /> Pratinjau
                </button>
                <a href={script.fileUrl} target="_blank" rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm">
                  <ExternalLink className="w-4 h-4" /> Tab Baru
                </a>
                {canManageScript && (
                  <>
                    <button onClick={() => handleOpenScriptModal(script)}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm">
                      <Edit3 className="w-4 h-4" /> Ganti Naskah
                    </button>
                    <button onClick={handleDeleteScript} disabled={deletingScript}
                      className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50">
                      <Trash2 className="w-4 h-4" /> {deletingScript ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-600 text-center">
              <FileText className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-500 mb-3" />
              <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Belum Ada Naskah</h3>
              {canManageScript && (
                <div className="flex flex-wrap gap-2 justify-center mt-5">
                  <button onClick={() => handleOpenScriptModal()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Upload Naskah
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ TAB: REFERENSI MUSIK ============ */}
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
                    🎯 Klik <strong className="text-amber-300">DOWNLOAD</strong>, atau duplikat ke kelas lain
                  </p>
                </div>
              </div>
              {canManageMusic && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 🆕 TOMBOL DUPLIKAT */}
                  <button onClick={() => {
                    if (musicRefs.length === 0) {
                      showToast('Belum ada referensi untuk diduplikat.', 'warning');
                      return;
                    }
                    if (classes.length < 2) {
                      showToast('Butuh minimal 2 kelas untuk duplikat.', 'warning');
                      return;
                    }
                    setIsCopyModalOpen(true);
                  }}
                    className="px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition">
                    <Copy className="w-4 h-4" /> Duplikat ke Kelas Lain
                  </button>
                  <button onClick={openCreateMusic}
                    className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition">
                    <PlusCircle className="w-4 h-4" /> Tambah Referensi
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
            {canManageMusic ? (
              <>
                <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Akses Anda: {user?.role}.</strong> Anda dapat menambah, mengedit, menghapus, dan{' '}
                  <strong>duplikat referensi ke kelas lain</strong>. Semua anggota kelas dapat memutar & mengunduh.
                </p>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Mode Siswa:</strong> klik <strong>DOWNLOAD</strong> untuk simpan audio, atau klik{' '}
                  <strong>thumbnail YouTube</strong> untuk memutar.
                </p>
              </>
            )}
          </div>

          {/* Search + Filter */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Cari judul musik, adegan, atau uploader..."
                value={musicSearch} onChange={(e) => setMusicSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select value={musicFilterCategory}
                onChange={(e) => setMusicFilterCategory(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                <option value="ALL">Semua Kategori</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats */}
          {musicRefs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                Total: {musicRefs.length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 font-bold flex items-center gap-1">
                <Youtube className="w-3 h-3" /> YouTube: {musicRefs.filter(m => getPlayableType(m.audioUrl) === 'youtube').length}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                Sandima: {musicRefs.filter(m => m.source === 'SANDIMA').length}
              </span>
              {musicRefs.filter(m => m.duplicatedFrom).length > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Dari kelas lain: {musicRefs.filter(m => m.duplicatedFrom).length}
                </span>
              )}
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
                  ? 'Klik "Tambah Referensi" untuk koleksi audio, atau "Duplikat" dari kelas lain.'
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
                const isDuplicated = !!item.duplicatedFrom;

                return (
                  <div key={item.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition space-y-3 overflow-hidden">

                    {playType === 'youtube' && ytId && (
                      <YouTubeThumbnail videoId={ytId} title={item.title}
                        onClick={() => setPlayingYoutube({ videoId: ytId, title: item.title })}
                        className="w-full aspect-video -mx-5 -mt-5 mb-0 rounded-none" />
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catCfg.color}`}>
                        {catCfg.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${srcCfg.color}`}>
                        {srcCfg.label}
                      </span>
                      {isDuplicated && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 flex items-center gap-1">
                          <Copy className="w-2.5 h-2.5" /> Dari {item.duplicatedFromClassName || 'kelas lain'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>

                    {item.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                        {item.description}
                      </p>
                    )}

                    <button onClick={() => handleDownloadMusic(item)}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98]">
                      <Download className="w-5 h-5" />
                      {playType === 'youtube' ? 'BUKA DI YOUTUBE' : 'DOWNLOAD AUDIO'}
                    </button>

                    {playType === 'audio' && (
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                          <Volume2 className="w-3 h-3" /> Pratinjau
                        </p>
                        <audio controls src={item.audioUrl} className="w-full" preload="none" />
                      </div>
                    )}

                    {playType === 'drive' && drivePreview && (
                      <details className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <summary className="p-2.5 cursor-pointer text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Play className="w-3.5 h-3.5" /> Pratinjau Google Drive
                        </summary>
                        <div className="aspect-video bg-slate-100 dark:bg-slate-900">
                          <iframe src={drivePreview} title={item.title}
                            className="w-full h-full border-0" allow="autoplay" />
                        </div>
                      </details>
                    )}

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        <strong className="text-slate-700 dark:text-slate-300">{item.uploaderName}</strong>
                        <span>({item.uploaderRole})</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a href={item.audioUrl} target="_blank" rel="noreferrer"
                        className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition">
                        <ExternalLink className="w-3.5 h-3.5" /> Buka Sumber
                      </a>
                      {canManageMusic && (
                        <>
                          <button onClick={() => openEditMusic(item)}
                            className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition" title="Edit">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteMusic(item)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" title="Hapus">
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

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <strong>💡 Tips:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li><strong>Duplikat ke Kelas Lain</strong> → salin referensi ke kelas IX lain tanpa upload ulang</li>
                <li><strong>YouTube</strong> → siswa klik thumbnail untuk play, atau download via app YouTube</li>
                <li><strong>Google Drive / MP3</strong> → klik tombol <strong>DOWNLOAD AUDIO</strong> untuk simpan ke HP</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB: 10 LANGKAH ============ */}
      {activeTab === 'dialog' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs space-y-5">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Metode 10 Langkah Penguasaan Dialog
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {DIALOG_PRACTICE_STEPS.map(item => (
              <div key={item.step}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-sm">
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

      {/* ============ TAB: RECORDER ============ */}
      {activeTab === 'recorder' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs space-y-6 max-w-2xl mx-auto text-center">
          <div>
            <span className="text-xs font-bold text-rose-600 uppercase">Studio Vokal Mandiri</span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
              Perekam Suara Latihan Dialog
            </h3>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isRecording ? 'bg-rose-600 animate-ping' : 'bg-slate-800 border-2 border-slate-700'}`}>
              <Mic className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-3xl font-black font-mono text-amber-400">
                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                {(recordingTime % 60).toString().padStart(2, '0')}
              </p>
            </div>
            <div>
              {!isRecording ? (
                <button onClick={startRecording}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
                  <Play className="w-4 h-4 fill-white" /> Mulai Rekam
                </button>
              ) : (
                <button onClick={stopRecording}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
                  <Square className="w-4 h-4 fill-slate-950" /> Hentikan
                </button>
              )}
            </div>
          </div>

          {audioUrl && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-left space-y-2">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">Dengar Ulang:</span>
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}
        </div>
      )}

      {/* ============ TAB: TIMER ============ */}
      {activeTab === 'timers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-4">
            <span className="text-xs font-bold text-indigo-600 uppercase">Simulasi Quick Change</span>
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
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold">
                Reset
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
            <span className="text-xs font-bold text-purple-600 uppercase">Simulasi Gladi Kering</span>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between"><span>Pasang Set Babak 1:</span><span className="font-bold text-emerald-600">Target 10 Menit</span></div>
              <div className="flex justify-between"><span>Bongkar (Strike):</span><span className="font-bold text-amber-600">Target 5 Menit</span></div>
              <div className="flex justify-between"><span>Cek Keamanan:</span><span className="font-bold text-blue-600">Sebelum Gladi</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: UPLOAD NASKAH ============ */}
      {isScriptModalOpen && canManageScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveScript}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" />
                {script ? 'Ganti Naskah' : 'Upload Naskah'}
              </h3>
              <button type="button" onClick={() => setIsScriptModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Naskah <span className="text-rose-500">*</span></label>
              <input type="text" required value={scriptTitle} onChange={(e) => setScriptTitle(e.target.value)}
                placeholder="Contoh: Legenda Danau Lipan" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Link Google Drive <span className="text-rose-500">*</span></label>
              <input type="url" required value={scriptUrl} onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://drive.google.com/..." 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
              <textarea rows={2} value={scriptNotes} onChange={(e) => setScriptNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsScriptModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button type="submit" disabled={savingScript}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {savingScript ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============ MODAL: TAMBAH/EDIT MUSIK ============ */}
      {isMusicModalOpen && canManageMusic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveMusic}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Headphones className="w-5 h-5 text-amber-500" />
                {editingMusic ? 'Edit Referensi' : 'Tambah Referensi Musik'}
              </h3>
              <button type="button" onClick={() => setIsMusicModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul / Nama Momen <span className="text-rose-500">*</span></label>
              <input type="text" required value={musicTitle} onChange={(e) => setMusicTitle(e.target.value)}
                placeholder="Contoh: Musik Masuk Raja Aji / Musik Konflik Perang / Musik Kesedihan Ratu" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Link Audio <span className="text-rose-500">*</span></label>
              <input type="url" required value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)}
                placeholder="https://youtu.be/... / https://drive.google.com/... / ...mp3" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              {modalPlayType && (
                <p className={`mt-2 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                  modalPlayType === 'audio' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                  modalPlayType === 'youtube' ? 'text-red-700 bg-red-50 border-red-200' :
                  modalPlayType === 'drive' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                  'text-slate-600 bg-slate-50 border-slate-200'
                }`}>
                  {modalPlayType === 'audio' && '🎵 MP3 langsung — bisa diputar & diunduh'}
                  {modalPlayType === 'youtube' && '▶️ YouTube — thumbnail akan muncul'}
                  {modalPlayType === 'drive' && '📁 Google Drive — bisa diunduh'}
                  {modalPlayType === 'external' && '🔗 Link eksternal'}
                </p>
              )}
              {modalYoutubeId && (
                <div className="mt-3 rounded-2xl overflow-hidden border-2 border-red-200 dark:border-red-500/40">
                  <div className="aspect-video bg-slate-900 relative">
                    <img src={getYouTubeThumbnail(modalYoutubeId, 'max')} alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (img.src.includes('maxresdefault')) img.src = getYouTubeThumbnail(modalYoutubeId, 'hq');
                      }} />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                <select value={musicCategory} onChange={(e) => setMusicCategory(e.target.value as MusicCategory)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Sumber</label>
                <select value={musicSource} onChange={(e) => setMusicSource(e.target.value as MusicSource)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi / Kapan Dipakai</label>
              <textarea rows={4} value={musicDescription} onChange={(e) => setMusicDescription(e.target.value)}
                placeholder="Contoh: Musik megah dengan genderang perang, dipakai saat Raja Tiongkok masuk istana di Babak 2."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsMusicModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button type="submit" disabled={savingMusic}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {savingMusic ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============ MODAL: DUPLIKAT REFERENSI ============ */}
      {isCopyModalOpen && activeClass && (
        <MusicCopyModal
          allClasses={classes}
          currentClassId={activeClass.id}
          musicRefs={musicRefs}
          onClose={() => setIsCopyModalOpen(false)}
          onSuccess={(count) => {
            showToast(`🎵 ${count} referensi musik berhasil diduplikat!`, 'success');
          }}
        />
      )}

      {/* ============ MODAL: PLAY YOUTUBE ============ */}
      {playingYoutube && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6 bg-slate-950/95 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-700">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Youtube className="w-5 h-5 text-red-500 shrink-0" />
                <h3 className="text-sm font-bold text-white truncate">{playingYoutube.title}</h3>
              </div>
              <button onClick={() => setPlayingYoutube(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe src={`https://www.youtube.com/embed/${playingYoutube.videoId}?autoplay=1`}
                title={playingYoutube.title} className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
            </div>
            <div className="p-3 bg-slate-800 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-slate-400">Ingin download? Buka YouTube & gunakan fitur download.</p>
              <a href={`https://www.youtube.com/watch?v=${playingYoutube.videoId}`}
                target="_blank" rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold flex items-center gap-1.5">
                <Youtube className="w-3.5 h-3.5" /> Buka di YouTube
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: PREVIEW NASKAH ============ */}
      {isPreviewOpen && script && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 backdrop-blur-md">
          <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                <FileText className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-amber-300">Pratinjau</p>
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
                  <div className="w-full h-full flex flex-col items-center justify-center text-white p-6">
                    <FileText className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-sm font-bold">Preview tidak tersedia</p>
                  </div>
                );
              }
              return <iframe src={previewUrl} title="Preview" className="w-full h-full border-0" allow="autoplay" />;
            })()}
          </div>
        </div>
      )}
    </div>
  );
};