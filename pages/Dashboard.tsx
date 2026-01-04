import React, { useEffect, useState, useRef } from 'react';
import { User, StockItem, Role, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { Search, PackageCheck, RefreshCw } from 'lucide-react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import TharLoader from '../components/TharLoader';

interface DashboardProps { user: User; }

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true); else setLoading(true);
    try { const data = await fetchInventory(); setInventory(data); }
    catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    loadData();
    if (!('ontouchstart' in window)) setTimeout(() => searchInputRef.current?.focus(), 500);
  }, []);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-4 animate-fade-in flex flex-col max-w-5xl mx-auto">
      <div className="flex justify-between items-center px-1">
        <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">Dashboard</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{user.role} Console</p>
        </div>
        <button onClick={() => loadData(true)} disabled={refreshing} className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-brand-600 transition-all">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/60">
          {(['ALL', Brand.HYUNDAI, Brand.MAHINDRA] as const).map(b => (
            <button key={b} onClick={() => setSelectedBrand(b)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${selectedBrand === b ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {b}
            </button>
          ))}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-3d border border-slate-200">
        <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input ref={searchInputRef} type="text" inputMode="search" className="block w-full pl-11 pr-4 py-3 rounded-lg bg-slate-50 border border-slate-100 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-brand-500/5 transition-all outline-none" placeholder="Search Part Number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-slate-900 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">CLEAR</button>}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <StockTable items={inventory} userRole={user.role} brandFilter={selectedBrand === 'ALL' ? undefined : selectedBrand} hideToolbar={false} externalSearch={searchQuery} />
      </div>
    </div>
  );
};
export default Dashboard;