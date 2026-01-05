
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Role, PaymentStatus } from '../types';
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
  Users
} from 'lucide-react';
import { createBulkTransactions, fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';
import ConfirmModal from '../components/ConfirmModal';

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
  paidAmount: number; // Sum of partial payments
  paymentStatus: PaymentStatus;
}

interface CustomerGroup {
  name: string;
  totalBusiness: number;
  totalPaid: number;
  billsCount: number;
  lastVisit: string;
  bills: GroupedBill[];
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
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

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

  // --- COMPUTED FILTERED HISTORY ---
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

  // --- GROUPING LOGIC FOR STACKED VIEW ---
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
          paidAmount: 0,
          paymentStatus: tx.paymentStatus || 'PAID'
        };
      }
      groups[key].items.push(tx);
      groups[key].totalAmount += (tx.price * tx.quantity);
      groups[key].paidAmount += (tx.paidAmount || 0);
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

  // --- GROUPING LOGIC FOR CUSTOMER VIEW ---
  const customerHistory = useMemo(() => {
    const groups: Record<string, CustomerGroup> = {};
    
    stackedHistory.forEach(bill => {
      const name = bill.customerName || 'Walk-in Customer';
      if (!groups[name]) {
        groups[name] = {
          name: name,
          totalBusiness: 0,
          totalPaid: 0,
          billsCount: 0,
          lastVisit: bill.createdAt,
          bills: []
        };
      }
      const group = groups[name];
      group.totalBusiness += bill.totalAmount;
      group.totalPaid += bill.paidAmount;
      group.billsCount += 1;
      if (new Date(bill.createdAt) > new Date(group.lastVisit)) {
        group.lastVisit = bill.createdAt;
      }
      group.bills.push(bill);
    });

    return Object.values(groups).sort((a, b) => b.totalBusiness - a.totalBusiness);
  }, [stackedHistory]);

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
                      onClick={() => setShowReturnConfirm(true)}
                      disabled={Object.keys(selectedReturns).length === 0 || processingReturns}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-rose-200 transition-all flex items-center gap-3 active:scale-[0.95] disabled:opacity-30 disabled:shadow-none"
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
                      
                      <div className="ml-4 flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/60">
                          <button onClick={() => setViewMode('STACKED')} className={`p-2 rounded-lg transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="Bill Stack View"><Layers size={16} /></button>
                          <button onClick={() => setViewMode('CUSTOMER')} className={`p-2 rounded-lg transition-all ${viewMode === 'CUSTOMER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="Customer Tab View"><Users size={16} /></button>
                          <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`} title="Item List View"><List size={16} /></button>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
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
                      {viewMode === 'LIST' && sortedListHistory.map(tx => {
                            const isReturn = tx.type === TransactionType.RETURN;
                            const isCredit = tx.paymentStatus === 'PENDING';
                            const amount = tx.price * tx.quantity;
                            return (
                                <div key={tx.id} className="p-5 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm flex flex-col animate-fade-in relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1">
                                            <div className="font-black text-slate-900 text-lg leading-tight group-hover:text-brand-600 transition-colors">{tx.partNumber}</div>
                                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold">
                                                <Calendar size={12} /> {new Date(tx.createdAt).toLocaleDateString()}
                                                <span className="text-slate-200">|</span>
                                                <Clock size={12} /> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isReturn ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                                {tx.type}
                                            </div>
                                            {tx.type === TransactionType.SALE && (
                                                <div className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border ${isCredit ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-teal-50 text-teal-500 border-teal-100'}`}>
                                                    {isCredit ? 'CREDIT' : 'PAID'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-50 flex items-center gap-3 mb-5">
                                        <UserIcon size={14} className="text-slate-300" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Billed To</p>
                                            <p className="text-[13px] font-bold text-slate-800 truncate">{tx.customerName || 'Walk-in'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-auto flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="bg-slate-100 px-3 py-1 rounded-xl text-[11px] font-black text-slate-500 uppercase tracking-widest w-fit mb-1">{tx.quantity} units</span>
                                            {tx.type === TransactionType.SALE && tx.paidAmount !== undefined && tx.paidAmount < amount && (
                                                <span className="text-[9px] font-black text-rose-500 uppercase">Received: ₹{tx.paidAmount.toLocaleString()}</span>
                                            )}
                                        </div>
                                        <p className={`text-xl font-black tracking-tight ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>₹{amount.toLocaleString()}</p>
                                    </div>
                                </div>
                            )
                      })}

                      {viewMode === 'STACKED' && stackedHistory.map(bill => {
                            const isReturn = bill.type === TransactionType.RETURN;
                            const isCredit = bill.paymentStatus === 'PENDING';
                            const isPartial = bill.paidAmount > 0 && bill.paidAmount < bill.totalAmount;
                            return (
                                <div 
                                    key={bill.id} 
                                    onClick={() => setSelectedBill(bill)}
                                    className="p-6 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-premium hover:border-slate-300 hover:shadow-xl transition-all cursor-pointer group relative animate-fade-in"
                                >
                                    <div className="absolute -bottom-2 left-8 right-8 h-2 bg-slate-200 rounded-b-3xl -z-10 group-hover:-bottom-3 transition-all opacity-40"></div>
                                    <div className="absolute -bottom-4 left-14 right-14 h-2 bg-slate-100 rounded-b-3xl -z-20 group-hover:-bottom-5 transition-all opacity-20"></div>

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
                                            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                                                <Calendar size={12}/> {new Date(bill.createdAt).toLocaleDateString()}
                                                <span className="text-slate-200">•</span>
                                                <Clock size={12}/> {new Date(bill.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="bg-slate-900 text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                                <ChevronRight size={20} />
                                            </div>
                                            {bill.type === TransactionType.SALE && (
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${isCredit ? (isPartial ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600') : 'bg-teal-100 text-teal-600'}`}>
                                                    {isCredit ? (isPartial ? 'PARTIAL' : 'CREDIT') : 'PAID'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Customer</p>
                                        <div className="font-black text-lg text-slate-900 leading-tight truncate group-hover:text-brand-600 transition-colors">
                                            {bill.customerName || 'Standard Checkout'}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto">
                                        <div className="flex flex-col">
                                            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2 w-fit mb-1">
                                                <Package size={14} className="text-slate-400"/>
                                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{bill.items.length} Parts</span>
                                            </div>
                                            {bill.type === TransactionType.SALE && bill.paidAmount < bill.totalAmount && (
                                                <span className="text-[9px] font-black text-amber-600 uppercase">Received: ₹{bill.paidAmount.toLocaleString()}</span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bill Total</p>
                                            <p className={`text-2xl font-black tracking-tighter ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>
                                                ₹{bill.totalAmount.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                      })}

                      {viewMode === 'CUSTOMER' && (customerHistory as CustomerGroup[]).map(group => (
                            <div key={group.name} className="p-8 rounded-[3rem] bg-white border-2 border-slate-100 shadow-soft hover:shadow-xl transition-all animate-fade-in group">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 bg-slate-100 rounded-[1.75rem] flex items-center justify-center text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition-all shadow-inner">
                                        <UserIcon size={32} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-slate-900 text-xl truncate tracking-tight uppercase leading-none mb-2">{group.name}</h3>
                                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                            <History size={12}/> LAST VISIT: {new Date(group.lastVisit).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL BUSINESS</p>
                                        <p className="text-xl font-black text-slate-900 tabular-nums">₹{group.totalBusiness.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL COLLECTED</p>
                                        <p className="text-xl font-black text-teal-600 tabular-nums">₹{group.totalPaid.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-8">
                                    {group.bills.slice(0, 3).map(bill => (
                                        <div 
                                            key={bill.id} 
                                            onClick={() => setSelectedBill(bill)}
                                            className="flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-white hover:shadow-md border border-slate-100/50 rounded-2xl transition-all cursor-pointer group/bill"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${bill.paymentStatus === 'PENDING' ? (bill.paidAmount > 0 ? 'bg-amber-500' : 'bg-rose-500') : 'bg-teal-500'}`}></div>
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{new Date(bill.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="font-black text-slate-900 text-sm tracking-tight group-hover/bill:text-brand-600 transition-colors">₹{bill.totalAmount.toLocaleString()}</div>
                                                {bill.paidAmount < bill.totalAmount && (
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">Paid: ₹{bill.paidAmount.toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {group.billsCount > 3 && (
                                        <p className="text-[10px] font-black text-slate-300 text-center uppercase tracking-widest pt-2">+{group.billsCount - 3} more records</p>
                                    )}
                                </div>

                                <button 
                                    onClick={() => {
                                        setHistorySearch(group.name);
                                        setViewMode('STACKED');
                                    }}
                                    className="w-full py-4 bg-slate-900 hover:bg-brand-600 text-white font-black rounded-2xl transition-all active:scale-95 text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-slate-200"
                                >
                                    View Detailed Ledger
                                </button>
                            </div>
                      ))}
                    </div>
                  )}
                </div>
             </div>
          )}
       </div>

       {/* BILL DETAIL MODAL */}
       {selectedBill && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-fade-in">
              <div 
                className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up"
              >
                  <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                      <div className="flex items-center gap-5">
                          <button onClick={() => setSelectedBill(null)} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-90"><ArrowLeft size={24}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-2">{selectedBill.customerName || 'Cash Bill'}</h3>
                              <div className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-widest">
                                  <Calendar size={14}/> {new Date(selectedBill.createdAt).toLocaleDateString()}
                                  <span className="text-slate-200">|</span>
                                  <Clock size={14}/> {new Date(selectedBill.createdAt).toLocaleTimeString()}
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          {selectedBill.type === TransactionType.SALE && (
                              <div className={`px-5 py-2.5 rounded-2xl text-sm font-black uppercase tracking-widest border-2 ${selectedBill.paymentStatus === 'PENDING' ? (selectedBill.paidAmount > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100') : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                  {selectedBill.paymentStatus === 'PENDING' ? (selectedBill.paidAmount > 0 ? 'PARTIAL' : 'CREDIT') : 'PAID'}
                              </div>
                          )}
                          <div className={`hidden md:block px-5 py-2.5 rounded-2xl text-sm font-black uppercase tracking-widest ${selectedBill.type === 'RETURN' ? 'bg-rose-50 text-rose-600' : 'bg-slate-900 text-white'}`}>
                              {selectedBill.type} INVOICE
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-10 no-scrollbar space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-1.5 h-6 bg-brand-600 rounded-full"></div>
                         <h4 className="font-black text-slate-900 uppercase tracking-widest text-sm">Line Items ({selectedBill.items.length})</h4>
                      </div>
                      
                      <div className="space-y-3">
                          {selectedBill.items.map((item, idx) => (
                              <div key={item.id} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-white hover:border-brand-100 hover:shadow-md transition-all">
                                  <div className="flex items-center gap-5">
                                      <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center font-black text-slate-300 text-sm">{idx + 1}</div>
                                      <div className="min-w-0">
                                          <div className="font-black text-slate-900 text-lg leading-tight tracking-tight group-hover:text-brand-600 transition-colors">{item.partNumber}</div>
                                          <p className="text-[13px] text-slate-400 font-bold uppercase tracking-widest mt-1">Net Rate: ₹{item.price.toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-12 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                                      <div className="text-center md:text-right">
                                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Quantity</p>
                                          <p className="text-xl font-black text-slate-900">{item.quantity}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Subtotal</p>
                                          <p className="text-xl font-black text-slate-900 tracking-tight">₹{(item.price * item.quantity).toLocaleString()}</p>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-8 md:p-10 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex flex-col md:flex-row items-center gap-10">
                          <div className="flex items-center gap-5">
                             <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-xl"><Banknote size={32} /></div>
                             <div>
                                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Final Bill Amount</p>
                                 <p className={`text-4xl font-black tracking-tighter ${selectedBill.type === 'RETURN' ? 'text-rose-600' : 'text-slate-900'}`}>
                                     {selectedBill.type === 'RETURN' ? '-' : ''}₹{selectedBill.totalAmount.toLocaleString()}
                                 </p>
                             </div>
                          </div>
                          
                          {selectedBill.type === TransactionType.SALE && (
                            <div className="flex flex-col border-l border-slate-100 pl-10 h-full justify-center">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Received</span>
                                    <span className="font-black text-slate-900 text-lg">₹{selectedBill.paidAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Balance</span>
                                    <span className="font-black text-rose-600 text-lg">₹{(selectedBill.totalAmount - selectedBill.paidAmount).toLocaleString()}</span>
                                </div>
                            </div>
                          )}
                      </div>
                      <button onClick={() => setSelectedBill(null)} className="w-full md:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-12 py-5 rounded-[2rem] transition-all active:scale-95 uppercase text-xs tracking-widest">Close View</button>
                  </div>
              </div>
          </div>
       )}

       {/* STOCK RETURN CONFIRMATION */}
       <ConfirmModal
         isOpen={showReturnConfirm}
         onClose={() => setShowReturnConfirm(false)}
         onConfirm={submitReturns}
         loading={processingReturns}
         variant="danger"
         title="Process Stock Return?"
         message={`You are about to process returns for ${Object.keys(selectedReturns).length} items. Total refund amount is ₹${totalRefundAmount.toLocaleString()}. This will add units back to inventory. Please verify the physical condition of parts before proceeding.`}
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
