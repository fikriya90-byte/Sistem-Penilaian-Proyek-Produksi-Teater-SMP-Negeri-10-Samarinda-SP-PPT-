import React, { useState, useEffect } from 'react';
import { Award, Printer, MessageSquare, CheckCircle, Clock, Target, BarChart3, Star, TrendingUp, Bot, EyeOff, Users, Shield, Sparkles, Info, Lock, Send, Download, MessageCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { PEMERAN_CRITERIA, GENERAL_CRITERIA, SCORE_SCALE, STAGES, getPredikat, getAssessmentMatrix, getAssessorWeights, normalizeUserRole, isPemeranRole, canRoleAssessTarget } from '../../core/constants';
import { AssessmentRecord, ProductionStage } from '../../core/types';
import { subscribeAssessments } from '../../services/firestoreService';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../core/firebase';

export const MyGradeModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [classmates, setClassmates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [stageConfig, setStageConfig] = useState<any>(null);

  const canBypassGate = isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!activeClass || !user) return;
    const unsub = subscribeAssessments(activeClass.id, (records) => {
      setAssessments(records); setLoading(false);
    });
    return () => unsub();
  }, [activeClass, user]);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = onSnapshot(doc(db, 'classes', activeClass.id, 'config', 'stageManager'), snap => {
      if (snap.exists()) { setStageConfig(snap.data()); if (snap.data().currentStage) setSelectedStage(snap.data().currentStage); }
    });
    return () => unsub();
  }, [activeClass]);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'users'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      setClassmates(snap.docs.map(d => ({ ...d.data(), uid: d.id, role: normalizeUserRole(d.data().role) })));
    });
    return () => unsub();
  }, [activeClass]);

  // ✅ FIX PEER GATE: Cek kewajiban menilai berdasarkan target
  const peerStatus = (() => {
    if (!user || classmates.length === 0) return { total: 0, filled: 0, isComplete: true, targets: [] as any[] };
    const targets = classmates.filter(s => {
      if (s.uid === user.uid) return false;
      if (['Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin'].includes(s.role)) return false;
      return canRoleAssessTarget(s.role, user.role);
    });
    const filled = targets.filter(t => assessments.some(a => a.assessorId === user.uid && a.studentId === t.uid && a.stage === selectedStage)).length;
    return { total: targets.length, filled, isComplete: filled >= targets.length, targets };
  })();

  const peerGateUnlocked = canBypassGate || peerStatus.isComplete || peerStatus.total === 0;

  // ✅ FIX GATE WAKTU
  const assessmentStatus = (() => {
    const cfg = stageConfig?.stageDeadlines?.[selectedStage];
    if (!cfg) return { open: false, reason: 'no-config' };
    if (cfg.assessmentEnabled === false) return { open: false, reason: 'disabled' };
    let startMs, endMs;
    if (cfg.assessmentStartDate) startMs = new Date(`${cfg.assessmentStartDate}T${cfg.assessmentStartTime || '00:00'}:00`).getTime();
    if (cfg.assessmentEndDate) endMs = new Date(`${cfg.assessmentEndDate}T${cfg.assessmentEndTime || '23:59'}:00`).getTime();
    const now = Date.now();
    if (startMs && now < startMs) return { open: false, reason: 'not-started', startMs };
    if (endMs && now > endMs) return { open: false, reason: 'ended', endMs };
    return { open: true, reason: 'open' };
  })();

  const assessmentTimeOpen = canBypassGate || assessmentStatus.open;

  const myAssessments = assessments.filter(a => a.studentId === user?.uid);
  const stageScores: Record<ProductionStage, number | null> = { PERSIAPAN: null, PELAKSANAAN: null, PERTUNJUKAN: null, PASCA: null };
  
  STAGES.forEach(s => {
    const stageRecords = myAssessments.filter(a => a.stage === s.id);
    if (stageRecords.length === 0) return;
    const byCat: Record<string, AssessmentRecord[]> = {};
    stageRecords.forEach(r => { const cat = (r as any).assessorCategory || 'REKAN'; if (!byCat[cat]) byCat[cat] = []; byCat[cat].push(r); });
    const weights = getAssessorWeights(normalizeUserRole(user?.role));
    let sum = 0, wSum = 0;
    Object.entries(weights).forEach(([cat, w]) => {
      const catScore = byCat[cat] ? byCat[cat].reduce((acc, a) => acc + a.totalScore, 0) / byCat[cat].length : null;
      if (catScore !== null && w > 0) { sum += catScore * w; wSum += w; }
    });
    stageScores[s.id] = wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
  });

  let finalSum = 0, wTotal = 0;
  STAGES.forEach(s => { const sc = stageScores[s.id]; if (sc !== null) { finalSum += sc * (s.defaultWeight / 100); wTotal += s.defaultWeight / 100; } });
  const finalScore = wTotal > 0 ? Math.round((finalSum / wTotal) * 10) / 10 : 0;
  const predikatInfo = getPredikat(finalScore);

  if (loading) return <div className="p-12 text-center">Memuat...</div>;
  if (!user) return null;

  if (!peerGateUnlocked) return (
    <div className="p-8 text-center bg-amber-50 rounded-3xl border-2 border-amber-300 max-w-2xl mx-auto">
      <Lock className="w-12 h-12 text-amber-600 mx-auto mb-4" />
      <h2 className="text-xl font-black text-amber-900 mb-2">Nilai Anda Belum Bisa Dibuka</h2>
      <p className="text-sm text-amber-800 mb-4">Anda harus menyelesaikan penilaian rekan kerja terlebih dahulu.</p>