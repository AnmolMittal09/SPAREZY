
import React, { useEffect, useState, useMemo } from 'react';
import { User, Transaction, TransactionType } from '../types';
import { fetchTransactions } from '../services/transactionService';
import TharLoader from '../components/TharLoader';
import { 
  ArrowRightLeft, 
  Search, 
  Filter, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  RotateCcw, 
  History,
  X,
  ChevronRight,
  Package,
  Clock,
  ArrowUpDown
} from 'lucide-react';

const fd = (n: number | string) => {
  const num = parseInt(n.toString()) || 0;
  return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  user: User;
}

const StockMovements: React.FC<Props> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (e) {
      console.error("Failed to load transactions", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Type Filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;

      // Date Filters
      const txDate = new Date(tx.createdAt).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (txDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000); // Include full end day
        if (txDate > end) return false;
      }

      // Search Query (Part Number or Customer)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          tx.partNumber.toLowerCase().includes(query) ||
          (tx.customerName && tx.customerName.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [transactions, typeFilter, startDate, endDate, searchQuery]);

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in max-w-6xl mx-auto pb-24">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-1">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-elevated">
              <History size={28} strokeWidth={2.5} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                 Audit Ledger
              </h1>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">Global Transaction Registry</p>
           </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} strokeWidth={2.5} />
                <input 
                  type="text" 
                  placeholder="Search Part or Client..."
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-soft outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-300 transition-all placeholder:text-slate-300 uppercase tracking-tight"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-2xl border transition-all flex items-center gap-2 ${showFilters ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-soft'}`}
            >
               <Filter size={20} />
               <span className="hidden md:inline text-xs font-black uppercase tracking-widest">Filters</span>
            </button>
        </div>
      </div>

      {/* FILTER DRAWER */}
      {showFilters && (
        <div className="bg-white rounded-[2rem] p-8 shadow-premium border border-slate-100 animate-slide-up">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Process Type</label>
                 <div className="grid grid-cols-2 gap-2">
                    {['ALL', TransactionType.SALE, TransactionType.PURCHASE, TransactionType.RETURN].map(t => (
                      <button 
                        key={t}
                        onClick={() => setTypeFilter(t as any)}
                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === t ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        {t}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Period Start</label>
                 <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="date" 
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                 </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Period End</label>
                 <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="date" 
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                 </div>
              </div>
           </div>

           <div className="mt-8 pt-6 border-t border-slate-50 flex justify-end gap-3">
              <button onClick={clearFilters} className="px-6 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Reset All</button>
              <button onClick={() => setShowFilters(false)} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Apply Parameters</button>
           </div>
        </div>
      )}

      {/* LEDGER CONTENT */}
      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200/60 overflow-hidden flex flex-col min-h-[600px]">
          <div className="px-10 py-7 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-soft border border-slate-100 text-blue-600">
                      <ArrowRightLeft size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none mb-1.5">Movement History</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chronological Sequence</p>
                  </div>
              </div>
              <span className="text-[10px] font-black bg-blue-600 text-white px-4 py-2 rounded-full uppercase tracking-widest shadow-md">
                 {fd(filteredTransactions.length)} Records
              </span>
          </div>

          <div className="flex-1 overflow-x-auto no-scrollbar">
              {filteredTransactions.length === 0 ? (
                <div className="p-40 text-center text-slate-200 flex flex-col items-center justify-center">
                    <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mb-10 shadow-inner-soft">
                        <History className="opacity-10" size={64} />
                    </div>
                    <p className="font-black uppercase tracking-[0.5em] text-[14px] text-slate-300">Journal Empty</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Adjust filters to broaden search</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-10 py-6">Timestamp</th>
                      <th className="px-10 py-6">Entity / Description</th>
                      <th className="px-10 py-6 text-center">Process</th>
                      <th className="px-10 py-6 text-center">Quantity</th>
                      <th className="px-10 py-6 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTransactions.map(tx => {
                      const isSale = tx.type === TransactionType.SALE;
                      const isPurchase = tx.type === TransactionType.PURCHASE;
                      const isReturn = tx.type === TransactionType.RETURN;
                      
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-all group">
                          <td className="px-10 py-6">
                            <div className="flex flex-col">
                               <span className="font-black text-slate-900 text-sm">{new Date(tx.createdAt).toLocaleDateString()}</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </td>
                          <td className="px-10 py-6">
                             <div className="flex flex-col gap-1">
                                <span className="font-black text-slate-900 text-[15px] tracking-tight uppercase group-hover:text-blue-600 transition-colors">{tx.partNumber}</span>
                                <div className="flex items-center gap-2">
                                   <Package size={12} className="text-slate-300" />
                                   <span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[200px]">{tx.customerName || 'Direct Entry'}</span>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-6 text-center">
                             <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm inline-block ${
                               isSale ? 'bg-teal-50 text-teal-600 border-teal-100' :
                               isPurchase ? 'bg-blue-50 text-blue-600 border-blue-100' :
                               'bg-rose-50 text-rose-600 border-rose-100'
                             }`}>
                                {tx.type}
                             </span>
                          </td>
                          <td className="px-10 py-6 text-center">
                             <div className="flex items-center justify-center gap-2">
                                <span className={`text-lg font-black tracking-tight tabular-nums ${isSale ? 'text-teal-600' : isPurchase ? 'text-blue-600' : 'text-slate-900'}`}>
                                   {isSale ? '-' : '+'}{fd(tx.quantity)}
                                </span>
                                <span className="text-[9px] font-black text-slate-300 uppercase">PCS</span>
                             </div>
                          </td>
                          <td className="px-10 py-6 text-right">
                             <div className="flex flex-col items-end">
                                <span className="font-black text-slate-900 text-base tabular-nums">₹{(tx.price * tx.quantity).toLocaleString()}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">₹{tx.price.toLocaleString()} / UNIT</span>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
          
          <div className="p-8 border-t border-slate-100 bg-slate-50/30 text-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">End of Registered Sequence</p>
          </div>
      </div>
    </div>
  );
};

export default StockMovements;
