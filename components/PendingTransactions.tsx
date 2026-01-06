
import React, { useEffect, useState, useMemo } from 'react';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { fetchTransactions, approveTransaction, rejectTransaction } from '../services/transactionService';
import { CheckCircle2, XCircle, Clock, User as UserIcon, Package, IndianRupee, ArrowRight, Check, X, Loader2 } from 'lucide-react';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  type: TransactionType;
}

const PendingTransactions: React.FC<Props> = ({ type }) => {
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
    if (!confirm(`Authorize ${tx.quantity} units of ${tx.partNumber} for ${tx.customerName || 'Client'}?`)) return;
    setProcessingId(tx.id);
    try {
      await approveTransaction(tx.id, tx.partNumber, type, tx.quantity);
      await loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Reject this part request?")) return;
    setProcessingId(id);
    try {
      await rejectTransaction(id);
      await loadData();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, { items: Transaction[], totalValue: number }> = {};
    items.forEach(item => {
      const name = (item.customerName || 'Standard Client').toUpperCase().trim();
      if (!groups[name]) groups[name] = { items: [], totalValue: 0 };
      groups[name].items.push(item);
      groups[name].totalValue += (item.price * item.quantity);
    });
    return Object.entries(groups).sort((a, b) => b[1].items.length - a[1].items.length);
  }, [items]);

  if (loading) return (
    <div className="py-24 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={32} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Scanning Pending Queue</p>
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-[2.5rem] border-2 border-slate-100 border-dashed animate-fade-in">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
           <CheckCircle2 size={32} className="text-slate-200" />
        </div>
        <h3 className="text-slate-900 font-black text-sm uppercase tracking-widest mb-1">Queue Cleared</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">No pending approvals for {type}s</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between px-2">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Pending Authorization Ledger</span>
         </div>
         <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200/50">
            {fd(items.length)} Parts Awaiting
         </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {groupedItems.map(([customerName, group]) => (
          <div key={customerName} className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-soft overflow-hidden group/card hover:border-blue-200 transition-all">
            <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                     <UserIcon size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                     <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none mb-1.5">{customerName}</h3>
                     <div className="flex items-center gap-3 text-slate-400">
                        <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                           <Package size={10} /> {fd(group.items.length)} Parts
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• Total Value: ₹{group.totalValue.toLocaleString()}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="divide-y divide-slate-50">
               {group.items.map((tx) => (
                 <div key={tx.id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/30 transition-colors group/item">
                    <div className="flex-1 flex gap-6 items-center">
                       <div className="p-3 bg-white border border-slate-100 rounded-xl text-slate-300 shadow-inner-soft group-hover/item:text-blue-500 group-hover/item:border-blue-100 transition-all">
                          <ArrowRight size={18} />
                       </div>
                       <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-1">
                             <h4 className="font-black text-slate-900 text-[17px] tracking-tight uppercase truncate">{tx.partNumber}</h4>
                             <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty:</span>
                                <span className="text-sm font-black text-slate-800">{fd(tx.quantity)}</span>
                             </div>
                             <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                             <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rate:</span>
                                <span className="text-sm font-black text-slate-800">₹{tx.price.toLocaleString()}</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t md:border-none border-slate-100">
                       <div className="md:hidden">
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-0.5">Line Total</span>
                          <span className="font-black text-slate-900">₹{(tx.price * tx.quantity).toLocaleString()}</span>
                       </div>
                       <div className="flex gap-2.5">
                          <button 
                             onClick={() => handleReject(tx.id)}
                             disabled={processingId === tx.id}
                             className="p-3.5 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-2xl transition-all active:scale-90 disabled:opacity-30 shadow-sm"
                             title="Reject Entry"
                          >
                             <X size={20} strokeWidth={3} />
                          </button>
                          <button 
                             onClick={() => handleApprove(tx)}
                             disabled={processingId === tx.id}
                             className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-30"
                          >
                             {processingId === tx.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={4} />}
                             Authorize
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
            
            <div className="p-4 bg-slate-50/50 border-t border-slate-50 text-center">
               <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Batch Terminal Block</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingTransactions;
