
import React, { useState } from 'react';
import { User } from '../types';
import DailyTransactions from './DailyTransactions';
import { History, PlusCircle } from 'lucide-react';

interface Props {
  user: User;
}

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  return (
    <div className="space-y-4 h-full flex flex-col">
       <div className="flex justify-between items-center">
          <div>
             <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
             <p className="text-slate-500">Record stock coming in from suppliers.</p>
          </div>
          <div className="flex bg-white p-1 rounded-lg border border-slate-200">
             <button 
               onClick={() => setActiveTab('NEW')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'NEW' ? 'bg-blue-800 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <PlusCircle size={16} /> New Purchase
             </button>
             <button 
               onClick={() => setActiveTab('HISTORY')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-blue-800 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <History size={16} /> Purchase History
             </button>
          </div>
       </div>

       <div className="flex-1">
          {activeTab === 'NEW' ? (
             <DailyTransactions user={user} forcedMode="PURCHASE" />
          ) : (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                <History className="mx-auto mb-2 opacity-20" size={48} />
                <p>Purchase History module coming soon.</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default Purchases;
