import React, { useEffect, useState } from 'react';
import { User, Transaction, TransactionType } from '../types';
import { fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';
import { ArrowRightLeft, RefreshCw } from 'lucide-react';

const formatQty = (n: number) => {
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const str = abs < 10 ? `0${abs}` : `${abs}`;
  return isNeg ? `-${str}` : str;
};

interface Props {
  user: User;
}

const StockMovements: React.FC<Props> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !refreshing) return <TharLoader />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="text-blue-600" /> Stock Movements
          </h1>
          <p className="text-slate-500">Audit trail of all inventory changes.</p>
        </div>
        <button 
           onClick={() => loadData(true)}
           disabled={refreshing}
           className={`p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-brand-600 transition-all active:scale-95 shadow-sm ${refreshing ? 'opacity-50' : ''}`}
        >
           <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
           <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                 <th className="px-6 py-4">Date</th>
                 <th className="px-6 py-4">Part Number</th>
                 <th className="px-6 py-4">Type</th>
                 <th className="px-6 py-4 text-center">Qty Change</th>
                 <th className="px-6 py-4">Reference</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                   <td className="px-6 py-4 text-slate-500">
                      {new Date(tx.createdAt).toLocaleString()}
                   </td>
                   <td className="px-6 py-4 font-bold text-slate-900">{tx.partNumber}</td>
                   <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded font-bold ${
                         tx.type === TransactionType.SALE ? 'bg-green-100 text-green-700' :
                         tx.type === TransactionType.PURCHASE ? 'bg-blue-100 text-blue-700' :
                         'bg-gray-100 text-gray-700'
                      }`}>
                         {tx.type}
                      </span>
                   </td>
                   <td className="px-6 py-4 text-center font-mono">
                      {tx.type === TransactionType.SALE ? '-' : '+'}{formatQty(tx.quantity)}
                   </td>
                   <td className="px-6 py-4 text-slate-500">{tx.customerName || 'N/A'}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                 <tr><td colSpan={5} className="p-8 text-center text-slate-400">No movements recorded.</td></tr>
              )}
           </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockMovements;