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
      className={`${colorClass} p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 font-medium text-sm">{title}</h3>
        <Icon className="text-gray-400" size={20} />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend && <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">{trend}</span>}
      </div>
    </div>
  );
};

export default StatCard;
