
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Role } from '../types';
import DailyTransactions from './DailyTransactions'; 
import { 
  History, 
  PlusCircle, 
  User as UserIcon, 
  Undo2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Minus, 
  Plus, 
  Loader2,
  Filter,
  ArrowUpDown,
  ChevronDown,
  X,
  TrendingDown,
  TrendingUp,
  Banknote,
  Layers,
  List,
  ChevronRight,
  Package,
  ArrowLeft,
  Users,
  CheckCircle,
  AlertTriangle,
  Wallet,
  FileDown,
  RotateCcw,
  Download
} from 'lucide-react';
import { createBulkTransactions, fetchTransactions, updateTransactionPayment } from '../services/transactionService';
import TharLoader from '../components/TharLoader';
import ConfirmModal from '../components/ConfirmModal';
import * as XLSX from 'xlsx';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  user: User;
}

type SortField = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'LIST' | 'STACKED' | 'CUSTOMER';

interface GroupedBill {
  id: string; 
  createdAt: string;
  customerName: string;
  type: TransactionType;
  items: Transaction[];
  totalAmount: number;
  totalPaid: number;
}

interface CustomerGroup {
  name: string;
  totalSpent: number;
  totalPaid: number;
  totalItems: number;
  lastPurchase: string;
  transactions: Transaction[];
}

const Billing: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'RETURN' | 'HISTORY'>('NEW');
  const [viewMode, setViewMode] = useState<ViewMode>('STACKED');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [selectedBill, setSelectedBill] = useState<GroupedBill | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerGroup | null>(null);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  
  // Payment tracking for modal
  const [isAddingPayment, setIsAddingPayment] = useState<string | null>(null);
  const [newPaidVal, setNewPaidVal] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // --- HISTORY FILTERS & SORTING STATE ---
  const [historySearch, setHistorySearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType.SALE | TransactionType.RETURN>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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

  const handleRegisterPayment = async (txId: string) => {
      const val = parseFloat(newPaidVal);
      if (isNaN(val)) return;
      
      setSubmittingPayment(true);
      const res = await updateTransactionPayment(txId, val);
      if (res.success) {
          setIsAddingPayment(null);
          setNewPaidVal('');
          loadHistory(); 
          if (selectedBill) {
              const updatedItems = selectedBill.items.map(i => i.id === txId ? {...i, paidAmount: val} : i);
              setSelectedBill({
                  ...selectedBill,
                  items: updatedItems,
                  totalPaid: updatedItems.reduce((s, i) => s + i.paidAmount, 0)
              });
          }
      } else alert("Error updating payment: " + res.message);
      setSubmittingPayment(false);
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

  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (historySearch) {
      const s = historySearch.toLowerCase();
      result = result.filter(tx => 
        tx.partNumber.toLowerCase().includes(s) || 
        tx.customerName.toLowerCase().includes(s)
      );
    }

    if (typeFilter !== 'ALL') {
      result = result.filter(tx => tx.type === typeFilter);
    }

    if (dateRange !== 'ALL') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      result = result.filter(tx => {
        const txTime = new Date(tx.createdAt).getTime();
        if (dateRange === 'TODAY') return txTime >= startOfToday;
        if (dateRange === 'WEEK') return txTime >= (now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (dateRange === 'MONTH') return txTime >= (now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return true;
      });
    }

    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    if (!isNaN(min)) result = result.filter(tx => (tx.price * tx.quantity) >= min);
    if (!isNaN(max)) result = result.filter(tx => (tx.price * tx.quantity) <= max);

    return result;
  }, [history, historySearch, typeFilter, dateRange, minAmount, maxAmount]);

  const stackedHistory = useMemo(() => {
    const groups: Record<string, GroupedBill> = {};
    
    filteredHistory.forEach(tx => {
      const key = `${tx.createdAt}_${tx.customerName}_${tx.type}`;
      if (!groups[key]) {
        groups[key] = {
          id: tx.id,
          createdAt: tx.createdAt,
          customerName: tx.customerName,
          type: tx.type,
          items: [],
          totalAmount: 0,
          totalPaid: 0
        };
      }
      groups[key].items.push(tx);
      groups[key].totalAmount += (tx.price * tx.quantity);
      groups[key].totalPaid += (tx.paidAmount || 0);
    });

    const result = Object.values(groups);

    result.sort((a, b) => {
      let valA = sortBy === 'date' ? new Date(a.createdAt).getTime() : a.totalAmount;
      let valB = sortBy === 'date' ? new Date(b.createdAt).getTime() : b.totalAmount;
      
      if (sortOrder === 'asc') return valA - valB;
      return valB - valA;
    });

    return result;
  }, [filteredHistory, sortBy, sortOrder]);

  const customerHistory = useMemo(() => {
    const groups: Record<string, CustomerGroup> = {};
    
    filteredHistory.forEach(tx => {
      const custName = tx.customerName || 'Anonymous';
      if (!groups[custName]) {
        groups[custName] = {
          name: custName,
          totalSpent: 0,
          totalPaid: 0,
          totalItems: 0,
          lastPurchase: tx.createdAt,
          transactions: []
        };
      }
      const g = groups[custName];
      const val = tx.price * tx.quantity;
      g.transactions.push(tx);
      g.totalSpent += tx.type === TransactionType.RETURN ? -val : val;
      g.totalPaid += tx.type === TransactionType.RETURN ? -(tx.paidAmount || 0) : (tx.paidAmount || 0);
      g.totalItems += tx.type === TransactionType.RETURN ? -tx.quantity : tx.quantity;
      if (new Date(tx.createdAt) > new Date(g.lastPurchase)) {
        g.lastPurchase = tx.createdAt;
      }
    });

    const result = Object.values(groups);
    result.sort((a, b) => sortOrder === 'desc' ? b.totalSpent - a.totalSpent : a.totalSpent - b.totalSpent);
    return result;
  }, [filteredHistory, sortOrder]);

  const sortedListHistory = useMemo(() => {
    const result = [...filteredHistory];
    result.sort((a, b) => {
      let valA = sortBy === 'date' ? new Date(a.createdAt).getTime() : (a.price * a.quantity);
      let valB = sortBy === 'date' ? new Date(b.createdAt).getTime() : (b.price * b.quantity);
      if (sortOrder === 'asc') return valA - valB;
      return valB - valA;
    });
    return result;
  }, [filteredHistory, sortBy, sortOrder]);

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

  const handleExportPendingPayments = () => {
    const pending = history.filter(tx => tx.type === TransactionType.SALE && (tx.paidAmount || 0) < (tx.price * tx.quantity));
    
    const dataToExport = pending.map(tx => {
      const total = tx.price * tx.quantity;
      const paid = tx.paidAmount || 0;
      return {
        'Date': new Date(tx.createdAt).toLocaleDateString(),
        'Time': new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Customer Name': tx.customerName || 'Walk-in',
        'Part Number': tx.partNumber,
        'Quantity': tx.quantity,
        'Billed Amount': total,
        'Amount Received': paid,
        'Balance Owed': total - paid
      };
    });

    if (dataToExport.length === 0) return alert("No pending payments found in the ledger.");

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pending_Collections");
    XLSX.writeFile(wb, `Sparezy_Pending_Payments_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCustomerLedger = (customer: CustomerGroup) => {
    const dataToExport = customer.transactions.map(tx => {
      const amount = tx.price * tx.quantity;
      const paid = tx.paidAmount || 0;
      return {
        'Date': new Date(tx.createdAt).toLocaleDateString(),
        'Time': new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Part Number': tx.partNumber,
        'Type': tx.type,
        'Quantity': tx.type === TransactionType.RETURN ? -tx.quantity : tx.quantity,
        'Total Billed': tx.type === TransactionType.RETURN ? -amount : amount,
        'Total Paid': tx.type === TransactionType.RETURN ? -paid : paid,
        'Outstanding': (tx.type === TransactionType.RETURN ? -amount : amount) - (tx.type === TransactionType.RETURN ? -paid : paid)
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer_Ledger");
    XLSX.writeFile(wb, `Sparezy_Ledger_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const submitReturns = async () => {
    const ids = Object.keys(selectedReturns);
    if (ids.length === 0) return;

    setProcessingReturns(true);
    const returnPayload = ids.map(id => {
       const originalSale = salesLog.find(s => s.id === id);
       if (!originalSale) return null;
       return {
         partNumber: originalSale.partNumber,
         type: TransactionType.RETURN,
         quantity: selectedReturns[id],
         price: originalSale.price,
         paidAmount: originalSale.price * selectedReturns[id], 
         customerName: originalSale.customerName || 'Customer Return',
         createdByRole: user.role,
         relatedTransactionId: originalSale.id
       };
    }).filter(Boolean) as any[];

    const res = await createBulkTransactions(returnPayload);
    setProcessingReturns(false);
    setShowReturnConfirm(false);

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

  const clearFilters = () => {
    setHistorySearch('');
    setTypeFilter('ALL');
    setDateRange('ALL');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date');
    setSortOrder('desc');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
               <button 
                 onClick={() => setActiveTab('NEW')}
                 className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-brand-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}
               >
                 POS
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
                 History
               </button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-6">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Counter Sales</h1>
             <p className="text-slate-500 font-medium">Record retail transactions and customer returns.</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <PlusCircle size={18} /> New Sale
             </button>
             <button onClick={() => setActiveTab('RETURN')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'RETURN' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
               <Undo2 size={18} /> Process Return
             </button>
             <button onClick={() => setActiveTab('HISTORY')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
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
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-rose-50 border-rose-50 text-white' : 'bg-slate-50 border-slate-200 text-transparent'}`}>
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
                                            <div className="font-black text-slate-900">{fd(tx.quantity)} <span className="text-[10px] text-slate-400">units</span></div>
                                            <div className="text-[9px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md inline-block">Rem: {fd(remainingQty)}</div>
                                        </div>

                                        {isSelected && (
                                            <div onClick={e => e.stopPropagation()} className="bg-rose-50 p-2 rounded-2xl border border-rose-100 flex flex-col items-center">
                                                <span className="text-[9px] font-black text-rose-500 uppercase mb-1">Return Qty</span>
                                                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl shadow-sm">
                                                    <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (returnQty - 1).toString())} className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500"><Minus size={14}/></button>
                                                    <span className="font-black text-slate-900 min-w-[20px] text-center">{fd(returnQty)}</span>
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

                <div className="fixed bottom-0 md:bottom-6 left-0 md:left-auto right-0 md:right-8 bg-white md:rounded-3xl border-t md:border border-slate-100 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:shadow-2xl z-[90] pb-safe flex justify-between items-center md:min-w-[400px]">
                   <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Refund Total ({fd(Object.keys(selectedReturns).length)})</p>
                      <p className="text-2xl font-black text-rose-600 tracking-tight">₹{totalRefundAmount.toLocaleString()}</p>
                   </div>

                   <button 
                      onClick={() => setShowReturnConfirm(true)}
                      disabled={Object.keys(selectedReturns).length === 0 || processingReturns}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-rose-200 transition-all flex items-center gap-3 active:scale-[0.95] disabled:shadow-none"
                   >
                      {processingReturns ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                      Process
                   </button>
                </div>
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-3xl shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-white flex flex-col lg:flex-row justify-between items-center gap-4">
                   <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="p-2 bg-slate-900 text-white rounded-xl"><History size={18} /></div>
                      <span className="font-black text-slate-900 text-base uppercase tracking-tight">Financial Journal</span>
                      
                      <div className="ml-4 flex bg-slate-100 p-1 rounded-xl">
                          <button onClick={() => setViewMode('STACKED')} className={`p-2 rounded-lg transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="Bill Stack View"><Layers size={16} /></button>
                          <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="Item List View"><List size={16} /></button>
                          <button onClick={() => setViewMode('CUSTOMER')} className={`p-2 rounded-lg transition-all ${viewMode === 'CUSTOMER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="By Customer Registry"><Users size={16} /></button>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
                      <button 
                        onClick={handleExportPendingPayments}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-amber-600 transition-all shadow-sm active:scale-95 flex items-center gap-2 px-4 whitespace-nowrap"
                        title="Export Pending Payments"
                      >
                        <FileDown size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Export Dues</span>
                      </button>

                      <div className="relative flex-1 md:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                         <input 
                           type="text" 
                           placeholder="Search History..." 
                           className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-bold shadow-inner focus:ring-2 focus:ring-slate-200"
                           value={historySearch}
                           onChange={e => setHistorySearch(e.target.value)}
                         />
                      </div>
                      <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-xl border transition-all flex items-center gap-2 whitespace-nowrap text-xs font-bold ${showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      >
                         <Filter size={16} /> Filters {(typeFilter !== 'ALL' || dateRange !== 'ALL' || minAmount || maxAmount) && "•"}
                      </button>
                      <button 
                        onClick={loadHistory}
                        className="p-2 bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-slate-600 transition-all"
                      >
                         <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                      </button>
                   </div>
                </div>

                {showFilters && (
                  <div className="bg-white border-b border-slate-100 p-4 md:p-6 animate-slide-down">
                    <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tx Type</label>
                          <select 
                            className="w-full bg-slate-50 border-none rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-slate-100"
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as any)}
                          >
                             <option value="ALL">All Types</option>
                             <option value={TransactionType.SALE}>Sales Only</option>
                             <option value={TransactionType.RETURN}>Returns Only</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Period</label>
                          <select 
                            className="w-full bg-slate-50 border-none rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-slate-100"
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value as any)}
                          >
                             <option value="ALL">All Time</option>
                             <option value="TODAY">Today</option>
                             <option value="WEEK">Last 7 Days</option>
                             <option value="MONTH">Last 30 Days</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount Range (₹)</label>
                          <div className="flex items-center gap-2">
                             <input 
                               type="number" 
                               placeholder="Min" 
                               className="w-full bg-slate-50 border-none rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-slate-100"
                               value={minAmount}
                               onChange={e => setMinAmount(e.target.value)}
                             />
                             <span className="text-slate-300">-</span>
                             <input 
                               type="number" 
                               placeholder="Max" 
                               className="w-full bg-slate-50 border-none rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-slate-100"
                               value={maxAmount}
                               onChange={e => setMaxAmount(e.target.value)}
                             />
                          </div>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sort Order</label>
                          <div className="flex gap-2">
                            <select 
                                className="flex-1 bg-slate-50 border-none rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-slate-100"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as any)}
                            >
                                <option value="date">Date</option>
                                <option value="amount">Amount</option>
                            </select>
                            <button 
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="bg-slate-50 p-2.5 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
                            >
                                <ArrowUpDown size={16} />
                            </button>
                          </div>
                       </div>
                    </div>
                    <div className="flex justify-end mt-4">
                       <button onClick={clearFilters} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline">Reset All Filters</button>
                    </div>
                  </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-24">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : (viewMode === 'LIST' ? sortedListHistory : viewMode === 'STACKED' ? stackedHistory : customerHistory).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                        <AlertCircle size={64} className="mb-4 opacity-10" />
                        <p className="font-black text-xs uppercase tracking-widest">No entries found matching filters</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {viewMode === 'LIST' ? (
                        sortedListHistory.map(tx => {
                            const isReturn = tx.type === TransactionType.RETURN;
                            const amount = tx.price * tx.quantity;
                            const paid = tx.paidAmount || 0;
                            const isFullyPaid = paid >= amount;
                            const isPartial = paid > 0 && paid < amount;

                            return (
                                <div key={tx.id} className="p-5 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm flex flex-col animate-fade-in relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1">
                                            <div className="font-black text-slate-900 text-lg leading-tight group-hover:text-brand-600 transition-colors">{tx.partNumber}</div>
                                            <div className="flex flex-col text-slate-400 text-[11px] font-bold">
                                                <div className="flex items-center gap-1.5"><Calendar size={12} /> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5"><Clock size={12} /> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isReturn ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                            {tx.type}
                                        </div>
                                    </div>
                                    
                                    {/* MOBILE-CENTRIC CUSTOMER NAME ROW */}
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-1.5 bg-white rounded-lg text-slate-400 border border-slate-100">
                                                <UserIcon size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-slate-800 truncate uppercase">{tx.customerName || 'Standard Client'}</p>
                                            </div>
                                        </div>
                                        {!isReturn && (
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md shadow-inner border ${isFullyPaid ? 'bg-teal-50 text-teal-600 border-teal-100' : isPartial ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {isFullyPaid ? 'Paid' : isPartial ? 'Partial' : 'Credit'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto flex justify-between items-center">
                                        <span className="bg-slate-100 px-3 py-1 rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-widest">{fd(tx.quantity)} units</span>
                                        <div className="text-right">
                                            <p className={`text-xl font-black tracking-tight ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>₹{amount.toLocaleString()}</p>
                                            {!isReturn && !isFullyPaid && <p className="text-[9px] font-bold text-rose-500 uppercase">Bal: ₹{(amount - paid).toLocaleString()}</p>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                      ) : viewMode === 'STACKED' ? (
                        stackedHistory.map(bill => {
                            const isReturn = bill.type === TransactionType.RETURN;
                            const isFullyPaid = bill.totalPaid >= bill.totalAmount;
                            const isPartial = bill.totalPaid > 0 && bill.totalPaid < bill.totalAmount;

                            return (
                                <div 
                                    key={bill.id} 
                                    onClick={() => setSelectedBill(bill)}
                                    className="p-6 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-premium hover:border-slate-300 hover:shadow-xl transition-all cursor-pointer group relative animate-fade-in"
                                >
                                    <div className="absolute -bottom-2 left-8 right-8 h-2 bg-slate-200 rounded-b-3xl -z-10 group-hover:-bottom-3 transition-all opacity-40"></div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${isReturn ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                                    {isReturn ? <Undo2 size={16}/> : <PlusCircle size={16}/>}
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isReturn ? 'text-rose-500' : 'text-teal-600'}`}>
                                                    {bill.type} Bill
                                                </span>
                                            </div>
                                            <div className="text-[11px] font-bold text-slate-400 flex flex-col gap-1">
                                                <div className="flex items-center gap-2"><Calendar size={12}/> {new Date(bill.createdAt).toLocaleDateString()}</div>
                                                <div className="flex items-center gap-2"><Clock size={12}/> {new Date(bill.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </div>
                                        </div>
                                        {!isReturn && (
                                            <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-soft ${isFullyPaid ? 'bg-teal-50 text-teal-700 border-teal-100' : isPartial ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                {isFullyPaid ? 'Settled' : isPartial ? 'Partial' : 'Credit'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mb-6">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Customer / Client</p>
                                        <div className="font-black text-lg text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors uppercase">
                                            {bill.customerName || 'Standard Checkout'}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto">
                                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                                            <Package size={14} className="text-slate-400"/>
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{fd(bill.items.length)} Parts</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bill Total</p>
                                            <p className={`text-2xl font-black tracking-tighter ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>
                                                ₹{bill.totalAmount.toLocaleString()}
                                            </p>
                                            {!isReturn && !isFullyPaid && <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-wider">₹{(bill.totalAmount - bill.totalPaid).toLocaleString()} Due</p>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                      ) : (
                        customerHistory.map(cust => {
                          const isFullySettled = cust.totalPaid >= cust.totalSpent;
                          const balance = cust.totalSpent - cust.totalPaid;

                          return (
                            <div 
                                key={cust.name} 
                                onClick={() => setSelectedCustomer(cust)}
                                className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-soft hover:border-brand-300 hover:shadow-xl transition-all cursor-pointer group animate-fade-in relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-full bg-brand-500/[0.02] -skew-x-12 translate-x-16 group-hover:translate-x-12 transition-transform"></div>
                                <div className="flex justify-between items-start mb-10">
                                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:bg-brand-600 transition-colors">
                                        <UserIcon size={28} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Outstanding Balance</p>
                                        <p className={`text-2xl font-black tracking-tighter ${balance > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                                            ₹{balance.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="mb-8">
                                    <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight group-hover:text-brand-600 transition-colors leading-tight truncate pr-4">{cust.name}</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[9px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100 uppercase tracking-widest">{fd(cust.transactions.length)} Trans</span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LTV: ₹{cust.totalSpent.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-slate-50 flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${isFullySettled ? 'bg-teal-50 text-teal-400' : 'bg-rose-50 text-rose-400'}`}>
                                            {isFullySettled ? <CheckCircle size={14}/> : <AlertTriangle size={14}/>}
                                        </div>
                                        <span className={`text-[11px] font-black uppercase tracking-widest ${isFullySettled ? 'text-teal-600' : 'text-rose-500'}`}>
                                            {isFullySettled ? 'Clear Ledger' : 'Due Payment'}
                                        </span>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-200 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
             </div>
          )}
       </div>

       {/* BILL DETAIL MODAL */}
       {selectedBill && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-fade-in">
              <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                      <div className="flex items-center gap-5">
                          <button onClick={() => setSelectedBill(null)} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-90"><ArrowLeft size={24}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-2 uppercase">{selectedBill.customerName || 'Cash Bill'}</h3>
                              <div className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-widest">
                                  <Calendar size={14}/> {new Date(selectedBill.createdAt).toLocaleDateString()}
                                  <Clock size={14} className="ml-2"/> {new Date(selectedBill.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                          </div>
                      </div>
                      {selectedBill.type !== 'RETURN' && (
                          <div className={`hidden md:flex flex-col items-end gap-1.5`}>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Liquidity Status</span>
                             <div className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-inner border ${selectedBill.totalPaid >= selectedBill.totalAmount ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                {selectedBill.totalPaid >= selectedBill.totalAmount ? 'FULLY PAID' : `₹${(selectedBill.totalAmount - selectedBill.totalPaid).toLocaleString()} OUTSTANDING`}
                             </div>
                          </div>
                      )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 no-scrollbar space-y-8">
                      <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-4">
                             <div className="w-1.5 h-6 bg-brand-600 rounded-full"></div>
                             <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm">Line Items ({fd(selectedBill.items.length)})</h4>
                          </div>
                          {selectedBill.items.map((item, idx) => {
                              const isItemFullyPaid = item.paidAmount >= (item.price * item.quantity);
                              const isOpeningPayment = isAddingPayment === item.id;

                              return (
                                <div key={item.id} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col gap-6 group hover:bg-white hover:border-brand-100 transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center font-black text-slate-300 text-sm">{fd(idx + 1)}</div>
                                            <div>
                                                <div className="font-black text-slate-900 text-lg leading-tight tracking-tight uppercase">{item.partNumber}</div>
                                                <p className="text-[13px] text-slate-400 font-bold uppercase tracking-widest mt-1">Rate: ₹{item.price.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between md:justify-end gap-12 pt-4 md:pt-0">
                                            <div className="text-center md:text-right">
                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Quantity</p>
                                                <p className="text-xl font-black text-slate-900">{fd(item.quantity)}</p>
                                            </div>
                                            <div className="text-right min-w-[120px]">
                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Total Value</p>
                                                <p className="text-xl font-black text-slate-900 tracking-tight">₹{(item.price * item.quantity).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedBill.type !== 'RETURN' && (
                                        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 p-4 rounded-2xl">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Wallet size={16}/></div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount Received</p>
                                                    <p className={`font-black text-base ${isItemFullyPaid ? 'text-teal-600' : 'text-amber-600'}`}>₹{(item.paidAmount || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            
                                            {isOpeningPayment ? (
                                                <div className="flex items-center gap-2 animate-slide-up">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">₹</span>
                                                        <input 
                                                            autoFocus
                                                            type="number" 
                                                            className="w-32 pl-6 pr-3 py-2 bg-white border border-brand-200 rounded-xl text-sm font-black outline-none focus:ring-4 focus:ring-brand-500/5 transition-all shadow-inner-soft"
                                                            placeholder="Collect..."
                                                            value={newPaidVal}
                                                            onChange={e => setNewPaidVal(e.target.value)}
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRegisterPayment(item.id)}
                                                        disabled={submittingPayment}
                                                        className="px-4 py-2 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg active:scale-95 disabled:opacity-30"
                                                    >
                                                        {submittingPayment ? <Loader2 size={14} className="animate-spin"/> : 'Confirm'}
                                                    </button>
                                                    <button onClick={() => setIsAddingPayment(null)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><X size={16}/></button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setIsAddingPayment(item.id);
                                                        setNewPaidVal(item.paidAmount.toString());
                                                    }}
                                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 border ${isItemFullyPaid ? 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:border-slate-200' : 'bg-brand-50 text-brand-600 border-brand-100 hover:bg-brand-100'}`}
                                                >
                                                    <PlusCircle size={14}/> {isItemFullyPaid ? 'Adjust Payment' : 'Collect Balance'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                              )
                          })}
                      </div>
                  </div>
                  <div className="p-8 md:p-10 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-xl"><Banknote size={32} /></div>
                          <div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Final Amount</p>
                              <p className={`text-4xl font-black tracking-tighter tabular-nums ${selectedBill.type === 'RETURN' ? 'text-rose-600' : 'text-slate-900'}`}>
                                  ₹{selectedBill.totalAmount.toLocaleString()}
                              </p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedBill(null)} className="w-full md:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-12 py-5 rounded-[2rem] transition-all active:scale-95 uppercase text-xs tracking-widest">Close View</button>
                  </div>
              </div>
          </div>
       )}

       {/* CUSTOMER DETAIL MODAL */}
       {selectedCustomer && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-fade-in">
              <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="p-10 border-b border-slate-100 flex justify-between items-start bg-slate-50/40">
                      <div className="flex items-center gap-6">
                          <button onClick={() => setSelectedCustomer(null)} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-90"><ArrowLeft size={24}/></button>
                          <div>
                              <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mb-2">Customer Profile</p>
                              <div className="flex items-center gap-4">
                                <h3 className="font-black text-slate-900 text-3xl tracking-tight leading-none uppercase">{selectedCustomer.name}</h3>
                                <button 
                                  onClick={() => handleExportCustomerLedger(selectedCustomer)}
                                  className="p-2.5 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-xl transition-all shadow-sm active:scale-90"
                                  title="Download Individual Ledger"
                                >
                                  <Download size={20} />
                                </button>
                              </div>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
                          <p className={`text-3xl font-black tracking-tighter ${selectedCustomer.totalSpent > selectedCustomer.totalPaid ? 'text-rose-600' : 'text-teal-600'}`}>
                              ₹{(selectedCustomer.totalSpent - selectedCustomer.totalPaid).toLocaleString()}
                          </p>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
                      <div className="space-y-4">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                             <History size={16} /> Transaction Timeline ({fd(selectedCustomer.transactions.length)})
                          </h4>
                          {selectedCustomer.transactions.map((tx, idx) => {
                              const isReturn = tx.type === TransactionType.RETURN;
                              const amount = tx.price * tx.quantity;
                              const balance = amount - (tx.paidAmount || 0);

                              return (
                                <div key={tx.id} className={`p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-6 group transition-all ${isReturn ? 'bg-rose-50/30 border-rose-100' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-brand-100'}`}>
                                    <div className="flex items-center gap-6">
                                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs ${isReturn ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-white text-slate-300 border-slate-100'}`}>
                                           {isReturn ? <RotateCcw size={16}/> : fd(idx + 1)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                               <div className={`font-black text-lg uppercase tracking-tight ${isReturn ? 'text-rose-700' : 'text-slate-900'}`}>{tx.partNumber}</div>
                                               {isReturn && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-rose-600 text-white rounded shadow-sm">Returned Part</span>}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
                                                <div className="flex items-center gap-1"><Calendar size={12}/> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                                <div className="flex items-center gap-1"><Clock size={12}/> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-10">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Value</p>
                                            <p className={`text-lg font-black ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>{isReturn ? '-' : ''}₹{amount.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right min-w-[100px]">
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Status</p>
                                            {isReturn ? (
                                                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border bg-slate-100 text-slate-500 border-slate-200 shadow-inner">
                                                   Stock Reverted
                                                </span>
                                            ) : (
                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border shadow-inner ${balance <= 0 ? 'bg-teal-50 text-teal-600 border-teal-100' : balance < amount ? `bg-amber-50 text-amber-600 border-amber-100` : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                   {balance <= 0 ? 'Settled' : balance < amount ? `Partial: ₹${balance.toLocaleString()} Due` : 'Full Credit Due'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                              )
                          })}
                      </div>
                  </div>
                  <div className="p-10 border-t border-slate-100 bg-white flex justify-end">
                      <button onClick={() => setSelectedCustomer(null)} className="bg-slate-900 hover:bg-black text-white font-black px-14 py-5 rounded-[2rem] transition-all active:scale-95 uppercase text-xs tracking-widest shadow-xl shadow-slate-200">Done Viewing</button>
                  </div>
              </div>
          </div>
       )}

       <ConfirmModal
         isOpen={showReturnConfirm}
         onClose={() => setShowReturnConfirm(false)}
         onConfirm={submitReturns}
         loading={processingReturns}
         variant="danger"
         title="Process Stock Return?"
         message={`You are about to process returns for ${fd(Object.keys(selectedReturns).length)} items. Total refund amount is ₹${totalRefundAmount.toLocaleString()}. This will add units back to inventory.`}
         confirmLabel="Confirm Return"
       />
    </div>
  );
};

// Internal utility component for refresh icon animation
const RefreshCw: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

export default Billing;
