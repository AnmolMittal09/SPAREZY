
import React, { useEffect, useState, useMemo } from 'react';
import { User, Transaction, TransactionType, TransactionStatus, StockItem } from '../types';
import { fetchTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import TharLoader from '../components/TharLoader';
import { 
  TrendingUp, 
  BarChart3, 
  AlertCircle, 
  IndianRupee, 
  Calendar,
  Layers,
  Box,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  History,
  Activity
} from 'lucide-react';

const fd = (n: number | string) => {
    const num = parseInt(n.toString()) || 0;
    return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

interface Props {
  user: User;
}

type PeriodFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';

interface PartPerformance {
  partNumber: string;
  name: string;
  qtySold: number;
  avgSellPrice: number;
  costBasis: number;
  totalRevenue: number;
  totalProfit: number;
  margin: number;
}

const ProfitAnalysis: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>('MONTH');

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
    let cutoffDate = new Date();

    switch (period) {
      case 'TODAY':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'WEEK':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
        cutoffDate = new Date(now.setDate(diff));
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'MONTH':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'YEAR':
        cutoffDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const cutoff = cutoffDate.getTime();
    
    // 1. Build a "Cost Basis" Map for every part
    // We look at the most recent APPROVED PURCHASE price for each part
    const costMap = new Map<string, number>();
    
    // First, seed with standard 12% discount from inventory MRP as default
    inventory.forEach(item => {
        costMap.set(item.partNumber.toUpperCase(), item.price * 0.88);
    });

    // Then, override with actual latest purchase prices if found in history
    const allPurchases = [...transactions]
        .filter(tx => tx.type === TransactionType.PURCHASE)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    allPurchases.forEach(tx => {
        costMap.set(tx.partNumber.toUpperCase(), tx.price);
    });

    // 2. Filter transactions for the selected period
    const periodTxs = transactions.filter(tx => new Date(tx.createdAt).getTime() >= cutoff);

    let totalEarnings = 0; // Only Sales - Returns
    let totalPurchaseValue = 0; // Actual spending in this period
    let totalCostOfSales = 0; 
    let salesCount = 0;
    let returnsCount = 0;

    const skuMap = new Map<string, { qty: number, rev: number }>();

    periodTxs.forEach(tx => {
        const pn = tx.partNumber.toUpperCase();
        const amount = tx.price * tx.quantity;
        const unitCost = costMap.get(pn) || 0;

        if (tx.type === TransactionType.SALE) {
            totalEarnings += amount;
            totalCostOfSales += (unitCost * tx.quantity);
            salesCount++;
            
            const current = skuMap.get(pn) || { qty: 0, rev: 0 };
            skuMap.set(pn, { qty: current.qty + tx.quantity, rev: current.rev + amount });
        } 
        else if (tx.type === TransactionType.RETURN) {
            totalEarnings -= amount;
            totalCostOfSales -= (unitCost * tx.quantity);
            returnsCount++;

            const current = skuMap.get(pn) || { qty: 0, rev: 0 };
            skuMap.set(pn, { qty: current.qty - tx.quantity, rev: current.rev - amount });
        }
        else if (tx.type === TransactionType.PURCHASE) {
            totalPurchaseValue += amount;
        }
    });

    const netProfit = totalEarnings - totalCostOfSales;
    const margin = totalEarnings > 0 ? (netProfit / totalEarnings) * 100 : 0;
    const isEarningMoreThanSpending = totalEarnings > totalPurchaseValue;

    // Build Table Data
    const tableData: PartPerformance[] = Array.from(skuMap.entries()).map(([pn, data]) => {
        const invItem = inventory.find(i => i.partNumber.toUpperCase() === pn);
        const costBasis = costMap.get(pn) || 0;
        const profit = data.rev - (costBasis * data.qty);
        return {
            partNumber: pn,
            name: invItem?.name || 'Unregistered Part',
            qtySold: data.qty,
            avgSellPrice: data.qty !== 0 ? data.rev / data.qty : 0,
            costBasis: costBasis,
            totalRevenue: data.rev,
            totalProfit: profit,
            margin: data.rev !== 0 ? (profit / data.rev) * 100 : 0
        };
    }).sort((a, b) => b.totalProfit - a.totalProfit);

    return {
      totalEarnings,
      totalPurchaseValue,
      netProfit,
      totalCostOfSales,
      margin,
      isEarningMoreThanSpending,
      salesCount,
      returnsCount,
      tableData
    };
  }, [transactions, inventory, period]);

  if (loading) return <TharLoader />;

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 animate-fade-in pb-32">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 px-2 pt-2">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-elevated border border-white/10 ring-8 ring-slate-100">
              <BarChart3 size={32} strokeWidth={2.5} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">Profit Intelligence</h1>
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Precision Financial Audit Log</p>
              </div>
           </div>
        </div>

        <div className="bg-slate-200/50 p-1.5 rounded-[1.75rem] border border-slate-200 shadow-inner-soft flex w-full md:w-auto">
          {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as PeriodFilter[]).map(f => (
            <button 
              key={f}
              onClick={() => setPeriod(f)}
              className={`flex-1 md:px-8 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${period === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {f === 'WEEK' ? 'This Week' : f === 'MONTH' ? 'This Month' : f === 'YEAR' ? 'This Year' : 'Today'}
            </button>
          ))}
        </div>
      </div>

      {/* PRIMARY METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-1">
        
        {/* Total Earning (Net Sales) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-soft flex flex-col justify-between group hover:shadow-premium transition-all">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Earnings</span>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl shadow-inner"><TrendingUp size={20} strokeWidth={2.5}/></div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums mb-1">₹{stats.totalEarnings.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Realized Revenue</p>
          </div>
        </div>

        {/* Total Purchase Value (Spending) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-soft flex flex-col justify-between group hover:shadow-premium transition-all">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Value</span>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><ArrowRightLeft size={20} strokeWidth={2.5}/></div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums mb-1">₹{stats.totalPurchaseValue.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory Investment</p>
          </div>
        </div>

        {/* Net Profit (Margin-based) */}
        <div className="bg-[#1E293B] p-8 rounded-[2.5rem] shadow-elevated flex flex-col justify-between relative overflow-hidden ring-1 ring-white/5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Actual Profit</span>
            <div className="p-3 bg-white/10 text-teal-400 rounded-2xl shadow-lg ring-1 ring-white/10"><Target size={20} strokeWidth={2.5}/></div>
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-black text-white tracking-tighter tabular-nums mb-2">₹{stats.netProfit.toLocaleString()}</p>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full border border-teal-400/20">{stats.margin.toFixed(1)}% Yield</span>
            </div>
          </div>
        </div>

        {/* Cash Flow Status */}
        <div className={`p-8 rounded-[2.5rem] border shadow-soft flex flex-col justify-between transition-all ${stats.isEarningMoreThanSpending ? 'bg-teal-50 border-teal-100' : 'bg-rose-50 border-rose-100'}`}>
          <div className="flex items-center justify-between mb-6">
            <span className={`text-[10px] font-black uppercase tracking-widest ${stats.isEarningMoreThanSpending ? 'text-teal-600' : 'text-rose-600'}`}>Period Settlement</span>
            <div className={`p-3 rounded-2xl shadow-inner ${stats.isEarningMoreThanSpending ? 'bg-white text-teal-600' : 'bg-white text-rose-600'}`}>
                {stats.isEarningMoreThanSpending ? <CheckCircle2 size={20} strokeWidth={2.5}/> : <AlertTriangle size={20} strokeWidth={2.5}/>}
            </div>
          </div>
          <div>
            <p className={`text-2xl font-black tracking-tight mb-1 ${stats.isEarningMoreThanSpending ? 'text-teal-900' : 'text-rose-900'}`}>
                {stats.isEarningMoreThanSpending ? 'REVENUE POSITIVE' : 'INVESTMENT MODE'}
            </p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${stats.isEarningMoreThanSpending ? 'text-teal-600/60' : 'text-rose-600/60'}`}>
                Earnings {stats.isEarningMoreThanSpending ? 'Exceed' : 'Below'} Spending
            </p>
          </div>
        </div>
      </div>

      {/* ANALYSIS SUB-SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-1">
        
        {/* LEFT: Stats Audit */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/80 shadow-soft">
                <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                    <Activity size={18} /> Cycle Statistics
                </h3>
                
                <div className="space-y-6">
                    <div className="flex justify-between items-end pb-5 border-b border-slate-50">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Validated Sales</span>
                        <span className="font-black text-slate-900 text-lg">{fd(stats.salesCount)} Logs</span>
                    </div>
                    <div className="flex justify-between items-end pb-5 border-b border-slate-50">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Processed Returns</span>
                        <span className="font-black text-rose-600 text-lg">{fd(stats.returnsCount)} Logs</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">COGS (Stock Cost)</span>
                        <span className="font-black text-slate-900 text-lg">₹{stats.totalCostOfSales.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mb-16"></div>
                <h3 className="font-black text-white/40 text-[10px] uppercase tracking-[0.3em] mb-6">Diagnostic Insight</h3>
                <p className="text-sm font-bold leading-relaxed mb-6">
                    {stats.isEarningMoreThanSpending 
                        ? `Operational performance is healthy. You have generated ₹${(stats.totalEarnings - stats.totalPurchaseValue).toLocaleString()} in cash flow beyond this period's spending.`
                        : `You have invested ₹${(stats.totalPurchaseValue - stats.totalEarnings).toLocaleString()} more into inventory than generated in sales this period. Ensure this stock translates to future revenue.`}
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black bg-black/20 w-fit px-3 py-1 rounded-full uppercase tracking-widest">
                    <Calendar size={12} /> Cycle: {period}
                </div>
            </div>
        </div>

        {/* RIGHT: SKU Performance Ledger */}
        <div className="lg:col-span-8">
            <div className="bg-white rounded-[3rem] shadow-premium border border-slate-200/60 overflow-hidden flex flex-col h-full">
                <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-soft border border-slate-100 text-blue-600">
                            <Box size={22} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none mb-1.5">SKU Profit Performance</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Realized Margin per Part Number</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] border-b border-slate-100 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-10 py-6">Part Description</th>
                                <th className="px-10 py-6 text-center">Net Qty</th>
                                <th className="px-10 py-6 text-right">Cost vs Sell</th>
                                <th className="px-10 py-6 text-right">Profit Yield</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stats.tableData.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-40 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-200">
                                            <History size={64} className="opacity-10 mb-6" />
                                            <p className="font-black uppercase tracking-[0.4em] text-[12px] text-slate-300">Journal Clear for period</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                stats.tableData.map(row => (
                                    <tr key={row.partNumber} className="hover:bg-slate-50/80 transition-all group">
                                        <td className="px-10 py-6">
                                            <div className="font-black text-slate-900 text-base uppercase tracking-tight leading-none mb-2 group-hover:text-blue-600 transition-colors">{row.partNumber}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px] tracking-tight">{row.name}</div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className={`text-lg font-black tracking-tight tabular-nums ${row.qtySold < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{row.qtySold < 0 ? '' : '+'}{row.qtySold}</span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase ml-2">PCS</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[12px] font-black text-slate-900 tabular-nums leading-none">₹{row.avgSellPrice.toLocaleString()}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cost: ₹{row.costBasis.toLocaleString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className={`flex items-center gap-1.5 font-black text-lg tracking-tighter tabular-nums leading-none ${row.totalProfit >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                                                    {row.totalProfit >= 0 ? <ArrowUpRight size={14} strokeWidth={3}/> : <ArrowDownRight size={14} strokeWidth={3}/>}
                                                    ₹{Math.abs(row.totalProfit).toLocaleString()}
                                                </div>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border ${row.totalProfit >= 0 ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                    {row.margin.toFixed(1)}% Margin
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="p-6 bg-slate-50/50 border-t border-slate-50 text-center no-print">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">End of Diagnostic Ledger</span>
                </div>
            </div>
        </div>
      </div>

    </div>
  );
};

export default ProfitAnalysis;
