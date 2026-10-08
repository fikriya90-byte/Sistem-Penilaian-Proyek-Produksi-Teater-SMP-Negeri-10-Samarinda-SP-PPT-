import React, { useState, useEffect } from 'react';
import {
  Flag, PlusCircle, X, Save, Edit3, Trash2, Search, Info,
  Settings2, AlertTriangle, Circle, Play, CheckCircle,
  GitBranch, List, Check,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';
import { ProductionStage } from '../../core/types';
import { STAGES } from '../../core/constants';

// ═══════════════════════════════════════════════════════
// TIPE DATA
// ═══════════════════════════════════════════════════════
interface TimelineConfig {
  id: string;
  classId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt?: string;
}

interface TimelineWeek {
  id: string;
  classId: string;
  timelineId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  label: string;
  title: string;
  description: string;
  phase: ProductionStage;
  status: 'PLANNED' | 'ONGOING' | 'DONE';
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt?: string;
}

type ViewMode = 'line' | 'table';

const PHASE_CONFIG: Record<ProductionStage, { label: string; color: string; bg: string; icon: string }> = {
  PERSIAPAN:   { label: 'Persiapan',   color: 'text-amber-700',   bg: 'bg-amber-100 border-amber-300',     icon: '📖' },
  PELAKSANAAN: { label: 'Pelaksanaan', color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-300',       icon: '🎨' },
  PERTUNJUKAN: { label: 'Pertunjukan', color: 'text-purple-700',  bg: 'bg-purple-100 border-purple-300',   icon: '⭐' },
  PASCA:       { label: 'Pasca',       color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300', icon: '🏁' },
};

const STATUS_CONFIG = {
  PLANNED: { label: 'Rencana',  color: 'bg-slate-100 text-slate-700 border-slate-300',        icon: Circle },
  ONGOING: { label: 'Berjalan', color: 'bg-blue-100 text-blue-700 border-blue-300',           icon: Play },
  DONE:    { label: 'Selesai',  color: 'bg-emerald-100 text-emerald-700 border-emerald-300',  icon: CheckCircle },
};

const CAN_MANAGE_CONFIG = ['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin', 'Pimpinan Produksi'];

// ═══════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════
function generateWeeksBetween(startDate: string, endDate: string) {
  const result: Array<{ start: string; end: string; num: number }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return result;

  let current = new Date(start);
  let num = 1;
  while (current <= end) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const actualEnd = weekEnd > end ? new Date(end) : weekEnd;
    result.push({
      start: weekStart.toISOString(),
      end: actualEnd.toISOString(),
      num,
    });
    current.setDate(current.getDate() + 7);
    num++;
    if (num > 200) break;
  }
  return result;
}

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

const fmtLong = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export const MasterTimelineModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [config, setConfig] = useState<TimelineConfig | null>(null);
  const [weeks, setWeeks] = useState<TimelineWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('line');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPhase, setFilterPhase] = useState<'ALL' | ProductionStage>('ALL');

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configTitle, setConfigTitle] = useState('Timeline Produksi Teater');
  const [configDesc, setConfigDesc] = useState('');
  const [configStart, setConfigStart] = useState('');
  const [configEnd, setConfigEnd] = useState('');
  const [submittingConfig, setSubmittingConfig] = useState(false);

  const [editingWeek, setEditingWeek] = useState<TimelineWeek | null>(null);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [weekTitle, setWeekTitle] = useState('');
  const [weekDesc, setWeekDesc] = useState('');
  const [weekPhase, setWeekPhase] = useState<ProductionStage>('PERSIAPAN');
  const [weekStatus, setWeekStatus] = useState<'PLANNED' | 'ONGOING' | 'DONE'>('PLANNED');
  const [submittingWeek, setSubmittingWeek] = useState(false);

  const canManageConfig = !!user && CAN_MANAGE_CONFIG.includes(user.role);
  const canEditWeeks = canManageConfig || (user?.role.startsWith('Koordinator ') ?? false) || user?.role === 'Sekretaris';

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'timelineConfigs'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) { setConfig(null); setLoading(false); }
      else setConfig({ ...snap.docs[0].data(), id: snap.docs[0].id } as TimelineConfig);
    });
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass || !config) { setWeeks([]); setLoading(false); return; }
    const q = query(
      collection(db, 'timelineWeeks'),
      where('classId', '==', activeClass.id),
      where('timelineId', '==', config.id)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as TimelineWeek));
      list.sort((a, b) => a.weekNumber - b.weekNumber);
      setWeeks(list);
      setLoading(false);
    });
    return () => unsub();
  }, [activeClass, config]);

  const openConfigModal = () => {
    if (config) {
      setConfigTitle(config.title);
      setConfigDesc(config.description || '');
      setConfigStart(config.startDate.slice(0, 10));
      setConfigEnd(config.endDate.slice(0, 10));
    } else {
      setConfigTitle('Timeline Produksi Teater');
      setConfigDesc('');
      setConfigStart('');
      setConfigEnd('');
    }
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!configStart || !configEnd) { showToast('Isi tanggal mulai & selesai.', 'warning'); return; }
    if (new Date(configStart) > new Date(configEnd)) {
      showToast('Tanggal mulai harus lebih awal dari tanggal selesai.', 'warning');
      return;
    }

    setSubmittingConfig(true);
    try {
      const configId = config?.id || doc(collection(db, 'timelineConfigs')).id;
      const newConfig: TimelineConfig = {
        id: configId,
        classId: activeClass.id,
        title: configTitle.trim() || 'Timeline Produksi Teater',
        description: configDesc.trim(),
        startDate: new Date(configStart).toISOString(),
        endDate: new Date(configEnd).toISOString(),
        createdBy: config?.createdBy || user.uid,
        creatorName: config?.creatorName || user.displayName,
        createdAt: config?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'timelineConfigs', configId), newConfig, { merge: true });

      const generated = generateWeeksBetween(configStart, configEnd);
      const existingNums = new Set(weeks.map(w => w.weekNumber));
      const batch = writeBatch(db);

      for (const gw of generated) {
        if (existingNums.has(gw.num)) continue;
        const weekId = `${configId}_w${gw.num}`;
        const newWeek: TimelineWeek = {
          id: weekId,
          classId: activeClass.id,
          timelineId: configId,
          weekNumber: gw.num,
          startDate: gw.start,
          endDate: gw.end,
          label: `Minggu ke-${gw.num}`,
          title: '',
          description: '',
          phase: 'PERSIAPAN',
          status: 'PLANNED',
          createdBy: user.uid,
          creatorName: user.displayName,
          createdAt: new Date().toISOString(),
        };
        batch.set(doc(db, 'timelineWeeks', weekId), newWeek);
      }

      for (const w of weeks) {
        if (w.weekNumber > generated.length && !w.title.trim()) {
          batch.delete(doc(db, 'timelineWeeks', w.id));
        }
      }

      await batch.commit();

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: config ? 'UPDATE' : 'CREATE',
        targetType: 'TimelineConfig', targetId: configId,
        details: `${config ? 'Update' : 'Buat'} timeline: ${newConfig.title} (${generated.length} minggu)`,
      });

      showToast(`Timeline disimpan! ${generated.length} minggu otomatis dibuat.`, 'success');
      setIsConfigModalOpen(false);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmittingConfig(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!config || !user) return;
    if (!confirm('Hapus timeline ini beserta semua minggu di dalamnya? Tidak bisa dibatalkan.')) return;
    try {
      const batch = writeBatch(db);
      weeks.forEach(w => batch.delete(doc(db, 'timelineWeeks', w.id)));
      batch.delete(doc(db, 'timelineConfigs', config.id));
      await batch.commit();
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'TimelineConfig', targetId: config.id,
        details: `Hapus timeline: ${config.title}`,
      });
      showToast('Timeline dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const openWeekModal = (week: TimelineWeek) => {
    if (!canEditWeeks) { showToast('Anda hanya bisa melihat timeline.', 'warning'); return; }
    setEditingWeek(week);
    setWeekTitle(week.title);
    setWeekDesc(week.description);
    setWeekPhase(week.phase);
    setWeekStatus(week.status);
    setIsWeekModalOpen(true);
  };

  const handleSaveWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWeek || !user) return;
    setSubmittingWeek(true);
    try {
      await updateDoc(doc(db, 'timelineWeeks', editingWeek.id), {
        title: weekTitle.trim(),
        description: weekDesc.trim(),
        phase: weekPhase,
        status: weekStatus,
        updatedAt: new Date().toISOString(),
      });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'TimelineWeek', targetId: editingWeek.id,
        details: `Update ${editingWeek.label}: ${weekTitle}`,
      });
      showToast(`${editingWeek.label} berhasil disimpan!`, 'success');
      setIsWeekModalOpen(false);
      setEditingWeek(null);
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmittingWeek(false);
    }
  };

  const filteredWeeks = weeks.filter(w => {
    if (filterPhase !== 'ALL' && w.phase !== filterPhase) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (w.title || '').toLowerCase().includes(q)
          || (w.description || '').toLowerCase().includes(q)
          || w.label.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: weeks.length,
    done: weeks.filter(w => w.status === 'DONE').length,
    ongoing: weeks.filter(w => w.status === 'ONGOING').length,
    filled: weeks.filter(w => w.title.trim()).length,
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs">Memuat timeline...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl border border-blue-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Flag className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Master Timeline
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                {config?.title || 'Timeline Produksi Teater'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {config
                  ? `${fmtLong(config.startDate)} — ${fmtLong(config.endDate)} (${weeks.length} minggu)`
                  : 'Atur periode produksi untuk memulai timeline mingguan'}
              </p>
            </div>
          </div>

          {canManageConfig && (
            <div className="flex items-center gap-2 flex-wrap">
              {config && (
                <>
                  <button onClick={openConfigModal}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" /> Ubah Periode
                  </button>
                  <button onClick={handleDeleteConfig}
                    className="px-3 py-2 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </>
              )}
              {!config && (
                <button onClick={openConfigModal}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
                  <PlusCircle className="w-4 h-4" /> Buat Timeline
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EMPTY STATE */}
      {!config && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-600">
          <Flag className="w-14 h-14 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Timeline Belum Dibuat</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            {canManageConfig
              ? 'Tentukan periode produksi (dari tanggal ke tanggal). Sistem akan otomatis membuat slot minggu-minggu yang tinggal Anda isi kegiatannya.'
              : 'Timeline belum diatur oleh pengurus. Tunggu info dari Pimpinan Produksi.'}
          </p>
          {canManageConfig && (
            <button onClick={openConfigModal}
              className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-md">
              <PlusCircle className="w-4 h-4" /> Buat Timeline Sekarang
            </button>
          )}
        </div>
      )}

      {config && (
        <>
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Minggu</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Selesai</p>
              <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{stats.done}</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 shadow-sm">
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">Berjalan</p>
              <p className="text-2xl font-black text-blue-800 dark:text-blue-200">{stats.ongoing}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">Sudah Diisi</p>
              <p className="text-2xl font-black text-amber-800 dark:text-amber-200">{stats.filled}/{stats.total}</p>
            </div>
          </div>

          {/* TOOLBAR */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold shrink-0">
              <button onClick={() => setViewMode('line')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${viewMode === 'line' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>
                <GitBranch className="w-3.5 h-3.5" /> Garis Timeline
              </button>
              <button onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>
                <List className="w-3.5 h-3.5" /> Tabel
              </button>
            </div>

            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input type="text" placeholder="Cari kegiatan atau minggu..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
              <option value="ALL">Semua Tahap</option>
              <option value="PERSIAPAN">📖 Persiapan</option>
              <option value="PELAKSANAAN">🎨 Pelaksanaan</option>
              <option value="PERTUNJUKAN">⭐ Pertunjukan</option>
              <option value="PASCA">🏁 Pasca</option>
            </select>
          </div>

          {/* INFO BANNER */}
          {canEditWeeks && stats.filled < stats.total && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>{stats.total - stats.filled} minggu</strong> belum diisi kegiatannya.
                Klik tiap kartu minggu untuk menambahkan judul kegiatan, tahapan, & status.
              </p>
            </div>
          )}

          {/* ═══ VIEW: GARIS TIMELINE ═══ */}
          {viewMode === 'line' && (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
              {filteredWeeks.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">Tidak ada minggu yang cocok dengan filter.</p>
              ) : (
                <div className="relative min-w-[900px] pb-4">
                  <div className="absolute top-[52px] left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-blue-400 to-emerald-400 rounded-full" />
                  <div className="relative grid" style={{ gridTemplateColumns: `repeat(${filteredWeeks.length}, minmax(140px, 1fr))`, gap: '12px' }}>
                    {filteredWeeks.map((w) => {
                      const phaseCfg = PHASE_CONFIG[w.phase];
                      const statusCfg = STATUS_CONFIG[w.status];
                      const StatusIcon = statusCfg.icon;
                      const isFilled = w.title.trim().length > 0;

                      return (
                        <div key={w.id} className="flex flex-col items-center">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center h-8 flex items-center">
                            {fmtShort(w.startDate)} — {fmtShort(w.endDate)}
                          </p>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-md z-10 ${
                            w.status === 'DONE' ? 'bg-emerald-500' :
                            w.status === 'ONGOING' ? 'bg-blue-500' :
                            isFilled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                          }`}>
                            {w.status === 'DONE' ? <CheckCircle className="w-4 h-4 text-white" /> :
                             w.status === 'ONGOING' ? <Play className="w-3.5 h-3.5 text-white" /> :
                             <span className="text-[10px] font-black text-white">{w.weekNumber}</span>}
                          </div>
                          <button onClick={() => openWeekModal(w)} disabled={!canEditWeeks}
                            className={`mt-3 w-full p-3 rounded-2xl border-2 text-left transition hover:shadow-md ${
                              !canEditWeeks ? 'cursor-default' : 'cursor-pointer hover:scale-105'
                            } ${
                              w.status === 'DONE' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40' :
                              w.status === 'ONGOING' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40' :
                              isFilled ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 border-dashed'
                            }`}>
                            <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                              <span className="text-[9px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">
                                {w.label}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${phaseCfg.bg} ${phaseCfg.color} border`}>
                                {phaseCfg.icon} {phaseCfg.label}
                              </span>
                            </div>
                            {isFilled ? (
                              <p className="text-[11px] font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                {w.title}
                              </p>
                            ) : (
                              <p className="text-[10px] italic text-slate-400 dark:text-slate-500">
                                Belum diisi — klik untuk isi kegiatan
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-1">
                              <StatusIcon className={`w-3 h-3 ${statusCfg.color.split(' ')[0]}`} />
                              <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">
                                {statusCfg.label}
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ VIEW: TABEL ═══ */}
          {viewMode === 'table' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              {filteredWeeks.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">Tidak ada minggu yang cocok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="py-3 px-3 text-center w-16">Minggu</th>
                        <th className="py-3 px-3 w-32">Periode</th>
                        <th className="py-3 px-3 w-28">Tahap</th>
                        <th className="py-3 px-3">Kegiatan</th>
                        <th className="py-3 px-3 w-28 text-center">Status</th>
                        {canEditWeeks && <th className="py-3 px-3 w-20 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredWeeks.map(w => {
                        const phaseCfg = PHASE_CONFIG[w.phase];
                        const statusCfg = STATUS_CONFIG[w.status];
                        const StatusIcon = statusCfg.icon;
                        return (
                          <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-3 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-xs shadow-sm">
                                {w.weekNumber}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                              {fmtShort(w.startDate)} — {fmtShort(w.endDate)}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${phaseCfg.bg} ${phaseCfg.color}`}>
                                {phaseCfg.icon} {phaseCfg.label}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {w.title.trim() ? (
                                <>
                                  <p className="font-bold text-slate-900 dark:text-white">{w.title}</p>
                                  {w.description && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 italic">
                                      {w.description}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <span className="text-[11px] italic text-slate-400 dark:text-slate-500">Belum diisi</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusCfg.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusCfg.label}
                              </span>
                            </td>
                            {canEditWeeks && (
                              <td className="py-3 px-3 text-right">
                                <button onClick={() => openWeekModal(w)}
                                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/20">
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ MODAL: CONFIG ═══ */}
      {isConfigModalOpen && canManageConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveConfig}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-500" />
                {config ? 'Ubah Periode Timeline' : 'Buat Timeline Baru'}
              </h3>
              <button type="button" onClick={() => setIsConfigModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <strong>Cara kerja:</strong> Pilih <strong>tanggal mulai</strong> & <strong>tanggal selesai</strong>.
                Sistem akan <strong>otomatis membuat slot minggu-minggu</strong>. Anda tinggal isi kegiatannya per minggu.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Timeline</label>
              <input type="text" value={configTitle} onChange={(e) => setConfigTitle(e.target.value)}
                placeholder="Contoh: Timeline Produksi Teater IX-C"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Mulai <span className="text-rose-500">*</span>
                </label>
                <input type="date" required value={configStart}
                  onChange={(e) => setConfigStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                {configStart && (
                  <p className="text-[10px] text-slate-500 mt-1">{fmtLong(configStart)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Selesai <span className="text-rose-500">*</span>
                </label>
                <input type="date" required value={configEnd}
                  onChange={(e) => setConfigEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                {configEnd && (
                  <p className="text-[10px] text-slate-500 mt-1">{fmtLong(configEnd)}</p>
                )}
              </div>
            </div>

            {configStart && configEnd && new Date(configStart) <= new Date(configEnd) && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                  📅 Akan dibuat <strong>{generateWeeksBetween(configStart, configEnd).length} minggu</strong>
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Dari {fmtLong(configStart)} sampai {fmtLong(configEnd)}.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi (Opsional)</label>
              <textarea rows={2} value={configDesc} onChange={(e) => setConfigDesc(e.target.value)}
                placeholder="Catatan umum timeline..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>

            {config && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  Mengubah periode akan <strong>menambah minggu baru</strong> jika diperpanjang.
                  Minggu lama yang sudah diisi <strong>tidak akan terhapus</strong>.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={submittingConfig}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {submittingConfig ? 'Menyimpan...' : (config ? 'Perbarui Timeline' : 'Buat Timeline')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ MODAL: WEEK EDIT ═══ */}
      {isWeekModalOpen && editingWeek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveWeek}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {editingWeek.label}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  Isi Kegiatan Minggu Ini
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  📅 {fmtShort(editingWeek.startDate)} — {fmtShort(editingWeek.endDate)}
                </p>
              </div>
              <button type="button" onClick={() => setIsWeekModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Kegiatan <span className="text-rose-500">*</span>
              </label>
              <input type="text" value={weekTitle} onChange={(e) => setWeekTitle(e.target.value)}
                placeholder="Contoh: Reading naskah & casting pemain"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi Kegiatan</label>
              <textarea rows={3} value={weekDesc} onChange={(e) => setWeekDesc(e.target.value)}
                placeholder="Detail kegiatan, PIC, hasil yang diharapkan..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Tahapan Produksi</label>
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map(s => {
                  const isSel = weekPhase === s.id;
                  const cfg = PHASE_CONFIG[s.id];
                  return (
                    <button key={s.id} type="button" onClick={() => setWeekPhase(s.id)}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold transition flex items-center gap-2 ${
                        isSel ? `${cfg.bg} ${cfg.color}` : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                      <span className="text-base">{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Status Kegiatan</label>
              <div className="grid grid-cols-3 gap-2">
                {(['PLANNED', 'ONGOING', 'DONE'] as const).map(st => {
                  const cfg = STATUS_CONFIG[st];
                  const Icon = cfg.icon;
                  const isSel = weekStatus === st;
                  return (
                    <button key={st} type="button" onClick={() => setWeekStatus(st)}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isSel ? cfg.color : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsWeekModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={submittingWeek}
                className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {submittingWeek ? 'Menyimpan...' : 'Simpan Kegiatan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};