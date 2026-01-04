
import React, { useEffect, useState, useMemo } from 'react';
import { User, Transaction, TransactionType, TransactionStatus, StockItem, Brand } from '../types';
import { fetchTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import TharLoader from '../components/TharLoader';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  AlertCircle, 
  IndianRupee, 
  Percent, 
  Calendar,
  Layers
} from 'lucide-react';

interface Props {
  user: User;
}

const ProfitAnalysis: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'MONTH'>('TODAY');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [txData, invData] = await Promise.all([
          fetchTransactions(TransactionStatus.APPROVED),
          fetchInventory()
        ]);
        setTransactions(txData);
        setInventory(invData);
      } catch (e) {
        console.error("Failed to load analytics data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const cutoff = timeFilter === 'TODAY' ? startOfToday : startOfMonth;

    // Filtered data set
    const periodTxs = transactions.filter(tx => new Date(tx.createdAt).getTime() >= cutoff);
    const invMap = new Map(inventory.map(i => [i.partNumber.toUpperCase(), i]));

    let totalSales = 0;
    let totalReturns = 0;
    let totalPurchases = 0;
    let discountLeakage = 0;

    const brandStats = {
      HYUNDAI: { sales: 0, cost: 0, profit: 0 },
      MAHINDRA: { sales: 0, cost: 0, profit: 0 }
    };

    periodTxs.forEach(tx => {
      const amount = tx.price * tx.quantity;
      const pn = tx.partNumber.toUpperCase();
      const isHyundai = pn.startsWith('HY');
      const isMahindra = pn.startsWith('MH');
      const brandKey = isHyundai ? 'HYUNDAI' : isMahindra ? 'MAHINDRA' : null;

      if (tx.type === TransactionType.SALE) {
        totalSales += amount;
        if (brandKey) brandStats[brandKey].sales += amount;
      } else if (tx.type === TransactionType.RETURN) {
        totalReturns += amount;
        if (brandKey) brandStats[brandKey].sales -= amount;
      } else if (tx.type === TransactionType.PURCHASE) {
        totalPurchases += amount;
        if (brandKey) brandStats[brandKey].cost += amount;

        // Leakage calculation: (Actual - Expected 12% Disc Price) * Qty
        const item = invMap.get(pn);
        if (item) {
          const expectedPrice = item.price * 0.88; // 12% discount off MRP
          if (tx.price > expectedPrice) {
            discountLeakage += (tx.price - expectedPrice) * tx.quantity;
          }
        }
      }
    });

    const netSales = totalSales - totalReturns;
    const netProfit = netSales - totalPurchases;
    const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    // Calculate profit for brands
    brandStats.HYUNDAI.profit = brandStats.HYUNDAI.sales - brandStats.HYUNDAI.cost;
    brandStats.MAHINDRA.profit = brandStats.MAHINDRA.sales - brandStats.MAHINDRA.cost;

    return {
      netSales,
      totalPurchases,
      netProfit,
      discountLeakage,
      margin,
      brandStats
    };
  }, [transactions, inventory, timeFilter]);

  if (loading) return <TharLoader />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header & Filter Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="text-brand-600" /> Profit Analysis
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Financial Intelligence Dashboard</p>
        </div>

        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-soft flex w-full md:w-auto">
          <button 
            onClick={() => setTimeFilter('TODAY')}
            className={`flex-1 md:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${timeFilter === 'TODAY' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Today
          </button>
          <button 
            onClick={() => setTimeFilter('MONTH')}
            className={`flex-1 md:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${timeFilter === 'MONTH' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Sales Card */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft flex flex-col justify-between group hover:border-brand-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><TrendingUp size={16}/></div>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{stats.netSales.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-2">Excluding Returns</p>
        </div>

        {/* Purchase Cost Card */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft flex flex-col justify-between group hover:border-brand-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Cost</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><IndianRupee size={16}/></div>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">₹{stats.totalPurchases.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-2">Actual Billed Cost</p>
        </div>

        {/* Net Profit Card */}
        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-elevated flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Profit</span>
            <div className="p-2 bg-white/10 text-brand-400 rounded-xl"><TrendingUp size={16}/></div>
          </div>
          <p className="text-3xl font-black text-white tracking-tighter relative z-10">₹{stats.netProfit.toLocaleString()}</p>
          <div className="mt-2 flex items-center gap-2 relative z-10">
             <span className="text-[10px] font-black text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded uppercase tracking-widest">{stats.margin.toFixed(1)}% Margin</span>
          </div>
        </div>

        {/* Discount Leakage Card */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft md:col-span-2 lg:col-span-1 flex flex-col justify-between group hover:border-rose-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Discount Leakage</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><AlertCircle size={16}/></div>
          </div>
          <p className="text-3xl font-black text-rose-600 tracking-tighter">₹{stats.discountLeakage.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-2">Loss vs Expected 12% B.DC</p>
        </div>
      </div>

      {/* Brand Comparison Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Layers size={16} className="text-slate-400" />
          <h2 className="font-black text-slate-900 text-sm uppercase tracking-widest">Brand Performance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hyundai Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-full bg-blue-600/5 -skew-x-12 translate-x-16 group-hover:translate-x-12 transition-transform"></div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"></div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Hyundai</h3>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sales</span>
                <span className="font-black text-slate-900 text-lg">₹{stats.brandStats.HYUNDAI.sales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Cost</span>
                <span className="font-bold text-slate-600 text-lg">₹{stats.brandStats.HYUNDAI.cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Profit</span>
                <span className="font-black text-blue-600 text-2xl tracking-tighter">₹{stats.brandStats.HYUNDAI.profit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Mahindra Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-full bg-red-600/5 -skew-x-12 translate-x-16 group-hover:translate-x-12 transition-transform"></div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.4)]"></div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Mahindra</h3>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sales</span>
                <span className="font-black text-slate-900 text-lg">₹{stats.brandStats.MAHINDRA.sales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Cost</span>
                <span className="font-bold text-slate-600 text-lg">₹{stats.brandStats.MAHINDRA.cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Profit</span>
                <span className="font-black text-red-600 text-2xl tracking-tighter">₹{stats.brandStats.MAHINDRA.profit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitAnalysis;
