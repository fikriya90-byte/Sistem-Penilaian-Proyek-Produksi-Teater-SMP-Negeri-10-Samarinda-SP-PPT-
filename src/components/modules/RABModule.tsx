import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Trash2, X, Save, Search, Download, Upload,
  ExternalLink, Calculator, FileCheck, Users, Package, Globe,
  CheckCircle, PenTool, User, AlertTriangle, Link2, Info, Edit3,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { DIVISIONS } from '../../core/constants';
import {
  doc, collection, setDoc, deleteDoc, onSnapshot, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';

// =====================================================
// TIPE DATA
// =====================================================
type Category = 'DIVISI' | 'PERAN' | 'UMUM';

interface RABItem {
  id: string;
  classId: string;
  category: Category;
  targetName: string;
  itemName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  notes: string;
  createdAt: string;
  createdBy: string;
  creatorName: string;
}

interface RABDocument {
  id: string;
  classId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  version: number;
  signedByPimpro: boolean;
  pimproSignature: string;
  signedAtPimpro?: string;
  signedByBendahara: boolean;
  bendaharaSignature: string;
  signedAtBendahara?: string;
  uploadedAt: string;
  uploadedBy: string;
  uploaderName: string;
}

interface BulkRow {
  tempId: string;
  itemName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  notes: string;
}

// =====================================================
// DAFTAR PERAN LENGKAP (18 role)
// =====================================================
const PERAN_LIST = [
  'Pimpinan Produksi',
  'Sekretaris',
  'Bendahara',
  'Sutradara',
  'Asisten Sutradara',
  'Pemeran',
  'Koordinator Perlengkapan',
  'Koordinator Publikasi',
  'Koordinator Tata Panggung',
  'Koordinator Tata Rias',
  'Koordinator Tata Busana',
  'Koordinator Tata Musik',
  'Anggota Perlengkapan',
  'Anggota Publikasi',
  'Anggota Tata Panggung',
  'Anggota Tata Rias',
  'Anggota Tata Busana',
  'Anggota Tata Musik',
];

const CATEGORY_CONFIG: Record<Category, { label: string; icon: any; color: string }> = {
  DIVISI: { label: 'Divisi', icon: Users, color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-500/40' },
  PERAN: { label: 'Peran', icon: User, color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-500/40' },
  UMUM: { label: 'Umum', icon: Globe, color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-500/40' },
};

export const RABModule: React.FC = () => {
  const { user, activeClass, isBendahara, isGuruPengampu, isAdminRole, isPimprod } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'items' | 'documents'>('items');
  const [items, setItems] = useState<RABItem[]>([]);
  const [documents, setDocuments] = useState<RABDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | Category>('ALL');

  // Modal Item (Multi-row)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RABItem | null>(null);
  const [itemCategory, setItemCategory] = useState<Category>('DIVISI');
  const [itemTargetName, setItemTargetName] = useState<string>(DIVISIONS[1].id);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);

  // Modal Document
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('RAB Final Produksi Teater');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [pimproSig, setPimproSig] = useState('');
  const [bendaharaSig, setBendaharaSig] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const canManageItems = isBendahara;

  // Subscribe items
  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'rabItems'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ ...d.data(), id: d.id } as RABItem)));
    });
    return () => unsub();
  }, [activeClass]);

  // Subscribe documents
  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'rabDocuments'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setDocuments(snap.docs.map(d => ({ ...d.data(), id: d.id } as RABDocument)));
    });
    return () => unsub();
  }, [activeClass]);

  // ==========================================
  // ITEM HANDLERS
  // ==========================================
  const makeEmptyRow = (): BulkRow => ({
    tempId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    itemName: '',
    qty: 1,
    unit: 'pcs',
    unitPrice: 0,
    notes: '',
  });

  const openCreateItem = (presetCategory?: Category, presetTarget?: string) => {
    setEditingItem(null);
    const cat: Category = presetCategory || 'DIVISI';
    const target = presetTarget || (
      cat === 'DIVISI' ? DIVISIONS[1].id :
      cat === 'PERAN' ? PERAN_LIST[0] :
      'Umum'
    );
    setItemCategory(cat);
    setItemTargetName(target);
    setBulkRows([makeEmptyRow()]);
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: RABItem) => {
    setEditingItem(item);
    setItemCategory(item.category);
    setItemTargetName(item.targetName);
    setBulkRows([{
      tempId: item.id,
      itemName: item.itemName,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
      notes: item.notes,
    }]);
    setIsItemModalOpen(true);
  };

  const handleCategoryChange = (newCat: Category) => {
    setItemCategory(newCat);
    if (newCat === 'DIVISI') setItemTargetName(DIVISIONS[1].id);
    else if (newCat === 'PERAN') setItemTargetName(PERAN_LIST[0]);
    else setItemTargetName('Umum');
  };

  const updateBulkRow = (tempId: string, field: keyof BulkRow, value: any) => {
    setBulkRows(prev => prev.map(r => r.tempId === tempId ? { ...r, [field]: value } : r));
  };

  const addBulkRow = () => {
    setBulkRows(prev => [...prev, makeEmptyRow()]);
  };

  // Hapus baris (reset jika tinggal 1)
  const removeBulkRow = (tempId: string) => {
    setBulkRows(prev => {
      if (prev.length <= 1) return [makeEmptyRow()];
      return prev.filter(r => r.tempId !== tempId);
    });
  };

  const resetAllRows = () => {
    setBulkRows([makeEmptyRow()]);
    showToast('Semua baris dikosongkan.', 'info');
  };

  // Hapus item dari Firestore (tanpa confirm(), pakai toast)
  const handleDeleteItem = async (item: RABItem) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'rabItems', item.id));
      showToast(`Item "${item.itemName}" dihapus.`, 'success');
      try {
        await recordAuditLog({
          userId: user.uid, userName: user.displayName, role: user.role,
          action: 'DELETE', targetType: 'RABItem', targetId: item.id,
          details: `Hapus item RAB: ${item.itemName}`,
        });
      } catch { /* non-fatal */ }
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // Hapus item dari dalam Edit Modal
  const handleDeleteFromEditModal = async () => {
    if (!editingItem || !user) return;
    try {
      await deleteDoc(doc(db, 'rabItems', editingItem.id));
      showToast(`Item "${editingItem.itemName}" dihapus.`, 'success');
      try {
        await recordAuditLog({
          userId: user.uid, userName: user.displayName, role: user.role,
          action: 'DELETE', targetType: 'RABItem', targetId: editingItem.id,
          details: `Hapus item RAB (dari edit): ${editingItem.itemName}`,
        });
      } catch { /* non-fatal */ }
      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;

    const validRows = bulkRows.filter(r =>
      r.itemName.trim().length > 0 && r.qty > 0 && r.unitPrice > 0
    );

    if (validRows.length === 0) {
      showToast('Isi minimal 1 item (nama, qty, harga).', 'warning');
      return;
    }

    if (bulkRows.some(r => r.itemName.trim() && (r.qty <= 0 || r.unitPrice <= 0))) {
      showToast('Ada baris yang belum lengkap. Lengkapi qty & harga atau hapus baris itu.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const targetName = itemCategory === 'UMUM' ? 'Umum' : itemTargetName;

      if (editingItem) {
        const row = validRows[0];
        await setDoc(doc(db, 'rabItems', editingItem.id), {
          ...editingItem,
          category: itemCategory,
          targetName,
          itemName: row.itemName.trim(),
          qty: row.qty,
          unit: row.unit.trim(),
          unitPrice: row.unitPrice,
          notes: row.notes.trim(),
        }, { merge: true });

        try {
          await recordAuditLog({
            userId: user.uid, userName: user.displayName, role: user.role,
            action: 'UPDATE', targetType: 'RABItem', targetId: editingItem.id,
            details: `Edit item RAB: ${row.itemName}`,
          });
        } catch { /* non-fatal */ }
        showToast('Item RAB diperbarui.', 'success');
      } else {
        const batch = writeBatch(db);
        const now = new Date().toISOString();

        validRows.forEach(row => {
          const newId = doc(collection(db, 'rabItems')).id;
          batch.set(doc(db, 'rabItems', newId), {
            id: newId,
            classId: activeClass.id,
            category: itemCategory,
            targetName,
            itemName: row.itemName.trim(),
            qty: row.qty,
            unit: row.unit.trim(),
            unitPrice: row.unitPrice,
            notes: row.notes.trim(),
            createdAt: now,
            createdBy: user.uid,
            creatorName: user.displayName,
          });
        });

        await batch.commit();

        try {
          await recordAuditLog({
            userId: user.uid, userName: user.displayName, role: user.role,
            action: 'CREATE', targetType: 'RABItem', targetId: 'batch',
            details: `Tambah ${validRows.length} item RAB untuk ${itemCategory} - ${targetName}`,
          });
        } catch { /* non-fatal */ }
        showToast(`${validRows.length} item RAB ditambahkan.`, 'success');
      }

      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // GROUP & TOTAL
  // ==========================================
  const groupedItems = (() => {
    const groups: Record<string, { targetName: string; category: Category; items: RABItem[]; subtotal: number }> = {};
    items.forEach(it => {
      const key = `${it.category}__${it.targetName}`;
      if (!groups[key]) {
        groups[key] = { targetName: it.targetName, category: it.category, items: [], subtotal: 0 };
      }
      groups[key].items.push(it);
      groups[key].subtotal += it.qty * it.unitPrice;
    });
    return Object.values(groups).sort((a, b) => {
      const order: Record<Category, number> = { DIVISI: 1, PERAN: 2, UMUM: 3 };
      return order[a.category] - order[b.category];
    });
  })();

  const grandTotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  const filteredItems = items.filter(it => {
    if (filterCategory !== 'ALL' && it.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return it.itemName.toLowerCase().includes(q) || it.targetName.toLowerCase().includes(q);
    }
    return true;
  });

  // ==========================================
  // EXPORT WORD (.rtf)
  // ==========================================
  const handleExportWord = () => {
    if (items.length === 0) {
      showToast('Belum ada item RAB untuk diexport.', 'warning');
      return;
    }

    const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
    const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const esc = (s: any) => String(s ?? '').replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, '\\line ');

    let rtf = '{\\rtf1\\ansi\\deff0\n';
    rtf += '{\\fonttbl{\\f0\\froman Times New Roman;}}\n';
    rtf += '\\f0\\fs32\\b\\qc RENCANA ANGGARAN BIAYA (RAB)\\b0\\par\n';
    rtf += `\\fs22\\qc Produksi Teater ${esc(activeClass?.name || '')}\\par\n`;
    rtf += '\\fs20\\qc SMP Negeri 10 Samarinda\\par\n';
    rtf += `\\fs18\\qc Dicetak: ${esc(now)}\\par\n\\par\n`;

    rtf += '\\trowd\\trgaph108\\trleft-108\\cellx800\\cellx3500\\cellx4600\\cellx5900\\cellx7400\\cellx9500\n';
    ['No', 'Item', 'Qty', 'Harga Satuan', 'Total', 'Catatan'].forEach(h => {
      rtf += `\\intbl\\b\\fs20 ${esc(h)}\\b0\\cell `;
    });
    rtf += '\\row\n';

    groupedItems.forEach(g => {
      rtf += '\\trowd\\trgaph108\\trleft-108\\cellx800\\cellx3500\\cellx4600\\cellx5900\\cellx7400\\cellx9500\n';
      rtf += `\\intbl\\b\\fs20 ${esc(`${g.category} - ${g.targetName}`)}\\b0\\cell \\cell \\cell \\cell \\cell \\row\n`;
      g.items.forEach((it, idx) => {
        rtf += '\\trowd\\trgaph108\\trleft-108\\cellx800\\cellx3500\\cellx4600\\cellx5900\\cellx7400\\cellx9500\n';
        rtf += `\\intbl\\fs20 ${idx + 1}\\cell \\intbl\\fs20 ${esc(it.itemName)}\\cell \\intbl\\fs20 ${esc(`${it.qty} ${it.unit}`)}\\cell \\intbl\\fs20 ${esc(fmt(it.unitPrice))}\\cell \\intbl\\b\\fs20 ${esc(fmt(it.qty * it.unitPrice))}\\b0\\cell \\intbl\\fs18 ${esc(it.notes || '-')}\\cell \\row\n`;
      });
    });

    rtf += '\\trowd\\trgaph108\\trleft-108\\cellx800\\cellx3500\\cellx4600\\cellx5900\\cellx7400\\cellx9500\n';
    rtf += `\\intbl \\cell \\cell \\cell \\intbl\\qr\\b\\fs22 GRAND TOTAL:\\b0\\cell \\intbl\\b\\fs22 ${esc(fmt(grandTotal))}\\b0\\cell \\cell \\row\n`;
    rtf += '}';

    const blob = new Blob([rtf], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RAB_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.rtf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('RAB diexport ke .rtf.', 'success');
  };

  // ==========================================
  // DOCUMENT HANDLERS
  // ==========================================
  const openCreateDocument = () => {
    setDocTitle('RAB Final Produksi Teater');
    setDocFileUrl(''); setDocFileName('');
    setPimproSig(''); setBendaharaSig('');
    setIsDocModalOpen(true);
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !docFileUrl.trim()) { showToast('Isi link file RAB final.', 'warning'); return; }
    setSubmitting(true);
    try {
      const id = doc(collection(db, 'rabDocuments')).id;
      await setDoc(doc(db, 'rabDocuments', id), {
        id, classId: activeClass.id, title: docTitle.trim(), fileUrl: docFileUrl.trim(),
        fileName: docFileName.trim() || 'RAB_Final.pdf', version: 1,
        signedByPimpro: !!pimproSig.trim(), pimproSignature: pimproSig.trim(),
        signedAtPimpro: pimproSig.trim() ? new Date().toISOString() : undefined,
        signedByBendahara: !!bendaharaSig.trim(), bendaharaSignature: bendaharaSig.trim(),
        signedAtBendahara: bendaharaSig.trim() ? new Date().toISOString() : undefined,
        uploadedAt: new Date().toISOString(), uploadedBy: user.uid, uploaderName: user.displayName,
      } as RABDocument);
      await recordAuditLog({ userId: user.uid, userName: user.displayName, role: user.role, action: 'CREATE', targetType: 'RABDocument', targetId: id, details: `Upload RAB final: ${docTitle}` });
      showToast('Dokumen RAB final tersimpan.', 'success');
      setIsDocModalOpen(false);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteDocument = async (docItem: RABDocument) => {
    try {
      await deleteDoc(doc(db, 'rabDocuments', docItem.id));
      showToast('Dokumen dihapus.', 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-900 via-slate-900 to-slate-800 text-white shadow-xl border border-amber-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Calculator className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                RAB Digital
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                Rencana Anggaran Biaya {activeClass?.name || ''}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Input per Divisi/Peran/Umum — Tambah banyak item sekaligus
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExportWord}
              className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
              <Download className="w-3.5 h-3.5" /> Export Word
            </button>
            {canManageItems && activeTab === 'items' && (
              <button onClick={() => openCreateItem()}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg">
                <Plus className="w-3.5 h-3.5" /> Tambah Item
              </button>
            )}
            {activeTab === 'documents' && canManageItems && (
              <button onClick={openCreateDocument}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
                <Upload className="w-3.5 h-3.5" /> Upload RAB Final
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'items' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          <Calculator className="w-3.5 h-3.5" /> Item RAB ({items.length})
        </button>
        <button onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'documents' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          <FileCheck className="w-3.5 h-3.5" /> Dokumen RAB ({documents.length})
        </button>
      </div>

      {/* ============ TAB: ITEMS ============ */}
      {activeTab === 'items' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase opacity-90">Grand Total RAB</p>
              <p className="text-lg font-black mt-1">Rp {grandTotal.toLocaleString('id-ID')}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Jumlah Item</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{items.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 shadow-sm">
              <p className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold">Divisi</p>
              <p className="text-lg font-black text-blue-800 dark:text-blue-200">
                {groupedItems.filter(g => g.category === 'DIVISI').length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 shadow-sm">
              <p className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">Peran</p>
              <p className="text-lg font-black text-purple-800 dark:text-purple-200">
                {groupedItems.filter(g => g.category === 'PERAN').length}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Cari item RAB..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {(['ALL', 'DIVISI', 'PERAN', 'UMUM'] as const).map(c => (
                <button key={c} onClick={() => setFilterCategory(c)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    filterCategory === c
                      ? 'bg-slate-900 dark:bg-slate-700 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}>
                  {c === 'ALL' ? 'Semua' : CATEGORY_CONFIG[c].label}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <Calculator className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Item RAB</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {canManageItems ? 'Klik "Tambah Item" untuk mulai menyusun anggaran.' : 'Tunggu Bendahara/Pimpro menginput RAB.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedItems.map((group, gi) => (
                <div key={gi} className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className={`p-3 flex items-center justify-between flex-wrap gap-2 ${
                    group.category === 'DIVISI' ? 'bg-blue-50 dark:bg-blue-500/10' :
                    group.category === 'PERAN' ? 'bg-purple-50 dark:bg-purple-500/10' :
                    'bg-amber-50 dark:bg-amber-500/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${CATEGORY_CONFIG[group.category].color}`}>
                        {CATEGORY_CONFIG[group.category].label}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                        {group.targetName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-white">
                        Rp {group.subtotal.toLocaleString('id-ID')}
                      </span>
                      {canManageItems && (
                        <button
                          onClick={() => openCreateItem(group.category, group.targetName)}
                          className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition">
                          <Plus className="w-3 h-3" /> Tambah
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {group.items.map(it => (
                      <div key={it.id} className="p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 dark:text-white text-xs break-words">{it.itemName}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {it.qty} {it.unit} × Rp {it.unitPrice.toLocaleString('id-ID')}
                              {it.notes && ` — ${it.notes}`}
                            </p>
                          </div>
                          <span className="font-bold text-amber-700 dark:text-amber-400 text-[11px] whitespace-nowrap">
                            Rp {(it.qty * it.unitPrice).toLocaleString('id-ID')}
                          </span>
                        </div>

                        {canManageItems && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEditItem(it)}
                              style={{ minHeight: '44px', touchAction: 'manipulation' }}
                              className="flex-1 rounded-xl text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-300 dark:border-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-xs font-bold transition flex items-center justify-center gap-1.5">
                              <Edit3 className="w-4 h-4" /> Edit
                            </button>
                            <button type="button" onClick={() => handleDeleteItem(it)}
                              style={{ minHeight: '44px', touchAction: 'manipulation' }}
                              className="flex-1 rounded-xl text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold transition flex items-center justify-center gap-1.5">
                              <Trash2 className="w-4 h-4" /> Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wide">Grand Total RAB</span>
                  <span className="text-2xl font-black">Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ TAB: DOCUMENTS ============ */}
      {activeTab === 'documents' && (
        <>
          {documents.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <FileCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Dokumen RAB Final</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Upload file final (PDF/Word) setelah RAB diexport & ditandatangani.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map(docItem => (
                <div key={docItem.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-2">
                          {docItem.title}
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {docItem.fileName} — Upload: {new Date(docItem.uploadedAt).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                    {canManageItems && (
                      <button type="button" onClick={() => handleDeleteDocument(docItem)}
                        style={{ minHeight: '44px', touchAction: 'manipulation' }}
                        className="px-3 rounded-lg text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-300 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold transition flex items-center gap-1">
                        <Trash2 className="w-4 h-4" /> Hapus
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2.5 rounded-xl border text-center ${
                      docItem.signedByPimpro
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Pimpro</p>
                      <p className={`text-[11px] font-bold mt-0.5 ${docItem.signedByPimpro ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 italic'}`}>
                        {docItem.signedByPimpro ? docItem.pimproSignature : 'Belum TTD'}
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center ${
                      docItem.signedByBendahara
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Bendahara</p>
                      <p className={`text-[11px] font-bold mt-0.5 ${docItem.signedByBendahara ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 italic'}`}>
                        {docItem.signedByBendahara ? docItem.bendaharaSignature : 'Belum TTD'}
                      </p>
                    </div>
                  </div>

                  <a href={docItem.fileUrl} target="_blank" rel="noreferrer"
                    className="w-full py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Buka File RAB
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ MODAL ITEM (MULTI-ROW) ============ */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <form onSubmit={handleSaveItem}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[95vh] flex flex-col overflow-hidden">
            
            {/* Header — fixed */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-500" />
                  {editingItem ? 'Edit Item RAB' : 'Tambah Item RAB'}
                </h3>
                <button type="button" onClick={() => { setIsItemModalOpen(false); setEditingItem(null); }}
                  style={{ touchAction: 'manipulation' }}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              
              {!editingItem && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <strong>Bisa tambah banyak sekaligus.</strong> Isi beberapa baris, lalu klik "Simpan" di bawah.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DIVISI', 'PERAN', 'UMUM'] as Category[]).map(c => {
                    const Icon = CATEGORY_CONFIG[c].icon;
                    return (
                      <button key={c} type="button" onClick={() => handleCategoryChange(c)}
                        style={{ touchAction: 'manipulation' }}
                        className={`py-3 rounded-xl border-2 text-xs font-bold transition flex flex-col items-center gap-1 ${
                          itemCategory === c
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                        <Icon className="w-4 h-4" />
                        {CATEGORY_CONFIG[c].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {itemCategory === 'DIVISI' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Divisi</label>
                  <select value={itemTargetName} onChange={(e) => setItemTargetName(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    {DIVISIONS.slice(1).map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
                  </select>
                </div>
              )}

              {itemCategory === 'PERAN' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Peran <span className="text-rose-500">*</span>
                  </label>
                  <select value={itemTargetName} onChange={(e) => setItemTargetName(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    {PERAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {editingItem ? 'Detail Item' : `Daftar Item (${bulkRows.length})`}
                  </label>
                  {!editingItem && bulkRows.length > 1 && (
                    <button type="button" onClick={resetAllRows}
                      style={{ touchAction: 'manipulation' }}
                      className="px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-bold flex items-center gap-1 transition">
                      <RotateCcw className="w-3 h-3" /> Reset Semua
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {bulkRows.map((row, idx) => (
                    <div key={row.tempId} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {editingItem ? 'Item' : `Item #${idx + 1}`}
                        </span>
                        {!editingItem && (
                          <button type="button"
                            onClick={(e) => { e.preventDefault(); removeBulkRow(row.tempId); }}
                            style={{ minHeight: '44px', minWidth: '90px', touchAction: 'manipulation' }}
                            className="px-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-2 border-rose-300 dark:border-rose-500/40 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition">
                            <Trash2 className="w-3.5 h-3.5" /> Hapus Baris
                          </button>
                        )}
                      </div>

                      <input type="text"
                        value={row.itemName}
                        onChange={(e) => updateBulkRow(row.tempId, 'itemName', e.target.value)}
                        placeholder="Nama item (contoh: Kertas Karton A3)"
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Qty</label>
                          <input type="number" min="1" inputMode="numeric"
                            value={row.qty || ''}
                            onChange={(e) => updateBulkRow(row.tempId, 'qty', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Satuan</label>
                          <input type="text"
                            value={row.unit}
                            onChange={(e) => updateBulkRow(row.tempId, 'unit', e.target.value)}
                            placeholder="pcs"
                            className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Harga Satuan</label>
                          <input type="number" min="0" step="500" inputMode="numeric"
                            value={row.unitPrice || ''}
                            onChange={(e) => updateBulkRow(row.tempId, 'unitPrice', parseInt(e.target.value) || 0)}
                            placeholder="15000"
                            className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
                        </div>
                      </div>

                      <input type="text"
                        value={row.notes}
                        onChange={(e) => updateBulkRow(row.tempId, 'notes', e.target.value)}
                        placeholder="Catatan (opsional)"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300" />

                      <div className="text-[10px] text-slate-500 dark:text-slate-400 text-right">
                        Subtotal: <strong className="text-slate-800 dark:text-slate-200">Rp {(row.qty * row.unitPrice).toLocaleString('id-ID')}</strong>
                      </div>
                    </div>
                  ))}
                </div>

                {!editingItem && (
                  <button type="button" onClick={addBulkRow}
                    style={{ touchAction: 'manipulation' }}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition">
                    <Plus className="w-4 h-4" /> Tambah Baris Lagi
                  </button>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-900 dark:text-amber-200">
                    {bulkRows.filter(r => r.itemName.trim()).length} item terisi
                  </span>
                  <span className="font-black text-amber-900 dark:text-amber-200">
                    Rp {bulkRows.reduce((s, r) => s + (r.qty * r.unitPrice), 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer — fixed */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0 space-y-2">
              {editingItem && (
                <button type="button" onClick={handleDeleteFromEditModal}
                  style={{ minHeight: '48px', touchAction: 'manipulation' }}
                  className="w-full rounded-xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-400 dark:border-rose-500/60 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition">
                  <Trash2 className="w-4 h-4" /> Hapus Item Ini Permanen
                </button>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setIsItemModalOpen(false); setEditingItem(null); }}
                  style={{ minHeight: '44px', touchAction: 'manipulation' }}
                  className="px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                  Batal
                </button>
                <button type="submit" disabled={submitting}
                  style={{ minHeight: '44px', touchAction: 'manipulation' }}
                  className="px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {submitting ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : `Simpan ${bulkRows.filter(r => r.itemName.trim()).length} Item`}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ============ MODAL DOKUMEN ============ */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <form onSubmit={handleSaveDocument}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 shrink-0 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" /> Upload RAB Final
              </h3>
              <button type="button" onClick={() => setIsDocModalOpen(false)}
                style={{ touchAction: 'manipulation' }}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Dokumen</label>
                <input type="text" required value={docTitle} onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Link Google Drive <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input type="url" required value={docFileUrl} onChange={(e) => setDocFileUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama File</label>
                <input type="text" value={docFileName} onChange={(e) => setDocFileName(e.target.value)}
                  placeholder="RAB_Final_IXC.pdf"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1">
                    <PenTool className="w-3.5 h-3.5" /> TTD Pimpro
                  </label>
                  <input type="text" value={pimproSig} onChange={(e) => setPimproSig(e.target.value)}
                    placeholder="Nama Pimpro"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                  <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-1">
                    <PenTool className="w-3.5 h-3.5" /> TTD Bendahara
                  </label>
                  <input type="text" value={bendaharaSig} onChange={(e) => setBendaharaSig(e.target.value)}
                    placeholder="Nama Bendahara"
                    className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsDocModalOpen(false)}
                style={{ minHeight: '44px', touchAction: 'manipulation' }}
                className="px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Batal</button>
              <button type="submit" disabled={submitting}
                style={{ minHeight: '44px', touchAction: 'manipulation' }}
                className="px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {submitting ? 'Menyimpan...' : 'Simpan Dokumen'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};