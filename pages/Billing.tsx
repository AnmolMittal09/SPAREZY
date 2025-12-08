
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
  const [selectedReturns, setSelectedReturns] = useState<Record<string, number>>({}); // Map<TransactionId, ReturnQty>
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
    // Fetch Approved Sales AND Returns for general log
    const data = await fetchTransactions(
      TransactionStatus.APPROVED, 
      [TransactionType.SALE, TransactionType.RETURN]
    );
    setHistory(data);
    setLoading(false);
  };

  const loadSalesForReturn = async () => {
    setLoading(true);
    
    // 1. Fetch Approved Sales
    const salesData = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.SALE);
    
    // 2. Fetch Approved Returns to see what's already been refunded
    const returnsData = await fetchTransactions(TransactionStatus.APPROVED, TransactionType.RETURN);

    // 3. Map SaleID -> TotalQuantityReturned
    const returnedMap = new Map<string, number>();
    returnsData.forEach(r => {
        if (r.relatedTransactionId) {
            const current = returnedMap.get(r.relatedTransactionId) || 0;
            returnedMap.set(r.relatedTransactionId, current + r.quantity);
        }
    });
    setAlreadyReturnedMap(returnedMap);

    // 4. Filter out sales that are FULLY returned
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
      // Default to MAX remaining quantity
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

    if (!confirm(`Process returns for ${ids.length} items? This will restore stock and record a refund.`)) return;

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
       loadSalesForReturn(); // Refresh list to remove fully returned items
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
    <div className="space-y-4 h-full flex flex-col">
       <div className="flex justify-between items-center">
          <div>
             <h1 className="text-2xl font-bold text-slate-900">Billing (Sales)</h1>
             <p className="text-slate-500">Record cash sales, estimates, and customer returns.</p>
          </div>
          <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
             <button 
               onClick={() => setActiveTab('NEW')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <PlusCircle size={16} /> New Sale
             </button>
             <button 
               onClick={() => setActiveTab('RETURN')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'RETURN' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-red-50 hover:text-red-700'}`}
             >
               <Undo2 size={16} /> Returns
             </button>
             <button 
               onClick={() => setActiveTab('HISTORY')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <History size={16} /> History
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden">
          {activeTab === 'NEW' && (
             <DailyTransactions user={user} forcedMode="SALES" />
          )}

          {activeTab === 'RETURN' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                {/* Return Header / Toolbar */}
                <div className="p-4 border-b border-slate-200 bg-red-50 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div className="flex items-center gap-2 text-red-800 font-bold">
                      <Undo2 size={20} /> Process Customer Returns
                   </div>
                   
                   <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-red-300" size={16} />
                         <input 
                            type="text" 
                            placeholder="Find sale by Customer or Part..."
                            className="w-full pl-9 pr-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                            value={returnSearch}
                            onChange={e => setReturnSearch(e.target.value)}
                         />
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-auto">
                   {loading ? (
                      <div className="flex justify-center p-12"><TharLoader /></div>
                   ) : filteredSalesLog.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                         <AlertCircle size={48} className="mb-4 opacity-20" />
                         <p>No compatible sales found.</p>
                         <p className="text-xs text-slate-300 mt-2">Only approved and fully paid sales appear here.</p>
                      </div>
                   ) : (
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
                   )}
                </div>

                {/* Return Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shadow-lg z-20">
                   <div className="flex items-center gap-4">
                      <div className="text-slate-500 text-sm">
                         Selected <span className="font-bold text-slate-900">{Object.keys(selectedReturns).length}</span> transactions
                      </div>
                      <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                      <div className="text-slate-500 text-sm hidden md:block">
                         Total Refund: <span className="font-bold text-red-600 text-lg ml-1">₹{totalRefundAmount.toLocaleString()}</span>
                      </div>
                   </div>

                   <button 
                      onClick={submitReturns}
                      disabled={Object.keys(selectedReturns).length === 0 || processingReturns}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-md shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                   >
                      {processingReturns ? <ArrowRight className="animate-spin" /> : <CheckCircle2 />}
                      Confirm Returns
                   </button>
                </div>
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-slate-600 font-medium">
                   <Receipt size={18} /> Sales & Returns Log
                </div>
                
                <div className="flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : history.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No history found.</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-4">Date</th>
                             <th className="px-6 py-4">Type</th>
                             <th className="px-6 py-4">Part No</th>
                             <th className="px-6 py-4">Customer</th>
                             <th className="px-6 py-4 text-center">Qty</th>
                             <th className="px-6 py-4 text-right">Unit Price</th>
                             <th className="px-6 py-4 text-right">Total</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {history.map(tx => {
                             const isReturn = tx.type === TransactionType.RETURN;
                             return (
                               <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${isReturn ? 'bg-red-50/30' : ''}`}>
                                  <td className="px-6 py-4 text-slate-500">
                                     {new Date(tx.createdAt).toLocaleDateString()}
                                     <div className="text-xs text-slate-400">{new Date(tx.createdAt).toLocaleTimeString()}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                     <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${isReturn ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {tx.type}
                                     </span>
                                  </td>
                                  <td className="px-6 py-4 font-bold text-slate-900">{tx.partNumber}</td>
                                  <td className="px-6 py-4 text-slate-600">
                                     <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                                          <UserIcon size={12}/>
                                        </div>
                                        {tx.customerName || 'Walk-in'}
                                     </div>
                                  </td>
                                  <td className="px-6 py-4 text-center font-bold">{tx.quantity}</td>
                                  <td className="px-6 py-4 text-right">₹{tx.price.toLocaleString()}</td>
                                  <td className={`px-6 py-4 text-right font-bold ${isReturn ? 'text-red-600' : 'text-slate-900'}`}>
                                     {isReturn ? '-' : ''}₹{(tx.price * tx.quantity).toLocaleString()}
                                  </td>
                               </tr>
                             );
                          })}
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

export default Billing;
