import React, { useState, useEffect } from 'react';
import { Calendar, PlusCircle, X, Save, Clock, Flag } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { HorizontalCarousel } from '../common/HorizontalCarousel';

export const MasterTimelineModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');

  const canPost = user && ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Pimpinan Produksi'].includes(user.role);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'masterTimeline'), where('classId', '==', activeClass.id));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setItems(list);
    });
  }, [activeClass]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !title.trim() || !date) return;
    const id = doc(collection(db, 'masterTimeline')).id;
    await setDoc(doc(db, 'masterTimeline', id), {
      id, classId: activeClass.id, title: title.trim(), date, desc: desc.trim(),
      authorName: user.displayName, authorRole: user.role,
      createdAt: new Date().toISOString(),
    });
    showToast('Timeline ditambahkan!', 'success');
    setIsOpen(false); setTitle(''); setDate(''); setDesc('');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Flag className="w-7 h-7 text-amber-300" />
            <div>
              <h2 className="text-xl font-black">Master Timeline Produksi</h2>
              <p className="text-xs text-slate-300">Milestone utama dari Pimpinan Produksi</p>
            </div>
          </div>
          {canPost && (
            <button onClick={() => setIsOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Tambah Milestone
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Belum ada milestone</p>
        </div>
      ) : (
        <HorizontalCarousel title="📅 Semua Milestone" subtitle="Geser untuk melihat">
          {items.map((it: any) => (
            <div key={it.id} className="min-w-[260px] max-w-[260px] p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-bold text-blue-700">
                  {new Date(it.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">{it.title}</h3>
              {it.desc && <p className="text-xs text-slate-600 mt-1">{it.desc}</p>}
              <p className="text-[10px] text-slate-400 mt-3">Oleh: {it.authorName}</p>
            </div>
          ))}
        </HorizontalCarousel>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70">
          <div className="w-full max-w-md bg-white rounded-3xl p-6">
            <h3 className="text-base font-extrabold mb-4">Tambah Milestone</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Judul milestone" className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Deskripsi (opsional)" className="w-full p-3 rounded-xl border border-slate-200 text-xs" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600">Batal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
