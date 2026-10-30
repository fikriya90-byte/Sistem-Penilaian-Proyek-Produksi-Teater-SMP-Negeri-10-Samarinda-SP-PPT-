import React, { useState, useEffect } from 'react';
import {
  Award, Printer, MessageSquare, CheckCircle, Clock, Target,
  BarChart3, Star, TrendingUp, Bot, EyeOff, Users, Shield,
  Sparkles, Info, Lock, Send, Download, MessageCircle, AlertCircle,
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell,
} from 'recharts';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  PEMERAN_CRITERIA, GENERAL_CRITERIA, SCORE_SCALE, STAGES, getPredikat,
  getAssessmentMatrix, getAssessorWeights, normalizeUserRole,
  isPemeranRole, canRoleAssessTarget,
} from '../../core/constants';
import { AssessmentRecord, ProductionStage } from '../../core/types';
import { subscribeAssessments } from '../../services/firestoreService';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

// ✅ FIX: Definisikan tipe dengan aman
type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

const CATEGORY_LABEL: Record<AssessorCategory, string> = {
  GURU: 'Guru Pengampu',
  ATASAN: 'Koordinator',
  REKAN: 'Rekan Kerja',
  BAWAHAN: 'Anggota Tim',
};

function buildWhatsAppUrl(phone: string, text: string): string {
  let clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  return clean ? `https://wa.me/${clean}?text=${encodeURIComponent(text)}` : '#';
}

function buildISOFromParts(dateStr: string, timeStr: string): string {
  if (!dateStr) return '';
  const t = timeStr || '00:00';
  try { return new Date(`${dateStr}T${t}:00`).toISOString(); } catch { return ''; }
}

function isAssessmentOpen(stageDeadlines: any, stageId: ProductionStage) {
  const cfg = stageDeadlines?.[stageId];
  if (!cfg) return { open: false, reason: 'no-config' as const };

  const isEnabled = cfg.assessmentEnabled === true || cfg.assessmentEnabled === 'true';
  if (!isEnabled) return { open: false, reason: 'disabled' as const };

  let startMs: number | undefined;
  let endMs: number | undefined;

  if (cfg.assessmentStartDate) {
    const iso = buildISOFromParts(cfg.assessmentStartDate, cfg.assessmentStartTime || '00:00');
    if (iso) startMs = new Date(iso).getTime();
  } else if (cfg.assessmentStart) {
    const ms = new Date(cfg.assessmentStart).getTime();
    if (!isNaN(ms)) startMs = ms;
  }

  if (cfg.assessmentEndDate) {
    const iso = buildISOFromParts(cfg.assessmentEndDate, cfg.assessmentEndTime || '23:59');
    if (iso) endMs = new Date(iso).getTime();
  } else if (cfg.assessmentEnd) {
    const ms = new Date(cfg.assessmentEnd).getTime();
    if (!isNaN(ms)) endMs = ms;
  }

  const now = Date.now();
  if (startMs && !isNaN(startMs) && now < startMs) return { open: false, reason: 'not-started' as const, startMs, endMs };
  if (endMs && !isNaN(endMs) && now > endMs) return { open: false, reason: 'ended' as const, startMs, endMs };
  return { open: true, reason: 'open' as const, startMs, endMs };
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' WITA';
  } catch { return '-'; }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 detik';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit`;
  return `${Math.floor(ms / 1000)} detik`;
}

export const MyGradeModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [classmates, setClassmates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [stageConfig, setStageConfig] = useState<any>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const canBypassGate = isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!activeClass || !user) return;
    const unsub = subscribeAssessments(activeClass.id, (records) => {
      setAssessments(records);
      setLoading(false);
    });
    return () => unsub();
  }, [activeClass, user]);

  useEffect(() => {
    if (!activeClass) return;
    const ref = doc(db, 'classes', activeClass.id, 'config', 'stageManager');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data();
        setStageConfig(data);
        if (data.currentStage) setSelectedStage(data.currentStage);
      }
    });
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'users'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const users = snap.docs.map(d => {
        const raw = { ...d.data(), uid: d.id };
        return { ...raw, role: normalizeUserRole(raw.role) };
      });
      setClassmates(users);
    });
    return () => unsub();
  }, [activeClass]);

  // ============================================================
  // PEER GATE LOGIC
  // ============================================================
  const peerStatus = (() => {
    if (!user || classmates.length === 0) {
      return { total: 0, filled: 0, pending: 0, pct: 100, isComplete: true, targets: [] as any[] };
    }

    const targets = classmates.filter(s => {
      if (s.uid === user.uid) return false;
      if (['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'].includes(s.role)) return false;
      return canRoleAssessTarget(s.role, user.role);
    });

    const filled = targets.filter(t =>
      assessments.some(a =>
        a.assessorId === user.uid &&
        a.studentId === t.uid &&
        a.stage === selectedStage
      )
    ).length;

    const total = targets.length;
    return {
      total, filled, pending: total - filled,
      pct: total > 0 ? Math.round((filled / total) * 100) : 100,
      isComplete: filled >= total, targets,
    };
  })();

  const peerGateUnlocked = canBypassGate || peerStatus.isComplete || peerStatus.total === 0;

  // ============ WAKTU PENILAIAN GATE ============
  const assessmentStatus = isAssessmentOpen(stageConfig?.stageDeadlines, selectedStage);
  const assessmentTimeOpen = canBypassGate || assessmentStatus.open;

  const myAssessments = assessments.filter(a => a.studentId === user?.uid);

  const getStageScore = (stage: ProductionStage) => {
    const stageRecords = myAssessments.filter(a => a.stage === stage);
    if (stageRecords.length === 0) return null;
    const byCat: Record<string, AssessmentRecord[]> = {};
    stageRecords.forEach(r => {
      const cat = (r as any).assessorCategory || 'REKAN';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(r);
    });
    const avg = (arr: AssessmentRecord[]) =>
      arr.length > 0 ? arr.reduce((s, a) => s + a.totalScore, 0) / arr.length : null;

    const weights = getAssessorWeights(normalizeUserRole(user?.role));

    let sum = 0, wSum = 0;
    Object.entries(weights).forEach(([cat, w]) => {
      const catScore = byCat[cat] ? avg(byCat[cat]) : null;
      if (catScore !== null && w > 0) { sum += catScore * w; wSum += w; }
    });
    return wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
  };

  const stageScores: Record<ProductionStage, number | null> = {
    PERSIAPAN: getStageScore('PERSIAPAN'),
    PELAKSANAAN: getStageScore('PELAKSANAAN'),
    PERTUNJUKAN: getStageScore('PERTUNJUKAN'),
    PASCA: getStageScore('PASCA'),
  };

  const computeFinal = () => {
    let sum = 0, wTotal = 0;
    STAGES.forEach(s => {
      const sc = stageScores[s.id];
      if (sc !== null) { sum += sc * (s.defaultWeight / 100); wTotal += s.defaultWeight / 100; }
    });
    return wTotal > 0 ? Math.round((sum / wTotal) * 10) / 10 : 0;
  };

  const finalScore = computeFinal();
  const predikatInfo = getPredikat(finalScore);
  const hasAnyScore = Object.values(stageScores).some(s => s !== null);

  const isActor = isPemeranRole(user?.role);
  const allCriteria = isActor ? PEMERAN_CRITERIA : GENERAL_CRITERIA;

  const handleDownload = () => {
    if (!user) return;
    const sheet1 = {
      name: 'Ringkasan', headers: ['Tahap', 'Nilai Tahap', 'Bobot'],
      rows: STAGES.map(s => [s.id, stageScores[s.id] ?? '-', `${s.defaultWeight}%`]),
    };
    const sheet2 = {
      name: 'Nilai Akhir', headers: ['Field', 'Nilai'],
      rows: [
        ['Nama', user.displayName], ['Peran', user.role], ['Divisi', user.divisionName || '-'],
        ['Kelas', activeClass?.name || '-'], ['Nilai Akhir', finalScore],
        ['Predikat', predikatInfo.predikat], ['Keterangan', predikatInfo.label],
        ['Tanggal Unduh', new Date().toLocaleString('id-ID')],
      ],
    };
    const criteriaScores: Record<string, number[]> = {};
    myAssessments.forEach(a => {
      Object.entries(a.scores || {}).forEach(([k, v]) => {
        if (!criteriaScores[k]) criteriaScores[k] = [];
        criteriaScores[k].push(v);
      });
    });
    const sheet3 = {
      name: 'Rincian Kriteria', headers: ['Kriteria', 'Bobot', 'Rata-rata (1-4)', 'Konversi (0-100)', 'Sumber'],
      rows: allCriteria.map(c => {
        const arr = criteriaScores[c.key] || [];
        const avg = arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
        return [c.label, `${c.weight}%`, avg ? avg.toFixed(2) : '-', avg ? SCORE_SCALE[Math.round(avg)]?.score100 : '-', c.source === 'MANUAL' ? 'Manual' : 'Otomatis'];
      }),
    };
    const comments = myAssessments.filter(a => a.comment && a.comment.trim()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const sheet4 = {
      name: 'Komentar', headers: ['Tanggal', 'Tahap', 'Kategori', 'Nilai', 'Komentar'],
      rows: comments.map(c => [new Date(c.createdAt || '').toLocaleString('id-ID'), c.stage, CATEGORY_LABEL[((c as any).assessorCategory as AssessorCategory) || 'REKAN'], c.totalScore, c.comment || '']),
    };
    exportMultiSheetXLSX(`Rapor_${user.displayName.replace(/\s+/g, '_')}_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.xls`, [sheet1, sheet2, sheet3, sheet4]);
    showToast('Rapor berhasil diunduh!', 'success');
  };

  const handleWAAskTeacher = () => {
    const guru = classmates.find(c => c.role === 'Guru Pengampu' || c.role === 'Guru Pembina');
    if (!guru?.phone) { showToast('Nomor WhatsApp Guru belum tersedia.', 'warning'); return; }
    const text = `Halo Pak/Bu ${guru.displayName},\n\nSaya ${user?.displayName} (${user?.role}) dari kelas ${activeClass?.name}.\n\nSaya ingin *menanyakan/membahas nilai saya* di tahap ${selectedStage}.\n\nNilai akhir saya saat ini: ${finalScore} (${predikatInfo.predikat}).\n\nMohon arahan dan bimbingannya. Terima kasih 🙏`;
    window.open(buildWhatsAppUrl(guru.phone, text), '_blank', 'noopener,noreferrer');
  };

  if (loading) return <div className="p-12 text-center text-slate-400 text-xs">Memuat...</div>;
  if (!user) return null;

  // ============ GATE 1: PEER ASSESSMENT ============
  if (!peerGateUnlocked) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-300 dark:border-amber-500/40 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-500/20 border-4 border-amber-300 dark:border-amber-500/40 mb-4">
            <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-amber-900 dark:text-amber-200">Nilai Anda Belum Bisa Dibuka</h2>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-3 leading-relaxed max-w-md mx-auto">
            Untuk menjaga keadilan penilaian 360°, <strong>Anda harus menyelesaikan penilaian rekan kerja</strong> terlebih dahulu sebelum melihat nilai sendiri.
          </p>

          <div className="mt-5 p-4 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-amber-200 dark:border-amber-500/30 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">Progress Penilaian Anda</span>
              <span className="text-[11px] font-black text-amber-900 dark:text-amber-200">{peerStatus.filled}/{peerStatus.total}</span>
            </div>
            <div className="w-full h-3 bg-amber-100 dark:bg-amber-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all" style={{ width: `${peerStatus.pct}%` }} />
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2">
              Masih ada <strong>{peerStatus.pending} orang</strong> yang belum Anda nilai.
            </p>
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent('spppt-navigate', { detail: { module: 'nilai' } }))}
            className="mt-5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-sm shadow-lg transition flex items-center gap-2 mx-auto"
          >
            <Star className="w-4 h-4" /> Isi Penilaian Rekan Sekarang
          </button>
        </div>

        {peerStatus.targets.length > 0 && (
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" /> Daftar Orang yang Harus Anda Nilai
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {peerStatus.targets.map(t => {
                const isFilled = assessments.some(a => a.assessorId === user.uid && a.studentId === t.uid && a.stage === selectedStage);
                return (
                  <div key={t.uid} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isFilled ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${isFilled ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {isFilled ? <CheckCircle className="w-3.5 h-3.5" /> : t.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.displayName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.role}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isFilled ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
                      {isFilled ? 'Sudah' : 'Belum'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ GATE 2: WAKTU PENILAIAN ============
  if (!assessmentTimeOpen) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className={`p-8 rounded-3xl border-2 text-center ${assessmentStatus.reason === 'not-started' ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border-blue-300 dark:border-blue-500/40' : 'bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-500/10 dark:to-orange-500/10 border-rose-300 dark:border-rose-500/40'}`}>
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-4 mb-4 ${assessmentStatus.reason === 'not-started' ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40' : 'bg-rose-100 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500/40'}`}>
            {assessmentStatus.reason === 'not-started' ? <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400" /> : <Lock className="w-10 h-10 text-rose-600 dark:text-rose-400" />}
          </div>
          <h2 className={`text-xl font-black ${assessmentStatus.reason === 'not-started' ? 'text-blue-900 dark:text-blue-200' : 'text-rose-900 dark:text-rose-200'}`}>
            {assessmentStatus.reason === 'not-started' ? 'Waktu Penilaian Belum Dibuka' : assessmentStatus.reason === 'ended' ? 'Waktu Penilaian Sudah Ditutup' : 'Penilaian Tahap Ini Dinonaktifkan'}
          </h2>
          <p className={`text-xs mt-3 leading-relaxed max-w-md mx-auto ${assessmentStatus.reason === 'not-started' ? 'text-blue-800 dark:text-blue-300' : 'text-rose-800 dark:text-rose-300'}`}>
            {assessmentStatus.reason === 'not-started' && assessmentStatus.startMs ? (
              <>Penilaian untuk tahap <strong>{selectedStage}</strong> akan dibuka dalam <strong>{formatDuration(assessmentStatus.startMs - Date.now())}</strong>.<br />Tepat pada: <strong>{formatDateTime(new Date(assessmentStatus.startMs).toISOString())}</strong></>
            ) : assessmentStatus.reason === 'ended' && assessmentStatus.endMs ? (
              <>Penilaian tahap <strong>{selectedStage}</strong> sudah ditutup pada <strong>{formatDateTime(new Date(assessmentStatus.endMs).toISOString())}</strong>. Nilai rapor Anda tetap bisa diunduh setelah tahap berikutnya dibuka.</>
            ) : (
              <>Guru menonaktifkan penilaian untuk tahap <strong>{selectedStage}</strong>.</>
            )}
          </p>

          <div className={`mt-5 p-4 rounded-2xl bg-white/70 dark:bg-slate-800/70 border max-w-md mx-auto ${assessmentStatus.reason === 'not-started' ? 'border-blue-200 dark:border-blue-500/30' : 'border-rose-200 dark:border-rose-500/30'}`}>
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Info Tahap Aktif</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Tahap aktif kelas Anda: <strong className="text-slate-900 dark:text-white">{stageConfig?.currentStage || '-'}</strong></p>
          </div>
        </div>
      </div>
    );
  }

  // ============ TAMPIL NILAI ============
  if (!hasAnyScore) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto">
        <Award className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Nilai</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Nilai akan muncul setelah penilai mengisi formulir.</p>
      </div>
    );
  }

  const radarData = STAGES.map(s => ({ stage: s.name.replace('Tahap ', '').replace(/^\d+:\s*/, ''), score: stageScores[s.id] || 0 }));
  const barData = STAGES.map(s => ({ name: s.id.slice(0, 6), Nilai: stageScores[s.id] || 0 }));

  const categoryData = [
    { name: 'GURU', value: myAssessments.filter(a => (a as any).assessorCategory === 'GURU').length, color: '#F59E0B' },
    { name: 'ATASAN', value: myAssessments.filter(a => (a as any).assessorCategory === 'ATASAN').length, color: '#3B82F6' },
    { name: 'REKAN', value: myAssessments.filter(a => (a as any).assessorCategory === 'REKAN').length, color: '#10B981' },
    { name: 'BAWAHAN', value: myAssessments.filter(a => (a as any).assessorCategory === 'BAWAHAN').length, color: '#8B5CF6' },
  ].filter(d => d.value > 0);

  const comments = myAssessments.filter(a => a.comment && a.comment.trim()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const criteriaScores: Record<string, number[]> = {};
  myAssessments.forEach(a => {
    Object.entries(a.scores || {}).forEach(([k, v]) => {
      if (!criteriaScores[k]) criteriaScores[k] = [];
      criteriaScores[k].push(v);
    });
  });

  const getCategoryBadgeClass = (cat: AssessorCategory) => {
    const map: Record<AssessorCategory, string> = {
      GURU: 'bg-amber-100 text-amber-800 border-amber-300',
      ATASAN: 'bg-blue-100 text-blue-800 border-blue-300',
      REKAN: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      BAWAHAN: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return map[cat];
  };

  return (
    <div className="space-y-6" id="rapor-container">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-600 via-amber-700 to-orange-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-white/20 border border-white/30"><Award className="w-7 h-7" /></span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/30">Rapor Digital 360°</span>
              <h2 className="text-xl font-black text-white mt-1">Nilai Saya — {activeClass?.name || ''}</h2>
              <p className="text-xs text-amber-100 mt-0.5">{user?.displayName} • {user?.role}{user?.divisionName ? ` • ${user.divisionName}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <button onClick={handleWAAskTeacher} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg"><MessageCircle className="w-4 h-4" /> Tanya Guru</button>
            <button onClick={handleDownload} className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg"><Download className="w-4 h-4" /> Unduh Rapor</button>
            <button onClick={() => setTimeout(() => window.print(), 300)} className="px-4 py-2.5 rounded-xl bg-white text-amber-800 hover:bg-amber-50 font-bold text-xs flex items-center gap-2 shadow-lg"><Printer className="w-4 h-4" /> PDF</button>
          </div>
        </div>
        {canBypassGate && (
          <div className="mt-4 p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-amber-100 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /><span><strong>Mode Guru/Admin:</strong> melihat rapor tanpa gate.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-3xl border-2 shadow-md ${predikatInfo.color}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Nilai Akhir</p>
          <p className="text-5xl font-black mt-2 font-mono">{finalScore.toFixed(1)}</p>
          <p className="text-lg font-black mt-2">Predikat {predikatInfo.predikat}</p>
          <p className="text-xs mt-1 font-medium opacity-90">{predikatInfo.label}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm md:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2"><Target className="w-4 h-4 text-amber-600" /> Grafik Radar 4 Tahapan</h3>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="stage" tick={{ fontSize: 10, fill: '#475569' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} />
                <Radar name="Nilai" dataKey="score" stroke="#D97706" fill="#F59E0B" fillOpacity={0.5} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {categoryData.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Siapa yang Menilai Saya</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categoryData.map((cat, i) => (
              <div key={i} className={`p-3 rounded-2xl border-2 ${getCategoryBadgeClass(cat.name as AssessorCategory)}`}>
                <p className="text-[10px] font-bold uppercase opacity-80">{CATEGORY_LABEL[cat.name as AssessorCategory]}</p>
                <p className="text-2xl font-black font-mono mt-1">{cat.value}</p>
                <p className="text-[10px] opacity-70">penilaian</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 italic flex items-center gap-1"><EyeOff className="w-3 h-3" /> Penilaian rekan kerja & anggota tim ditampilkan anonim.</p>
        </div>
      )}

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-600" /> Perbandingan Nilai Antar Tahapan</h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="Nilai" radius={[6, 6, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.Nilai >= 90 ? '#F59E0B' : entry.Nilai >= 80 ? '#3B82F6' : entry.Nilai >= 70 ? '#10B981' : entry.Nilai >= 60 ? '#F97316' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Rincian Per Kriteria</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allCriteria.map(c => {
            const isAuto = c.source !== 'MANUAL';
            const arr = criteriaScores[c.key] || [];
            const avg = arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
            const colorClass = avg >= 3.5 ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10' : avg >= 2.5 ? 'border-blue-300 bg-blue-50 dark:bg-blue-500/10' : avg >= 1.5 ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10' : avg > 0 ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
            return (
              <div key={c.key} className={`p-3 rounded-2xl border ${colorClass}`}>
                <div className="flex items-start justify-between mb-1 gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{c.label}</span>
                  <span className="text-[10px] font-bold text-slate-500 shrink-0">{c.weight}%</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  {isAuto ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center gap-0.5"><Bot className="w-2.5 h-2.5" /> OTOMATIS</span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">MANUAL</span>
                  )}
                </div>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{avg > 0 ? avg.toFixed(1) : '-'}</span>
                  <span className="text-[10px] text-slate-500">{avg > 0 ? `≈ ${SCORE_SCALE[Math.round(avg)]?.score100}` : 'Belum dinilai'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-purple-600" /> Komentar dari Penilai ({comments.length})</h3>
        {comments.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">Belum ada komentar.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {comments.map(c => {
              const cat = ((c as any).assessorCategory as AssessorCategory) || 'REKAN';
              const shouldAnonymize = cat === 'BAWAHAN' || cat === 'REKAN';
              return (
                <div key={c.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between text-[11px] mb-1 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold px-2 py-0.5 rounded-md border ${getCategoryBadgeClass(cat)}`}>{CATEGORY_LABEL[cat]}</span>
                      {shouldAnonymize ? (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Anonim</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{c.assessorName}</span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[10px]">{new Date(c.createdAt || 0).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">"{c.comment}"</p>
                  <p className="text-[10px] text-slate-400 mt-1">Tahap: {c.stage} • Nilai: {c.totalScore}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden print:block text-center text-[10px] text-slate-500 pt-4 border-t">
        SP-PPT — SMP Negeri 10 Samarinda • T.A. 2025/2026 • Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
};