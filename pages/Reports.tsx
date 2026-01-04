
import React, { useState } from 'react';
import { User } from '../types';
import ReportsDashboard from './ReportsDashboard'; 
import ProfitSummary from './ProfitSummary';
import { BarChart3, TrendingUp, ShoppingBag, Package, PieChart } from 'lucide-react';

interface Props {
  user: User;
}

const Reports: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('ANALYTICS');

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
             <h1 className="text-2xl font-bold text-slate-900">Reports Center</h1>
             <p className="text-slate-500">Business intelligence and performance metrics.</p>
          </div>
       </div>

       {/* Tabs */}
       <div className="flex overflow-x-auto border-b border-slate-200 no-scrollbar">
          {[
            { id: 'ANALYTICS', label: 'Dashboard', icon: BarChart3 },
            { id: 'PROFIT', label: 'Profit & Leakage', icon: PieChart },
            { id: 'SALES', label: 'Sales History', icon: TrendingUp },
            { id: 'PURCHASE', label: 'Purchases', icon: ShoppingBag },
            { id: 'STOCK', label: 'Inventory Value', icon: Package },
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap text-sm ${
                  activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600 font-bold' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
             >
                <tab.icon size={18} className={activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'} /> {tab.label}
             </button>
          ))}
       </div>

       {/* Content Area */}
       <div className="min-h-[500px]">
          {activeTab === 'ANALYTICS' && <ReportsDashboard user={user} />}
          {activeTab === 'PROFIT' && <ProfitSummary />}
          
          {['SALES', 'PURCHASE', 'STOCK'].includes(activeTab) && (
             <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-200 p-20 text-center text-slate-300">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                   <Package size={40} className="opacity-10" />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.2em]">Tab Detail View Coming Soon</p>
                <p className="text-xs font-medium text-slate-400 mt-2">Use Dashboard or Profit views for consolidated data.</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default Reports;
