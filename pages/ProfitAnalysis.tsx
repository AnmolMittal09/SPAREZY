
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
  Layers,
  Box,
  ArrowUpRight,
  ArrowDownRight
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
    // Fix: Explicitly type the invMap to ensure the compiler knows it contains StockItem objects
    const invMap = new Map<string, StockItem>(inventory.map(i => [i.partNumber.toUpperCase(), i]));

    let totalSales = 0;
    let totalReturns = 0;
    let totalPurchases = 0;
    let discountLeakage = 0;

    const brandStats = {
      HYUNDAI: { sales: 0, cost: 0, profit: 0 },
      MAHINDRA: { sales: 0, cost: 0, profit: 0 }
    };

    const perPartMap = new Map<string, { sales: number, cost: number, leakage: number }>();

    periodTxs.forEach(tx => {
      const amount = tx.price * tx.quantity;
      const pn = tx.partNumber.toUpperCase();
      const isHyundai = pn.startsWith('HY');
      const isMahindra = pn.startsWith('MH');
      const brandKey = isHyundai ? 'HYUNDAI' : isMahindra ? 'MAHINDRA' : null;

      const partData = perPartMap.get(pn) || { sales: 0, cost: 0, leakage: 0 };

      if (tx.type === TransactionType.SALE) {
        totalSales += amount;
        partData.sales += amount;
        if (brandKey) brandStats[brandKey].sales += amount;
      } else if (tx.type === TransactionType.RETURN) {
        totalReturns += amount;
        partData.sales -= amount;
        if (brandKey) brandStats[brandKey].sales -= amount;
      } else if (tx.type === TransactionType.PURCHASE) {
        totalPurchases += amount;
        partData.cost += amount;
        if (brandKey) brandStats[brandKey].cost += amount;

        // Leakage calculation: (Actual - Expected 12% Disc Price) * Qty
        const item = invMap.get(pn);
        if (item) {
          const expectedPrice = item.price * 0.88; // 12% discount off MRP
          if (tx.price > expectedPrice) {
            const leak = (tx.price - expectedPrice) * tx.quantity;
            discountLeakage += leak;
            partData.leakage += leak;
          }
        }
      }
      perPartMap.set(pn, partData);
    });

    const netSales = totalSales - totalReturns;
    const netProfit = netSales - totalPurchases;
    const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    // Calculate profit for brands
    brandStats.HYUNDAI.profit = brandStats.HYUNDAI.sales - brandStats.HYUNDAI.cost;
    brandStats.MAHINDRA.profit = brandStats.MAHINDRA.sales - brandStats.MAHINDRA.cost;

    // Convert map to array for display, sorted by absolute profit impact
    const skuAnalysis = Array.from(perPartMap.entries()).map(([pn, data]) => ({
      partNumber: pn,
      name: invMap.get(pn)?.name || 'Spare Part',
      profit: data.sales - data.cost,
      leakage: data.leakage,
      netSales: data.sales
    })).sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit));

    return {
      netSales,
      totalPurchases,
      netProfit,
      discountLeakage,
      margin,
      brandStats,
      skuAnalysis
    };
  }, [transactions, inventory, timeFilter]);

  if (loading) return <TharLoader />;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24 animate-fade-in">
      {/* Header & Filter Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-1">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <BarChart3 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
              Profit Intelligence
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Financial Audit Ledger v4.2</p>
          </div>
        </div>

        <div className="bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner-soft flex w-full md:w-auto">
          <button 
            onClick={() => setTimeFilter('TODAY')}
            className={`flex-1 md:px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${timeFilter === 'TODAY' ? 'bg-white text-slate-900 shadow-soft border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Today
          </button>
          <button 
            onClick={() => setTimeFilter('MONTH')}
            className={`flex-1 md:px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${timeFilter === 'MONTH' ? 'bg-white text-slate-900 shadow-soft border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Sales Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-soft flex flex-col justify-between group hover:border-brand-200 transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Sales</span>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl shadow-inner"><TrendingUp size={18} strokeWidth={2.5}/></div>
          </div>
          <p className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums relative z-10">₹{stats.netSales.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest relative z-10">Net realized revenue</p>
        </div>

        {/* Purchase Cost Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-soft flex flex-col justify-between group hover:border-brand-200 transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inbound Cost</span>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><IndianRupee size={18} strokeWidth={2.5}/></div>
          </div>
          <p className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums relative z-10">₹{stats.totalPurchases.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest relative z-10">Total inventory liability</p>
        </div>

        {/* Net Profit Card */}
        <div className="bg-[#1E293B] p-8 rounded-[2.5rem] shadow-elevated flex flex-col justify-between relative overflow-hidden border border-white/5 group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-700"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Net Margin</span>
            <div className="p-3 bg-white/5 text-teal-400 rounded-2xl ring-1 ring-white/10 shadow-lg"><TrendingUp size={18} strokeWidth={2.5}/></div>
          </div>
          <p className="text-4xl font-black text-white tracking-tighter tabular-nums relative z-10">₹{stats.netProfit.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2 relative z-10">
             <span className="text-[11px] font-black text-teal-400 bg-teal-400/10 px-3 py-1 rounded-full uppercase tracking-widest border border-teal-400/20">{stats.margin.toFixed(1)}% Yield</span>
          </div>
        </div>
      </div>

      {/* Brand & SKU Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Brand Comparison Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center gap-3 px-1 mb-2">
            <Layers size={18} className="text-slate-400" />
            <h2 className="font-black text-slate-900 text-[11px] uppercase tracking-[0.25em]">Brand Segregation</h2>
          </div>

          {/* Hyundai Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-full bg-blue-600/[0.03] -skew-x-12 translate-x-16 group-hover:translate-x-12 transition-transform"></div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]"></div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase leading-none">Hyundai</h3>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-50 pb-5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</span>
                <span className="font-black text-slate-900 text-lg tabular-nums">₹{stats.brandStats.HYUNDAI.sales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Profit Yield</span>
                <span className="font-black text-blue-600 text-2xl tracking-tighter tabular-nums">₹{stats.brandStats.HYUNDAI.profit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Mahindra Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200/60 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-full bg-red-600/[0.03] -skew-x-12 translate-x-16 group-hover:translate-x-12 transition-transform"></div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.4)]"></div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase leading-none">Mahindra</h3>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-end border-b border-slate-50 pb-5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue</span>
                <span className="font-black text-slate-900 text-lg tabular-nums">₹{stats.brandStats.MAHINDRA.sales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Profit Yield</span>
                <span className="font-black text-red-600 text-2xl tracking-tighter tabular-nums">₹{stats.brandStats.MAHINDRA.profit.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Discount Leakage Summary */}
          <div className="bg-rose-50 rounded-[2.5rem] p-8 border border-rose-100 shadow-sm group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Discount Leakage</span>
              <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><AlertCircle size={16} strokeWidth={2.5}/></div>
            </div>
            <p className="text-3xl font-black text-rose-600 tracking-tighter tabular-nums">₹{stats.discountLeakage.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-rose-400 mt-2 uppercase tracking-widest leading-relaxed">Purchases exceeding 12% B.DC baseline protocol.</p>
          </div>
        </div>

        {/* SKU Performance Table */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200/60 overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-soft border border-slate-100 text-blue-600">
                      <Box size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none mb-1.5">SKU Performance Ledger</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profit and Leakage per Part Number</p>
                  </div>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-8 py-5">Spare Part SKU</th>
                    <th className="px-8 py-5 text-right">Yield (Profit)</th>
                    <th className="px-8 py-5 text-right">Leakage Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.skuAnalysis.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-24 text-center text-slate-300 font-black uppercase tracking-[0.3em] text-xs opacity-50">No Data Logs for selected period</td>
                    </tr>
                  ) : (
                    stats.skuAnalysis.slice(0, 50).map((row) => (
                      <tr key={row.partNumber} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="font-black text-slate-900 text-[15px] tracking-tight uppercase leading-none group-hover:text-blue-600 transition-colors">{row.partNumber}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px] mt-1">{row.name}</div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className={`flex items-center justify-end gap-2 font-black text-lg tabular-nums tracking-tighter ${row.profit >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                            {row.profit >= 0 ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
                            ₹{Math.abs(row.profit).toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-300 font-black uppercase tracking-widest mt-1">Rev: ₹{row.netSales.toLocaleString()}</div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className={`font-black text-lg tabular-nums tracking-tighter ${row.leakage > 0 ? 'text-rose-500' : 'text-slate-300 opacity-40'}`}>
                            {row.leakage > 0 ? `₹${row.leakage.toLocaleString()}` : '—'}
                          </div>
                          {row.leakage > 0 && <div className="text-[9px] text-rose-300 font-black uppercase tracking-widest mt-1">Protocol Break</div>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {stats.skuAnalysis.length > 50 && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/20 text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing top 50 SKU entries by profit impact</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitAnalysis;
