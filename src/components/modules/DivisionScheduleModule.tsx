import React, { useState, useEffect } from 'react';
import { Users, PlusCircle, Calendar, Lock } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { HorizontalCarousel } from '../common/HorizontalCarousel';

export const DivisionScheduleModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  const isKoordinator = user?.role.startsWith('Koordinator ');
  const isAnggota = user?.role.startsWith('Anggota ');
  const myDivision = user?.divisionName || '';

  useEffect(() => {
    if (!activeClass || !myDivision) return;
    const q = query(
      collection(db, 'divisionSchedules'),
      where('classId', '==', activeClass.id),
      where('divisionName', '==', myDivision)
    );
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setItems(list);
    });
  }, [activeClass, myDivision]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !title.trim() || !date) return;
    const id = doc(collection(db, 'divisionSchedules')).id;
    await setDoc(doc(db, 'divisionSchedules', id), {
      id, classId: activeClass.id, divisionName: myDivision,
      title: title.trim(), date,
      authorName: user.displayName, authorRole: user.role,
      createdAt: new Date().toISOString(),
    });
    showToast('Jadwal divisi ditambahkan!', 'success');
    setIsOpen(false); setTitle(''); setDate('');
  };

  if (!myDivision) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <Lock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">Anda belum terdaftar di divisi manapun</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-900 to-slate-900 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-purple-300" />
            <div>
              <h2 className="text-xl font-black">Jadwal Internal Divisi</h2>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Hanya {myDivision} yang bisa lihat
              </p>
            </div>
          </div>
          {isKoordinator && (
            <button onClick={() => setIsOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Tambah Jadwal
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Belum ada jadwal internal divisi</p>
        </div>
      ) : (
        <HorizontalCarousel title={`📅 Jadwal ${myDivision}`} subtitle="Geser untuk melihat">
          {items.map((it: any) => (
            <div key={it.id} className="min-w-[260px] max-w-[260px] p-4 rounded-2xl bg-white border border-slate-200 flex-shrink-0">
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                {new Date(it.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 mt-2">{it.title}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Oleh: {it.authorName}</p>
            </div>
          ))}
        </HorizontalCarousel>
      )}

      {isOpen && isKoordinator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70">
          <div className="w-full max-w-md bg-white rounded-3xl p-6">
            <h3 className="text-base font-extrabold mb-4">Tambah Jadwal Divisi</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Judul jadwal" className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs" />
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
