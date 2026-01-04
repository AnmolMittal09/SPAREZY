import React, { useEffect, useState } from 'react';
// @ts-ignore
import { useParams, Link } from 'react-router-dom';
import { fetchItemDetails, fetchPriceHistory } from '../services/inventoryService';
import { fetchItemTransactions } from '../services/transactionService';
import { PriceHistoryEntry, StockItem, Brand, Transaction, TransactionType } from '../types';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Tag, 
  Box, 
  Hash, 
  Eye, 
  EyeOff, 
  ArrowRightLeft, 
  Activity,
  History,
  AlertCircle,
  Package,
  Calendar,
  IndianRupee,
  ChevronRight
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

const ItemDetail: React.FC = () => {
  const { partNumber } = useParams<{ partNumber: string }>();
  const [item, setItem] = useState<StockItem | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'MOVEMENTS' | 'PRICING'>('MOVEMENTS');

  useEffect(() => {
    loadData();
  }, [partNumber]);

  const loadData = async () => {
    if (!partNumber) return;
    setLoading(true);
    try {
      const [itemData, historyData, txData] = await Promise.all([
        fetchItemDetails(partNumber),
        fetchPriceHistory(partNumber),
        fetchItemTransactions(partNumber)
      ]);
      setItem(itemData);
      setPriceHistory(historyData);
      setTransactions(txData);
    } catch (err) {
      console.error("Failed to load item detail", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <TharLoader />;

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <AlertCircle size={64} className="text-slate-200 mb-6" />
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">SKU Not Found</h2>
        <p className="text-slate-500 mt-2 mb-8">This part number does not exist in the master catalog.</p>
        <Link to="/" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-slate-200 active:scale-95 transition-all">Back to Dashboard</Link>
      </div>
    );
  }

  const isLowStock = item.quantity < item.minStockThreshold && item.quantity > 0;
  const isZeroStock = item.quantity === 0;
  const stockValue = item.quantity * item.price;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-fade-in">
      
      {/* NAVIGATION & HEADER */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 p-1">
        <Link to="/" className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-400 shadow-sm transition-all active:scale-90">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
           <div className="flex items-center gap-3 mb-1">
              <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-widest ${item.brand === Brand.HYUNDAI ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
                {item.brand}
              </span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">{item.partNumber}</h1>
           </div>
           <p className="text-slate-500 font-medium text-lg leading-snug">{item.name}</p>
        </div>
      </div>

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {/* PRICE CARD */}
         <div 
            onClick={() => setPriceVisible(!priceVisible)}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-soft flex flex-col justify-between cursor-pointer group hover:border-brand-300 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center justify-between text-slate-400 mb-4 relative z-10">
               <div className="flex items-center gap-2">
                 <Tag size={16} />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Market Price (MRP)</span>
               </div>
               {priceVisible ? <EyeOff size={14} /> : <Eye size={14} className="text-brand-500" />}
            </div>
            <div className="flex items-baseline gap-1 relative z-10">
              <span className={`text-3xl font-black text-slate-900 transition-all duration-300 ${priceVisible ? 'blur-0' : 'blur-md select-none opacity-20'}`}>
                ₹{item.price.toLocaleString()}
              </span>
              {!priceVisible && <span className="text-[10px] font-bold text-brand-600 animate-pulse ml-2 uppercase">Reveal</span>}
            </div>
         </div>

         {/* STOCK CARD */}
         <div className={`p-6 rounded-3xl border shadow-soft flex flex-col justify-between overflow-hidden relative ${
            isZeroStock ? 'bg-rose-50 border-rose-100' : isLowStock ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'
         }`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-black/5 rounded-full -mr-12 -mt-12"></div>
            <div className={`flex items-center gap-2 mb-4 relative z-10 ${
                isZeroStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-400'
            }`}>
               <Box size={16} />
               <span className="text-[10px] font-bold uppercase tracking-widest">On-Hand Inventory</span>
            </div>
            <div className={`text-3xl font-black relative z-10 tracking-tight ${
                isZeroStock ? 'text-rose-900' : isLowStock ? 'text-amber-900' : 'text-slate-900'
            }`}>
                {item.quantity} <span className="text-sm font-bold opacity-60 uppercase ml-1">PCS</span>
            </div>
         </div>

         {/* VALUATION CARD (Asset Value) */}
         <div className="bg-slate-900 p-6 rounded-3xl shadow-elevated flex flex-col justify-between sm:col-span-2 lg:col-span-1 overflow-hidden relative group">
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
            <div className="flex items-center gap-2 mb-4 text-slate-500 relative z-10">
               <IndianRupee size={16} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Inventory Asset Value</span>
            </div>
            <div className="text-3xl font-black text-white relative z-10 tracking-tighter">
                ₹{stockValue.toLocaleString()}
            </div>
         </div>
      </div>

      {/* METADATA BAR */}
      <div className="bg-white rounded-2xl p-4 md:px-8 border border-slate-200 shadow-soft flex flex-wrap gap-6 md:gap-12 items-center">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><Hash size={14}/></div>
             <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">HSN Code</p>
                <p className="font-bold text-slate-800 text-xs">{item.hsnCode}</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><Clock size={14}/></div>
             <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Last Update</p>
                <p className="font-bold text-slate-800 text-xs">{new Date(item.lastUpdated).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
             </div>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-100">
             <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></div>
             <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Active SKU</span>
          </div>
      </div>

      {/* DETAILED HISTORY TABS */}
      <div className="bg-white rounded-[2rem] shadow-soft border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-1 bg-slate-50 flex border-b border-slate-100">
              <button 
                onClick={() => setActiveTab('MOVEMENTS')}
                className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'MOVEMENTS' ? 'bg-white text-slate-900 shadow-sm rounded-t-2xl ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Activity size={14} /> Movement Ledger
              </button>
              <button 
                onClick={() => setActiveTab('PRICING')}
                className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'PRICING' ? 'bg-white text-slate-900 shadow-sm rounded-t-2xl ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <History size={14} /> SKU Price Audit
              </button>
          </div>

          <div className="flex-1 overflow-auto no-scrollbar">
              {activeTab === 'MOVEMENTS' ? (
                <div className="divide-y divide-slate-50 animate-fade-in">
                   {transactions.length === 0 ? (
                      <div className="py-24 text-center text-slate-400">
                         <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-10" />
                         <p className="text-[10px] font-bold uppercase tracking-widest">No transactions logged</p>
                      </div>
                   ) : (
                      transactions.map(tx => (
                        <div key={tx.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                                tx.type === TransactionType.SALE ? 'bg-teal-50 text-teal-600' : 
                                tx.type === TransactionType.PURCHASE ? 'bg-blue-50 text-blue-600' : 
                                'bg-rose-50 text-rose-600'
                              }`}>
                                 {tx.type === TransactionType.SALE ? <TrendingUp size={18}/> : 
                                  tx.type === TransactionType.PURCHASE ? <Package size={18}/> : <TrendingDown size={18}/>}
                              </div>
                              <div>
                                 <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-bold text-slate-900">{tx.type}</span>
                                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">• {new Date(tx.createdAt).toLocaleDateString()}</span>
                                 </div>
                                 <p className="text-xs text-slate-500 font-medium">{tx.customerName || 'Standard Entry'}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-8 text-right self-end sm:self-center">
                              <div className="space-y-0.5">
                                 <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Net Rate</p>
                                 <p className="font-bold text-slate-800 text-sm">₹{tx.price.toLocaleString()}</p>
                              </div>
                              <div className="min-w-[60px]">
                                 <span className={`text-lg font-black tracking-tight ${
                                   tx.type === TransactionType.SALE ? 'text-teal-600' : 
                                   tx.type === TransactionType.PURCHASE ? 'text-blue-600' : 
                                   'text-rose-600'
                                 }`}>
                                    {tx.type === TransactionType.SALE ? '-' : '+'}{tx.quantity}
                                 </span>
                              </div>
                           </div>
                        </div>
                      ))
                   )}
                </div>
              ) : (
                <div className="divide-y divide-slate-50 animate-fade-in">
                   {priceHistory.length === 0 ? (
                      <div className="py-24 text-center text-slate-400">
                         <History size={48} className="mx-auto mb-4 opacity-10" />
                         <p className="text-[10px] font-bold uppercase tracking-widest">No price changes detected</p>
                      </div>
                   ) : (
                      priceHistory.map(entry => {
                         const diff = entry.newPrice - entry.oldPrice;
                         const isIncrease = diff > 0;
                         return (
                            <div key={entry.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                               <div className="flex items-center gap-4">
                                  <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl">
                                     <Calendar size={18} />
                                  </div>
                                  <div>
                                     <p className="text-sm font-bold text-slate-900">{new Date(entry.changeDate).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{new Date(entry.changeDate).toLocaleTimeString()}</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-10">
                                  <div className="text-right">
                                     <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mb-1">Was</p>
                                     <p className="text-slate-400 font-bold text-sm line-through">₹{entry.oldPrice.toLocaleString()}</p>
                                  </div>
                                  <div className="text-center">
                                     <div className={`px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 shadow-inner ${isIncrease ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                        {isIncrease ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                                        {isIncrease ? '+' : ''}{diff.toLocaleString()}
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[8px] font-bold text-brand-400 uppercase tracking-widest mb-1">New MRP</p>
                                     <p className="text-slate-900 font-black text-xl tracking-tight">₹{entry.newPrice.toLocaleString()}</p>
                                  </div>
                               </div>
                            </div>
                         );
                      })
                   )}
                </div>
              )}
          </div>
      </div>

    </div>
  );
};

export default ItemDetail;