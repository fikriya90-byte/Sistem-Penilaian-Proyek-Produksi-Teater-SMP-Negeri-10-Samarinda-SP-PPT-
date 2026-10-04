import React, { useState, useEffect } from 'react';
import {
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  Folder,
  PlusCircle,
  Search,
  Trash2,
  Upload
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { ProductionDocument } from '../../core/types';
import { recordAuditLog, subscribeDocuments, uploadDocumentMeta } from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const DocumentModule: React.FC = () => {
  const { user, activeClass, isTeacher, isPimprod, isSekretaris, isBendahara } = useAuth();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState<ProductionDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ProductionDocument['category']>('Naskah Drama');
  const [fileUrl, setFileUrl] = useState('');
  const [fileSize, setFileSize] = useState('1.5 MB');

  const CATEGORIES = [
    'Proposal',
    'Surat Izin',
    'Naskah Drama',
    'Notulen Rapat',
    'Dokumentasi',
    'Laporan Keuangan',
    'Laporan Divisi',
    'LPJ',
  ] as const;

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeDocuments(activeClass.id, (docs) => {
      setDocuments(docs);
    });
    return () => unsub();
  }, [activeClass]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !fileUrl.trim()) {
      showToast('Harap lengkapi judul dokumen dan URL berkas.', 'warning');
      return;
    }

    try {
      const docId = await uploadDocumentMeta({
        classId: activeClass.id,
        title: title.trim(),
        category,
        fileUrl: fileUrl.trim(),
        fileSize,
        fileType: 'application/pdf',
        uploadedBy: user.uid,
        uploaderName: user.displayName,
        uploaderRole: user.role,
        createdAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Document',
        targetId: docId,
        details: `Upload dokumen "${title}" kategori ${category}`,
      });

      showToast('Metadata dokumen berhasil diarsipkan!', 'success');
      setIsModalOpen(false);
      setTitle('');
      setFileUrl('');
    } catch (err: any) {
      showToast('Gagal mengunggah dokumen: ' + err.message, 'error');
    }
  };

  const filteredDocs = documents.filter(d => {
    if (selectedCategory !== 'ALL' && d.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      return (
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Folder className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Arsip Dokumen & Berkas Produksi
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Penyimpanan digital naskah drama, proposal, notulen, LPJ, dan arsip keuangan
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition"
        >
          <Upload className="w-4 h-4" />
          <span>Arsipkan Berkas Baru</span>
        </button>
      </div>

      {/* Category Folders & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Folder ({documents.length})
          </button>

          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berkas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
          />
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            Belum ada berkas dokumen pada kategori ini.
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div
              key={doc.id}
              className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    {doc.category}
                  </span>
                  <span className="font-mono text-slate-400 text-[10px]">
                    {doc.fileSize || 'PDF'}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-2xl bg-slate-100 text-slate-700 shrink-0">
                    <FileText className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 line-clamp-2 leading-snug">
                      {doc.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Oleh: {doc.uploaderName} ({doc.uploaderRole || 'Tim'})
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(doc.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>

                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Berkas</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Upload Doc */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" /> Arsipkan Dokumen Baru
            </h3>

            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama / Judul Dokumen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Naskah Lakon Titah Ratu Aji (Babak 1-4)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Dokumen</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ukuran Perkiraan</label>
                  <input
                    type="text"
                    value={fileSize}
                    onChange={(e) => setFileSize(e.target.value)}
                    placeholder="Contoh: 2.4 MB"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tautan File (Google Drive / Cloud URL) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/... atau URL dokumen"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pastikan izin tautan Google Drive disetel ke "Siapa saja yang memiliki link dapat melihat".
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
                >
                  Simpan ke Arsip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
