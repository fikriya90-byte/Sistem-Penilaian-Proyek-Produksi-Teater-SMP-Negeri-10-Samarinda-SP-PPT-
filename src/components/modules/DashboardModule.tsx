import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../core/authContext';

import {
  GuruDashboard, PimprodDashboard, SutradaraDashboard, AsistenDashboard,
  SekretarisDashboard, BendaharaDashboard,
  KoorPerlengkapanDashboard, KoorPublikasiDashboard, KoorPanggungDashboard,
  KoorRiasDashboard, KoorBusanaDashboard, KoorMusikDashboard,
  AnggotaPerlengkapanDashboard, AnggotaPublikasiDashboard, AnggotaPanggungDashboard,
  AnggotaRiasDashboard, AnggotaBusanaDashboard, AnggotaMusikDashboard,
  PemainDashboard,
} from './RoleDashboards';

interface DashboardModuleProps {
  onNavigate: (module: string) => void;
}

const UniversalHeader: React.FC = () => {
  const { user, activeClass } = useAuth();
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-6 sm:p-8 shadow-xl border border-amber-500/20 mb-5">
      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {activeClass?.name || 'Belum Ada Kelas'} • Proyek Seni Teater
          </span>
          <span className="text-xs text-slate-400 font-medium">Tahun Ajaran 2025/2026</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Selamat datang, {user?.displayName || 'Sahabat Teater'}! 👋
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
          <strong>{user?.role}</strong>
          {user?.divisionName ? ` • ${user.divisionName}` : ''}
          {activeClass ? ` • ${activeClass.name}` : ''}
        </p>
        <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10 max-w-xl text-xs text-amber-200/90 italic flex items-center gap-2">
          <span className="not-italic text-base">💬</span>
          <span>"Teater bukan hanya seni berakting, melainkan cermin kedisiplinan, kejujuran jiwa, dan harmoni kerja sama."</span>
        </div>
      </div>
    </div>
  );
};

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { user, isGuruPengampu, isAdminRole } = useAuth();
  const role = user?.role || '';

  const renderRoleDashboard = () => {
    // GURU PENGAMPU
    if (isGuruPengampu && !isAdminRole) {
      return <GuruDashboard onNavigate={onNavigate} />;
    }

    switch (role) {
      case 'Pimpinan Produksi': return <PimprodDashboard onNavigate={onNavigate} />;
      case 'Sutradara': return <SutradaraDashboard onNavigate={onNavigate} />;
      case 'Asisten Sutradara': return <AsistenDashboard onNavigate={onNavigate} />;
      case 'Sekretaris': return <SekretarisDashboard onNavigate={onNavigate} />;
      case 'Bendahara': return <BendaharaDashboard onNavigate={onNavigate} />;

      // KOORDINATOR
      case 'Koordinator Perlengkapan': return <KoorPerlengkapanDashboard onNavigate={onNavigate} />;
      case 'Koordinator Publikasi': return <KoorPublikasiDashboard onNavigate={onNavigate} />;
      case 'Koordinator Tata Panggung': return <KoorPanggungDashboard onNavigate={onNavigate} />;
      case 'Koordinator Tata Rias': return <KoorRiasDashboard onNavigate={onNavigate} />;
      case 'Koordinator Tata Busana': return <KoorBusanaDashboard onNavigate={onNavigate} />;
      case 'Koordinator Tata Musik': return <KoorMusikDashboard onNavigate={onNavigate} />;

      // ANGGOTA
      case 'Anggota Perlengkapan': return <AnggotaPerlengkapanDashboard onNavigate={onNavigate} />;
      case 'Anggota Publikasi': return <AnggotaPublikasiDashboard onNavigate={onNavigate} />;
      case 'Anggota Tata Panggung': return <AnggotaPanggungDashboard onNavigate={onNavigate} />;
      case 'Anggota Tata Rias': return <AnggotaRiasDashboard onNavigate={onNavigate} />;
      case 'Anggota Tata Busana': return <AnggotaBusanaDashboard onNavigate={onNavigate} />;
      case 'Anggota Tata Musik': return <AnggotaMusikDashboard onNavigate={onNavigate} />;

      // PEMAIN
      case 'Pemain': return <PemainDashboard onNavigate={onNavigate} />;

      default: return <GuruDashboard onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <UniversalHeader />
      {renderRoleDashboard()}
    </div>
  );
};
