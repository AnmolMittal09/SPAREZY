import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem, Role, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search,
  RefreshCw,
  LayoutGrid,
  Filter,
  X
} from 'lucide-react';
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

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchInventory();
      setInventory(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <TharLoader />;

  const stats = getStats(inventory);

  return (
    <div className="space-y-4 animate-fade-in flex flex-col">
      
      {/* HEADER & REFRESH */}
      <div className="flex justify-between items-end mb-2">
         <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stock Control</h1>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Master Registry</p>
         </div>
         <button 
            onClick={() => loadData(true)}
            className={`p-2 rounded-lg bg-white border border-slate-200 text-slate-400 active:scale-90 transition-all ${refreshing ? 'opacity-50' : ''}`}
         >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
         </button>
      </div>

      {/* QUICK STATS - High Density */}
      <div className="grid grid-cols-2 gap-3">
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Low Stock</p>
            <p className="text-2xl font-bold text-amber-500">{stats.lowStockCount}</p>
         </div>
         <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Zero Stock</p>
            <p className="text-2xl font-bold text-rose-500">{stats.zeroStockCount}</p>
         </div>
      </div>

      {/* SEARCH & FILTER BAR - Persistent & High Density */}
      <div className="sticky top-0 z-50 bg-[#F8FAFC] pt-1 pb-4 flex flex-col gap-3">
          <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={20} />
              <input 
                  type="text" 
                  inputMode="search"
                  className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-white border border-slate-200 text-base font-bold text-slate-900 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none shadow-sm"
                  placeholder="Search Part No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                    <X size={20} />
                  </button>
              )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
             {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                <button 
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    selectedBrand === b 
                      ? 'bg-slate-900 text-white shadow-lg' 
                      : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  {b}
                </button>
             ))}
          </div>
      </div>

      {/* RESULTS AREA */}
      <div className="flex-1">
        <StockTable 
           items={inventory} 
           userRole={user.role}
           brandFilter={selectedBrand === 'ALL' ? undefined : selectedBrand}
           enableActions={true}
           hideToolbar={true}
           externalSearch={searchQuery}
        />
      </div>

    </div>
  );
};

export default Dashboard;