import React, { useState, useEffect } from 'react';
import { 
  Megaphone, PlusCircle, AlertCircle, Info as InfoIcon, 
  Bell, Trash2, Clock, Calendar, CheckCircle, X 
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';

// Tipe Data Pengumuman
interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'INFO' | 'URGENT' | 'REMINDER';
  createdAt: string;
  authorName: string;
  authorRole: string;
}

export const InformationModule: React.FC = () => {
  const { user, isTeacher, isAdminRole, isPimprod, isSutradara } = useAuth();
  const { showToast } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'INFO' | 'URGENT' | 'REMINDER'>('ALL');

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'INFO' | 'URGENT' | 'REMINDER'>('INFO');

  // Hak akses membuat pengumuman
  const canCreate = isTeacher || isAdminRole || isPimprod || isSutradara;

  // Load Data Dummy (Sementara) 
  // Nanti bisa diganti dengan fetch dari Firebase Firestore
  useEffect(() => {
    setAnnouncements([
      {
        id: '1',
        title: 'Jadwal Gladi Kotor Babak 1 & 2',
        content: 'Seluruh pemain dan divisi tata panggung harap berkumpul di aula utama pada hari Jumat pukul 14.00 WITA. Harap membawa naskah masing-masing.',
        category: 'URGENT',
        createdAt: new Date().toISOString(),
        authorName: 'Fikri Yassaar',
        authorRole: 'Sutradara'
      },
      {
        id: '2',
        title: 'Pengumpulan Konsep Tata Rias',
        content: 'Batas akhir pengumpulan face chart dan palet warna untuk tata rias karakter utama adalah minggu depan. Silakan kumpulkan ke Koordinator Rias.',
        category: 'REMINDER',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 hari lalu
        authorName: 'Siti Aminah',
        authorRole: 'Guru Pengampu'
      },
      {
        id: '3',
        title: 'Pembagian Tugas Divisi Publikasi',
        content: 'Divisi publikasi sudah bisa mulai merancang desain poster utama (ukuran A3) dan banner panggung. Gunakan palet warna sesuai konsep sutradara.',
        category: 'INFO',
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 hari lalu
        authorName: 'Budi Santoso',
        authorRole: 'Pimpinan Produksi'
      }
    ]);
  }, []);

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      showToast('Judul dan isi pengumuman wajib diisi.', 'warning');
      return;
    }

    const newAnnouncement: Announcement = {
      id: `ann-${Date.now()}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
      createdAt: new Date().toISOString(),
      authorName: user?.displayName || 'Pengurus',
      authorRole: user?.role || 'Panitia'
    };

    // Tambahkan ke state (Nanti bisa diganti fungsi simpan ke Firestore)
    setAnnouncements([newAnnouncement, ...announcements]);
    
    showToast('Pengumuman berhasil diterbitkan!', 'success');
    setIsModalOpen(false);
    setNewTitle('');
    setNewContent('');
    setNewCategory('INFO');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Yakin ingin menghapus pengumuman ini?')) {
      setAnnouncements(announcements.filter(a => a.id !== id));
      showToast('Pengumuman dihapus.', 'info');
    }
  };

  const filteredAnnouncements = announcements.filter(a => filter === 'ALL' || a.category === filter);

  // Konfigurasi Visual Kategori
  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'URGENT':
        return { icon: AlertCircle, color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/30' };
      case 'REMINDER':
        return { icon: Bell, color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30' };
      default:
        return { icon: InfoIcon, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Megaphone className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Papan Informasi Produksi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Pusat pengumuman, pengingat jadwal, dan informasi mendesak
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Pengumuman</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {(['ALL', 'INFO', 'URGENT', 'REMINDER'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              filter === cat
                ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat === 'ALL' ? 'Semua Info' : cat === 'INFO' ? 'Informasi Umum' : cat === 'URGENT' ? 'Penting & Mendesak' : 'Pengingat'}
          </button>
        ))}
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm">
            Belum ada pengumuman untuk kategori ini.
          </div>
        ) : (
          filteredAnnouncements.map((ann) => {
            const style = getCategoryStyle(ann.category);
            const Icon = style.icon;

            return (
              <div key={ann.id} className={`p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border ${style.border} shadow-sm relative overflow-hidden group transition hover:shadow-md`}>
                
                {/* Decorative Background */}
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-20 ${style.bg} group-hover:scale-150 transition duration-500 ease-out`} />

                <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className={`p-3 rounded-2xl shrink-0 ${style.bg} ${style.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${style.bg} ${style.color}`}>
                        {ann.category}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ann.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug mb-2">
                      {ann.title}
                    </h3>
                    
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {ann.content}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {ann.authorName.charAt(0)}
                        </div>
                        <div className="text-[11px]">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{ann.authorName}</span>
                          <span className="text-slate-400 mx-1">•</span>
                          <span className="text-slate-500 dark:text-slate-400">{ann.authorRole}</span>
                        </div>
                      </div>

                      {canCreate && (
                        <button onClick={() => handleDelete(ann.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition" title="Hapus Pengumuman">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Create */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-500" /> Terbitkan Pengumuman
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pilih Kategori</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setNewCategory('INFO')} className={`py-2 rounded-xl text-xs font-bold transition border ${newCategory === 'INFO' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>Info Umum</button>
                  <button type="button" onClick={() => setNewCategory('REMINDER')} className={`py-2 rounded-xl text-xs font-bold transition border ${newCategory === 'REMINDER' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>Pengingat</button>
                  <button type="button" onClick={() => setNewCategory('URGENT')} className={`py-2 rounded-xl text-xs font-bold transition border ${newCategory === 'URGENT' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>Mendesak</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Pengumuman</label>
                <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Contoh: Jadwal Gladi Kotor"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-white" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Isi Pesan</label>
                <textarea rows={4} required value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Tuliskan detail pengumuman di sini..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-white leading-relaxed" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Batal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Terbitkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
