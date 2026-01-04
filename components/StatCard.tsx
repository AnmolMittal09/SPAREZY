import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  colorClass?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, colorClass = "bg-white", onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`${colorClass} p-5 rounded-2xl border border-slate-200/60 shadow-soft hover:shadow-premium hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group active:scale-[0.99] relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50/40 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
      
      <div className="relative z-10 flex items-center justify-between mb-4">
        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{title}</span>
        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-brand-50 group-hover:text-brand-600 transition-all ring-1 ring-slate-100">
          <Icon size={16} strokeWidth={2.5} className="text-slate-400 group-hover:text-brand-600" />
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col gap-1">
        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h4>
        {trend && (
          <p className="text-[9px] text-teal-600 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-0.5 bg-teal-50 w-fit px-1.5 py-0.5 rounded shadow-inner">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;