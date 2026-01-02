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
  ArrowUpRight,
  ClipboardList,
  Zap,
  Clock
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
  const isManager = user.role === Role.MANAGER;

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
               {isManager ? 'Daily Operations' : 'Store Overview'}
            </h1>
            <p className="text-slate-500 font-medium text-sm">
               {isManager ? 'Fulfill sales and receive inventory updates.' : 'Real-time inventory and pricing at your fingertips.'}
            </p>
         </div>
         
         <div className="md:hidden flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl ${isManager ? 'bg-indigo-600' : 'bg-slate-900'}`}>
               {isManager ? <Zap size={24} /> : <PackageCheck size={24} />}
            </div>
            <div>
               <h1 className="text-2xl font-black text-slate-900 leading-none tracking-tight">{isManager ? 'Workdesk' : 'Main Hub'}</h1>
               <div className="flex items-center gap-2 mt-1.5">
                  <div className={`w-2 h-2 rounded-full ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-teal-500'} animate-pulse`}></div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{user.role} Privileges</p>
               </div>
            </div>
         </div>

         {isManager && (
            <button 
               onClick={() => navigate('/billing')}
               className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-xl shadow-indigo-100"
            >
               <Zap size={18} /> New Bill
            </button>
         )}
      </div>

      {/* STATS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {/* Valuation/Volume Card - HIDDEN ON MOBILE */}
         <div className={`hidden md:flex bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 items-center gap-5 transition-all hover:shadow-premium ${isManager ? 'md:col-span-2' : ''}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isManager ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
               <Banknote size={26} />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  {isManager ? 'Inventory Depth' : 'Asset Value'}
               </p>
               <p className="text-2xl font-black text-slate-900">
                  {isManager ? `${stats.totalItems.toLocaleString()} Units` : `₹${(stats.totalValue / 100000).toFixed(1)}L`}
               </p>
            </div>
         </div>

         {/* Stock Alerts Card */}
         <div 
            onClick={() => navigate('/low-stock')}
            className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 flex items-center gap-5 cursor-pointer hover:border-amber-200 hover:bg-amber-50 group transition-all"
         >
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
               <AlertCircle size={26} />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 group-hover:text-amber-700">Low Stock</p>
               <div className="flex items-center gap-2">
                  <p className="text-2xl font-black text-slate-900 group-hover:text-amber-900">{stats.lowStockCount}</p>
                  <ArrowUpRight size={16} className="text-slate-300 group-hover:text-amber-400" />
               </div>
            </div>
         </div>

         {/* Pending Approvals / Zero Stock */}
         <div 
            onClick={() => navigate(isManager ? '/movements' : '/out-of-stock')}
            className={`bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 flex items-center gap-5 cursor-pointer hover:shadow-premium group transition-all ${isManager ? 'border-indigo-100 bg-indigo-50/20' : 'hover:border-rose-200 hover:bg-rose-50'}`}
         >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isManager ? 'bg-indigo-600 text-white' : 'bg-rose-50 text-rose-600'}`}>
               {isManager ? <Clock size={26} /> : <XCircle size={26} />}
            </div>
            <div>
               <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isManager ? 'text-indigo-400' : 'text-slate-400 group-hover:text-rose-700'}`}>
                  {isManager ? 'Recent Audit' : 'Out of Stock'}
               </p>
               <p className={`text-2xl font-black ${isManager ? 'text-indigo-900' : 'text-slate-900 group-hover:text-rose-900'}`}>
                  {isManager ? 'Activity Log' : stats.zeroStockCount}
               </p>
            </div>
         </div>
      </div>

      {/* SEARCH SECTION */}
      <div className="relative group no-print">
         <div className={`absolute -inset-1 rounded-[2.5rem] blur opacity-5 group-hover:opacity-10 transition duration-500 ${isManager ? 'bg-indigo-600' : 'bg-brand-600'}`}></div>
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
                <div className={`w-2 h-2 rounded-full animate-pulse ${isManager ? 'bg-indigo-500' : 'bg-brand-500'}`}></div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {searchQuery ? `FOUND INVENTORY FOR "${searchQuery}"` : "LIVE CATALOG FEED"}
                </span>
            </div>
            <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-sm ${isManager ? 'bg-indigo-50 text-indigo-600' : 'bg-brand-50 text-brand-600'}`}>
                <Eye size={14} /> Tap to Reveal Prices
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