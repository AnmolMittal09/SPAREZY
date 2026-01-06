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
  ChevronDown,
  X,
  Layers,
  List,
  ChevronRight,
  Package,
  ArrowLeft,
  Users,
  FileDown,
  FileSpreadsheet,
  Check,
  RefreshCw
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

    return result;
  }, [history, historySearch]);

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
         createdByName: user.name, 
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

  return (
    <div className="h-full flex flex-col bg-slate-50 md:bg-transparent">
       
       {!isSearchingOnMobile && (
         <div className="md:hidden bg-white p-3 border-b border-slate-100 z-20 sticky top-0 shadow-sm animate-fade-in">
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
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-3xl shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden no-scrollbar pb-32">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-10">
                   <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-inner"><Undo2 size={22} /></div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-[13px] uppercase tracking-wider">Stock Return</span>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg mt-1 w-fit">
                            <button onClick={() => setReturnViewMode('RECENT')} className={`px-4 py-1 rounded-md text-[8px] font-black uppercase transition-all ${returnViewMode === 'RECENT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Recent</button>
                            <button onClick={() => setReturnViewMode('BY_CUSTOMER')} className={`px-4 py-1 rounded-md text-[8px] font-black uppercase transition-all ${returnViewMode === 'BY_CUSTOMER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Customers</button>
                        </div>
                      </div>
                   </div>
                   <div className="w-full md:w-auto flex-1 md:max-w-xs relative px-1">
                       <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                       <input 
                          type="text" 
                          placeholder="Search Item or Client..."
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold shadow-inner-soft focus:ring-8 focus:ring-rose-500/5 outline-none transition-all uppercase tracking-tight"
                          value={returnSearch}
                          onChange={e => setReturnSearch(e.target.value)}
                       />
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
                   {loading ? (
                      <div className="flex justify-center p-12"><TharLoader /></div>
                   ) : (returnViewMode === 'RECENT' ? filteredSalesLog : groupedReturnsByCustomer).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                         <AlertCircle size={64} className="mb-4 opacity-10" />
                         <p className="font-black text-[10px] uppercase tracking-[0.4em]">No returnable entries</p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                        {returnViewMode === 'RECENT' ? (
                          filteredSalesLog.map(tx => {
                              const isSelected = !!selectedReturns[tx.id];
                              const prevReturned = alreadyReturnedMap.get(tx.id) || 0;
                              const remainingQty = tx.quantity - prevReturned;
                              const returnQty = selectedReturns[tx.id] || remainingQty;
                              const part = inventory.find(i => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());
                              
                              return (
                                  <div 
                                      key={tx.id} 
                                      onClick={() => handleReturnToggle(tx)}
                                      className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer bg-white relative overflow-hidden group ${isSelected ? 'border-rose-500 ring-8 ring-rose-500/5 shadow-xl' : 'border-slate-100 hover:border-slate-200 shadow-soft'}`}
                                  >
                                      <div className="flex justify-between items-start mb-5 relative z-10">
                                          <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-rose-500 border-rose-500 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-transparent'}`}>
                                              <CheckCircle2 size={18} strokeWidth={3} />
                                          </div>
                                          <div className="text-right">
                                              <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">TX DATE</div>
                                              <div className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{new Date(tx.createdAt).toLocaleDateString()}</div>
                                          </div>
                                      </div>

                                      <div className="mb-6 relative z-10 px-1">
                                          <div className="font-black text-lg text-slate-900 leading-none uppercase tracking-tight mb-2 group-hover:text-rose-600 transition-colors">{tx.partNumber}</div>
                                          {part && <div className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tight">{part.name}</div>}
                                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 mt-4">
                                              <UserIcon size={14} className="text-slate-300" /> 
                                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight truncate max-w-[150px]">{tx.customerName || 'Walk-in'}</span>
                                          </div>
                                      </div>

                                      <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto relative z-10">
                                          <div className="space-y-1.5">
                                              <div className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">STOCK DATA</div>
                                              <div className="font-black text-slate-900 text-base tabular-nums">{fd(tx.quantity)} <span className="text-[9px] text-slate-400 ml-1">SOLD</span></div>
                                              <div className="text-[9px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md inline-block border border-teal-100/50 shadow-inner">REM: {fd(remainingQty)}</div>
                                          </div>

                                          {isSelected && (
                                              <div onClick={e => e.stopPropagation()} className="bg-rose-50 p-3 rounded-2xl border border-rose-100 flex flex-col items-center shadow-lg animate-slide-up">
                                                  <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-2">QTY RETURN</span>
                                                  <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-inner-soft">
                                                      <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (returnQty - 1).toString())} className="w-9 h-9 rounded-lg flex items-center justify-center text-rose-500 active:scale-90 transition-all"><Minus size={16} strokeWidth={4}/></button>
                                                      <span className="font-black text-slate-900 text-lg min-w-[24px] text-center tabular-nums">{fd(returnQty)}</span>
                                                      <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (returnQty + 1).toString())} className="w-9 h-9 bg-rose-500 text-white rounded-lg flex items-center justify-center active:scale-90 shadow-lg transition-all"><Plus size={16} strokeWidth={4}/></button>
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
                              <div key={customer.name} className="col-span-1 md:col-span-2 lg:col-span-3 px-1">
                                <div 
                                  onClick={() => setExpandedCustomerReturn(isExpanded ? null : customer.name)}
                                  className={`p-6 rounded-[2rem] border-2 bg-white shadow-soft flex items-center justify-between cursor-pointer transition-all ${isExpanded ? 'border-rose-400 bg-rose-50/20' : 'border-slate-100'}`}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                      <UserIcon size={22} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                      <h3 className="font-black text-base text-slate-900 uppercase tracking-tight leading-tight">{customer.name}</h3>
                                      <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded shadow-inner uppercase tracking-widest">{fd(customer.transactions.length)} ASSETS</span>
                                        {selectedCount > 0 && <span className="text-[8px] font-black text-white bg-rose-600 px-2 py-0.5 rounded shadow-lg uppercase tracking-widest">{fd(selectedCount)} MARKED</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronDown size={22} className={`text-slate-300 transition-transform duration-500 ${isExpanded ? 'rotate-180 text-rose-500' : ''}`} />
                                </div>

                                {isExpanded && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 animate-fade-in p-1">
                                    {customer.transactions.map(tx => {
                                      const isSelected = !!selectedReturns[tx.id];
                                      const prevReturned = alreadyReturnedMap.get(tx.id) || 0;
                                      const remainingQty = tx.quantity - prevReturned;
                                      const returnQty = selectedReturns[tx.id] || remainingQty;
                                      const part = inventory.find(i => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());

                                      return (
                                        <div 
                                          key={tx.id} 
                                          onClick={() => handleReturnToggle(tx)}
                                          className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer bg-white relative group ${isSelected ? 'border-rose-500 ring-8 ring-rose-500/5 shadow-xl' : 'border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <div className="flex justify-between items-start mb-5">
                                                <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-rose-500 border-rose-500 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-transparent'}`}>
                                                    <CheckCircle2 size={18} strokeWidth={3} />
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">TX DATE</div>
                                                    <div className="text-[12px] font-black text-slate-900">{new Date(tx.createdAt).toLocaleDateString()}</div>
                                                </div>
                                            </div>

                                            <div className="mb-6 px-1">
                                                <div className="font-black text-lg text-slate-900 leading-none uppercase tracking-tight mb-2">{tx.partNumber}</div>
                                                {part && <div className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tight">{part.name}</div>}
                                                <p className="text-[10px] font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl w-fit uppercase tracking-widest mt-4">Unit: ₹{tx.price.toLocaleString()}</p>
                                            </div>

                                            <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto relative z-10">
                                                <div className="space-y-1.5">
                                                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">STK AVL</div>
                                                    <div className="font-black text-slate-900 text-base tabular-nums">{fd(remainingQty)} <span className="text-[9px] text-slate-400 uppercase ml-1">PCS</span></div>
                                                </div>

                                                {isSelected && (
                                                    <div onClick={e => e.stopPropagation()} className="bg-rose-50 p-3 rounded-2xl border border-rose-100 flex flex-col items-center shadow-lg animate-slide-up">
                                                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-2">RETURN</span>
                                                        <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-inner-soft">
                                                            <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (returnQty - 1).toString())} className="w-9 h-9 rounded-lg flex items-center justify-center text-rose-500 active:scale-90 transition-all"><Minus size={16} strokeWidth={4}/></button>
                                                            <span className="font-black text-slate-900 min-w-[24px] text-center tabular-nums">{fd(returnQty)}</span>
                                                            <button onClick={() => handleReturnQtyChange(tx.id, remainingQty, (returnQty + 1).toString())} className="w-9 h-9 bg-rose-500 text-white rounded-lg flex items-center justify-center active:scale-90 shadow-lg transition-all"><Plus size={16} strokeWidth={4}/></button>
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

                <div className="fixed bottom-0 md:bottom-6 left-0 md:left-auto right-0 md:right-8 bg-white/95 backdrop-blur-3xl md:rounded-[2.5rem] border-t md:border border-slate-200/60 p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] md:shadow-2xl z-[90] pb-safe flex justify-between items-center md:min-w-[450px] animate-slide-up rounded-t-[3rem]">
                   <div className="flex-1 min-w-0 pr-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Refund Net ({fd(Object.keys(selectedReturns).length)})</p>
                      <p className="text-3xl font-black text-rose-600 tracking-tighter leading-tight tabular-nums truncate">₹{totalRefundAmount.toLocaleString()}</p>
                   </div>

                   <button 
                      onClick={() => setShowReturnConfirm(true)}
                      disabled={Object.keys(selectedReturns).length === 0 || processingReturns}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-rose-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-30 disabled:shadow-none uppercase text-sm tracking-widest border border-white/10"
                   >
                      {processingReturns ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} strokeWidth={2.5} />}
                      COMMIT
                   </button>
                </div>
             </div>
          )}

          {activeTab === 'HISTORY' && (
             <div className="bg-[#F8FAFC] md:bg-white md:rounded-3xl shadow-soft border border-slate-100 flex flex-col h-full overflow-hidden no-scrollbar pb-32">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-white flex flex-col lg:flex-row justify-between items-center gap-4 sticky top-0 z-10">
                   <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg"><History size={22} /></div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-[13px] uppercase tracking-wider">Audit History</span>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg mt-1 w-fit">
                            <button onClick={() => setViewMode('STACKED')} className={`px-4 py-1 rounded-md text-[8px] font-black uppercase transition-all ${viewMode === 'STACKED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Stacked</button>
                            <button onClick={() => setViewMode('LIST')} className={`px-4 py-1 rounded-md text-[8px] font-black uppercase transition-all ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>List</button>
                            <button onClick={() => setViewMode('CUSTOMER')} className={`px-4 py-1 rounded-md text-[8px] font-black uppercase transition-all ${viewMode === 'CUSTOMER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Accounts</button>
                        </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2 w-full md:w-auto px-1 overflow-x-auto no-scrollbar">
                      <button 
                        onClick={handleExportPendingPayments}
                        className="p-3 rounded-2xl bg-white border border-slate-200 text-amber-600 hover:bg-amber-50 transition-all shadow-soft active:scale-95 flex items-center justify-center"
                        title="Export All Pending Collections"
                      >
                        <FileDown size={22} />
                      </button>

                      <div className="relative flex-1 md:w-64">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                         <input 
                           type="text" 
                           placeholder="Filter History..." 
                           className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold shadow-inner-soft focus:ring-8 focus:ring-slate-500/5 outline-none transition-all uppercase tracking-tight"
                           value={historySearch}
                           onChange={e => setHistorySearch(e.target.value)}
                         />
                      </div>
                      <button 
                        onClick={loadHistory}
                        className="p-3 bg-white text-slate-400 border border-slate-200 rounded-2xl hover:text-slate-900 transition-all shadow-soft active:rotate-90"
                      >
                         <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
                      </button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar pb-32">
                  {loading ? (
                    <div className="flex justify-center p-12"><TharLoader /></div>
                  ) : (viewMode === 'LIST' ? sortedListHistory : viewMode === 'STACKED' ? stackedHistory : customerHistory).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                        <AlertCircle size={64} className="mb-4 opacity-10" />
                        <p className="font-black text-[10px] uppercase tracking-[0.4em]">Registry Empty</p>
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
                            const part = inventory.find(i => i.partNumber.toLowerCase() === tx.partNumber.toLowerCase());

                            return (
                                <div key={tx.id} className="p-6 rounded-[2rem] bg-white border-2 border-slate-100 shadow-soft flex flex-col animate-fade-in relative group overflow-hidden">
                                    <div className="flex justify-between items-start mb-5 relative z-10">
                                        <div className="space-y-1">
                                            <div className="font-black text-slate-900 text-lg leading-tight uppercase tracking-tight group-hover:text-brand-600 transition-colors">{tx.partNumber}</div>
                                            {part && <div className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tight">{part.name}</div>}
                                            <div className="flex flex-col text-slate-400 text-[9px] font-black mt-3 gap-1 uppercase tracking-widest">
                                                <div className="flex items-center gap-2"><Calendar size={12} className="opacity-40" /> {new Date(tx.createdAt).toLocaleDateString()}</div>
                                                <div className="flex items-center gap-2"><Clock size={12} className="opacity-40" /> {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                <div className="flex items-center gap-2 text-blue-600"><UserIcon size={12} className="opacity-40" /> Terminal: {tx.createdByName}</div>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-sm border ${isReturn ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                            {tx.type}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between mb-6 relative z-10">
                                        <div className="flex items-center gap-3 min-w-0 pr-4">
                                            <div className="p-2 bg-white rounded-xl text-slate-400 shadow-inner border border-slate-200">
                                                <UserIcon size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{tx.customerName || 'Standard Client'}</p>
                                            </div>
                                        </div>
                                        {!isReturn && (
                                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg shadow-sm border whitespace-nowrap ${isFullyPaid ? 'bg-teal-600 text-white border-teal-700' : isPartial ? 'bg-amber-500 text-white border-amber-600' : 'bg-rose-600 text-white border-rose-700'}`}>
                                                {isFullyPaid ? 'Settled' : isPartial ? 'Partial' : 'Credit'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto flex justify-between items-end relative z-10 border-t border-slate-50 pt-5">
                                        <span className="bg-slate-100 px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200 shadow-inner">{fd(tx.quantity)} PCS</span>
                                        <div className="text-right">
                                            <p className={`text-2xl font-black tracking-tighter leading-none tabular-nums ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>₹{amount.toLocaleString()}</p>
                                            {!isReturn && !isFullyPaid && <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-1">Due: ₹{(amount - paid).toLocaleString()}</p>}
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
                                    className="p-6 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-soft active:scale-[0.98] transition-all cursor-pointer group relative animate-fade-in overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl shadow-lg ${isReturn ? 'bg-rose-600 text-white' : 'bg-brand-600 text-white'}`}>
                                                    {isReturn ? <Undo2 size={16} strokeWidth={3}/> : <PlusCircle size={16} strokeWidth={3}/>}
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isReturn ? 'text-rose-600' : 'text-brand-600'}`}>
                                                    {bill.type} MATRIX
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-black text-slate-400 flex items-center gap-3 uppercase tracking-widest ml-1">
                                                <div className="flex items-center gap-2"><Calendar size={12}/> {new Date(bill.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div className="p-2.5 bg-slate-50 rounded-2xl text-slate-300 border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner-soft">
                                            <ChevronRight size={22} strokeWidth={3} />
                                        </div>
                                    </div>
                                    <div className="mb-8 relative z-10 px-1">
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 opacity-60">TARGET ACCOUNT</p>
                                        <div className="font-black text-xl text-slate-900 leading-tight truncate uppercase tracking-tight">
                                            {bill.customerName || 'Standard Terminal'}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end border-t border-slate-50 pt-5 mt-auto relative z-10">
                                        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-3 shadow-inner-soft">
                                            <Package size={16} className="text-slate-400"/>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{fd(bill.items.length)} ASSETS</span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-2xl font-black tracking-tighter tabular-nums leading-none ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>
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
                                className="p-7 rounded-[2.5rem] bg-white border-2 border-slate-100 shadow-soft active:scale-[0.98] transition-all cursor-pointer group animate-fade-in relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-full bg-brand-500/[0.02] -skew-x-12 translate-x-16 group-hover:translate-x-12 transition-transform"></div>
                                <div className="flex justify-between items-start mb-10 relative z-10">
                                    <div className="w-14 h-14 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-slate-200 ring-4 ring-white">
                                        <UserIcon size={24} strokeWidth={2.5} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 opacity-70">{isAdvance ? 'CREDIT ASSET' : 'LEDGER BAL'}</p>
                                        <p className={`text-2xl font-black tracking-tighter tabular-nums leading-none ${isAdvance ? 'text-teal-600' : balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                            ₹{Math.abs(balance).toLocaleString()}{isAdvance ? ' +' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="mb-8 relative z-10 px-1">
                                    <h3 className="font-black text-[18px] text-slate-900 uppercase tracking-tight leading-tight truncate pr-6">{cust.name}</h3>
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="text-[9px] font-black text-brand-600 bg-brand-50 px-3 py-1 rounded-xl shadow-inner border border-brand-100 uppercase tracking-widest">{fd(cust.transactions.length)} LOGS</span>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-slate-100 flex items-center justify-between relative z-10">
                                    <div className={`text-[10px] font-black uppercase tracking-widest ${isAdvance ? 'text-teal-600' : isFullySettled ? 'text-slate-400' : 'text-rose-500'}`}>
                                        {isAdvance ? 'REVENUE POSITIVE' : isFullySettled ? 'Account Settled' : 'Unpaid Liability'}
                                    </div>
                                    <ChevronRight size={20} className="text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
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
          <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-end justify-center animate-fade-in no-scrollbar">
              <div className="bg-white w-full rounded-t-[3rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-slide-up pb-safe">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4">
                          <button onClick={() => setSelectedBill(null)} className="p-3 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={22} strokeWidth={3}/></button>
                          <div className="min-w-0">
                              <h3 className="font-black text-slate-900 text-lg tracking-tight leading-none mb-2 uppercase truncate max-w-[200px]">{selectedBill.customerName || 'Standard Client'}</h3>
                              <div className="flex items-center gap-3 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                  <Calendar size={12} className="opacity-50"/> {new Date(selectedBill.createdAt).toLocaleDateString()}
                                  <span className="opacity-30">•</span>
                                  <UserIcon size={12} className="opacity-50"/> {selectedBill.items[0]?.createdByName}
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 no-scrollbar space-y-4 bg-slate-50/30">
                      {selectedBill.items.map((item, idx) => {
                          const isItemFullyPaid = item.paidAmount >= (item.price * item.quantity);
                          const isOpeningPayment = isAddingPayment === item.id;
                          const part = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());

                          return (
                            <div key={item.id} className="p-6 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-soft flex flex-col gap-5 animate-fade-in">
                                <div className="flex justify-between items-start relative">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center font-black text-slate-300 text-xs shadow-inner-soft">{fd(idx + 1)}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-black text-slate-900 text-lg leading-tight tracking-tight uppercase mb-1 truncate">{item.partNumber}</div>
                                            {part && <div className="text-[11px] text-slate-400 font-bold uppercase truncate tracking-tight">{part.name}</div>}
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-3">Net: ₹{item.price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-none ml-4">
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">QTY</p>
                                        <p className="text-2xl font-black text-slate-900 leading-none tabular-nums">{fd(item.quantity)}</p>
                                    </div>
                                </div>

                                {selectedBill.type !== 'RETURN' && (
                                    <div className="pt-6 border-t border-slate-50 flex flex-col gap-5">
                                        <div className="flex items-center justify-between px-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">REVENUE REALIZED</p>
                                            <p className={`font-black text-lg tabular-nums leading-none ${isItemFullyPaid ? 'text-teal-600' : 'text-amber-600'}`}>₹{(item.paidAmount || 0).toLocaleString()}</p>
                                        </div>
                                        
                                        {isOpeningPayment ? (
                                            <div className="flex items-center gap-3 animate-slide-up bg-slate-100 p-2 rounded-2xl border border-slate-200">
                                                <input 
                                                    autoFocus
                                                    type="number" 
                                                    className="flex-1 pl-5 pr-3 py-4 bg-white border-2 border-brand-200 rounded-xl text-base font-black outline-none shadow-inner-soft tracking-tight focus:ring-8 focus:ring-brand-500/5 transition-all"
                                                    placeholder="Input Amt..."
                                                    value={newPaidVal}
                                                    onChange={e => setNewPaidVal(e.target.value)}
                                                />
                                                <button 
                                                    onClick={() => handleRegisterPayment(item.id)}
                                                    disabled={submittingPayment}
                                                    className="w-14 h-14 bg-brand-600 text-white rounded-xl shadow-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                                                >
                                                    {submittingPayment ? <Loader2 size={22} className="animate-spin"/> : <Check size={26} strokeWidth={4}/>}
                                                </button>
                                                <button onClick={() => setIsAddingPayment(null)} className="p-3 text-slate-400 active:scale-90"><X size={24}/></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => {
                                                    setIsAddingPayment(item.id);
                                                    setNewPaidVal(item.paidAmount.toString());
                                                }}
                                                className={`w-full py-5 rounded-[1.75rem] text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] border-2 ${isItemFullyPaid ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-brand-50 text-brand-600 border-brand-200 shadow-xl shadow-brand-100'}`}
                                            >
                                                <PlusCircle size={18} strokeWidth={2.5}/> {isItemFullyPaid ? 'ADJUST REVENUE' : 'COLLECT ASSET'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                          )
                      })}
                  </div>
                  <div className="p-8 border-t border-slate-100 bg-white">
                      <div className="flex justify-between items-center mb-8">
                          <div className="flex flex-col">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">NET TRANSACTION</p>
                              <p className={`text-4xl font-black tracking-tighter leading-none tabular-nums ${selectedBill.type === 'RETURN' ? 'text-rose-600' : 'text-slate-900'}`}>
                                  ₹{selectedBill.totalAmount.toLocaleString()}
                              </p>
                          </div>
                          <button onClick={() => setSelectedBill(null)} className="px-12 py-5 bg-slate-900 text-white font-black rounded-2xl active:scale-[0.98] transition-all text-[13px] uppercase tracking-widest shadow-xl border border-white/10">Close Log</button>
                      </div>
                  </div>
              </div>
          </div>
       )}

       {selectedCustomer && (
          <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-end md:items-center justify-center animate-fade-in md:p-10 no-scrollbar">
              <div className="bg-white w-full max-w-5xl rounded-t-[3rem] md:rounded-[3rem] shadow-2xl flex flex-col h-[95vh] md:max-h-[90vh] overflow-hidden animate-slide-up pb-safe">
                  <div className="p-6 md:p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/40 gap-6">
                      <div className="flex items-center gap-5">
                          <button onClick={() => setSelectedCustomer(null)} className="p-3.5 bg-white text-slate-400 rounded-2xl shadow-soft border border-slate-100 active:scale-90 transition-all"><ArrowLeft size={24} strokeWidth={3}/></button>
                          <div className="min-w-0">
                              <h3 className="font-black text-slate-900 text-2xl md:text-3xl tracking-tighter leading-none mb-2 uppercase truncate max-w-[250px]">{selectedCustomer.name}</h3>
                              <div className="flex items-center gap-3 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest">
                                  <Clock size={14} className="opacity-50"/> Last TX: {new Date(selectedCustomer.lastPurchase).toLocaleDateString()}
                              </div>
                          </div>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => handleExportCustomerLedger(selectedCustomer)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-soft"
                        >
                            <FileSpreadsheet size={20} className="text-teal-600" /> Export Ledger
                        </button>
                        <button 
                            onClick={() => handleExportCustomerPendingDues(selectedCustomer)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 shadow-soft"
                        >
                            <AlertCircle size={20} /> Dues Report
                        </button>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50/20 border-b border-slate-100">
                    <div className="p-6 md:p-8 border-r border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-70">LIFETIME REVENUE</p>
                        <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter tabular-nums">₹{selectedCustomer.totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="p-6 md:p-8 border-r border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 opacity-70">REVENUE COLLECTED</p>
                        <p className="text-2xl md:text-3xl font-black text-teal-600 tracking-tighter tabular-nums">₹{selectedCustomer.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="p-6 md:p-8 bg-rose-50/30">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 opacity-70">OUTSTANDING DUEX</p>
                        <p className="text-2xl md:text-3xl font-black text-rose-600 tracking-tighter tabular-nums">₹{(selectedCustomer.totalSpent - selectedCustomer.totalPaid).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-10 no-scrollbar space-y-6">
                      <div className="hidden md:grid grid-cols-7 gap-6 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest mb-6 sticky top-0 z-10 shadow-xl">
                         <div className="col-span-1">Timestamp</div>
                         <div className="col-span-2">Spare Description</div>
                         <div className="col-span-1 text-center">Protocol</div>
                         <div className="col-span-1 text-right">Value</div>
                         <div className="col-span-1 text-right">Running Net</div>
                         <div className="col-span-1 text-right">Commit</div>
                      </div>
                      
                      {(() => {
                        let currentRunningBal = 0;
                        const sortedChronological = [...selectedCustomer.transactions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                        const txWithBal = sortedChronological.map(tx => {
                            const val = tx.price * tx.quantity;
                            const paid = tx.paidAmount || 0;
                            const netImpact = tx.type === TransactionType.SALE ? (val - paid) : -(val - paid);
                            currentRunningBal += netImpact;
                            return { ...tx, runningBalance: currentRunningBal };
                        });
                        return txWithBal.reverse();
                      })().map((item) => {
                          const isReturn = item.type === TransactionType.RETURN;
                          const total = item.price * item.quantity;
                          const balance = total - (item.paidAmount || 0);
                          const isFullyPaid = balance <= 0;
                          const isOverdue = !isReturn && !isFullyPaid;
                          const isAddingToThis = isAddingPayment === item.id;
                          const part = inventory.find(i => i.partNumber.toLowerCase() === item.partNumber.toLowerCase());

                          return (
                            <div key={item.id} className={`p-6 border-2 rounded-[2.5rem] shadow-soft hover:shadow-premium transition-all relative overflow-hidden group/item ${isOverdue ? 'bg-rose-50/20 border-rose-100 ring-4 ring-rose-500/5' : 'bg-white border-slate-100'}`}>
                                {isOverdue && <div className="absolute top-0 right-0 bg-rose-600 text-white px-4 py-1.5 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest animate-pulse shadow-lg z-10">UNPAID OVERDUE</div>}
                                <div className="grid grid-cols-1 md:grid-cols-7 gap-6 md:items-center relative z-10">
                                    <div className="col-span-1 flex items-center gap-4">
                                        <div className="p-3 bg-slate-50 rounded-2xl md:hidden border border-slate-100 shadow-inner-soft"><Calendar size={18} className="text-slate-400" /></div>
                                        <span className="text-[12px] font-black text-slate-500 tabular-nums">{new Date(item.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="col-span-2 min-w-0">
                                        <p className="font-black text-slate-900 text-base md:text-lg uppercase tracking-tight truncate leading-tight group-hover/item:text-brand-600 transition-colors">{item.partNumber}</p>
                                        {part && <p className="text-[11px] text-slate-400 font-bold uppercase truncate pr-6 mt-1.5 tracking-tight">{part.name}</p>}
                                        <div className="flex items-center gap-3 mt-3">
                                          <span className="text-[9px] font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl shadow-inner border border-slate-200 uppercase tracking-widest">{fd(item.quantity)} PCS @ ₹{item.price.toLocaleString()}</span>
                                          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter ml-1">Terminal: {item.createdByName}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-1 flex md:justify-center">
                                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm ${isReturn ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                            {item.type}
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <p className={`font-black text-lg md:text-xl tabular-nums leading-none ${isReturn ? 'text-rose-600' : 'text-slate-900'}`}>₹{total.toLocaleString()}</p>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 inline-block opacity-60">Paid: ₹{(item.paidAmount || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="col-span-1 text-right bg-slate-50/50 p-4 rounded-3xl md:bg-transparent md:p-0 border border-slate-100 md:border-none">
                                        <span className="md:hidden text-[9px] font-black text-slate-400 uppercase block mb-2 tracking-[0.2em]">RUNNING ACCOUNT</span>
                                        <p className={`font-black text-xl md:text-2xl tabular-nums tracking-tighter leading-none ${item.runningBalance > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                                            ₹{Math.abs(item.runningBalance).toLocaleString()}
                                            <span className="text-[10px] ml-2 opacity-50">{item.runningBalance > 0 ? 'DR' : 'CR'}</span>
                                        </p>
                                    </div>
                                    <div className="col-span-1 flex flex-col items-end gap-3 pt-2 md:pt-0">
                                        {!isReturn ? (
                                           <>
                                              <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-xl shadow-inner border ${isFullyPaid ? 'bg-teal-600 text-white border-teal-700' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                 {isFullyPaid ? 'AC SETTLED' : `OWED: ₹${balance.toLocaleString()}`}
                                              </span>
                                              {!isFullyPaid && !isAddingToThis && (
                                                <button 
                                                    onClick={() => { setIsAddingPayment(item.id); setNewPaidVal(item.paidAmount.toString()); }}
                                                    className="px-6 py-3 bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-100 active:scale-95 transition-all border border-white/10"
                                                >
                                                    Register Pmt
                                                </button>
                                              )}
                                              {isAddingToThis && (
                                                <div className="flex items-center gap-2 animate-slide-up bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner-soft">
                                                    <input 
                                                        autoFocus
                                                        type="number"
                                                        className="w-24 px-3 py-2 bg-white border border-brand-200 rounded-xl text-sm font-black outline-none shadow-sm focus:ring-8 focus:ring-brand-500/5 transition-all"
                                                        value={newPaidVal}
                                                        onChange={e => setNewPaidVal(e.target.value)}
                                                    />
                                                    <button onClick={() => handleRegisterPayment(item.id)} className="w-9 h-9 bg-brand-600 text-white rounded-xl shadow-lg flex items-center justify-center active:scale-90 transition-all"><Check size={18} strokeWidth={4}/></button>
                                                    <button onClick={() => setIsAddingPayment(null)} className="p-2 text-slate-400 active:scale-90"><X size={20}/></button>
                                                </div>
                                              )}
                                           </>
                                        ) : <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">N/A</span>}
                                    </div>
                                </div>
                            </div>
                          )
                      })}
                  </div>
                  <div className="p-8 md:p-10 border-t border-slate-100 bg-white flex justify-end shadow-2xl">
                      <button onClick={() => setSelectedCustomer(null)} className="w-full md:w-auto px-16 py-6 bg-slate-900 text-white font-black rounded-[2rem] active:scale-[0.98] transition-all text-sm uppercase tracking-[0.25em] shadow-xl border border-white/10">Terminate Session</button>
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
         title="Authorize Bulk Return?"
         message={`Safety Checkpoint: Confirming return logic for ${fd(Object.keys(selectedReturns).length)} items. Total refund credit: ₹${totalRefundAmount.toLocaleString()}.`}
         confirmLabel="Confirm Return"
       />
    </div>
  );
};

export default Billing;