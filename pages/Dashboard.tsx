
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, StockItem, Brand } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { Search, RefreshCw, LayoutGrid, Activity, Layers } from 'lucide-react';
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
    <div className="space-y-10 animate-fade-in pb-32 max-w-7xl mx-auto">
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

      <div className="bg-white rounded-[3rem] p-6 md:p-10 shadow-elevated border-2 border-slate-200 group focus-within:border-slate-900 transition-all">
         <div className="relative">
             <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-900" size={36} strokeWidth={3.5} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-1">
         <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-200 border-l-[12px] border-l-blue-700 shadow-soft flex flex-col justify-between">
            <div>
               <p className="text-[11px] font-black text-blue-800 uppercase tracking-[0.2em] mb-2">Hyundai Inventory Status</p>
               <h3 className="text-4xl font-black text-slate-950 tracking-tighter tabular-nums">{brandSnapshots.hy.u.toLocaleString()} <span className="text-base text-slate-500 uppercase tracking-widest ml-1">Units</span></h3>
            </div>
            <p className="text-[12px] font-bold text-slate-600 uppercase tracking-wide mt-6">{fd(brandSnapshots.hy.p)} Global SKUs Registered</p>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-200 border-l-[12px] border-l-red-700 shadow-soft flex flex-col justify-between">
            <div>
               <p className="text-[11px] font-black text-red-800 uppercase tracking-[0.2em] mb-2">Mahindra Inventory Status</p>
               <h3 className="text-4xl font-black text-slate-950 tracking-tighter tabular-nums">{brandSnapshots.mh.u.toLocaleString()} <span className="text-base text-slate-500 uppercase tracking-widest ml-1">Units</span></h3>
            </div>
            <p className="text-[12px] font-bold text-slate-600 uppercase tracking-wide mt-6">{fd(brandSnapshots.mh.p)} Global SKUs Registered</p>
         </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-premium border-2 border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
         <div className="p-8 border-b-2 border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl text-blue-700 shadow-inner"><LayoutGrid size={24} strokeWidth={3}/></div>
               <h2 className="text-[13px] font-black text-slate-950 uppercase tracking-[0.25em]">Master Parts Database</h2>
            </div>
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-inner-soft">Real-time Catalog Scan</span>
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
