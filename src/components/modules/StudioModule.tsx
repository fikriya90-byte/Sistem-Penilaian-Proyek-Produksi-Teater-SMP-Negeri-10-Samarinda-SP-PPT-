import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  CheckCircle,
  Clock,
  Layers,
  Mic,
  Music,
  Play,
  Save,
  Scissors,
  Sparkles,
  Square,
  Users,
  Volume2
} from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { DIALOG_PRACTICE_STEPS } from '../../core/constants';
import { PromptBookScene, UserProfile } from '../../core/types';
import { fetchUsersByClass, savePromptBookScene, subscribePromptBooks } from '../../services/firestoreService';
import { useToast } from '../common/Toast';

export const StudioModule: React.FC = () => {
  const { user, activeClass, isSutradara, isAsisten, isTeacher, isPemain } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'script' | 'dialog' | 'recorder' | 'blocking' | 'timers'>('blocking');
  const [actors, setActors] = useState<UserProfile[]>([]);
  const [scenes, setScenes] = useState<PromptBookScene[]>([]);
  const [selectedScene, setSelectedScene] = useState<string>('Babak 2 Adegan 1');

  // 3x3 Stage Grid Position state (zone -> actorId)
  const [gridMapping, setGridMapping] = useState<Record<string, string>>({
    'UC': 'student-pemain-1',
    'CR': 'student-pemain-2',
  });
  const [cueNotes, setCueNotes] = useState(
    'CUE 01 (00:00:15) Lampu sorot emas mengarah ke singgasana ratu.\nCUE 02 (00:01:20) Petikan sape tempo duka berbunyi pelan saat utusan masuk.\nCUE 03 (00:04:10) Gong ditabuh keras tanda penolakan tegas.'
  );

  // Audio Voice Recorder state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Timer simulation state (for Quick Change / Stage Setup)
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerTarget, setTimerTarget] = useState(120); // 2 minutes default

  useEffect(() => {
    if (!activeClass) return;
    fetchUsersByClass(activeClass.id).then(u => {
      setActors(u.filter(s => s.role === 'Pemain' || s.role === 'Sutradara' || s.role === 'Asisten Sutradara'));
    });

    const unsub = subscribePromptBooks(activeClass.id, (b) => {
      setScenes(b);
      if (b.length > 0) {
        setGridMapping(b[0].gridPositions || {});
        setCueNotes(b[0].cues?.map(c => `${c.code} (${c.timing}) ${c.action}`).join('\n') || cueNotes);
      }
    });

    return () => unsub();
  }, [activeClass]);

  // Voice recording logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      showToast('Perekaman suara dialog dimulai...', 'info');
    } catch (err) {
      showToast('Izin mikrofon diperlukan atau peramban tidak mendukung perekaman suara.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      showToast('Rekaman suara berhasil disimpan sementara!', 'success');
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Quick Change / Dry Run Timer logic
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // 3x3 Stage Zones
  const STAGE_ZONES = [
    { code: 'UL', label: 'Upstage Left (Belakang Kiri)' },
    { code: 'UC', label: 'Upstage Center (Belakang Tengah)' },
    { code: 'UR', label: 'Upstage Right (Belakang Kanan)' },
    { code: 'CL', label: 'Center Left (Tengah Kiri)' },
    { code: 'C', label: 'Center Stage (Pusat Panggung)' },
    { code: 'CR', label: 'Center Right (Tengah Kanan)' },
    { code: 'DL', label: 'Downstage Left (Depan Kiri)' },
    { code: 'DC', label: 'Downstage Center (Depan Tengah)' },
    { code: 'DR', label: 'Downstage Right (Depan Kanan)' },
  ];

  const handleSavePromptBook = async () => {
    if (!activeClass || !user) return;
    try {
      await savePromptBookScene({
        id: `pb-${selectedScene.replace(/\s+/g, '-').toLowerCase()}`,
        classId: activeClass.id,
        scene: selectedScene,
        gridPositions: gridMapping,
        notes: 'Pola blocking posisi aktor di atas panggung.',
        updatedBy: user.uid,
        updatedAt: new Date().toISOString(),
      });
      showToast('Posisi blocking panggung & cue sheet berhasil disimpan!', 'success');
    } catch (err: any) {
      showToast('Gagal menyimpan blocking: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Sparkles className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Studio Teater & Peranti Artistik
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Prompt Book 3x3, Perekam Suara Aktor, Latihan 10 Langkah, & Simulasi Waktu
              </p>
            </div>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('blocking')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'blocking' ? 'bg-white text-slate-950 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            📐 3x3 Blocking Panggung
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'script' ? 'bg-white text-slate-950 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            📜 Naskah Digital
          </button>
          <button
            onClick={() => setActiveTab('dialog')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'dialog' ? 'bg-white text-slate-950 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            🗣️ 10 Langkah Dialog
          </button>
          <button
            onClick={() => setActiveTab('recorder')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'recorder' ? 'bg-white text-rose-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            🎙️ Perekam Suara
          </button>
          <button
            onClick={() => setActiveTab('timers')}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === 'timers' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            ⏱️ Timer Simulasi
          </button>
        </div>
      </div>

      {/* 1. TAB: 3x3 Stage Blocking Grid */}
      {activeTab === 'blocking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 3x3 Stage Canvas */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-amber-600 uppercase">Editor Posisi Panggung</span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Grid 3×3 Panggung (Orientasi Penonton di Bawah)
                </h3>
              </div>

              <button
                onClick={handleSavePromptBook}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Posisi</span>
              </button>
            </div>

            {/* Stage Direction Banner */}
            <div className="text-center py-1 bg-slate-900 text-amber-400 text-[10px] font-bold tracking-widest rounded-t-xl uppercase">
              ▲ DINDING BELAKANG PANGGUNG (UPSTAGE) ▲
            </div>

            {/* 3x3 Visual Grid */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-800 rounded-b-2xl border-4 border-slate-900 min-h-[380px]">
              {STAGE_ZONES.map(zone => {
                const assignedActorId = gridMapping[zone.code];
                const actorObj = actors.find(a => a.uid === assignedActorId);

                return (
                  <div
                    key={zone.code}
                    className="p-3 rounded-2xl bg-slate-700/60 border border-slate-600/80 flex flex-col justify-between hover:bg-slate-700 transition min-h-[110px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-amber-300 font-mono">
                        {zone.code}
                      </span>
                      <span className="text-[9px] text-slate-400 truncate max-w-[100px]">
                        {zone.label.split('(')[0]}
                      </span>
                    </div>

                    <div className="py-2 text-center">
                      {actorObj ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md animate-in zoom-in-95">
                          <Users className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[120px]">{actorObj.displayName.split('(')[0]}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Area Kosong</span>
                      )}
                    </div>

                    {/* Zone selector dropdown */}
                    <select
                      value={assignedActorId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGridMapping(prev => {
                          const updated = { ...prev };
                          if (val) updated[zone.code] = val;
                          else delete updated[zone.code];
                          return updated;
                        });
                      }}
                      className="w-full text-[10px] font-semibold py-1 px-1.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-600 focus:outline-hidden"
                    >
                      <option value="">(Pilih Aktor di Posisi Ini)</option>
                      {actors.map(a => (
                        <option key={a.uid} value={a.uid}>
                          {a.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="text-center py-2 bg-amber-500/20 text-amber-900 border border-amber-300 rounded-xl text-xs font-black tracking-wider uppercase">
              ▼ AUDIENCE / PENONTON (DOWNSTAGE) ▼
            </div>
          </div>

          {/* Cue Sheet & Notes */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-600" /> Lembar Cue Musik & Tata Cahaya
            </h3>
            <p className="text-xs text-slate-500">
              Instruksi teknis waktu pergantian adegan untuk tim Tata Musik dan Tata Panggung:
            </p>

            <textarea
              rows={12}
              value={cueNotes}
              onChange={(e) => setCueNotes(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-200 text-xs font-mono font-medium text-slate-800 leading-relaxed bg-slate-50"
            />

            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
              💡 <strong>Tips Sutradara:</strong> Sinkronkan kode CUE-01 hingga CUE-10 bersama Koordinator Tata Musik agar timing audio sape dan gong tepat saat dialog kunci diucapkan.
            </div>
          </div>

        </div>
      )}

      {/* 2. TAB: Digital Script Reader */}
      {activeTab === 'script' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase">Naskah Digital Interaktif</span>
              <h3 className="text-base font-extrabold text-slate-900">
                Naskah Lakon: Titah Sang Ratu Aji Bidara Putih (Babak 2)
              </h3>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              Mode Baca Siang
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-amber-50/40 border border-amber-200/60 font-serif text-sm sm:text-base leading-relaxed text-slate-800 space-y-4 max-h-[500px] overflow-y-auto">
            <div className="text-center font-sans border-b border-amber-200 pb-3">
              <p className="font-extrabold text-base text-slate-900 uppercase">BABAK II: GELORA HARGA DIRI DI SINGGASANA</p>
              <p className="text-xs text-slate-500 italic mt-0.5">
                (Latar istana Muara Kaman. Lampu sorot temaram. Ratu Aji Bidara Putih duduk anggun di singgasana berbalut busana sutra putih gading.)
              </p>
            </div>

            <div>
              <p className="font-sans font-black text-amber-800 text-xs uppercase tracking-wider">
                UTUSAN SAUDAGAR TIONGKOK (Membungkuk hormat dengan suara lantang):
              </p>
              <p className="mt-1 pl-4 border-l-2 border-amber-400 italic">
                "Ampun Baginda Ratu Yang Agung. Jung kapal kami merapat membawa sutra, emas, dan perhiasan tak terhingga dari daratan seberang. Tuanku Raja Tiongkok berniat memperistri Baginda untuk menyatukan dua peradaban besar di tanah Kalimantan ini."
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-100/60 border border-amber-300">
              <p className="font-sans font-black text-slate-900 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>RATU AJI BIDARA PUTIH (Berdiri tegak, menatap tajam):</span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-md">Dialog Utama</span>
              </p>
              <p className="mt-1 text-slate-900 font-semibold leading-relaxed">
                "Dengarkan baik-baik wahai utusan! Kemuliaan negeri Muara Kaman tidak dapat dibeli dengan tumpukan peti emas maupun kemilau sutra. Rakyatku hidup berdaulat di atas tanah leluhurnya sendiri! Sampaikan kepada saudagarmu, lamaran ini KAMI TOLAK!"
              </p>
            </div>

            <div>
              <p className="font-sans font-black text-blue-800 text-xs uppercase tracking-wider">
                PANGLIMA KERAJAAN (Menghunus keris pusaka setengah jengkal):
              </p>
              <p className="mt-1 pl-4 border-l-2 border-blue-400 italic">
                "Daulat Tuanku! Seluruh prajurit Mahakam siap mempertaruhkan darah jika kehormatan tanah pusaka ini diganggu!"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: 10 Steps Dialog Practice */}
      {activeTab === 'dialog' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-5">
          <div>
            <span className="text-xs font-bold text-amber-600 uppercase">Panduan Aktor Teater</span>
            <h3 className="text-base font-extrabold text-slate-900">
              Metode 10 Langkah Penguasaan Dialog & Keaktoran
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ikuti alur bertahap berikut untuk mengasah penjiwaan dan proyeksi vokal sebelum gladi resik.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {DIALOG_PRACTICE_STEPS.map(item => (
              <div
                key={item.step}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-start gap-3 hover:border-amber-400 transition"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0 text-sm shadow-xs">
                  {item.step}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.tip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TAB: Voice Recorder */}
      {activeTab === 'recorder' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6 max-w-2xl mx-auto text-center">
          <div>
            <span className="text-xs font-bold text-rose-600 uppercase">Studio Latihan Vokal Mandiri</span>
            <h3 className="text-lg font-extrabold text-slate-900 mt-1">
              Perekam Suara Latihan Dialog Aktor
            </h3>
            <p className="text-xs text-slate-500">
              Rekam pembacaan dialog monolog Anda dan evaluasi kembali intonasi serta dinamika suara.
            </p>
          </div>

          {/* Recording UI */}
          <div className="p-8 rounded-3xl bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-rose-600 animate-ping' : 'bg-slate-800 border-2 border-slate-700'
            }`}>
              <Mic className="w-10 h-10 text-white" />
            </div>

            <div>
              <p className="text-3xl font-black font-mono text-amber-400">
                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                {(recordingTime % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isRecording ? 'Sedang merekam suara dialog...' : 'Siap merekam dialog'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Mulai Rekam Suara</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <Square className="w-4 h-4 fill-slate-950" />
                  <span>Hentikan & Simpan</span>
                </button>
              )}
            </div>
          </div>

          {/* Playback Preview */}
          {audioUrl && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2">
              <span className="text-xs font-bold text-amber-900 block">Dengar Ulang Rekaman Terakhir:</span>
              <audio controls src={audioUrl} className="w-full" />
              <p className="text-[11px] text-slate-500 italic">
                Dengarkan kejernihan artikulasi huruf konsonan dan kekuatan vokal pada akhir kalimat.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB: Timers for Quick Change & Dry Runs */}
      {activeTab === 'timers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Quick Change Timer */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs text-center space-y-4">
            <span className="text-xs font-bold text-indigo-600 uppercase">Divisi Tata Busana & Rias</span>
            <h3 className="text-base font-extrabold text-slate-900">
              Simulasi Quick Change (Ganti Kostum Cepat)
            </h3>
            <p className="text-xs text-slate-500">
              Target standar teater: Pergantian gaun/jubah antar babak maksimal 2 menit (120 detik).
            </p>

            <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-200">
              <p className="text-4xl font-black font-mono text-indigo-950">
                {Math.floor(timerSeconds / 60)}m {timerSeconds % 60}d
              </p>
              <p className="text-xs font-semibold text-indigo-600 mt-1">
                Target: &lt; 2 menit
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                {isTimerRunning ? 'Jeda Timer' : 'Mulai Simulasi'}
              </button>
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(0);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Stage Set & Strike Timer */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs text-center space-y-4">
            <span className="text-xs font-bold text-purple-600 uppercase">Divisi Tata Panggung & Properti</span>
            <h3 className="text-base font-extrabold text-slate-900">
              Simulasi Gladi Kering (Set & Strike Panggung)
            </h3>
            <p className="text-xs text-slate-500">
              Target standar pemasangan dekorasi 10 menit, dan pembongkaran panggung (strike) maksimal 5 menit.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 text-slate-700">
              <div className="flex justify-between font-semibold">
                <span>⏱️ Pemasangan Set Babak 1:</span>
                <span className="font-bold text-emerald-600">Target 10 Menit</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>⏱️ Pembongkaran (Strike Panggung):</span>
                <span className="font-bold text-amber-600">Target 5 Menit</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>🛠️ Pengecekan Keamanan Konstruksi:</span>
                <span className="font-bold text-blue-600">Sebelum Gladi Kotor</span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
