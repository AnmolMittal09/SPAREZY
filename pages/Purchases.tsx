
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
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       
       {/* --- MOBILE COMPACT HEADER --- */}
       <div className="md:hidden bg-white px-4 pt-3 pb-2 shadow-sm z-20 sticky top-0 border-b border-slate-100">
          <div className="mb-2">
             <h1 className="text-xl font-black text-slate-900 leading-tight">Purchases</h1>
             <p className="text-xs text-slate-500 font-medium">Stock In & History</p>
          </div>
          
          {/* Segmented Control */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
               onClick={() => setActiveTab('NEW')}
               className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'NEW' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               New Purchase
             </button>
             <button 
               onClick={() => setActiveTab('HISTORY')}
               className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               History
             </button>
          </div>
       </div>

       {/* --- DESKTOP HEADER --- */}
       <div className="hidden md:flex justify-between items-center mb-4 space-y-4">
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

       <div className="flex-1 overflow-hidden flex flex-col">
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
                    <>
                    {/* Mobile Card List */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {history.map(tx => (
                            <div key={tx.id} className="p-4 bg-white">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <div className="font-bold text-slate-900 text-base">{tx.partNumber}</div>
                                        <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-slate-900 text-base">₹{(tx.price * tx.quantity).toLocaleString()}</div>
                                        <div className="text-[10px] text-green-700 font-bold bg-green-50 px-1 rounded inline-block">+{tx.quantity} Stock</div>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 truncate">
                                    Supplier: {tx.customerName || 'Unknown'}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-sm text-left">
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
                    </>
                  )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default Purchases;
