
import React, { useState } from 'react';
import { User } from '../types';
import DailyTransactions from './DailyTransactions'; // Reusing logic for now, but wrapped
import { History, PlusCircle } from 'lucide-react';

interface Props {
  user: User;
}

const Billing: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  return (
    <div className="space-y-4 h-full flex flex-col">
       <div className="flex justify-between items-center">
          <div>
             <h1 className="text-2xl font-bold text-slate-900">Billing & Invoices</h1>
             <p className="text-slate-500">Create invoices for retail or garage customers.</p>
          </div>
          <div className="flex bg-white p-1 rounded-lg border border-slate-200">
             <button 
               onClick={() => setActiveTab('NEW')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <PlusCircle size={16} /> New Invoice
             </button>
             <button 
               onClick={() => setActiveTab('HISTORY')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <History size={16} /> Invoice List
             </button>
          </div>
       </div>

       <div className="flex-1">
          {/* We reuse the core transaction logic but force SALES mode */}
          {activeTab === 'NEW' ? (
             <DailyTransactions user={user} forcedMode="SALES" />
          ) : (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                <History className="mx-auto mb-2 opacity-20" size={48} />
                <p>Invoice History module coming soon.</p>
                {/* Note: In a full impl, this would reuse fetchTransactions filtered by SALE */}
             </div>
          )}
       </div>
    </div>
  );
};

export default Billing;
