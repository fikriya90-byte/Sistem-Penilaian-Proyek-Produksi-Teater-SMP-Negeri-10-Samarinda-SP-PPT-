import React, { useState, useEffect } from 'react';
import {
  Megaphone, PlusCircle, Search, X, Save, Trash2, AlertTriangle,
  Pin, Clock, User, Bell, Sparkles, PinOff,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { recordAuditLog, notifyTeachers } from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

interface Information {
  id: string;
  classId: string;
  title: string;
  content: string;
  category: 'PENGUMUMAN' | 'INFO' | 'URGENT' | 'JADWAL' | 'KEUANGAN';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  isPinned: boolean;
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

export const InformationModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<Information[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Information | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Information['category']>('PENGUMUMAN');
  const [priority, setPriority] = useState<Information['priority']>('MEDIUM');
  const [isPinned, setIsPinned] = useState(false);

  const canPost = user && (CAN_POST_ROLES.includes(user.role) || user.role.startsWith('Koordinator '));

  useEffect(() => {
    if (!activeClass) return;
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
    setIsModalOpen(true);
  };

  const openEdit = (item: Information) => {
    setEditing(item);
    setTitle(item.title); setContent(item.content);
    setCategory(item.category); setPriority(item.priority); setIsPinned(item.isPinned);
    setIsModalOpen(true);
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
      const id = editing?.id || doc(collection(db, 'information')).id;
      const data: Information = {
        id, classId: activeClass.id,
        title: title.trim(), content: content.trim(),
        category, priority, isPinned,
        authorId: user.uid, authorName: user.displayName, authorRole: user.role,
        createdAt: editing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'information', id), data, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editing ? 'UPDATE' : 'CREATE',
        targetType: 'Information', targetId: id,
        details: `${editing ? 'Edit' : 'Post'} informasi: "${title}"`,
      });
      if (!editing && (priority === 'HIGH' || category === 'URGENT')) {
        try {
          await notifyTeachers(activeClass.id, {
            title: `📢 ${category === 'URGENT' ? 'URGENT: ' : ''}${title.trim()}`,
            message: `${user.displayName} (${user.role}) memposting informasi penting.`,
            category: category === 'URGENT' ? 'Urgent' : 'Pengumuman',
            link: 'informasi',
            senderName: user.displayName,
          });
        } catch (err) { console.warn(err); }
      }
      showToast(`Informasi berhasil ${editing ? 'diperbarui' : 'diposting'}!`, 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (item: Information) => {
    if (!confirm(`Hapus informasi "${item.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'information', item.id));
      showToast('Informasi dihapus.', 'info');
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
              <p className="text-xs text-slate-300 mt-0.5">Semua pengumuman resmi tim teater {activeClass?.name || ''}</p>
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
                    <p className="text-xs text-slate-700 mt-1.5 leading-relaxed whitespace-pre-line">{it.content}</p>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-h-[92vh] overflow-y-auto">
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Isi Informasi *</label>
                <textarea rows={5} required value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan pengumuman lengkap dengan waktu, lokasi, dan hal yang perlu dibawa..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed" />
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                  <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-amber-300 text-amber-500" />
                  <Pin className="w-3.5 h-3.5" /> Sematkan di paling atas (pin)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : (editing ? 'Perbarui' : 'Posting')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
