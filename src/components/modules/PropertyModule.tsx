import React, { useState, useEffect } from 'react';
import {
  Package, Plus, Edit3, Trash2, X, Save, CheckCircle, Clock,
  AlertTriangle, Search, User, Hash,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { doc, collection, setDoc, deleteDoc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

interface PropertyItem {
  id: string;
  classId: string;
  name: string;
  scene: string;
  material: string;
  status: 'BELUM' | 'PROSES' | 'SELESAI' | 'RUSAK';
  pic: string;
  condition: 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT' | 'HILANG';
  notes: string;
  createdAt: string;
}

const STATUS_CONFIG = {
  BELUM: { label: 'Belum', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  PROSES: { label: 'Proses', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  SELESAI: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  RUSAK: { label: 'Rusak', color: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const CONDITION_CONFIG = {
  BAIK: { label: 'Baik', color: 'text-emerald-700' },
  RUSAK_RINGAN: { label: 'Rusak Ringan', color: 'text-amber-700' },
  RUSAK_BERAT: { label: 'Rusak Berat', color: 'text-rose-700' },
  HILANG: { label: 'Hilang', color: 'text-rose-900 font-bold' },
};

export const PropertyModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<PropertyItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [name, setName] = useState('');
  const [scene, setScene] = useState('');
  const [material, setMaterial] = useState('');
  const [status, setStatus] = useState<PropertyItem['status']>('BELUM');
  const [condition, setCondition] = useState<PropertyItem['condition']>('BAIK');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = user && (
    user.role === 'Koordinator Perlengkapan' ||
    user.role.startsWith('Anggota Perlengkapan') ||
    user.role === 'Guru Pengampu' || user.role === 'Guru Pengampu' ||
    user.role === 'Admin' || user.role === 'Super Admin'
  );

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'properties'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ ...d.data(), id: d.id } as PropertyItem)));
    });
    return () => unsub();
  }, [activeClass]);

  const openCreate = () => {
    setEditing(null);
    setName(''); setScene(''); setMaterial('');
    setStatus('BELUM'); setCondition('BAIK'); setNotes('');
    setIsOpen(true);
  };

  const openEdit = (item: PropertyItem) => {
    setEditing(item);
    setName(item.name); setScene(item.scene); setMaterial(item.material);
    setStatus(item.status); setCondition(item.condition); setNotes(item.notes);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !name.trim()) return;
    setSubmitting(true);
    try {
      const id = editing?.id || doc(collection(db, 'properties')).id;
      const data: PropertyItem = {
        id,
        classId: activeClass.id,
        name: name.trim(),
        scene: scene.trim(),
        material: material.trim(),
        status, condition,
        pic: editing?.pic || user.displayName,
        notes: notes.trim(),
        createdAt: editing?.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db, 'properties', id), data, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editing ? 'UPDATE' : 'CREATE',
        targetType: 'Property', targetId: id,
        details: `${editing ? 'Edit' : 'Tambah'} properti: ${name}`,
      });
      showToast(`Properti ${editing ? 'diperbarui' : 'ditambahkan'}!`, 'success');
      setIsOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`Hapus properti "${itemName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'properties', id));
      showToast('Properti dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleCycleStatus = async (item: PropertyItem) => {
    const order: PropertyItem['status'][] = ['BELUM', 'PROSES', 'SELESAI'];
    const idx = order.indexOf(item.status);
    const next = order[(idx + 1) % order.length];
    try {
      await updateDoc(doc(db, 'properties', item.id), { status: next });
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filtered = items.filter(i => {
    if (filterStatus !== 'ALL' && i.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.scene.toLowerCase().includes(q) ||
        i.material.toLowerCase().includes(q) || i.pic.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: items.length,
    selesai: items.filter(i => i.status === 'SELESAI').length,
    proses: items.filter(i => i.status === 'PROSES').length,
    rusak: items.filter(i => i.condition === 'RUSAK_BERAT' || i.condition === 'HILANG').length,
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 to-slate-800 text-white shadow-xl border border-blue-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Package className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Divisi Perlengkapan
              </span>
              <h2 className="text-xl font-black text-white mt-1">Manajemen Properti & Inventaris</h2>
              <p className="text-xs text-slate-300 mt-0.5">Kelola properti, bahan, dan inventaris pementasan</p>
            </div>
          </div>
          {canManage && (
            <button onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <Plus className="w-4 h-4" /> Tambah Properti
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 font-semibold">Total Properti</p>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
          <p className="text-[11px] text-emerald-700 font-semibold">Selesai</p>
          <p className="text-2xl font-black text-emerald-800">{stats.selesai}</p>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm">
          <p className="text-[11px] text-blue-700 font-semibold">Proses</p>
          <p className="text-2xl font-black text-blue-800">{stats.proses}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
          <p className="text-[11px] text-rose-700 font-semibold">Perlu Perhatian</p>
          <p className="text-2xl font-black text-rose-800">{stats.rusak}</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari properti, adegan, PIC..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50">
          <option value="ALL">Semua Status</option>
          <option value="BELUM">Belum</option>
          <option value="PROSES">Proses</option>
          <option value="SELESAI">Selesai</option>
          <option value="RUSAK">Rusak</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">Belum Ada Properti</h3>
          <p className="text-xs text-slate-500 mt-1">Tambahkan properti pertama untuk produksi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${STATUS_CONFIG[item.status].color}`}>
                  {STATUS_CONFIG[item.status].label}
                </span>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item.id, item.name)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{item.name}</h3>
              {item.scene && <p className="text-[11px] text-slate-500 mt-1">🎬 {item.scene}</p>}
              {item.material && <p className="text-[11px] text-slate-500">🧱 {item.material}</p>}

              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">PIC:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[140px]">{item.pic}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kondisi:</span>
                  <span className={`font-bold ${CONDITION_CONFIG[item.condition].color}`}>
                    {CONDITION_CONFIG[item.condition].label}
                  </span>
                </div>
                {item.notes && <p className="text-[10px] text-slate-400 italic mt-1">"{item.notes}"</p>}
              </div>

              {canManage && (
                <button onClick={() => handleCycleStatus(item)}
                  className="w-full mt-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]">
                  ⏭️ Ubah Status
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? 'Edit Properti' : 'Tambah Properti'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Properti *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Keris Pusaka"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Adegan</label>
                  <input type="text" value={scene} onChange={(e) => setScene(e.target.value)}
                    placeholder="Babak 2"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bahan</label>
                  <input type="text" value={material} onChange={(e) => setMaterial(e.target.value)}
                    placeholder="Kertas Mache"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <option value="BELUM">Belum</option>
                    <option value="PROSES">Proses</option>
                    <option value="SELESAI">Selesai</option>
                    <option value="RUSAK">Rusak</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kondisi</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <option value="BAIK">Baik</option>
                    <option value="RUSAK_RINGAN">Rusak Ringan</option>
                    <option value="RUSAK_BERAT">Rusak Berat</option>
                    <option value="HILANG">Hilang</option>
                  </select>
                </div>
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
