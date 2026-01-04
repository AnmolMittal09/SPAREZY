
import React, { useState } from 'react';
import { User } from '../types';
import ReportsDashboard from './ReportsDashboard'; // Original Reports content
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
       <div className="flex overflow-x-auto border-b border-slate-200">
          {[
            { id: 'ANALYTICS', label: 'Analytics Dashboard', icon: BarChart3 },
            { id: 'SALES', label: 'Sales Reports', icon: TrendingUp },
            { id: 'PURCHASE', label: 'Purchase Reports', icon: ShoppingBag },
            { id: 'STOCK', label: 'Stock Valuation', icon: Package },
            { id: 'PROFIT', label: 'Profit Summary', icon: PieChart },
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600 font-bold' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
             >
                <tab.icon size={18} /> {tab.label}
             </button>
          ))}
       </div>

       {/* Content Area */}
       <div className="min-h-[500px]">
          {activeTab === 'ANALYTICS' && <ReportsDashboard user={user} />}
          {activeTab !== 'ANALYTICS' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                <p className="text-lg">Detailed {activeTab.toLowerCase()} report module is under construction.</p>
                <p className="text-sm">Please check the Analytics Dashboard for summary metrics.</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default Reports;
