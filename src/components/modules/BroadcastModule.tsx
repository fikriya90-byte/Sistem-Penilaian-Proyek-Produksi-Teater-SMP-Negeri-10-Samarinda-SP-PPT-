import React, { useState, useEffect } from 'react';
import {
  MessageCircle, PlusCircle, Radio, Send, Share2, Users, X, Save,
  Copy, Check, Settings, Phone, ExternalLink, Info, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS } from '../../core/constants';
import { BroadcastMessage, DivisionType } from '../../core/types';
import { recordAuditLog, sendBroadcast, subscribeBroadcasts } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';

export const BroadcastModule: React.FC = () => {
  const { user, activeClass, isTeacher, isPimprod, isSekretaris, isSutradara, isKoordinator } = useAuth();
  const { showToast } = useToast();

  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // WA Settings
  const [waGroupLink, setWaGroupLink] = useState('');
  const [waGroupName, setWaGroupName] = useState('');
  const [autoOpenWA, setAutoOpenWA] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState<'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM'>('SEMUA');
  const [targetDivision, setTargetDivision] = useState<DivisionType>('Perlengkapan');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canBroadcast = isTeacher || isPimprod || isSekretaris || isSutradara || isKoordinator;

  // ============================================================
  // SUBSCRIBE BROADCASTS
  // ============================================================
  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeBroadcasts(activeClass.id, (bList) => {
      const sorted = [...bList].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setBroadcasts(sorted);
    });
    return () => unsub();
  }, [activeClass]);

  // ============================================================
  // LOAD WA SETTINGS
  // ============================================================
  useEffect(() => {
    if (!activeClass) return;
    (async () => {
      try {
        const ref = doc(db, 'classes', activeClass.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setWaGroupLink(data.waGroupLink || '');
          setWaGroupName(data.waGroupName || '');
          setAutoOpenWA(data.autoOpenWA !== false);
        }
      } catch (err) {
        console.warn('Gagal load WA settings:', err);
      }
    })();
  }, [activeClass]);

  // ============================================================
  // SAVE WA SETTINGS
  // ============================================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;

    // Validasi link WA
    if (waGroupLink.trim() && !waGroupLink.includes('chat.whatsapp.com') && !waGroupLink.includes('wa.me')) {
      showToast('Link WA tidak valid. Harus dari chat.whatsapp.com atau wa.me', 'warning');
      return;
    }

    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'classes', activeClass.id), {
        waGroupLink: waGroupLink.trim(),
        waGroupName: waGroupName.trim(),
        autoOpenWA,
      }, { merge: true });
      showToast('Pengaturan WhatsApp tersimpan!', 'success');
      setIsSettingsOpen(false);
    } catch (err: any) {
      showToast('Gagal simpan: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // ============================================================
  // BUILD WA MESSAGE
  // ============================================================
  const buildWhatsAppMessage = (b: BroadcastMessage | { title: string; content: string; target: string; targetDivision?: string; senderName: string; senderRole: string }) => {
    const targetLabel =
      b.target === 'SEMUA' ? 'Semua Anggota' :
      b.target === 'DIVISI' ? `Divisi ${b.targetDivision || ''}` :
      b.target === 'PERAN' ? 'Peran Tertentu' :
      'Custom';

    return (
      `📢 *PENGUMUMAN RESMI*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*${b.title}*\n\n` +
      `${b.content}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Dari: ${b.senderName} (${b.senderRole})\n` +
      `🎯 Target: ${targetLabel}\n` +
      `🏫 ${activeClass?.name || ''} — ${activeClass?.kerabatKerja || 'SP-PPT'}\n` +
      `📅 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
    );
  };

  // ============================================================
  // COPY MESSAGE
  // ============================================================
  const handleCopy = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      showToast('Pesan disalin! Tempel di WA.', 'success');
    } catch {
      showToast('Gagal menyalin.', 'error');
    }
  };

  // ============================================================
  // OPEN WA — GROUP / PERSONAL / SHARE
  // ============================================================
  const openWhatsAppGroup = (message: string) => {
    if (!waGroupLink.trim()) {
      // Kalau belum setting, fallback ke share generic
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      showToast('Membuka WhatsApp — pilih grup/chat tujuan.', 'info');
      return;
    }

    // Kalau link grup: buka grup + copy pesan (WA tidak support pre-fill text ke grup)
    if (waGroupLink.includes('chat.whatsapp.com')) {
      window.open(waGroupLink, '_blank');
      // Copy pesan otomatis
      navigator.clipboard.writeText(message).catch(() => {});
      showToast('Grup WA dibuka + pesan otomatis tersalin. Tinggal paste di grup.', 'success');
    } else {
      // Kalau wa.me?phone=xxx : kirim ke nomor
      const url = `${waGroupLink}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      showToast('Membuka WhatsApp...', 'info');
    }
  };

  const openWhatsAppPersonal = (phone: string, message: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // ============================================================
  // SUBMIT BROADCAST
  // ============================================================
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !content.trim()) {
      showToast('Harap lengkapi judul dan isi pesan.', 'warning');
      return;
    }

    try {
      await sendBroadcast({
        classId: activeClass.id,
        senderId: user.uid,
        senderName: user.displayName,
        senderRole: user.role,
        title: title.trim(),
        content: content.trim(),
        target,
        targetDivision: target === 'DIVISI' ? targetDivision : undefined,
        createdAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'CREATE', targetType: 'Broadcast', targetId: 'broadcast',
        details: `Kirim broadcast: "${title}" (${target})`,
      });

      // Build message untuk WA
      const waMessage = buildWhatsAppMessage({
        title: title.trim(),
        content: content.trim(),
        target,
        targetDivision: target === 'DIVISI' ? targetDivision : undefined,
        senderName: user.displayName,
        senderRole: user.role,
      });

      showToast('✅ Pengumuman berhasil disiarkan!', 'success');
      setIsModalOpen(false);

      // Reset form
      setTitle('');
      setContent('');

      // Auto-buka WA kalau diaktifkan
      if (autoOpenWA) {
        setTimeout(() => openWhatsAppGroup(waMessage), 400);
      } else {
        // Kalau autoOpenWA off, setidaknya copy
        navigator.clipboard.writeText(waMessage).catch(() => {});
        showToast('💡 Pesan untuk WA tersalin ke clipboard.', 'info');
      }
    } catch (err: any) {
      showToast('Gagal mengirim broadcast: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ============================================================
          HEADER
          ============================================================ */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Radio className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Pusat Pengumuman & Broadcast WA
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Siarkan ke sistem & forward ke WhatsApp secara otomatis
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isTeacher && (
            <button onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 transition">
              <Settings className="w-4 h-4" /> Setelan WA
            </button>
          )}
          {canBroadcast && (
            <button onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-md transition">
              <Send className="w-4 h-4" /> Kirim Broadcast
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          WA STATUS INFO
          ============================================================ */}
      {activeClass && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
          waGroupLink
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
        }`}>
          <MessageCircle className={`w-5 h-5 shrink-0 mt-0.5 ${waGroupLink ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div className="flex-1 text-xs">
            {waGroupLink ? (
              <>
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  ✅ WA Grup sudah tersambung
                </p>
                <p className="text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {waGroupName ? `Grup: "${waGroupName}"` : 'Link grup sudah disimpan.'}
                  {autoOpenWA && ' — setiap kirim broadcast, WA akan otomatis terbuka.'}
                </p>
                <a href={waGroupLink} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-emerald-700 dark:text-emerald-300 font-bold hover:underline">
                  <ExternalLink className="w-3 h-3" /> Buka Grup WA
                </a>
              </>
            ) : (
              <>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  ⚠️ WA Grup belum disambungkan
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  {isTeacher
                    ? 'Klik "Setelan WA" untuk menyimpan link grup. Setelah itu, setiap broadcast akan auto-copy pesan & buka WA.'
                    : 'Guru dapat mengatur link grup WA di menu Setelan WA.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          BROADCAST FEED
          ============================================================ */}
      <div className="space-y-4">
        {broadcasts.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
            <Radio className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
              Belum Ada Broadcast
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Klik "Kirim Broadcast" untuk mulai menyiarkan pengumuman.
            </p>
          </div>
        ) : (
          broadcasts.map(b => {
            const waMsg = buildWhatsAppMessage(b);
            const isCopied = copiedId === b.id;
            return (
              <div key={b.id}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm space-y-3 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                      Target: {b.target === 'DIVISI' ? b.targetDivision : b.target}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(b.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })} WITA
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                  {b.title}
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 font-medium">
                  {b.content}
                </p>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Disiarkan oleh: <strong className="text-slate-800 dark:text-slate-200">{b.senderName}</strong> ({b.senderRole})
                </div>

                {/* WA ACTIONS */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
                  <button onClick={() => openWhatsAppGroup(waMsg)}
                    className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {waGroupLink ? 'Kirim ke Grup WA' : 'Buka WhatsApp'}
                  </button>

                  <button onClick={() => handleCopy(waMsg, b.id)}
                    className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition border ${
                      isCopied
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}>
                    {isCopied ? <><Check className="w-3.5 h-3.5" /> Tersalin!</> : <><Copy className="w-3.5 h-3.5" /> Salin Pesan</>}
                  </button>

                  <button onClick={() => openWhatsAppPersonal('', waMsg)}
                    className="py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 font-bold text-xs flex items-center gap-1.5 transition"
                    title="Kirim ke nomor WA pribadi">
                    <Phone className="w-3.5 h-3.5" /> Kirim Personal
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============================================================
          MODAL SETELAN WA
          ============================================================ */}
      {isSettingsOpen && isTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveSettings}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" /> Setelan WhatsApp
              </h3>
              <button type="button" onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <p className="font-bold mb-0.5">Cara dapat link grup WA:</p>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>Buka grup WA kelas Anda</li>
                  <li>Ketuk nama grup → <strong>Invite via link</strong></li>
                  <li>Salin link (contoh: <code className="bg-blue-100 dark:bg-blue-500/30 px-1 rounded">chat.whatsapp.com/xxxxx</code>)</li>
                  <li>Paste di kolom di bawah</li>
                </ol>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Link Grup WA Kelas
              </label>
              <input type="url" value={waGroupLink}
                onChange={(e) => setWaGroupLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
              <p className="text-[10px] text-slate-400 mt-1">
                Atau link <code>wa.me/62xxxxx</code> kalau mau ke nomor guru/pribadi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Grup (opsional)
              </label>
              <input type="text" value={waGroupName}
                onChange={(e) => setWaGroupName(e.target.value)}
                placeholder="Contoh: Teater IX-C Gema Senandika"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={autoOpenWA}
                  onChange={(e) => setAutoOpenWA(e.target.checked)}
                  className="mt-0.5 rounded border-emerald-300 text-emerald-500" />
                <div>
                  <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                    🚀 Auto-buka WA saat kirim broadcast
                  </p>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Setelah kirim, sistem otomatis buka grup WA + copy pesan. Tinggal paste.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={savingSettings}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {savingSettings ? 'Menyimpan...' : 'Simpan Setelan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================
          MODAL KIRIM BROADCAST
          ============================================================ */}
      {isModalOpen && canBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSendBroadcast}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 my-auto max-h-[92vh] overflow-y-auto space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-500" /> Siarkan Pengumuman
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Penerima
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select value={target} onChange={(e) => setTarget(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                  <option value="SEMUA">Semua Anggota</option>
                  <option value="DIVISI">Divisi Tertentu</option>
                  <option value="PERAN">Peran Tertentu</option>
                </select>

                {target === 'DIVISI' && (
                  <select value={targetDivision} onChange={(e) => setTargetDivision(e.target.value as DivisionType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                    {DIVISIONS.map(d => (
                      <option key={d.id} value={d.id}>{d.id}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Pengumuman <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Rapat Darurat Besok Pukul 14.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Isi Pengumuman <span className="text-rose-500">*</span>
              </label>
              <textarea rows={5} required value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis instruksi lengkap: waktu, lokasi, hal yang perlu dibawa..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white leading-relaxed" />
            </div>

            {autoOpenWA && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-900 dark:text-emerald-200">
                  <strong>Setelah klik "Siarkan":</strong> Broadcast tersimpan di sistem + pesan otomatis ter-copy + WA grup terbuka.
                  Tinggal paste di grup.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Siarkan & Buka WA
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
