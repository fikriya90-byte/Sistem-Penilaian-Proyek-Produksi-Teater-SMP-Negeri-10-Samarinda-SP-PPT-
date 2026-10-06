import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Trash2, X, Save, Search, Download, Upload,
  ExternalLink, Calculator, FileCheck, Users, Package, Globe,
  CheckCircle, PenTool, User, AlertTriangle, Link2,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { DIVISIONS } from '../../core/constants';
import {
  doc, collection, setDoc, deleteDoc, onSnapshot, query, where, getDocs,
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
  targetName: string; // nama divisi / peran / "Umum"
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

const PERAN_LIST = [
  'Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Sutradara', 'Asisten Sutradara', 'Pemain',
];

const CATEGORY_CONFIG: Record<Category, { label: string; icon: any; color: string }> = {
  DIVISI: { label: 'Divisi', icon: Users, color: 'bg-blue-100 text-blue-800 border-blue-300' },
  PERAN: { label: 'Peran', icon: User, color: 'bg-purple-100 text-purple-800 border-purple-300' },
  UMUM: { label: 'Umum', icon: Globe, color: 'bg-amber-100 text-amber-800 border-amber-300' },
};

export const RABModule: React.FC = () => {
  const { user, activeClass, isBendahara, isGuruPengampu, isAdminRole, isPimprod } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'items' | 'documents'>('items');
  const [items, setItems] = useState<RABItem[]>([]);
  const [documents, setDocuments] = useState<RABDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | Category>('ALL');

  // Modal Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RABItem | null>(null);
  const [itemCategory, setItemCategory] = useState<Category>('DIVISI');
  const [itemTargetName, setItemTargetName] = useState<string>(DIVISIONS[1].id);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemUnitPrice, setItemUnitPrice] = useState(0);
  const [itemNotes, setItemNotes] = useState('');

  // Modal Document
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('RAB Final Produksi Teater');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [pimproSig, setPimproSig] = useState('');
  const [bendaharaSig, setBendaharaSig] = useState('');

  const [submitting, setSubmitting] = useState(false);

// HANYA BENDAHARA yang bisa edit. Guru & lainnya hanya melihat.
  const canManageItems = isBendahara;
  const canSignDocument = isBendahara;

  // Subscribe
  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'rabItems'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ ...d.data(), id: d.id } as RABItem)));
    });
    return () => unsub();
  }, [activeClass]);

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
  const openCreateItem = () => {
    setEditingItem(null);
    setItemCategory('DIVISI');
    setItemTargetName(DIVISIONS[1].id);
    setItemName('');
    setItemQty(1);
    setItemUnit('pcs');
    setItemUnitPrice(0);
    setItemNotes('');
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: RABItem) => {
    setEditingItem(item);
    setItemCategory(item.category);
    setItemTargetName(item.targetName);
    setItemName(item.itemName);
    setItemQty(item.qty);
    setItemUnit(item.unit);
    setItemUnitPrice(item.unitPrice);
    setItemNotes(item.notes);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !itemName.trim() || itemQty <= 0 || itemUnitPrice <= 0) {
      showToast('Lengkapi nama item, kuantitas, dan harga satuan.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const id = editingItem?.id || doc(collection(db, 'rabItems')).id;
      const data: RABItem = {
        id,
        classId: activeClass.id,
        category: itemCategory,
        targetName: itemCategory === 'UMUM' ? 'Umum' : itemTargetName,
        itemName: itemName.trim(),
        qty: itemQty,
        unit: itemUnit.trim(),
        unitPrice: itemUnitPrice,
        notes: itemNotes.trim(),
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        createdBy: user.uid,
        creatorName: user.displayName,
      };
      await setDoc(doc(db, 'rabItems', id), data, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editingItem ? 'UPDATE' : 'CREATE',
        targetType: 'RABItem', targetId: id,
        details: `${editingItem ? 'Edit' : 'Tambah'} item RAB: ${itemName}`,
      });
      showToast('Item RAB disimpan.', 'success');
      setIsItemModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setSubmitting(false); }
  };

  const handleDeleteItem = async (item: RABItem) => {
    if (!confirm(`Hapus item "${item.itemName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'rabItems', item.id));
      showToast('Item dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
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
  // EXPORT WORD
  // ==========================================
  const handleExportWord = () => {
    if (items.length === 0) {
      showToast('Belum ada item RAB untuk diexport.', 'warning');
      return;
    }

    const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
    const now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    let rows = '';
    groupedItems.forEach(g => {
      rows += `<tr><td colspan="6" style="background:#D4AF37;color:#0f172a;font-weight:bold;padding:6px 8px;">${g.category} — ${g.targetName}</td></tr>`;
      g.items.forEach((it, idx) => {
        rows += `
          <tr>
            <td style="padding:4px 8px;text-align:center;">${idx + 1}</td>
            <td style="padding:4px 8px;">${it.itemName}</td>
            <td style="padding:4px 8px;text-align:center;">${it.qty} ${it.unit}</td>
            <td style="padding:4px 8px;text-align:right;">${fmt(it.unitPrice)}</td>
            <td style="padding:4px 8px;text-align:right;font-weight:bold;">${fmt(it.qty * it.unitPrice)}</td>
            <td style="padding:4px 8px;font-size:11px;">${it.notes || '-'}</td>
          </tr>`;
      });
      rows += `<tr><td colspan="4" style="padding:6px 8px;text-align:right;font-weight:bold;">Subtotal ${g.targetName}:</td><td colspan="2" style="padding:6px 8px;font-weight:bold;background:#f1f5f9;">${fmt(g.subtotal)}</td></tr>`;
    });

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>RAB Produksi Teater</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 30px; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
          h2 { text-align: center; font-size: 14px; font-weight: normal; margin-top: 0; color: #475569; }
          .info { margin: 16px 0; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #1e293b; color: #fff; padding: 8px; text-align: left; }
          td { border: 1px solid #cbd5e1; }
          .total { font-size: 14px; font-weight: bold; background: #D4AF37; padding: 10px; text-align: right; }
          .ttd { margin-top: 40px; display: flex; justify-content: space-between; }
          .ttd div { text-align: center; width: 40%; }
          .ttd .name { margin-top: 60px; border-top: 1px solid #000; padding-top: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>RENCANA ANGGARAN BIAYA (RAB)</h1>
        <h2>Produksi Teater ${activeClass?.name || ''} — ${activeClass?.kerabatKerja || ''}</h2>
        <div class="info">
          <strong>SMP Negeri 10 Samarinda</strong><br>
          Tahun Ajaran 2025/2026<br>
          Tanggal Cetak: ${now}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;">No</th>
              <th>Nama Item</th>
              <th style="width:80px;">Qty</th>
              <th style="width:100px;">Harga Satuan</th>
              <th style="width:110px;">Total</th>
              <th style="width:150px;">Catatan</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p class="total">GRAND TOTAL: ${fmt(grandTotal)}</p>
        <div class="ttd">
          <div>
            <p>Mengetahui,</p>
            <p>Bendahara</p>
            <p class="name">( ................................ )</p>
          </div>
          <div>
            <p>Disetujui,</p>
            <p>Pimpinan Produksi</p>
            <p class="name">( ................................ )</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RAB_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('RAB diexport ke Word (.doc). Buka dengan Word/LibreOffice.', 'success');
  };

  // ==========================================
  // DOCUMENT HANDLERS
  // ==========================================
  const openCreateDocument = () => {
    setDocTitle('RAB Final Produksi Teater');
    setDocFileUrl('');
    setDocFileName('');
    setPimproSig('');
    setBendaharaSig('');
    setIsDocModalOpen(true);
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !docFileUrl.trim()) {
      showToast('Isi link file RAB final.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const id = doc(collection(db, 'rabDocuments')).id;
      const data: RABDocument = {
        id,
        classId: activeClass.id,
        title: docTitle.trim(),
        fileUrl: docFileUrl.trim(),
        fileName: docFileName.trim() || 'RAB_Final.pdf',
        version: 1,
        signedByPimpro: !!pimproSig.trim(),
        pimproSignature: pimproSig.trim(),
        signedAtPimpro: pimproSig.trim() ? new Date().toISOString() : undefined,
        signedByBendahara: !!bendaharaSig.trim(),
        bendaharaSignature: bendaharaSig.trim(),
        signedAtBendahara: bendaharaSig.trim() ? new Date().toISOString() : undefined,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.uid,
        uploaderName: user.displayName,
      };
      await setDoc(doc(db, 'rabDocuments', id), data);
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'RABDocument', targetId: id,
        details: `Upload RAB final: ${docTitle}`,
      });
      showToast('Dokumen RAB final tersimpan.', 'success');
      setIsDocModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + err.message, 'error');
    } finally { setSubmitting(false); }
  };

  const handleDeleteDocument = async (docItem: RABDocument) => {
    if (!confirm(`Hapus dokumen "${docItem.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'rabDocuments', docItem.id));
      showToast('Dokumen dihapus.', 'info');
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
                Input per Divisi/Peran/Umum • Export Word • Upload RAB final
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExportWord}
              className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg">
              <Download className="w-3.5 h-3.5" /> Export Word
            </button>
            {canManageItems && activeTab === 'items' && (
              <button onClick={openCreateItem}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg">
                <Plus className="w-3.5 h-3.5" /> Tambah Item
              </button>
            )}
            {activeTab === 'documents' && (
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
          {/* Summary */}
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

          {/* Search + Filter */}
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

          {/* Grouped items */}
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
                  <div className={`p-3 flex items-center justify-between ${
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
                    <span className="text-xs font-black text-slate-800 dark:text-white">
                      Rp {group.subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {group.items.map(it => (
                      <div key={it.id} className="p-3 flex items-center gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 dark:text-white">{it.itemName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {it.qty} {it.unit} × Rp {it.unitPrice.toLocaleString('id-ID')}
                            {it.notes && ` • ${it.notes}`}
                          </p>
                        </div>
                        <span className="font-bold text-amber-700 dark:text-amber-400 text-[11px] whitespace-nowrap">
                          Rp {(it.qty * it.unitPrice).toLocaleString('id-ID')}
                        </span>
                        {canManageItems && (
                          <div className="flex gap-1">
                            <button onClick={() => openEditItem(it)}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteItem(it)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Grand Total */}
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
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                Belum Ada Dokumen RAB Final
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Setelah RAB digital diexport ke Word dan ditandatangani Pimpro & Bendahara,
                upload file final (PDF/Word) ke sini dengan link Google Drive.
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
                          {docItem.fileName} • Upload: {new Date(docItem.uploadedAt).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                    {canManageItems && (
                      <button onClick={() => handleDeleteDocument(docItem)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* TTD Status */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2.5 rounded-xl border text-center ${
                      docItem.signedByPimpro
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Pimpinan Produksi</p>
                      {docItem.signedByPimpro ? (
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 flex items-center justify-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {docItem.pimproSignature}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5 italic">Belum ditandatangani</p>
                      )}
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center ${
                      docItem.signedByBendahara
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Bendahara</p>
                      {docItem.signedByBendahara ? (
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 flex items-center justify-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {docItem.bendaharaSignature}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5 italic">Belum ditandatangani</p>
                      )}
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

      {/* ============ MODAL ITEM ============ */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveItem}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[92vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-500" />
                {editingItem ? 'Edit Item RAB' : 'Tambah Item RAB'}
              </h3>
              <button type="button" onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kategori <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['DIVISI', 'PERAN', 'UMUM'] as Category[]).map(c => {
                  const Icon = CATEGORY_CONFIG[c].icon;
                  return (
                    <button key={c} type="button" onClick={() => {
                      setItemCategory(c);
                      if (c === 'DIVISI') setItemTargetName(DIVISIONS[1].id);
                      else if (c === 'PERAN') setItemTargetName(PERAN_LIST[0]);
                      else setItemTargetName('Umum');
                    }}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold transition flex flex-col items-center gap-1 ${
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {DIVISIONS.slice(1).map(d => <option key={d.id} value={d.id}>{d.id}</option>)}
                </select>
              </div>
            )}

            {itemCategory === 'PERAN' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Peran</label>
                <select value={itemTargetName} onChange={(e) => setItemTargetName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  {PERAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Item <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)}
                placeholder="Contoh: Kertas Karton A3"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Qty</label>
                <input type="number" required min="1" value={itemQty}
                  onChange={(e) => setItemQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Satuan</label>
                <input type="text" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)}
                  placeholder="pcs/lembar/set"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Harga Satuan</label>
                <input type="number" required min="0" step="500" value={itemUnitPrice || ''}
                  onChange={(e) => setItemUnitPrice(parseInt(e.target.value) || 0)}
                  placeholder="15000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <p className="text-[11px] text-amber-900 dark:text-amber-200">
                <strong>Subtotal:</strong> Rp {(itemQty * itemUnitPrice).toLocaleString('id-ID')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
              <input type="text" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Contoh: daur ulang"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsItemModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {submitting ? 'Menyimpan...' : 'Simpan Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============ MODAL DOKUMEN ============ */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveDocument}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[92vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" /> Upload RAB Final
              </h3>
              <button type="button" onClick={() => setIsDocModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <strong>Alur:</strong> 1) Susun RAB → 2) Export Word → 3) Tanda tangan fisik kedua pihak →
                4) Scan/PDF → 5) Upload ke Google Drive → 6) Paste link + nama tanda tangan di sini.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Dokumen</label>
              <input type="text" required value={docTitle} onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Link Google Drive RAB Final <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input type="url" required value={docFileUrl} onChange={(e) => setDocFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama File (Opsional)</label>
              <input type="text" value={docFileName} onChange={(e) => setDocFileName(e.target.value)}
                placeholder="RAB_Final_IXC.pdf"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5" /> TTD Pimpinan Produksi
                </label>
                <input type="text" value={pimproSig} onChange={(e) => setPimproSig(e.target.value)}
                  placeholder="Ketik nama Pimpro"
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                  Kosongkan jika belum ditandatangani.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5" /> TTD Bendahara
                </label>
                <input type="text" value={bendaharaSig} onChange={(e) => setBendaharaSig(e.target.value)}
                  placeholder="Ketik nama Bendahara"
                  className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Kosongkan jika belum ditandatangani.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsDocModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {submitting ? 'Menyimpan...' : 'Simpan Dokumen'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
