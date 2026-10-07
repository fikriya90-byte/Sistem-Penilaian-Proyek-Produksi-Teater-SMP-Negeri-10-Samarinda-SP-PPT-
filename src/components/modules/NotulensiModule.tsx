import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, X, Save, Trash2, Edit3, Calendar, Users, Clock,
  Search, ExternalLink, User, CheckCircle, AlertTriangle,
  Printer, Link2, Upload, Info, Eye,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc,
  writeBatch, getDocs,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog, fetchUsersByClass } from '../../services/firestoreService';
import { UserProfile } from '../../core/types';

interface NotulensiItem {
  id: string;
  classId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  agenda: string;
  discussion: string;
  decisions: string;
  attendees: string[];
  attachmentUrl: string;
  attachmentName: string;
  createdBy: string;
  creatorName: string;
  creatorRole: string;
  createdAt: string;
  updatedAt?: string;
}

// HANYA role ini yang bisa buat/edit/hapus notulen
const CAN_MANAGE_NOTULENSI = [
  'Sekretaris',
  'Guru Pengampu',
  'Guru Pembina',
  'Admin',
  'Super Admin',
  'Pimpinan Produksi',
];

export const NotulensiModule: React.FC = () => {
  const { user, activeClass, isGuruPengampu, isAdminRole, isPimprod, isSekretaris } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<NotulensiItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NotulensiItem | null>(null);
  const [detailItem, setDetailItem] = useState<NotulensiItem | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [location, setLocation] = useState('Ruang Teater SMPN 10');
  const [agenda, setAgenda] = useState('');
  const [discussion, setDiscussion] = useState('');
  const [decisions, setDecisions] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ============================================================
  // PERMISSION: HANYA Sekretaris + Guru/Admin/Pimprod yang bisa kelola
  // ============================================================
  const canManage = !!user && CAN_MANAGE_NOTULENSI.includes(user.role);

  useEffect(() => {
    if (!activeClass) return;
    const q = query(collection(db, 'notulensi'), where('classId', '==', activeClass.id));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as NotulensiItem));
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(list);
      setLoading(false);
    });
    fetchUsersByClass(activeClass.id).then(setUsers);
    return () => unsub();
  }, [activeClass]);

  const students = users.filter(u =>
    u.role !== 'Guru Pengampu' && u.role !== 'Admin' && u.role !== 'Super Admin'
  );

  const openCreate = () => {
    setEditingItem(null);
    setTitle('');
    setDate(new Date().toISOString().slice(0, 10));
    setStartTime('14:00');
    setEndTime('16:00');
    setLocation('Ruang Teater SMPN 10');
    setAgenda('');
    setDiscussion('');
    setDecisions('');
    setAttendees([]);
    setAttachmentUrl('');
    setAttachmentName('');
    setIsModalOpen(true);
  };

  const openEdit = (item: NotulensiItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setDate(item.date);
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setLocation(item.location);
    setAgenda(item.agenda);
    setDiscussion(item.discussion);
    setDecisions(item.decisions);
    setAttendees(item.attendees || []);
    setAttachmentUrl(item.attachmentUrl || '');
    setAttachmentName(item.attachmentName || '');
    setIsModalOpen(true);
  };

  const toggleAttendee = (uid: string) => {
    setAttendees(prev =>
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    );
  };

  // ============================================================
  // HANDLE SAVE + KIRIM NOTIFIKASI KE SEMUA SISWA (kalau baru)
  // ============================================================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!canManage) {
      showToast('Hanya Sekretaris yang dapat mengisi notulensi.', 'warning');
      return;
    }
    if (!title.trim() || !agenda.trim() || !discussion.trim() || !decisions.trim()) {
      showToast('Judul, agenda, pembahasan, dan keputusan wajib diisi.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const isNew = !editingItem;
      const id = editingItem?.id || doc(collection(db, 'notulensi')).id;
      const data: NotulensiItem = {
        id,
        classId: activeClass.id,
        title: title.trim(),
        date,
        startTime,
        endTime,
        location: location.trim(),
        agenda: agenda.trim(),
        discussion: discussion.trim(),
        decisions: decisions.trim(),
        attendees,
        attachmentUrl: attachmentUrl.trim(),
        attachmentName: attachmentName.trim(),
        createdBy: editingItem?.createdBy || user.uid,
        creatorName: editingItem?.creatorName || user.displayName,
        creatorRole: editingItem?.creatorRole || user.role,
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'notulensi', id), data, { merge: true });

      // ============================================================
      // NOTIFIKASI KE SEMUA SISWA — hanya saat BUAT BARU
      // ============================================================
      if (isNew) {
        try {
          const recipients = users.filter(u =>
            u.role !== 'Guru Pengampu' &&
            u.role !== 'Admin' &&
            u.role !== 'Super Admin' &&
            u.uid !== user.uid
          );

          if (recipients.length > 0) {
            const batch = writeBatch(db);
            const nowStr = new Date().toISOString();
            recipients.forEach(r => {
              const notifRef = doc(collection(db, 'notifications'));
              batch.set(notifRef, {
                id: notifRef.id,
                userId: r.uid,
                classId: activeClass.id,
                title: `📝 Notulen Baru: ${title.trim()}`,
                message: `Sekretaris ${user.displayName} mencatat notulen rapat "${title.trim()}" (${new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}). Buka menu Notulensi untuk membaca detailnya.`,
                category: 'Pengumuman',
                read: false,
                link: 'notulensi',
                createdAt: nowStr,
              });
            });
            await batch.commit();
            console.log(`Notifikasi notulen terkirim ke ${recipients.length} siswa.`);
          }
        } catch (err) {
          console.warn('Gagal kirim notifikasi notulen:', err);
        }
      }

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: editingItem ? 'UPDATE' : 'CREATE',
        targetType: 'Notulensi', targetId: id,
        details: `${editingItem ? 'Edit' : 'Buat'} notulen: "${title}"`,
      });

      showToast(
        isNew
          ? `Notulen tersimpan & notifikasi terkirim ke semua siswa!`
          : 'Notulen diperbarui!',
        'success'
      );
      setIsModalOpen(false);
    } catch (err: any) {
      showToast('Gagal simpan: ' + (err?.message || 'Unknown'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: NotulensiItem) => {
    if (!user) return;
    if (!canManage) {
      showToast('Hanya Sekretaris yang dapat menghapus notulensi.', 'warning');
      return;
    }
    if (!confirm(`Hapus notulen "${item.title}"?\n\nTindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteDoc(doc(db, 'notulensi', item.id));
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'DELETE', targetType: 'Notulensi', targetId: item.id,
        details: `Hapus notulen: "${item.title}"`,
      });
      showToast('Notulen dihapus.', 'info');
      setDetailItem(null);
    } catch (err: any) {
      showToast('Gagal hapus: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handlePrint = (item: NotulensiItem) => {
    const attendeeNames = item.attendees
      .map(uid => users.find(u => u.uid === uid)?.displayName || uid)
      .join(', ');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Notulen - ${item.title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; padding: 30px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
    h2 { text-align: center; font-size: 14px; font-weight: normal; color: #475569; margin-top: 0; }
    .info { margin: 20px 0; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 12px; }
    .info strong { display: inline-block; width: 100px; }
    .section { margin: 16px 0; }
    .section-title { font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #1e293b; }
    .section-content { font-size: 12px; line-height: 1.6; padding-left: 12px; white-space: pre-line; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>NOTULEN RAPAT</h1>
  <h2>${item.title}</h2>
  <div class="info">
    <div><strong>Tanggal</strong>: ${new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
    <div><strong>Waktu</strong>: ${item.startTime} - ${item.endTime} WITA</div>
    <div><strong>Lokasi</strong>: ${item.location}</div>
    <div><strong>Pencatat</strong>: ${item.creatorName} (${item.creatorRole})</div>
    <div><strong>Hadir</strong>: ${attendeeNames || 'Tidak ada data'}</div>
  </div>
  <div class="section">
    <div class="section-title">AGENDA RAPAT</div>
    <div class="section-content">${item.agenda}</div>
  </div>
  <div class="section">
    <div class="section-title">PEMBAHASAN</div>
    <div class="section-content">${item.discussion}</div>
  </div>
  <div class="section">
    <div class="section-title">KEPUTUSAN</div>
    <div class="section-content">${item.decisions}</div>
  </div>
  ${item.attachmentUrl ? `
  <div class="section">
    <div class="section-title">LAMPIRAN</div>
    <div class="section-content"><a href="${item.attachmentUrl}">${item.attachmentName || 'Link Lampiran'}</a></div>
  </div>` : ''}
  <div class="footer">
    Dokumen dihasilkan oleh SP-PPT — SMP Negeri 10 Samarinda<br>
    Dicetak: ${new Date().toLocaleString('id-ID')}
  </div>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) { showToast('Popup diblokir browser.', 'warning'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const filtered = items.filter(it => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return it.title.toLowerCase().includes(q) ||
           it.agenda.toLowerCase().includes(q) ||
           it.location.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-900 text-white shadow-xl border border-blue-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <FileText className="w-7 h-7" />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Notulensi Digital
              </span>
              <h2 className="text-xl font-black text-white mt-1">Notulen Rapat & Diskusi</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {canManage
                  ? 'Catatan resmi rapat — Anda dapat mengelola notulen'
                  : 'Catatan resmi rapat — mode lihat saja'}
              </p>
            </div>
          </div>

          {canManage && (
            <button onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg">
              <Plus className="w-4 h-4" /> Buat Notulen Baru
            </button>
          )}
        </div>

        {/* Info View-Only untuk yang tidak berwenang */}
        {!canManage && (
          <div className="mt-3 p-2.5 rounded-xl bg-white/10 border border-white/20 text-[11px] text-slate-200 flex items-start gap-2">
            <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Anda dapat <strong>membaca semua notulen</strong> rapat.
              Yang berhak membuat & mengedit: <strong>Sekretaris</strong> (dibantu Guru/Pimpinan Produksi).
            </span>
          </div>
        )}
      </div>

      {/* SEARCH */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input type="text" placeholder="Cari notulen..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
      </div>

      {/* LIST */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-400">Memuat notulen...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">Belum Ada Notulen</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canManage ? 'Klik "Buat Notulen Baru" untuk mencatat rapat pertama.' : 'Tunggu Sekretaris membuat catatan rapat.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(it => {
            const attendeeCount = (it.attendees || []).length;
            return (
              <div key={it.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition space-y-3">
                <div className="flex items-start gap-3">
                  <span className="p-2.5 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shrink-0">
                    <FileText className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-500/30">
                      {new Date(it.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1.5 line-clamp-2">
                      {it.title}
                    </h3>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{it.startTime} - {it.endTime} WITA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 shrink-0" />
                    <span>{attendeeCount} peserta</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 shrink-0" />
                    <span>Dicatat oleh: <strong className="text-slate-700 dark:text-slate-300">{it.creatorName}</strong></span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic leading-relaxed">
                  Agenda: {it.agenda}
                </p>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2">
                  <button onClick={() => setDetailItem(it)}
                    className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition">
                    <FileText className="w-3.5 h-3.5" /> Lihat Detail
                  </button>
                  <button onClick={() => handlePrint(it)}
                    className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-bold text-xs flex items-center justify-center gap-1 transition"
                    title="Cetak / PDF">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  {canManage && (
                    <>
                      <button onClick={() => openEdit(it)}
                        className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-bold text-xs flex items-center justify-center transition"
                        title="Edit">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(it)}
                        className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-bold text-xs flex items-center justify-center transition"
                        title="Hapus">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Notulen Rapat</span>
                  <h3 className="text-lg font-black mt-1">{detailItem.title}</h3>
                </div>
                <button onClick={() => setDetailItem(null)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-800 dark:text-slate-200">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Tanggal</p>
                  <p className="font-bold mt-0.5">
                    {new Date(detailItem.date).toLocaleDateString('id-ID', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Waktu</p>
                  <p className="font-bold mt-0.5">{detailItem.startTime} - {detailItem.endTime} WITA</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 col-span-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Lokasi</p>
                  <p className="font-bold mt-0.5">{detailItem.location}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Agenda</p>
                <p className="text-xs leading-relaxed whitespace-pre-line">{detailItem.agenda}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase mb-1">Pembahasan</p>
                <p className="text-xs leading-relaxed whitespace-pre-line">{detailItem.discussion}</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase mb-1">Keputusan</p>
                <p className="text-xs leading-relaxed whitespace-pre-line text-amber-900 dark:text-amber-200">{detailItem.decisions}</p>
              </div>

              {detailItem.attendees.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-2">
                    Hadir ({detailItem.attendees.length} peserta)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {detailItem.attendees.map(uid => {
                      const u = users.find(x => x.uid === uid);
                      return u ? (
                        <span key={uid} className="text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                          {u.displayName} <span className="text-slate-400">({u.role})</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {detailItem.attachmentUrl && (
                <a href={detailItem.attachmentUrl} target="_blank" rel="noreferrer"
                  className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition">
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span className="font-bold truncate">{detailItem.attachmentName || 'Lampiran'}</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-auto shrink-0" />
                </a>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-2 shrink-0">
              <button onClick={() => handlePrint(detailItem)}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Printer className="w-3.5 h-3.5" /> Cetak / PDF
              </button>
              <button onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL — hanya untuk yang berwenang */}
      {isModalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm">
                    <FileText className="w-6 h-6" />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                      {editingItem ? 'Edit Notulen' : 'Notulen Baru'}
                    </span>
                    <h3 className="text-lg font-black mt-0.5">
                      {editingItem ? 'Perbarui Catatan Rapat' : 'Catat Rapat Baru'}
                    </h3>
                  </div>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {!editingItem && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <strong>Info:</strong> Setelah Anda klik Simpan, <strong>semua siswa akan menerima notifikasi</strong> otomatis tentang notulen baru ini.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Judul / Topik Rapat <span className="text-rose-500">*</span>
                </label>
                <input type="text" required value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Rapat Pleno Evaluasi Progres Minggu ke-3"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal</label>
                  <input type="date" required value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mulai</label>
                  <input type="time" required value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selesai</label>
                  <input type="time" required value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lokasi</label>
                  <input type="text" required value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Agenda Rapat <span className="text-rose-500">*</span>
                </label>
                <textarea rows={3} required value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="Contoh:&#10;1. Pembukaan oleh Pimpinan Produksi&#10;2. Laporan progres tiap divisi&#10;3. Pembahasan hambatan"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pembahasan / Diskusi <span className="text-rose-500">*</span>
                </label>
                <textarea rows={5} required value={discussion}
                  onChange={(e) => setDiscussion(e.target.value)}
                  placeholder="Tuliskan poin-poin pembahasan, tanggapan, usulan, dan hasil diskusi..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Keputusan / Hasil Rapat <span className="text-rose-500">*</span>
                </label>
                <textarea rows={4} required value={decisions}
                  onChange={(e) => setDecisions(e.target.value)}
                  placeholder="Contoh:&#10;1. Kostum Ratu Aji diselesaikan H-14&#10;2. Latihan tambahan tiap Sabtu pukul 14.00"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Peserta Hadir ({attendees.length})
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAttendees(students.map(u => u.uid))}
                      className="text-[10px] font-bold text-blue-600 hover:underline">
                      Pilih Semua
                    </button>
                    <button type="button" onClick={() => setAttendees([])}
                      className="text-[10px] font-bold text-rose-600 hover:underline">
                      Hapus
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                  {students.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-3">Belum ada data siswa.</p>
                  ) : students.map(u => {
                    const sel = attendees.includes(u.uid);
                    return (
                      <button type="button" key={u.uid} onClick={() => toggleAttendee(u.uid)}
                        className={`w-full p-2 rounded-lg text-[11px] font-bold transition text-left flex items-center gap-2 ${
                          sel ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}>
                        <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                          sel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {sel && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span className="truncate">{u.displayName}</span>
                        <span className="text-[9px] text-slate-400 ml-auto truncate">({u.role})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200">
                    Lampiran (Opsional — Nota, Foto, Dokumen)
                  </span>
                </div>
                <input type="text" value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="Nama lampiran (mis. Foto Rapat 12 Okt)"
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white" />
                <div className="relative">
                  <Link2 className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input type="url" value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Batal
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {submitting ? 'Menyimpan...' : (editingItem ? 'Perbarui Notulen' : 'Simpan & Kirim Notifikasi')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};