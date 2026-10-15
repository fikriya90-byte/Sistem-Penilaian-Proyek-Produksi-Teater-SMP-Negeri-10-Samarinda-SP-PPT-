import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Download, Printer, Search, Filter, Users, Award,
  TrendingUp, AlertTriangle, RefreshCw, CheckCircle, XCircle,
  Clock, Star, ChevronDown, ChevronRight, FileSpreadsheet, Target,
  Layers, Calendar, Info,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  STAGES, getPredikat, SCORE_SCALE, getAssessorWeights,
  normalizeUserRole, isPemeranRole,
} from '../../core/constants';
import {
  AssessmentRecord, UserProfile, AttendanceRecord, AttendanceSession,
  ProductionStage,
} from '../../core/types';
import {
  fetchUsersByClass, subscribeAssessments, subscribeAttendanceSessions,
  subscribeAllAttendanceRecords, subscribeDeadlinesByClass,
  subscribeDeadlineSubmissionsByClass,
} from '../../services/firestoreService';
import { exportMultiSheetXLSX } from '../../utils/exportXLSX';

type AssessorCategory = 'GURU' | 'ATASAN' | 'REKAN' | 'BAWAHAN';

const CATEGORY_LABEL: Record<AssessorCategory, string> = {
  GURU: 'Guru Pengampu',
  ATASAN: 'Koordinator',
  REKAN: 'Rekan Kerja',
  BAWAHAN: 'Anggota Tim',
};

const STAGE_LABEL: Record<ProductionStage, string> = {
  PERSIAPAN: 'Persiapan',
  PELAKSANAAN: 'Pelaksanaan',
  PERTUNJUKAN: 'Pertunjukan',
  PASCA: 'Pasca',
};

// =====================================================
// TIPE DATA HASIL KOMPUTASI
// =====================================================
interface StageDetail {
  stageScore: number | null;      // nilai tahap (0-100) atau null kalau belum ada
  categoryAvg: Record<AssessorCategory, number | null>;  // rata-rata per kategori
  assessmentCount: number;        // jumlah penilaian
  attendance: {
    totalSessions: number;
    hadir: number;
    izin: number;
    sakit: number;
    alpa: number;
    pct: number;
  };
  task: {
    totalTasks: number;
    tepatWaktu: number;
    terlambat: number;
    belum: number;
    pctOnTime: number;
  };
}

interface StudentRecap {
  user: UserProfile;
  perStage: Record<ProductionStage, StageDetail>;
  finalScore: number;
  finalPredikat: { predikat: 'A'|'B'|'C'|'D'|'E'; label: string; color: string };
  stagesWithData: number;
}

// =====================================================
// HELPER: hitung nilai tahap dari catatan penilaian
// =====================================================
function computeStageScore(
  assessments: AssessmentRecord[],
  studentId: string,
  stage: ProductionStage,
  studentRole: string
): { score: number | null; categoryAvg: Record<AssessorCategory, number | null>; count: number } {
  const recs = assessments.filter(a => a.studentId === studentId && a.stage === stage);
  const categoryAvg: Record<AssessorCategory, number | null> = {
    GURU: null, ATASAN: null, REKAN: null, BAWAHAN: null,
  };

  if (recs.length === 0) return { score: null, categoryAvg, count: 0 };

  const byCat: Record<AssessorCategory, number[]> = {
    GURU: [], ATASAN: [], REKAN: [], BAWAHAN: [],
  };
  recs.forEach(r => {
    const cat = ((r as any).assessorCategory as AssessorCategory) || 'REKAN';
    if (byCat[cat]) byCat[cat].push(r.totalScore);
  });

  (Object.keys(byCat) as AssessorCategory[]).forEach(cat => {
    const arr = byCat[cat];
    if (arr.length > 0) {
      categoryAvg[cat] = Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
    }
  });

  // Hitung nilai terbobot
  const w = getAssessorWeights(normalizeUserRole(studentRole));
  let sum = 0, wSum = 0;
  (Object.keys(categoryAvg) as AssessorCategory[]).forEach(cat => {
    const avg = categoryAvg[cat];
    const weight = w[cat as keyof typeof w];
    if (avg !== null && weight > 0) {
      sum += avg * weight;
      wSum += weight;
    }
  });

  return {
    score: wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null,
    categoryAvg,
    count: recs.length,
  };
}

// =====================================================
// HELPER: hitung kehadiran per tahap
// =====================================================
function computeAttendanceForStage(
  studentId: string,
  stage: ProductionStage,
  sessions: AttendanceSession[],
  records: AttendanceRecord[]
) {
  const stageSessions = sessions.filter(s => !(s as any).stageId || (s as any).stageId === stage);
  const sessionIds = new Set(stageSessions.map(s => s.id));
  const myRecs = records.filter(r => r.studentId === studentId && sessionIds.has(r.sessionId));

  let hadir = 0, izin = 0, sakit = 0, alpa = 0;
  myRecs.forEach(r => {
    if (r.status === 'Hadir') hadir++;
    else if (r.status === 'Izin') izin++;
    else if (r.status === 'Sakit') sakit++;
    else if (r.status === 'Alpa') alpa++;
  });

  const total = myRecs.length;
  const pct = total > 0 ? Math.round(((hadir + izin + sakit) / total) * 100) : 100;

  return { totalSessions: total, hadir, izin, sakit, alpa, pct };
}

// =====================================================
// HELPER: hitung ketepatan tugas per tahap
// =====================================================
function computeTaskForStage(
  student: UserProfile,
  stage: ProductionStage,
  deadlines: any[],
  submissions: any[]
) {
  const myDeadlines = deadlines.filter(d => {
    if (d.stage && d.stage !== stage) return false;
    if (d.status === 'CANCELLED') return false;
    const scope = d.targetScope;
    if (scope === 'SEMUA') return true;
    if (scope === 'PERAN') return d.targetRole === student.role;
    if (scope === 'DIVISI') return d.targetDivision === student.divisionName;
    if (scope === 'CUSTOM') {
      const tr: string[] = d.targetRoles || [];
      const td: string[] = d.targetDivisions || [];
      const tu: string[] = d.targetUserIds || [];
      if (tr.length > 0 && tr.includes(student.role)) return true;
      if (td.length > 0 && student.divisionName && td.includes(student.divisionName)) return true;
      if (tu.length === 0) return true;
      return tu.includes(student.uid);
    }
    return false;
  });

  let tepatWaktu = 0, terlambat = 0, belum = 0;
  myDeadlines.forEach(d => {
    const sub = submissions.find((s: any) => s.deadlineId === d.id && s.studentId === student.uid);
    if (!sub || sub.status === 'BELUM') {
      belum++;
      return;
    }
    if (sub.status === 'SELESAI') {
      const dueMs = new Date(d.dueDate).getTime();
      const subMs = sub.submittedAt ? new Date(sub.submittedAt).getTime() : Date.now();
      if (subMs <= dueMs) tepatWaktu++;
      else terlambat++;
    } else if (sub.status === 'TERLAMBAT') {
      terlambat++;
    } else {
      belum++;
    }
  });

  const total = myDeadlines.length;
  const pctOnTime = total > 0 ? Math.round((tepatWaktu / total) * 100) : 100;

  return { totalTasks: total, tepatWaktu, terlambat, belum, pctOnTime };
}

// =====================================================
// MAIN COMPONENT
// =====================================================
export const GradeRecapModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole, isPimprod } = useAuth();
  const { showToast } = useToast();

  const canAccess = isGuruPengampu || isAdminRole || isPimprod;

  // State data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attRecords, setAttRecords] = useState<AttendanceRecord[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivisi, setFilterDivisi] = useState<string>('ALL');
  const [filterPredikat, setFilterPredikat] = useState<string>('ALL');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [showDetailMode, setShowDetailMode] = useState(false);

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================
  useEffect(() => {
    if (!activeClass) return;
    setLoading(true);

    fetchUsersByClass(activeClass.id).then(u => {
      setUsers(u.filter(x =>
        x.role !== 'Guru Pengampu' && x.role !== 'Guru Pembina' &&
        x.role !== 'Admin' && x.role !== 'Super Admin'
      ));
    });

    const u1 = subscribeAssessments(activeClass.id, setAssessments);
    const u2 = subscribeAttendanceSessions(activeClass.id, setSessions);
    const u3 = subscribeAllAttendanceRecords(activeClass.id, setAttRecords);
    const u4 = subscribeDeadlinesByClass(activeClass.id, setDeadlines);
    const u5 = subscribeDeadlineSubmissionsByClass(activeClass.id, setSubmissions);

    // Loading off setelah 1.5 detik
    const t = setTimeout(() => setLoading(false), 1500);

    return () => {
      u1(); u2(); u3(); u4(); u5();
      clearTimeout(t);
    };
  }, [activeClass]);

  // ============================================================
  // KOMPUTASI REKAP PER SISWA
  // ============================================================
  const recapData: StudentRecap[] = useMemo(() => {
    return users.map(u => {
      const perStage: Record<ProductionStage, StageDetail> = {
        PERSIAPAN: createEmptyStageDetail(),
        PELAKSANAAN: createEmptyStageDetail(),
        PERTUNJUKAN: createEmptyStageDetail(),
        PASCA: createEmptyStageDetail(),
      };

      STAGES.forEach(s => {
        const stageScoreData = computeStageScore(assessments, u.uid, s.id, u.role);
        const attendance = computeAttendanceForStage(u.uid, s.id, sessions, attRecords);
        const task = computeTaskForStage(u, s.id, deadlines, submissions);

        perStage[s.id] = {
          stageScore: stageScoreData.score,
          categoryAvg: stageScoreData.categoryAvg,
          assessmentCount: stageScoreData.count,
          attendance,
          task,
        };
      });

      // Nilai akhir terbobot
      let sum = 0, wTotal = 0;
      STAGES.forEach(s => {
        const sc = perStage[s.id].stageScore;
        if (sc !== null) {
          sum += sc * (s.defaultWeight / 100);
          wTotal += s.defaultWeight / 100;
        }
      });
      const finalScore = wTotal > 0 ? Math.round((sum / wTotal) * 10) / 10 : 0;
      const stagesWithData = STAGES.filter(s => perStage[s.id].stageScore !== null).length;

      return {
        user: u,
        perStage,
        finalScore,
        finalPredikat: getPredikat(finalScore),
        stagesWithData,
      };
    }).sort((a, b) => {
      // Yang sudah ada nilai di atas
      if (a.stagesWithData === 0 && b.stagesWithData > 0) return 1;
      if (b.stagesWithData === 0 && a.stagesWithData > 0) return -1;
      return b.finalScore - a.finalScore;
    });
  }, [users, assessments, sessions, attRecords, deadlines, submissions]);

  // ============================================================
  // FILTER
  // ============================================================
  const filteredRecap = useMemo(() => {
    return recapData.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.user.displayName.toLowerCase().includes(q);
        const matchRole = r.user.role.toLowerCase().includes(q);
        const matchDiv = (r.user.divisionName || '').toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchDiv) return false;
      }
      if (filterDivisi !== 'ALL') {
        if ((r.user.divisionName || 'Pemeran') !== filterDivisi) return false;
      }
      if (filterPredikat !== 'ALL') {
        if (r.stagesWithData === 0) return filterPredikat === 'NONE';
        if (r.finalPredikat.predikat !== filterPredikat) return false;
      }
      return true;
    });
  }, [recapData, searchQuery, filterDivisi, filterPredikat]);

  // ============================================================
  // STATISTIK KELAS
  // ============================================================
  const classStats = useMemo(() => {
    const withScore = recapData.filter(r => r.stagesWithData > 0);
    if (withScore.length === 0) {
      return {
        avg: 0, highest: 0, lowest: 0, totalWithScore: 0,
        distribution: { A: 0, B: 0, C: 0, D: 0, E: 0, NONE: recapData.length },
      };
    }
    const avg = Math.round((withScore.reduce((s, r) => s + r.finalScore, 0) / withScore.length) * 10) / 10;
    const highest = Math.max(...withScore.map(r => r.finalScore));
    const lowest = Math.min(...withScore.map(r => r.finalScore));

    const distribution: any = { A: 0, B: 0, C: 0, D: 0, E: 0, NONE: 0 };
    recapData.forEach(r => {
      if (r.stagesWithData === 0) distribution.NONE++;
      else distribution[r.finalPredikat.predikat]++;
    });

    return { avg, highest, lowest, totalWithScore: withScore.length, distribution };
  }, [recapData]);

  const divisiList = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => set.add(u.divisionName || 'Pemeran'));
    return Array.from(set).sort();
  }, [users]);

  // ============================================================
  // EXPORT XLSX MULTI-SHEET
  // ============================================================
  const handleExportXLSX = () => {
    try {
      // Sheet 1: Ringkasan Kelas
      const sheetRingkasan = {
        name: 'Ringkasan',
        headers: ['Metrik', 'Nilai'],
        rows: [
          ['Kelas', activeClass?.name || '-'],
          ['Tahun Ajaran', activeClass?.academicYear || '2025/2026'],
          ['Total Siswa', users.length],
          ['Siswa Sudah Dinilai', classStats.totalWithScore],
          ['Siswa Belum Dinilai', classStats.distribution.NONE],
          ['Rata-rata Kelas', classStats.avg],
          ['Nilai Tertinggi', classStats.highest],
          ['Nilai Terendah', classStats.lowest],
          ['', ''],
          ['Distribusi Predikat', ''],
          ['A (90-100)', classStats.distribution.A],
          ['B (80-89)', classStats.distribution.B],
          ['C (70-79)', classStats.distribution.C],
          ['D (60-69)', classStats.distribution.D],
          ['E (<60)', classStats.distribution.E],
          ['Belum Dinilai', classStats.distribution.NONE],
          ['', ''],
          ['Tanggal Export', new Date().toLocaleString('id-ID')],
        ],
      };

      // Sheet 2: Nilai Akhir (4 tahap)
      const sheetNilaiAkhir = {
        name: 'Nilai Akhir',
        headers: [
          'No', 'Nama', 'Peran', 'Divisi',
          'Persiapan (20%)', 'Pelaksanaan (35%)', 'Pertunjukan (30%)', 'Pasca (15%)',
          'Nilai Akhir', 'Predikat', 'Keterangan',
          'Jml Tahap Terisi',
        ],
        rows: filteredRecap.map((r, i) => [
          i + 1,
          r.user.displayName,
          r.user.role,
          r.user.divisionName || '-',
          r.perStage.PERSIAPAN.stageScore ?? '-',
          r.perStage.PELAKSANAAN.stageScore ?? '-',
          r.perStage.PERTUNJUKAN.stageScore ?? '-',
          r.perStage.PASCA.stageScore ?? '-',
          r.stagesWithData > 0 ? r.finalScore : '-',
          r.stagesWithData > 0 ? r.finalPredikat.predikat : '-',
          r.stagesWithData > 0 ? r.finalPredikat.label : 'Belum dinilai',
          `${r.stagesWithData}/4`,
        ]),
      };

      // Sheet 3: Rincian Kategori Penilai (per tahap)
      const sheetKategoriHeaders: string[] = ['Nama', 'Peran'];
      STAGES.forEach(s => {
        sheetKategoriHeaders.push(
          `${STAGE_LABEL[s.id]} - Guru`,
          `${STAGE_LABEL[s.id]} - Koordinator`,
          `${STAGE_LABEL[s.id]} - Rekan`,
          `${STAGE_LABEL[s.id]} - Anggota`
        );
      });
      const sheetKategori = {
        name: 'Rincian Kategori',
        headers: sheetKategoriHeaders,
        rows: filteredRecap.map(r => {
          const row: (string | number)[] = [r.user.displayName, r.user.role];
          STAGES.forEach(s => {
            const d = r.perStage[s.id];
            row.push(
              d.categoryAvg.GURU ?? '-',
              d.categoryAvg.ATASAN ?? '-',
              d.categoryAvg.REKAN ?? '-',
              d.categoryAvg.BAWAHAN ?? '-'
            );
          });
          return row;
        }),
      };

      // Sheet 4: Kehadiran per Tahap
      const sheetKehadiranHeaders: string[] = ['Nama', 'Peran'];
      STAGES.forEach(s => {
        sheetKehadiranHeaders.push(
          `${STAGE_LABEL[s.id]} - Hadir`,
          `${STAGE_LABEL[s.id]} - Izin`,
          `${STAGE_LABEL[s.id]} - Sakit`,
          `${STAGE_LABEL[s.id]} - Alpa`,
          `${STAGE_LABEL[s.id]} - %`
        );
      });
      const sheetKehadiran = {
        name: 'Kehadiran',
        headers: sheetKehadiranHeaders,
        rows: filteredRecap.map(r => {
          const row: (string | number)[] = [r.user.displayName, r.user.role];
          STAGES.forEach(s => {
            const a = r.perStage[s.id].attendance;
            row.push(a.hadir, a.izin, a.sakit, a.alpa, `${a.pct}%`);
          });
          return row;
        }),
      };

      // Sheet 5: Ketepatan Tugas per Tahap
      const sheetTugasHeaders: string[] = ['Nama', 'Peran'];
      STAGES.forEach(s => {
        sheetTugasHeaders.push(
          `${STAGE_LABEL[s.id]} - Tepat`,
          `${STAGE_LABEL[s.id]} - Telat`,
          `${STAGE_LABEL[s.id]} - Belum`,
          `${STAGE_LABEL[s.id]} - %`
        );
      });
      const sheetTugas = {
        name: 'Ketepatan Tugas',
        headers: sheetTugasHeaders,
        rows: filteredRecap.map(r => {
          const row: (string | number)[] = [r.user.displayName, r.user.role];
          STAGES.forEach(s => {
            const t = r.perStage[s.id].task;
            row.push(t.tepatWaktu, t.terlambat, t.belum, `${t.pctOnTime}%`);
          });
          return row;
        }),
      };

      // Sheet 6: Semua Komentar
      const allComments = assessments
        .filter(a => a.comment && a.comment.trim())
        .map(a => {
          const student = users.find(u => u.uid === a.studentId);
          return {
            studentName: student?.displayName || a.studentName,
            studentRole: student?.role || a.studentRole || '-',
            assessorName: a.assessorName,
            category: CATEGORY_LABEL[((a as any).assessorCategory as AssessorCategory) || 'REKAN'],
            stage: STAGE_LABEL[a.stage as ProductionStage] || a.stage,
            score: a.totalScore,
            comment: a.comment || '',
          };
        });

      const sheetKomentar = {
        name: 'Komentar',
        headers: ['Siswa', 'Peran', 'Penilai', 'Kategori', 'Tahap', 'Nilai', 'Komentar'],
        rows: allComments.map(c => [
          c.studentName, c.studentRole, c.assessorName,
          c.category, c.stage, c.score, c.comment,
        ]),
      };

      // Sheet 7: Per Divisi
      const divisiStats: Record<string, { total: number; sum: number; count: number }> = {};
      recapData.forEach(r => {
        if (r.stagesWithData === 0) return;
        const div = r.user.divisionName || 'Pemeran';
        if (!divisiStats[div]) divisiStats[div] = { total: 0, sum: 0, count: 0 };
        divisiStats[div].total += 1;
        divisiStats[div].sum += r.finalScore;
        divisiStats[div].count += 1;
      });
      const sheetDivisi = {
        name: 'Per Divisi',
        headers: ['Divisi', 'Jumlah Siswa', 'Rata-rata Nilai', 'Nilai Tertinggi'],
        rows: Object.entries(divisiStats).map(([div, s]) => {
          const divStudents = recapData.filter(r =>
            (r.user.divisionName || 'Pemeran') === div && r.stagesWithData > 0
          );
          const highest = divStudents.length > 0
            ? Math.max(...divStudents.map(r => r.finalScore))
            : 0;
          return [div, s.count, Math.round((s.sum / s.count) * 10) / 10, highest];
        }),
      };

      exportMultiSheetXLSX(
        `Rekap_Nilai_${activeClass?.name || 'Kelas'}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        [sheetRingkasan, sheetNilaiAkhir, sheetKategori, sheetKehadiran, sheetTugas, sheetKomentar, sheetDivisi]
      );

      showToast(`✅ Rekap lengkap 7 sheet berhasil di-export!`, 'success');
    } catch (err: any) {
      showToast('Gagal export: ' + (err?.message || 'Unknown'), 'error');
      console.error(err);
    }
  };

  // ============================================================
  // PRINT
  // ============================================================
  const handlePrint = () => {
    window.print();
  };

  if (!canAccess) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hanya Guru Pengampu, Admin, dan Pimpinan Produksi.
        </p>
      </div>
    );
  }

  if (!activeClass) {
    return (
      <div className="p-12 text-center bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/40 rounded-3xl max-w-2xl mx-auto my-8">
        <AlertTriangle className="w-16 h-16 mx-auto text-amber-600 mb-4" />
        <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-200">Anda Belum Masuk ke Kelas</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-amber-900 text-white shadow-xl border border-indigo-500/20 print:bg-white print:text-black print:shadow-none print:border print:border-slate-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 print:bg-white print:border-slate-300">
              <BarChart3 className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30 print:hidden">
                Rekap Nilai Akhir
              </span>
              <h2 className="text-xl font-black text-white mt-1 print:text-black">
                Rekap Nilai Akhir — {activeClass.name}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 print:text-slate-600">
                {users.length} siswa • 4 tahap produksi • nilai akhir terbobot
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <button
              onClick={handleExportXLSX}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export XLSX (7 Sheet)
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <Printer className="w-4 h-4" /> Cetak
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* INFO BANNER */}
      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2 print:hidden">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong>Nilai Akhir</strong> = Σ (Nilai Tahap × Bobot) / Σ Bobot yang terisi.
          Bobot: Persiapan 20% • Pelaksanaan 35% • Pertunjukan 30% • Pasca 15%.
          Nilai dihitung dari matriks penilaian 360° (Guru/Atasan/Rekan/Bawahan).
        </div>
      </div>

      {/* STATISTIK KELAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md">
          <TrendingUp className="w-5 h-5 mb-1 opacity-90" />
          <p className="text-[10px] font-bold uppercase opacity-90">Rata-rata Kelas</p>
          <p className="text-3xl font-black mt-1">{classStats.avg}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
          <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1" />
          <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Tertinggi</p>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">{classStats.highest}</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 mb-1" />
          <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Terendah</p>
          <p className="text-2xl font-black text-rose-800 dark:text-rose-200">{classStats.lowest}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm">
          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-1" />
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Sudah Dinilai</p>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-200">
            {classStats.totalWithScore}/{users.length}
          </p>
        </div>
      </div>

      {/* DISTRIBUSI PREDIKAT */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-600" /> Distribusi Predikat Kelas
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {(['A', 'B', 'C', 'D', 'E', 'NONE'] as const).map(p => {
            const count = p === 'NONE' ? classStats.distribution.NONE : classStats.distribution[p];
            const label = p === 'NONE' ? 'Belum' : p;
            const color =
              p === 'A' ? 'bg-amber-100 text-amber-800 border-amber-300' :
              p === 'B' ? 'bg-blue-100 text-blue-800 border-blue-300' :
              p === 'C' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              p === 'D' ? 'bg-orange-100 text-orange-800 border-orange-300' :
              p === 'E' ? 'bg-rose-100 text-rose-800 border-rose-300' :
              'bg-slate-100 text-slate-600 border-slate-300';
            return (
              <div key={p} className={`p-3 rounded-2xl border-2 text-center ${color}`}>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-[10px] font-bold uppercase mt-0.5">
                  {p === 'NONE' ? 'Belum Dinilai' : `Predikat ${label}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, peran, atau divisi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
          />
        </div>
        <select
          value={filterDivisi}
          onChange={(e) => setFilterDivisi(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
        >
          <option value="ALL">Semua Divisi</option>
          {divisiList.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filterPredikat}
          onChange={(e) => setFilterPredikat(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
        >
          <option value="ALL">Semua Predikat</option>
          <option value="A">A (90-100)</option>
          <option value="B">B (80-89)</option>
          <option value="C">C (70-79)</option>
          <option value="D">D (60-69)</option>
          <option value="E">E (&lt;60)</option>
          <option value="NONE">Belum Dinilai</option>
        </select>
        <button
          onClick={() => setShowDetailMode(!showDetailMode)}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
            showDetailMode
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {showDetailMode ? 'Mode Detail' : 'Mode Ringkas'}
        </button>
      </div>

      {/* COUNTER */}
      <div className="text-xs text-slate-500 dark:text-slate-400 px-1 print:hidden">
        Menampilkan <strong>{filteredRecap.length}</strong> dari {recapData.length} siswa
      </div>

      {/* TABEL UTAMA */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-300" />
          <p className="text-xs text-slate-400">Memuat data rekap...</p>
        </div>
      ) : filteredRecap.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Tidak Ada Data</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Coba ubah filter atau pastikan sudah ada penilaian.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-3 px-3 text-center w-12">No</th>
                  <th className="py-3 px-3">Nama</th>
                  <th className="py-3 px-3">Peran</th>
                  <th className="py-3 px-3 text-center">Persiapan</th>
                  <th className="py-3 px-3 text-center">Pelaksanaan</th>
                  <th className="py-3 px-3 text-center">Pertunjukan</th>
                  <th className="py-3 px-3 text-center">Pasca</th>
                  <th className="py-3 px-3 text-center">Nilai Akhir</th>
                  <th className="py-3 px-3 text-center">Predikat</th>
                  <th className="py-3 px-3 text-center w-12 print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredRecap.map((r, i) => {
                  const isExpanded = expandedStudentId === r.user.uid;
                  return (
                    <React.Fragment key={r.user.uid}>
                      <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        r.stagesWithData === 0 ? 'opacity-60' : ''
                      }`}>
                        <td className="py-3 px-3 text-center text-slate-500 font-mono">{i + 1}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 dark:text-white">{r.user.displayName}</p>
                          <p className="text-[10px] text-slate-400">{r.user.divisionName || 'Pemeran'}</p>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400">{r.user.role}</td>
                        {STAGES.map(s => {
                          const sc = r.perStage[s.id].stageScore;
                          return (
                            <td key={s.id} className="py-3 px-3 text-center font-mono font-bold">
                              {sc !== null ? (
                                <span className={`${
                                  sc >= 90 ? 'text-amber-600' :
                                  sc >= 80 ? 'text-blue-600' :
                                  sc >= 70 ? 'text-emerald-600' :
                                  sc >= 60 ? 'text-orange-600' : 'text-rose-600'
                                }`}>{sc.toFixed(1)}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-center">
                          {r.stagesWithData > 0 ? (
                            <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                              {r.finalScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {r.stagesWithData > 0 ? (
                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-md border ${r.finalPredikat.color}`}>
                              {r.finalPredikat.predikat}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Belum</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center print:hidden">
                          <button
                            onClick={() => setExpandedStudentId(isExpanded ? null : r.user.uid)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            title="Lihat rincian"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* DETAIL EXPANSION */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                          <td colSpan={10} className="p-4">
                            <div className="space-y-4">
                              <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                Rincian Detail: {r.user.displayName}
                              </p>

                              {STAGES.map(s => {
                                const d = r.perStage[s.id];
                                return (
                                  <div key={s.id} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                      <span className="text-xs font-black text-slate-800 dark:text-white">
                                        📌 {STAGE_LABEL[s.id]}
                                        <span className="text-[10px] font-normal text-slate-400 ml-1">(Bobot {s.defaultWeight}%)</span>
                                      </span>
                                      {d.stageScore !== null && (
                                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                                          Nilai: {d.stageScore.toFixed(1)}
                                        </span>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[10px]">
                                      {/* Kategori penilai */}
                                      {(['GURU', 'ATASAN', 'REKAN', 'BAWAHAN'] as AssessorCategory[]).map(cat => (
                                        <div key={cat} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                          <p className="text-slate-500 dark:text-slate-400 font-bold">{CATEGORY_LABEL[cat]}</p>
                                          <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                                            {d.categoryAvg[cat] !== null ? d.categoryAvg[cat]?.toFixed(1) : '-'}
                                          </p>
                                        </div>
                                      ))}

                                      {/* Kehadiran */}
                                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                                        <p className="text-emerald-700 dark:text-emerald-300 font-bold">Kehadiran</p>
                                        <p className="text-xs font-black text-emerald-800 dark:text-emerald-200 mt-0.5">
                                          {d.attendance.pct}%
                                        </p>
                                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400">
                                          {d.attendance.hadir}H • {d.attendance.izin}I • {d.attendance.sakit}S • {d.attendance.alpa}A
                                        </p>
                                      </div>

                                      {/* Ketepatan tugas */}
                                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                                        <p className="text-blue-700 dark:text-blue-300 font-bold">Ketepatan Tugas</p>
                                        <p className="text-xs font-black text-blue-800 dark:text-blue-200 mt-0.5">
                                          {d.task.pctOnTime}%
                                        </p>
                                        <p className="text-[9px] text-blue-600 dark:text-blue-400">
                                          {d.task.tepatWaktu}T • {d.task.terlambat}L • {d.task.belum}B
                                        </p>
                                      </div>
                                    </div>

                                    {d.assessmentCount === 0 && (
                                      <p className="text-[10px] text-slate-400 italic mt-2">
                                        ⚠️ Belum ada penilaian untuk tahap ini
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FOOTER PRINT */}
      <div className="hidden print:block text-center text-[10px] text-slate-500 pt-4 border-t border-slate-300">
        SP-PPT — SMP Negeri 10 Samarinda • T.A. 2025/2026 • Rekap Nilai Akhir {activeClass.name} • Dicetak: {new Date().toLocaleDateString('id-ID')}
      </div>
    </div>
  );
};

// =====================================================
// HELPER: empty stage detail
// =====================================================
function createEmptyStageDetail(): StageDetail {
  return {
    stageScore: null,
    categoryAvg: { GURU: null, ATASAN: null, REKAN: null, BAWAHAN: null },
    assessmentCount: 0,
    attendance: { totalSessions: 0, hadir: 0, izin: 0, sakit: 0, alpa: 0, pct: 100 },
    task: { totalTasks: 0, tepatWaktu: 0, terlambat: 0, belum: 0, pctOnTime: 100 },
  };
}
