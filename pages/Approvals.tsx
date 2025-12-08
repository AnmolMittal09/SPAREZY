
import React, { useState } from 'react';
import { User, TransactionType } from '../types';
import PendingTransactions from '../components/PendingTransactions';
import { CheckSquare, Receipt, Truck } from 'lucide-react';

interface Props {
  user: User;
}

const Approvals: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASES'>('SALES');

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <CheckSquare className="text-orange-600" /> Pending Approvals
          </h1>
          <p className="text-slate-500">Review and authorize transactions submitted by managers.</p>
       </div>

       {/* Tab Navigation */}
       <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-fit shadow-sm">
          <button 
             onClick={() => setActiveTab('SALES')}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'SALES' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
             }`}
          >
             <Receipt size={16} /> Sales Invoices
          </button>
          <button 
             onClick={() => setActiveTab('PURCHASES')}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'PURCHASES' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
             }`}
          >
             <Truck size={16} /> Purchase Orders
          </button>
       </div>

       {/* Content Area */}
       <div className="flex-1">
          {activeTab === 'SALES' && (
             <div className="animate-fade-in">
                <PendingTransactions type={TransactionType.SALE} />
             </div>
          )}
          {activeTab === 'PURCHASES' && (
             <div className="animate-fade-in">
                <PendingTransactions type={TransactionType.PURCHASE} />
             </div>
          )}
       </div>
    </div>
  );
};

export default Approvals;
