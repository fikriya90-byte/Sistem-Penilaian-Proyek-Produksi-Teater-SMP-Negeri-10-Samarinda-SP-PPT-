import React, { useState, useEffect } from 'react';
import {
  Award, Printer, MessageSquare, CheckCircle, Clock, Target,
  BarChart3, Star, TrendingUp, Bot, EyeOff, Users, Shield,
  Sparkles, Info, Lock, Send, Download, MessageCircle,
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
import { AssessmentRecord, ProductionStage, UserProfile } from '../../core/types';
import {
  subscribeAssessments, fetchUsersByClass,
} from '../../services/firestoreService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

const CATEGORY_LABEL: Record<AssessorCategory, string> = {
  GURU: 'Guru Pengampu',
  ATASAN: 'Koordinator',
  REKAN: 'Rekan Kerja',
  BAWAHAN: 'Anggota Tim',
};

function getAssessorLabel(targetRole: string, category: AssessorCategory): string {
  if (category === 'GURU') return 'Guru Pengampu';
  const matrix = getAssessmentMatrix(targetRole);
  const rel = matrix.find(r => r.category === category);
  if (!rel || rel.roles.length === 0) {
    if (category === 'ATASAN') return 'Atasan Langsung';
    if (category === 'BAWAHAN') return 'Anggota Tim';
    return 'Rekan Kerja';
  }
  if (rel.roles.length === 1) return rel.roles[0];
  if (rel.roles.length <= 2) return rel.roles.join(' & ');
  return `${rel.roles[0]} & ${rel.roles.length - 1} lainnya`;
}

function buildWhatsAppUrl(phone: string, text: string): string {
  let clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  if (!clean) return '#';
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

export const MyGradeModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [classmates, setClassmates] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');

  // By-pass gate untuk guru/admin (mereka bebas lihat)
  const canBypassGate = isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!activeClass || !user) return;
    const unsub = subscribeAssessments(activeClass.id, (records) => {
      setAssessments(records);
      setLoading(false);
    });
    fetchUsersByClass(activeClass.id).then(setClassmates);
    return () => unsub();
  }, [activeClass, user]);

  useEffect(() => {
    if (!activeClass) return;
    const ref = collection(db, 'classes', activeClass.id, 'config');
    // Ambil currentStage
    const q = query(ref);
    const unsub = onSnapshot(q, () => { /* not used */ });
    return () => unsub();
  }, [activeClass]);

  // ============ STATUS PEER ASSESSMENT ============
  // Cek: apakah user sudah mengisi penilaian untuk semua orang yang jadi kewajibannya?
  const peerStatus = (() => {
    if (!user || classmates.length === 0) {
      return { total: 0, filled: 0, pending: 0, pct: 100, isComplete: true, targets: [] as UserProfile[] };
    }

    const matrix = getAssessmentMatrix(user.role);
    const targetRoles = new Set<string>();
    ['REKAN', 'BAWAHAN', 'ATASAN'].forEach(cat => {
      const rel = matrix.find(r => r.category === cat);
      if (rel) rel.roles.forEach(r => targetRoles.add(r));
    });

    const targets = classmates.filter(s =>
      s.uid !== user.uid &&
      targetRoles.has(s.role) &&
      s.role !== 'Guru Pengampu' && s.role !== 'Admin' && s.role !== 'Super Admin'
    );

    // Yang sudah dinilai = ada assessment dengan assessorId=user.uid, studentId=target.uid, stage=selectedStage
    const filled = targets.filter(t =>
      assessments.some(a =>
        a.assessorId === user.uid &&
        a.studentId === t.uid &&
        a.stage === selectedStage
      )
    ).length;

    const total = targets.length;
    const pending = total - filled;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 100;
    return { total, filled, pending, pct, isComplete: filled >= total, targets };
  })();

  const gateUnlocked = canBypassGate || peerStatus.isComplete || peerStatus.total === 0;

  // ============ SCORE CALCULATION ============
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

    let weights = { GURU: 0, ATASAN: 50, REKAN: 50, BAWAHAN: 0 };
    if (user?.role === 'Pimpinan Produksi' || user?.role === 'Sutradara') {
      weights = { GURU: 40, ATASAN: 0, REKAN: 20, BAWAHAN: 40 };
    } else if (user?.role === 'Sekretaris' || user?.role === 'Bendahara') {
      weights = { GURU: 0, ATASAN: 60, REKAN: 40, BAWAHAN: 0 };
    } else if (user?.role?.startsWith('Koordinator ')) {
      weights = { GURU: 0, ATASAN: 50, REKAN: 0, BAWAHAN: 50 };
    } else if (user?.role === 'Asisten Sutradara') {
      weights = { GURU: 0, ATASAN: 60, REKAN: 0, BAWAHAN: 40 };
    }

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

  // ============ DOWNLOAD REKAP PRIBADI ============
  const handleDownload = () => {
    if (!user) return;

    // Sheet 1: Ringkasan nilai per tahap
    const sheet1 = {
      name: 'Ringkasan',
      headers: ['Tahap', 'Nilai Tahap', 'Bobot'],
      rows: STAGES.map(s => [
        s.id,
        stageScores[s.id] ?? '-',
        `${s.defaultWeight}%`,
      ]),
    };

    // Sheet 2: Nilai akhir
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

    // Sheet 3: Rincian per kriteria
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
      headers: ['Kriteria', 'Bobot', 'Rata-rata Skor (1-4)', 'Konversi (0-100)', 'Sumber'],
      rows: allCriteria.map(c => {
        const arr = criteriaScores[c.key] || [];
        const avg = arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
        const converted = avg ? SCORE_SCALE[Math.round(avg)]?.score100 : '-';
        return [
          c.label,
          `${c.weight}%`,
          avg ? avg.toFixed(2) : '-',
          converted,
          c.source === 'MANUAL' ? 'Manual (Penilai)' : 'Otomatis (Sistem)',
        ];
      }),
    };

    // Sheet 4: Semua komentar
    const comments = myAssessments
      .filter(a => a.comment && a.comment.trim())
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const sheet4 = {
      name: 'Komentar',
      headers: ['Tanggal', 'Tahap', 'Kategori Penilai', 'Nilai', 'Komentar'],
      rows: comments.map(c => [
        new Date(c.createdAt || '').toLocaleString('id-ID'),
        c.stage,
        CATEGORY_LABEL[((c as any).assessorCategory as AssessorCategory) || 'REKAN'],
        c.totalScore,
        c.comment || '',
      ]),
    };

    exportMultiSheetXLSX(
      `Rapor_${user.displayName.replace(/\s+/g, '_')}_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.xls`,
      [sheet1, sheet2, sheet3, sheet4]
    );
    showToast('Rapor berhasil diunduh!', 'success');
  };

  const handlePrintPDF = () => {
    showToast('Dialog cetak dibuka. Pilih "Save as PDF".', 'info');
    setTimeout(() => window.print(), 300);
  };

  // ============ WA KE GURU ============
  const handleWAAskTeacher = () => {
    // Cari Guru Pengampu di kelas
    const guru = classmates.find(c =>
      c.role === 'Guru Pengampu' || c.role === 'Guru Pembina'
    );
    if (!guru?.phone) {
      showToast('Nomor WhatsApp Guru belum tersedia. Hubungi Guru langsung.', 'warning');
      return;
    }
    const text =
      `Halo Pak/Bu ${guru.displayName},\n\n` +
      `Saya ${user?.displayName} (${user?.role}) dari kelas ${activeClass?.name}.\n\n` +
      `Saya ingin *menanyakan/membahas nilai saya* di tahap ${selectedStage}.\n\n` +
      `Nilai akhir saya saat ini: ${finalScore} (${predikatInfo.predikat}).\n\n` +
      `Mohon arahan dan bimbingannya. Terima kasih 🙏`;
    window.open(buildWhatsAppUrl(guru.phone, text), '_blank', 'noopener,noreferrer');
  };

  // ============ RENDER ============
  if (loading) return <div className="p-12 text-center text-slate-400 text-xs">Memuat...</div>;

  if (!user) return null;

  // ============ GATE — Belum isi penilaian teman ============
  if (!gateUnlocked) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-300 dark:border-amber-500/40 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-500/20 border-4 border-amber-300 dark:border-amber-500/40 mb-4">
            <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-amber-900 dark:text-amber-200">
            Nilai Anda Belum Bisa Dibuka
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-3 leading-relaxed max-w-md mx-auto">
            Untuk menjaga keadilan penilaian 360°, <strong>Anda harus menyelesaikan penilaian rekan kerja Anda</strong> terlebih dahulu sebelum dapat melihat nilai Anda sendiri.
          </p>

          <div className="mt-5 p-4 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-amber-200 dark:border-amber-500/30 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                Progress Penilaian Anda
              </span>
              <span className="text-[11px] font-black text-amber-900 dark:text-amber-200">
                {peerStatus.filled}/{peerStatus.total}
              </span>
            </div>
            <div className="w-full h-3 bg-amber-100 dark:bg-amber-500/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
                style={{ width: `${peerStatus.pct}%` }}
              />
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2">
              Masih ada <strong>{peerStatus.pending} orang</strong> yang belum Anda nilai.
            </p>
          </div>

          <button
            onClick={() => {
              // Navigate ke penilaian (App.tsx akan handle)
              window.dispatchEvent(new CustomEvent('spppt-navigate', { detail: { module: 'nilai' } }));
            }}
            className="mt-5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-sm shadow-lg transition">
            <Star className="w-4 h-4 inline mr-2" />
            Isi Penilaian Rekan Sekarang
          </button>

          <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-3 italic">
            💡 Setelah selesai, buka kembali menu "Nilai Saya" untuk melihat hasilnya.
          </p>
        </div>

        {/* List target yang harus dinilai */}
        {peerStatus.targets.length > 0 && (
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              Daftar Orang yang Harus Anda Nilai
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {peerStatus.targets.map(t => {
                const isFilled = assessments.some(a =>
                  a.assessorId === user.uid && a.studentId === t.uid && a.stage === selectedStage
                );
                return (
                  <div key={t.uid} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    isFilled
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
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
                      isFilled
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}>
                      {isFilled ? '✓ Sudah' : 'Belum'}
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

  // ============ GATE PASSED — Tampilkan nilai ============
  if (!hasAnyScore) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto">
        <Award className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Nilai</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Nilai akan muncul setelah penilai mengisi formulir.
        </p>
      </div>
    );
  }

  const radarData = STAGES.map(s => ({
    stage: s.name.replace('Tahap ', '').replace(/^\d+:\s*/, ''),
    score: stageScores[s.id] || 0,
  }));

  const barData = STAGES.map(s => ({
    name: s.id.slice(0, 6),
    Nilai: stageScores[s.id] || 0,
  }));

  const categoryData = [
    { name: 'GURU', value: myAssessments.filter(a => (a as any).assessorCategory === 'GURU').length, color: '#F59E0B' },
    { name: 'ATASAN', value: myAssessments.filter(a => (a as any).assessorCategory === 'ATASAN').length, color: '#3B82F6' },
    { name: 'REKAN', value: myAssessments.filter(a => (a as any).assessorCategory === 'REKAN').length, color: '#10B981' },
    { name: 'BAWAHAN', value: myAssessments.filter(a => (a as any).assessorCategory === 'BAWAHAN').length, color: '#8B5CF6' },
  ].filter(d => d.value > 0);

  const comments = myAssessments
    .filter(a => a.comment && a.comment.trim())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

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
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-600 via-amber-700 to-orange-800 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-white/20 border border-white/30">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/30">
                Rapor Digital 360°
              </span>
              <h2 className="text-xl font-black text-white mt-1">Nilai Saya — {activeClass?.name || ''}</h2>
              <p className="text-xs text-amber-100 mt-0.5">
                {user?.displayName} • {user?.role}
                {user?.divisionName ? ` • ${user.divisionName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <button onClick={handleWAAskTeacher}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
              <MessageCircle className="w-4 h-4" /> Tanya Guru via WA
            </button>
            <button onClick={handleDownload}
              className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
              <Download className="w-4 h-4" /> Unduh Rapor
            </button>
            <button onClick={handlePrintPDF}
              className="px-4 py-2.5 rounded-xl bg-white text-amber-800 hover:bg-amber-50 font-bold text-xs flex items-center gap-2 shadow-lg">
              <Printer className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Gate indicator — kalau guru by-pass */}
        {canBypassGate && (
          <div className="mt-4 p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-amber-100 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            <span><strong>Mode Guru/Admin:</strong> melihat rapor tanpa gate peer assessment.</span>
          </div>
        )}
      </div>

      {/* SKOR AKHIR + RADAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-3xl border-2 shadow-md ${predikatInfo.color}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Nilai Akhir</p>
          <p className="text-5xl font-black mt-2 font-mono">{finalScore.toFixed(1)}</p>
          <p className="text-lg font-black mt-2">Predikat {predikatInfo.predikat}</p>
          <p className="text-xs mt-1 font-medium opacity-90">{predikatInfo.label}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm md:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-600" /> Grafik Radar 4 Tahapan
          </h3>
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

      {/* DISTRIBUSI PENILAI */}
      {categoryData.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Siapa yang Menilai Saya
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categoryData.map((cat, i) => {
              const label = getAssessorLabel(user.role, cat.name as AssessorCategory);
              return (
                <div key={i} className={`p-3 rounded-2xl border-2 ${getCategoryBadgeClass(cat.name as AssessorCategory)}`}>
                  <p className="text-[10px] font-bold uppercase opacity-80">{CATEGORY_LABEL[cat.name as AssessorCategory]}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{label}</p>
                  <p className="text-2xl font-black font-mono mt-1">{cat.value}</p>
                  <p className="text-[10px] opacity-70">penilaian</p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 italic flex items-center gap-1">
            <EyeOff className="w-3 h-3" />
            Penilaian dari rekan kerja & anggota tim ditampilkan sebagai rata-rata tanpa nama (anonim).
          </p>
        </div>
      )}

      {/* BAR CHART */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" /> Perbandingan Nilai Antar Tahapan
        </h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="Nilai" radius={[6, 6, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.Nilai >= 90 ? '#F59E0B' :
                    entry.Nilai >= 80 ? '#3B82F6' :
                    entry.Nilai >= 70 ? '#10B981' :
                    entry.Nilai >= 60 ? '#F97316' : '#EF4444'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RINCIAN KRITERIA */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Rincian Per Kriteria ({user.role === 'Pemeran' ? 'Pemeran' : 'Non-Pemeran'})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(user.role === 'Pemeran' ? PEMERAN_CRITERIA : GENERAL_CRITERIA).map(c => {
            const isAuto = c.source !== 'MANUAL';
            const arr = criteriaScores[c.key] || [];
            const avg = arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
            const colorClass =
              avg >= 3.5 ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10' :
              avg >= 2.5 ? 'border-blue-300 bg-blue-50 dark:bg-blue-500/10' :
              avg >= 1.5 ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10' :
              avg > 0 ? 'border-rose-300 bg-rose-50 dark:bg-rose-500/10' :
              'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
            return (
              <div key={c.key} className={`p-3 rounded-2xl border ${colorClass}`}>
                <div className="flex items-start justify-between mb-1 gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{c.label}</span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{c.weight}%</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  {isAuto ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center gap-0.5">
                      <Bot className="w-2.5 h-2.5" /> OTOMATIS
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      MANUAL
                    </span>
                  )}
                </div>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {avg > 0 ? avg.toFixed(1) : '-'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {avg > 0 ? `≈ ${SCORE_SCALE[Math.round(avg)]?.score100}` : 'Belum dinilai'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${
                    avg >= 3.5 ? 'bg-emerald-500' :
                    avg >= 2.5 ? 'bg-blue-500' :
                    avg >= 1.5 ? 'bg-amber-500' : 'bg-rose-500'
                  }`} style={{ width: `${(avg / 4) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KOMENTAR */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-600" /> Komentar dari Penilai ({comments.length})
        </h3>
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
                      <span className={`font-bold px-2 py-0.5 rounded-md border ${getCategoryBadgeClass(cat)}`}>
                        {CATEGORY_LABEL[cat]}
                      </span>
                      {shouldAnonymize ? (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Anonim
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          {c.assessorName}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-[10px]">
                      {new Date(c.createdAt || 0).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">"{c.comment}"</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Tahap: {c.stage} • Nilai: {c.totalScore}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer print */}
      <div className="hidden print:block text-center text-[10px] text-slate-500 pt-4 border-t">
        SP-PPT — SMP Negeri 10 Samarinda • T.A. 2025/2026 • Dicetak:{' '}
        {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
};