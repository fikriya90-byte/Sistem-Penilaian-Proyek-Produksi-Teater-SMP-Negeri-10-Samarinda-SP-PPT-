import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Save, FileDown, RefreshCw, AlertTriangle, CheckCircle,
  Info, Eye, RotateCcw, Sparkles, FileText, Calculator, Plus, Trash2
} from 'lucide-react';
import { useToast } from '../common/Toast';
import { useAuth } from '../../core/authContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';
import { TemplateDef, buildKopFor, TemplateContext } from '../../core/templateLibrary';
import { getTemplateForm, FormSection, FormField } from '../../core/templateForms';
import { downloadDOCX } from '../../utils/exportDOCX';

interface Props {
  template: TemplateDef;
  ctx: TemplateContext;
  onClose: () => void;
  onGenerated: () => void;
  onGoToUpload: () => void;
}

const draftId = (classId: string, templateId: string, userId: string) =>
  `${classId}__${templateId}__${userId}`;

export const TemplateFillModal: React.FC<Props> = ({
  template, ctx, onClose, onGenerated, onGoToUpload,
}) => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const sections: FormSection[] = getTemplateForm(template.id);
  const allFields: FormField[] = useMemo(
    () => sections.flatMap(s => s.fields),
    [sections]
  );

  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const rabItems = ctx.rabItems || [];

  useEffect(() => {
    if (!user || !activeClass) return;
    (async () => {
      setLoading(true);
      try {
        const id = draftId(activeClass.id, template.id, user.uid);
        const snap = await getDoc(doc(db, 'templateDrafts', id));
        if (snap.exists()) {
          const d = snap.data();
          setData(d.data || {});
          setLastSaved(d.updatedAt || null);
        }
      } catch (err) {
        console.warn('Load draft error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, activeClass, template.id]);

  const filledCount = allFields.filter(f => {
    const val = data[f.key];
    return val !== undefined && val !== null && String(val).trim() !== '';
  }).length;
  const progressPct = allFields.length > 0 ? Math.round((filledCount / allFields.length) * 100) : 0;

  const missingRequired = allFields.filter(f => {
    if (!f.required) return false;
    const val = data[f.key];
    return val === undefined || val === null || String(val).trim() === '';
  });

  const update = (key: string, value: any) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveDraft = async (silent = false) => {
    if (!user || !activeClass) return;
    setSaving(true);
    try {
      const id = draftId(activeClass.id, template.id, user.uid);
      await setDoc(doc(db, 'templateDrafts', id), {
        id,
        classId: activeClass.id,
        templateId: template.id,
        templateTitle: template.title,
        userId: user.uid,
        userName: user.displayName,
        data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setLastSaved(new Date().toISOString());
      if (!silent) showToast('Draft tersimpan.', 'success');
    } catch (err: any) {
      showToast('Gagal simpan: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      if (Object.keys(data).length > 0) handleSaveDraft(true);
    }, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  const handleGenerate = async () => {
    if (!user || !activeClass) return;
    if (missingRequired.length > 0) {
      showToast(`Masih ada ${missingRequired.length} field wajib yang belum diisi.`, 'warning');
      return;
    }

    setGenerating(true);
    try {
      await handleSaveDraft(true);

      const blocks = template.buildBlocks(ctx, data);
      const safeName = template.shortTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const safeClass = activeClass.name.replace(/[^a-zA-Z0-9]/g, '_');

      downloadDOCX(
        `${safeName}_${safeClass}_${new Date().toISOString().slice(0, 10)}.docx`,
        blocks,
        template.withKop ? { withKop: true, kop: buildKopFor(ctx) } : {}
      );

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'TemplateGenerate',
        targetId: `${activeClass.id}__${template.id}`,
        details: `Generate DOCX: ${template.shortTitle}${rabItems.length > 0 ? ` (RAB: ${rabItems.length} item)` : ''}`,
      });

      showToast('DOCX terunduh. Buka di Word untuk ganti logo dan finishing.', 'success');
      onGenerated();
    } catch (err: any) {
      showToast('Gagal generate: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Reset semua isian? Draft yang sudah tersimpan akan dihapus.')) return;
    setData({});
  };

  // ==========================================
  // FUNGSI UNTUK TABEL DINAMIS (TANPA PIPA)
  // ==========================================
  const parseTableData = (rawString: string, columns: string[]) => {
    if (!rawString) return [];
    return rawString.split('\n').filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim());
      const rowObj: Record<string, string> = {};
      columns.forEach((col, i) => { rowObj[col] = parts[i] || ''; });
      return rowObj;
    });
  };

  const stringifyTableData = (rows: Record<string, string>[], columns: string[]) => {
    return rows.map(row => columns.map(col => row[col] || '').join(' | ')).join('\n');
  };

  const renderField = (f: FormField) => {
    const value = data[f.key] ?? '';
    const baseInput = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

    if (f.type === 'table' && f.columns) {
      const rows = parseTableData(value, f.columns);

      const handleAddRow = () => {
        const newRow: Record<string, string> = {};
        f.columns!.forEach(c => newRow[c] = '');
        const newRows = [...rows, newRow];
        update(f.key, stringifyTableData(newRows, f.columns!));
      };

      const handleRemoveRow = (idx: number) => {
        const newRows = rows.filter((_, i) => i !== idx);
        update(f.key, stringifyTableData(newRows, f.columns!));
      };

      const handleCellChange = (idx: number, col: string, val: string) => {
        const newRows = [...rows];
        newRows[idx] = { ...newRows[idx], [col]: val };
        update(f.key, stringifyTableData(newRows, f.columns!));
      };

      return (
        <div className="space-y-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
          {rows.length === 0 ? (
            <p className="text-xs text-center text-slate-400 italic py-2">Belum ada data. Klik tombol di bawah untuk menambah.</p>
          ) : (
            <div className="space-y-2">
              {/* HEADER TAMPILAN DESKTOP (Tabel) */}
              <div className="hidden md:flex gap-2 px-1">
                {f.columns.map(col => (
                  <div key={col} className="flex-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {col}
                  </div>
                ))}
                <div className="w-16"></div> {/* Spacer untuk tombol hapus */}
              </div>

              {/* BARIS INPUT */}
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex flex-col md:flex-row gap-2 md:items-center p-2 md:p-0 bg-white dark:bg-slate-800 md:bg-transparent md:dark:bg-transparent rounded-xl md:rounded-none border border-slate-200 dark:border-slate-700 md:border-0">
                  
                  {/* Kolom-kolom Input */}
                  <div className="flex flex-col md:flex-row flex-1 gap-2">
                    {f.columns!.map(col => (
                      <div key={col} className="flex-1">
                        {/* Label Mobile (Hanya muncul di HP) */}
                        <label className="block md:hidden text-[10px] font-bold text-slate-500 mb-1">{col}</label>
                        <input
                          type="text"
                          value={row[col] || ''}
                          onChange={(e) => handleCellChange(rowIdx, col, e.target.value)}
                          placeholder={`${col}...`}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Tombol Hapus */}
                  <div className="flex justify-end md:justify-center md:w-16">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(rowIdx)}
                      className="px-3 py-2 md:p-2 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-500/30 font-bold text-xs flex items-center gap-1 transition"
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="md:hidden">Hapus</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            className="w-full md:w-auto mt-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center md:justify-start gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Tambah {f.label.split(' ')[0]}
          </button>
        </div>
      );
    }

    switch (f.type) {
      case 'textarea':
      case 'list':
        return (
          <textarea
            rows={f.rows || 4}
            value={value}
            onChange={(e) => update(f.key, e.target.value)}
            placeholder={f.placeholder}
            className={`${baseInput} font-medium leading-relaxed`}
          />
        );
      case 'select':
        return (
          <select value={value} onChange={(e) => update(f.key, e.target.value)} className={baseInput}>
            <option value="">Pilih salah satu</option>
            {(f.options || []).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case 'date':
        return <input type="date" value={value} onChange={(e) => update(f.key, e.target.value)} className={baseInput} />;
      case 'time':
        return <input type="time" value={value} onChange={(e) => update(f.key, e.target.value)} className={baseInput} />;
      case 'number':
        return <input type="number" value={value} onChange={(e) => update(f.key, e.target.value)} placeholder={f.placeholder} className={baseInput} />;
      default:
        return <input type="text" value={value} onChange={(e) => update(f.key, e.target.value)} placeholder={f.placeholder} className={baseInput} />;
    }
  };

  const showRABInfo = ['proposal', 'lpj'].includes(template.id);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[97vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="p-5 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm shrink-0">
                <FileText className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  Isi Detail, Generate
                </p>
                <h3 className="text-base font-black mt-0.5 truncate">{template.title}</h3>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Isi bagian di bawah. Sistem akan generate file .docx dengan data Anda.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
              <span>Progress pengisian</span>
              <span>{filledCount}/{allFields.length} - {progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  progressPct === 100 ? 'bg-emerald-400' :
                  progressPct >= 60 ? 'bg-amber-300' : 'bg-white/80'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">

          {showRABInfo && (
            <div className={`p-3 rounded-xl border flex items-start gap-2 ${
              rabItems.length > 0
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
            }`}>
              <Calculator className={`w-4 h-4 shrink-0 mt-0.5 ${
                rabItems.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              }`} />
              <div className="text-[11px] leading-relaxed">
                {rabItems.length > 0 ? (
                  <div className="text-emerald-900 dark:text-emerald-200">
                    <p className="font-bold">
                      {rabItems.length} item RAB terdeteksi di sistem
                    </p>
                    <p className="mt-0.5">
                      RAB Anda akan otomatis dimuat lengkap di dokumen.
                    </p>
                  </div>
                ) : (
                  <div className="text-amber-900 dark:text-amber-200">
                    <p className="font-bold">RAB Digital masih kosong</p>
                    <p className="mt-0.5">
                      Sebaiknya isi dulu di menu RAB Digital supaya tabel RAB bisa dicantumkan otomatis.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
              <p className="font-bold mb-1">Tips pengisian:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Draft otomatis tersimpan tiap 30 detik. Bisa ditinggal dan dilanjutkan kapan saja.</li>
                <li>Field wajib (bertanda bintang merah) harus diisi sebelum generate.</li>
                <li>Pada bagian tabel, Anda tidak perlu mengetik tanda (|). Isi kolomnya saja.</li>
              </ul>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-500" />
              <p className="text-xs text-slate-500">Memuat draft...</p>
            </div>
          ) : (
            <>
              {sections.map((sec, si) => (
                <div key={si} className="space-y-3">
                  {sec.title && (
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-700">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        {sec.title}
                      </h4>
                    </div>
                  )}
                  {sec.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-rose-500 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                      {field.help && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic flex items-start gap-1">
                          <Info className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{field.help}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {showPreview && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-500/40 space-y-2">
              <p className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                <Eye className="w-4 h-4" /> Preview Data yang Akan Digenerate
              </p>
              {allFields.map(f => {
                const val = data[f.key];
                if (!val || String(val).trim() === '') return null;
                return (
                  <div key={f.key} className="text-[11px] py-1.5 border-b border-slate-200 dark:border-slate-700 last:border-0">
                    <p className="font-bold text-slate-700 dark:text-slate-300">{f.label}:</p>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line line-clamp-3 mt-0.5">
                      {String(val)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0">
          {missingRequired.length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>{missingRequired.length} field wajib belum diisi:</strong>{' '}
                {missingRequired.slice(0, 3).map(f => f.label).join(', ')}
                {missingRequired.length > 3 && ` +${missingRequired.length - 3} lainnya`}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setShowPreview(!showPreview)}
                className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <Eye className="w-3 h-3" /> {showPreview ? 'Sembunyikan' : 'Preview'}
              </button>
              <button type="button" onClick={handleReset}
                className="px-3 py-2 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              {lastSaved && (
                <span className="text-[10px] text-slate-400 italic">
                  Tersimpan {new Date(lastSaved).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => handleSaveDraft(false)} disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Menyimpan...' : 'Simpan Draft'}
              </button>
              <button type="button" onClick={handleGenerate}
                disabled={generating || missingRequired.length > 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-xs shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                <FileDown className="w-4 h-4" />
                {generating ? 'Generating...' : 'Generate DOCX'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};