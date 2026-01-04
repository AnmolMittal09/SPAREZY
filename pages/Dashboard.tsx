
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
  LayoutGrid,
  Activity
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
        setTimeout(() => searchInputRef.current?.focus(), 500);
    }
  }, []);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in flex flex-col max-w-5xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col gap-6 no-print px-1 pt-2">
         <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-slate-900 rounded-[1.25rem] flex items-center justify-center text-white shadow-elevated">
                   <Activity size={24} strokeWidth={2.5} />
               </div>
               <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                     Command Center
                  </h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{user.role} INTERFACE • v4.2</p>
               </div>
            </div>
            <button 
                onClick={() => loadData(true)}
                disabled={refreshing}
                className={`p-3 rounded-2xl bg-white border border-slate-200/60 shadow-soft text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all active:scale-95 ${refreshing ? 'opacity-50' : ''}`}
                title="Synchronize Database"
            >
                <RefreshCw size={20} strokeWidth={2.5} className={refreshing ? 'animate-spin' : ''} />
            </button>
         </div>

         {/* Brand Switcher - Professional Toggle */}
         <div className="flex bg-slate-200/40 p-1.5 rounded-[1.5rem] border border-slate-200/50 shadow-inner-soft max-w-md">
             {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                <button 
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`flex-1 py-3 rounded-[1.15rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                    selectedBrand === b 
                      ? 'bg-white text-slate-900 shadow-elevated ring-1 ring-slate-200' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {b}
                </button>
             ))}
         </div>
      </div>

      {/* SEARCH AREA - Highly Polished */}
      <div className="relative group no-print">
         <div className="relative bg-white rounded-[2.5rem] p-6 md:p-8 shadow-premium border border-slate-200/80 overflow-hidden transition-all group-focus-within:border-brand-300 group-focus-within:shadow-elevated">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full -mr-32 -mt-32 -z-0"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-50/10 rounded-full -ml-16 -mb-16 -z-0"></div>
            
            <div className="flex flex-col relative z-10">
                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={28} strokeWidth={2.5} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        className="block w-full pl-16 pr-8 py-6 rounded-3xl bg-slate-100/50 border-2 border-transparent text-2xl font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/10 focus:ring-12 focus:ring-brand-500/5 transition-all outline-none shadow-inner-soft"
                        placeholder="Scan Part Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-rose-500 hover:text-rose-600 font-black text-[10px] bg-rose-50 px-4 py-2 rounded-xl shadow-soft transition-all border border-rose-100 uppercase tracking-[0.2em] active:scale-90"
                        >
                            Reset
                        </button>
                    )}
                </div>
                {!searchQuery && (
                   <div className="flex items-center gap-2 mt-4 ml-6 animate-fade-in">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory scanner ready...</span>
                   </div>
                )}
            </div>
         </div>
      </div>

      {/* CATALOG CONTAINER */}
      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200/60 overflow-hidden flex flex-col flex-1 min-h-[600px] transition-all">
         <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white rounded-2xl shadow-soft border border-slate-100 text-brand-600">
                    <LayoutGrid size={20} strokeWidth={2.5} />
                </div>
                <div>
                   <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] leading-none mb-1">
                       {searchQuery ? "Search Results" : "Master Inventory"}
                   </h3>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Real-time Stock Ledger</p>
                </div>
            </div>
            {searchQuery && (
               <span className="bg-brand-50 text-brand-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-brand-100">
                  {inventory.filter(i => i.partNumber.toLowerCase().includes(searchQuery.toLowerCase())).length} Results
               </span>
            )}
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
