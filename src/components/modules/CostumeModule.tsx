import React, { useState, useEffect } from 'react';
import {
  Palette, Plus, Edit3, Trash2, X, Save, Search, Sparkles, Camera,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { doc, collection, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface FaceChart {
  id: string;
  classId: string;
  playerName: string;
  characterName: string;
  riasType: 'KOREKTIF' | 'KARAKTER' | 'FANTASI';
  moodboardUrl: string;
  faceChartUrl: string;
  notes: string;
  createdAt: string;
}

export const FaceChartModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [charts, setCharts] = useState<FaceChart[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<FaceChart | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [playerName, setPlayerName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [riasType, setRiasType] = useState<FaceChart['riasType']>('KOREKTIF');
  const [moodboardUrl, setMoodboardUrl] = useState('');
  const [faceChartUrl, setFaceChartUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = user && (
    user.role === 'Koordinator Tata Rias' ||
    user.role === 'Anggota Tata Rias' ||
    user.role === 'Guru Pengampu' ||
    user.role === 'Admin' || user.role === 'Super Admin'
  );

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'faceCharts'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setCharts(snap.docs.map(d => ({ ...d.data(), id: d.id } as FaceChart)));
    });
    return () => unsub();
  }, [activeClass]);

  const openCreate = () => {
    setEditing(null);
    setPlayerName(''); setCharacterName(''); setRiasType('KOREKTIF');
    setMoodboardUrl(''); setFaceChartUrl(''); setNotes('');
    setIsOpen(true);
  };

  const openEdit = (c: FaceChart) => {
    setEditing(c);
    setPlayerName(c.playerName); setCharacterName(c.characterName);
    setRiasType(c.riasType); setMoodboardUrl(c.moodboardUrl);
    setFaceChartUrl(c.faceChartUrl); setNotes(c.notes);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !playerName.trim()) return;
    setSubmitting(true);
    try {
      const id = editing?.id || doc(collection(db, 'faceCharts')).id;
      const data: FaceChart = {
        id, classId: activeClass.id,
        playerName: playerName.trim(), characterName: characterName.trim(),
        riasType, moodboardUrl: moodboardUrl.trim(), faceChartUrl: faceChartUrl.trim(),
        notes: notes.trim(),
        createdAt: editing?.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'faceCharts', id), data, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editing ? 'UPDATE' : 'CREATE',
        targetType: 'FaceChart', targetId: id,
        details: `${editing ? 'Edit' : 'Tambah'} face chart: ${playerName}`,
      });
      showToast('Face chart disimpan!', 'success');
      setIsOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, n: string) => {
    if (!confirm(`Hapus face chart "${n}"?`)) return;
    try {
      await deleteDoc(doc(db, 'faceCharts', id));
      showToast('Face chart dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filtered = charts.filter(c => {
    if (filterType !== 'ALL' && c.riasType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.playerName.toLowerCase().includes(q) || c.characterName.toLowerCase().includes(q);
    }
    return true;
  });

  const typeColors = {
    KOREKTIF: 'bg-blue-100 text-blue-800 border-blue-300',
    KARAKTER: 'bg-amber-100 text-amber-800 border-amber-300',
    FANTASI: 'bg-purple-100 text-purple-800 border-purple-300',
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-pink-900 to-rose-800 text-white shadow-xl border border-pink-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-pink-500/20 text-pink-300 border border-pink-500/30">
              <Palette className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-pink-300 bg-pink-500/20 px-2.5 py-0.5 rounded-full border border-pink-500/30">
                Divisi Tata Rias
              </span>
              <h2 className="text-xl font-black text-white mt-1">Face Chart & Desain Rias</h2>
              <p className="text-xs text-slate-300 mt-0.5">Rias Korektif, Karakter & Fantasi per pemain</p>
            </div>
          </div>
          {canManage && (
            <button onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <Plus className="w-4 h-4" /> Tambah Face Chart
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari pemain / karakter..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
        </div>
        <div className="flex gap-2">
          {['ALL', 'KOREKTIF', 'KARAKTER', 'FANTASI'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                filterType === t ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
              {t === 'ALL' ? 'Semua' : t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Palette className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Face Chart</h3>
          <p className="text-xs text-slate-500 mt-1">Buat desain rias untuk pemain.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${typeColors[c.riasType]}`}>
                  Rias {c.riasType}
                </span>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(c.id, c.playerName)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-sm font-extrabold text-slate-900">{c.playerName}</h3>
              <p className="text-[11px] text-pink-700 font-bold mt-0.5">🎭 {c.characterName || 'Tokoh'}</p>

              {c.notes && <p className="text-[11px] text-slate-500 mt-2 italic">"{c.notes}"</p>}

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                {c.moodboardUrl && (
                  <a href={c.moodboardUrl} target="_blank" rel="noreferrer"
                    className="flex-1 text-center py-1.5 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-bold hover:bg-purple-100 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" /> Moodboard
                  </a>
                )}
                {c.faceChartUrl && (
                  <a href={c.faceChartUrl} target="_blank" rel="noreferrer"
                    className="flex-1 text-center py-1.5 rounded-lg bg-pink-50 text-pink-700 text-[10px] font-bold hover:bg-pink-100 flex items-center justify-center gap-1">
                    <Camera className="w-3 h-3" /> Face Chart
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? 'Edit Face Chart' : 'Tambah Face Chart'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pemain *</label>
                <input type="text" required value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Karakter</label>
                <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Contoh: Ratu Aji Bidara Putih"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Rias</label>
                <select value={riasType} onChange={(e) => setRiasType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                  <option value="KOREKTIF">Rias Korektif</option>
                  <option value="KARAKTER">Rias Karakter</option>
                  <option value="FANTASI">Rias Fantasi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URL Moodboard</label>
                <input type="url" value={moodboardUrl} onChange={(e) => setMoodboardUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URL Face Chart</label>
                <input type="url" value={faceChartUrl} onChange={(e) => setFaceChartUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Rias</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detail: warna, teknik, efek khusus..."
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
