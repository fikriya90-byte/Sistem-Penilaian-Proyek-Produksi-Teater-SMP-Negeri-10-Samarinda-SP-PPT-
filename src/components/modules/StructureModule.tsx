import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  MessageCircle,
  Phone,
  Search,
  Share2,
  Sparkles,
  User,
  Users
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS } from '../../core/constants';
import { DivisionType, UserProfile } from '../../core/types';
import { fetchUsersByClass } from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const StructureModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(u => setMembers(u));
  }, [activeClass]);

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
        title: `Kerabat Kerja Teater ${activeClass?.name}`,
        text: `Daftar susunan kerabat kerja produksi teater SP-PPT SMPN 10 Samarinda kelas ${activeClass?.name}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Tautan bagan kerabat kerja disalin ke clipboard!', 'info');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <Users className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Struktur Kerabat Kerja & Direktori Kontak
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Susunan kepanitiaan produksi {activeClass?.name} ({members.length} anggota terdaftar)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleShareStructure}
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-2 transition"
        >
          <Share2 className="w-4 h-4" />
          <span>Bagikan Kerabat</span>
        </button>
      </div>

      {/* Filter Tabs by Division */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedDivision('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
            selectedDivision === 'ALL'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Semua Divisi ({members.length})
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
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {d.id} ({count})
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama anggota atau nomor kontak..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
        />
      </div>

      {/* Members Grid by Division */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
          const isMe = member.uid === user?.uid;
          const waLink = getWhatsAppLink(member.phone, member.displayName);

          return (
            <div
              key={member.uid}
              className={`p-5 rounded-3xl bg-white border transition relative flex flex-col justify-between ${
                isMe
                  ? 'border-amber-400 shadow-md ring-2 ring-amber-400/20'
                  : 'border-slate-200/80 shadow-xs hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {member.photoURL ? (
                      <img
                        src={member.photoURL}
                        alt={member.displayName}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                        {member.displayName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-slate-900 line-clamp-1">
                          {member.displayName}
                        </h4>
                        {isMe && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                            Anda
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-amber-700 mt-0.5">{member.role}</p>
                      <p className="text-[10px] text-slate-400">{member.divisionName || 'Pemeran'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                  {member.phone ? (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-slate-700">{member.phone}</span>
                    </p>
                  ) : (
                    <p className="text-slate-400 italic">Nomor kontak belum dicantumkan</p>
                  )}
                </div>
              </div>

              {/* Direct WhatsApp Chat Action */}
              <div className="mt-4 pt-2 flex items-center gap-2">
                {member.phone ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chat WhatsApp</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed"
                  >
                    Kontak Tidak Tersedia
                  </button>
                )}

                <button
                  onClick={() => setSelectedMember(member)}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
                  title="Lihat Detail Anggota"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <div className="text-center">
              {selectedMember.photoURL ? (
                <img
                  src={selectedMember.photoURL}
                  alt={selectedMember.displayName}
                  className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-amber-400 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-100 text-slate-800 font-bold text-xl flex items-center justify-center mx-auto border border-slate-200">
                  {selectedMember.displayName.charAt(0)}
                </div>
              )}
              <h3 className="text-base font-extrabold text-slate-900 mt-3">{selectedMember.displayName}</h3>
              <p className="text-xs font-bold text-amber-700">{selectedMember.role}</p>
              <p className="text-xs text-slate-500">{selectedMember.divisionName || 'Pemeran'} • {selectedMember.className}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">NIS:</span>
                <span className="font-bold text-slate-800 font-mono">{selectedMember.nis || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Email:</span>
                <span className="font-bold text-slate-800">{selectedMember.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">No. WhatsApp:</span>
                <span className="font-bold text-slate-800 font-mono">{selectedMember.phone || '-'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
              {selectedMember.phone && (
                <a
                  href={getWhatsAppLink(selectedMember.phone, selectedMember.displayName)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" /> Buka WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
