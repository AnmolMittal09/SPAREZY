import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Role } from '../types';
import DailyTransactions from './DailyTransactions'; 
// Added missing Minus, Plus, and Loader2 icons to imports
import { History, PlusCircle, Receipt, User as UserIcon, Undo2, Search, ArrowRight, CheckCircle2, AlertCircle, ShoppingBag, Clock, Calendar, Minus, Plus, Loader2 } from 'lucide-react';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Billing: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'RETURN' | 'HISTORY'>('NEW');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);

  // --- RETURN TAB STATE ---
  const [salesLog, setSalesLog] = useState<Transaction[]>([]);
  const [returnSearch, setReturnSearch] = useState('');
  const [selectedReturns, setSelectedReturns] = useState<Record<string, number>>({}); 
  const [processingReturns, setProcessingReturns] = useState(false);
  const [alreadyReturnedMap, setAlreadyReturnedMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
    }
    if (activeTab === 'RETURN') {
      loadSalesForReturn();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchTransactions(
      TransactionStatus.APPROVED, 
      [TransactionType.SALE, TransactionType.RETURN]
    );
    setHistory(data);
    setLoading(false);
  };

  const loadSalesForReturn = async () => {
    setLoading(true);
    const salesData = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.SALE);
    const returnsData = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.RETURN);

    const returnedMap = new Map<string, number>();
    returnsData.forEach(r => {
        if (r.relatedTransactionId) {
            const current = returnedMap.get(r.relatedTransactionId) || 0;
            returnedMap.set(r.relatedTransactionId, current + r.quantity);
        }
    });
    setAlreadyReturnedMap(returnedMap);

    const availableSales = salesData.filter(sale => {
        const returnedQty = returnedMap.get(sale.id) || 0;
        return sale.quantity > returnedQty;
    });

    setSalesLog(availableSales);
    setLoading(false);
  };

  // --- RETURN LOGIC ---
  const handleReturnToggle = (tx: Transaction) => {
    const newSelection = { ...selectedReturns };
    if (newSelection[tx.id]) {
      delete newSelection[tx.id];
    } else {
      const prevReturned = alreadyReturnedMap.get(tx.id) || 0;
      const remaining = tx.quantity - prevReturned;
      newSelection[tx.id] = remaining > 0 ? remaining : 0;
    }
    setSelectedReturns(newSelection);
  };

  const handleReturnQtyChange = (txId: string, maxQty: number, newQty: string) => {
    let qty = parseInt(newQty);
    if (isNaN(qty)) qty = 0;
    if (qty > maxQty) qty = maxQty;
    if (qty < 0) qty = 0;

    if (qty === 0) {
      const newSelection = { ...selectedReturns };
      delete newSelection[txId];
      setSelectedReturns(newSelection);
    } else {
      setSelectedReturns({ ...selectedReturns, [txId]: qty });
    }
  };

  const submitReturns = async () => {
    const ids = Object.keys(selectedReturns);
    if (ids.length === 0) return;
    if (!confirm(`Process returns for ${ids.length} items?`)) return;

    setProcessingReturns(true);
    const returnPayload = ids.map(id => {
       const originalSale = salesLog.find(s => s.id === id);
       if (!originalSale) return null;
       return {
         partNumber: originalSale.partNumber,
         type: TransactionType.RETURN,
         quantity: selectedReturns[id],
         price: originalSale.price,
         customerName: originalSale.customerName || 'Customer Return',
         createdByRole: user.role,
         relatedTransactionId: originalSale.id
       };
    }).filter(Boolean) as any[];

    const res = await createBulkTransactions(returnPayload);
    setProcessingReturns(false);

    if (res.success) {
       alert("Returns processed successfully.");
       setSelectedReturns({});
       loadSalesForReturn();
    } else {
       alert("Failed to process returns: " + res.message);
    }
  };

  const filteredSalesLog = salesLog.filter(tx => 
     tx.partNumber.toLowerCase().includes(returnSearch.toLowerCase()) ||
     (tx.customerName && tx.customerName.toLowerCase().includes(returnSearch.toLowerCase()))
  );

  const totalRefundAmount = Object.keys(selectedReturns).reduce((acc, id) => {
     const tx = salesLog.find(s => s.id === id);
     return acc + (tx ? (tx.price * selectedReturns[id]) : 0);
  }, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       
       {/* --- MOBILE SEGMENTED CONTROL - HIDDEN WHEN SEARCHING --- */}
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
               <button 
                 onClick={() => setActiveTab('NEW')}
                 className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-brand-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}
               >
                 Point of Sale
               </button>
               <button 
                 onClick={() => setActiveTab('RETURN')}
                 className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'RETURN' ? 'bg-white text-rose-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}
               >
                 Returns
               </button>
               <button 
                 onClick={() => setActiveTab('HISTORY')}
                 className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-800 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}
               >
                 Log
               </button>
            </div>
         </div>
       )}

       {/* --- DESKTOP HEADER --- */}
       <div className="hidden md:flex justify-between items-center mb-6">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Counter Sales</h1>
             <p className="text-slate-500 font-medium">Record retail transactions and customer returns.</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <PlusCircle size={18} /> New Sale
             </button>
             <button onClick={() => setActiveTab('RETURN')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'RETURN' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:bg-rose-50'}`}>
               <Undo2 size={18} /> Process Return
             </button>
             <button onClick={() => setActiveTab('HISTORY')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-rose-50'}`}>
               <History size={18} /> Recent History
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === 'NEW' && (
             <DailyTransactions 
                user={user} 
                forcedMode="SALES" 
                onSearchToggle={setIsSearchingOnMobile} 
             />
          )}

          {activeTab === 'RETURN' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-3xl shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
                   <div className="flex items-center gap-3 text-rose-600 font-black text-base w-full md:w-auto">
                      <div className="p-2 bg-rose-50 rounded-xl"><Undo2 size={20} /></div>
                      SELECT ITEMS TO RETURN
                   </div>
                   <div className="w-full md:w-auto flex-1 md:max-w-xs relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                       <input 
                          type="text" 
                          placeholder="Search Part No. or Customer..."
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold shadow-inner focus:ring-2 focus:ring-rose-500/20"
                          value={returnSearch}
                          onChange={e => setReturnSearch(e.target.value)}
                       />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                   {loading ? (
                      <div className="flex justify-center p-12"><TharLoader /></div>
                   ) : filteredSalesLog.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                         <AlertCircle size={64} className="mb-4 opacity-10" />
                         <p className="font-black text-xs uppercase tracking-widest">No compatible sales found</p>
                      </div>
                   ) : (
                      <div className="pb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredSalesLog.map(tx => {
                            const isSelected = !!selectedReturns[tx.id];
                            const prevReturned = alreadyReturnedMap.get(tx.id) || 0;
                            const remainingQty = tx.quantity - prevReturned;
                            const returnQty = selectedReturns[tx.id] || remainingQty;
                            
                            return (
                                <div 
                                    key={tx.id} 
                                    onClick={() => handleReturnToggle(tx)}
                                    className={`p-5 rounded-[2rem] border transition-all cursor-pointer bg-white ${isSelected ? 'border-rose-500 ring-2 ring-rose-500/10 shadow-lg' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-rose-500 border-rose-500 text-white' : 'bg-slate-50 border-slate-200 text-transparent'}`}>
                                            <CheckCircle2 size={14} />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Sold On</div>
                                            <div className="text-[11px] font-bold text-slate-900">{new Date(tx.createdAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <div className="font-black text-lg text-slate-900 leading-tight">{tx.partNumber}</div>
                                        <div className="text-[13px] text-slate-400 font-medium flex items-center gap-1.5 mt-1">
                                            <UserIcon size={14} className="text-slate-300" /> {tx.customerName || 'Walk-in Customer'}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Original Sale</div>
                                            <div className="font-black text-slate-900">{tx.quantity} <span className="text-[10px] text-slate-400">units</span></div>
                                            <div className="text-[9px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md inline-block">Rem: {remainingQty}</div>
                                        </div>

                                        {isSelected && (
                                            <div onClick={e => e.stopPropagation()} className="bg-rose-50 p-2 rounded-2xl border border-rose-100 flex flex-col items-center">
                                                <span className="text-[9px] font-black text-rose-500 uppercase mb-1">Return Qty</span>
                                                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl shadow-sm">
                                                    <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (returnQty - 1).toString())} className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500"><Minus size={14}/></button>
                                                    <span className="font-black text-slate-900 min-w-[20px] text-center">{returnQty}</span>
                                                    <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (returnQty + 1).toString())} className="w-8 h-8 bg-rose-500 text-white rounded-lg flex items-center justify-center"><Plus size={14}/></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                      </div>
                   )}
                </div>

                {/* Return Fixed Footer */}
                <div className="fixed bottom-0 md:bottom-6 left-0 md:left-auto right-0 md:right-8 bg-white md:rounded-3xl border-t md:border border-slate-100 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:shadow-2xl z-[90] pb-safe flex justify-between items-center md:min-w-[400px]">
                   <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Refund Total ({Object.keys(selectedReturns).length})</p>
                      <p className="text-2xl font-black text-rose-600 tracking-tight">₹{totalRefundAmount.toLocaleString()}</p>
                   </div>

                   <button 
                      onClick={submitReturns}
                      disabled={Object.keys(selectedReturns).length === 0 || processingReturns}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-rose-200 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-30 disabled:shadow-none"
                   >
                      {processingReturns ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                      Process
                   </button>
                </div>
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-3xl shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-white flex items-center gap-3">
                   <div className="p-2 bg-slate-900 text-white rounded-xl"><History size={18} /></div>
                   <span className="font-black text-slate-900 text-base uppercase tracking-tight">Approved Ledger</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-24">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                        <AlertCircle size={64} className="mb-4 opacity-10" />
                        <p className="font-black text-xs uppercase tracking-widest">No history yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {history.map(tx => {
                          const isReturn = tx.type === TransactionType.RETURN;
                          return (
                            <div key={tx.id} className={`p-5 rounded-[2rem] bg-white border border-slate-50 shadow-sm flex flex-col animate-fade-in relative overflow-hidden group`}>
                                {isReturn && <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rotate-45 translate-x-8 -translate-y-8"></div>}
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1">
                                        <div className="font-black text-slate-900 text-lg leading-tight group-hover:text-brand-600 transition-colors">{tx.partNumber}</div>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold">
                                            <Calendar size={12} /> {new Date(tx.createdAt).toLocaleDateString()}
                                            <span className="text-slate-200">|</span>
                                            <Clock size={12} /> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isReturn ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                        {tx.type}
                                    </div>
                                </div>

                                <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-50 flex items-center gap-3 mb-5">
                                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100">
                                        <UserIcon size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Billed To</p>
                                        <p className="text-[13px] font-bold text-slate-800 truncate">{tx.customerName || 'Walk-in Customer'}</p>
                                    </div>
                                </div>

                                <div className="mt-auto flex justify-between items-center">
                                    <div className="bg-slate-100 px-3 py-1.5 rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                        QTY: {tx.quantity}
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-xl font-black tracking-tight ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>
                                            {isReturn ? '-' : ''}₹{(tx.price * tx.quantity).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                          );
                      })}
                    </div>
                  )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default Billing;