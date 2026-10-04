import React, { createContext, useContext, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4">
        {toasts.map(toast => {
          let bg = 'bg-emerald-600 text-white border-emerald-500';
          let icon = <CheckCircle className="w-5 h-5 shrink-0" />;

          if (toast.type === 'error') {
            bg = 'bg-rose-600 text-white border-rose-500';
            icon = <AlertCircle className="w-5 h-5 shrink-0" />;
          } else if (toast.type === 'warning') {
            bg = 'bg-amber-600 text-white border-amber-500';
            icon = <AlertTriangle className="w-5 h-5 shrink-0" />;
          } else if (toast.type === 'info') {
            bg = 'bg-blue-600 text-white border-blue-500';
            icon = <Info className="w-5 h-5 shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${bg}`}
            >
              {icon}
              <div className="flex-1 pt-0.5 leading-snug">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-75 hover:opacity-100 p-0.5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
