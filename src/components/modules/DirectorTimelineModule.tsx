import React, { useState, useEffect } from 'react';
import { Sparkles, PlusCircle, Clock } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { HorizontalCarousel } from '../common/HorizontalCarousel';

export const DirectorTimelineModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [phase, setPhase] = useState('Latihan');

  const canPost = user && ['Sutradara', 'Asisten Sutradara', 'Guru Pengampu', 'Guru Pembina', 'Admin'].includes(user.role);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'directorTimeline'), where('classId', '==', activeClass.id));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setItems(list);
    });
  }, [activeClass]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !title.trim() || !date) return;
    const id = doc(collection(db, 'directorTimeline')).id;
    await setDoc(doc(db, 'directorTimeline', id), {
      id, classId: activeClass.id, title: title.trim(), date, phase,
      authorName: user.displayName, authorRole: user.role,
      createdAt: new Date().toISOString(),
    });
    showToast('Timeline sutradara ditambahkan!', 'success');
    setIsOpen(false); setTitle(''); setDate('');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-900 to-pink-900 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-pink-300" />
            <div>
              <h2 className="text-xl font-black">Timeline Sutradara</h2>
              <p className="text-xs text-slate-300">Timeline khusus penyutradaraan & latihan</p>
            </div>
          </div>
          {canPost && (
            <button onClick={() => setIsOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Tambah Timeline
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Belum ada timeline</p>
        </div>
      ) : (
        <HorizontalCarousel title="🎬 Timeline Sutradara" subtitle="Geser untuk melihat">
          {items.map((it: any) => (
            <div key={it.id} className="min-w-[260px] max-w-[260px] p-4 rounded-2xl bg-white border border-rose-200 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">{it.phase}</span>
                <span className="text-[10px] text-slate-400 ml-auto">
                  {new Date(it.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">{it.title}</h3>
              <p className="text-[10px] text-slate-400 mt-1">{it.authorName}</p>
            </div>
          ))}
        </HorizontalCarousel>
      )}

      {isOpen && canPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70">
          <div className="w-full max-w-md bg-white rounded-3xl p-6">
            <h3 className="text-base font-extrabold mb-4">Tambah Timeline</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <select value={phase} onChange={e => setPhase(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs">
                <option>Latihan</option>
                <option>Gladi</option>
                <option>Pementasan</option>
                <option>Evaluasi</option>
              </select>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Judul milestone" className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
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
