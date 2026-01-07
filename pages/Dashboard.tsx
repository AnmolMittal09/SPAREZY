
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, StockItem, Brand } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { Search, RefreshCw, LayoutGrid, Activity, Boxes, Package } from 'lucide-react';
import TharLoader from '../components/TharLoader';

const fd = (n: number | string) => {
    const num = parseInt(n.toString()) || 0;
    return num >= 0 && num < 10 ? `0${num}` : `${num}`;
};

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true); else setLoading(true);
    try { const data = await fetchInventory(); setInventory(data); } catch (e) { } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  const brandSnapshots = useMemo(() => {
    const active = inventory.filter(i => !i.isArchived);
    const hy = active.filter(i => i.brand === Brand.HYUNDAI);
    const mh = active.filter(i => i.brand === Brand.MAHINDRA);
    return {
      hy: { p: hy.length, u: hy.reduce((s, c) => s + c.quantity, 0) },
      mh: { p: mh.length, u: mh.reduce((s, c) => s + c.quantity, 0) }
    };
  }, [inventory]);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2 pt-2">
         <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-slate-950 rounded-[2rem] flex items-center justify-center text-white shadow-elevated border-2 border-white/10">
                <Activity size={32} strokeWidth={3} />
            </div>
            <div>
               <h1 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-2 uppercase">Command Centre</h1>
               <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse"></span>
                 Terminal {user.role} • Active Sync
               </p>
            </div>
         </div>
         <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex bg-slate-200/60 p-1.5 rounded-2xl border-2 border-slate-300 shadow-inner-soft w-full md:w-auto">
                {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
                   <button key={b} onClick={() => setSelectedBrand(b)} className={`flex-1 md:px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedBrand === b ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-700 hover:bg-slate-100'}`}>{b}</button>
                ))}
            </div>
            <button onClick={() => loadData(true)} className="p-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-700 shadow-soft active:scale-95 transition-all"><RefreshCw size={22} strokeWidth={3} className={refreshing ? 'animate-spin text-blue-700' : ''}/></button>
         </div>
      </div>

      {/* Global Search Bar */}
      <div className="bg-white rounded-[3rem] p-6 md:p-10 shadow-elevated border-2 border-slate-200 group focus-within:border-slate-950 transition-all">
         <div className="relative">
             <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-950" size={36} strokeWidth={3.5} />
             <input 
                 ref={searchInputRef}
                 type="text" 
                 className="w-full pl-20 pr-10 py-8 bg-slate-100 border-2 border-transparent rounded-[2.5rem] text-3xl font-black text-slate-950 placeholder:text-slate-400 focus:bg-white focus:border-slate-950 outline-none transition-all shadow-inner-soft tracking-tighter"
                 placeholder="SCAN PART NUMBER..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
             />
         </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[3rem] shadow-premium border-2 border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
         {/* Integrated Header with Compact Status Boxes Aligned Top Right */}
         <div className="p-6 md:p-10 border-b-2 border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl text-blue-700 shadow-inner"><LayoutGrid size={24} strokeWidth={3}/></div>
               <div>
                  <h2 className="text-[14px] font-black text-slate-950 uppercase tracking-[0.25em]">Master Parts Database</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Catalog Registry</p>
               </div>
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-4 justify-end">
                {/* Hyundai Status Box */}
                <div className="bg-white p-3 px-5 rounded-2xl border-2 border-slate-200 border-r-[8px] border-r-blue-700 shadow-soft flex flex-col justify-center min-w-[140px]">
                   <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest">Hyundai</span>
                      <Boxes size={12} className="text-slate-300" />
                   </div>
                   <div className="flex items-center justify-between gap-6">
                      <div className="flex flex-col">
                         <span className="text-[15px] font-black text-slate-950 tabular-nums leading-none">{brandSnapshots.hy.p.toLocaleString()}</span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Parts No.</span>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-[15px] font-black text-slate-950 tabular-nums leading-none">{brandSnapshots.hy.u.toLocaleString()}</span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Qty.</span>
                      </div>
                   </div>
                </div>

                {/* Mahindra Status Box */}
                <div className="bg-white p-3 px-5 rounded-2xl border-2 border-slate-200 border-r-[8px] border-r-red-700 shadow-soft flex flex-col justify-center min-w-[140px]">
                   <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="text-[9px] font-black text-red-800 uppercase tracking-widest">Mahindra</span>
                      <Package size={12} className="text-slate-300" />
                   </div>
                   <div className="flex items-center justify-between gap-6">
                      <div className="flex flex-col">
                         <span className="text-[15px] font-black text-slate-950 tabular-nums leading-none">{brandSnapshots.mh.p.toLocaleString()}</span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Parts No.</span>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="text-[15px] font-black text-slate-950 tabular-nums leading-none">{brandSnapshots.mh.u.toLocaleString()}</span>
                         <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Qty.</span>
                      </div>
                   </div>
                </div>
            </div>
         </div>

         <div className="flex-1">
            <StockTable 
               items={inventory} 
               userRole={user.role}
               brandFilter={selectedBrand === 'ALL' ? undefined : selectedBrand}
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
