

import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus, TransactionType } from '../types';
import DailyTransactions from './DailyTransactions';
import { History, PlusCircle, PackageCheck } from 'lucide-react';
import { fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Purchases: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoading(true);
    // Fetch Approved Purchases
    const data = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.PURCHASE);
    setHistory(data);
    setLoading(false);
  };

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
               <History size={16} /> History
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden">
          {activeTab === 'NEW' && (
             <DailyTransactions user={user} forcedMode="PURCHASE" />
          )}
          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium">
                   <PackageCheck size={18} /> Purchase Log
                </div>

                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No purchase history found.</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-4">Date</th>
                             <th className="px-6 py-4">Part No</th>
                             <th className="px-6 py-4">Supplier</th>
                             <th className="px-6 py-4 text-center">Qty Added</th>
                             <th className="px-6 py-4 text-right">Cost Price</th>
                             <th className="px-6 py-4 text-right">Total Cost</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {history.map(tx => (
                             <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-slate-500">
                                   {new Date(tx.createdAt).toLocaleDateString()}
                                   <div className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900">{tx.partNumber}</td>
                                <td className="px-6 py-4 text-slate-600">{tx.customerName || 'Unknown Supplier'}</td>
                                <td className="px-6 py-4 text-center font-bold text-green-700">+{tx.quantity}</td>
                                <td className="px-6 py-4 text-right">₹{tx.price.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right font-bold text-slate-900">
                                   ₹{(tx.price * tx.quantity).toLocaleString()}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default Purchases;