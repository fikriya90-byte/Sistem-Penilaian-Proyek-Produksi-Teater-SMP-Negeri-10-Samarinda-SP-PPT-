import React, { useState, useEffect } from 'react';
import {
  Radio, Send, Search, Filter, Megaphone, AlertTriangle, Users,
  User, Target, CheckSquare, Square, ChevronDown, ChevronRight,
  MessageSquare, Reply, X, Shield, Clock, Trash2, Check,
  RefreshCw, Building2, Crown, Star, Pause, Play, Ban, Eye,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { UserRole, DivisionType, UserProfile } from '../../core/types';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc,
  getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import {
  recordAuditLog, fetchUsersByClass,
} from '../../services/firestoreService';

// =====================================================
// TIPE DATA
// =====================================================
type BroadcastPriority = 'NORMAL' | 'PENTING' | 'URGENT';
type BroadcastTarget = 'SEMUA' | 'CUSTOM';
type BroadcastStatus = 'ACTIVE' | 'CLOSED';

interface BroadcastReply {
  id: string;
  broadcastId: string;
  classId: string;
  userId: string;
  userName: string;
  userRole: string;
  userDivision: string;
  content: string;
  createdAt: string;
}

interface BroadcastMessage {
  id: string;
  classId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  title: string;
  content: string;
  priority: BroadcastPriority;
  targetScope: BroadcastTarget;
  targetRoles: string[];
  targetDivisions: string[];
  recipientIds: string[];
  status: BroadcastStatus;
  closedAt?: string;
  createdAt: string;
}

// =====================================================
// KONFIGURASI
// =====================================================
const CAN_BROADCAST_ROLES = [
  'Guru Pengampu', 'Guru Pembina', 'Admin', 'Super Admin',
  'Pimpinan Produksi', 'Sekretaris', 'Bendahara',
  'Sutradara', 'Asisten Sutradara',
  'Koordinator Perlengkapan', 'Koordinator Publikasi',
  'Koordinator Tata Panggung', 'Koordinator Tata Rias',
  'Koordinator Tata Busana', 'Koordinator Tata Musik',
];

const PRIORITY_CONFIG: Record<BroadcastPriority, {
  label: string; color: string; bg: string; border: string; icon: any;
}> = {
  NORMAL: {
    label: 'Normal',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-300 dark:border-slate-600',
    icon: MessageSquare,
  },
  PENTING: {
    label: 'Penting',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    border: 'border-amber-300 dark:border-amber-500/40',
    icon: AlertTriangle,
  },
  URGENT: {
    label: 'URGENT',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-100 dark:bg-rose-500/20',
    border: 'border-rose-300 dark:border-rose-500/40 animate-pulse',
    icon: AlertTriangle,
  },
};

const ROLE_LIST: UserRole[] = [
  'Pimpinan Produksi', 'Sekretaris', 'Bendahara', 'Sutradara', 'Asisten Sutradara', 'Pemeran',
  'Koordinator Perlengkapan', 'Koordinator Publikasi', 'Koordinator Tata Panggung',
  'Koordinator Tata Rias', 'Koordinator Tata Busana', 'Koordinator Tata Musik',
  'Anggota Perlengkapan', 'Anggota Publikasi', 'Anggota Tata Panggung',
  'Anggota Tata Rias', 'Anggota Tata Busana', 'Anggota Tata Musik',
];

const DIVISION_LIST: DivisionType[] = [
  'Pengurus Inti', 'Pemeran', 'Perlengkapan', 'Publikasi & Dokumentasi',
  'Tata Panggung', 'Tata Rias', 'Tata Busana', 'Tata Musik & Suara',
];

const MAX_REPLY_LENGTH = 300;
const MAX_REPLIES_PER_USER = 3;

// =====================================================
// FILTER KATA KASAR
// =====================================================
const BAD_WORDS = [
  'anjing', 'anjg', 'anjir', 'bangsat', 'bajingan', 'kontol', 'kntl', 'memek',
  'ngentot', 'pepek', 'peler', 'pler', 'tai', 'taik', 'kampang', 'asu', 'asw',
  'babi', 'brengsek', 'sialan', 'setan', 'goblok', 'gblk', 'tolol', 'tlol',
  'idiot', 'dungu', 'bodoh', 'bdh', 'sinting', 'edan', 'gila', 'bgst',
  'pukimak', 'kimak', 'jancuk', 'jancok', 'cuk', 'tolo', 'lonte', 'pelacur',
  'sundal', 'jablay', 'bispak', 'perek',
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'pussy', 'cunt',
  'whore', 'slut', 'damn', 'wtf',
];

const containsBadWord = (text: string): { has: boolean; found: string[] } => {
  if (!text) return { has: false, found: [] };
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const found: string[] = [];
  BAD_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
    if (regex.test(lower)) {
      if (!found.includes(word)) found.push(word);
    }
  });
  return { has: found.length > 0, found };
};

const sanitizeText = (text: string): string => {
  let result = text;
  BAD_WORDS.forEach(word => {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  });
  return result;
};

const getPriorityInfo = (p: BroadcastPriority) => PRIORITY_CONFIG[p] || PRIORITY_CONFIG.NORMAL;

// =====================================================
// MAIN COMPONENT
// =====================================================
export const BroadcastModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [replies, setReplies] = useState<Record<string, BroadcastReply[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'MINE' | 'TO_ME' | 'URGENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [composeTitle, setComposeTitle] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composePriority, setComposePriority] = useState<BroadcastPriority>('NORMAL');
  const [composeTargetScope, setComposeTargetScope] = useState<BroadcastTarget>('SEMUA');
  const [composeTargetRoles, setComposeTargetRoles] = useState<string[]>([]);
  const [composeTargetDivisions, setComposeTargetDivisions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  const canBroadcast = !!user && CAN_BROADCAST_ROLES.includes(user.role);

  useEffect(() => {
    if (!activeClass || !user) return;

    const q = query(
      collection(db, 'broadcasts'),
      where('classId', '==', activeClass.id)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as BroadcastMessage));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBroadcasts(list);
      setLoading(false);
    });

    fetchUsersByClass(activeClass.id).then(setUsers);

    return () => unsub();
  }, [activeClass, user]);

  useEffect(() => {
    if (!expandedId) return;
    const q = query(
      collection(db, 'broadcasts', expandedId, 'replies')
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as BroadcastReply));
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setReplies(prev => ({ ...prev, [expandedId]: list }));
    });
    return () => unsub();
  }, [expandedId]);

  const visibleBroadcasts = broadcasts.filter(b => {
    const isSender = b.senderId === user?.uid;
    const isAll = b.targetScope === 'SEMUA';
    const isTargetRole = b.targetRoles?.includes(user?.role || '');
    const isTargetDivision = b.targetDivisions?.includes(user?.divisionName || '');
    const isRecipient = b.recipientIds?.includes(user?.uid || '');

    const isVisible = isSender || isAll || isTargetRole || isTargetDivision || isRecipient;
    if (!isVisible) return false;

    if (filter === 'MINE' && !isSender) return false;
    if (filter === 'TO_ME' && isSender) return false;
    if (filter === 'URGENT' && b.priority !== 'URGENT') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return b.title.toLowerCase().includes(q) ||
             b.content.toLowerCase().includes(q) ||
             b.senderName.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadUrgentCount = broadcasts.filter(b =>
    b.priority === 'URGENT' &&
    b.senderId !== user?.uid &&
    (b.targetScope === 'SEMUA' ||
     b.targetRoles?.includes(user?.role || '') ||
     b.targetDivisions?.includes(user?.divisionName || '') ||
     b.recipientIds?.includes(user?.uid || ''))
  ).length;

  const computeRecipients = (): string[] => {
    const recipientIds = new Set<string>();
    users.forEach(u => {
      if (u.role === 'Guru Pengampu' || u.role === 'Admin' || u.role === 'Super Admin') return;
      if (u.uid === user?.uid) return;

      if (composeTargetScope === 'SEMUA') {
        recipientIds.add(u.uid);
      } else {
        if (composeTargetRoles.includes(u.role)) recipientIds.add(u.uid);
        if (u.divisionName && composeTargetDivisions.includes(u.divisionName)) recipientIds.add(u.uid);
      }
    });
    return Array.from(recipientIds);
  };

  const previewRecipientCount = computeRecipients().length;

  const handleSendBroadcast = async () => {
    if (!user || !activeClass) return;

    if (!composeTitle.trim()) { showToast('Judul wajib diisi.', 'warning'); return; }
    if (!composeContent.trim()) { showToast('Isi pesan wajib diisi.', 'warning'); return; }
    if (composeContent.length > 500) { showToast('Isi pesan maks 500 karakter.', 'warning'); return; }

    const badCheck = containsBadWord(composeContent) || containsBadWord(composeTitle);
    if (badCheck.has) {
      showToast(`Pesan mengandung kata tidak pantas: ${badCheck.found.join(', ')}`, 'error');
      return;
    }

    if (composeTargetScope === 'CUSTOM' &&
        composeTargetRoles.length === 0 &&
        composeTargetDivisions.length === 0) {
      showToast('Pilih minimal 1 peran atau divisi tujuan.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const recipientIds = computeRecipients();
      if (recipientIds.length === 0 && composeTargetScope === 'CUSTOM') {
        showToast('Tidak ada penerima yang cocok dengan target yang dipilih.', 'warning');
        setSubmitting(false);
        return;
      }

      const newRef = doc(collection(db, 'broadcasts'));
      await setDoc(newRef, {
        id: newRef.id,
        classId: activeClass.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderRole: user.role,
        title: composeTitle.trim(),
        content: composeContent.trim(),
        priority: composePriority,
        targetScope: composeTargetScope,
        targetRoles: composeTargetRoles,
        targetDivisions: composeTargetDivisions,
        recipientIds,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      });

      if (recipientIds.length > 0) {
        const batch = writeBatch(db);
        const nowStr = new Date().toISOString();
        recipientIds.forEach(uid => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            id: notifRef.id,
            userId: uid,
            classId: activeClass.id,
            title: composePriority === 'URGENT'
              ? `🚨 BROADCAST URGENT: ${composeTitle.trim()}`
              : `📢 ${composeTitle.trim()}`,
            message: `${user.displayName} (${user.role}): ${composeContent.trim().slice(0, 150)}`,
            category: composePriority === 'URGENT' ? 'Urgent' : 'Pengumuman',
            read: false,
            link: 'broadcast',
            createdAt: nowStr,
          });
        });
        await batch.commit();
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Broadcast', targetId: newRef.id,
        details: `Broadcast "${composeTitle}" → ${recipientIds.length} penerima (${composeTargetScope})`,
      });

      showToast(`Broadcast terkirim ke ${recipientIds.length} penerima!`, 'success');
      setIsComposeOpen(false);
      setComposeTitle('');
      setComposeContent('');
      setComposePriority('NORMAL');
      setComposeTargetScope('SEMUA');
      setComposeTargetRoles([]);
      setComposeTargetDivisions([]);
    } catch (err: any) {
      showToast('Gagal kirim broadcast: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (broadcastId: string) => {
    if (!user || !activeClass) return;
    const text = replyText.trim();
    if (!text) { showToast('Tulis balasan dulu.', 'warning'); return; }
    if (text.length > MAX_REPLY_LENGTH) {
      showToast(`Balasan maks ${MAX_REPLY_LENGTH} karakter.`, 'warning');
      return;
    }

    const badCheck = containsBadWord(text);
    if (badCheck.has) {
      showToast(`Balasan mengandung kata tidak pantas: ${badCheck.found.join(', ')}`, 'error');
      return;
    }

    const myReplies = (replies[broadcastId] || []).filter(r => r.userId === user.uid);
    if (myReplies.length >= MAX_REPLIES_PER_USER) {
      showToast(`Maksimal ${MAX_REPLIES_PER_USER} balasan per broadcast.`, 'warning');
      return;
    }

    const broadcast = broadcasts.find(b => b.id === broadcastId);
    if (!broadcast) return;
    if (broadcast.status === 'CLOSED') {
      showToast('Broadcast ini sudah ditutup oleh pengirim.', 'warning');
      return;
    }

    setReplySending(true);
    try {
      const replyRef = doc(collection(db, 'broadcasts', broadcastId, 'replies'));
      await setDoc(replyRef, {
        id: replyRef.id,
        broadcastId,
        classId: activeClass.id,
        userId: user.uid,
        userName: user.displayName,
        userRole: user.role,
        userDivision: user.divisionName || '',
        content: sanitizeText(text),
        createdAt: new Date().toISOString(),
      });

      if (broadcast.senderId !== user.uid) {
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          userId: broadcast.senderId,
          classId: activeClass.id,
          title: `Balasan dari ${user.displayName}`,
          message: `"${broadcast.title}" → ${text.slice(0, 150)}`,
          category: 'Feedback',
          read: false,
          link: 'broadcast',
          createdAt: new Date().toISOString(),
        });
      }

      showToast('Balasan terkirim!', 'success');
      setReplyText('');
      setReplyTarget(null);
    } catch (err: any) {
      showToast('Gagal kirim balasan: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setReplySending(false);
    }
  };

  const handleDeleteBroadcast = async (b: BroadcastMessage) => {
    if (!user) return;
    const canDel = b.senderId === user.uid ||
                   user.role === 'Guru Pengampu' ||
                   user.role === 'Admin' || user.role === 'Super Admin';
    if (!canDel) { showToast('Tidak berwenang menghapus.', 'warning'); return; }
    if (!confirm(`Hapus broadcast "${b.title}"?\n\nSemua balasan juga akan terhapus.`)) return;

    try {
      const repliesSnap = await getDocs(collection(db, 'broadcasts', b.id, 'replies'));
      const batch = writeBatch(db);
      repliesSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      await deleteDoc(doc(db, 'broadcasts', b.id));
      showToast('Broadcast dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleToggleStatus = async (b: BroadcastMessage) => {
    if (!user) return;
    const canManage = b.senderId === user.uid ||
                      user.role === 'Guru Pengampu' ||
                      user.role === 'Admin' || user.role === 'Super Admin';
    if (!canManage) { showToast('Tidak berwenang.', 'warning'); return; }

    const newStatus: BroadcastStatus = b.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    if (!confirm(
      newStatus === 'CLOSED'
        ? `Tutup broadcast "${b.title}"?\n\nPenerima tidak bisa balas lagi.`
        : `Buka kembali broadcast "${b.title}"?\n\nPenerima bisa balas lagi.`
    )) return;

    try {
      await setDoc(doc(db, 'broadcasts', b.id), {
        status: newStatus,
        closedAt: newStatus === 'CLOSED' ? new Date().toISOString() : null,
      }, { merge: true });
      showToast(newStatus === 'CLOSED' ? 'Broadcast ditutup.' : 'Broadcast dibuka.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 relative">
              <Radio className="w-7 h-7" />
              {unreadUrgentCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadUrgentCount}
                </span>
              )}
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Broadcast & Komunikasi
              </span>
              <h2 className="text-xl font-black text-white mt-1">Pesan Siaran Resmi</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Kirim pengumuman ke semua atau beberapa peran/divisi — penerima dapat membalas
              </p>
            </div>
          </div>
          {canBroadcast && (
            <button onClick={() => setIsComposeOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <Megaphone className="w-4 h-4" /> Buat Broadcast
            </button>
          )}
        </div>

        {!canBroadcast && (
          <div className="mt-3 p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-slate-200 flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Anda hanya dapat <strong>melihat & membalas</strong> broadcast.
              Yang berhak mengirim: Guru, Pimprod, Sekretaris, Bendahara, Sutradara, Asisten, & semua Koordinator.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input type="text" placeholder="Cari broadcast..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { val: 'ALL', label: `Semua (${broadcasts.length})` },
            { val: 'MINE', label: 'Dari Saya' },
            { val: 'TO_ME', label: 'Untuk Saya' },
            { val: 'URGENT', label: `🚨 Urgent (${unreadUrgentCount})` },
          ] as { val: typeof filter; label: string }[]).map(f => (
            <button key={f.val} onClick={() => setFilter(f.val)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                filter === f.val
                  ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          <p className="text-xs text-slate-400">Memuat broadcast...</p>
        </div>
      ) : visibleBroadcasts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Radio className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Broadcast</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canBroadcast ? 'Klik "Buat Broadcast" untuk mengirim pesan pertama.' : 'Tunggu pengumuman dari pengurus.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleBroadcasts.map(b => {
            const prio = getPriorityInfo(b.priority);
            const PrioIcon = prio.icon;
            const isExpanded = expandedId === b.id;
            const bReplies = replies[b.id] || [];
            const isMine = b.senderId === user?.uid;
            const canManage = isMine || user?.role === 'Guru Pengampu' ||
                              user?.role === 'Admin' || user?.role === 'Super Admin';
            const myRepliesCount = bReplies.filter(r => r.userId === user?.uid).length;
            const canReply = !isMine && b.status === 'ACTIVE' && myRepliesCount < MAX_REPLIES_PER_USER;
            const targetInfo = b.targetScope === 'SEMUA'
              ? 'Semua Siswa'
              : [
                  ...(b.targetRoles || []).slice(0, 2),
                  ...(b.targetDivisions || []).slice(0, 2),
                ].join(', ') + (
                  (b.targetRoles?.length || 0) + (b.targetDivisions?.length || 0) > 4
                    ? ` +${(b.targetRoles?.length || 0) + (b.targetDivisions?.length || 0) - 4} lagi`
                    : ''
                );

            return (
              <div key={b.id}
                className={`rounded-3xl bg-white dark:bg-slate-900 border-2 shadow-sm transition ${
                  b.priority === 'URGENT' ? 'border-rose-400 dark:border-rose-500/60'
                    : b.priority === 'PENTING' ? 'border-amber-300 dark:border-amber-500/40'
                    : 'border-slate-200 dark:border-slate-700'
                }`}>
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span className={`p-2.5 rounded-xl border shrink-0 ${prio.bg} ${prio.color} ${prio.border}`}>
                      <PrioIcon className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${prio.bg} ${prio.color} ${prio.border}`}>
                          {prio.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 flex items-center gap-1">
                          <Target className="w-2.5 h-2.5" /> {targetInfo}
                        </span>
                        {b.status === 'CLOSED' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5" /> Ditutup
                          </span>
                        )}
                        {isMine && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                            Saya Kirim
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(b.createdAt).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{b.title}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        <strong className="text-slate-700 dark:text-slate-300">{b.senderName}</strong>
                        <span>({b.senderRole})</span>
                        <span className="text-slate-400">•</span>
                        <span>{b.recipientIds?.length || 0} penerima</span>
                      </p>

                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 leading-relaxed whitespace-pre-line">
                        {b.content}
                      </p>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={() => setExpandedId(isExpanded ? null : b.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition">
                          <MessageSquare className="w-3 h-3" />
                          {bReplies.length > 0 ? `${bReplies.length} Balasan` : 'Lihat Balasan'}
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>

                        {canReply && (
                          <button onClick={() => setReplyTarget(replyTarget === b.id ? null : b.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1.5 transition">
                            <Reply className="w-3 h-3" /> Balas
                          </button>
                        )}

                        {canManage && (
                          <>
                            <button onClick={() => handleToggleStatus(b)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                                b.status === 'CLOSED'
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 hover:bg-emerald-100'
                                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 hover:bg-amber-100'
                              }`}>
                              {b.status === 'CLOSED'
                                ? <><Play className="w-3 h-3" /> Buka</>
                                : <><Pause className="w-3 h-3" /> Tutup</>}
                            </button>
                            <button onClick={() => handleDeleteBroadcast(b)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1.5 transition">
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                          </>
                        )}
                      </div>

                      {!canReply && !isMine && b.status === 'ACTIVE' && myRepliesCount >= MAX_REPLIES_PER_USER && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 italic">
                          Anda sudah mencapai batas {MAX_REPLIES_PER_USER} balasan di broadcast ini.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {replyTarget === b.id && canReply && (
                  <div className="px-5 pb-5">
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <Reply className="w-3.5 h-3.5" /> Balas Broadcast
                        </span>
                        <span className="text-[10px] text-blue-700 dark:text-blue-300">
                          {myRepliesCount}/{MAX_REPLIES_PER_USER} balasan
                        </span>
                      </div>
                      <textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Tulis balasan sopan (maks 300 karakter)..."
                        maxLength={MAX_REPLY_LENGTH}
                        className="w-full p-2.5 rounded-xl border border-blue-200 dark:border-blue-500/40 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/30" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {replyText.length}/{MAX_REPLY_LENGTH}
                        </span>
                        {replyText && containsBadWord(replyText).has && (
                          <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Mengandung kata tidak pantas
                          </span>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setReplyTarget(null); setReplyText(''); }}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                          Batal
                        </button>
                        <button onClick={() => handleSendReply(b.id)}
                          disabled={replySending || !replyText.trim() || containsBadWord(replyText).has}
                          className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-[11px] disabled:opacity-50 flex items-center gap-1.5">
                          <Send className="w-3 h-3" />
                          {replySending ? 'Mengirim...' : 'Kirim Balasan'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                      💬 Balasan ({bReplies.length})
                    </p>
                    {bReplies.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">
                        Belum ada balasan.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {bReplies.map(r => (
                          <div key={r.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                r.userRole === b.senderRole
                                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                              }`}>
                                {r.userRole}
                              </span>
                              {r.userDivision && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  {r.userDivision}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                {r.userName}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(r.createdAt).toLocaleString('id-ID', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                              {r.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isComposeOpen && canBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">

            <div className="p-5 bg-gradient-to-r from-indigo-700 to-purple-800 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
                    <Megaphone className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Broadcast</span>
                    <h3 className="text-lg font-black mt-0.5">Buat Pesan Siaran</h3>
                  </div>
                </div>
                <button onClick={() => setIsComposeOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul Broadcast <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  placeholder="Contoh: Rapat Pleno Tambahan Hari Sabtu"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                <p className="text-[10px] text-slate-400 mt-0.5">{composeTitle.length}/100</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Prioritas
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['NORMAL', 'PENTING', 'URGENT'] as BroadcastPriority[]).map(p => {
                    const info = PRIORITY_CONFIG[p];
                    const Icon = info.icon;
                    const isSel = composePriority === p;
                    return (
                      <button key={p} type="button" onClick={() => setComposePriority(p)}
                        className={`p-2.5 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isSel ? `${info.bg} ${info.color} ${info.border}` : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                        <Icon className="w-3.5 h-3.5" />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tujuan Broadcast <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setComposeTargetScope('SEMUA')}
                    className={`p-3 rounded-xl border-2 text-left transition flex items-center gap-2 ${
                      composeTargetScope === 'SEMUA'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}>
                    <div className={`p-0.5 rounded-md ${composeTargetScope === 'SEMUA' ? 'bg-indigo-500 text-white' : 'border-2 border-slate-300'}`}>
                      {composeTargetScope === 'SEMUA' ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Semua Siswa
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Dikirim ke seluruh siswa kelas
                      </p>
                    </div>
                  </button>

                  <button type="button"
                    onClick={() => setComposeTargetScope('CUSTOM')}
                    className={`p-3 rounded-xl border-2 text-left transition flex items-center gap-2 ${
                      composeTargetScope === 'CUSTOM'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}>
                    <div className={`p-0.5 rounded-md ${composeTargetScope === 'CUSTOM' ? 'bg-indigo-500 text-white' : 'border-2 border-slate-300'}`}>
                      {composeTargetScope === 'CUSTOM' ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-transparent" />}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" /> Peran / Divisi Tertentu
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Pilih beberapa peran atau divisi
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {composeTargetScope === 'CUSTOM' && (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" /> Peran Penerima
                      {composeTargetRoles.length > 0 && (
                        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-md">
                          {composeTargetRoles.length} dipilih
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {ROLE_LIST.map(r => {
                        const sel = composeTargetRoles.includes(r);
                        return (
                          <button key={r} type="button"
                            onClick={() => setComposeTargetRoles(prev =>
                              prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
                            )}
                            className={`p-2 rounded-lg border-2 text-[10px] font-bold transition text-left flex items-center gap-1.5 ${
                              sel ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                            {sel ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0" />}
                            <span className="truncate">{r}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-500" /> Divisi Penerima
                      {composeTargetDivisions.length > 0 && (
                        <span className="text-[10px] font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-md">
                          {composeTargetDivisions.length} dipilih
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {DIVISION_LIST.map(d => {
                        const sel = composeTargetDivisions.includes(d);
                        return (
                          <button key={d} type="button"
                            onClick={() => setComposeTargetDivisions(prev =>
                              prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                            )}
                            className={`p-2 rounded-lg border-2 text-[10px] font-bold transition text-left flex items-center gap-1.5 ${
                              sel ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                            {sel ? <CheckSquare className="w-3 h-3 shrink-0" /> : <Square className="w-3 h-3 shrink-0" />}
                            <span className="truncate">{d}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Isi Pesan <span className="text-rose-500">*</span>
                </label>
                <textarea rows={5} required value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  placeholder="Tuliskan isi pesan broadcast secara jelas dan ringkas..."
                  maxLength={500}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed" />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-slate-400">{composeContent.length}/500</p>
                  {composeContent && containsBadWord(composeContent).has && (
                    <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Mengandung kata tidak pantas
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/40 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                  Broadcast akan dikirim ke <strong>{previewRecipientCount} siswa</strong>
                  {composeTargetScope === 'CUSTOM' && ' (hasil filter peran/divisi)'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/40 flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Catatan:</strong> Penerima dapat membalas maksimal 3× per broadcast.
                  Balasan Anda sebagai pengirim akan terlihat oleh semua penerima.
                </p>
              </div>

            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsComposeOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Batal
              </button>
              <button type="button" onClick={handleSendBroadcast}
                disabled={submitting || !composeTitle.trim() || !composeContent.trim() ||
                  (composeTargetScope === 'CUSTOM' && composeTargetRoles.length === 0 && composeTargetDivisions.length === 0) ||
                  containsBadWord(composeContent).has || containsBadWord(composeTitle).has}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Mengirim...' : `Kirim ke ${previewRecipientCount} Siswa`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
