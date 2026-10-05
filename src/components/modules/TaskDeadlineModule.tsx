import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Calendar, CheckCircle, Clock, ExternalLink, Paperclip,
  PlusCircle, Search, Sparkles, Star, Trash2, Upload, UserCheck,
  Users, X, Save, Timer, Target, ListChecks, ChevronRight, LayoutGrid,
  Wand2, Edit3,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS, STAGES } from '../../core/constants';
import {
  DivisionType, ProductionStage, TaskItem, TaskPriority, TaskStatus, UserProfile,
} from '../../core/types';
import {
  createTask, deleteTask, fetchUsersByClass, recordAuditLog,
  subscribeTasksByClass, updateTask, notifyTeachers,
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { TASK_TEMPLATES, STAGE_INFO_TASK, TaskTemplate } from '../../core/taskTemplates';

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

export const TaskDeadlineModule: React.FC = () => {
  const {
    user, activeClass, isTeacher, isGuruPengampu, isAdminRole,
    isPimprod, isSutradara, isKoordinator, isAsisten,
  } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'tasks' | 'templates'>('tasks');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual create modal
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualStage, setManualStage] = useState<ProductionStage>('PELAKSANAAN');
  const [manualDivision, setManualDivision] = useState<DivisionType>('Perlengkapan');
  const [manualAssigneeId, setManualAssigneeId] = useState('');
  const [manualPriority, setManualPriority] = useState<TaskPriority>('MEDIUM');
  const [manualDue, setManualDue] = useState('');

  // Template wizard
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [tplStage, setTplStage] = useState<ProductionStage>('PELAKSANAAN');
  const [tplSelected, setTplSelected] = useState<TaskTemplate | null>(null);
  const [tplTitle, setTplTitle] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplDue, setTplDue] = useState('');
  const [tplPriority, setTplPriority] = useState<TaskPriority>('MEDIUM');
  const [tplTarget, setTplTarget] = useState<'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM'>('SEMUA');
  const [tplDivision, setTplDivision] = useState<DivisionType>('Perlengkapan');
  const [tplRole, setTplRole] = useState<string>('Pemain');
  const [tplUserIds, setTplUserIds] = useState<string[]>([]);

  // Submit proof
  const [proofTask, setProofTask] = useState<TaskItem | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [reviewTask, setReviewTask] = useState<TaskItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<TaskStatus>('APPROVED');
  const [reviewFeedback, setReviewFeedback] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const canCreateTasks = isTeacher || isGuruPengampu || isAdminRole || isPimprod || isSutradara || isKoordinator;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeTasksByClass(activeClass.id, (taskList) => {
      setTasks(taskList);
    });
    fetchUsersByClass(activeClass.id).then(u => setClassStudents(u));
    return () => unsub();
  }, [activeClass]);

  // ==========================================
  // DEADLINE STATUS
  // ==========================================
  const getDeadlineStatus = (dueDateIso: string, status: TaskStatus) => {
    if (status === 'APPROVED') {
      return { text: 'Selesai & Disetujui', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40' };
    }
    const diff = new Date(dueDateIso).getTime() - currentTime.getTime();
    if (diff <= 0) {
      return { text: 'TERLAMBAT', color: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500/40 font-black' };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    let label = `${days}h ${hours % 24}j`;
    if (days === 0) label = `${hours}j`;
    if (hours < 24) {
      return { text: `Tersisa: ${label}`, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 font-bold animate-pulse' };
    }
    if (hours <= 72) {
      return { text: `Tersisa: ${label}`, color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 font-semibold' };
    }
    return { text: `Tersisa: ${label}`, color: 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
  };

  // ==========================================
  // MANUAL CREATE
  // ==========================================
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!manualTitle.trim() || !manualDue) {
      showToast('Lengkapi judul
