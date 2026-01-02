import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem, Role } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search,
  AlertCircle,
  Eye,
  PackageCheck,
  TrendingUp,
  Banknote,
  Package,
  XCircle,
  ArrowUpRight
} from 'lucide-react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import TharLoader from '../components/TharLoader';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchInventory();
      setInventory(data);
      setLoading(false);
    };
    loadData();
    
    if (!('ontouchstart' in window)) {
        setTimeout(() => searchInputRef.current?.focus(), 500);
    }
  }, []);

  if (loading) return <TharLoader />;

  const stats = getStats(inventory);

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in h-full flex flex-col pb-10">
      
      {/* HEADER */}
      <div className="flex justify-between items-center no-print px-1">
         <div className="hidden md:block">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
               Store Overview
            </h1>
            <p className="text-slate-500 font-medium text-sm">Real-time inventory and pricing at your fingertips.</p>
         </div>
         
         <div className="md:hidden flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
               <PackageCheck size={24} />
            </div>
            <div>
               <h1 className="text-2xl font-black text-slate-900 leading-none tracking-tight">Main Hub</h1>
               <div className="flex items-center gap-2 mt-1.5">
                  <div className={`w-2 h-2 rounded-full ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-teal-500'} animate-pulse`}></div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{user.role} Privileges</p>
               </div>
            </div>
         </div>
      </div>

      {/* MOBILE STATS SCROLL - Clean Cards */}
      <div className="md:hidden flex gap-4 overflow-x-auto no-scrollbar py-2 -mx-1 px-1">
         <div className="flex-none w-[180px] bg-white p-5 rounded-[2rem] shadow-soft border border-slate-100 flex flex-col gap-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Banknote size={20} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inventory Value</p>
               <p className="text-xl font-black text-slate-900">₹{(stats.totalValue / 100000).toFixed(1)}L</p>
            </div>
         </div>
         <div className="flex-none w-[180px] bg-white p-5 rounded-[2rem] shadow-soft border border-slate-100 flex flex-col gap-4">
            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center"><Package size={20} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Items</p>
               <p className="text-xl font-black text-slate-900">{stats.totalItems.toLocaleString()}</p>
            </div>
         </div>
         <div className="flex-none w-[180px] bg-rose-50 p-5 rounded-[2rem] shadow-soft border border-rose-100 flex flex-col gap-4" onClick={() => navigate('/out-of-stock')}>
            <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200"><XCircle size={20} /></div>
            <div>
               <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Zero Stock</p>
               <div className="flex items-center justify-between">
                  <p className="text-xl font-black text-rose-700">{stats.zeroStockCount}</p>
                  <ArrowUpRight size={16} className="text-rose-300" />
               </div>
            </div>
         </div>
      </div>

      {/* SEARCH SECTION - Refined for Quick Actions */}
      <div className="relative group no-print">
         <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-[2.5rem] blur opacity-5 group-hover:opacity-10 transition duration-500"></div>
         <div className="relative bg-white rounded-[2.5rem] p-6 lg:p-10 shadow-premium border border-slate-50">
            <div className="flex flex-col gap-6 lg:gap-8">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-slate-50 text-slate-900 rounded-[1.5rem] lg:rounded-[2rem] flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                        <Search size={24} strokeWidth={2.5} className="lg:size-[32px]" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">Find Spare Part</h2>
                        <p className="text-[11px] lg:text-xs text-slate-400 font-bold uppercase tracking-[0.25em] mt-2.5">Global Inventory Lookup</p>
                    </div>
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="p-3 bg-rose-50 text-rose-500 rounded-2xl active:scale-90 transition-all font-black text-[10px] uppercase tracking-widest">Clear</button>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={24} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        autoComplete="off"
                        className="block w-full pl-16 pr-8 py-5 lg:py-7 rounded-[2rem] lg:rounded-[2.5rem] bg-slate-50 border-2 border-transparent text-xl lg:text-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/10 focus:ring-[12px] focus:ring-brand-500/5 transition-all outline-none shadow-inner"
                        placeholder="Search SKU or Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mr-2">Quick Filters:</span>
                    <button onClick={() => setSearchQuery('HY-')} className="px-5 py-2.5 bg-white border border-slate-100 text-[11px] font-black text-blue-600 rounded-2xl shadow-sm active:bg-blue-600 active:text-white transition-all hover:border-blue-200">HYUNDAI</button>
                    <button onClick={() => setSearchQuery('MH-')} className="px-5 py-2.5 bg-white border border-slate-100 text-[11px] font-black text-red-600 rounded-2xl shadow-sm active:bg-red-600 active:text-white transition-all hover:border-red-200">MAHINDRA</button>
                    <div className="h-6 w-px bg-slate-100 mx-2"></div>
                    <button onClick={() => navigate('/low-stock')} className="px-5 py-2.5 bg-amber-50 text-[11px] font-black text-amber-700 rounded-2xl shadow-sm active:bg-amber-600 active:text-white transition-all flex items-center gap-2">
                        <AlertCircle size={14} /> LOW STOCK ({stats.lowStockCount})
                    </button>
                </div>
            </div>
         </div>
      </div>

      {/* RESULTS AREA */}
      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-50 overflow-hidden flex flex-col flex-1 min-h-[400px]">
         <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {searchQuery ? `FOUND INVENTORY FOR "${searchQuery}"` : "LIVE CATALOG FEED"}
                </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-brand-600 uppercase tracking-widest bg-brand-50 px-3 py-1.5 rounded-xl shadow-sm">
                <Eye size={14} /> Reveal Prices
            </div>
         </div>
         <div className="flex-1 min-h-0">
            <StockTable 
               items={inventory} 
               userRole={user.role}
               enableActions={true}
               hideToolbar={true}
               externalSearch={searchQuery}
               hidePriceByDefault={true}
            />
         </div>
      </div>

    </div>
  );
};

export default Dashboard;