import React, { useState, useEffect, useRef } from 'react';
import {
  Megaphone, PlusCircle, Search, X, Save, Trash2, AlertTriangle,
  Pin, Clock, User, Filter, Bell, Sparkles, PinOff,
  Camera, ImagePlus, Link2, CheckSquare, Square, Building2, Users,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { recordAuditLog, notifyTeachers } from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, deleteDoc, updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

interface Information {
  id: string;
  classId: string;
  batchId?: string; // ID grup untuk multi-class broadcast
  title: string;
  content: string;
  category: 'PENGUMUMAN' | 'INFO' | 'URGENT' | 'JADWAL' | 'KEUANGAN';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  isPinned: boolean;
  photoUrls?: string[];
  photoUrl?: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt?: string;
}

const CATEGORY_CONFIG = {
  PENGUMUMAN: { label: 'Pengumuman', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Megaphone },
  INFO: { label: 'Info Umum', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Bell },
  URGENT: { label: 'Urgent', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: AlertTriangle },
  JADWAL: { label: 'Jadwal', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: Clock },
  KEUANGAN: { label: 'Keuangan', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Sparkles },
};

const CAN_POST_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
  'Pimpinan Produksi', 'Sekretaris', 'Sutradara', 'Asisten Sutradara', 'Bendahara',
];

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX_WIDTH = 800;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas tidak tersedia'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

// =====================================================
// ✅ HELPER: SANITASI & DETEKSI URL
// =====================================================
function sanitizeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  let trimmed = String(url).trim();
  if (!trimmed) return null;
  
  // Auto-prefix jika user hanya mengetik www. atau domain biasa tanpa http
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://' + trimmed;
  }
  
  // Hanya izinkan http/https. Tolak javascript:, data:, dll (XSS guard).
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return null;
  return trimmed;
}

// Regex mendeteksi URL di dalam teks bebas (http, https, www)
const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

function renderTextWithLinks(text: string, baseClass = 'text-slate-700 dark:text-slate-300'): React.ReactNode {
  if (!text) return null;
  
  const parts = text.split(URL_REGEX);
  
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0; 
      
      let cleanPart = part;
      let trailingPunct = '';
      const matchPunct = part.match(/[.,;:!?]+$/);
      if (matchPunct) {
        cleanPart = part.slice(0, -matchPunct[0].length);
        trailingPunct = matchPunct[0];
      }

      const safe = sanitizeUrl(cleanPart);
      if (safe) {
        return (
          <React.Fragment key={i}>
            <a
              href={safe}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 font-semibold underline decoration-dotted underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300 break-all inline-flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {cleanPart}
              <ExternalLink className="w-3 h-3 inline" />
            </a>
            {trailingPunct}
          </React.Fragment>
        );
      }
    }
    URL_REGEX.lastIndex = 0;
    return <span key={i} className={baseClass}>{part}</span>;
  });
}

export const InformationModule: React.FC = () => {
  const { user, activeClass, classes, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Information[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Information | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Information['category']>('PENGUMUMAN');
  const [priority, setPriority] = useState<Information['priority']>('MEDIUM');
  const [isPinned, setIsPinned] = useState(false);
  
  // Multi-Class Target
  const [sendToAll, setSendToAll] = useState(false);
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);

  // FOTO
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const canPost = user && (CAN_POST_ROLES.includes(user.role) || user.role.startsWith('Koordinator '));
  const canMultiClass = isGuruPengampu || isAdminRole; // Fitur lintas kelas hanya untuk Guru/Admin

  useEffect(() => {
    if (!activeClass) return;
    // Query mengambil data dari kelas yang sedang aktif
    const q = query(collection(db, 'information'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Information));
      list.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setItems(list);
    });
    return () => unsub();
  }, [activeClass]);

  const openCreate = () => {
    setEditing(null);
    setTitle(''); setContent('');
    setCategory('PENGUMUMAN'); setPriority('MEDIUM'); setIsPinned(false);
    setPhotoUrls([]); setPhotoUrlInput('');
    
    // Default target kelas
    if (canMultiClass) {
      setSendToAll(false);
      setTargetClassIds(activeClass ? [activeClass.id] : []);
    } else if (activeClass) {
      setTargetClassIds([activeClass.id]);
    }
    
    setIsModalOpen(true);
  };

  const openEdit = (item: Information) => {
    setEditing(item);
    setTitle(item.title); setContent(item.content);
    setCategory(item.category); setPriority(item.priority); setIsPinned(item.isPinned);
    
    // Set targetClassIds ke kelas asli info ini (untuk berjaga-jaga)
    setTargetClassIds([item.classId]);
    setSendToAll(false);

    const existingPhotos = item.photoUrls || (item.photoUrl ? [item.photoUrl] : []);
    setPhotoUrls(existingPhotos);
    setPhotoUrlInput('');
    
    setIsModalOpen(true);
  };

  const toggleTargetClass = (id: string) => {
    setTargetClassIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setSendToAll(false);
  };

  const handleSendToAllToggle = () => {
    const next = !sendToAll;
    setSendToAll(next);
    if (next) {
      setTargetClassIds(classes.map(c => c.id));
    } else {
      setTargetClassIds(activeClass ? [activeClass.id] : []);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (photoUrls.length + files.length > 5) {
      showToast('Maksimal 5 foto. Anda sudah memiliki ' + photoUrls.length + ' foto.', 'warning');
      e.target.value = '';
      return;
    }

    const newPhotos: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) {
        showToast('File ' + file.name + ' terlalu besar (maks 5MB).', 'warning');
        continue;
      }
      try {
        const base64 = await compressImage(file);
        newPhotos.push(base64);
      } catch (err) {
        console.warn('Gagal kompres:', err);
      }
    }

    setPhotoUrls(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const handleAddPhotoUrl = () => {
    if (!photoUrlInput.trim()) return;
    if (!photoUrlInput.startsWith('http')) {
      showToast('URL foto harus dimulai dengan http:// atau https://', 'warning');
      return;
    }
    if (photoUrls.length >= 5) {
      showToast('Maksimal 5 foto.', 'warning');
      return;
    }
    setPhotoUrls(prev => [...prev, photoUrlInput.trim()]);
    setPhotoUrlInput('');
  };

  const removePhoto = (index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !content.trim()) {
      showToast('Judul dan isi wajib diisi.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        // ==========================================
        // MODE EDIT: Hanya update dokumen (Bebas validasi kelas)
        // ==========================================
        await updateDoc(doc(db, 'information', editing.id), {
          title: title.trim(),
          content: content.trim(),
          category, priority, isPinned,
          photoUrls: photoUrls,
          photoUrl: '', // clear legacy
          updatedAt: new Date().toISOString(),
        });
        showToast('Informasi berhasil diperbarui.', 'success');
      } else {
        // ==========================================
        // MODE BUAT BARU: Validasi kelas wajib di sini
        // ==========================================
        if (targetClassIds.length === 0) {
          showToast('Pilih minimal 1 kelas tujuan.', 'warning');
          setSubmitting(false);
          return;
        }

        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const broadcastGroupId = targetClassIds.length > 1 ? doc(collection(db, 'information')).id : undefined;

        targetClassIds.forEach(cid => {
          const newRef = doc(collection(db, 'information'));
          batch.set(newRef, {
            id: newRef.id,
            classId: cid,
            batchId: broadcastGroupId,
            title: title.trim(),
            content: content.trim(),
            category, priority, isPinned,
            photoUrls: photoUrls,
            photoUrl: '',
            authorId: user.uid,
            authorName: user.displayName,
            authorRole: user.role,
            createdAt: now,
            updatedAt: now,
          });
        });

        await batch.commit();

        if (priority === 'HIGH' || category === 'URGENT') {
          for (const cid of targetClassIds) {
            try {
              await notifyTeachers(cid, {
                title: `${category === 'URGENT' ? 'URGENT: ' : ''}${title.trim()}`,
                message: `${user.displayName} (${user.role}) memposting informasi penting.`,
                category: category === 'URGENT' ? 'Urgent' : 'Pengumuman',
                link: 'informasi',
                senderName: user.displayName,
              });
            } catch (err) { console.warn('Notif error:', err); }
          }
        }

        showToast(`Informasi berhasil diposting ke ${targetClassIds.length} kelas!`, 'success');
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editing ? 'UPDATE' : 'CREATE',
        targetType: 'Information', targetId: editing?.id || 'multiple',
        details: `${editing ? 'Edit' : 'Post'} informasi: "${title}"${photoUrls.length > 0 ? ` + ${photoUrls.length} foto` : ''}`,
      });

      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: Information) => {
    const msg = item.batchId 
      ? `Hapus informasi "${item.title}" dari kelas ini? (Info ini juga ada di kelas lain karena broadcast)`
      : `Hapus informasi "${item.title}"?`;
      
    if (!confirm(msg)) return;
    try {
      await deleteDoc(doc(db, 'information', item.id));
      showToast('Informasi dihapus dari kelas ini.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const togglePin = async (item: Information) => {
    try {
      await updateDoc(doc(db, 'information', item.id), {
        isPinned: !item.isPinned, updatedAt: new Date().toISOString(),
      });
      showToast(item.isPinned ? 'Info dilepas dari pin.' : 'Info disematkan.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filtered = items.filter((it) => {
    if (filterCategory !== 'ALL' && it.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return it.title.toLowerCase().includes(q) || it.content.toLowerCase().includes(q) ||
        it.authorName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-900 via-slate-900 to-slate-800 text-white shadow-xl border border-amber-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Megaphone className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Papan Informasi
              </span>
              <h2 className="text-xl font-black text-white mt-1">Pengumuman & Informasi Produksi</h2>
              <p className="text-xs text-slate-300 mt-0.5">Papan informasi terintegrasi seluruh kelas</p>
            </div>
          </div>
          {canPost && (
            <button onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <PlusCircle className="w-4 h-4" /> Posting Informasi
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari informasi..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              filterCategory === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
            Semua ({items.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const count = items.filter((i) => i.category === key).length;
            return (
              <button key={key} onClick={() => setFilterCategory(key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  filterCategory === key ? 'bg-amber-500 text-slate-950' : 'bg-white text-slate-600 border border-slate-200'
                }`}>
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Megaphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Informasi</h3>
          <p className="text-xs text-slate-500 mt-1">
            {canPost ? 'Klik "Posting Informasi" untuk membuat pengumuman pertama.' : 'Tunggu info dari pengurus.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => {
            const cfg = CATEGORY_CONFIG[it.category];
            const Icon = cfg.icon;
            const canEdit = isGuruPengampu || isAdminRole || it.authorId === user?.uid;
            
            const allPhotos = it.photoUrls && it.photoUrls.length > 0 
              ? it.photoUrls 
              : (it.photoUrl ? [it.photoUrl] : []);

            return (
              <div key={it.id} className={`p-5 rounded-3xl border shadow-sm transition ${
                it.isPinned ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' :
                it.category === 'URGENT' ? 'bg-rose-50 border-rose-300' :
                'bg-white border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <span className={`p-2.5 rounded-xl border shrink-0 ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {it.isPinned && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 flex items-center gap-1">
                          <Pin className="w-3 h-3" /> DISEMATKAN
                        </span>
                      )}
                      {it.batchId && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> LINTAS KELAS
                        </span>
                      )}
                      {allPhotos.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <ImagePlus className="w-3 h-3" /> {allPhotos.length} FOTO
                        </span>
                      )}
                      {it.priority === 'HIGH' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white">PENTING</span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(it.createdAt).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{it.title}</h3>
                    
                    {/* Render teks dengan tautan otomatis */}
                    <div className="text-xs mt-1.5 leading-relaxed whitespace-pre-line">
                      {renderTextWithLinks(it.content, "text-slate-700")}
                    </div>
                    
                    {allPhotos.length > 0 && (
                      <div className={`mt-3 grid gap-2 ${
                        allPhotos.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : 
                        allPhotos.length === 2 ? 'grid-cols-2' : 
                        'grid-cols-2 sm:grid-cols-3'
                      }`}>
                        {allPhotos.map((url, idx) => (
                          <div key={idx} className="relative aspect-video sm:aspect-square md:aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                            <img
                              src={url}
                              alt={`Foto ${idx + 1}`}
                              onClick={() => setPreviewPhoto(url)}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        <strong className="text-slate-700">{it.authorName}</strong>
                        <span className="text-slate-400">({it.authorRole})</span>
                      </span>
                      {canPost && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => togglePin(it)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 transition ${
                              it.isPinned ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {it.isPinned ? <><PinOff className="w-3 h-3" /> Lepas</> : <><Pin className="w-3 h-3" /> Sematkan</>}
                          </button>
                          {canEdit && (
                            <>
                              <button onClick={() => openEdit(it)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[10px]">
                                Edit
                              </button>
                              <button onClick={() => handleDelete(it)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-500" />
                {editing ? 'Edit Informasi' : 'Posting Informasi Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Informasi *</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Rapat Pleno Darurat Besok Pukul 14.00"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as Information['category'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white">
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prioritas</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as Information['priority'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white">
                    <option value="LOW">Rendah</option>
                    <option value="MEDIUM">Sedang</option>
                    <option value="HIGH">Tinggi (Penting)</option>
                  </select>
                </div>
              </div>

              {/* MULTI-CLASS SELECTOR (Hanya saat create, dan user berhak) */}
              {!editing && canMultiClass && (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-600" />
                    Pilih Kelas Tujuan *
                  </label>
                  
                  <button type="button" onClick={handleSendToAllToggle}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition mb-2 ${
                      sendToAll ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      sendToAll ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'
                    }`}>
                      {sendToAll && <CheckSquare className="w-3 h-3" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900">SEMUA KELAS ({classes.length})</span>
                  </button>

                  <div className="max-h-40 overflow-y-auto space-y-1 p-1">
                    {classes.map(c => {
                      const sel = targetClassIds.includes(c.id);
                      return (
                        <button key={c.id} type="button" onClick={() => toggleTargetClass(c.id)}
                          className={`w-full p-2 rounded-lg text-left transition flex items-center gap-2 ${
                            sel ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-slate-200'
                          }`}>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                            sel ? 'bg-amber-500 text-white' : 'border-2 border-slate-300'
                          }`}>
                            {sel && <CheckSquare className="w-2.5 h-2.5" />}
                          </div>
                          <span className="text-[11px] font-bold text-slate-800 truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 mt-2">
                    {targetClassIds.length} kelas dipilih
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Isi Informasi *</label>
                <textarea rows={4} required value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan pengumuman lengkap dengan waktu, lokasi, dan hal yang perlu dibawa...&#10;&#10;Tips: Anda bisa menempelkan link YouTube atau Google Drive di sini. Link akan otomatis bisa diklik setelah disimpan."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed" />
              </div>
              
              {/* UPLOAD FOTO MULTIPLE */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-amber-600" />
                    Foto Pendukung <span className="text-slate-400 font-normal">({photoUrls.length}/5)</span>
                  </label>
                </div>

                {photoUrls.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                    {photoUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white group">
                        <img src={url} alt={`Foto ${idx+1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {photoUrls.length < 5 && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex flex-col items-center gap-1 transition"
                    >
                      <Camera className="w-5 h-5" />
                      Pilih Foto
                    </button>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="url"
                          placeholder="Atau tempel link foto"
                          value={photoUrlInput}
                          onChange={(e) => setPhotoUrlInput(e.target.value)}
                          className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 text-[11px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPhotoUrl}
                        disabled={!photoUrlInput.trim()}
                        className="px-3 py-2 rounded-lg bg-slate-800 text-white font-bold text-[11px] disabled:opacity-50"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                  <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-amber-300 text-amber-500" />
                  <Pin className="w-3.5 h-3.5" />
                  Sematkan di paling atas (pin)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : (editing ? 'Perbarui' : `Posting ke ${targetClassIds.length} Kelas`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX FOTO */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/95 backdrop-blur-md"
          onClick={() => setPreviewPhoto(null)}
        >
          <button
            onClick={() => setPreviewPhoto(null)}
            className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition"
            title="Tutup"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewPhoto}
            alt="Preview Foto"
            className="max-w-full max-h-[92vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};