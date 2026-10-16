import React, { useState, useEffect, useMemo } from 'react';
import {
  Library, Download, Upload, X, Save, Trash2, Search, Edit3,
  ExternalLink, FileText, User as UserIcon, Clock, CheckCircle,
  AlertTriangle, Eye, Link2, Info, RefreshCw, FileCheck,
  Layers, BookOpen, Music, Package, Scissors, Palette, ShieldAlert,
  FileDown, FileEdit,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { recordAuditLog } from '../../services/firestoreService';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import {
  TEMPLATE_LIBRARY, TEMPLATE_CATEGORIES, getTemplateById,
  TemplateDef, TemplateCategory, TemplateContext,
} from '../../core/templateLibrary';
import { TemplateFillModal } from './TemplateFillModal';

const ICONS: Record<string, any> = {
  FileText, FileCheck, Layers, BookOpen, Music, Package, Scissors, Palette,
};

interface TemplateSubmission {
  id: string;
  classId: string;
  templateId: string;
  templateTitle: string;
  templateCategory: TemplateCategory;
  fileUrl: string;
  fileName: string;
  notes: string;
  uploaderId: string;
  uploaderName: string;
  uploaderRole: string;
  createdAt: string;
}

interface TemplateDraft {
  id: string;
  classId: string;
  templateId: string;
  userId: string;
  updatedAt: string;
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  ADMINISTRASI: 'bg-amber-100 text-amber-800 border-amber-300',
  ARTISTIK:     'bg-pink-100 text-pink-800 border-pink-300',
  PRODUKSI:     'bg-blue-100 text-blue-800 border-blue-300',
};

const COLOR_MAP: Record<string, string> = {
  amber: 'from-amber-500 to-amber-700',
  blue: 'from-blue-500 to-blue-700',
  emerald: 'from-emerald-500 to-emerald-700',
  purple: 'from-purple-500 to-purple-700',
  rose: 'from-rose-500 to-rose-700',
  cyan: 'from-cyan-500 to-cyan-700',
  indigo: 'from-indigo-500 to-indigo-700',
  pink: 'from-pink-500 to-pink-700',
};

export const TemplateHubModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole, isPimprod } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'templates' | 'submissions'>('templates');
  const [filterCategory, setFilterCategory] = useState<'ALL' | TemplateCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [submissions, setSubmissions] = useState<TemplateSubmission[]>([]);
  const [drafts, setDrafts] = useState<TemplateDraft[]>([]);
  const [loading, setLoading] = useState(true);

  // Fill modal
  const [fillFor, setFillFor] = useState<TemplateDef | null>(null);

  // Upload modal
  const [uploadFor, setUploadFor] = useState<TemplateDef | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [previewSubmission, setPreviewSubmission] = useState<TemplateSubmission | null>(null);

  const isStaff = isGuruPengampu || isAdminRole;

  // ═══════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════
  useEffect(() => {
    if (!activeClass) return;
    setLoading(true);

    const q1 = query(
      collection(db, 'templateSubmissions'),
      where('classId', '==', activeClass.id)
    );
    const unsub1 = onSnapshot(q1, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as TemplateSubmission));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSubmissions(list);
      setLoading(false);
    }, err => {
      console.warn('Submissions error:', err);
      setLoading(false);
    });

    // Load drafts untuk user ini saja
    let unsub2: (() => void) | undefined;
    if (user) {
      const q2 = query(
        collection(db, 'templateDrafts'),
        where('classId', '==', activeClass.id),
        where('userId', '==', user.uid)
      );
      unsub2 = onSnapshot(q2, snap => {
        setDrafts(snap.docs.map(d => ({ ...d.data(), id: d.id } as TemplateDraft)));
      }, err => console.warn('Drafts error:', err));
    }

    return () => { unsub1(); if (unsub2) unsub2(); };
  }, [activeClass, user]);

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════
  const buildContext = (): TemplateContext => ({
    className: activeClass?.name || '',
    kerabatKerja: activeClass?.kerabatKerja,
    academicYear: activeClass?.academicYear || '2025/2026',
    teacherName: activeClass?.teacherName || 'Guru Pengampu',
    totalStudents: activeClass?.totalStudents || 30,
    schoolName: 'SMP NEGERI 10 SAMARINDA',
    schoolAddress: 'Jl. Pendidikan No. 10, Samarinda, Kalimantan Timur 75123',
    schoolEmail: 'info@smpn10samarinda.sch.id',
    schoolPhone: '(0541) 123456',
  });

  const canUploadForTemplate = (tpl: TemplateDef): boolean => {
    if (!user) return false;
    return tpl.allowedRoles.includes(user.role);
  };

  const draftForTemplate = (tpl: TemplateDef): TemplateDraft | undefined =>
    drafts.find(d => d.templateId === tpl.id);

  const subsForTemplate = (tpl: TemplateDef): TemplateSubmission[] =>
    submissions.filter(s => s.templateId === tpl.id);

  // ═══════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════
  const openFill = (tpl: TemplateDef) => {
    if (!canUploadForTemplate(tpl)) {
      showToast(`Hanya role berikut yang bisa mengisi "${tpl.shortTitle}": ${tpl.allowedRoles.slice(0, 3).join(', ')}...`, 'warning');
      return;
    }
    setFillFor(tpl);
  };

  const openUpload = (tpl: TemplateDef) => {
    if (!canUploadForTemplate(tpl)) {
      showToast('Role Anda tidak berwenang mengunggah hasil template ini.', 'warning');
      return;
    }
    setUploadFor(tpl);
    setUploadFileName('');
    setUploadFileUrl('');
    setUploadNotes('');
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !uploadFor) return;
    if (!uploadFileName.trim()) { showToast('Nama file wajib diisi.', 'warning'); return; }
    if (!uploadFileUrl.trim() || !uploadFileUrl.startsWith('http')) {
      showToast('Link Google Drive tidak valid.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'templateSubmissions'));
      await setDoc(newRef, {
        id: newRef.id,
        classId: activeClass.id,
        templateId: uploadFor.id,
        templateTitle: uploadFor.title,
        templateCategory: uploadFor.category,
        fileName: uploadFileName.trim(),
        fileUrl: uploadFileUrl.trim(),
        notes: uploadNotes.trim(),
        uploaderId: user.uid,
        uploaderName: user.displayName,
        uploaderRole: user.role,
        createdAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'TemplateSubmission', targetId: newRef.id,
        details: `Upload hasil "${uploadFor.shortTitle}" — ${uploadFileName}`,
      });

      showToast(`✅ Hasil "${uploadFor.shortTitle}" berhasil diunggah!`, 'success');
      setUploadFor(null);
      setActiveTab('submissions');
    } catch (err: any) {
      showToast('Gagal upload: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmission = async (sub: TemplateSubmission) => {
    if (!user) return;
    const canDelete = sub.uploaderId === user.uid || isStaff || isPimprod;
    if (!canDelete) {
      showToast('Anda tidak berwenang menghapus.', 'warning');
      return;
    }
    if (!confirm(`Hapus submission "${sub.fileName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'templateSubmissions', sub.id));
      showToast('Submission dihapus.', 'info');
      if (previewSubmission?.id === sub.id) setPreviewSubmission(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleDeleteDraft = async (tpl: TemplateDef) => {
    if (!user || !activeClass) return;
    if (!confirm(`Hapus draft "${tpl.shortTitle}"? Isian akan hilang.`)) return;
    try {
      const d = draftForTemplate(tpl);
      if (!d) return;
      await deleteDoc(doc(db, 'templateDrafts', d.id));
      showToast('Draft dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // ═══════════════════════════════════════════════════════
  // FILTER
  // ═══════════════════════════════════════════════════════
  const filteredTemplates = useMemo(() => {
    return TEMPLATE_LIBRARY.filter(t => {
      if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.shortTitle.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filterCategory, searchQuery]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      if (filterCategory !== 'ALL' && s.templateCategory !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.templateTitle.toLowerCase().includes(q) ||
          s.fileName.toLowerCase().includes(q) ||
          s.uploaderName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [submissions, filterCategory, searchQuery]);

  const stats = {
    totalTemplates: TEMPLATE_LIBRARY.length,
    totalSubmissions: submissions.length,
    byMe: submissions.filter(s => s.uploaderId === user?.uid).length,
    myDrafts: drafts.length,
  };

  if (!activeClass) {
    return (
      <div className="p-12 text-center bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 rounded-3xl max-w-2xl mx-auto my-8">
        <AlertTriangle className="w-16 h-16 mx-auto text-amber-600 mb-4" />
        <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">Anda Belum Masuk ke Kelas</h3>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Pilih kelas dulu untuk melihat & mengisi template.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 text-white shadow-xl border border-indigo-500/20">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Library className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Template Hub — Generate DOCX
            </span>
            <h2 className="text-xl font-black text-white mt-1">
              Template Dokumen — {activeClass.name}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Isi form di sistem → generate DOCX otomatis → edit di Word → upload hasil
            </p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Template</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalTemplates}</p>
        </div>
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 shadow-sm">
          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Draft Saya</p>
          <p className="text-2xl font-black text-indigo-800 dark:text-indigo-200">{stats.myDrafts}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Hasil Diunggah</p>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{stats.totalSubmissions}</p>
        </div>
        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 shadow-sm">
          <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Karya Saya</p>
          <p className="text-2xl font-black text-purple-800 dark:text-purple-200">{stats.byMe}</p>
        </div>
      </div>

      {/* INFO ALUR */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <p className="font-black text-sm mb-2">🎯 Alur Penggunaan (5 Langkah)</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Klik <strong>"Isi & Generate"</strong> pada template → form muncul</li>
            <li>Isi semua field yang diminta → <strong>draft tersimpan otomatis</strong> tiap 30 detik (bisa ditinggal & lanjut kapan saja)</li>
            <li>Klik <strong>"Generate DOCX"</strong> → file .docx langsung terunduh dengan data Anda terisi</li>
            <li>Buka di Word → <strong>ganti placeholder <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">[ LOGO SEKOLAH ]</code> dan <code className="bg-blue-100 dark:bg-blue-500/20 px-1 rounded">[ LOGO KERABAT ]</code> dengan gambar asli</strong>, edit finishing jika perlu</li>
            <li>Upload hasil ke Google Drive → <strong>paste link di tombol "Unggah Hasil"</strong> → selesai! Muncul di tab Hasil Karya</li>
          </ol>
        </div>
      </div>

      {/* TAB SWITCH */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'templates' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          <Library className="w-3.5 h-3.5" /> Template ({TEMPLATE_LIBRARY.length})
        </button>
        <button onClick={() => setActiveTab('submissions')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'submissions' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          <FileCheck className="w-3.5 h-3.5" /> Hasil Karya ({submissions.length})
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari template atau hasil karya..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              filterCategory === 'ALL' ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
            Semua
          </button>
          {TEMPLATE_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setFilterCategory(c.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                filterCategory === c.id ? c.color : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB TEMPLATES */}
      {activeTab === 'templates' && (
        <>
          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <Library className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Tidak ada template cocok</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTemplates.map(tpl => {
                const Icon = ICONS[tpl.icon] || FileText;
                const gradient = COLOR_MAP[tpl.color] || 'from-slate-500 to-slate-700';
                const canFill = canUploadForTemplate(tpl);
                const myDraft = draftForTemplate(tpl);
                const mySubs = subsForTemplate(tpl);

                return (
                  <div key={tpl.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition space-y-3">
                    <div className="flex items-start gap-3">
                      <span className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md shrink-0`}>
                        <Icon className="w-6 h-6" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${CATEGORY_COLORS[tpl.category]}`}>
                            {TEMPLATE_CATEGORIES.find(c => c.id === tpl.category)?.label}
                          </span>
                          {tpl.withKop && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                              📄 KOP
                            </span>
                          )}
                          {myDraft && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/40 flex items-center gap-1">
                              <FileEdit className="w-2.5 h-2.5" /> Draft
                            </span>
                          )}
                          {mySubs.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> {mySubs.length} hasil
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                          {tpl.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        <strong>Bisa isi:</strong> {tpl.allowedRoles.slice(0, 3).join(', ')}
                        {tpl.allowedRoles.length > 3 && ` +${tpl.allowedRoles.length - 3} lainnya`}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        {canFill ? (
                          <>
                            <button onClick={() => openFill(tpl)}
                              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition min-w-[130px]">
                              <Edit3 className="w-3.5 h-3.5" />
                              {myDraft ? 'Lanjut Isi Draft' : 'Isi & Generate'}
                            </button>
                            <button onClick={() => openUpload(tpl)}
                              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition min-w-[130px]">
                              <Upload className="w-3.5 h-3.5" /> Unggah Hasil
                            </button>
                          </>
                        ) : (
                          <div className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-not-allowed">
                            <ShieldAlert className="w-3 h-3" /> Bukan role pengisi
                          </div>
                        )}
                      </div>

                      {myDraft && (
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                          <span>
                            Draft terakhir: {new Date(myDraft.updatedAt).toLocaleString('id-ID', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                          <button onClick={() => handleDeleteDraft(tpl)}
                            className="text-rose-600 dark:text-rose-400 hover:underline font-bold">
                            Hapus Draft
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <>
          {loading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
              <p className="text-xs text-slate-400">Memuat hasil karya...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
              <FileCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Hasil Karya</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Isi & generate template dulu di tab Template, edit di Word, lalu unggah hasilnya di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map(sub => {
                const tpl = getTemplateById(sub.templateId);
                const Icon = tpl ? (ICONS[tpl.icon] || FileText) : FileText;
                const gradient = tpl ? (COLOR_MAP[tpl.color] || 'from-slate-500 to-slate-700') : 'from-slate-500 to-slate-700';
                const canDelete = sub.uploaderId === user?.uid || isStaff || isPimprod;
                const isMine = sub.uploaderId === user?.uid;

                return (
                  <div key={sub.id}
                    className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-sm space-y-3 ${
                      isMine ? 'border-indigo-300 dark:border-indigo-500/40' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                    <div className="flex items-start gap-3">
                      <span className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${CATEGORY_COLORS[sub.templateCategory]}`}>
                            {TEMPLATE_CATEGORIES.find(c => c.id === sub.templateCategory)?.label}
                          </span>
                          {isMine && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/40">
                              Karya Anda
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(sub.createdAt).toLocaleString('id-ID', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                          {sub.fileName}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Template: <strong className="text-slate-700 dark:text-slate-300">{sub.templateTitle}</strong>
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                          <UserIcon className="w-3 h-3" />
                          <strong className="text-slate-700 dark:text-slate-300">{sub.uploaderName}</strong>
                          <span className="text-slate-400">({sub.uploaderRole})</span>
                        </p>
                        {sub.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 italic p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                            "{sub.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 flex-wrap">
                      <a href={sub.fileUrl} target="_blank" rel="noreferrer"
                        className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition min-w-[120px]">
                        <Download className="w-3.5 h-3.5" /> Unduh / Buka
                      </a>
                      <button onClick={() => setPreviewSubmission(sub)}
                        className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button onClick={() => handleDeleteSubmission(sub)}
                          className="px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* FILL MODAL */}
      {fillFor && (
        <TemplateFillModal
          template={fillFor}
          ctx={buildContext()}
          onClose={() => setFillFor(null)}
          onGenerated={() => { /* tetap buka modal, biar bisa langsung upload */ }}
          onGoToUpload={() => {
            const tpl = fillFor;
            setFillFor(null);
            setTimeout(() => openUpload(tpl), 200);
          }}
        />
      )}

      {/* UPLOAD MODAL */}
      {uploadFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSubmitUpload}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-500 text-white">
                  <Upload className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Unggah Hasil Edit
                  </p>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {uploadFor.shortTitle}
                  </h3>
                </div>
              </div>
              <button type="button" onClick={() => setUploadFor(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>Pastikan file sudah diedit</strong> & di-upload ke Google Drive dengan izin
                <strong> "Anyone with the link"</strong> supaya bisa diunduh semua orang.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama File / Judul Hasil <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={uploadFileName}
                onChange={(e) => setUploadFileName(e.target.value)}
                placeholder={`Contoh: ${uploadFor.shortTitle} Final ${activeClass.name}`}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Link Google Drive <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input type="url" required value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan (Opsional)
              </label>
              <textarea rows={2} value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Contoh: Sudah ditandatangani Pimpro & Bendahara"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setUploadFor(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {submitting ? 'Mengunggah...' : 'Unggah Hasil'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewSubmission && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-500" /> Detail Hasil Karya
              </h3>
              <button onClick={() => setPreviewSubmission(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Judul</p>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">{previewSubmission.fileName}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Template</p>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">{previewSubmission.templateTitle}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Pengunggah</p>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {previewSubmission.uploaderName} ({previewSubmission.uploaderRole})
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tanggal Unggah</p>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {new Date(previewSubmission.createdAt).toLocaleString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              {previewSubmission.notes && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Catatan</p>
                  <p className="text-amber-900 dark:text-amber-200 mt-0.5 italic">"{previewSubmission.notes}"</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <a href={previewSubmission.fileUrl} target="_blank" rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Buka di Drive
              </a>
              <button onClick={() => setPreviewSubmission(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
