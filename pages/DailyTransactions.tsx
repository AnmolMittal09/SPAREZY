
import React, { useEffect, useState, useRef } from 'react';
import { Role, Transaction, TransactionStatus, TransactionType, User, StockItem } from '../types';
import { 
  createBulkTransactions, 
  fetchTransactions, 
  approveTransaction, 
  rejectTransaction,
  fetchAnalytics,
  fetchSalesForReturn,
  AnalyticsData
} from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import * as XLSX from 'xlsx';
import { 
  ShoppingCart, 
  Truck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  History, 
  PlusCircle, 
  Search,
  Loader2,
  Trash2,
  FileSpreadsheet,
  RotateCcw,
  BarChart3,
  Calendar,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft
} from 'lucide-react';
import StatCard from '../components/StatCard';

interface Props {
  user: User;
}

// Temporary type for Cart Item
interface CartItem {
  tempId: string;
  partNumber: string;
  type: TransactionType;
  quantity: number;
  price: number;
  customerName: string;
  stockError?: boolean; // UI flag if we try to sell more than we have
}

const DailyTransactions: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'PENDING' | 'HISTORY' | 'ANALYTICS'>('NEW');
  const [pendingList, setPendingList] = useState<Transaction[]>([]);
  const [historyList, setHistoryList] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);

  // --- CART / BATCH STATE ---
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.SALE);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- MANUAL ENTRY FORM STATE ---
  const [formPartNumber, setFormPartNumber] = useState('');
  const [formQty, setFormQty] = useState(1);
  const [formPrice, setFormPrice] = useState(0);
  const [formName, setFormName] = useState(''); // Customer or Supplier

  // --- SUGGESTIONS STATE ---
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  // --- RETURN SEARCH STATE ---
  const [returnSearch, setReturnSearch] = useState('');
  const [returnHistory, setReturnHistory] = useState<Transaction[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  // --- ANALYTICS STATE ---
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'MONTH' | 'YEAR'>('TODAY');

  useEffect(() => {
    // Load inventory for autocomplete suggestions and smart lookup
    const loadInv = async () => {
      const data = await fetchInventory();
      setInventory(data);
    };
    loadInv();
  }, []);

  useEffect(() => {
    if (activeTab === 'PENDING') loadPending();
    if (activeTab === 'HISTORY') loadHistory();
    if (activeTab === 'ANALYTICS') loadAnalytics();
  }, [activeTab, dateFilter]);

  // Special effect for Return Tab in "New" mode
  useEffect(() => {
     if (activeTab === 'NEW' && transactionType === TransactionType.RETURN) {
        handleReturnSearch('');
     }
  }, [transactionType, activeTab]);

  const loadPending = async () => {
    setLoading(true);
    const data = await fetchTransactions(TransactionStatus.PENDING);
    setPendingList(data);
    setLoading(false);
  };

  const loadHistory = async () => {
    setLoading(true);
    const data = await fetchTransactions();
    setHistoryList(data);
    setLoading(false);
  };

  const loadAnalytics = async () => {
    if (user.role !== Role.OWNER) return;
    setLoading(true);
    
    const now = new Date();
    let startDate = new Date();
    const endDate = new Date(); // Now

    if (dateFilter === 'TODAY') {
      startDate.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === 'YEAR') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const data = await fetchAnalytics(startDate, endDate);
    setAnalyticsData(data);
    setLoading(false);
  };

  const handleReturnSearch = async (val: string) => {
    setReturnSearch(val);
    setLoadingReturns(true);
    const results = await fetchSalesForReturn(val);
    setReturnHistory(results);
    setLoadingReturns(false);
  };

  const selectReturnItem = (tx: Transaction) => {
    setFormPartNumber(tx.partNumber);
    setFormName(tx.customerName || '');
    setFormPrice(tx.price);
    setFormQty(tx.quantity); 
    // Scroll to form?
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- AUTOCOMPLETE LOGIC ---
  const handlePartSearch = (val: string) => {
    setFormPartNumber(val);
    if (!val) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      const lower = val.toLowerCase();
      const matches = inventory.filter(i => 
        i.partNumber.toLowerCase().includes(lower) || 
        i.name.toLowerCase().includes(lower)
      ).slice(0, 5);
      setSuggestions(matches);
      setShowSuggestions(true);
    }, 300);
  };

  const selectSuggestion = (item: StockItem) => {
    setFormPartNumber(item.partNumber);
    setFormPrice(item.price);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // --- EXCEL UPLOAD LOGIC ---
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      const newItems: CartItem[] = [];
      
      rows.forEach((row, idx) => {
        if (idx === 0) return; // Skip Header
        // Expected Columns: PartNo | Qty | Price | Name
        let partNo = String(row[0] || '').trim();
        let qty = parseInt(row[1]) || 1;
        let price = parseFloat(row[2]) || 0;
        let name = row[3] ? String(row[3]).trim() : '';

        // Integer Overflow Protection
        if (qty > 1000000) return; 

        if (partNo) {
          // --- SMART FETCH LOGIC ---
          // Check if item exists in inventory to auto-fill details
          const existingItem = inventory.find(i => i.partNumber.toLowerCase() === partNo.toLowerCase());
          
          if (existingItem) {
             // If Excel price is 0 or missing, use inventory price
             if (!price) price = existingItem.price;
          }

          const finalName = name || formName || (transactionType === TransactionType.SALE ? 'Walk-in' : 'Supplier');

          newItems.push({
            tempId: Math.random().toString(36),
            partNumber: partNo,
            type: transactionType,
            quantity: qty,
            price: price,
            customerName: finalName
          });
        }
      });

      setCart(prev => [...prev, ...newItems]);
      e.target.value = ''; // Reset input
    } catch (err) {
      alert("Failed to parse Excel file. Ensure columns are: Part No, Qty, Price, Name");
    }
  };

  // --- CART ACTIONS ---
  const addToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPartNumber) return;

    const newItem: CartItem = {
      tempId: Math.random().toString(36),
      partNumber: formPartNumber,
      type: transactionType,
      quantity: formQty,
      price: formPrice,
      customerName: formName,
    };

    setCart(prev => [newItem, ...prev]); // Add to top
    
    // Reset inputs mostly
    setFormPartNumber('');
    setFormQty(1);
    setFormPrice(0);
    // Keep Customer Name as it might be same for batch
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.tempId !== id));
  };

  const handleBatchSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setMsg(null);

    const payload = cart.map(item => ({
      partNumber: item.partNumber,
      type: item.type,
      quantity: item.quantity,
      price: item.price,
      customerName: item.customerName,
      createdByRole: user.role
    }));

    const res = await createBulkTransactions(payload);

    if (res.success) {
      setMsg({ type: 'success', text: user.role === Role.MANAGER ? 'Batch submitted for approval.' : 'Batch transaction recorded successfully.' });
      setCart([]); // Clear Cart
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to submit batch.' });
    }
    setSubmitting(false);
  };

  const handleApprove = async (tx: Transaction) => {
    try {
      await approveTransaction(tx.id, tx.partNumber, tx.type, tx.quantity);
      loadPending();
    } catch (err) {
      alert("Error approving transaction");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectTransaction(id);
      loadPending();
    } catch (err) {
      alert("Error rejecting transaction");
    }
  };

  // Helper styles for Tab
  const getTabClass = (tab: string) => `flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`;

  // Helper styles for Transaction Type
  const getTypeClass = (type: TransactionType) => {
    if (transactionType === type) {
       if (type === TransactionType.SALE) return 'bg-green-50 border-green-200 ring-2 ring-green-500';
       if (type === TransactionType.PURCHASE) return 'bg-blue-50 border-blue-200 ring-2 ring-blue-500';
       if (type === TransactionType.RETURN) return 'bg-red-50 border-red-200 ring-2 ring-red-500';
    }
    return 'bg-white border-gray-200 hover:bg-gray-50';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Transactions</h1>
          <p className="text-gray-500">Record Sales, Purchases, Returns, and manage approvals.</p>
        </div>
      </div>

      {/* Top Nav Tabs */}
      <div className="flex flex-wrap gap-1 bg-white rounded-xl shadow-sm border border-gray-200 p-1">
        <button onClick={() => setActiveTab('NEW')} className={getTabClass('NEW')}>
          <PlusCircle size={18} /> New Batch
        </button>
        <button onClick={() => setActiveTab('PENDING')} className={getTabClass('PENDING')}>
          <Clock size={18} /> Pending
        </button>
        <button onClick={() => setActiveTab('HISTORY')} className={getTabClass('HISTORY')}>
          <History size={18} /> History
        </button>
        {user.role === Role.OWNER && (
          <button onClick={() => setActiveTab('ANALYTICS')} className={getTabClass('ANALYTICS')}>
            <BarChart3 size={18} /> Analytics
          </button>
        )}
      </div>

      {/* ================= NEW ENTRY TAB ================= */}
      {activeTab === 'NEW' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* 1. Transaction Type Selection */}
          <div className="grid grid-cols-3 gap-4">
               <button onClick={() => setTransactionType(TransactionType.SALE)} className={`p-4 rounded-xl border transition-all text-left ${getTypeClass(TransactionType.SALE)}`}>
                  <div className="flex items-center gap-2 text-green-700 font-bold mb-1">
                    <ShoppingCart size={20} /> SALE
                  </div>
                  <p className="text-xs text-gray-500">Stock Out</p>
               </button>
               <button onClick={() => setTransactionType(TransactionType.PURCHASE)} className={`p-4 rounded-xl border transition-all text-left ${getTypeClass(TransactionType.PURCHASE)}`}>
                  <div className="flex items-center gap-2 text-blue-700 font-bold mb-1">
                    <Truck size={20} /> PURCHASE
                  </div>
                  <p className="text-xs text-gray-500">Stock In</p>
               </button>
               <button onClick={() => setTransactionType(TransactionType.RETURN)} className={`p-4 rounded-xl border transition-all text-left ${getTypeClass(TransactionType.RETURN)}`}>
                  <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                    <RotateCcw size={20} /> RETURN
                  </div>
                  <p className="text-xs text-gray-500">Stock In (Refund)</p>
               </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             
             {/* 2. Left Column: Input Form */}
             <div className="lg:col-span-1 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                   <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">Add Item to Batch</h3>
                   <form onSubmit={addToCart} className="space-y-4">
                      {/* Name Field */}
                      <div>
                         <label className="text-xs font-semibold text-gray-500 uppercase">
                           {transactionType === TransactionType.PURCHASE ? 'Supplier Name' : 'Customer Name'}
                         </label>
                         <input 
                           type="text" 
                           className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                           placeholder={transactionType === TransactionType.PURCHASE ? "Distributor" : "Walk-in"}
                           value={formName}
                           onChange={e => setFormName(e.target.value)}
                         />
                      </div>

                      {/* Part Number Search */}
                      <div className="relative z-10">
                         <label className="text-xs font-semibold text-gray-500 uppercase">Part Number *</label>
                         <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input 
                              type="text" 
                              required
                              className="w-full mt-1 pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono"
                              placeholder="Search Part..."
                              value={formPartNumber}
                              onChange={e => handlePartSearch(e.target.value)}
                              onFocus={() => formPartNumber && setShowSuggestions(true)}
                            />
                         </div>
                         {/* Suggestions Dropdown */}
                         {showSuggestions && suggestions.length > 0 && (
                           <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {suggestions.map(s => (
                                <div 
                                  key={s.id}
                                  onClick={() => selectSuggestion(s)}
                                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                >
                                  <div className="font-bold text-sm text-gray-800">{s.partNumber}</div>
                                  <div className="text-xs text-gray-500 flex justify-between">
                                    <span>{s.name}</span>
                                    <span>Stock: {s.quantity}</span>
                                  </div>
                                </div>
                              ))}
                           </div>
                         )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Quantity *</label>
                            <input 
                              type="number" 
                              min="1"
                              required
                              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              value={formQty}
                              onChange={e => setFormQty(parseInt(e.target.value) || 0)}
                            />
                         </div>
                         <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">Price (Each)</label>
                            <input 
                              type="number" 
                              min="0"
                              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              value={formPrice}
                              onChange={e => setFormPrice(parseFloat(e.target.value) || 0)}
                            />
                         </div>
                      </div>

                      <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                         <PlusCircle size={18} /> Add to List
                      </button>
                   </form>

                   <div className="my-6 border-t border-gray-100 relative">
                      <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-gray-400">OR</span>
                   </div>

                   {/* Excel Upload Btn */}
                   <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-green-200 bg-green-50 hover:bg-green-100 text-green-700 font-medium py-3 rounded-lg cursor-pointer transition-colors">
                      <FileSpreadsheet size={20} />
                      Upload Excel Sheet
                      <input 
                        type="file" 
                        accept=".xlsx, .xls"
                        className="hidden" 
                        onChange={handleExcelUpload}
                      />
                   </label>
                   <p className="text-[10px] text-center text-gray-400 mt-2">
                      Format: Part No | Qty | Price (Optional) | Name (Optional)
                   </p>
                </div>
                
                {/* --- RETURN FROM HISTORY UI --- */}
                {transactionType === TransactionType.RETURN && (
                   <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-5">
                       <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2 text-sm">
                           <History size={16} /> Find Original Sale
                       </h3>
                       <div className="relative mb-3">
                            <Search className="absolute left-3 top-2.5 text-red-300" size={14} />
                            <input 
                                type="text"
                                className="w-full pl-8 pr-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-300 outline-none"
                                placeholder="Part No or Customer Name..."
                                value={returnSearch}
                                onChange={e => handleReturnSearch(e.target.value)}
                            />
                       </div>
                       
                       <div className="max-h-64 overflow-y-auto space-y-2">
                           {loadingReturns ? (
                               <div className="flex justify-center py-4"><Loader2 className="animate-spin text-red-400" size={20}/></div>
                           ) : returnHistory.length === 0 ? (
                               <div className="text-center text-xs text-gray-500 py-4">No matching sales found.</div>
                           ) : (
                               returnHistory.map(tx => (
                                   <div key={tx.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex flex-col gap-1">
                                       <div className="flex justify-between items-start">
                                           <span className="font-bold text-xs text-gray-800">{tx.partNumber}</span>
                                           <span className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</span>
                                       </div>
                                       <div className="text-xs text-gray-600 flex justify-between">
                                            <span>{tx.customerName || 'Walk-in'}</span>
                                            <span>₹{tx.price} x {tx.quantity}</span>
                                       </div>
                                       <button 
                                            onClick={() => selectReturnItem(tx)}
                                            className="mt-1 w-full bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                       >
                                           <ArrowDownLeft size={12} /> Return This
                                       </button>
                                   </div>
                               ))
                           )}
                       </div>
                   </div>
                )}
             </div>

             {/* 3. Right Column: Cart / Batch List */}
             <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
                   <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        Current Batch ({cart.length})
                        {cart.length > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${transactionType === 'SALE' ? 'bg-green-100 text-green-800' : transactionType === 'RETURN' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {transactionType}
                          </span>
                        )}
                      </h3>
                      {cart.length > 0 && (
                         <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">Clear All</button>
                      )}
                   </div>
                   
                   <div className="flex-1 overflow-auto min-h-[300px] max-h-[500px]">
                      {cart.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                            <ShoppingCart size={48} className="mb-3 opacity-20" />
                            <p>No items in batch yet.</p>
                            <p className="text-xs mt-1">Add manually or upload excel.</p>
                         </div>
                      ) : (
                         <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0">
                               <tr>
                                  <th className="px-4 py-3">Part No</th>
                                  <th className="px-4 py-3">Qty</th>
                                  <th className="px-4 py-3">Price</th>
                                  <th className="px-4 py-3">Total</th>
                                  <th className="px-4 py-3 text-right">Action</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                               {cart.map((item) => (
                                  <tr key={item.tempId} className="hover:bg-gray-50 group">
                                     <td className="px-4 py-3 font-medium text-gray-900">{item.partNumber}</td>
                                     <td className="px-4 py-3">{item.quantity}</td>
                                     <td className="px-4 py-3">₹{item.price}</td>
                                     <td className="px-4 py-3 text-gray-600">₹{(item.quantity * item.price).toLocaleString()}</td>
                                     <td className="px-4 py-3 text-right">
                                        <button 
                                          onClick={() => removeFromCart(item.tempId)}
                                          className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                           <Trash2 size={16} />
                                        </button>
                                     </td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      )}
                   </div>

                   <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                         <p className="text-xs text-gray-500">Total Batch Value</p>
                         <p className="text-xl font-bold text-gray-900">
                           ₹{cart.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()}
                         </p>
                      </div>
                      <button 
                        onClick={handleBatchSubmit}
                        disabled={cart.length === 0 || submitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                         {submitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                         Submit Batch
                      </button>
                   </div>
                </div>
                {msg && (
                   <div className={`mt-4 p-3 rounded-lg text-sm text-center animate-fade-in ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {msg.text}
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* ================= PENDING TAB ================= */}
      {activeTab === 'PENDING' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
          {loading ? (
             <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
          ) : pendingList.length === 0 ? (
             <div className="p-12 text-center text-gray-500">No pending approvals found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Part No</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingList.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === TransactionType.SALE ? 'bg-green-100 text-green-700' : tx.type === TransactionType.RETURN ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                           {tx.type}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{tx.partNumber}</td>
                      <td className="px-6 py-4">{tx.quantity}</td>
                      <td className="px-6 py-4">₹{tx.price}</td>
                      <td className="px-6 py-4 text-gray-600">{tx.customerName || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {user.role === Role.OWNER ? (
                          <div className="flex items-center justify-center gap-2">
                             <button 
                               onClick={() => handleApprove(tx)}
                               className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors" 
                               title="Approve"
                             >
                               <CheckCircle2 size={18} />
                             </button>
                             <button 
                               onClick={() => handleReject(tx.id)}
                               className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition-colors"
                               title="Reject"
                             >
                               <XCircle size={18} />
                             </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Waiting Approval</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= HISTORY TAB ================= */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
          {loading ? (
             <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
          ) : historyList.length === 0 ? (
             <div className="p-12 text-center text-gray-500">No transaction history found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Part No</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyList.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === TransactionType.SALE ? 'bg-green-100 text-green-700' : tx.type === TransactionType.RETURN ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                           {tx.type}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-medium">{tx.partNumber}</td>
                      <td className="px-6 py-4">{tx.quantity}</td>
                      <td className="px-6 py-4">₹{tx.price}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                           tx.status === TransactionStatus.APPROVED 
                             ? 'bg-green-50 text-green-700' 
                             : tx.status === TransactionStatus.REJECTED 
                               ? 'bg-red-50 text-red-700' 
                               : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= ANALYTICS TAB (OWNER ONLY) ================= */}
      {activeTab === 'ANALYTICS' && user.role === Role.OWNER && (
         <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
               <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                 <BarChart3 className="text-blue-600" size={24} />
                 Profit & Sales Analytics
               </h2>
               <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setDateFilter('TODAY')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${dateFilter === 'TODAY' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Today
                  </button>
                  <button 
                    onClick={() => setDateFilter('MONTH')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${dateFilter === 'MONTH' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    This Month
                  </button>
                  <button 
                    onClick={() => setDateFilter('YEAR')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${dateFilter === 'YEAR' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    This Year
                  </button>
               </div>
            </div>

            {loading ? (
               <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
            ) : analyticsData ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard 
                     title="Total Sales" 
                     value={`₹${analyticsData.totalSales.toLocaleString()}`} 
                     icon={ShoppingCart} 
                     colorClass="bg-green-50 border-green-100"
                  />
                  <StatCard 
                     title="Total Returns (Refunds)" 
                     value={`-₹${analyticsData.totalReturns.toLocaleString()}`} 
                     icon={RotateCcw} 
                     colorClass="bg-red-50 border-red-100"
                  />
                  <StatCard 
                     title="Net Revenue" 
                     value={`₹${analyticsData.netRevenue.toLocaleString()}`} 
                     icon={IndianRupee} 
                     trend={analyticsData.netRevenue > 0 ? "Profit" : "Loss"}
                     colorClass="bg-blue-50 border-blue-100"
                  />
                  <StatCard 
                     title="Total Purchases (Expense)" 
                     value={`₹${analyticsData.totalPurchases.toLocaleString()}`} 
                     icon={Truck} 
                  />
                  
                  {/* Summary Cards */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                     <div>
                        <h4 className="text-gray-500 text-sm font-medium">Sales Volume</h4>
                        <p className="text-2xl font-bold text-gray-900">{analyticsData.salesCount} <span className="text-sm font-normal text-gray-400">Transactions</span></p>
                     </div>
                     <TrendingUp className="text-green-500" size={32} />
                  </div>
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                     <div>
                        <h4 className="text-gray-500 text-sm font-medium">Return Volume</h4>
                        <p className="text-2xl font-bold text-gray-900">{analyticsData.returnCount} <span className="text-sm font-normal text-gray-400">Transactions</span></p>
                     </div>
                     <TrendingDown className="text-red-500" size={32} />
                  </div>
               </div>
            ) : (
               <div className="text-center p-12 text-gray-500">No analytics data available for this period.</div>
            )}
         </div>
      )}

    </div>
  );
};

export default DailyTransactions;
