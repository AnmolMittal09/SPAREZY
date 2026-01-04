import React, { useState, useEffect } from 'react';
import { User, TransactionType, Transaction, TransactionStatus } from '../types';
import PendingTransactions from '../components/PendingTransactions';
import { CheckSquare, Receipt, Truck, History, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Approvals: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASES' | 'LOG'>('SALES');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (activeTab === 'LOG') {
      loadLog();
    }
  }, [activeTab]);

  const loadLog = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await fetchTransactions([TransactionStatus.APPROVED, TransactionStatus.REJECTED]);
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
               <CheckSquare className="text-orange-600" /> Pending Approvals
            </h1>
            <p className="text-slate-500">Review and authorize transactions submitted by managers.</p>
          </div>
          <button 
             onClick={() => loadLog(true)}
             disabled={refreshing}
             className={`p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-brand-600 transition-all active:scale-95 shadow-sm ${refreshing ? 'opacity-50' : ''}`}
          >
             <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
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
          <button 
             onClick={() => setActiveTab('LOG')}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'LOG' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
             }`}
          >
             <History size={16} /> Approval Log
          </button>
       </div>

       {/* Content Area */}
       <div className="flex-1 overflow-hidden">
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
          {activeTab === 'LOG' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium">
                   <History size={18} /> Processed Transactions
                </div>
                <div className="flex-1 overflow-auto">
                   {loading ? (
                     <div className="flex justify-center p-12"><TharLoader /></div>
                   ) : history.length === 0 ? (
                     <div className="p-12 text-center text-slate-400">No approval history found.</div>
                   ) : (
                     <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-4">Date</th>
                             <th className="px-6 py-4">Part No</th>
                             <th className="px-6 py-4">Type</th>
                             <th className="px-6 py-4 text-center">Qty</th>
                             <th className="px-6 py-4">Initiator</th>
                             <th className="px-6 py-4 text-right">Status</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {history.map(tx => (
                             <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-slate-500">
                                   {new Date(tx.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900">{tx.partNumber}</td>
                                <td className="px-6 py-4">
                                   <span className={`text-xs px-2 py-1 rounded font-bold ${
                                     tx.type === TransactionType.SALE ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                   }`}>
                                     {tx.type}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-center font-bold">{tx.quantity}</td>
                                <td className="px-6 py-4 text-slate-600 capitalize">
                                   {tx.createdByRole.toLowerCase()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                      tx.status === TransactionStatus.APPROVED 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-red-100 text-red-700'
                                   }`}>
                                      {tx.status === TransactionStatus.APPROVED ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                                      {tx.status}
                                   </span>
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

export default Approvals;