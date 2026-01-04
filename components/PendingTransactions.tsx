import React, { useEffect, useState } from 'react';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { fetchTransactions, approveTransaction, rejectTransaction } from '../services/transactionService';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

interface Props {
  type: TransactionType;
  onProcessed?: () => void;
}

const PendingTransactions: React.FC<Props> = ({ type, onProcessed }) => {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchTransactions(TransactionStatus.PENDING, type);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [type]);

  const handleApprove = async (tx: Transaction) => {
    if (!confirm(`Approve ${type} of ${tx.quantity} units for ${tx.partNumber}?`)) return;
    setProcessingId(tx.id);
    try {
      await approveTransaction(tx.id, tx.partNumber, type, tx.quantity);
      if (onProcessed) onProcessed();
      else await loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject this transaction?")) return;
    setProcessingId(id);
    try {
      await rejectTransaction(id);
      if (onProcessed) onProcessed();
      else await loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading pending requests...</div>;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
        <CheckCircle2 size={48} className="mb-4 text-green-100" />
        <p>No pending approvals found.</p>
        <p className="text-sm">All manager requests have been processed.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2 text-yellow-800 text-sm">
         <Clock size={16} />
         <span className="font-bold">{items.length} Pending Transactions</span>
         <span className="opacity-75">- Requires Admin Approval</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Requester</th>
              <th className="px-6 py-4">Part No</th>
              <th className="px-6 py-4 text-center">Qty</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(tx => (
              <tr key={tx.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-slate-500">
                   {new Date(tx.createdAt).toLocaleDateString()}
                   <div className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">Manager ({tx.createdByRole})</td>
                <td className="px-6 py-4 font-bold text-slate-900">{tx.partNumber}</td>
                <td className="px-6 py-4 text-center">{tx.quantity}</td>
                <td className="px-6 py-4 text-right">₹{(tx.quantity * tx.price).toLocaleString()}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                     <button 
                        onClick={() => handleApprove(tx)}
                        disabled={processingId === tx.id}
                        className="p-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 disabled:opacity-50 transition-colors"
                        title="Approve"
                     >
                        {processingId === tx.id ? <Clock size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                     </button>
                     <button 
                        onClick={() => handleReject(tx.id)}
                        disabled={processingId === tx.id}
                        className="p-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-200 disabled:opacity-50 transition-colors"
                        title="Reject"
                     >
                        <XCircle size={16} />
                     </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingTransactions;
