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
      className={`${colorClass} p-5 rounded-xl shadow-3d border border-slate-200 hover:shadow-premium transition-all duration-200 cursor-pointer group active:scale-[0.99]`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">{title}</span>
        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
          <Icon size={16} strokeWidth={2.5} className="text-slate-400 group-hover:text-brand-600" />
        </div>
      </div>
      <div className="flex flex-col">
        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h4>
        {trend && (
          <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;