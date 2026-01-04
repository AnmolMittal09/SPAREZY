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
      className={`${colorClass} p-10 rounded-[2.5rem] shadow-3d hover:shadow-3d-hover transition-all duration-500 cursor-pointer group active:scale-[0.98] border border-white card-3d`}
    >
      <div className="flex items-center justify-between mb-8">
        <span className="text-slate-400 font-black text-[12px] uppercase tracking-[0.2em]">{title}</span>
        <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-brand-500 group-hover:text-white transition-all duration-500 shadow-inner-3d transform group-hover:rotate-12">
          <Icon size={24} strokeWidth={2.5} className="text-slate-300 group-hover:text-white" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="text-4xl font-black text-slate-900 tracking-tighter transform transition-transform group-hover:translate-x-1">{value}</h4>
        {trend && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-4 bg-teal-500 rounded-full animate-pulse"></div>
            <p className="text-[12px] text-teal-600 font-black uppercase tracking-wider">
                {trend}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;