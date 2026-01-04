import React, { useEffect, useState, useMemo } from 'react';
import { Transaction, StockItem, TransactionType, TransactionStatus, Brand } from '../types';
import { fetchTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  ArrowRight, 
  Download,
  Info,
  ChevronUp,
  ChevronDown,
  Calculator,
  ShieldAlert,
  RefreshCw,
  Box,
  IndianRupee
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

const BENCHMARK_DISCOUNT = 0.12; // 12% Standard B.DC

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const ProfitSummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [filterBrand, setFilterBrand] = useState<'ALL' | 'HYUNDAI' | 'MAHINDRA'>('ALL');

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    try {
      const [txData, invData] = await Promise.all([
        fetchTransactions(TransactionStatus.APPROVED),
        fetchInventory()
      ]);
      setTransactions(txData);
      setInventory(invData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const mrpMap = new Map(inventory.map(i => [i.partNumber.toUpperCase(), i.price]));
    const brandMap = new Map(inventory.map(i => [i.partNumber.toUpperCase(), i.brand]));
    // Fix: Create a map for part names to fix property missing error in the UI
    const nameMap = new Map(inventory.map(i => [i.partNumber.toUpperCase(), i.name]));

    let totalRevenue = 0;
    let totalPurchaseCost = 0;
    let totalLeakage = 0;

    const vendorStats: Record<string, { cost: number, leakage: number, count: number }> = {};
    // Fix: Added 'name' property to the partStats record type
    const partStats: Record<string, { revenue: number, cost: number, qtySold: number, qtyBought: number, leakage: number, mrp: number, name: string }> = {};

    transactions.forEach(tx => {
      const pn = tx.partNumber.toUpperCase();
      const brand = brandMap.get(pn);
      if (filterBrand !== 'ALL' && brand !== filterBrand) return;

      const mrp = mrpMap.get(pn) || 0;
      const amount = tx.price * tx.quantity;

      if (!partStats[pn]) {
        // Fix: Populate the 'name' property when initializing part statistics
        partStats[pn] = { 
          revenue: 0, 
          cost: 0, 
          qtySold: 0, 
          qtyBought: 0, 
          leakage: 0, 
          mrp,
          name: nameMap.get(pn) || 'N/A'
        };
      }

      if (tx.type === TransactionType.SALE) {
        totalRevenue += amount;
        partStats[pn].revenue += amount;
        partStats[pn].qtySold += tx.quantity;
      } 
      else if (tx.type === TransactionType.PURCHASE) {
        totalPurchaseCost += amount;
        partStats[pn].cost += amount;
        partStats[pn].qtyBought += tx.quantity;

        if (mrp > 0) {
          const benchmarkPrice = mrp * (1 - BENCHMARK_DISCOUNT);
          const deviation = tx.price - benchmarkPrice;
          if (deviation > 0.1) {
            const leakage = deviation * tx.quantity;
            totalLeakage += leakage;
            partStats[pn].leakage += leakage;

            const vendor = tx.customerName || 'Unknown Vendor';
            if (!vendorStats[vendor]) vendorStats[vendor] = { cost: 0, leakage: 0, count: 0 };
            vendorStats[vendor].cost += amount;
            vendorStats[vendor].leakage += leakage;
            vendorStats[vendor].count++;
          }
        }
      }
    });

    const realizedProfit = totalRevenue - totalPurchaseCost;

    return {
      totalRevenue,
      totalPurchaseCost,
      totalLeakage,
      realizedProfit,
      margin: totalRevenue > 0 ? (realizedProfit / totalRevenue) * 100 : 0,
      vendorImpact: Object.entries(vendorStats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.leakage - a.leakage),
      partImpact: Object.entries(partStats).map(([pn, data]) => ({ pn, ...data })).sort((a, b) => b.leakage - a.leakage)
    };
  }, [transactions, inventory, filterBrand]);

  if (loading && !refreshing) return <TharLoader />;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in pb-20">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
         <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg">
               <Calculator size={20} />
            </div>
            <div>
               <h2 className="text-lg font-black text-slate-900 tracking-tight">Profit & Margin Audit</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target: 12% Basic Discount</p>
            </div>
            <button 
                onClick={() => loadData(true)}
                disabled={refreshing}
                className={`p-2 ml-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-brand-600 transition-all active:scale-95 ${refreshing ? 'opacity-50' : ''}`}
            >
               <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
         </div>
         <div className="flex items-center gap-2 w-full md:w-auto">
            <select 
               className="flex-1 md:w-40 bg-slate-50 border-none rounded-xl text-xs font-bold p-2.5 outline-none ring-1 ring-slate-200 focus:ring-brand-500"
               value={filterBrand}
               onChange={e => setFilterBrand(e.target.value as any)}
            >
               <option value="ALL">All Brands</option>
               <option value="HYUNDAI">Hyundai</option>
               <option value="MAHINDRA">Mahindra</option>
            </select>
            <button className="hidden md:flex p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-all">
               <Download size={18} />
            </button>
         </div>
      </div>

      {/* PRIMARY KPIS - GRID OPTIMIZED */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
         <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-soft">
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Rev</p>
            <h3 className="text-lg md:text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(stats.totalRevenue)}</h3>
            <div className="mt-3 flex items-center gap-1.5">
               <div className="w-1 h-1 rounded-full bg-teal-500"></div>
               <span className="text-[8px] font-black text-teal-600 uppercase">Settled</span>
            </div>
         </div>

         <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-soft">
            <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acq. Cost</p>
            <h3 className="text-lg md:text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(stats.totalPurchaseCost)}</h3>
            <p className="text-[8px] text-slate-400 mt-3 font-bold uppercase">Inbound Value</p>
         </div>

         <div className="bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-elevated">
            <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Net Margin</p>
            <h3 className="text-lg md:text-3xl font-black text-white tabular-nums">{stats.margin.toFixed(1)}%</h3>
            <div className={`mt-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${stats.margin > 12 ? 'bg-teal-500/20 text-teal-400' : 'bg-rose-500/20 text-rose-400'}`}>
               {stats.margin > 12 ? 'Above Target' : 'Low Margin'}
            </div>
         </div>

         <div className="bg-rose-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-rose-100 shadow-soft">
            <p className="text-[8px] md:text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Leakage</p>
            <h3 className="text-lg md:text-2xl font-black text-rose-600 tabular-nums">{formatCurrency(stats.totalLeakage)}</h3>
            <p className="text-[8px] text-rose-500 mt-3 font-bold uppercase flex items-center gap-1">
               <AlertTriangle size={10} /> Discount Loss
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* OFFENDERS LIST - MOBILE OPTIMIZED */}
         <div className="lg:col-span-2 bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-soft overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
               <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs md:text-sm">Critical Margin Leakage By SKU</h3>
               <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase bg-white px-2 py-1 rounded-lg border border-slate-200">High Density Data</span>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block flex-1 overflow-auto max-h-[500px]">
               <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                     <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Part Details</th>
                        <th className="px-6 py-4 text-center">Inbound Qty</th>
                        <th className="px-6 py-4 text-right">Avg Cost</th>
                        <th className="px-6 py-4 text-right text-rose-600">Leakage Impact</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {stats.partImpact.filter(p => p.leakage > 0).map((part, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{part.pn}</div>
                              {/* Fix: part.name is now accessible on the derived type */}
                              <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{part.name || 'No Description'}</div>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">{part.qtyBought}</span>
                           </td>
                           <td className="px-6 py-4 text-right tabular-nums text-xs font-bold text-slate-700">
                              {formatCurrency(part.cost / (part.qtyBought || 1))}
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="text-xs font-black text-rose-600">{formatCurrency(part.leakage)}</div>
                              <div className="text-[8px] font-bold text-rose-400 uppercase">Margin Lost</div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex-1 overflow-y-auto max-h-[400px] p-4 space-y-3">
                {stats.partImpact.filter(p => p.leakage > 0).map((part, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-black text-slate-900 text-[14px] leading-none mb-1">{part.pn}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{part.qtyBought} Units Bought</div>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Loss Impact</p>
                                <p className="text-[15px] font-black text-rose-600 tabular-nums">{formatCurrency(part.leakage)}</p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                            <div>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Avg Cost Paid</p>
                                <p className="text-xs font-bold text-slate-700">{formatCurrency(part.cost / (part.qtyBought || 1))}</p>
                            </div>
                            <div className="bg-rose-50 text-rose-600 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider">
                                Audit Required
                            </div>
                        </div>
                    </div>
                ))}
            </div>
         </div>

         {/* VENDOR ANALYSIS */}
         <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-soft overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-slate-100">
               <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs md:text-sm">Dealer Compliance</h3>
            </div>
            <div className="p-4 md:p-6 space-y-4 flex-1 overflow-auto no-scrollbar">
               {stats.vendorImpact.length === 0 ? (
                  <div className="h-60 flex flex-col items-center justify-center text-slate-300">
                     <Info size={40} className="opacity-10 mb-4" />
                     <p className="text-[10px] font-black uppercase tracking-widest">No Dealer Data</p>
                  </div>
               ) : (
                  stats.vendorImpact.map((vendor, i) => {
                     const leakagePercent = (vendor.leakage / vendor.cost) * 100;
                     return (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-brand-100 transition-all">
                           <div className="flex justify-between items-start mb-3">
                              <div className="min-w-0 pr-4">
                                 <h4 className="font-bold text-slate-900 truncate text-[13px]">{vendor.name}</h4>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{vendor.count} Invoices Audited</p>
                              </div>
                              <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${leakagePercent > 1 ? 'bg-rose-100 text-rose-600' : 'bg-teal-100 text-teal-600'}`}>
                                 {leakagePercent > 1 ? 'Failed' : 'Compliant'}
                              </div>
                           </div>
                           <div className="flex items-end justify-between border-t border-slate-200/50 pt-2.5 mt-2.5">
                              <div>
                                 <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Leakage</p>
                                 <p className="text-sm font-black text-rose-600 tabular-nums">{formatCurrency(vendor.leakage)}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Deviation</p>
                                 <p className="text-xs font-black text-slate-900 tabular-nums">{leakagePercent.toFixed(1)}%</p>
                              </div>
                           </div>
                        </div>
                     )
                  })
               )}
            </div>
         </div>
      </div>

      {/* STRATEGY CALLOUT - RESPONSIVE STACKING */}
      <div className="bg-amber-50 rounded-[2rem] p-6 md:p-8 border border-amber-100 flex flex-col md:flex-row items-center gap-6 md:gap-8 shadow-sm">
         <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 flex-none">
            <ShieldAlert size={32} />
         </div>
         <div className="flex-1 text-center md:text-left">
            <h4 className="text-lg md:text-xl font-black text-amber-900 tracking-tight leading-none mb-2 uppercase">Purchase Recovery Logic</h4>
            <p className="text-xs md:text-sm font-medium text-amber-800/80 leading-relaxed max-w-2xl">
               You are losing margin on <b>{stats.partImpact.filter(p => p.leakage > 0).length} SKU clusters</b>. 
               This leakage is worth <b>{formatCurrency(stats.totalLeakage)}</b> this period. 
               Direct instruction: Negotiate a flat 12% B.DC with <b>{stats.vendorImpact[0]?.name || 'Dealers'}</b> or update counter price markup immediately.
            </p>
         </div>
         <button className="w-full md:w-auto bg-amber-900 text-white font-black px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all">
            Audit Selling Prices
         </button>
      </div>
    </div>
  );
};

export default ProfitSummary;