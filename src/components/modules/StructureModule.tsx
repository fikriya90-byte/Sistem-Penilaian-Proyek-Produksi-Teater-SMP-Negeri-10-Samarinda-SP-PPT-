import React, { useState, useEffect } from 'react';
import {
  ExternalLink, MessageCircle, Phone, Search, Share2, Sparkles,
  Users, Camera, Upload,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS } from '../../core/constants';
import { UserProfile } from '../../core/types';
import { fetchUsersByClass, updateUserProfile, recordAuditLog } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { PhotoUploadModal } from '../common/PhotoUploadModal';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';

export const StructureModule: React.FC = () => {
  const { user, activeClass, isTeacher, isGuruPengampu, isAdminRole } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [photoModalMember, setPhotoModalMember] = useState<UserProfile | null>(null);
  const [kerabatLogo, setKerabatLogo] = useState<string>('');
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

  const canEditPhotos =
    isTeacher || isGuruPengampu || isAdminRole ||
    user?.role === 'Pimpinan Produksi' ||
    user?.role === 'Sutradara' ||
    (user?.role ? user.role.startsWith('Koordinator ') : false);

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(setMembers);
    loadKerabatLogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass]);

  const loadKerabatLogo = async () => {
    if (!activeClass) return;
    try {
      const snap = await getDoc(doc(db, 'classes', activeClass.id));
      if (snap.exists()) {
        const data = snap.data();
        setKerabatLogo(data.kerabatLogo || '');
      }
    } catch (err) {
      console.warn('Gagal load logo:', err);
    }
  };

  const handleSaveMemberPhoto = async (photoUrl: string) => {
    if (!photoModalMember || !user) return;
    await updateUserProfile(photoModalMember.uid, { photoURL: photoUrl });
    await recordAuditLog({
      userId: user.uid,
      userName: user.displayName,
      role: user.role,
      action: 'UPDATE',
      targetType: 'MemberPhoto',
      targetId: photoModalMember.uid,
      details: `Ganti foto ${photoModalMember.displayName}`,
    });
    setMembers(prev => prev.map(m => m.uid === photoModalMember.uid ? { ...m, photoURL: photoUrl } : m));
    setPhotoModalMember(null);
  };

  const handleSaveKerabatLogo = async (photoUrl: string) => {
    if (!activeClass || !user) return;
    try {
      await setDoc(doc(db, 'classes', activeClass.id), {
        kerabatLogo: photoUrl,
      }, { merge: true });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'UPDATE',
        targetType: 'KerabatLogo',
        targetId: activeClass.id,
        details: 'Memperbarui logo kerabat kerja',
      });

      setKerabatLogo(photoUrl);
      setIsLogoModalOpen(false);
      showToast('Logo kerabat kerja diperbarui!', 'success');
    } catch (err: any) {
      showToast('Gagal simpan logo: ' + err.message, 'error');
    }
  };

  const filteredMembers = members.filter(m => {
    if (selectedDivision !== 'ALL') {
      if (selectedDivision === 'Pengurus Inti') {
        const isInti = m.role === 'Pimpinan Produksi' || m.role === 'Sekretaris' || m.role === 'Bendahara';
        if (!isInti) return false;
      } else if (m.divisionName !== selectedDivision) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.displayName.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q))
      );
    }
    return true;
  });

  const getWhatsAppLink = (phone?: string, name?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    const msg = encodeURIComponent(
      `Halo ${name || 'Rekan'}, salam dari tim produksi teater SP-PPT SMPN 10 Samarinda. Saya ${user?.displayName || 'rekan kerja'}.`
    );
    return `https://wa.me/${clean}?text=${msg}`;
  };

  const handleShareStructure = () => {
    if (navigator.share) {
      navigator.share({
        title: `Kerabat Kerja ${activeClass?.name}`,
        text: `Susunan kerabat kerja produksi teater ${activeClass?.name}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Tautan disalin ke clipboard!', 'info');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'Pimpinan Produksi' || role === 'Sutradara') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (role.startsWith('Koordinator ')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (role.startsWith('Anggota ')) return 'bg-slate-100 text-slate-700 border-slate-300';
    if (role === 'Pemain') return 'bg-rose-100 text-rose-800 border-rose-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <div className="space-y-6">
      {/* Header dengan Logo */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg border-4 border-white dark:border-slate-800">
                {kerabatLogo ? (
                  <img src={kerabatLogo} alt="Logo Kerabat" className="w-full h-full rounded-3xl object-cover" />
                ) : (
                  <Sparkles className="w-8 h-8 text-white" />
                )}
              </div>
              {canEditPhotos && (
                <button
                  onClick={() => setIsLogoModalOpen(true)}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition"
                  title="Ganti logo kerabat"
                >
                  <Camera className="w-3 h-3" />
                </button>
              )}
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">
                Kerabat Kerja
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                {activeClass?.kerabatKerja || `Struktur ${activeClass?.name || ''}`}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {members.length} anggota terdaftar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditPhotos && !kerabatLogo && (
              <button
                onClick={() => setIsLogoModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 border border-amber-300 dark:border-amber-500/40"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Logo
              </button>
            )}
            <button
              onClick={handleShareStructure}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-700"
            >
              <Share2 className="w-4 h-4" />
              Bagikan
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedDivision('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            selectedDivision === 'ALL'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          Semua ({members.length})
        </button>
        {DIVISIONS.map(d => {
          const count = members.filter(m => {
            if (d.id === 'Pengurus Inti') {
              return m.role === 'Pimpinan Produksi' || m.role === 'Sekretaris' || m.role === 'Bendahara';
            }
            return m.divisionName === d.id;
          }).length;

          return (
            <button
              key={d.id}
              onClick={() => setSelectedDivision(d.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedDivision === d.id
                  ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {d.id} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama atau peran..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white"
        />
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
          const isMe = member.uid === user?.uid;
          const waLink = getWhatsAppLink(member.phone, member.displayName);

          return (
            <div
              key={member.uid}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition relative flex flex-col justify-between ${
                isMe
                  ? 'border-amber-400 shadow-md ring-2 ring-amber-400/20'
                  : 'border-slate-200/80 dark:border-slate-700 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-start gap-3">
                  <div className="relative">
                    {member.photoURL ? (
                      <img
                        src={member.photoURL}
                        alt={member.displayName}
                        className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-lg border border-slate-200 dark:border-slate-700">
                        {member.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {(canEditPhotos || isMe) && (
                      <button
                        onClick={() => setPhotoModalMember(member)}
                        className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition"
                        title="Ganti foto"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">
                        {member.displayName}
                      </h4>
                      {isMe && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          Anda
                        </span>
                      )}
                    </div>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 mt-1 rounded-md border ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {member.divisionName || 'Pemeran'}
                    </p>
                  </div>
                </div>

                {member.phone && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{member.phone}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2 flex items-center gap-2">
                {member.phone ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Chat WA
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed"
                  >
                    No WA -
                  </button>
                )}
                <button
                  onClick={() => setSelectedMember(member)}
                  className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Detail"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6">
            <div className="text-center">
              <div className="relative inline-block">
                {selectedMember.photoURL ? (
                  <img
                    src={selectedMember.photoURL}
                    alt={selectedMember.displayName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-md"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-2xl flex items-center justify-center border-4 border-amber-400">
                    {selectedMember.displayName.charAt(0)}
                  </div>
                )}
                {(canEditPhotos || selectedMember.uid === user?.uid) && (
                  <button
                    onClick={() => setPhotoModalMember(selectedMember)}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-3">
                {selectedMember.displayName}
              </h3>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{selectedMember.role}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedMember.divisionName || 'Pemeran'} • {selectedMember.className}
              </p>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">NIS:</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">{selectedMember.nis || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Email:</span>
                <span className="font-bold text-slate-800 dark:text-white text-right truncate max-w-[180px]">
                  {selectedMember.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">No. WA:</span>
                <span className="font-bold text-slate-800 dark:text-white font-mono">
                  {selectedMember.phone || '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setSelectedMember(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Tutup
              </button>
              {selectedMember.phone && (
                <a
                  href={getWhatsAppLink(selectedMember.phone, selectedMember.displayName)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal — Anggota */}
      {photoModalMember && (
        <PhotoUploadModal
          currentPhotoUrl={photoModalMember.photoURL}
          userName={photoModalMember.displayName}
          onSave={handleSaveMemberPhoto}
          onClose={() => setPhotoModalMember(null)}
        />
      )}

      {/* Photo Modal — Logo Kerabat */}
      {isLogoModalOpen && (
        <PhotoUploadModal
          currentPhotoUrl={kerabatLogo}
          userName={activeClass?.name || 'Kerabat'}
          onSave={handleSaveKerabatLogo}
          onClose={() => setIsLogoModalOpen(false)}
        />
      )}
    </div>
  );
};
