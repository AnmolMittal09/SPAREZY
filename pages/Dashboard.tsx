import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem, Role, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search,
  PackageCheck,
  Zap,
  Filter,
  RefreshCw,
  Box,
  TrendingUp,
  LayoutGrid
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
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await fetchInventory();
      setInventory(data);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    if (!('ontouchstart' in window)) {
        setTimeout(() => searchInputRef.current?.focus(), 800);
    }
  }, []);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-8 animate-fade-in flex flex-col max-w-6xl mx-auto">
      
      {/* HEADER - Integrated Brand Filter & Refresh */}
      <div className="flex flex-col gap-6 no-print px-1 pt-2">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-3d transform -rotate-3">
                  <LayoutGrid size={28} strokeWidth={2.5} />
               </div>
               <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">
                     Stock Control
                  </h1>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">SECURE {user.role} CHANNEL</p>
               </div>
               <button 
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className={`ml-4 p-4 rounded-2xl bg-white border border-white shadow-3d text-slate-400 hover:text-brand-600 transition-all active:scale-90 ${refreshing ? 'opacity-50' : ''}`}
                  title="Refresh Inventory"
               >
                  <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
               </button>
            </div>
            <div className="hidden sm:block bg-white p-2 rounded-3xl shadow-3d border border-white">
                <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-inner-3d transform transition-transform hover:rotate-12">
                   <PackageCheck size={24} strokeWidth={2.5} />
                </div>
            </div>
         </div>

         {/* Compact Brand Filter */}
         <div className="flex bg-slate-100/50 p-2 rounded-[2rem] border border-white/50 shadow-inner-3d">
             {/* Fix: Removed unnecessary check b !== Brand.UNKNOWN because 'UNKNOWN' is not in the source array. */}
             {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                <button 
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all duration-500 active:scale-95 ${
                    selectedBrand === b 
                      ? 'bg-white text-slate-900 shadow-3d ring-1 ring-slate-200' 
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {b}
                </button>
             ))}
         </div>
      </div>

      {/* SEARCH HERO */}
      <div className="relative group no-print">
         <div className="absolute inset-0 bg-brand-500/10 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-1000"></div>
         <div className="relative bg-white rounded-[3.5rem] p-10 shadow-3d border border-white overflow-hidden transition-all duration-700 hover:shadow-3d-hover">
            <div className="flex flex-col gap-6 relative z-10">
                <div className="relative">
                    <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={32} strokeWidth={2.5} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        className="block w-full pl-22 pr-8 py-10 rounded-[2.5rem] bg-slate-50 border-4 border-transparent text-2xl font-black text-slate-900 placeholder:text-slate-200 focus:bg-white focus:border-brand-500/10 focus:ring-[20px] focus:ring-brand-500/5 transition-all outline-none shadow-inner-3d"
                        placeholder="Search SKU Registry..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 font-black text-xs bg-white px-5 py-3 rounded-2xl shadow-3d transition-all border border-slate-100 uppercase tracking-widest active:scale-90"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* RESULTS AREA */}
      <div className="bg-white rounded-[3.5rem] shadow-3d border border-white overflow-hidden flex flex-col flex-1 min-h-[500px] transition-all duration-700">
         <div className="p-8 md:p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 backdrop-blur-xl">
            <div className="flex items-center gap-5">
                <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse shadow-[0_0_10px_#0ea5e9]"></div>
                <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">
                    {searchQuery ? `Lookup Results for "${searchQuery}"` : "Master Inventory Feed"}
                </h3>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{inventory.length} Verified Entries</span>
            </div>
         </div>
         <div className="flex-1 min-h-0 bg-white">
            <StockTable 
               items={inventory} 
               userRole={user.role}
               brandFilter={selectedBrand === 'ALL' ? undefined : selectedBrand}
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