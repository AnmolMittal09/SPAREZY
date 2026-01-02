import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem, Role } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search,
  AlertCircle,
  ShieldCheck,
  History,
  Info,
  Eye,
  PackageCheck
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
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-24 md:pb-12 h-full flex flex-col">
      
      {/* HEADER - Responsive */}
      <div className="flex justify-between items-center no-print px-1">
         <div className="hidden md:block">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
               Store Overview
            </h1>
            <p className="text-slate-500 font-medium text-sm">Real-time inventory and pricing at your fingertips.</p>
         </div>
         
         <div className="md:hidden flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-200">
               <PackageCheck size={20} />
            </div>
            <div>
               <h1 className="text-xl font-black text-slate-900 leading-none">Dashboard</h1>
               <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-teal-500'}`}></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role} Access</p>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/billing?tab=history')}
              className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-brand-600 transition-all shadow-soft active:scale-95"
              title="Transaction History"
            >
               <History size={22} />
            </button>
         </div>
      </div>

      {/* SEARCH FIRST SECTION - High Visibility */}
      <div className="relative group no-print">
         <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-indigo-600 rounded-3xl lg:rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
         <div className="relative bg-white rounded-3xl lg:rounded-[2.5rem] p-5 lg:p-8 shadow-premium border border-slate-100">
            <div className="flex flex-col gap-5 lg:gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-brand-50 text-brand-600 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-inner">
                        <Search size={20} strokeWidth={3} className="lg:size-[24px]" />
                    </div>
                    <div>
                        <h2 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight">Stock & Price Check</h2>
                        <p className="text-[10px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest">Instant Part Identification</p>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        className="block w-full pl-12 pr-6 py-4 lg:py-5 rounded-2xl lg:rounded-[2rem] bg-slate-50 border-2 border-transparent text-lg lg:text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/20 focus:ring-4 focus:ring-brand-500/5 transition-all outline-none shadow-inner"
                        placeholder="Type Part Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-black text-[10px] bg-slate-200/50 px-2.5 py-1 rounded-lg"
                        >
                            CLEAR
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                    <span className="text-[9px] lg:text-[10px] font-black text-slate-300 uppercase tracking-widest mr-1">Brands:</span>
                    <button onClick={() => setSearchQuery('HY-')} className="text-[10px] lg:text-[11px] font-black px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl active:bg-blue-600 active:text-white transition-all">HYUNDAI</button>
                    <button onClick={() => setSearchQuery('MH-')} className="text-[10px] lg:text-[11px] font-black px-3 py-1.5 bg-red-50 text-red-700 rounded-xl active:bg-red-600 active:text-white transition-all">MAHINDRA</button>
                    <div className="h-4 w-px bg-slate-100 mx-1"></div>
                    <button onClick={() => navigate('/low-stock')} className="text-[10px] lg:text-[11px] font-black px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl active:bg-amber-600 active:text-white transition-all flex items-center gap-1.5">
                        <AlertCircle size={12} /> LOW STOCK ({stats.lowStockCount})
                    </button>
                </div>
            </div>
         </div>
      </div>

      {/* LIVE SEARCH RESULTS / DATA TABLE */}
      <div className="bg-white rounded-3xl lg:rounded-[2.5rem] shadow-premium border border-slate-50 overflow-hidden flex flex-col flex-1 min-h-[300px] mb-4">
         <div className="p-4 lg:p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {searchQuery ? `FOUND RESULTS FOR "${searchQuery}"` : "LIVE CATALOG VIEW"}
                </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-black text-brand-600 uppercase tracking-widest italic bg-brand-50 px-2 py-1 rounded-lg">
                <Eye size={12} /> Click to Reveal MRP
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