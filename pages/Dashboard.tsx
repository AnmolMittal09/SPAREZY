
import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem, Role, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search,
  AlertCircle,
  Eye,
  PackageCheck,
  Zap,
  Filter,
  ArrowRight
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
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
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
    
    if (!('ontouchstart' in window)) {
        setTimeout(() => searchInputRef.current?.focus(), 500);
    }
  }, []);

  if (loading) return <TharLoader />;

  const stats = getStats(inventory);

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in h-full flex flex-col max-w-5xl mx-auto">
      
      {/* MOBILE HEADER - Clean & Focused */}
      <div className="flex justify-between items-center no-print px-1">
         <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-1">
               Dashboard
            </h1>
            <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-teal-500'} animate-pulse`}></div>
               <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{user.role} ACCESS</p>
            </div>
         </div>
         
         <div className="bg-white p-2 rounded-2xl shadow-soft border border-slate-100 flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                <PackageCheck size={20} />
             </div>
         </div>
      </div>

      {/* PRIMARY SEARCH HERO SECTION */}
      <div className="relative group no-print">
         <div className="relative bg-white rounded-[3rem] p-8 shadow-premium border border-slate-50 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl"></div>
            
            <div className="flex flex-col gap-8 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-brand-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-brand-100">
                            <Zap size={24} strokeWidth={3} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Price Check</h2>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Part Lookup Terminal</p>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        inputMode="search"
                        className="block w-full pl-16 pr-6 py-6 rounded-3xl bg-slate-100 border-2 border-transparent text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-brand-500/20 focus:ring-[10px] focus:ring-brand-500/5 transition-all outline-none shadow-inner"
                        placeholder="Scan Part Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 font-black text-[11px] bg-white px-3 py-1.5 rounded-xl shadow-sm transition-all"
                        >
                            CLEAR
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-3">
                       <Filter size={14} className="text-slate-300" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand Selection</span>
                    </div>
                    <div className="flex gap-3">
                        {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                           <button 
                             key={b}
                             onClick={() => setSelectedBrand(b)}
                             className={`flex-1 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95 border-2 ${
                               selectedBrand === b 
                                 ? 'bg-slate-900 text-white border-slate-900 shadow-xl' 
                                 : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'
                             }`}
                           >
                             {b}
                           </button>
                        ))}
                    </div>
                </div>
            </div>
         </div>
      </div>

      {/* QUICK STATUS INDICATOR */}
      <div className="px-2">
         <button 
           onClick={() => navigate('/low-stock')}
           className="w-full bg-amber-50 border border-amber-100 p-5 rounded-[2rem] flex items-center justify-between group active:scale-[0.98] transition-all"
         >
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm">
                  <AlertCircle size={22} strokeWidth={2.5} />
               </div>
               <div className="text-left">
                  <p className="text-[11px] font-black text-amber-700/60 uppercase tracking-widest leading-none mb-1.5">Attention Items</p>
                  <p className="text-lg font-black text-amber-900 tracking-tight">{stats.lowStockCount} SKUs are Low on Stock</p>
               </div>
            </div>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
               <ArrowRight size={20} />
            </div>
         </button>
      </div>

      {/* CATALOG RESULTS AREA */}
      <div className="bg-white rounded-[3rem] shadow-premium border border-slate-50 overflow-hidden flex flex-col flex-1 min-h-[400px]">
         <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></div>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.25em]">
                    {searchQuery ? `FOUND FOR "${searchQuery}"` : "Master Catalog View"}
                </h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-brand-600 uppercase tracking-widest px-3 py-1.5 bg-brand-50 rounded-xl">
                <Eye size={12} strokeWidth={3} /> Reveal MRP
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
