import React, { useState, useEffect } from 'react';
import {
  ExternalLink, MessageCircle, Phone, Search, Share2, Sparkles,
  Users, Camera, Pencil, Check, X, Lock, Unlock, Download, Eye,
  KeyRound, EyeOff, Copy, Mail, UserCog, Save, Trash2, ShieldAlert,
  RefreshCw, AlertTriangle, Info, Shield,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS, getDivisionFromRole } from '../../core/constants';
import { UserProfile, UserRole } from '../../core/types';
import { fetchUsersByClass, updateUserProfile, recordAuditLog } from '../../services/firestoreService';
import { useToast } from '../common/Toast';
import { PhotoUploadModal } from '../common/PhotoUploadModal';
import { getUserCredentials, resetStudentPassword } from '../../services/adminService';
import {
  doc, getDoc, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';

// =====================================================
// ROLE GROUP
// =====================================================
const ROLE_OPTIONS: { group: string; roles: UserRole[] }[] = [
  {
    group: 'Pengurus Inti',
    roles: ['Pimpinan Produksi', 'Sekretaris', 'Bendahara'],
  },
  {
    group: 'Pemeran & Penyutradaraan',
    roles: ['Sutradara', 'Asisten Sutradara', 'Pemeran'],
  },
  {
    group: 'Koordinator Divisi',
    roles: [
      'Koordinator Perlengkapan', 'Koordinator Publikasi',
      'Koordinator Tata Panggung', 'Koordinator Tata Rias',
      'Koordinator Tata Busana', 'Koordinator Tata Musik',
    ],
  },
  {
    group: 'Anggota Divisi',
    roles: [
      'Anggota Perlengkapan', 'Anggota Publikasi',
      'Anggota Tata Panggung', 'Anggota Tata Rias',
      'Anggota Tata Busana', 'Anggota Tata Musik',
    ],
  },
];

export const StructureModule: React.FC = () => {
  const {
    user, activeClass, isTeacher, isGuruPengampu, isAdminRole, isPimprod,
    canEditKerabatKerja, updateKerabatKerja,
  } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [photoModalMember, setPhotoModalMember] = useState<UserProfile | null>(null);
  const [kerabatLogo, setKerabatLogo] = useState<string>('');
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; name: string; canDownload: boolean } | null>(null);
  const [isEditingKerabat, setIsEditingKerabat] = useState(false);
  const [kerabatDraft, setKerabatDraft] = useState('');
  const [savingKerabat, setSavingKerabat] = useState(false);

  // Credential modal
  const [credModal, setCredModal] = useState<{
    open: boolean; member: UserProfile | null;
    loading: boolean; success: boolean;
    email?: string; password?: string; message?: string;
  }>({ open: false, member: null, loading: false, success: false });
  const [showPass, setShowPass] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit member modal
  const [editModal, setEditModal] = useState<{
    open: boolean; member: UserProfile | null;
  }>({ open: false, member: null });
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Pemeran');
  const [editEmail, setEditEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const canEditPhotos =
    isTeacher || isGuruPengampu || isAdminRole || isPimprod ||
    user?.role === 'Sutradara' ||
    (user?.role ? user.role.startsWith('Koordinator ') : false);

  const canEditKerabatLogo = isPimprod || isGuruPengampu || isAdminRole;
  const canManageStudentData = isGuruPengampu || isAdminRole;

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(setMembers);
    loadKerabatLogo();
    setKerabatDraft(activeClass.kerabatKerja || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClass]);

  const loadKerabatLogo = async () => {
    if (!activeClass) return;
    try {
      const snap = await getDoc(doc(db, 'classes', activeClass.id));
      if (snap.exists()) setKerabatLogo(snap.data().kerabatLogo || '');
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        try { navigator.clipboard.writeText(''); } catch { /* ignore */ }
        if (viewingPhoto && !viewingPhoto.canDownload) showToast('Screenshot tidak diizinkan.', 'warning');
        return;
      }
      const isCmd = e.ctrlKey || e.metaKey;
      if (isCmd && ['p', 'P', 's', 'S'].includes(e.key)) {
        if (viewingPhoto && !viewingPhoto.canDownload) {
          e.preventDefault();
          showToast('Tidak dapat disimpan/dicetak saat melihat foto profil.', 'warning');
        }
      }
    };
    const blockVisibility = () => {
      if (document.hidden && viewingPhoto && !viewingPhoto.canDownload) {
        setTimeout(() => setViewingPhoto(null), 100);
      }
    };
    window.addEventListener('keydown', blockKeys);
    document.addEventListener('visibilitychange', blockVisibility);
    return () => {
      window.removeEventListener('keydown', blockKeys);
      document.removeEventListener('visibilitychange', blockVisibility);
    };
  }, [viewingPhoto, showToast]);

  const handleSaveKerabatName = async () => {
    if (!kerabatDraft.trim()) { showToast('Nama kerabat kerja tidak boleh kosong.', 'warning'); return; }
    setSavingKerabat(true);
    const res = await updateKerabatKerja(kerabatDraft.trim());
    setSavingKerabat(false);
    if (res.success) { showToast(res.message, 'success'); setIsEditingKerabat(false); }
    else showToast(res.message, 'error');
  };

  const handleSaveMemberPhoto = async (photoUrl: string) => {
    if (!photoModalMember || !user) return;
    await updateUserProfile(photoModalMember.uid, { photoURL: photoUrl });
    await recordAuditLog({
      userId: user.uid, userName: user.displayName, role: user.role,
      action: 'UPDATE', targetType: 'MemberPhoto', targetId: photoModalMember.uid,
      details: `Ganti foto ${photoModalMember.displayName}`,
    });
    setMembers(prev => prev.map(m => m.uid === photoModalMember.uid ? { ...m, photoURL: photoUrl } : m));
    setPhotoModalMember(null);
  };

  const handleSaveKerabatLogo = async (photoUrl: string) => {
    if (!activeClass || !user) return;
    try {
      await setDoc(doc(db, 'classes', activeClass.id), { kerabatLogo: photoUrl }, { merge: true });
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'KerabatLogo', targetId: activeClass.id,
        details: 'Update logo kerabat',
      });
      setKerabatLogo(photoUrl);
      setIsLogoModalOpen(false);
      showToast('Logo kerabat diperbarui!', 'success');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
  };

  const handleViewMemberPhoto = (m: UserProfile) => {
    if (!m.photoURL) { showToast('Foto belum diupload.', 'info'); return; }
    setViewingPhoto({ url: m.photoURL, name: m.displayName, canDownload: false });
  };

  const handleViewKerabatLogo = () => {
    if (!kerabatLogo) { showToast('Logo belum diupload.', 'info'); return; }
    setViewingPhoto({ url: kerabatLogo, name: activeClass?.kerabatKerja || 'Logo', canDownload: true });
  };

  const handleDownload = (url: string, name: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Foto diunduh.', 'success');
    } catch { showToast('Gagal mengunduh.', 'error'); }
  };

  const filteredMembers = members.filter(m => {
    if (selectedDivision !== 'ALL') {
      if (selectedDivision === 'Pengurus Inti') {
        const isInti = m.role === 'Pimpinan Produksi' || m.role === 'Sekretaris' || m.role === 'Bendahara';
        if (!isInti) return false;
      } else if (m.divisionName !== selectedDivision) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (m.displayName || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q));
    }
    return true;
  });

  // ✅ FIX: Format pesan WhatsApp sesuai permintaan
  const getWhatsAppLink = (phone?: string, name?: string) => {
    if (!phone) return '#';
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    
    const namaGuru = user?.displayName || 'Guru Pengampu';
    const namaKelas = activeClass?.name || 'IX';
    const namaKerabat = activeClass?.kerabatKerja || '-';

    const msg = encodeURIComponent(
      `Halo ${name || 'Siswa'},\n\nSaya ${namaGuru} guru pengampu Kelas ${namaKelas} sekaligus pembimbing Kerabat Kerja ${namaKerabat}`
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
      showToast('Tautan disalin ke clipboard.', 'info');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === 'Pimpinan Produksi' || role === 'Sutradara') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (role.startsWith('Koordinator ')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (role.startsWith('Anggota ')) return 'bg-slate-100 text-slate-700 border-slate-300';
    if (role === 'Pemain' || role === 'Pemeran') return 'bg-rose-100 text-rose-800 border-rose-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  // =====================================================
  // ACTION HANDLERS (GURU)
  // =====================================================
  const handleViewCredentials = async (m: UserProfile) => {
    setCredModal({ open: true, member: m, loading: true, success: false });
    setShowPass(false);
    setCopiedField(null);
    try {
      const res = await getUserCredentials(m.uid);
      if (res.success) {
        setCredModal({
          open: true, member: m, loading: false, success: true,
          email: res.email || m.email, password: res.password,
        });
        if (user) {
          try {
            await recordAuditLog({
              userId: user.uid, userName: user.displayName, role: user.role,
              action: 'UPDATE', targetType: 'ViewCredentials', targetId: m.uid,
              details: `Lihat kredensial: ${m.displayName}`,
            });
          } catch { /* ignore */ }
        }
      } else {
        setCredModal({ open: true, member: m, loading: false, success: false, message: res.message });
      }
    } catch (err: any) {
      setCredModal({ open: true, member: m, loading: false, success: false, message: err?.message });
    }
  };

  const handleResetPassword = async (m: UserProfile) => {
    if (!confirm(`Kirim link reset password ke ${m.displayName}?\n\nEmail: ${m.email}`)) return;
    setResettingId(m.uid);
    try {
      const res = await resetStudentPassword(m.email);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setResettingId(null); }
  };

  const openEditModal = (m: UserProfile) => {
    setEditModal({ open: true, member: m });
    setEditName(m.displayName || '');
    setEditPhone(m.phone || '');
    setEditRole((m.role as UserRole) || 'Pemeran');
    setEditEmail(m.email || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.member || !user) return;
    const m = editModal.member;
    const emailChanged = editEmail.trim().toLowerCase() !== (m.email || '').toLowerCase();
    if (emailChanged && !editEmail.includes('@')) { showToast('Email tidak valid.', 'warning'); return; }

    setSavingEdit(true);
    try {
      const division = getDivisionFromRole(editRole);
      const updateData: any = {
        displayName: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        divisionId: division.id,
        divisionName: division.name,
        updatedAt: new Date().toISOString(),
      };
      if (emailChanged) updateData.email = editEmail.trim().toLowerCase();

      await updateDoc(doc(db, 'users', m.uid), updateData);
      if (emailChanged) {
        try { await updateDoc(doc(db, 'userCredentials', m.uid), { email: editEmail.trim().toLowerCase() }); } catch { /* ignore */ }
      }
      await recordAuditLog({
        userId: user.uid, userName: user.displayName, role: user.role,
        action: 'UPDATE', targetType: 'User', targetId: m.uid,
        details: `Edit dari Kerabat Kerja: ${editName} → ${editRole}`,
      });
      showToast('Data siswa diperbarui!', 'success');
      setEditModal({ open: false, member: null });
      setSelectedMember(null);
      await fetchUsersByClass(activeClass!.id).then(setMembers);
    } catch (err: any) { showToast('Gagal: ' + err.message, 'error'); }
    finally { setSavingEdit(false); }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast(`${field} disalin.`, 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } catch { showToast('Gagal menyalin.', 'error'); }
  };

  return (
    <div className="space-y-6">
      {/* Header dengan Logo & Nama Kerabat */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button type="button" onClick={handleViewKerabatLogo}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg border-4 border-white dark:border-slate-800 overflow-hidden hover:scale-105 transition cursor-pointer"
                title="Klik untuk lihat logo besar">
                {kerabatLogo ? (
                  <img src={kerabatLogo} alt="Logo Kerabat" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <Sparkles className="w-8 h-8 text-white" />
                )}
              </button>
              {canEditKerabatLogo && (
                <button onClick={(e) => { e.stopPropagation(); setIsLogoModalOpen(true); }}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition"
                  title="Ganti logo kerabat">
                  <Camera className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">
                Kerabat Kerja
              </span>
              {isEditingKerabat && canEditKerabatKerja ? (
                <div className="flex items-center gap-2 mt-1">
                  <input type="text" value={kerabatDraft}
                    onChange={(e) => setKerabatDraft(e.target.value)}
                    placeholder="Contoh: Gema Senandika Production"
                    autoFocus
                    className="flex-1 px-3 py-1.5 rounded-xl border-2 border-amber-400 bg-white dark:bg-slate-800 text-sm font-extrabold text-slate-900 dark:text-white" />
                  <button onClick={handleSaveKerabatName} disabled={savingKerabat}
                    className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                    title="Simpan">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setIsEditingKerabat(false); setKerabatDraft(activeClass?.kerabatKerja || ''); }}
                    className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700"
                    title="Batal">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {activeClass?.kerabatKerja || `Struktur ${activeClass?.name || ''}`}
                  </h2>
                  {canEditKerabatKerja && (
                    <button onClick={() => setIsEditingKerabat(true)}
                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                      title="Ubah nama kerabat kerja">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {!canEditKerabatKerja && (
                    <span className="p-1 text-slate-300" title="Hanya Guru & Pimpinan Produksi">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {members.length} anggota terdaftar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleShareStructure}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-700">
              <Share2 className="w-4 h-4" /> Bagikan
            </button>
          </div>
        </div>
      </div>

      {/* Filter Divisi */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={() => setSelectedDivision('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            selectedDivision === 'ALL' ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}>
          Semua ({members.length})
        </button>
        {DIVISIONS.map(d => {
          const count = members.filter(m => {
            if (d.id === 'Pengurus Inti') return m.role === 'Pimpinan Produksi' || m.role === 'Sekretaris' || m.role === 'Bendahara';
            return m.divisionName === d.id;
          }).length;
          return (
            <button key={d.id} onClick={() => setSelectedDivision(d.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedDivision === d.id ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
              {d.id} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input type="text" placeholder="Cari nama atau peran..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white" />
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
          const isMe = member.uid === user?.uid;
          const waLink = getWhatsAppLink(member.phone, member.displayName);
          const canEditThisPhoto = isMe || canEditPhotos;
          return (
            <div key={member.uid}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition relative flex flex-col justify-between ${
                isMe ? 'border-amber-400 shadow-md ring-2 ring-amber-400/20'
                  : 'border-slate-200/80 dark:border-slate-700 shadow-sm'
              }`}>
              <div>
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <button type="button" onClick={() => handleViewMemberPhoto(member)}
                      className="relative block cursor-pointer hover:scale-105 transition"
                      title={member.photoURL ? 'Klik untuk lihat foto besar' : 'Belum ada foto'}
                      onContextMenu={(e) => e.preventDefault()}>
                      {member.photoURL ? (
                        <img src={member.photoURL} alt={member.displayName} draggable={false}
                          onContextMenu={(e) => e.preventDefault()}
                          className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 select-none print:hidden"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }} />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-lg border border-slate-200 dark:border-slate-700 select-none">
                          {member.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                    {canEditThisPhoto && (
                      <button onClick={(e) => { e.stopPropagation(); setPhotoModalMember(member); }}
                        className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition"
                        title="Ganti foto">
                        <Camera className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">{member.displayName}</h4>
                      {isMe && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950">Anda</span>}
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
                  <a href={waLink} target="_blank" rel="noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Chat WA
                  </a>
                ) : (
                  <button disabled className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold cursor-not-allowed">
                    No WA -
                  </button>
                )}
                <button onClick={() => setSelectedMember(member)}
                  className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Detail">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ MODAL DETAIL MEMBER ═══ */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6 my-auto max-h-[95vh] overflow-y-auto">
            <div className="text-center">
              <div className="relative inline-block">
                {selectedMember.photoURL ? (
                  <button onClick={() => handleViewMemberPhoto(selectedMember)}
                    className="cursor-pointer hover:scale-105 transition"
                    onContextMenu={(e) => e.preventDefault()}>
                    <img src={selectedMember.photoURL} alt={selectedMember.displayName} draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-md select-none print:hidden"
                      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }} />
                  </button>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-2xl flex items-center justify-center border-4 border-amber-400">
                    {selectedMember.displayName.charAt(0)}
                  </div>
                )}
                {(canEditPhotos || selectedMember.uid === user?.uid) && (
                  <button onClick={() => setPhotoModalMember(selectedMember)}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600">
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

            {/* Aksi Guru */}
            {canManageStudentData && (
              <div className="mt-4 p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-2 border-amber-200 dark:border-amber-500/40">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-[11px] font-black text-amber-900 dark:text-amber-200 uppercase">
                    Aksi Guru
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => openEditModal(selectedMember)}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-amber-200 dark:border-amber-500/40 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1.5">
                    <UserCog className="w-3.5 h-3.5" /> Edit Data
                  </button>
                  <button onClick={() => handleViewCredentials(selectedMember)}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-amber-200 dark:border-amber-500/40 text-purple-700 dark:text-purple-300 font-bold text-[11px] flex items-center justify-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Lihat Pass
                  </button>
                  <button onClick={() => handleResetPassword(selectedMember)}
                    disabled={resettingId === selectedMember.uid}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-amber-200 dark:border-amber-500/40 text-orange-700 dark:text-orange-300 font-bold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {resettingId === selectedMember.uid ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengirim...</>
                    ) : (
                      <><Mail className="w-3.5 h-3.5" /> Reset Pass</>
                    )}
                  </button>
                  <button onClick={() => setPhotoModalMember(selectedMember)}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-amber-200 dark:border-amber-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Ganti Foto
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => setSelectedMember(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Tutup
              </button>
              {selectedMember.phone && (
                <a href={getWhatsAppLink(selectedMember.phone, selectedMember.displayName)}
                  target="_blank" rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL LIHAT PASSWORD ═══ */}
      {credModal.open && credModal.member && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-purple-200 dark:border-purple-500/40 my-auto overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                    <KeyRound className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Kredensial Akun</p>
                    <h3 className="text-base font-black mt-0.5">{credModal.member.displayName}</h3>
                  </div>
                </div>
                <button onClick={() => setCredModal({ open: false, member: null, loading: false, success: false })}
                  className="p-1.5 rounded-lg hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {credModal.loading ? (
                <div className="py-8 text-center">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-500" />
                  <p className="text-xs text-slate-500">Memuat kredensial...</p>
                </div>
              ) : credModal.success ? (
                <>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                      <strong>Rahasia!</strong> Jangan bagikan kredensial ini ke orang lain. Hanya untuk membantu siswa yang lupa password.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </p>
                      <button onClick={() => handleCopy(credModal.email || '', 'Email')}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                        title="Salin email">
                        {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900 dark:text-white break-all">
                      {credModal.email}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-2 border-purple-200 dark:border-purple-500/40">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Password
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowPass(!showPass)}
                          className="p-1 rounded-md text-purple-500 hover:text-purple-700 transition"
                          title={showPass ? 'Sembunyikan' : 'Tampilkan'}>
                          {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleCopy(credModal.password || '', 'Password')}
                          className="p-1 rounded-md text-purple-500 hover:text-purple-700 transition"
                          title="Salin password">
                          {copiedField === 'Password' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-mono font-black text-purple-900 dark:text-purple-200 break-all">
                      {showPass ? credModal.password : '•'.repeat(Math.min((credModal.password || '').length || 8, 20))}
                    </p>
                    {!showPass && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                        <EyeOff className="w-2.5 h-2.5" /> Klik ikon mata untuk menampilkan
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                      <strong>Saran:</strong> Minta siswa untuk mengganti password setelah login pertama, agar lebih aman.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-200 dark:border-rose-500/40 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-500/20 border-2 border-rose-300 dark:border-rose-500/40 mb-3">
                      <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                    </div>
                    <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Kredensial Tidak Tersedia</p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                      {credModal.message || 'Siswa ini mendaftar sebelum fitur kredensial aktif, atau kredensial sudah dihapus.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      <p className="font-bold mb-1">Alternatif:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Klik tombol <strong>Reset Pass</strong> untuk kirim link reset password ke email siswa</li>
                        <li>Siswa buka email → klik link → buat password baru sendiri</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setCredModal({ open: false, member: null, loading: false, success: false })}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold text-xs">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL EDIT MEMBER ═══ */}
      {editModal.open && editModal.member && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-amber-200 dark:border-amber-500/40 p-6 my-auto max-h-[95vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCog className="w-5 h-5 text-amber-500" /> Edit Data Siswa
              </h3>
              <button type="button" onClick={() => setEditModal({ open: false, member: null })}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </label>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> No. WhatsApp
              </label>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Role / Peran <span className="text-rose-500">*</span>
              </label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white">
                {ROLE_OPTIONS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setEditModal({ open: false, member: null })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                Batal
              </button>
              <button type="submit" disabled={savingEdit}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {savingEdit ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ MODAL VIEW FOTO ═══ */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/95 backdrop-blur-md print:hidden"
          onClick={() => setViewingPhoto(null)}
          onContextMenu={(e) => { if (!viewingPhoto.canDownload) e.preventDefault(); }}>
          <div className="w-full max-w-3xl flex flex-col items-center gap-4 my-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <h3 className="text-white font-black text-lg">{viewingPhoto.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1.5">
                {viewingPhoto.canDownload ? (
                  <><Unlock className="w-3 h-3 text-emerald-400" /> Logo kerabat — boleh diunduh</>
                ) : (
                  <><Lock className="w-3 h-3 text-rose-400" /> Foto profil — dilindungi</>
                )}
              </p>
            </div>

            <div className={`relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 ${viewingPhoto.canDownload ? '' : 'print:hidden'}`}
              style={{
                WebkitTouchCallout: viewingPhoto.canDownload ? 'default' : 'none',
                WebkitUserSelect: viewingPhoto.canDownload ? 'auto' : 'none',
                userSelect: viewingPhoto.canDownload ? 'auto' : 'none',
              }}>
              <img src={viewingPhoto.url} alt={viewingPhoto.name}
                className={`max-w-full max-h-[70vh] object-contain bg-slate-900 ${viewingPhoto.canDownload ? '' : 'print:hidden'}`}
                draggable={viewingPhoto.canDownload}
                onContextMenu={(e) => { if (!viewingPhoto.canDownload) e.preventDefault(); }}
                style={{
                  pointerEvents: viewingPhoto.canDownload ? 'auto' : 'none',
                  WebkitTouchCallout: viewingPhoto.canDownload ? 'default' : 'none',
                  WebkitUserSelect: viewingPhoto.canDownload ? 'auto' : 'none',
                  userSelect: viewingPhoto.canDownload ? 'auto' : 'none',
                }} />
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              {viewingPhoto.canDownload && (
                <button onClick={() => handleDownload(viewingPhoto.url, viewingPhoto.name)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
                  <Download className="w-4 h-4" /> Unduh Logo
                </button>
              )}
              <button onClick={() => setViewingPhoto(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center gap-2">
                <X className="w-4 h-4" /> Tutup
              </button>
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