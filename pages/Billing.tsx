import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, TransactionStatus, TransactionType, Role, StockItem } from '../types';
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
  Download,
  ExternalLink,
  ClipboardList,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { createBulkTransactions, fetchTransactions, updateTransactionPayment } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
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
type ReturnViewMode = 'RECENT' | 'BY_CUSTOMER';

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
  const [returnViewMode, setReturnViewMode] = useState<ReturnViewMode>('RECENT');
  const [history, setHistory] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearchingOnMobile, setIsSearchingOnMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [selectedBill, setSelectedBill] = useState<GroupedBill | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerGroup | null>(null);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [expandedCustomerReturn, setExpandedCustomerReturn] = useState<string | null>(null);
  
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
    // Load inventory for name resolution on mount
    fetchInventory().then(setInventory);
  }, []);

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
          if (selectedCustomer) {
            const updatedTx = selectedCustomer.transactions.map(t => t.id === txId ? {...t, paidAmount: val} : t);
            const totalSpent = updatedTx.reduce((acc, t) => acc + (t.type === TransactionType.SALE ? (t.price * t.quantity) : -(t.price * t.quantity)), 0);
            const totalPaid = updatedTx.reduce((acc, t) => acc + (t.type === TransactionType.SALE ? (t.paidAmount || 0) : -(t.paidAmount || 0)), 0);
            setSelectedCustomer({
                ...selectedCustomer,
                transactions: updatedTx,
                totalSpent,
                totalPaid
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
      const custName = (tx.customerName || 'ANONYMOUS').toUpperCase().trim();
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
      const part = inventory.find(i => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());
      return {
        'Date': new Date(tx.createdAt).toLocaleDateString(),
        'Time': new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Customer Name': tx.customerName || 'Walk-in',
        'Part Name': part?.name || 'GENUINE SPARE PART',
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
      const part = inventory.find(i => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());
      return {
        'Date': new Date(tx.createdAt).toLocaleDateString(),
        'Time': new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Part Name': part?.name || 'GENUINE SPARE PART',
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

  const handleExportCustomerPendingDues = (customer: CustomerGroup) => {
    const pendingTxs = customer.transactions.filter(tx => tx.type === TransactionType.SALE && (tx.paidAmount || 0) < (tx.price * tx.quantity));
    
    if (pendingTxs.length === 0) return alert("This customer has no pending dues.");

    const dataToExport = pendingTxs.map(tx => {
      const total = tx.price * tx.quantity;
      const paid = tx.paidAmount || 0;
      const part = inventory.find(i => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());
      return {
        'Date': new Date(tx.createdAt).toLocaleDateString(),
        'Part Name': part?.name || 'GENUINE SPARE PART',
        'Quantity': tx.quantity,
        'Billed Amount': total,
        'Amount Received': paid,
        'Pending Balance': total - paid
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding_Dues");
    XLSX.writeFile(wb, `Dues_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  const groupedReturnsByCustomer = useMemo(() => {
    const groups: Record<string, { name: string; transactions: Transaction[] }> = {};
    filteredSalesLog.forEach(tx => {
      const name = (tx.customerName || 'WALK-IN').toUpperCase().trim();
      if (!groups[name]) groups[name] = { name, transactions: [] };
      groups[name].transactions.push(tx);
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSalesLog]);

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
                 className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'NEW' ? 'bg-white text-brand-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}
               >
                 POS
               </button>
               <button 
                 onClick={() => setActiveTab('RETURN')}
                 className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'RETURN' ? 'bg-white text-rose-600 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}
               >
                 Returns
               </button>
               <button 
                 onClick={() => setActiveTab('HISTORY')}
                 className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-white text-slate-800 shadow-md ring-1 ring-slate-100' : 'text-slate-400'}`}
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
                   <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><Undo2 size={20} /></div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-base uppercase tracking-tight">Return Inventory</span>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg mt-1">
                            <button onClick={() => setReturnViewMode('RECENT')} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${returnViewMode === 'RECENT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Recent Sales</button>
                            <button onClick={() => setReturnViewMode('BY_CUSTOMER')} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${returnViewMode === 'BY_CUSTOMER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>By Customer</button>
                        </div>
                      </div>
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

                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-32">
                   {loading ? (
                      <div className="flex justify-center p-12"><TharLoader /></div>
                   ) : (returnViewMode === 'RECENT' ? filteredSalesLog : groupedReturnsByCustomer).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                         <AlertCircle size={64} className="mb-4 opacity-10" />
                         <p className="font-black text-xs uppercase tracking-widest">No returnable entries found</p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {returnViewMode === 'RECENT' ? (
                          filteredSalesLog.map(tx => {
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
                          })
                        ) : (
                          groupedReturnsByCustomer.map(customer => {
                            const isExpanded = expandedCustomerReturn === customer.name;
                            const selectedCount = customer.transactions.filter(t => !!selectedReturns[t.id]).length;
                            
                            return (
                              <div key={customer.name} className="col-span-1 md:col-span-2 lg:col-span-3">
                                <div 
                                  onClick={() => setExpandedCustomerReturn(isExpanded ? null : customer.name)}
                                  className={`p-6 rounded-3xl border bg-white shadow-soft flex items-center justify-between cursor-pointer transition-all ${isExpanded ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                      <UserIcon size={22} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                      <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight leading-tight">{customer.name}</h3>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">{fd(customer.transactions.length)} Returnable Parts</span>
                                        {selectedCount > 0 && <span className="text-[9px] font-black text-white bg-rose-600 px-2 py-0.5 rounded uppercase tracking-widest">{fd(selectedCount)} Selected</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronDown size={20} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {isExpanded && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 animate-fade-in p-2">
                                    {customer.transactions.map(tx => {
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
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Rate: ₹{tx.price.toLocaleString()}</p>
                                            </div>

                                            <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Available</div>
                                                    <div className="font-black text-slate-900">{fd(remainingQty)} <span className="text-[10px] text-slate-400">units</span></div>
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
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
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
                        title="Export All Pending Collections"
                      >
                        <FileDown size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Global Dues</span>
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
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-32">
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
                                <div key={tx.id} className="p-5 rounded-[2.25rem] bg-white border border-slate-100 shadow-sm flex flex-col animate-fade-in relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1">
                                            <div className="font-black text-slate-900 text-base leading-tight group-hover:text-brand-600 transition-colors uppercase">{tx.partNumber}</div>
                                            <div className="flex flex-col text-slate-400 text-[10px] font-bold">
                                                <div className="flex items-center gap-1.5"><Calendar size={10} /> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5"><Clock size={10} /> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${isReturn ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                            {tx.type}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="p-1.5 bg-white rounded-lg text-slate-400 border border-slate-100">
                                                <UserIcon size={12} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-slate-800 truncate uppercase">{tx.customerName || 'Standard Client'}</p>
                                            </div>
                                        </div>
                                        {!isReturn && (
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md shadow-inner border ${isFullyPaid ? 'bg-teal-50 text-teal-600 border-teal-100' : isPartial ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                {isFullyPaid ? 'Paid' : isPartial ? 'Partial' : 'Credit'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto flex justify-between items-center">
                                        <span className="bg-slate-100 px-3 py-1 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">{fd(tx.quantity)} units</span>
                                        <div className="text-right">
                                            <p className={`text-lg font-black tracking-tight ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>₹{amount.toLocaleString()}</p>
                                            {!isReturn && !isFullyPaid && <p className="text-[8px] font-bold text-rose-500 uppercase tracking-tighter">Bal: ₹{(amount - paid).toLocaleString()}</p>}
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
                                    className="p-6 rounded-[2.25rem] bg-white border border-slate-200 shadow-soft active:scale-[0.98] transition-all cursor-pointer group relative animate-fade-in"
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${isReturn ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                                    {isReturn ? <Undo2 size={14}/> : <PlusCircle size={14}/>}
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${isReturn ? 'text-rose-500' : 'text-teal-600'}`}>
                                                    {bill.type} Bill
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 flex flex-col gap-1 uppercase tracking-widest">
                                                <div className="flex items-center gap-2"><Calendar size={10}/> {new Date(bill.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-200" />
                                    </div>
                                    <div className="mb-6">
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Entity Target</p>
                                        <div className="font-black text-base text-slate-900 leading-tight truncate uppercase tracking-tight">
                                            {bill.customerName || 'Standard Checkout'}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto">
                                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                                            <Package size={12} className="text-slate-400"/>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{fd(bill.items.length)} Parts</span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-[18px] font-black tracking-tighter tabular-nums ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>
                                                ₹{bill.totalAmount.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                      ) : (
                        customerHistory.map(cust => {
                          const isFullySettled = cust.totalPaid >= cust.totalSpent;
                          const balance = cust.totalSpent - cust.totalPaid;
                          const isAdvance = balance < 0;

                          return (
                            <div 
                                key={cust.name} 
                                onClick={() => setSelectedCustomer(cust)}
                                className="p-6 rounded-[2.25rem] bg-white border border-slate-200 shadow-soft active:scale-[0.98] transition-all cursor-pointer group animate-fade-in relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-24 h-full bg-brand-500/[0.01] -skew-x-12 translate-x-12"></div>
                                <div className="flex justify-between items-start mb-8">
                                    <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                        <UserIcon size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">{isAdvance ? 'Advance Credit' : 'Balance'}</p>
                                        <p className={`text-xl font-black tracking-tighter ${isAdvance ? 'text-teal-600' : balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                            ₹{Math.abs(balance).toLocaleString()}{isAdvance ? ' +' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="mb-6">
                                    <h3 className="font-black text-base text-slate-900 uppercase tracking-tight leading-tight truncate pr-4">{cust.name}</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[8px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded shadow-sm border border-brand-100 uppercase tracking-widest">{fd(cust.transactions.length)} Trans</span>
                                    </div>
                                </div>
                                <div className="pt-5 border-t border-slate-50 flex items-center justify-between relative z-10">
                                    <div className={`text-[9px] font-black uppercase tracking-widest ${isAdvance ? 'text-teal-600 font-black' : isFullySettled ? 'text-slate-400' : 'text-rose-500'}`}>
                                        {isAdvance ? 'CREDIT BALANCE' : isFullySettled ? 'Settled' : 'Unpaid Dues'}
                                    </div>
                                    <ChevronRight size={16} className="text-slate-200" />
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
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center animate-fade-in">
              <div className="bg-white w-full rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedBill(null)} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={20}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-base tracking-tight leading-none mb-1.5 uppercase truncate max-w-[180px]">{selectedBill.customerName || 'Cash Bill'}</h3>
                              <div className="flex items-center gap-2 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                  <Calendar size={10}/> {new Date(selectedBill.createdAt).toLocaleDateString()}
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-4">
                      {selectedBill.items.map((item, idx) => {
                          const isItemFullyPaid = item.paidAmount >= (item.price * item.quantity);
                          const isOpeningPayment = isAddingPayment === item.id;

                          return (
                            <div key={item.id} className="p-5 bg-slate-50/50 rounded-[1.75rem] border border-slate-100 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-white rounded-xl border border-slate-100 flex items-center justify-center font-black text-slate-300 text-xs">{fd(idx + 1)}</div>
                                        <div>
                                            <div className="font-black text-slate-900 text-base leading-tight tracking-tight uppercase">{item.partNumber}</div>
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Rate: ₹{item.price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-300 uppercase mb-0.5">Qty</p>
                                        <p className="text-lg font-black text-slate-900">{fd(item.quantity)}</p>
                                    </div>
                                </div>

                                {selectedBill.type !== 'RETURN' && (
                                    <div className="pt-4 border-t border-white flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Collected</p>
                                            <p className={`font-black text-sm ${isItemFullyPaid ? 'text-teal-600' : 'text-amber-600'}`}>₹{(item.paidAmount || 0).toLocaleString()}</p>
                                        </div>
                                        
                                        {isOpeningPayment ? (
                                            <div className="flex items-center gap-2 animate-slide-up">
                                                <input 
                                                    autoFocus
                                                    type="number" 
                                                    className="flex-1 pl-4 pr-3 py-3 bg-white border border-brand-200 rounded-xl text-sm font-black outline-none shadow-inner-soft"
                                                    placeholder="Amt"
                                                    value={newPaidVal}
                                                    onChange={e => setNewPaidVal(e.target.value)}
                                                />
                                                <button 
                                                    onClick={() => handleRegisterPayment(item.id)}
                                                    disabled={submittingPayment}
                                                    className="px-5 py-3 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95"
                                                >
                                                    {submittingPayment ? <Loader2 size={14} className="animate-spin"/> : 'Confirm'}
                                                </button>
                                                <button onClick={() => setIsAddingPayment(null)} className="p-2 text-slate-300"><X size={18}/></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => {
                                                    setIsAddingPayment(item.id);
                                                    setNewPaidVal(item.paidAmount.toString());
                                                }}
                                                className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border ${isItemFullyPaid ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-brand-50 text-brand-600 border-brand-100'}`}
                                            >
                                                <PlusCircle size={12}/> {isItemFullyPaid ? 'Adjust Payment' : 'Collect Balance'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                          )
                      })}
                  </div>
                  <div className="p-6 border-t border-slate-100 bg-white pb-safe">
                      <div className="flex justify-between items-center mb-6">
                          <div className="flex flex-col">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Final Total</p>
                              <p className={`text-3xl font-black tracking-tighter tabular-nums ${selectedBill.type === 'RETURN' ? 'text-rose-600' : 'text-slate-900'}`}>
                                  ₹{selectedBill.totalAmount.toLocaleString()}
                              </p>
                          </div>
                          <button onClick={() => setSelectedBill(null)} className="px-10 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl active:scale-95 text-[11px] uppercase tracking-widest">Close</button>
                      </div>
                  </div>
              </div>
          </div>
       )}

       {/* CUSTOMER LEDGER MODAL */}
       {selectedCustomer && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end md:items-center justify-center animate-fade-in md:p-10">
              <div className="bg-white w-full max-w-4xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
                  <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/40 gap-6">
                      <div className="flex items-center gap-5">
                          <button onClick={() => setSelectedCustomer(null)} className="p-3 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={22}/></button>
                          <div>
                              <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none mb-1.5 uppercase truncate max-w-[280px]">{selectedCustomer.name}</h3>
                              <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                  <Clock size={12}/> Last Purchase: {new Date(selectedCustomer.lastPurchase).toLocaleDateString()}
                              </div>
                          </div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => handleExportCustomerLedger(selectedCustomer)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        >
                            <FileSpreadsheet size={16} className="text-teal-600" /> Export Ledger
                        </button>
                        <button 
                            onClick={() => handleExportCustomerPendingDues(selectedCustomer)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 shadow-sm"
                        >
                            <AlertCircle size={16} /> Export Dues
                        </button>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50/20 border-b border-slate-100">
                    <div className="p-6 border-r border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Spent</p>
                        <p className="text-2xl font-black text-slate-900">₹{selectedCustomer.totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="p-6 border-r border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Paid</p>
                        <p className="text-2xl font-black text-teal-600">₹{selectedCustomer.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-rose-50/30">
                        <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Outstanding Balance</p>
                        <p className="text-2xl font-black text-rose-600">₹{(selectedCustomer.totalSpent - selectedCustomer.totalPaid).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar space-y-4">
                      <div className="hidden md:grid grid-cols-6 gap-4 px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest mb-4">
                         <div className="col-span-1">Date</div>
                         <div className="col-span-2">Part & Description</div>
                         <div className="col-span-1 text-center">Type</div>
                         <div className="col-span-1 text-right">Value</div>
                         <div className="col-span-1 text-right">Balance</div>
                      </div>
                      
                      {selectedCustomer.transactions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item) => {
                          const isReturn = item.type === TransactionType.RETURN;
                          const total = item.price * item.quantity;
                          const balance = total - (item.paidAmount || 0);
                          const isFullyPaid = balance <= 0;
                          const isAddingToThis = isAddingPayment === item.id;

                          return (
                            <div key={item.id} className="p-5 bg-white border border-slate-100 rounded-[1.75rem] shadow-soft hover:shadow-premium transition-all">
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:items-center">
                                    <div className="col-span-1 flex items-center gap-3">
                                        <div className="p-2 bg-slate-50 rounded-lg md:hidden"><Calendar size={14} className="text-slate-400" /></div>
                                        <span className="text-[11px] font-bold text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="font-black text-slate-900 text-sm md:text-base uppercase tracking-tight">{item.partNumber}</p>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty: {fd(item.quantity)} @ ₹{item.price.toLocaleString()}</span>
                                    </div>
                                    <div className="col-span-1 flex md:justify-center">
                                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${isReturn ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                            {item.type}
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <p className={`font-black text-sm md:text-base ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>₹{total.toLocaleString()}</p>
                                    </div>
                                    <div className="col-span-1 flex flex-col items-end">
                                        {!isReturn ? (
                                           <>
                                              <span className={`text-[10px] font-black uppercase tracking-tighter ${isFullyPaid ? 'text-teal-600' : 'text-rose-600'}`}>
                                                 {isFullyPaid ? 'Settled' : `Owed: ₹${balance.toLocaleString()}`}
                                              </span>
                                              {!isFullyPaid && !isAddingToThis && (
                                                <button 
                                                    onClick={() => { setIsAddingPayment(item.id); setNewPaidVal(item.paidAmount.toString()); }}
                                                    className="mt-2 text-[8px] font-black text-blue-600 uppercase border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-50 transition-all"
                                                >
                                                    Register Payment
                                                </button>
                                              )}
                                              {isAddingToThis && (
                                                <div className="mt-2 flex items-center gap-2 animate-slide-up">
                                                    <input 
                                                        autoFocus
                                                        type="number"
                                                        className="w-20 px-2 py-1 bg-slate-100 border border-brand-200 rounded text-xs font-black outline-none"
                                                        value={newPaidVal}
                                                        onChange={e => setNewPaidVal(e.target.value)}
                                                    />
                                                    <button onClick={() => handleRegisterPayment(item.id)} className="p-1 bg-brand-600 text-white rounded"><Check size={12} strokeWidth={4}/></button>
                                                    <button onClick={() => setIsAddingPayment(null)} className="p-1 text-slate-300"><X size={12}/></button>
                                                </div>
                                              )}
                                           </>
                                        ) : <span className="text-[10px] font-black text-slate-300 uppercase">N/A</span>}
                                    </div>
                                </div>
                            </div>
                          )
                      })}
                  </div>
                  <div className="p-8 border-t border-slate-100 bg-white pb-safe flex justify-end">
                      <button onClick={() => setSelectedCustomer(null)} className="px-12 py-4 bg-slate-900 text-white font-black rounded-[1.5rem] active:scale-95 text-xs uppercase tracking-widest shadow-xl">Close Terminal</button>
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