import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  title?: string;
  icon?: any;
  subtitle?: string;
}

export const HorizontalCarousel: React.FC<Props> = ({ children, title, icon: Icon, subtitle }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return;
    const amount = ref.current.clientWidth * 0.8;
    ref.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-amber-600" />}
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => scroll('left')}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => scroll('right')}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <div ref={ref}
        className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>
    </div>
  );
};
