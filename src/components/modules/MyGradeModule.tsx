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
  getAssessmentMatrix, getAssessorWeights,
} from '../../core/constants';
import { AssessmentRecord, ProductionStage } from '../../core/types';
import { subscribeAssessments } from '../../services/firestoreService';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

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

function isAssessmentOpen(stageDeadlines: any, stageId: ProductionStage) {
  const cfg = stageDeadlines?.[stageId];
  if (!cfg) return { open: false, reason: 'no-config' as const };
  if (cfg.assessmentEnabled === false) return { open: false, reason: 'disabled' as const };
  const startMs = cfg.assessmentStart ? new Date(cfg.assessmentStart).getTime() : undefined;
  const endMs = cfg.assessmentEnd ? new Date(cfg.assessmentEnd).getTime() : undefined;
  const now = Date.now();
  if (startMs && !isNaN(startMs) && now < startMs) return { open: false, reason: 'not-started' as const, startMs, endMs };
  if (endMs && !isNaN(endMs) && now > endMs) return { open: false, reason: 'ended' as const, startMs, endMs };
  return { open: true, reason: 'open' as const, startMs, endMs };
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WITA';
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

  // Subscribe stage config untuk gate waktu penilaian
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

  // Load classmates untuk cek peer status
  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'users'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setClassmates(snap.docs.map(d => ({ ...d.data(), uid: d.id })));
    });
    return () => unsub();
  }, [activeClass]);

  // ============ PEER GATE ============
  const peerStatus = (() => {
    if (!user || classmates.length === 0) {
      return { total: 0, filled: 0, pending: 0, pct: 100, isComplete: true, targets: [] as any[] };
    }
    const matrix = getAssessmentMatrix(user.role);
    const targetRoles = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(cat => {
      const rel = matrix.find(r => r.category === cat);
      if (rel) rel.roles.forEach(r => targetRoles.add(r));
    });
    const targets = classmates.filter(s =>
      s.uid !== user.uid && targetRoles.has(s.role) &&
      s.role !== 'Guru Pengampu' && s.role !== 'Guru Pembina' && s.role !== 'Admin' && s.role !== 'Super Admin'
    );
    const filled = targets.filter(t =>
      assessments.some(a => a.assessorId === user.uid && a.studentId === t.uid && a.stage === selectedStage)
    ).length;
    const total = targets.length;
    return { total, filled, pending: total - filled, pct: total > 0 ? Math.round((filled / total) * 100) : 100, isComplete: filled >= total, targets };
  })();

  const peerGateUnlocked = canBypassGate || peerStatus.isComplete || peerStatus.total === 0;

  // ============ WAKTU PENILAIAN GATE ============
  const assessmentStatus = isAssessmentOpen(stageConfig?.stageDeadlines, selectedStage);
  const assessmentTimeOpen = canBypassGate || assessmentStatus.open;

  // Nilai user
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
    const avg = (arr: AssessmentRecord[]) => arr.length > 0 ? arr.reduce((s, a) => s + a.totalScore, 0) / arr.length : null;
    let weights = { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 };
    if (user?.role === 'Pimpinan Produksi' || user?.role === 'Sutradara') weights = { GURU: 40, ATASAN: 0, REKAN: 20, BAWAHAN: 40 };
    else if (user?.role === 'Sekretaris' || user?.role === 'Bendahara') weights = { GURU: 0, ATASAN: 60, REKAN: 40, BAWAHAN: 0 };
    else if (user?.role?.startsWith('Koordinator ')) weights = { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 };
    else if (user?.role === 'Asisten Sutradara') weights = { GURU: 0, ATASAN: 60, REKAN: 0, BAWAHAN: 40 };
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

  // ✅ DOWNLOAD — hanya data milik sendiri (filter sudah pakai user.uid)
  const handleDownload = () => {
    if (!user) return;
    const sheet1 = {
      name: 'Ringkasan',
      headers: ['Tahap', 'Nilai Tahap', 'Bobot'],
      rows: STAGES.map(s => [s.id, stageScores[s.id] ?? '-', `${s.defaultWeight}%`]),
    };
    const sheet2 = {
      name: 'Nilai Akhir',
      headers: ['Field', 'Nilai'],
      rows: [
        ['Nama', user.displayName],
        ['Peran', user.role],
        ['Divisi', user.divisionName || '-'],
        ['Kelas', activeClass?.name || '-'],
        ['Nilai Akhir', finalScore],
        ['Predikat', predikatInfo.predikat],
        ['Keterangan', predikatInfo.label],
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
    const allCriteria = user.role === 'Pemeran' ? PEMERAN_CRITERIA : GENERAL_CRITERIA;
    const sheet3 = {
      name: 'Rincian Kriteria',
      headers: ['Kriteria', 'Bobot', 'Rata-rata (1-4)', 'Konversi (0-100)', 'Sumber'],
      rows: allCriteria.map(c => {
        const arr = criteriaScores[c.key] || [];
        const avg = arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
        return [c.label, `${c.weight}%`, avg ? avg.toFixed(2) : '-', avg ? SCORE_SCALE[Math.round(avg)]?.score100 : '-', c.source === 'MANUAL' ? 'Manual' : 'Otomatis'];
      }),
    };
    const comments = myAssessments.filter(a => a.comment && a.comment.trim()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const sheet4 = {
      name: 'Komentar',
      headers: ['Tanggal', 'Tahap', 'Kategori', 'Nilai', 'Komentar'],
      rows: comments.map(c => [new Date(c.createdAt || '').toLocaleString('id-ID'), c.stage, CATEGORY_LABEL[((c as any).assessorCategory as AssessorCategory) || 'REKAN'], c.totalScore, c.comment || '']),
    };
    exportMultiSheetXLSX(`Rapor_${user.displayName.replace(/\s+/g, '_')}_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.xls`, [sheet1, sheet2, sheet3, sheet4]);
    showToast('Rapor berhasil diunduh!', 'success');
  };

  const handleWAAskTeacher = () => {
    const guru = classmates.find(c => c.role === 'Guru Pengampu' || c.role === 'Guru Pembina');
    if (!guru?.phone) { showToast('Nomor WhatsApp Guru belum tersedia.', 'warning'); return; }
    const text =
      `Halo Pak/Bu ${guru.displayName},\n\n` +
      `Saya ${user?.displayName} (${user?.role}) dari kelas ${activeClass?.name}.\n\n` +
      `Saya ingin *menanyakan/membahas nilai saya* di tahap ${selectedStage}.\n\n` +
      `Nilai akhir saya saat ini: ${finalScore} (${predikatInfo.predikat}).\n\n` +
      `Mohon arahan dan bimbingannya. Terima kasih 🙏`;
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
                  <div key={t.uid} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    isFilled ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isFilled ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {isFilled ? <CheckCircle className="w-3.5 h-3.5" /> : t.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.displayName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.role}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isFilled ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}>
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
        <div className={`p-8 rounded-3xl border-2 text-center ${
          assessmentStatus.reason === 'not-started'
            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border-blue-300 dark:border-blue-500/40'
            : 'bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-500/10 dark:to-orange-500/10 border-rose-300 dark:border-rose-500/40'
        }`}>
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-4 mb-4 ${
            assessmentStatus.reason === 'not-started'