import React, { useState, useEffect } from 'react';
import {
  Music, Plus, Edit3, Trash2, X, Save, Play, Volume2, Clock, Hash, Search,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { doc, collection, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface MusicCue {
  id: string;
  classId: string;
  scene: string;
  cueType: string;
  title: string;
  audioUrl: string;
  volume: number;
  duration: string;
  notes: string;
  createdAt: string;
}

const CUE_TYPES = [
  'Musik Pembuka (Overture)',
  'Musik Penutup',
  'Musik Pergantian Babak',
  'Musik Ilustrasi',
  'Musik Sound Track',
  'Musik Theme Song',
  'Musik Penokohan',
  'Musik Aksentuasi',
  'Musik Setting',
  'Musik Pelebur Emosi',
];

export const MusicCueModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [cues, setCues] = useState<MusicCue[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<MusicCue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [scene, setScene] = useState('');
  const [cueType, setCueType] = useState(CUE_TYPES[0]);
  const [title, setTitle] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [volume, setVolume] = useState(80);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = user && (
    user.role === 'Koordinator Tata Musik' ||
    user.role === 'Anggota Tata Musik' ||
    user.role === 'Guru Pengampu' || user.role === 'Guru Pembina' ||
    user.role === 'Admin' || user.role === 'Super Admin'
  );

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'musicCues'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setCues(snap.docs.map(d => ({ ...d.data(), id: d.id } as MusicCue)));
    });
    return () => unsub();
  }, [activeClass]);

  const openCreate = () => {
    setEditing(null);
    setScene(''); setCueType(CUE_TYPES[0]); setTitle('');
    setAudioUrl(''); setVolume(80); setDuration(''); setNotes('');
    setIsOpen(true);
  };

  const openEdit = (cue: MusicCue) => {
    setEditing(cue);
    setScene(cue.scene); setCueType(cue.cueType); setTitle(cue.title);
    setAudioUrl(cue.audioUrl); setVolume(cue.volume); setDuration(cue.duration); setNotes(cue.notes);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !title.trim()) return;
    setSubmitting(true);
    try {
      const id = editing?.id || doc(collection(db, 'musicCues')).id;
      const data: MusicCue = {
        id, classId: activeClass.id,
        scene: scene.trim(), cueType, title: title.trim(),
        audioUrl: audioUrl.trim(), volume, duration: duration.trim(), notes: notes.trim(),
        createdAt: editing?.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'musicCues', id), data, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editing ? 'UPDATE' : 'CREATE',
        targetType: 'MusicCue', targetId: id,
        details: `${editing ? 'Edit' : 'Tambah'} cue: ${title}`,
      });
      showToast('Cue musik disimpan!', 'success');
      setIsOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, t: string) => {
    if (!confirm(`Hapus cue "${t}"?`)) return;
    try {
      await deleteDoc(doc(db, 'musicCues', id));
      showToast('Cue dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filtered = cues.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.scene.toLowerCase().includes(q) ||
      c.cueType.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-900 to-slate-800 text-white shadow-xl border border-cyan-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <Music className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-500/20 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                Divisi Tata Musik
              </span>
              <h2 className="text-xl font-black text-white mt-1">Sound Cue Sheet</h2>
              <p className="text-xs text-slate-300 mt-0.5">Kelola 10 jenis musik & timing pementasan</p>
            </div>
          </div>
          {canManage && (
            <button onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <Plus className="w-4 h-4" /> Tambah Cue
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari cue, adegan, atau jenis musik..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
        </div>
        <span className="text-xs text-slate-500 font-bold whitespace-nowrap">{filtered.length} cue</span>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Music className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Cue</h3>
          <p className="text-xs text-slate-500 mt-1">Buat cue sheet untuk mengatur audio pementasan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">Adegan</th>
                  <th className="py-3 px-4">Jenis Musik</th>
                  <th className="py-3 px-4">Judul</th>
                  <th className="py-3 px-4 text-center">Volume</th>
                  <th className="py-3 px-4 text-center">Durasi</th>
                  <th className="py-3 px-4">Audio</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(cue => (
                  <tr key={cue.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">{cue.scene || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 border border-cyan-300">
                        {cue.cueType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800">{cue.title}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="flex items-center justify-center gap-1 font-mono font-bold text-slate-700">
                        <Volume2 className="w-3 h-3" /> {cue.volume}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">{cue.duration || '-'}</td>
                    <td className="py-3 px-4">
                      {cue.audioUrl ? (
                        <a href={cue.audioUrl} target="_blank" rel="noreferrer"
                          className="text-blue-600 hover:underline font-bold flex items-center gap-1 text-[11px]">
                          <Play className="w-3 h-3" /> Preview
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Belum ada</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(cue)}
                            className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(cue.id, cue.title)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? 'Edit Cue' : 'Tambah Cue Musik'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Adegan</label>
                  <input type="text" value={scene} onChange={(e) => setScene(e.target.value)}
                    placeholder="Babak 1"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Durasi</label>
                  <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)}
                    placeholder="00:30"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Musik</label>
                <select value={cueType} onChange={(e) => setCueType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                  {CUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul *</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Petikan Sape Duka"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URL Audio</label>
                <input type="url" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Volume: {volume}%</label>
                <input type="range" min="0" max="100" value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value))}
                  className="w-full accent-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50">
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
