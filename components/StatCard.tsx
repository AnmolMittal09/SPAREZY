
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
      className={`${colorClass} p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-2 md:mb-4">
        <h3 className="text-gray-500 font-medium text-xs md:text-sm truncate">{title}</h3>
        <Icon className="text-gray-400 shrink-0" size={18} />
      </div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-1">
        <span className="text-xl md:text-2xl font-bold text-gray-900 truncate">{value}</span>
        {trend && <span className="text-[10px] md:text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full w-fit">{trend}</span>}
      </div>
    </div>
  );
};

export default StatCard;
