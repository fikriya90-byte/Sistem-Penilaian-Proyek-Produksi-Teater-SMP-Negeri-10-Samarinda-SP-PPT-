import React, { useState, useEffect } from 'react';
import {
  Clock, PlusCircle, CheckCircle, Users, Upload, X, Send, Timer,
  AlertTriangle, Check, BookOpen, Flag, Palette, Star, ChevronRight,
  Sparkles, Target, ListChecks,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { DIVISIONS, STAGES } from '../../core/constants';
import {
  DeadlineItem, DeadlineSubmission, DivisionType, UserRole,
  ProductionStage, UserProfile,
} from '../../core/types';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass, notifyTeachers } from '../../services/firestoreService';
import { DEADLINE_TEMPLATES, STAGE_INFO, DeadlineTemplate } from '../../core/deadlineTemplates';

// =====================================================
// PRIORITY CONFIG
// =====================================================
const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  LOW: { label: 'Rendah', color: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Sedang', color: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  HIGH: { label: 'Tinggi', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  CRITICAL: { label: 'Kritis', color: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' },
};

function getPriorityConfig(priority?: string) {
  if (!priority) return PRIORITY_CONFIG.MEDIUM;
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
}

// =====================================================
// HANYA GURU PENGAMPU YANG BISA BUAT DEADLINE
// =====================================================
const CAN_CREATE_DEADLINE_ROLES = ['Guru Pengampu', 'Guru Pembina'];

// =====================================================
// MAIN COMPONENT
// =====================================================
export const DeadlineModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu } = useAuth();
  const { showToast } = useToast();

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, DeadlineSubmission>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineItem | null>(null);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submissions, setSubmissions] = useState<DeadlineSubmission[]>([]);
  const [filterStage, setFilterStage] = useState<'ALL' | ProductionStage>('ALL');
  const [now, setNow] = useState(new Date());

  // Wizard states
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedStage, setSelectedStage] = useState<ProductionStage>('PELAKSANAAN');
  const [selectedTemplate, setSelectedTemplate] = useState<DeadlineTemplate | null>(null);

  // Form final
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newTarget, setNewTarget] = useState<'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM'>('SEMUA');
  const [newDivision, setNewDivision] = useState<DivisionType>('Perlengkapan');
  const [newRole, setNewRole] = useState<UserRole>('Pemain');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Submit proof
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [progress, setProgress] = useState(50);
  const [askExtension, setAskExtension] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');

  // Review
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [approveExt, setApproveExt] = useState(false);

  const canCreate = !!user && CAN_CREATE_DEADLINE_ROLES.includes(user.role);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'deadlines'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const items: DeadlineItem[] = snap.docs.map(d => ({ ...d.data(), id: d
