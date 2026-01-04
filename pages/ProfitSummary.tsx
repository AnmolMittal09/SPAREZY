
import React, { useEffect, useState, useMemo } from 'react';
import { Transaction, StockItem, TransactionType, TransactionStatus, Role } from '../types';
import { fetchTransactions } from '../services/transactionService';
import { fetchInventory } from '../services/inventoryService';
import { 
  TrendingUp, 
  AlertTriangle, 
  TrendingDown, 
  Target, 
  ArrowRight, 
  Filter, 
  Download,
  Info,
  ChevronUp,
  ChevronDown,
  Percent,
  Calculator,
  ShieldAlert
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

const BENCHMARK_DISCOUNT = 0.12; // 12% Standard B.DC

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const formatPercent = (val: number) => `${val.toFixed(2)}%`;

const ProfitSummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [filterBrand, setFilterBrand] = useState<'ALL' | 'HYUNDAI' | 'MAHINDRA'>('ALL');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [txData, invData] = await Promise.all([
        fetchTransactions(TransactionStatus.APPROVED),
        fetchInventory()
      ]);
      setTransactions(txData);
      setInventory(invData);
      setLoading(false);
    };
    loadData();
  }, []);

  // --- ANALYTICS ENGINE ---
  const stats = useMemo(() => {
    const mrpMap = new Map(inventory.map(i => [i.partNumber.toUpperCase(), i.price]));
    const brandMap = new Map(inventory.map(i => [i.partNumber.toUpperCase(), i.brand]));

    let totalRevenue = 0;
    let totalPurchaseCost = 0;
    let totalLeakage = 0;
    let salesCount = 0;

    const vendorStats: Record<string, { cost: number, leakage: number, count: number }> = {};
    const partStats: Record<string, { revenue: number, cost: number, qtySold: number, qtyBought: number, leakage: number }> = {};

    transactions.forEach(tx => {
      const pn = tx.partNumber.toUpperCase();
      const brand = brandMap.get(pn);
      if (filterBrand !== 'ALL' && brand !== filterBrand) return;

      const mrp = mrpMap.get(pn) || 0;
      const amount = tx.price * tx.quantity;

      if (!partStats[pn]) {
        partStats[pn] = { revenue: 0, cost: 0, qtySold: 0, qtyBought: 0, leakage: 0 };
      }

      if (tx.type === TransactionType.SALE) {
        totalRevenue += amount;
        salesCount += tx.quantity;
        partStats[pn].revenue += amount;
        partStats[pn].qtySold += tx.quantity;
      } 
      else if (tx.type === TransactionType.PURCHASE) {
        totalPurchaseCost += amount;
        partStats[pn].cost += amount;
        partStats[pn].qtyBought += tx.quantity;

        // Leakage Calculation: (Actual Net Price - Benchmark Net Price) * Qty
        // Benchmark Net = MRP * (1 - 0.12)
        if (mrp > 0) {
          const benchmarkPrice = mrp * (1 - BENCHMARK_DISCOUNT);
          const deviation = tx.price - benchmarkPrice;
          if (deviation > 0.1) { // Only count if paying MORE than benchmark
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

    const netProfit = totalRevenue - (totalRevenue * 0.85); // Estimated placeholder COGS if data is partial
    // Realized Profit (Aggregated)
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

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
         <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg">
               <Calculator size={20} />
            </div>
            <div>
               <h2 className="text-lg font-black text-slate-900 tracking-tight">Profit & Margin Audit</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Benchmark: 12% Basic Discount</p>
            </div>
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
            <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition-all">
               <Download size={18} />
            </button>
         </div>
      </div>

      {/* PRIMARY KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={64}/></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Revenue</p>
            <h3 className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(stats.totalRevenue)}</h3>
            <div className="mt-4 flex items-center gap-2">
               <span className="text-[9px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase">Verified Invoiced</span>
            </div>
         </div>

         <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ArrowRight size={64}/></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acquisition Cost</p>
            <h3 className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(stats.totalPurchaseCost)}</h3>
            <p className="text-[10px] text-slate-400 mt-4 font-bold">Total Inbound Payments</p>
         </div>

         <div className="bg-slate-900 p-6 rounded-[2rem] shadow-elevated relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-white"><Target size={64}/></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Net Margin %</p>
            <h3 className="text-3xl font-black text-white tabular-nums">{stats.margin.toFixed(1)}%</h3>
            <div className={`mt-4 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${stats.margin > 12 ? 'bg-teal-500/20 text-teal-400' : 'bg-rose-500/20 text-rose-400'}`}>
               {stats.margin > 12 ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
               {stats.margin > 12 ? 'Healthy' : 'Below Target'}
            </div>
         </div>

         <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-rose-600"><ShieldAlert size={64}/></div>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Margin Leakage</p>
            <h3 className="text-2xl font-black text-rose-600 tabular-nums">{formatCurrency(stats.totalLeakage)}</h3>
            <p className="text-[10px] text-rose-500/70 mt-4 font-bold flex items-center gap-1">
               <AlertTriangle size={12} /> Loss due to low B.DC
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* LEFT: LEAKAGE BY PART */}
         <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-soft overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Top Leakage Offenders</h3>
               </div>
               <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-lg">By Item SKU</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[500px] no-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md z-10 border-b border-slate-100">
                     <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Part Details</th>
                        <th className="px-6 py-4 text-center">Qty Bought</th>
                        <th className="px-6 py-4 text-right">Avg Cost</th>
                        <th className="px-6 py-4 text-right text-rose-600">Leakage</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {stats.partImpact.filter(p => p.leakage > 0).map((part, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{part.pn}</div>
                              <div className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">Purchased at low discount</div>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">{part.qtyBought}</span>
                           </td>
                           <td className="px-6 py-4 text-right tabular-nums text-xs font-bold text-slate-700">
                              {formatCurrency(part.cost / part.qtyBought)}
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
         </div>

         {/* RIGHT: VENDOR PERFORMANCE */}
         <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-soft overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
               <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Vendor Margin Analysis</h3>
            </div>
            <div className="p-6 space-y-4 flex-1 overflow-auto no-scrollbar">
               {stats.vendorImpact.length === 0 ? (
                  <div className="h-60 flex flex-col items-center justify-center text-slate-300">
                     <Info size={48} className="opacity-10 mb-4" />
                     <p className="text-[10px] font-black uppercase tracking-widest">No Vendor Data</p>
                  </div>
               ) : (
                  stats.vendorImpact.map((vendor, i) => {
                     const leakagePercent = (vendor.leakage / vendor.cost) * 100;
                     return (
                        <div key={i} className="p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-brand-100 hover:shadow-md transition-all">
                           <div className="flex justify-between items-start mb-3">
                              <div className="min-w-0 pr-4">
                                 <h4 className="font-bold text-slate-900 truncate leading-tight">{vendor.name}</h4>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{vendor.count} Inbound Bills</p>
                              </div>
                              <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${leakagePercent > 1 ? 'bg-rose-100 text-rose-600' : 'bg-teal-100 text-teal-600'}`}>
                                 {leakagePercent > 1 ? 'Poor Disc' : 'Quality'}
                              </div>
                           </div>
                           <div className="flex items-end justify-between border-t border-slate-200/50 pt-3 mt-3">
                              <div>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total Leakage</p>
                                 <p className="text-lg font-black text-rose-600 tabular-nums">{formatCurrency(vendor.leakage)}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Bill Impact</p>
                                 <p className="text-sm font-black text-slate-900 tabular-nums">{leakagePercent.toFixed(2)}%</p>
                              </div>
                           </div>
                        </div>
                     )
                  })
               )}
            </div>
         </div>
      </div>

      {/* DISCREPANCY INSIGHTS */}
      <div className="bg-amber-50 rounded-[2.5rem] p-8 border border-amber-100 flex flex-col md:flex-row items-center gap-8 shadow-sm">
         <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 flex-none shadow-inner">
            <Calculator size={40} />
         </div>
         <div className="flex-1">
            <h4 className="text-xl font-black text-amber-900 tracking-tight leading-none mb-2 uppercase">Profit Recovery Strategy</h4>
            <p className="text-sm font-medium text-amber-800/80 leading-relaxed max-w-2xl">
               You have lost <b>{formatCurrency(stats.totalLeakage)}</b> this period due to purchases made at less than 12% Basic Discount. 
               To maintain your target margins, you must either negotiate better rates with <b>{stats.vendorImpact[0]?.name || 'Suppliers'}</b> or increase 
               your retail markup on these specific SKUs.
            </p>
         </div>
         <button className="bg-amber-900 text-white font-black px-8 py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-amber-200 transition-all active:scale-95 flex-none">
            Audit Part Prices
         </button>
      </div>
    </div>
  );
};

export default ProfitSummary;
