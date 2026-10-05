import React, { useState, useEffect } from 'react';
import { Camera, PlusCircle, Calendar, Instagram } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { HorizontalCarousel } from '../common/HorizontalCarousel';

const PHASES = ['H-30', 'H-14', 'H-7', 'H-1', 'Hari-H'];

export const ContentScheduleModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState('H-30');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('Instagram');

  const canPost = user && ['Guru Pengampu', 'Koordinator Publikasi', 'Anggota Publikasi', 'Admin'].includes(user.role);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'contentSchedule'), where('classId', '==', activeClass.id));
    return onSnapshot(q, snap => setItems(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
  }, [activeClass]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !title.trim()) return;
    const id = doc(collection(db, 'contentSchedule')).id;
    await setDoc(doc(db, 'contentSchedule', id), {
      id, classId: activeClass.id, phase, title: title.trim(), platform,
      authorName: user.displayName, createdAt: new Date().toISOString(),
    });
    showToast('Jadwal konten ditambahkan!', 'success');
    setIsOpen(false); setTitle('');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Camera className="w-7 h-7 text-emerald-300" />
            <div>
              <h2 className="text-xl font-black">Jadwal Konten Publikasi</h2>
              <p className="text-xs text-slate-300">Kalender konten H-30 sampai Hari-H</p>
            </div>
          </div>
          {canPost && (
            <button onClick={() => setIsOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Tambah Konten
            </button>
          )}
        </div>
      </div>

      {PHASES.map(p => {
        const phaseItems = items.filter(it => it.phase === p);
        return (
          <HorizontalCarousel key={p} title={`📸 ${p}`} subtitle={`${phaseItems.length} konten`}>
            {phaseItems.length === 0 ? (
              <div className="min-w-[200px] p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-400 text-center">
                Belum ada
              </div>
            ) : (
              phaseItems.map((it: any) => (
                <div key={it.id} className="min-w-[220px] max-w-[220px] p-3 rounded-2xl bg-white border border-slate-200 flex-shrink-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Instagram className="w-3 h-3 text-pink-600" />
                    <span className="text-[10px] font-bold text-pink-600">{it.platform}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{it.title}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{it.authorName}</p>
                </div>
              ))
            )}
          </HorizontalCarousel>
        );
      })}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70">
          <div className="w-full max-w-md bg-white rounded-3xl p-6">
            <h3 className="text-base font-extrabold mb-4">Tambah Konten</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <select value={phase} onChange={e => setPhase(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs">
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Judul konten" className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
              <select value={platform} onChange={e => setPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs">
                <option>Instagram</option>
                <option>TikTok</option>
                <option>WhatsApp</option>
                <option>Poster Cetak</option>
              </select>
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
