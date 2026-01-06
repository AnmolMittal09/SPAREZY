
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, StockItem, Role, Brand } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search,
  RefreshCw,
  LayoutGrid,
  Activity,
  Layers
} from 'lucide-react';
import TharLoader from '../components/TharLoader';

const fd = (n: number | string) => {
    const num = parseInt(n.toString()) || 0;
    return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

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

  const brandSnapshots = useMemo(() => {
    const activeItems = inventory.filter(i => !i.isArchived && i.quantity > 0);
    
    const hyItems = activeItems.filter(i => i.brand === Brand.HYUNDAI);
    const mhItems = activeItems.filter(i => i.brand === Brand.MAHINDRA);

    return {
      hyundai: {
        parts: hyItems.length,
        units: hyItems.reduce((acc, curr) => acc + curr.quantity, 0)
      },
      mahindra: {
        parts: mhItems.length,
        units: mhItems.reduce((acc, curr) => acc + curr.quantity, 0)
      }
    };
  }, [inventory]);

  if (loading) return <TharLoader />;

  const filteredCount = inventory.filter(i => 
    i.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) && 
    (selectedBrand === 'ALL' || i.brand === selectedBrand)
  ).length;

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in flex flex-col max-w-6xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print px-1 pt-2">
         <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-elevated border border-white/10">
                <Activity size={28} strokeWidth={2.5} />
            </div>
            <div>
               <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                  Command Center
               </h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                 {user.role} TERMINAL • LIVE FEED
               </p>
            </div>
         </div>

         <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-none flex bg-slate-200/50 p-1 rounded-2xl border border-slate-200 shadow-inner-soft">
                {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                   <button 
                     key={b}
                     onClick={() => setSelectedBrand(b)}
                     className={`flex-1 md:px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                       selectedBrand === b 
                         ? 'bg-white text-slate-900 shadow-soft border border-slate-200' 
                         : 'text-slate-400 hover:text-slate-600'
                     }`}
                   >
                     {b}
                   </button>
                ))}
            </div>
            <button 
                onClick={() => loadData(true)}
                className={`p-3.5 rounded-2xl bg-white border border-slate-200 shadow-soft text-slate-400 hover:text-blue-600 transition-all active:rotate-180 duration-500 ${refreshing ? 'opacity-50' : ''}`}
            >
                <RefreshCw size={20} strokeWidth={2.5} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            </button>
         </div>
      </div>

      <div className="relative group no-print">
         <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-premium border border-slate-200/80 transition-all duration-300 group-focus-within:shadow-elevated group-focus-within:border-blue-200 group-focus-within:-translate-y-1">
            <div className="flex flex-col gap-4">
                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={32} strokeWidth={2.5} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        className="block w-full pl-16 pr-24 py-7 rounded-3xl bg-slate-50 border-2 border-transparent text-2xl font-black text-slate-900 placeholder:text-slate-200 focus:bg-white focus:border-blue-500/10 focus:ring-12 focus:ring-blue-500/5 transition-all outline-none shadow-inner-soft tracking-tight"
                        placeholder="Search Part Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {searchQuery && (
                          <button 
                              onClick={() => setSearchQuery('')}
                              className="text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                              Clear
                          </button>
                        )}
                        <kbd className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] font-black text-slate-400 shadow-sm">
                          /
                        </kbd>
                    </div>
                </div>
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-4 text-slate-400">
                      <div className="flex items-center gap-1.5">
                         <Layers size={14} className="opacity-50" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Global Catalog Scan</span>
                      </div>
                   </div>
                   {searchQuery && (
                     <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">
                        {fd(filteredCount)} SKUs Found
                     </span>
                   )}
                </div>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-200/60 overflow-hidden flex flex-col flex-1 min-h-[700px] transition-all">
         <div className="px-10 py-7 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-soft border border-slate-100 text-blue-600">
                    <LayoutGrid size={22} strokeWidth={2.5} />
                </div>
                <div>
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] leading-none mb-1.5">
                       Inventory Database
                   </h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time Stock Registry</p>
                </div>
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
               <div className="bg-white border border-slate-200/60 border-l-4 border-l-blue-600 px-3 py-2 rounded-xl shadow-soft h-[56px] min-w-[140px] flex flex-col justify-center">
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-wider leading-none mb-1">HYUNDAI</p>
                  <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                     {fd(brandSnapshots.hyundai.parts)} Parts · {brandSnapshots.hyundai.units.toLocaleString()} Units
                  </p>
               </div>
               <div className="bg-white border border-slate-200/60 border-l-4 border-l-red-600 px-3 py-2 rounded-xl shadow-soft h-[56px] min-w-[140px] flex flex-col justify-center">
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-wider leading-none mb-1">MAHINDRA</p>
                  <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                     {fd(brandSnapshots.mahindra.parts)} Parts · {brandSnapshots.mahindra.units.toLocaleString()} Units
                  </p>
               </div>
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
