import React, { useState, useEffect } from 'react';
import {
  Camera, PlusCircle, Calendar, Instagram, X, Save, Trash2,
  Edit3, Search, Filter, Clock, User, CheckCircle, FileText,
  Play, Image as ImageIcon, Video, Megaphone, Sparkles, Eye,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

// =====================================================
// TIPE DATA
// =====================================================
type ContentStatus = 'DRAFT' | 'APPROVED' | 'POSTED';

type ContentCategory =
  | 'Poster'
  | 'Teaser'
  | 'Video'
  | 'Foto'
  | 'Story'
  | 'Reels'
  | 'Behind The Scenes'
  | 'Countdown'
  | 'Pengumuman'
  | 'Lainnya';

interface ContentItem {
  id: string;
  classId: string;
  category: ContentCategory;
  title: string;
  platform: string;
  date: string;          // YYYY-MM-DD
  status: ContentStatus;
  pic: string;
  notes: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  updatedAt?: string;
}

const CATEGORIES: { value: ContentCategory; label: string; icon: any; color: string }[] = [
  { value: 'Poster',             label: 'Poster',              icon: ImageIcon,  color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'Teaser',             label: 'Teaser',              icon: Play,       color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { value: 'Video',              label: 'Video',               icon: Video,      color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'Foto',               label: 'Foto',                icon: Camera,     color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'Story',              label: 'Story',               icon: Sparkles,   color: 'bg-pink-100 text-pink-800 border-pink-300' },
  { value: 'Reels',              label: 'Reels',               icon: Play,       color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  { value: 'Behind The Scenes',  label: 'Behind The Scenes',   icon: Eye,        color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'Countdown',          label: 'Countdown',           icon: Clock,      color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'Pengumuman',         label: 'Pengumuman',          icon: Megaphone,  color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { value: 'Lainnya',            label: 'Lainnya',             icon: FileText,   color: 'bg-slate-100 text-slate-700 border-slate-300' },
];

const PLATFORMS = ['Instagram', 'TikTok', 'WhatsApp', 'Poster Cetak', 'YouTube', 'Facebook'];

const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; gradient: string; icon: any }> = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    gradient: 'from-slate-600 to-slate-800',
    icon: FileText,
  },
  APPROVED: {
    label: 'Disetujui',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    gradient: 'from-amber-500 to-amber-700',
    icon: CheckCircle,
  },
  POSTED: {
    label: 'Sudah Diposting',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    gradient: 'from-emerald-600 to-emerald-800',
    icon: CheckCircle,
  },
};

// =====================================================
// KOMPONEN
// =====================================================
export const ContentScheduleModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | ContentStatus>('ALL');
  const [filterCategory, setFilterCategory] = useState<'ALL' | ContentCategory>('ALL');
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [category, setCategory] = useState<ContentCategory>('Poster');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<ContentStatus>('DRAFT');
  const [pic, setPic] = useState('');
  const [notes, setNotes] = useState('');

  const canPost = !!user && [
    'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
    'Koordinator Publikasi', 'Anggota Publikasi',
    'Pimpinan Produksi', 'Sutradara',
  ].includes(user.role);

  const canEditAny = !!user && [
    'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
    'Koordinator Publikasi', 'Pimpinan Produksi',
  ].includes(user.role);

  // =====================================================
  // SUBSCRIBE
  // =====================================================
  useEffect(() => {
    if (!activeClass) return;
    const q = query(
      collection(db, 'contentSchedule'),
      where('classId', '==', activeClass.id)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as ContentItem));
      list.sort((a, b) => {
        // Sort: POSTED di atas? Tidak — sort berdasarkan tanggal desc
        const da = new Date(a.date || 0).getTime();
        const dbb = new Date(b.date || 0).getTime();
        return dbb - da;
      });
      setItems(list);
    });
    return () => unsub();
  }, [activeClass]);

  // =====================================================
  // HANDLERS
  // =====================================================
  const openCreate = () => {
    setEditing(null);
    setCategory('Poster');
    setTitle('');
    setPlatform('Instagram');
    setDate(new Date().toISOString().slice(0, 10));
    setStatus('DRAFT');
    setPic(user?.displayName || '');
    setNotes('');
    setIsOpen(true);
  };

  const openEdit = (item: ContentItem) => {
    setEditing(item);
    setCategory(item.category);
    setTitle(item.title);
    setPlatform(item.platform);
    setDate(item.date);
    setStatus(item.status);
    setPic(item.pic);
    setNotes(item.notes);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim()) {
      showToast('Judul konten wajib diisi.', 'warning');
      return;
    }
    if (!date) {
      showToast('Tanggal posting wajib diisi.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const id = editing?.id || doc(collection(db, 'contentSchedule')).id;
      const data: ContentItem = {
        id,
        classId: activeClass.id,
        category,
        title: title.trim(),
        platform,
        date,
        status,
        pic: pic.trim(),
        notes: notes.trim(),
        authorId: editing?.authorId || user.uid,
        authorName: editing?.authorName || user.displayName,
        createdAt: editing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'contentSchedule', id), data, { merge: true });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: editing ? 'UPDATE' : 'CREATE',
        targetType: 'ContentSchedule',
        targetId: id,
        details: `${editing ? 'Edit' : 'Tambah'} konten: "${title}" (${category} - ${platform})`,
      });

      showToast(`Konten ${editing ? 'diperbarui' : 'ditambahkan'}!`, 'success');
      setIsOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: ContentItem) => {
    if (!user) return;
    const canDel = canEditAny || item.authorId === user.uid;
    if (!canDel) {
      showToast('Anda tidak berwenang menghapus konten ini.', 'warning');
      return;
    }
    if (!confirm(`Hapus konten "${item.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'contentSchedule', item.id));
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'DELETE',
        targetType: 'ContentSchedule',
        targetId: item.id,
        details: `Hapus konten: "${item.title}"`,
      });
      showToast('Konten dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleQuickStatus = async (item: ContentItem) => {
    if (!user) return;
    const canEdit = canEditAny || item.authorId === user.uid;
    if (!canEdit) {
      showToast('Anda tidak berwenang mengubah status.', 'warning');
      return;
    }
    const order: ContentStatus[] = ['DRAFT', 'APPROVED', 'POSTED'];
    const idx = order.indexOf(item.status);
    const next = order[(idx + 1) % order.length];
    try {
      await updateDoc(doc(db, 'contentSchedule', item.id), {
        status: next,
        updatedAt: new Date().toISOString(),
      });
      showToast(`Status → ${STATUS_CONFIG[next].label}`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // =====================================================
  // FILTER
  // =====================================================
  const filtered = items.filter(it => {
    if (filterStatus !== 'ALL' && it.status !== filterStatus) return false;
    if (filterCategory !== 'ALL' && it.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        it.title.toLowerCase().includes(q) ||
        (it.notes || '').toLowerCase().includes(q) ||
        (it.pic || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by status untuk tampilan card
  const grouped: Record<ContentStatus, ContentItem[]> = {
    DRAFT: filtered.filter(i => i.status === 'DRAFT'),
    APPROVED: filtered.filter(i => i.status === 'APPROVED'),
    POSTED: filtered.filter(i => i.status === 'POSTED'),
  };

  const stats = {
    total: items.length,
    draft: items.filter(i => i.status === 'DRAFT').length,
    approved: items.filter(i => i.status === 'APPROVED').length,
    posted: items.filter(i => i.status === 'POSTED').length,
  };

  const getCategoryMeta = (cat: ContentCategory) =>
    CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-800 text-white shadow-xl border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Camera className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Jadwal Konten Publikasi
              </span>
              <h2 className="text-xl font-black text-white mt-1">Kalender Konten Media Sosial</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Rencanakan poster, teaser, video, & konten lain — lengkap dengan tanggal posting & status produksi
              </p>
            </div>
          </div>

          {canPost && (
            <button onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <PlusCircle className="w-4 h-4" /> Tambah Konten
            </button>
          )}
        </div>
      </div>

      {/* INFO AKSES */}
      {!canPost && (
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
          <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
            Anda dapat <strong>melihat</strong> jadwal konten. Yang berhak menambah/mengubah:
            <strong> Koordinator Publikasi, Guru, & Pimpinan Produksi</strong>.
          </p>
        </div>
      )}

      {/* STATISTIK */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Konten</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Draft</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">{stats.draft}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">Disetujui</p>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-200">{stats.approved}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Sudah Diposting</p>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{stats.posted}</p>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul konten, catatan, atau PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
          >
            <option value="ALL">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Disetujui</option>
            <option value="POSTED">Sudah Diposting</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
          >
            <option value="ALL">Semua Kategori</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* LIST — Grouped by status */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Camera className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Konten</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canPost ? 'Klik "Tambah Konten" untuk merencanakan konten pertama.' : 'Tunggu tim publikasi menyusun jadwal konten.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['DRAFT', 'APPROVED', 'POSTED'] as ContentStatus[]).map(statusKey => {
            const group = grouped[statusKey];
            if (group.length === 0) return null;
            const cfg = STATUS_CONFIG[statusKey];
            const Icon = cfg.icon;

            return (
              <div key={statusKey} className="space-y-3">
                <div className={`p-3 rounded-2xl bg-gradient-to-r ${cfg.gradient} text-white flex items-center gap-2 shadow-sm`}>
                  <Icon className="w-4 h-4" />
                  <h3 className="text-sm font-extrabold uppercase tracking-wide">{cfg.label}</h3>
                  <span className="text-[11px] font-bold bg-white/25 px-2 py-0.5 rounded-full ml-auto">
                    {group.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map(item => {
                    const catMeta = getCategoryMeta(item.category);
                    const CatIcon = catMeta.icon;
                    const canEdit = canEditAny || item.authorId === user?.uid;
                    const itemDate = item.date
                      ? new Date(item.date + (item.date.length === 10 ? 'T00:00:00' : ''))
                      : null;
                    const dateLabel = itemDate
                      ? itemDate.toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : '-';

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition flex flex-col"
                      >
                        {/* Header card */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${catMeta.color}`}>
                            <CatIcon className="w-3 h-3" />
                            {catMeta.label}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Instagram className="w-2.5 h-2.5" />
                            {item.platform}
                          </span>
                        </div>

                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-2">
                          {item.title}
                        </h4>

                        {/* Tanggal */}
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold">{dateLabel}</span>
                        </div>

                        {/* PIC */}
                        {item.pic && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">PIC: {item.pic}</span>
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 italic line-clamp-2">
                            "{item.notes}"
                          </p>
                        )}

                        {/* Actions */}
                        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5 flex-wrap">
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => handleQuickStatus(item)}
                                className="flex-1 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center gap-1 transition"
                                title="Ubah status ke tahap berikutnya"
                              >
                                <CheckCircle className="w-3 h-3" /> Lanjut Status
                              </button>
                              <button
                                onClick={() => openEdit(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Hanya lihat — oleh {item.authorName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORM */}
      {isOpen && canPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-500" />
                {editing ? 'Edit Konten' : 'Tambah Konten Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Kategori */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Kategori Konten <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map(c => {
                  const Icon = c.icon;
                  const sel = category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`p-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 ${
                        sel
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${sel ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <span className={`text-[11px] font-bold truncate ${sel ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Judul */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Konten <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Poster Resmi Pementasan Teater IX-C"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              />
            </div>

            {/* Platform + Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Platform <span className="text-rose-500">*</span>
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Posting <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Status <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['DRAFT', 'APPROVED', 'POSTED'] as ContentStatus[]).map(st => {
                  const cfg = STATUS_CONFIG[st];
                  const Icon = cfg.icon;
                  const sel = status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        sel
                          ? `${cfg.color}`
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIC */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                PIC / Penanggung Jawab
              </label>
              <input
                type="text"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                placeholder="Nama penanggung jawab konten"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan / Keterangan
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: caption sudah siap, tinggal upload. Tag ke @smpn10samarinda"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {submitting ? 'Menyimpan...' : (editing ? 'Perbarui Konten' : 'Simpan Konten')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};