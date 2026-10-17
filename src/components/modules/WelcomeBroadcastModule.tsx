import React, { useState, useEffect } from 'react';
import {
  Radio, Megaphone, Send, AlertTriangle, Users, Check,
  Shield, Clock, Trash2, Search, Camera, ImagePlus, X,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  collection, query, onSnapshot, doc, setDoc, writeBatch,
  orderBy, limit, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { PhotoUploadModal } from '../common/PhotoUploadModal';

type Priority = 'NORMAL' | 'PENTING' | 'URGENT';

interface CrossBroadcast {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  title: string;
  content: string;
  priority: Priority;
  photoUrl?: string;
  targetClassIds: string[];
  targetClassNames: string[];
  totalRecipients: number;
  createdAt: string;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: any }> = {
  NORMAL: { label: 'Normal', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: Megaphone },
  PENTING: { label: 'Penting', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: AlertTriangle },
  URGENT: { label: 'URGENT', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: AlertTriangle },
};

export const WelcomeBroadcastModule: React.FC = () => {
  const { user, classes, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<CrossBroadcast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // ✅ NEW: Foto state
  const [photoUrl, setPhotoUrl] = useState('');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const canSend = isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!canSend) return;
    const q = query(collection(db, 'crossClassBroadcasts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q,
      snap => {
        setHistory(snap.docs.map(d => ({ ...d.data(), id: d.id } as CrossBroadcast)));
        setLoading(false);
      },
      err => { console.warn('history error:', err); setLoading(false); }
    );
    return () => unsub();
  }, [canSend]);

  const toggleClass = (id: string) => {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSendToAll(false);
  };

  const handleSendToAllToggle = () => {
    const next = !sendToAll;
    setSendToAll(next);
    if (next) setSelectedClassIds(classes.map(c => c.id));
    else setSelectedClassIds([]);
  };

  const handleReset = () => {
    setTitle('');
    setContent('');
    setPriority('NORMAL');
    setSelectedClassIds([]);
    setSendToAll(false);
    setPhotoUrl('');
  };

  const handleSend = async () => {
    if (!user) return;
    if (!title.trim() || !content.trim()) { showToast('Judul & isi wajib diisi.', 'warning'); return; }
    if (selectedClassIds.length === 0) { showToast('Pilih minimal 1 kelas.', 'warning'); return; }

    if (!confirm(`Kirim broadcast ke ${selectedClassIds.length} kelas?`)) return;
    setSending(true);

    try {
      const recipients: { classId: string; userIds: string[] }[] = [];
      for (const cid of selectedClassIds) {
        const users = await fetchUsersByClass(cid);
        const userIds = users
          .filter(u => u.role !== 'Guru Pengampu' && u.role !== 'Guru Pembina'
                    && u.role !== 'Admin' && u.role !== 'Super Admin')
          .map(u => u.uid);
        recipients.push({ classId: cid, userIds });
      }
      const totalRecipients = recipients.reduce((s, r) => s + r.userIds.length, 0);
      const targetClassNames = selectedClassIds
        .map(id => classes.find(c => c.id === id)?.name || '-')
        .filter(Boolean);

      const crossRef = doc(collection(db, 'crossClassBroadcasts'));
      await setDoc(crossRef, {
        id: crossRef.id,
        senderId: user.uid, senderName: user.displayName, senderRole: user.role,
        title: title.trim(), content: content.trim(), priority,
        photoUrl: photoUrl || '',
        targetClassIds: selectedClassIds, targetClassNames, totalRecipients,
        createdAt: new Date().toISOString(),
      });

      for (const { classId, userIds } of recipients) {
        const bRef = doc(collection(db, 'broadcasts'));
        await setDoc(bRef, {
          id: bRef.id, classId,
          senderId: user.uid, senderName: user.displayName, senderRole: user.role,
          title: title.trim(), content: content.trim(),
          priority,
          photoUrl: photoUrl || '',
          targetScope: 'SEMUA',
          targetRoles: [], targetDivisions: [],
          recipientIds: userIds,
          status: 'ACTIVE',
          crossClassId: crossRef.id,
          createdAt: new Date().toISOString(),
        });
      }

      // Notifikasi — judul TANPA emoji
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      recipients.forEach(({ classId, userIds }) => {
        userIds.forEach(uid => {
          const nRef = doc(collection(db, 'notifications'));
          batch.set(nRef, {
            id: nRef.id, userId: uid, classId,
            title: priority === 'URGENT'
              ? `URGENT: ${title.trim()}`
              : title.trim(),
            message: `${user.displayName} (${user.role}): ${content.trim().slice(0, 150)}`,
            category: priority === 'URGENT' ? 'Urgent' : 'Pengumuman',
            read: false, link: 'broadcast',
            createdAt: now,
          });
        });
      });
      await batch.commit();

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'CrossClassBroadcast', targetId: crossRef.id,
        details: `Broadcast lintas kelas: "${title}" → ${selectedClassIds.length} kelas (${totalRecipients} siswa)${photoUrl ? ' + foto' : ''}`,
      });

      showToast(`Broadcast terkirim ke ${selectedClassIds.length} kelas (${totalRecipients} siswa)`, 'success');
      handleReset();
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    } finally { setSending(false); }
  };

  const handleDeleteHistory = async (item: CrossBroadcast) => {
    if (!confirm(`Hapus riwayat broadcast "${item.title}"?\n\nIni hanya menghapus riwayat — broadcast di kelas tetap ada.`)) return;
    try {
      await deleteDoc(doc(db, 'crossClassBroadcasts', item.id));
      showToast('Riwayat dihapus.', 'info');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const filteredHistory = history.filter(h => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return h.title.toLowerCase().includes(q) || h.content.toLowerCase().includes(q);
  });

  if (!canSend) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 mt-1">Hanya Guru & Admin yang dapat mengirim broadcast lintas kelas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-900 via-slate-900 to-slate-800 text-white shadow-xl border border-rose-500/20">
        <div className="flex items-start gap-3">
          <span className="p-3 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
            <Radio className="w-7 h-7" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
              Broadcast Lintas Kelas
            </span>
            <h2 className="text-xl font-black text-white mt-1">Kirim Pengumuman ke Semua Kelas</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Satu pesan untuk beberapa/semua kelas IX sekaligus, bisa disertai foto.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* FORM KIRI */}
        <div className="lg:col-span-3 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-rose-500" /> Buat Broadcast Baru
          </h3>

          {/* JUDUL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Judul <span className="text-rose-500">*</span>
            </label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Rapat Pleno Seluruh Kelas IX"
              maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            <p className="text-[10px] text-slate-400 mt-0.5">{title.length}/100</p>
          </div>

          {/* PRIORITAS */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Prioritas</label>
            <div className="grid grid-cols-3 gap-2">
              {(['NORMAL', 'PENTING', 'URGENT'] as Priority[]).map(p => {
                const cfg = PRIORITY_CONFIG[p];
                const Icon = cfg.icon;
                const isSel = priority === p;
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`p-2.5 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      isSel ? cfg.color : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                    <Icon className="w-3.5 h-3.5" /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* KELAS TUJUAN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Kelas Tujuan <span className="text-rose-500">*</span>
            </label>

            <button type="button" onClick={handleSendToAllToggle}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition mb-2 ${
                sendToAll ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700'
              }`}>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                sendToAll ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'
              }`}>
                {sendToAll && <Check className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 text-left flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">SEMUA KELAS</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Kirim ke seluruh {classes.length} kelas sekaligus
                  </p>
                </div>
              </div>
            </button>

            <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              {classes.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-3">Belum ada kelas</p>
              ) : classes.map(c => {
                const sel = selectedClassIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                    className={`w-full p-2.5 rounded-lg text-left transition flex items-center gap-2.5 ${
                      sel
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                    }`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      sel ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'
                    }`}>
                      {sel && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                      {c.kerabatKerja && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{c.kerabatKerja}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2">
              {selectedClassIds.length} dari {classes.length} kelas dipilih
            </p>
          </div>

          {/* ISI PESAN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Isi Pesan <span className="text-rose-500">*</span>
            </label>
            <textarea rows={5} required value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis pesan pengumuman yang jelas dan singkat..."
              maxLength={500}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white" />
            <p className="text-[10px] text-slate-400 mt-0.5">{content.length}/500</p>
          </div>

          {/* ✅ FOTO BUKTI (OPSIONAL) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5" />
              Foto Pendukung <span className="text-slate-400 font-normal">(Opsional)</span>
            </label>

            {photoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <img src={photoUrl} alt="Foto broadcast"
                  className="w-full max-h-56 object-contain bg-slate-100 dark:bg-slate-900" />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button type="button" onClick={() => setIsPhotoModalOpen(true)}
                    className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 shadow-md hover:bg-white"
                    title="Ganti foto">
                    <Camera className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setPhotoUrl('')}
                    className="p-2 rounded-lg bg-rose-600 text-white shadow-md hover:bg-rose-700"
                    title="Hapus foto">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setIsPhotoModalOpen(true)}
                className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex flex-col items-center gap-2">
                <ImagePlus className="w-8 h-8 text-slate-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tambah Foto</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
                  Upload dari perangkat (auto-kompres) atau tempel link Google Drive
                </span>
              </button>
            )}
          </div>

          {/* INFO BOX */}
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
              Broadcast dikirim ke <strong>seluruh siswa</strong> di kelas terpilih. Setiap siswa menerima notifikasi.
              Foto akan tampil di halaman Broadcast kelas.
            </p>
          </div>

          {/* AKSI */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={handleReset}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              Reset Form
            </button>
            <button onClick={handleSend}
              disabled={sending || selectedClassIds.length === 0 || !title.trim() || !content.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black text-sm shadow-lg disabled:opacity-50 flex items-center gap-2">
              <Send className="w-4 h-4" />
              {sending ? 'Mengirim...' : `Kirim ke ${selectedClassIds.length} Kelas`}
            </button>
          </div>
        </div>

        {/* RIWAYAT KANAN */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" /> Riwayat
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input type="text" placeholder="Cari..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] w-40" />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-400">Memuat riwayat...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200">
              <Radio className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">Belum ada riwayat broadcast</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {filteredHistory.map(h => {
                const cfg = PRIORITY_CONFIG[h.priority];
                return (
                  <div key={h.id}
                    className={`p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 ${
                      h.priority === 'URGENT' ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200">
                        {h.targetClassIds.length} kelas
                      </span>
                      {h.photoUrl && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 flex items-center gap-1">
                          <ImagePlus className="w-2.5 h-2.5" /> FOTO
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400 ml-auto">
                        {new Date(h.createdAt).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">{h.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{h.content}</p>
                    {h.photoUrl && (
                      <img src={h.photoUrl} alt="Foto"
                        className="mt-2 w-full max-h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {h.totalRecipients} penerima
                      </span>
                      <button onClick={() => handleDeleteHistory(h)}
                        className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ✅ MODAL UPLOAD FOTO */}
      {isPhotoModalOpen && (
        <PhotoUploadModal
          currentPhotoUrl={photoUrl}
          userName={user?.displayName || 'Guru'}
          onSave={async (url) => {
            setPhotoUrl(url);
            setIsPhotoModalOpen(false);
          }}
          onClose={() => setIsPhotoModalOpen(false)}
        />
      )}
    </div>
  );
};
