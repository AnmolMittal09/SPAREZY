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
    <div className="space-y-4 md:space-y-6 animate-fade-in flex flex-col max-w-5xl mx-auto">
      
      {/* HEADER - Integrated Brand Filter & Refresh */}
      <div className="flex flex-col gap-4 no-print px-1 pt-2">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">
                     Dashboard
                  </h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.role} ACCESS</p>
               </div>
               <button 
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className={`p-2 rounded-xl bg-white border border-slate-100 shadow-soft text-slate-400 hover:text-brand-600 transition-all active:scale-90 ${refreshing ? 'opacity-50' : ''}`}
                  title="Refresh Inventory"
               >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
               </button>
            </div>
            <div className="bg-white p-1.5 rounded-xl shadow-soft border border-slate-100">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                   <PackageCheck size={16} />
                </div>
            </div>
         </div>

         {/* Compact Brand Filter */}
         <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/60">
             {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                <button 
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all active:scale-95 ${
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

      {/* SEARCH HERO */}
      <div className="relative group no-print">
         <div className="relative bg-white rounded-[2.5rem] p-6 shadow-premium border border-slate-50 overflow-hidden">
            <div className="flex flex-col gap-4 relative z-10">
                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        className="block w-full pl-16 pr-6 py-6 rounded-3xl bg-slate-100 border-2 border-transparent text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/20 focus:ring-[10px] focus:ring-brand-500/5 transition-all outline-none shadow-inner"
                        placeholder="Type Part Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 font-black text-[10px] bg-white px-3 py-2 rounded-xl shadow-sm transition-all border border-slate-100"
                        >
                            CLEAR
                        </button>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* RESULTS AREA */}
      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-50 overflow-hidden flex flex-col flex-1 min-h-[400px]">
         <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse"></div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    {searchQuery ? `Lookup Results for "${searchQuery}"` : "Active Inventory Catalog"}
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