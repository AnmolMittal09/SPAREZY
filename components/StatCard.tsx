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
      className={`${colorClass} p-8 rounded-[2rem] shadow-soft hover:shadow-premium transition-all duration-300 cursor-pointer group active:scale-[0.99]`}
    >
      <div className="flex items-center justify-between mb-6">
        <span className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.15em]">{title}</span>
        <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
          <Icon size={18} strokeWidth={2.5} className="text-slate-300 group-hover:text-brand-600" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
        {trend && (
          <p className="text-[11px] text-teal-600 font-black uppercase tracking-wider flex items-center gap-1 mt-1">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;