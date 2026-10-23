import React, { useState, useEffect } from 'react';
import { ChevronRight, X, CheckCircle, Info, Sparkles } from 'lucide-react';

export interface GuideStep {
  title: string;
  description: string;
}

interface PageGuideOverlayProps {
  moduleId: string;
  title: string;
  steps: GuideStep[];
}

export const PageGuideOverlay: React.FC<PageGuideOverlayProps> = ({ moduleId, title, steps }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Cek apakah siswa sudah pernah membaca panduan halaman ini
    try {
      const hasRead = localStorage.getItem(`spppt-guide-${moduleId}`);
      if (!hasRead) {
        setIsOpen(true);
      }
    } catch {
      // Abaikan jika localStorage diblokir
    }
  }, [moduleId]);

  const handleSkip = () => {
    try { localStorage.setItem(`spppt-guide-${moduleId}`, 'true'); } catch {}
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSkip();
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100">
              Panduan Penggunaan
            </span>
          </div>
          <h2 className="text-lg font-black">{title}</h2>
          <button 
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
            title="Lewati Panduan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/20 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-500/30">
              Langkah {currentStep + 1} dari {steps.length}
            </span>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <span 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentStep ? 'w-6 bg-blue-500' : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                  }`} 
                />
              ))}
            </div>
          </div>

          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-2">
          <button 
            onClick={handleSkip}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Lewati
          </button>
          <button 
            onClick={handleNext}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
          >
            {isLast ? (
              <><CheckCircle className="w-4 h-4" /> Saya Mengerti</>
            ) : (
              <>Lanjut <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
