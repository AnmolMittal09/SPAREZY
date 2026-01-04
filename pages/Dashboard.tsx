import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem, Role, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search,
  PackageCheck,
  Zap,
  Filter,
  RefreshCw
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
    <div className="space-y-6 md:space-y-8 animate-fade-in flex flex-col max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col gap-6 no-print px-1 pt-2">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-1.5">
                     Dashboard
                  </h1>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.25em]">{user.role} VIEW</p>
               </div>
               <button 
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className={`p-2.5 rounded-2xl bg-white border border-slate-200/60 shadow-soft text-slate-400 hover:text-brand-600 transition-all active:scale-90 ${refreshing ? 'opacity-50' : ''}`}
                  title="Force Sync"
               >
                  <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
               </button>
            </div>
            <div className="bg-white p-2 rounded-2xl shadow-soft border border-slate-100 ring-1 ring-slate-100">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                   <PackageCheck size={20} />
                </div>
            </div>
         </div>

         {/* Brand Switcher */}
         <div className="flex bg-slate-200/40 p-1.5 rounded-[1.5rem] border border-slate-200/50 shadow-inner-soft">
             {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                <button 
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.97] ${
                    selectedBrand === b 
                      ? 'bg-white text-slate-900 shadow-elevated ring-1 ring-slate-200' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {b}
                </button>
             ))}
         </div>
      </div>

      {/* SEARCH AREA */}
      <div className="relative group no-print">
         <div className="relative bg-white rounded-[3.5rem] p-8 shadow-elevated border border-slate-200/60 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full -mr-32 -mt-32 -z-0"></div>
            <div className="flex flex-col gap-5 relative z-10">
                <div className="relative">
                    <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={28} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        className="block w-full pl-18 pr-8 py-7 rounded-[2.5rem] bg-slate-100/60 border-2 border-transparent text-2xl font-black text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/10 focus:ring-[15px] focus:ring-brand-500/5 transition-all outline-none shadow-inner-soft"
                        placeholder="Search Spare Part SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 font-black text-[10px] bg-white px-4 py-2.5 rounded-2xl shadow-soft transition-all border border-slate-100 uppercase tracking-widest"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* CATALOG CONTAINER */}
      <div className="bg-white rounded-[3.5rem] shadow-premium border border-slate-200/50 overflow-hidden flex flex-col flex-1 min-h-[500px] mb-12">
         <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/10">
            <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {searchQuery ? `Scanning SKU: "${searchQuery}"` : "Active Master Catalog"}
                </h3>
            </div>
         </div>
         <div className="flex-1 min-h-0">
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