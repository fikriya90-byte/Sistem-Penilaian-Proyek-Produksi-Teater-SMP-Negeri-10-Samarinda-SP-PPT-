import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle,
  Download,
  Eye,
  FileCheck,
  Filter,
  Lock,
  Printer,
  Search,
  Sparkles,
  Unlock,
  UserCheck,
  Users
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { ACTOR_CRITERIA, GENERAL_CRITERIA, getPredikat, SCORE_SCALE, STAGES } from '../../core/constants';
import { AssessmentRecord, ProductionStage, UserProfile } from '../../core/types';
import { fetchUsersByClass, recordAuditLog, saveAssessment, subscribeAssessments } from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const AssessmentModule: React.FC = () => {
  const { user, activeClass, isTeacher, canAssessTarget } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<UserProfile[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGradingOpen, setIsGradingOpen] = useState(false);
  const [isLockedByTeacher, setIsLockedByTeacher] = useState(false);

  // Form states for grading
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(u => {
      // Exclude teacher from evaluated list
      setStudents(u.filter(s => s.role !== 'Guru Pembina' && s.role !== 'Admin'));
    });

    const unsub = subscribeAssessments(activeClass.id, (records) => {
      setAssessments(records);
    });
    return () => unsub();
  }, [activeClass]);

  // Determine criteria based on target student role
  const isTargetActor = selectedStudent?.role === 'Pemain';
  const criteriaList = isTargetActor ? ACTOR_CRITERIA : GENERAL_CRITERIA;

  // Initialize scores when opening grading modal
  const openGradingModal = (student: UserProfile) => {
    if (!canAssessTarget(student)) {
      showToast('Anda tidak memiliki wewenang menilai peran siswa ini.', 'warning');
      return;
    }
    setSelectedStudent(student);
    const initial: Record<string, number> = {};
    criteriaList.forEach(c => {
      initial[c.key] = 3; // Default 'Baik' (80)
    });
    setScores(initial);
    setComment('');
    setIsGradingOpen(true);
  };

  // Calculate live score
  const calculateTotalScore = () => {
    let weightedSum = 0;
    let totalWeight = 0;
    criteriaList.forEach(c => {
      const val = scores[c.key] || 3;
      const converted = SCORE_SCALE[val]?.score100 || 80;
      weightedSum += converted * c.weight;
      totalWeight += c.weight;
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 80;
  };

  const handleSaveAssessment = async () => {
    if (!user || !selectedStudent || !activeClass) return;

    // Validation: mandatory comment if any score <= 2 (Kurang or Cukup)
    const hasLowScore = Object.values(scores).some(v => v <= 2);
    if (hasLowScore && (!comment || comment.trim().length < 5)) {
      showToast('Komentar pembinaan wajib diisi bila terdapat nilai ≤ 2 (Kurang/Cukup)!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const totalScore = calculateTotalScore();
      const assessorType: 'GURU' | 'KETUA' | 'REKAN' = isTeacher
        ? 'GURU'
        : user.role === 'Pimpinan Produksi' || user.role === 'Sutradara' || user.role.startsWith('Koordinator ')
        ? 'KETUA'
        : 'REKAN';

      await saveAssessment({
        classId: activeClass.id,
        productionId: 'prod-ix-a',
        studentId: selectedStudent.uid,
        studentName: selectedStudent.displayName,
        studentRole: selectedStudent.role,
        studentDivision: selectedStudent.divisionName,
        assessorId: user.uid,
        assessorName: user.displayName,
        assessorRole: user.role,
        assessorType,
        stage: selectedStage,
        scores,
        totalScore,
        comment: comment.trim(),
        isFinal: true,
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'ASSESS',
        targetType: 'Assessment',
        targetId: selectedStudent.uid,
        details: `Memberi nilai ${totalScore} untuk ${selectedStudent.displayName} (${selectedStage})`,
      });

      showToast(`Penilaian untuk ${selectedStudent.displayName} berhasil disimpan!`, 'success');
      setIsGradingOpen(false);
    } catch (err: any) {
      showToast('Gagal menyimpan penilaian: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter students by query
  const filteredStudents = students.filter(s =>
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.divisionName && s.divisionName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Compute final multi-assessor aggregate for a student:
  // Guru = 50%, Ketua = 30%, Rekan = 20%
  const getAggregatedScore = (studentId: string) => {
    const studentRecords = assessments.filter(
      a => a.studentId === studentId && a.stage === selectedStage
    );
    if (studentRecords.length === 0) return null;

    const guruRecords = studentRecords.filter(a => a.assessorType === 'GURU');
    const ketuaRecords = studentRecords.filter(a => a.assessorType === 'KETUA');
    const rekanRecords = studentRecords.filter(a => a.assessorType === 'REKAN');

    const avg = (arr: AssessmentRecord[]) =>
      arr.length > 0 ? arr.reduce((acc, c) => acc + c.totalScore, 0) / arr.length : null;

    const guruScore = avg(guruRecords);
    const ketuaScore = avg(ketuaRecords);
    const rekanScore = avg(rekanRecords);

    // Normalization if some evaluators haven't submitted
    let weightedSum = 0;
    let weightTotal = 0;

    if (guruScore !== null) {
      weightedSum += guruScore * 0.5;
      weightTotal += 0.5;
    }
    if (ketuaScore !== null) {
      weightedSum += ketuaScore * 0.3;
      weightTotal += 0.3;
    }
    if (rekanScore !== null) {
      weightedSum += rekanScore * 0.2;
      weightTotal += 0.2;
    }

    const finalVal = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 80;
    return {
      finalVal,
      guruScore,
      ketuaScore,
      rekanScore,
      count: studentRecords.length,
    };
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = [
      ['NIS', 'Nama Siswa', 'Peran', 'Divisi', 'Tahap', 'Nilai Guru (50%)', 'Nilai Ketua (30%)', 'Nilai Rekan (20%)', 'Nilai Akhir', 'Predikat'],
    ];

    students.forEach(s => {
      const agg = getAggregatedScore(s.uid);
      const pred = agg ? getPredikat(agg.finalVal).predikat : '-';
      rows.push([
        s.nis || '-',
        s.displayName,
        s.role,
        s.divisionName || '-',
        selectedStage,
        agg?.guruScore ? String(agg.guruScore) : '-',
        agg?.ketuaScore ? String(agg.ketuaScore) : '-',
        agg?.rekanScore ? String(agg.rekanScore) : '-',
        agg ? String(agg.finalVal) : '-',
        pred,
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Nilai_${activeClass?.name}_${selectedStage}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Rekap nilai berhasil diekspor ke CSV!', 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Award className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Sistem Penilaian Multi-Penilai & Rapor
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Pembobotan terpadu: Guru (50%), Ketua/Pimpinan (30%), Rekan Sejawat (20%)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Selector */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value as ProductionStage)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
          >
            {STAGES.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.defaultWeight}%)
              </option>
            ))}
          </select>

          {isTeacher && (
            <button
              onClick={() => {
                setIsLockedByTeacher(!isLockedByTeacher);
                showToast(
                  !isLockedByTeacher
                    ? 'Penilaian tahap ini telah DIKUNCI oleh Guru Pembina.'
                    : 'Kunci penilaian dibuka kembali.',
                  'info'
                );
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isLockedByTeacher
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {isLockedByTeacher ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isLockedByTeacher ? 'Status: Terkunci' : 'Kunci Nilai'}</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari siswa atau peran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="text-xs text-slate-500 font-semibold self-end sm:self-auto">
          Menampilkan {filteredStudents.length} siswa di {activeClass?.name}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-3.5 px-4">Nama Siswa</th>
                <th className="py-3.5 px-4">Peran & Divisi</th>
                <th className="py-3.5 px-4 text-center">Guru (50%)</th>
                <th className="py-3.5 px-4 text-center">Ketua (30%)</th>
                <th className="py-3.5 px-4 text-center">Rekan (20%)</th>
                <th className="py-3.5 px-4 text-center">Nilai Akhir</th>
                <th className="py-3.5 px-4 text-center">Predikat</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(student => {
                const agg = getAggregatedScore(student.uid);
                const predInfo = agg ? getPredikat(agg.finalVal) : null;
                const canGradeThisStudent = canAssessTarget(student);

                return (
                  <tr key={student.uid} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 border border-slate-200">
                          {student.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{student.displayName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{student.nis || 'NIS -'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{student.role}</span>
                      <span className="text-[10px] text-slate-400">{student.divisionName || 'Pemeran'}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {agg?.guruScore !== null && agg?.guruScore !== undefined ? agg.guruScore : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {agg?.ketuaScore !== null && agg?.ketuaScore !== undefined ? agg.ketuaScore : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {agg?.rekanScore !== null && agg?.rekanScore !== undefined ? agg.rekanScore : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {agg ? (
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {agg.finalVal}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum ada</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {predInfo ? (
                        <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs border ${predInfo.color}`}>
                          {predInfo.predikat}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {canGradeThisStudent && !isLockedByTeacher ? (
                        <button
                          onClick={() => openGradingModal(student)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition"
                        >
                          Beri Nilai
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          {isLockedByTeacher ? 'Terkunci' : 'Hanya Lihat'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Penilaian */}
      {isGradingOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Formulir Penilaian • {selectedStage}
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Menilai: {selectedStudent.displayName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Peran: {selectedStudent.role} {selectedStudent.divisionName ? `• ${selectedStudent.divisionName}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 font-medium">Perkiraan Nilai</p>
                  <p className="text-2xl font-black text-amber-400 font-mono">
                    {calculateTotalScore()}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body - Criteria Sliders */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <p className="text-xs text-slate-500 font-medium">
                Geser nilai 1 - 4 pada tiap aspek kriteria penilaian berikut:
              </p>

              {criteriaList.map((crit) => {
                const currentVal = scores[crit.key] || 3;
                const scaleInfo = SCORE_SCALE[currentVal];

                return (
                  <div key={crit.key} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900">{crit.label}</span>
                        <span className="text-[10px] text-slate-400 font-semibold ml-2">Bobot: {crit.weight}%</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">{crit.desc}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${scaleInfo.badgeColor}`}>
                        {currentVal} • {scaleInfo.label} ({scaleInfo.score100})
                      </span>
                    </div>

                    <div className="pt-2">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        value={currentVal}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setScores(prev => ({ ...prev, [crit.key]: val }));
                        }}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
                        <span>1 (Kurang: 40)</span>
                        <span>2 (Cukup: 60)</span>
                        <span>3 (Baik: 80)</span>
                        <span>4 (Sangat Baik: 100)</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Comment field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Komentar & Catatan Pembinaan{' '}
                  {Object.values(scores).some(v => v <= 2) && (
                    <span className="text-rose-500 font-bold">(Wajib diisi karena ada nilai ≤ 2)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Berikan catatan konstruktif untuk perkembangan kemampuan siswa..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsGradingOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveAssessment}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Finalisasi & Simpan Nilai'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
