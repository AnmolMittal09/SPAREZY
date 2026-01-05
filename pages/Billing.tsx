
import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Role, PaymentStatus } from '../types';
import DailyTransactions from './DailyTransactions'; 
import { 
  History, 
  PlusCircle, 
  User as UserIcon, 
  Undo2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Minus, 
  Plus, 
  Loader2,
  Filter,
  ArrowUpDown,
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
  Wallet,
  RefreshCw,
  Search,
  IndianRupee,
  CreditCard,
  ArrowRight
} from 'lucide-react';
import { createBulkTransactions, fetchTransactions, updateBillPayment } from '../services/transactionService';
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
  paidAmount: number;
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
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);

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

  // Fixed totalRefundAmount calculation
  const totalRefundAmount = useMemo(() => {
    return Object.keys(selectedReturns).reduce((sum, id) => {
      const tx = salesLog.find(s => s.id === id);
      return sum + (tx ? tx.price * selectedReturns[id] : 0);
    }, 0);
  }, [selectedReturns, salesLog]);

  useEffect(() => {
    if (activeTab === 'HISTORY') loadHistory();
    if (activeTab === 'RETURN') loadSalesForReturn();
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
    const availableSales = salesData.filter(sale => (sale.quantity - (returnedMap.get(sale.id) || 0)) > 0);
    setSalesLog(availableSales);
    setLoading(false);
  };

  const filteredHistory = useMemo(() => {
    let result = [...history];
    if (historySearch) {
      const s = historySearch.toLowerCase();
      result = result.filter(tx => tx.partNumber.toLowerCase().includes(s) || tx.customerName.toLowerCase().includes(s));
    }
    if (typeFilter !== 'ALL') result = result.filter(tx => tx.type === typeFilter);
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
        groups[key] = { id: tx.id, createdAt: tx.createdAt, customerName: tx.customerName, type: tx.type, items: [], totalAmount: 0, paidAmount: 0, paymentStatus: tx.paymentStatus || 'PAID' };
      }
      groups[key].items.push(tx);
      groups[key].totalAmount += (tx.price * tx.quantity);
      groups[key].paidAmount += (tx.paidAmount || 0);
    });
    const result = Object.values(groups);
    result.sort((a, b) => {
      let valA = sortBy === 'date' ? new Date(a.createdAt).getTime() : a.totalAmount;
      let valB = sortBy === 'date' ? new Date(b.createdAt).getTime() : b.totalAmount;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return result;
  }, [filteredHistory, sortBy, sortOrder]);

  const creditSummary = useMemo(() => {
      const pendingBills = stackedHistory.filter(b => b.type === TransactionType.SALE && b.paymentStatus === 'PENDING');
      const totalOutstanding = pendingBills.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);
      return { count: pendingBills.length, total: totalOutstanding };
  }, [stackedHistory]);

  const customerHistory = useMemo(() => {
    const groups: Record<string, CustomerGroup> = {};
    stackedHistory.forEach(bill => {
      const name = bill.customerName || 'Walk-in Customer';
      if (!groups[name]) groups[name] = { name, totalBusiness: 0, totalPaid: 0, billsCount: 0, lastVisit: bill.createdAt, bills: [] };
      const group = groups[name];
      group.totalBusiness += bill.totalAmount;
      group.totalPaid += bill.paidAmount;
      group.billsCount += 1;
      if (new Date(bill.createdAt) > new Date(group.lastVisit)) group.lastVisit = bill.createdAt;
      group.bills.push(bill);
    });
    return Object.values(groups).sort((a, b) => b.totalBusiness - a.totalBusiness);
  }, [stackedHistory]);

  const sortedListHistory = useMemo(() => {
    const result = [...filteredHistory];
    result.sort((a, b) => {
      let valA = sortBy === 'date' ? new Date(a.createdAt).getTime() : (a.price * a.quantity);
      let valB = sortBy === 'date' ? new Date(b.createdAt).getTime() : (b.price * b.quantity);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return result;
  }, [filteredHistory, sortBy, sortOrder]);

  const handleReturnToggle = (tx: Transaction) => {
    const newSelection = { ...selectedReturns };
    if (newSelection[tx.id]) delete newSelection[tx.id];
    else {
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
    } else setSelectedReturns({ ...selectedReturns, [txId]: qty });
  };

  const submitReturns = async () => {
    const ids = Object.keys(selectedReturns);
    if (ids.length === 0) return;
    setProcessingReturns(true);
    const returnPayload = ids.map(id => {
       const originalSale = salesLog.find(s => s.id === id);
       if (!originalSale) return null;
       return { partNumber: originalSale.partNumber, type: TransactionType.RETURN, quantity: selectedReturns[id], price: originalSale.price, customerName: originalSale.customerName || 'Customer Return', createdByRole: user.role, relatedTransactionId: originalSale.id };
    }).filter(Boolean) as any[];
    const res = await createBulkTransactions(returnPayload);
    setProcessingReturns(false);
    setShowReturnConfirm(false);
    if (res.success) {
       alert("Stock returned. Inventory updated.");
       setSelectedReturns({});
       loadSalesForReturn();
    } else alert("Error: " + res.message);
  };

  const handleBillPaymentUpdate = async () => {
    if (!selectedBill) return;
    const amount = parseFloat(paymentAmount);
    const outstanding = selectedBill.totalAmount - selectedBill.paidAmount;
    if (isNaN(amount) || amount <= 0) return alert("Enter valid collection amount");
    if (amount > outstanding) {
        if (!confirm(`Entering ₹${amount} which is more than the balance of ₹${outstanding}. Adjust to settle fully?`)) return;
    }
    setUpdatingPayment(true);
    const res = await updateBillPayment(selectedBill.createdAt, selectedBill.customerName, amount);
    setUpdatingPayment(false);
    if (res.success) {
      alert("Payment updated successfully.");
      setPaymentAmount('');
      setIsAddingPayment(false);
      setSelectedBill(null);
      loadHistory();
    } else alert("Update failed: " + res.message);
  };

  const clearFilters = () => { setHistorySearch(''); setTypeFilter('ALL'); setDateRange('ALL'); setMinAmount(''); setMaxAmount(''); setSortBy('date'); setSortOrder('desc'); };

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-4 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
               <button onClick={() => setActiveTab('NEW')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-brand-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>POS</button>
               <button onClick={() => setActiveTab('RETURN')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'RETURN' ? 'bg-white text-rose-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>Return</button>
               <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-800 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}>History</button>
            </div>
         </div>
       )}

       <div className="hidden md:flex justify-between items-center mb-8 px-1">
          <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Transaction Ledger</h1>
             <p className="text-slate-500 font-medium">Verify sales, manage credit settlements and returns.</p>
          </div>
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-soft">
             <button onClick={() => setActiveTab('NEW')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'NEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={16} /> New Sale</button>
             <button onClick={() => setActiveTab('RETURN')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'RETURN' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><Undo2 size={16} /> Returns</button>
             <button onClick={() => setActiveTab('HISTORY')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><History size={16} /> Journal</button>
          </div>
       </div>

       <div className="flex-1 overflow-hidden flex flex-col relative">
          {activeTab === 'NEW' && <DailyTransactions user={user} forcedMode="SALES" onSearchToggle={setIsSearchingOnMobile} />}

          {activeTab === 'RETURN' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-[3rem] shadow-premium border border-slate-100 flex flex-col h-full overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-6">
                   <div className="flex items-center gap-4 text-rose-600 font-black text-lg w-full md:w-auto uppercase tracking-tight"><div className="p-3 bg-rose-50 rounded-2xl"><Undo2 size={24} /></div> STOCK RETURN PORTAL</div>
                   <div className="w-full md:w-auto flex-1 md:max-w-md relative group">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" size={20} />
                       <input type="text" placeholder="Search Part SKU or Customer..." className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-[15px] font-black focus:ring-12 focus:ring-rose-500/5 focus:border-rose-500/10 focus:bg-white outline-none transition-all shadow-inner-soft" value={returnSearch} onChange={e => setReturnSearch(e.target.value)} />
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 no-scrollbar pb-32">
                   {loading ? <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={40}/></div> : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {salesLog.filter(tx => tx.partNumber.toLowerCase().includes(returnSearch.toLowerCase()) || (tx.customerName && tx.customerName.toLowerCase().includes(returnSearch.toLowerCase()))).map(tx => {
                            const isSelected = !!selectedReturns[tx.id];
                            const prevReturned = alreadyReturnedMap.get(tx.id) || 0;
                            const remainingQty = tx.quantity - prevReturned;
                            return (
                                <div key={tx.id} onClick={() => handleReturnToggle(tx)} className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer bg-white relative group animate-fade-in ${isSelected ? 'border-rose-500 ring-4 ring-rose-500/5 shadow-xl' : 'border-slate-100 hover:border-slate-300 shadow-soft'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`w-8 h-8 rounded-2xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-rose-600 border-rose-600 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-transparent'}`}><CheckCircle2 size={16} /></div>
                                        <div className="text-right"><div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Sale Date</div><div className="text-[12px] font-black text-slate-900">{new Date(tx.createdAt).toLocaleDateString()}</div></div>
                                    </div>
                                    <div className="mb-6"><div className="font-black text-xl text-slate-900 tracking-tight leading-none uppercase mb-2">{tx.partNumber}</div><div className="text-[14px] text-slate-400 font-bold truncate flex items-center gap-2"><UserIcon size={14} className="opacity-30"/> {tx.customerName || 'Walk-in'}</div></div>
                                    <div className="flex justify-between items-end border-t border-slate-50 pt-5">
                                        <div className="space-y-1"><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Original Sale</p><p className="font-black text-slate-900 text-lg tabular-nums">{tx.quantity} units</p><span className="text-[9px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100 inline-block">Rem: {remainingQty}</span></div>
                                        {isSelected && (
                                            <div onClick={e => e.stopPropagation()} className="bg-rose-50 p-3 rounded-2xl border border-rose-100 flex flex-col items-center shadow-inner-soft"><span className="text-[10px] font-black text-rose-500 uppercase mb-2">Adjust Qty</span><div className="flex items-center gap-4 bg-white p-1 rounded-xl shadow-soft">
                                                <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (selectedReturns[tx.id] - 1).toString())} className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg"><Minus size={16}/></button>
                                                <span className="font-black text-slate-900 text-lg min-w-[20px] text-center">{selectedReturns[tx.id]}</span>
                                                <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (selectedReturns[tx.id] + 1).toString())} className="w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center shadow-md"><Plus size={16}/></button>
                                            </div></div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                      </div>
                   )}
                </div>
                <div className="fixed bottom-0 md:bottom-8 left-0 right-0 md:left-auto md:right-10 bg-white/95 backdrop-blur-xl md:rounded-[2.5rem] border-t md:border border-slate-100 p-6 md:p-8 shadow-2xl z-[90] flex justify-between items-center md:min-w-[450px]">
                   <div className="flex-1 px-2">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Net Refund Payload</p>
                      <p className="text-3xl font-black text-rose-600 tracking-tighter tabular-nums">₹{totalRefundAmount.toLocaleString()}</p>
                   </div>
                   <button onClick={() => setShowReturnConfirm(true)} disabled={Object.keys(selectedReturns).length === 0 || processingReturns} className="bg-rose-600 hover:bg-rose-700 text-white px-12 py-5 rounded-[1.75rem] font-black shadow-xl shadow-rose-200 active:scale-[0.95] disabled:opacity-30 flex items-center gap-3 uppercase text-[13px] tracking-widest transition-all"> {processingReturns ? <Loader2 className="animate-spin" /> : <Undo2 size={20} />} Process Returns</button>
                </div>
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-[3.5rem] shadow-premium border border-slate-200/60 flex flex-col h-full overflow-hidden animate-fade-in">
                <div className="p-8 border-b border-slate-100 bg-white flex flex-col lg:flex-row justify-between items-center gap-8">
                   <div className="flex items-center gap-5 w-full md:w-auto">
                      <div className="p-3 bg-slate-900 text-white rounded-[1.25rem] shadow-lg shadow-slate-200"><History size={24} /></div>
                      <div>
                         <span className="font-black text-slate-900 text-2xl tracking-tight block uppercase leading-none mb-1">Collection Journal</span>
                         <div className="flex items-center gap-4 mt-2">
                            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/60">
                                <button onClick={() => setViewMode('STACKED')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-400'}`} title="Bill View"><Layers size={18} /></button>
                                <button onClick={() => setViewMode('CUSTOMER')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'CUSTOMER' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-400'}`} title="Client View"><Users size={18} /></button>
                                <button onClick={() => setViewMode('LIST')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-400'}`} title="Item View"><List size={18} /></button>
                            </div>
                            <span className="w-px h-6 bg-slate-200"></span>
                            <div className="flex items-center gap-2">
                               <div className={`p-1.5 rounded-lg ${creditSummary.total > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-teal-50 text-teal-600'}`}>
                                  <AlertCircle size={14}/>
                               </div>
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bal: <span className={creditSummary.total > 0 ? 'text-rose-600' : 'text-teal-600'}>₹{creditSummary.total.toLocaleString()}</span></span>
                            </div>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-3 w-full lg:w-auto">
                      <div className="relative flex-1 lg:w-72 group">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                         <input type="text" placeholder="Bill ID / Part SKU..." className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-[1.25rem] text-[15px] font-black focus:bg-white focus:border-blue-500/10 focus:ring-12 focus:ring-blue-500/5 transition-all shadow-inner-soft outline-none" value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                      </div>
                      <button onClick={loadHistory} className="p-4 bg-white text-slate-400 border border-slate-200 rounded-2xl hover:text-blue-600 shadow-soft transition-all active:rotate-180 duration-500"><RefreshCw size={20}/></button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 no-scrollbar pb-32 bg-slate-50/20">
                  {loading ? <div className="p-32"><TharLoader /></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {viewMode === 'STACKED' && stackedHistory.map(bill => {
                          const isCredit = bill.paymentStatus === 'PENDING';
                          const isPartial = bill.paidAmount > 0 && bill.paidAmount < bill.totalAmount;
                          return (
                            <div key={bill.id} onClick={() => setSelectedBill(bill)} className="p-8 rounded-[3rem] bg-white border-2 border-slate-100 shadow-soft hover:border-blue-300 hover:shadow-xl transition-all cursor-pointer group relative animate-fade-in flex flex-col">
                                <div className="flex justify-between items-start mb-8">
                                    <div className="space-y-2">
                                        <div className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] w-fit shadow-sm ${bill.type === 'RETURN' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>{bill.type} LEDGER</div>
                                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2"><Calendar size={14}/> {new Date(bill.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="flex flex-col items-end gap-3">
                                        <div className="bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all group-hover:bg-blue-600"><ChevronRight size={24} /></div>
                                        {bill.type === 'SALE' && (
                                            <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest shadow-inner ${isCredit ? (isPartial ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-rose-50 text-rose-600 border border-rose-100') : 'bg-teal-50 text-teal-600 border border-teal-100'}`}>
                                                {isCredit ? (isPartial ? 'Partial' : 'Credit') : 'Paid'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="mb-10 flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><UserIcon size={12}/> Billable Entity</p>
                                    <div className="font-black text-xl text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors uppercase">{bill.customerName || 'Retail Checkout'}</div>
                                </div>
                                <div className="flex justify-between items-end border-t border-slate-50 pt-8 mt-auto">
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-xl border border-slate-100 w-fit">{bill.items.length} Parts</div>
                                        {bill.type === 'SALE' && isCredit && <p className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg w-fit">Bal: ₹{(bill.totalAmount - bill.paidAmount).toLocaleString()}</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Asset Total</p>
                                        <p className={`text-3xl font-black tracking-tighter tabular-nums ${bill.type === 'RETURN' ? 'text-rose-600' : 'text-slate-900'}`}>₹{bill.totalAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                          );
                      })}

                      {viewMode === 'CUSTOMER' && customerHistory.map(group => (
                        <div key={group.name} className="p-10 rounded-[3.5rem] bg-white border-2 border-slate-100 shadow-soft hover:shadow-xl transition-all animate-fade-in group">
                            <div className="flex items-center gap-6 mb-10">
                                <div className="w-16 h-16 bg-slate-100 rounded-[1.75rem] flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all shadow-inner-soft"><UserIcon size={32} /></div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-slate-900 text-2xl truncate tracking-tight uppercase leading-none mb-2">{group.name}</h3>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 leading-none"><Clock size={12}/> Last Activity: {new Date(group.lastVisit).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-10">
                                <div className="bg-slate-50/50 p-5 rounded-[1.5rem] text-center border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Aggregate Sales</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">₹{group.totalBusiness.toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-50/50 p-5 rounded-[1.5rem] text-center border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Outstanding</p>
                                    <p className={`text-xl font-black tabular-nums ${group.totalBusiness - group.totalPaid > 0 ? 'text-rose-600' : 'text-teal-600'}`}>₹{(group.totalBusiness - group.totalPaid).toLocaleString()}</p>
                                </div>
                            </div>
                            <button onClick={() => { setHistorySearch(group.name); setViewMode('STACKED'); }} className="w-full py-5 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl transition-all active:scale-[0.98] text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 flex items-center justify-center gap-3">Browse Client Ledger <ArrowRight size={18}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             </div>
          )}
       </div>

       {/* BILL DETAIL & PAYMENT UPDATE MODAL */}
       {selectedBill && (
          <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-fade-in overflow-hidden">
              <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up relative">
                  <div className="p-8 md:p-10 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                      <div className="flex items-center gap-6">
                          <button onClick={() => { setSelectedBill(null); setIsAddingPayment(false); }} className="p-4 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl border border-slate-100 active:scale-90 transition-all shadow-soft"><ArrowLeft size={24}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-2 uppercase">{selectedBill.customerName || 'Standard Sale'}</h3>
                              <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2"><Clock size={12} className="opacity-40"/> {new Date(selectedBill.createdAt).toLocaleString()}</p>
                          </div>
                      </div>
                      <div className={`px-6 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest border-2 shadow-sm ${selectedBill.paymentStatus === 'PENDING' ? (selectedBill.paidAmount > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100') : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                          {selectedBill.paymentStatus === 'PENDING' ? (selectedBill.paidAmount > 0 ? 'Partial Settlement' : 'Credit Protocol') : 'Fully Settled'}
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-10 no-scrollbar space-y-10 bg-slate-50/20">
                      <div className="space-y-3">
                          <div className="flex items-center gap-3 px-2 mb-4">
                             <Package size={16} className="text-slate-400" />
                             <h4 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400">Inventory Disposition</h4>
                          </div>
                          {selectedBill.items.map((item, idx) => (
                              <div key={item.id} className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-200 transition-colors group">
                                  <div className="flex items-center gap-5">
                                      <div className="w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center font-black text-slate-300 text-sm group-hover:bg-blue-50 group-hover:text-blue-400 transition-colors">{idx + 1}</div>
                                      <div className="min-w-0">
                                          <div className="font-black text-slate-900 text-xl leading-none uppercase truncate tracking-tight mb-2">{item.partNumber}</div>
                                          <p className="text-[12px] text-slate-400 font-bold uppercase tracking-widest">Rate: ₹{item.price.toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-14 border-t md:border-t-0 border-slate-100 pt-6 md:pt-0">
                                      <div className="text-right"><p className="text-[9px] font-black text-slate-300 uppercase mb-1 tracking-widest">Quantity</p><p className="text-xl font-black text-slate-900 tabular-nums">{item.quantity} PCS</p></div>
                                      <div className="text-right"><p className="text-[9px] font-black text-slate-300 uppercase mb-1 tracking-widest">Total Asset</p><p className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums">₹{(item.price * item.quantity).toLocaleString()}</p></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                      
                      {selectedBill.type === 'SALE' && selectedBill.paymentStatus === 'PENDING' && !isAddingPayment && (
                          <div className="animate-fade-in p-1">
                             <button onClick={() => setIsAddingPayment(true)} className="w-full py-8 border-4 border-dashed border-slate-200 text-slate-400 rounded-[2.5rem] font-black uppercase text-[13px] tracking-[0.25em] hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center gap-4 bg-white/50 active:scale-[0.99]"><Wallet size={24}/> Record Collection Detail</button>
                          </div>
                      )}

                      {isAddingPayment && (
                          <div className="bg-[#1E293B] p-10 rounded-[3rem] text-white shadow-2xl shadow-slate-400 animate-slide-up border border-white/5">
                              <div className="flex justify-between items-center mb-10">
                                  <div className="flex items-center gap-4">
                                     <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20"><Wallet size={20} /></div>
                                     <h4 className="font-black uppercase text-[12px] tracking-[0.2em]">Post Payment Record</h4>
                                  </div>
                                  <button onClick={() => setIsAddingPayment(false)} className="p-2 text-white/20 hover:text-white transition-colors bg-white/5 rounded-xl"><X size={24}/></button>
                              </div>
                              <div className="flex flex-col md:flex-row gap-8 items-end">
                                  <div className="flex-1 w-full space-y-3">
                                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Custom Amount Received (₹)</label>
                                      <div className="relative group">
                                          <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-blue-400 transition-colors" size={28} strokeWidth={2.5} />
                                          <input autoFocus type="number" placeholder="0.00" className="w-full bg-black/40 border-2 border-white/5 rounded-3xl pl-16 pr-6 py-6 text-3xl font-black text-white focus:border-blue-500/40 outline-none transition-all shadow-inner" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                                      </div>
                                  </div>
                                  <button onClick={handleBillPaymentUpdate} disabled={updatingPayment} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black px-14 py-7 rounded-[1.75rem] active:scale-95 transition-all text-[14px] uppercase tracking-widest shadow-elevated shadow-blue-900/40 flex items-center justify-center gap-3"> {updatingPayment ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />} Authorize Ledger</button>
                              </div>
                              <div className="mt-10 flex items-center justify-between px-2 py-4 border-t border-white/5">
                                 <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Remaining Liability</p>
                                 <p className="text-xl font-black text-rose-400 tabular-nums">₹{(selectedBill.totalAmount - selectedBill.paidAmount).toLocaleString()}</p>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-8 md:p-12 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-8 sticky bottom-0 z-10 shadow-inner-soft">
                      <div className="flex flex-col md:flex-row items-center gap-12">
                          <div className="flex items-center gap-6">
                             <div className="p-5 bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-200"><Banknote size={40} strokeWidth={2.5}/></div>
                             <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Bill Value</p>
                                 <p className="text-4xl font-black tracking-tighter text-slate-900 tabular-nums">₹{selectedBill.totalAmount.toLocaleString()}</p>
                             </div>
                          </div>
                          {selectedBill.type === 'SALE' && (
                            <div className="flex items-center gap-12 border-l border-slate-100 pl-12 h-16">
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">Settled</span>
                                    <span className="font-black text-slate-900 text-2xl tracking-tight tabular-nums">₹{selectedBill.paidAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Balance</span>
                                    <span className="font-black text-rose-600 text-2xl tracking-tight tabular-nums">₹{(selectedBill.totalAmount - selectedBill.paidAmount).toLocaleString()}</span>
                                </div>
                            </div>
                          )}
                      </div>
                      <button onClick={() => { setSelectedBill(null); setIsAddingPayment(false); }} className="w-full md:w-auto bg-slate-100 hover:bg-slate-200 text-slate-500 font-black px-16 py-6 rounded-[2rem] uppercase text-[12px] tracking-[0.2em] transition-all active:scale-95">Dismiss Detail</button>
                  </div>
              </div>
          </div>
       )}

       <ConfirmModal isOpen={showReturnConfirm} onClose={() => setShowReturnConfirm(false)} onConfirm={submitReturns} loading={processingReturns} variant="danger" title="Confirm Reversal" message={`Finalizing reversal for ${Object.keys(selectedReturns).length} items. Total cash refund liability is ₹${totalRefundAmount.toLocaleString()}. Proceed with stock restoration?`} confirmLabel="Finalize Return" />
    </div>
  );
};

export default Billing;
