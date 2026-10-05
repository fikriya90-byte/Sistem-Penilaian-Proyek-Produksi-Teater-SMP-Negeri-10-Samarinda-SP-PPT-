import React, { useState, useEffect } from 'react';
import {
  Scissors, Plus, Edit3, Trash2, X, Save, Search, Ruler, Camera,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  doc, collection, setDoc, deleteDoc, updateDoc, onSnapshot, query, where,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface Costume {
  id: string;
  classId: string;
  characterName: string;
  playerName: string;
  costumeType: 'SEJARAH' | 'TRADISIONAL' | 'FANTASI';
  colors: string;
  texture: string;
  accessories: string;
  sizeInfo: string;
  materialMeters: number;
  status: 'DESAIN' | 'POTONG' | 'JAHIT' | 'FITTING' | 'SELESAI';
  photoUrl: string;
  notes: string;
  createdAt: string;
}

const STATUS_ORDER: Costume['status'][] = ['DESAIN', 'POTONG', 'JAHIT', 'FITTING', 'SELESAI'];

export const CostumeModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [costumes, setCostumes] = useState<Costume[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Costume | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [characterName, setCharacterName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [costumeType, setCostumeType] = useState<Costume['costumeType']>('TRADISIONAL');
  const [colors, setColors] = useState('');
  const [texture, setTexture] = useState('');
  const [accessories, setAccessories] = useState('');
  const [sizeInfo, setSizeInfo] = useState('');
  const [materialMeters, setMaterialMeters] = useState(0);
  const [status, setStatus] = useState<Costume['status']>('DESAIN');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = user && (
    user.role === 'Koordinator Tata Busana' ||
    user.role === 'Anggota Tata Busana' ||
    user.role === 'Guru Pengampu' ||
    user.role === 'Guru Pembina' ||
    user.role === 'Admin' ||
    user.role === 'Super Admin'
  );

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'costumes'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setCostumes(snap.docs.map(d => ({ ...d.data(), id: d.id } as Costume)));
    });
    return () => unsub();
  }, [activeClass]);

  const openCreate = () => {
    setEditing(null);
    setCharacterName('');
    setPlayerName('');
    setCostumeType('TRADISIONAL');
    setColors('');
    setTexture('');
    setAccessories('');
    setSizeInfo('');
    setMaterialMeters(0);
    setStatus('DESAIN');
    setPhotoUrl('');
    setNotes('');
    setIsOpen(true);
  };

  const openEdit = (c: Costume) => {
    setEditing(c);
    setCharacterName(c.characterName);
    setPlayerName(c.playerName);
    setCostumeType(c.costumeType);
    setColors(c.colors);
    setTexture(c.texture);
    setAccessories(c.accessories);
    setSizeInfo(c.sizeInfo);
    setMaterialMeters(c.materialMeters);
    setStatus(c.status);
    setPhotoUrl(c.photoUrl);
    setNotes(c.notes);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !characterName.trim()) return;
    setSubmitting(true);
    try {
      const id = editing?.id || doc(collection(db, 'costumes')).id;
      const data: Costume = {
        id,
        classId: activeClass.id,
        characterName: characterName.trim(),
        playerName: playerName.trim(),
        costumeType,
        colors: colors.trim(),
        texture: texture.trim(),
        accessories: accessories.trim(),
        sizeInfo: sizeInfo.trim(),
        materialMeters,
        status,
        photoUrl: photoUrl.trim(),
        notes: notes.trim(),
        createdAt: editing?.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'costumes', id), data, { merge: true });
      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: editing ? 'UPDATE' : 'CREATE',
        targetType: 'Costume',
        targetId: id,
        details: `${editing ? 'Edit' : 'Tambah'} kostum: ${characterName}`,
      });
      showToast('Kostum disimpan!', 'success');
      setIsOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, n: string) => {
    if (!confirm(`Hapus kostum "${n}"?`)) return;
    try {
      await deleteDoc(doc(db, 'costumes', id));
      showToast('Kostum dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const advanceStatus = async (c: Costume) => {
    const idx = STATUS_ORDER.indexOf(c.status);
    const next = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
    if (next === c.status) return;
    try {
      await updateDoc(doc(db, 'costumes', c.id), { status: next });
      showToast(`Status → ${next}`, 'success');
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const filtered = costumes.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.characterName.toLowerCase().includes(q) ||
      c.playerName.toLowerCase().includes(q)
    );
  });

  const typeColors: Record<Costume['costumeType'], string> = {
    SEJARAH: 'bg-amber-100 text-amber-800',
    TRADISIONAL: 'bg-emerald-100 text-emerald-800',
    FANTASI: 'bg-purple-100 text-purple-800',
  };

  const statusProgress = (s: Costume['status']) => {
    const idx = STATUS_ORDER.indexOf(s);
    return Math.round(((idx + 1) / STATUS_ORDER.length) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Scissors className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Divisi Tata Busana
              </span>
              <h2 className="text-xl font-black text-white mt-1">Desain Kostum & Fitting</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Konsep kostum per peran, produksi, fitting
              </p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" /> Tambah Kostum
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari karakter atau pemain..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 text-xs font-semibold text-slate-800 border-0 focus:outline-none"
        />
        <span className="text-xs text-slate-500 font-bold">{filtered.length} kostum</span>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Scissors className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Kostum</h3>
          <p className="text-xs text-slate-500 mt-1">Buat desain kostum untuk tokoh-tokoh.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${typeColors[c.costumeType]}`}
                >
                  {c.costumeType}
                </span>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.characterName)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-sm font-extrabold text-slate-900">👗 {c.characterName}</h3>
              {c.playerName && (
                <p className="text-[11px] text-indigo-700 font-bold mt-0.5">🎭 {c.playerName}</p>
              )}

              <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                {c.colors && <p>🎨 {c.colors}</p>}
                {c.texture && <p>✋ {c.texture}</p>}
                {c.accessories && <p>💎 {c.accessories}</p>}
              </div>

              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-bold text-slate-800">{c.status}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${statusProgress(c.status)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {c.materialMeters > 0 ? `🧵 ${c.materialMeters} m kain` : ''}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                {c.photoUrl && (
                  <a
                    href={c.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold hover:bg-indigo-100 flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3 h-3" /> Foto
                  </a>
                )}
                {canManage && c.status !== 'SELESAI' && (
                  <button
                    onClick={() => advanceStatus(c)}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold"
                  >
                    ⏭️ Next
                  </button>
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
                {editing ? 'Edit Kostum' : 'Tambah Kostum'}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Karakter *
                  </label>
                  <input
                    type="text"
                    required
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pemain</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jenis Kostum
                </label>
                <select
                  value={costumeType}
                  onChange={(e) => setCostumeType(e.target.value as Costume['costumeType'])}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="SEJARAH">Sejarah</option>
                  <option value="TRADISIONAL">Tradisional</option>
                  <option value="FANTASI">Fantasi</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Warna</label>
                  <input
                    type="text"
                    value={colors}
                    onChange={(e) => setColors(e.target.value)}
                    placeholder="Merah Emas"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tekstur</label>
                  <input
                    type="text"
                    value={texture}
                    onChange={(e) => setTexture(e.target.value)}
                    placeholder="Sutra"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Aksesori</label>
                <input
                  type="text"
                  value={accessories}
                  onChange={(e) => setAccessories(e.target.value)}
                  placeholder="Mahkota, kalung, gelang"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Ruler className="w-3 h-3" /> Ukuran Pemain
                </label>
                <input
                  type="text"
                  value={sizeInfo}
                  onChange={(e) => setSizeInfo(e.target.value)}
                  placeholder="LD: 90, LP: 70, PJ: 150"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kain (meter)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={materialMeters}
                    onChange={(e) => setMaterialMeters(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Costume['status'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    {STATUS_ORDER.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URL Foto</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
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