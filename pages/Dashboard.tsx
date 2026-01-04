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
    <div className="space-y-5 md:space-y-6 animate-fade-in flex flex-col max-w-5xl mx-auto pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col gap-5 no-print px-1 pt-1">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-1">
                     Dashboard
                  </h1>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.role} VIEW</p>
               </div>
               <button 
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className={`p-2 rounded-xl bg-white border border-slate-200/60 shadow-soft text-slate-400 hover:text-brand-600 transition-all active:scale-95 ${refreshing ? 'opacity-50' : ''}`}
                  title="Force Sync"
               >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
               </button>
            </div>
            <div className="bg-white p-1.5 rounded-xl shadow-soft border border-slate-100 ring-1 ring-slate-50">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg">
                   <PackageCheck size={16} />
                </div>
            </div>
         </div>

         {/* Brand Switcher */}
         <div className="flex bg-slate-200/30 p-1 rounded-2xl border border-slate-200/40 shadow-inner-soft">
             {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                <button 
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.98] ${
                    selectedBrand === b 
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
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
         <div className="relative bg-white rounded-3xl p-5 md:p-6 shadow-premium border border-slate-200/60 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50/50 rounded-full -mr-24 -mt-24 -z-0"></div>
            <div className="flex flex-col relative z-10">
                <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={24} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        className="block w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-100/40 border-2 border-transparent text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/10 focus:ring-8 focus:ring-brand-500/5 transition-all outline-none shadow-inner-soft"
                        placeholder="Search Spare Part SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 font-bold text-[9px] bg-white px-3 py-1.5 rounded-lg shadow-soft transition-all border border-slate-100 uppercase tracking-widest"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* CATALOG CONTAINER */}
      <div className="bg-white rounded-3xl shadow-premium border border-slate-200/50 overflow-hidden flex flex-col flex-1 min-h-[500px]">
         <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/10">
            <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.4)]"></div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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