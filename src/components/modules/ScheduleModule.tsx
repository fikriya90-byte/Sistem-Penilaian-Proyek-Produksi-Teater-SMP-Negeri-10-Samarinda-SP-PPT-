import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Filter,
  MapPin,
  PlusCircle,
  Trash2,
  UserCheck,
  Users
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIVISIONS } from '../../core/constants';
import { DivisionType, ScheduleEvent, ScheduleType } from '../../core/types';
import {
  createSchedule,
  deleteSchedule,
  recordAuditLog,
  subscribeSchedules
} from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const ScheduleModule: React.FC = () => {
  const { user, activeClass, isTeacher, canCreateGeneralSchedule, canCreateInternalSchedule } = useAuth();
  const { showToast } = useToast();

  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ScheduleType>('Latihan');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('Panggung Terbuka SMPN 10');
  const [participants, setParticipants] = useState('Semua Anggota');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!activeClass) return;
    const unsub = subscribeSchedules(activeClass.id, (events) => {
      setSchedules(events);
    });
    return () => unsub();
  }, [activeClass]);

  const canCreate = canCreateGeneralSchedule || canCreateInternalSchedule;

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass) return;
    if (!title.trim() || !startAt || !endAt) {
      showToast('Harap lengkapi judul dan waktu kegiatan.', 'warning');
      return;
    }

    try {
      const newId = await createSchedule({
        title: title.trim(),
        classId: activeClass.id,
        type,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        location: location.trim(),
        participants: participants.trim(),
        divisionName: user.divisionName,
        pic: user.displayName,
        description: description.trim(),
        createdBy: user.uid,
        creatorName: user.displayName,
      });

      await recordAuditLog({
        userId: user.uid,
        userName: user.displayName,
        role: user.role,
        action: 'CREATE',
        targetType: 'Schedule',
        targetId: newId,
        details: `Membuat jadwal ${type}: ${title}`,
      });

      showToast('Jadwal kegiatan berhasil disimpan ke kalender!', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      showToast('Gagal membuat jadwal: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus agenda "${title}"?`)) return;
    try {
      await deleteSchedule(id);
      showToast('Jadwal berhasil dihapus.', 'info');
    } catch (err: any) {
      showToast('Gagal menghapus: ' + err.message, 'error');
    }
  };

  const filteredSchedules = schedules.filter(s => {
    if (selectedType !== 'ALL' && s.type !== selectedType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <CalendarIcon className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Master Jadwal & Kalender Produksi
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Sinkronisasi agenda latihan, gladi resik, rapat koordinasi, dan pementasan
              </p>
            </div>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tambah Jadwal Kegiatan</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {['ALL', 'Rapat', 'Latihan', 'Gladi', 'Pementasan', 'Fitting', 'Produksi'].map(t => (
          <button
            key={t}
            onClick={() => setSelectedType(t)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedType === t
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t === 'ALL' ? 'Semua Jadwal' : t}
          </button>
        ))}
      </div>

      {/* Schedule Events Timeline List */}
      <div className="space-y-3">
        {filteredSchedules.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            Belum ada jadwal yang direncanakan untuk kategori ini.
          </div>
        ) : (
          filteredSchedules.map(event => {
            const startObj = new Date(event.startAt);
            const endObj = new Date(event.endAt);

            return (
              <div
                key={event.id}
                className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-center shrink-0 min-w-[70px]">
                    <span className="text-[10px] font-bold uppercase block text-amber-700">
                      {startObj.toLocaleDateString('id-ID', { month: 'short' })}
                    </span>
                    <span className="text-xl font-black block">
                      {startObj.getDate()}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                        {event.type}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {startObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {endObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WITA
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900">{event.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 mt-2">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {event.location}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> Peserta: {event.participants}
                      </span>
                      <span className="text-slate-400">
                        PIC: <strong className="text-slate-700">{event.pic}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => showToast('Kehadiran Anda telah dikonfirmasi!', 'success')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Konfirmasi Hadir</span>
                  </button>

                  {isTeacher && (
                    <button
                      onClick={() => handleDelete(event.id, event.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                      title="Hapus Agenda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Create Schedule */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 my-auto">
            <h3 className="text-base font-extrabold text-slate-900">
              Buat Agenda Kegiatan Baru
            </h3>

            <form onSubmit={handleCreateSchedule} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kegiatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Gladi Bersih Panggung Penuh"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Kegiatan</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ScheduleType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="Latihan">Latihan</option>
                  <option value="Rapat">Rapat Koordinasi</option>
                  <option value="Gladi">Gladi Bersih / Kotor</option>
                  <option value="Pementasan">Pementasan Resmi</option>
                  <option value="Fitting">Fitting Busana / Rias</option>
                  <option value="Produksi">Produksi Divisi</option>
                  <option value="Briefing">Briefing Ringkas</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Mulai <span className="text-rose-500">*</span></label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Selesai <span className="text-rose-500">*</span></label>
                  <input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Aula Teater SMPN 10"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cakupan Peserta</label>
                  <input
                    type="text"
                    required
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="Contoh: Pemeran & Tim Musik"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Agenda</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rincian perlengkapan yang wajib dibawa..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800"
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
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
