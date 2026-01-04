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
      className={`${colorClass} p-8 rounded-[2.5rem] border border-slate-100 shadow-soft hover:shadow-premium hover:-translate-y-1 transition-all duration-300 cursor-pointer group active:scale-[0.98] relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/40 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
      
      <div className="relative z-10 flex items-center justify-between mb-8">
        <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-[0.2em]">{title}</span>
        <div className="p-3 bg-slate-50/80 rounded-2xl group-hover:bg-brand-50 group-hover:text-brand-600 transition-all shadow-inner-soft ring-1 ring-slate-100">
          <Icon size={18} strokeWidth={2.5} className="text-slate-400 group-hover:text-brand-600" />
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col gap-1.5">
        <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h4>
        {trend && (
          <p className="text-[10px] text-teal-600 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mt-1 bg-teal-50/50 w-fit px-2 py-0.5 rounded-md">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;