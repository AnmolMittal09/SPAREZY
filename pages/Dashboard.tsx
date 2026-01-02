import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Truck, 
  Zap,
  Search,
  LayoutGrid,
  AlertCircle,
  ShieldCheck,
  Package,
  History,
  Info,
  // Fix: Added missing Eye icon import
  Eye
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
    
    // Auto-focus search on desktop
    if (!('ontouchstart' in window)) {
        setTimeout(() => searchInputRef.current?.focus(), 500);
    }
  }, []);

  if (loading) return <TharLoader />;

  const stats = getStats(inventory);

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-12">
      
      {/* HEADER & ACCESS INFO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
         <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
               Store Overview
            </h1>
            <p className="text-slate-500 font-medium text-sm">Quickly find parts and verify stock levels.</p>
         </div>
         <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-soft text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <ShieldCheck size={16} className="text-teal-500" /> {user.role} Access
            </div>
            <button 
              onClick={() => navigate('/billing?tab=history')}
              className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-brand-600 transition-all shadow-soft"
              title="Transaction History"
            >
               <History size={22} />
            </button>
         </div>
      </div>

      {/* SEARCH FIRST SECTION */}
      <div className="relative group">
         <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-[2.5rem] blur opacity-15 group-hover:opacity-25 transition duration-1000 group-hover:duration-200"></div>
         <div className="relative bg-white rounded-[2.5rem] p-6 md:p-8 shadow-premium border border-slate-50">
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Search size={24} strokeWidth={3} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Stock Check</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Global Catalog Search</p>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        className="block w-full pl-16 pr-6 py-5 rounded-[2rem] bg-slate-50 border-2 border-transparent text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/20 focus:ring-4 focus:ring-brand-500/5 transition-all outline-none shadow-inner"
                        placeholder="Search Part Number (e.g. HY-AIR-001)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 font-bold text-sm bg-slate-200/50 px-3 py-1 rounded-full"
                        >
                            CLEAR
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Quick Filters:</span>
                    <button onClick={() => setSearchQuery('HY-')} className="text-[11px] font-bold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors">Hyundai</button>
                    <button onClick={() => setSearchQuery('MH-')} className="text-[11px] font-bold px-3 py-1.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors">Mahindra</button>
                    <button onClick={() => navigate('/low-stock')} className="text-[11px] font-bold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1">
                        <AlertCircle size={12} /> Low Stock ({stats.lowStockCount})
                    </button>
                </div>
            </div>
         </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          <button 
            onClick={() => navigate('/billing')}
            className="group px-6 py-5 bg-slate-900 rounded-[2rem] text-white shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-4"
          >
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Zap size={20} className="text-brand-400" />
            </div>
            <div className="text-left">
                <span className="block text-sm font-black tracking-tight">New Sale</span>
                <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Counter POS</span>
            </div>
          </button>

          <button 
            onClick={() => navigate('/purchases')}
            className="group px-6 py-5 bg-white border border-slate-200 rounded-[2rem] text-slate-900 shadow-soft hover:border-brand-500/20 transition-all flex items-center gap-4"
          >
             <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                <Truck size={20} className="text-brand-600" />
            </div>
            <div className="text-left">
                <span className="block text-sm font-black tracking-tight">Add Stock</span>
                <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Purchases</span>
            </div>
          </button>

          <button 
            onClick={() => navigate('/parts')}
            className="hidden md:flex group px-6 py-5 bg-white border border-slate-200 rounded-[2rem] text-slate-900 shadow-soft hover:border-brand-500/20 transition-all items-center gap-4"
          >
             <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                <LayoutGrid size={20} className="text-slate-400" />
            </div>
            <div className="text-left">
                <span className="block text-sm font-black tracking-tight">Catalog</span>
                <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Full List</span>
            </div>
          </button>

          <button 
            onClick={() => navigate('/low-stock')}
            className="group px-6 py-5 bg-white border border-slate-200 rounded-[2rem] text-slate-900 shadow-soft hover:border-rose-500/20 transition-all flex items-center gap-4"
          >
             <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                <Package size={20} className="text-rose-500" />
            </div>
            <div className="text-left">
                <span className="block text-sm font-black tracking-tight">Restock</span>
                <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest">Alerts</span>
            </div>
          </button>
      </div>

      {/* SEARCH RESULTS / FULL TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-50 overflow-hidden flex flex-col min-h-[500px]">
         <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-2">
                <Info size={16} className="text-brand-500" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    {searchQuery ? `Searching Results for "${searchQuery}"` : "Live Catalog View"}
                </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
                <Eye size={14} /> Click price to reveal MRP
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