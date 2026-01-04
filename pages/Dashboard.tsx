import React, { useEffect, useState } from 'react';
import { User, StockItem, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { Search, RefreshCw, Package, AlertTriangle, AlertCircle, ShoppingCart } from 'lucide-react';
import TharLoader from '../components/TharLoader';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | 'ALL'>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchInventory();
      setInventory(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <TharLoader />;

  const stats = getStats(inventory);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      
      {/* STATS STRIP - High Density */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'text-brand-600' },
           { label: 'Low Stock', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-amber-500' },
           { label: 'Zero Stock', value: stats.zeroStockCount, icon: AlertCircle, color: 'text-rose-600' },
           { label: 'Asset Value', value: `₹${(stats.totalValue / 100000).toFixed(2)}L`, icon: ShoppingCart, color: 'text-teal-600' },
         ].map((s, i) => (
           <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-interface flex items-center gap-4">
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400"> <s.icon size={20} /> </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{s.label}</p>
                 <p className={`text-xl font-black leading-none ${s.color}`}>{s.value}</p>
              </div>
           </div>
         ))}
      </div>

      {/* SEARCH COMMAND CENTER */}
      <div className="bg-white rounded-xl shadow-panel border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center">
             <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" placeholder="Lookup Part Number..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-lg font-bold shadow-inner focus:ring-2 focus:ring-brand-500/10 outline-none"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                />
             </div>
             <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                {['ALL', Brand.HYUNDAI, Brand.MAHINDRA].map(b => (
                    <button 
                        key={b} onClick={() => setSelectedBrand(b as any)}
                        className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${selectedBrand === b ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        {b}
                    </button>
                ))}
             </div>
             <button onClick={loadData} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand-600 transition-colors">
                <RefreshCw size={20} />
             </button>
          </div>

          <div className="min-h-[400px]">
             <StockTable 
                items={inventory} userRole={user.role} hideToolbar 
                externalSearch={searchQuery} brandFilter={selectedBrand === 'ALL' ? undefined : selectedBrand} 
             />
          </div>
      </div>

    </div>
  );
};

export default Dashboard;