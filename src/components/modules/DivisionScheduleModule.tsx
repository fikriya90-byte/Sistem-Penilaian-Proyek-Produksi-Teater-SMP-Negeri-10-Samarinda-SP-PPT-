import React, { useState, useEffect } from 'react';
import {
  Users, PlusCircle, Calendar, Lock, Filter, Trash2, Info, MapPin, Clock,
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { recordAuditLog } from '../../services/firestoreService';
import { DivisionType } from '../../core/types';
import { HorizontalCarousel } from '../common/HorizontalCarousel';

const DIVISION_LIST: DivisionType[] = [
  'Pengurus Inti',
  'Pemeran',
  'Perlengkapan',
  'Publikasi & Dokumentasi',
  'Tata Panggung',
  'Tata Rias',
  'Tata Busana',
  'Tata Musik & Suara',
];

export const DivisionScheduleModule: React.FC = () => {
  const {
    user, activeClass,
    isGuruPengampu, isAdminRole, isPimprod, isSekretaris, isSutradara,
  } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const [selectedDivision, setSelectedDivision] = useState<string>('');

  const isKoordinator = user?.role.startsWith('Koordinator ') ?? false;
  const myDivision = user?.divisionName || '';

  // 🔑 Staff yang bisa lihat & isi SEMUA divisi
  const isStaffFullAccess = isGuruPengampu || isAdminRole || isPimprod;
  const canSeeAllDivisions = isStaffFullAccess;

  // 🎯 Apakah user ini punya akses ke halaman ini?
  const hasAnyAccess = (() => {
    if (!user) return false;
    if (isStaffFullAccess) return true;
    if (isKoordinator && myDivision) return true;
    if (myDivision) return true;
    if (isSekretaris || isSutradara) return true;
    return false;
  })();

  // Set default divisi terpilih
  useEffect(() => {
    if (myDivision) {
      setSelectedDivision(myDivision);
    } else if (canSeeAllDivisions && DIVISION_LIST.length > 0) {
      setSelectedDivision(DIVISION_LIST[0]);
    } else if ((isSekretaris || isSutradara) && DIVISION_LIST.length > 0) {
      setSelectedDivision(DIVISION_LIST[0]);
    }
  }, [myDivision, canSeeAllDivisions, isSekretaris, isSutradara]);

  // Load jadwal sesuai divisi terpilih
  useEffect(() => {
    if (!activeClass || !selectedDivision) return;
    const q = query(
      collection(db, 'divisionSchedules'),
      where('classId', '==', activeClass.id),
      where('divisionName', '==', selectedDivision)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setItems(list);
    });
    return () => unsub();
  }, [activeClass, selectedDivision]);

  // Boleh tambah jadwal di divisi terpilih?
  const canAddHere = (() => {
    if (!user) return false;
    if (isStaffFullAccess) return true;
    if (isKoordinator && selectedDivision === myDivision) return true;
    return false;
  })();

  // Daftar divisi yang bisa diakses
  const accessibleDivisions = (() => {
    if (canSeeAllDivisions) return DIVISION_LIST;
    if (isKoordinator && myDivision) return [myDivision as DivisionType];
    if (myDivision) return [myDivision as DivisionType];
    if (isSekretaris || isSutradara) return DIVISION_LIST;
    return [];
  })();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !date) {
      showToast('Isi judul & tanggal jadwal.', 'warning');
      return;
    }
    if (!selectedDivision) {
      showToast('Pilih divisi terlebih dahulu.', 'warning');
      return;
    }
    if (!canAddHere) {
      showToast('Anda tidak berwenang menambah jadwal di divisi ini.', 'warning');
      return;
    }

    try {
      const id = doc(collection(db, 'divisionSchedules')).id;
      await setDoc(doc(db, 'divisionSchedules', id), {
        id,
        classId: activeClass.id,
        divisionName: selectedDivision,
        title: title.trim(),
        description: description.trim(),
        date,
        time: time.trim(),
        location: location.trim(),
        authorName: user.displayName,
        authorRole: user.role,
        createdAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'DivisionSchedule',
        targetId: id,
        details: `Tambah jadwal divisi ${selectedDivision}: "${title.trim()}"`,
      });

      showToast('Jadwal divisi berhasil ditambahkan!', 'success');
      setIsOpen(false);
      setTitle(''); setDate(''); setTime(''); setLocation(''); setDescription('');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  const handleDelete = async (item: any) => {
    if (!user) return;
    const canDel = item.authorName === user.displayName || isStaffFullAccess;
    if (!canDel) {
      showToast('Hanya pembuat atau Guru yang bisa menghapus.', 'warning');
      return;
    }
    if (!confirm(`Hapus jadwal "${item.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'divisionSchedules', item.id));
      showToast('Jadwal dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal: ' + (err?.message || 'Unknown'), 'error');
    }
  };

  // ❌ Tidak punya akses sama sekali
  if (!hasAnyAccess) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
        <Lock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Anda belum terdaftar di divisi manapun
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
          Hubungi <strong>Guru Pengampu</strong> atau <strong>Pimpinan Produksi</strong> untuk
          didaftarkan ke salah satu divisi produksi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-900 to-slate-900 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-purple-300" />
            <div>
              <h2 className="text-xl font-black">Jadwal Internal Divisi</h2>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                {canSeeAllDivisions
                  ? 'Guru/Admin/Pimprod: bisa lihat & isi semua divisi'
                  : myDivision
                  ? `Jadwal khusus divisi ${myDivision}`
                  : 'Lihat jadwal semua divisi (mode lihat)'}
              </p>
            </div>
          </div>
          {canAddHere && (
            <button
              onClick={() => setIsOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <PlusCircle className="w-4 h-4" /> Tambah Jadwal
            </button>
          )}
        </div>
      </div>

      {/* FILTER DIVISI */}
      {accessibleDivisions.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {accessibleDivisions.length > 1 ? 'Pilih Divisi:' : 'Divisi:'}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {accessibleDivisions.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDivision(d)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  selectedDivision === d
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{d}</span>
                {d === myDivision && (
                  <span className="text-[9px] font-black px-1 py-0.5 rounded bg-amber-500 text-slate-950">
                    Saya
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* INFO GURU/PIMPROD */}
      {isStaffFullAccess && (
        <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
            <strong>Sebagai {user?.role}:</strong> Anda bisa lihat & tambah jadwal di <strong>semua divisi</strong>.
            Pilih divisi di atas, lalu klik "Tambah Jadwal".
          </p>
        </div>
      )}

      {/* INFO KOORDINATOR */}
      {isKoordinator && myDivision && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
            Anda koordinator <strong>{myDivision}</strong>. Anda bisa menambah jadwal untuk divisi Anda.
          </p>
        </div>
      )}

      {/* INFO LIHAT-SAJA */}
      {!canAddHere && !isKoordinator && !isStaffFullAccess && myDivision && (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Anda hanya bisa <strong>melihat</strong> jadwal divisi {myDivision}.
            Yang bisa menambah: Koordinator, Guru, Pimprod.
          </p>
        </div>
      )}

      {/* LIST JADWAL */}
      {items.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            Belum ada jadwal untuk {selectedDivision || 'divisi ini'}
          </p>
          {canAddHere && (
            <button
              onClick={() => setIsOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Tambah Jadwal Pertama
            </button>
          )}
        </div>
      ) : (
        <HorizontalCarousel
          title={`📅 Jadwal ${selectedDivision}`}
          subtitle={`${items.length} agenda — geser untuk melihat`}
        >
          {items.map((it: any) => {
            const canDel = it.authorName === user?.displayName || isStaffFullAccess;
            return (
              <div
                key={it.id}
                className="min-w-[270px] max-w-[270px] p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex-shrink-0 relative group"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-md">
                    {new Date(it.date).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                  {it.time && (
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> {it.time}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug pr-6">
                  {it.title}
                </h3>

                {it.location && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {it.location}
                  </p>
                )}

                {it.description && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 italic">
                    {it.description}
                  </p>
                )}

                <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  Oleh: <strong className="text-slate-600 dark:text-slate-300">{it.authorName}</strong>
                </p>

                {canDel && (
                  <button
                    onClick={() => handleDelete(it)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition hover:bg-rose-600 shadow-sm"
                    title="Hapus"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </HorizontalCarousel>
      )}

      {/* MODAL TAMBAH */}
      {isOpen && canAddHere && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 my-auto max-h-[95vh] overflow-y-auto space-y-3 shadow-2xl border border-slate-100 dark:border-slate-700"
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Tambah Jadwal Divisi
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Divisi: <strong className="text-purple-600 dark:text-purple-300">{selectedDivision}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Jadwal <span className="text-rose-500">*</span>
              </label>
              <input
                type="text" required value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Latihan Blocking Babak 2"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date" required value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jam
                </label>
                <input
                  type="time" value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Lokasi
              </label>
              <input
                type="text" value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Panggung Terbuka SMPN 10"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Keterangan
              </label>
              <textarea
                rows={3} value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail agenda, hal yang perlu dibawa, dll"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Simpan Jadwal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};