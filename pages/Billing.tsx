
import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Role } from '../types';
import DailyTransactions from './DailyTransactions'; 
import { History, PlusCircle, Receipt, User as UserIcon, Undo2, Search, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';

interface Props {
  user: User;
}

const Billing: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'RETURN' | 'HISTORY'>('NEW');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

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
       
       {/* --- MOBILE COMPACT HEADER (POS STYLE) --- */}
       <div className="md:hidden bg-white px-4 pt-4 pb-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] z-20 sticky top-0 border-b border-slate-100">
          <div className="flex justify-between items-end mb-3">
             <div>
                <h1 className="text-xl font-extrabold text-slate-900 leading-none tracking-tight">Billing</h1>
                <p className="text-xs text-slate-500 font-medium mt-1">Record sales & returns</p>
             </div>
          </div>
          
          {/* Compact Segmented Control */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('NEW')}
               className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'NEW' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
             >
               New Sale
             </button>
             <button 
               onClick={() => setActiveTab('RETURN')}
               className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'RETURN' ? 'bg-white text-red-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Return
             </button>
             <button 
               onClick={() => setActiveTab('HISTORY')}
               className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
             >
               History
             </button>
          </div>
       </div>

       {/* --- DESKTOP HEADER (Hidden on Mobile) --- */}
       <div className="hidden md:flex justify-between items-center mb-4">
          <div>
             <h1 className="text-2xl font-bold text-slate-900">Billing (Sales)</h1>
             <p className="text-slate-500">Record cash sales, estimates, and customer returns.</p>
          </div>
          <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
             <button onClick={() => setActiveTab('NEW')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>
               <PlusCircle size={16} /> New Sale
             </button>
             <button onClick={() => setActiveTab('RETURN')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'RETURN' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-red-50 hover:text-red-700'}`}>
               <Undo2 size={16} /> Returns
             </button>
             <button onClick={() => setActiveTab('HISTORY')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>
               <History size={16} /> History
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === 'NEW' && (
             <DailyTransactions user={user} forcedMode="SALES" />
          )}

          {activeTab === 'RETURN' && (
             <div className="bg-white md:rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                {/* Mobile Specific Header spacing */}
                <div className="md:p-4 p-3 border-b border-slate-200 bg-red-50 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
                   <div className="flex items-center gap-2 text-red-800 font-bold text-sm md:text-base w-full md:w-auto">
                      <Undo2 size={18} /> Process Returns
                   </div>
                   <div className="w-full md:w-auto flex-1 md:max-w-xs relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-red-300" size={16} />
                       <input 
                          type="text" 
                          placeholder="Search sale..."
                          className="w-full pl-9 pr-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                          value={returnSearch}
                          onChange={e => setReturnSearch(e.target.value)}
                       />
                   </div>
                </div>

                <div className="flex-1 overflow-auto">
                   {loading ? (
                      <div className="flex justify-center p-12"><TharLoader /></div>
                   ) : filteredSalesLog.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                         <AlertCircle size={48} className="mb-4 opacity-20" />
                         <p>No compatible sales found.</p>
                      </div>
                   ) : (
                      <>
                        {/* Mobile View for Returns */}
                        <div className="block md:hidden divide-y divide-slate-100 pb-20">
                            {filteredSalesLog.map(tx => {
                                const isSelected = !!selectedReturns[tx.id];
                                const prevReturned = alreadyReturnedMap.get(tx.id) || 0;
                                const remainingQty = tx.quantity - prevReturned;
                                const returnQty = selectedReturns[tx.id] || remainingQty;
                                
                                return (
                                    <div key={tx.id} className={`p-4 flex gap-3 ${isSelected ? 'bg-red-50' : 'bg-white'}`}>
                                        <div className="pt-1">
                                            <input 
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleReturnToggle(tx)}
                                            className="w-5 h-5 text-red-600 rounded border-slate-300"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <span className="font-bold text-slate-900">{tx.partNumber}</span>
                                                <span className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="text-sm text-slate-600">{tx.customerName || 'Walk-in'}</div>
                                            <div className="mt-2 flex justify-between items-end">
                                                <div className="text-xs">
                                                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold mr-2">Sold: {tx.quantity}</span>
                                                    <span className="text-slate-400">Rem: {remainingQty}</span>
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-400">Ret Qty:</span>
                                                        <input 
                                                            type="number"
                                                            min="1"
                                                            max={remainingQty}
                                                            value={returnQty}
                                                            onChange={(e) => handleReturnQtyChange(tx.id, remainingQty, e.target.value)}
                                                            className="w-12 p-1 border border-red-300 rounded text-center font-bold text-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Desktop Table Hidden on Mobile */}
                        <div className="hidden md:block">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-slate-600 font-medium sticky top-0 shadow-sm z-10">
                                    <tr>
                                    <th className="px-6 py-4 w-16 text-center">Select</th>
                                    <th className="px-6 py-4">Sale Date</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Part Details</th>
                                    <th className="px-6 py-4 text-center">Sold (Rem)</th>
                                    <th className="px-6 py-4 text-center w-32">Return Qty</th>
                                    <th className="px-6 py-4 text-right">Refund Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSalesLog.map(tx => {
                                    const isSelected = !!selectedReturns[tx.id];
                                    const prevReturned = alreadyReturnedMap.get(tx.id) || 0;
                                    const remainingQty = tx.quantity - prevReturned;
                                    const returnQty = selectedReturns[tx.id] || remainingQty;
                                    
                                    return (
                                        <tr key={tx.id} className={`hover:bg-red-50 transition-colors ${isSelected ? 'bg-red-50/50' : ''}`}>
                                            <td className="px-6 py-4 text-center">
                                                <input 
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleReturnToggle(tx)}
                                                className="w-5 h-5 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {new Date(tx.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-700">
                                                {tx.customerName || 'Walk-in'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{tx.partNumber}</div>
                                                <div className="text-xs text-slate-500">Price: ₹{tx.price}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-bold text-slate-800">{tx.quantity}</span>
                                                {prevReturned > 0 && (
                                                    <div className="text-[10px] text-red-500 font-bold">Ret: {prevReturned}</div>
                                                )}
                                                <div className="text-[10px] text-green-600 font-bold bg-green-50 rounded px-1 mt-1">
                                                    Rem: {remainingQty}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isSelected ? (
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    max={remainingQty}
                                                    value={returnQty}
                                                    onChange={(e) => handleReturnQtyChange(tx.id, remainingQty, e.target.value)}
                                                    className="w-20 px-2 py-1 border border-red-300 rounded text-center font-bold text-red-700 outline-none focus:ring-2 focus:ring-red-500"
                                                />
                                                ) : (
                                                <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-red-600">
                                                {isSelected ? `₹${(tx.price * returnQty).toLocaleString()}` : '-'}
                                            </td>
                                        </tr>
                                    );
                                    })}
                                </tbody>
                            </table>
                        </div>
                      </>
                   )}
                </div>

                {/* Return Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shadow-lg z-20 pb-safe-bottom">
                   <div className="flex items-center gap-4">
                      <div className="text-slate-500 text-sm">
                         Selected <span className="font-bold text-slate-900">{Object.keys(selectedReturns).length}</span>
                      </div>
                      <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                      <div className="text-slate-500 text-sm hidden md:block">
                         Total: <span className="font-bold text-red-600 text-lg ml-1">₹{totalRefundAmount.toLocaleString()}</span>
                      </div>
                   </div>

                   <button 
                      onClick={submitReturns}
                      disabled={Object.keys(selectedReturns).length === 0 || processingReturns}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-md shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                   >
                      {processingReturns ? <ArrowRight className="animate-spin" /> : <CheckCircle2 />}
                      Confirm
                   </button>
                </div>
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white md:rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium text-sm">
                   <Receipt size={18} /> Sales & Returns Log
                </div>
                
                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No history found.</div>
                  ) : (
                    <>
                    {/* Mobile Card List for History */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {history.map(tx => {
                          const isReturn = tx.type === TransactionType.RETURN;
                          return (
                            <div key={tx.id} className={`p-4 ${isReturn ? 'bg-red-50/20' : 'bg-white'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-bold text-slate-900 text-base">{tx.partNumber}</div>
                                        <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-black text-base ${isReturn ? 'text-red-600' : 'text-slate-900'}`}>
                                            {isReturn ? '-' : ''}₹{(tx.price * tx.quantity).toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{tx.type}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div className="text-slate-600 flex items-center gap-1">
                                        <UserIcon size={12}/> {tx.customerName || 'Walk-in'}
                                    </div>
                                    <div className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-600">
                                        Qty: {tx.quantity}
                                    </div>
                                </div>
                            </div>
                          );
                      })}
                    </div>
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-sm text-left">
                       <thead className="bg-white text-slate-600 font-medium sticky top-0 border-b border-slate-200 shadow-sm">
                          <tr>
                             <th className="px-4 md:px-6 py-4">Date</th>
                             <th className="px-4 md:px-6 py-4">Type</th>
                             <th className="px-4 md:px-6 py-4">Part No</th>
                             <th className="hidden md:table-cell px-6 py-4">Customer</th>
                             <th className="px-4 md:px-6 py-4 text-center">Qty</th>
                             <th className="hidden md:table-cell px-6 py-4 text-right">Unit Price</th>
                             <th className="px-4 md:px-6 py-4 text-right">Total</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {history.map(tx => {
                             const isReturn = tx.type === TransactionType.RETURN;
                             return (
                               <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${isReturn ? 'bg-red-50/30' : ''}`}>
                                  <td className="px-4 md:px-6 py-4 text-slate-500 text-xs md:text-sm">
                                     {new Date(tx.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 md:px-6 py-4">
                                     <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${isReturn ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {tx.type}
                                     </span>
                                  </td>
                                  <td className="px-4 md:px-6 py-4 font-bold text-slate-900 text-xs md:text-sm">{tx.partNumber}</td>
                                  <td className="hidden md:table-cell px-6 py-4 text-slate-600">
                                     <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                                          <UserIcon size={12}/>
                                        </div>
                                        {tx.customerName || 'Walk-in'}
                                     </div>
                                  </td>
                                  <td className="px-4 md:px-6 py-4 text-center font-bold text-xs md:text-sm">{tx.quantity}</td>
                                  <td className="hidden md:table-cell px-6 py-4 text-right">₹{tx.price.toLocaleString()}</td>
                                  <td className={`px-4 md:px-6 py-4 text-right font-bold text-xs md:text-sm ${isReturn ? 'text-red-600' : 'text-slate-900'}`}>
                                     {isReturn ? '-' : ''}₹{(tx.price * tx.quantity).toLocaleString()}
                                  </td>
                               </tr>
                             );
                          })}
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

export default Billing;
