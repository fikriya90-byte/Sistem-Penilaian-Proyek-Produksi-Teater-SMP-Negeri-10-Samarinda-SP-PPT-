import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  PlusCircle,
  Radio,
  Send,
  Share2,
  Users
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS } from '../../core/constants';
import { BroadcastMessage, DivisionType } from '../../core/types';
import { recordAuditLog, sendBroadcast, subscribeBroadcasts } from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const BroadcastModule: React.FC = () => {
  const { user, activeClass, isTeacher, isPimprod, isSekretaris, isSutradara, isKoordinator } = useAuth();
  const { showToast } = useToast();

  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState<'SEMUA' | 'DIVISI' | 'PERAN' | 'CUSTOM'>('SEMUA');
  const [targetDivision, setTargetDivision] = useState<DivisionType>('Perlengkapan');

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeBroadcasts(activeClass.id, (bList) => {
      setBroadcasts(bList);
    });
    return () => unsub();
  }, [activeClass]);

  const canBroadcast = isTeacher || isPimprod || isSekretaris || isSutradara || isKoordinator;

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !content.trim()) {
      showToast('Harap lengkapi judul dan isi pesan pengumuman.', 'warning');
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
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Broadcast',
        targetId: 'broadcast',
        details: `Kirim broadcast: "${title}" (${target})`,
      });

      showToast('Pesan pengumuman berhasil disebarkan!', 'success');
      setIsModalOpen(false);
      setTitle('');
      setContent('');
    } catch (err: any) {
      showToast('Gagal mengirim broadcast: ' + err.message, 'error');
    }
  };

  const getWhatsAppShareLink = (b: BroadcastMessage) => {
    const text = encodeURIComponent(
      `📢 *PENGUMUMAN RESMI SP-PPT TEATER ${activeClass?.name}*\n` +
      `Dari: ${b.senderName} (${b.senderRole})\n` +
      `Target: ${b.target === 'DIVISI' ? b.targetDivision : b.target}\n\n` +
      `*${b.title}*\n${b.content}\n\n` +
      `_SMP Negeri 10 Samarinda - T.A. 2025/2026_`
    );
    return `https://wa.me/?text=${text}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Radio className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Pusat Pengumuman & Broadcast Darurat
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Penyampaian instruksi serentak untuk seluruh tim atau divisi teater
              </p>
            </div>
          </div>
        </div>

        {canBroadcast && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <Send className="w-4 h-4" />
            <span>Kirim Broadcast Baru</span>
          </button>
        )}
      </div>

      {/* Broadcast Feed */}
      <div className="space-y-4">
        {broadcasts.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            Belum ada pengumuman siaran yang diterbitkan untuk kelas ini.
          </div>
        ) : (
          broadcasts.map(b => (
            <div
              key={b.id}
              className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                    Target: {b.target === 'DIVISI' ? b.targetDivision : b.target}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(b.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA
                  </span>
                </div>

                <a
                  href={getWhatsAppShareLink(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition self-start sm:self-auto"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sebar ke Grup WA</span>
                </a>
              </div>

              <h3 className="text-base font-black text-slate-900 leading-snug">
                {b.title}
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                {b.content}
              </p>

              <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                <span>
                  Disiarkan oleh: <strong className="text-slate-800">{b.senderName}</strong> ({b.senderRole})
                </span>
                <span className="text-slate-400 font-semibold">{activeClass?.name}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Broadcast Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-500" /> Siarkan Pengumuman Baru
            </h3>

            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sasaran Penerima Broadcast
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    <option value="SEMUA">Semua Anggota Kelas</option>
                    <option value="DIVISI">Divisi Tertentu</option>
                    <option value="PERAN">Peran Tertentu</option>
                  </select>

                  {target === 'DIVISI' && (
                    <select
                      value={targetDivision}
                      onChange={(e) => setTargetDivision(e.target.value as DivisionType)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                    >
                      {DIVISIONS.map(d => (
                        <option key={d.id} value={d.id}>{d.id}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Pengumuman <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Rapat Darurat Persiapan Panggung Besok"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Isi Pesan Pengumuman <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan pesan instruksi dengan jelas, termasuk waktu, lokasi, dan perlengkapan yang harus dibawa..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs"
                >
                  Siarkan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
