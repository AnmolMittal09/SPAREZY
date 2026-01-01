import React, { useEffect, useState } from 'react';
import { User, Brand, Role, StockItem } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import StatCard from '../components/StatCard';
import { 
  Plus, 
  Truck, 
  PackagePlus,
  ArrowRight,
  Zap,
  LayoutGrid,
  TrendingUp,
  AlertCircle,
  ShieldCheck,
  Package
} from 'lucide-react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import TharLoader from '../components/TharLoader';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchInventory();
      setInventory(data);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) return <TharLoader />;

  const stats = getStats(inventory);

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* WELCOME SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
         <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
               Welcome back, {user.name.split(' ')[0]} 👋
            </h1>
            <p className="text-slate-500 font-medium">Here's what's happening in your shop today.</p>
         </div>
         <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-soft text-xs font-bold text-slate-500 uppercase tracking-widest">
            <ShieldCheck size={16} className="text-teal-500" /> Secure {user.role} Access
         </div>
      </div>

      {/* QUICK ACTIONS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate('/billing')}
            className="group p-6 bg-brand-600 rounded-[2rem] text-white shadow-xl shadow-brand-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
               <Zap size={80} />
            </div>
            <Zap size={24} className="mb-4 text-brand-200" />
            <span className="text-lg font-black tracking-tight mb-1">New Sale</span>
            <span className="text-xs font-medium text-brand-100">Create tax invoice or estimate</span>
          </button>

          <button 
            onClick={() => navigate('/purchases')}
            className="group p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col text-left relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
               <Truck size={80} />
            </div>
            <Truck size={24} className="mb-4 text-slate-400" />
            <span className="text-lg font-black tracking-tight mb-1">Buy Stock</span>
            <span className="text-xs font-medium text-slate-400">Add inventory from suppliers</span>
          </button>

          <button 
            onClick={() => navigate('/parts')}
            className="group p-6 bg-white rounded-[2rem] border border-slate-200 text-slate-900 shadow-soft hover:border-brand-300 transition-all flex flex-col text-left"
          >
            <LayoutGrid size={24} className="mb-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
            <span className="text-lg font-black tracking-tight mb-1">Catalog</span>
            <span className="text-xs font-medium text-slate-500">Search and manage all items</span>
          </button>

          <button 
            onClick={() => navigate('/low-stock')}
            className="group p-6 bg-white rounded-[2rem] border border-slate-200 text-slate-900 shadow-soft hover:border-rose-300 transition-all flex flex-col text-left"
          >
            <div className="flex justify-between items-center mb-4">
               <AlertCircle size={24} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
               <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">{stats.lowStockCount} Items</span>
            </div>
            <span className="text-lg font-black tracking-tight mb-1">Restock</span>
            <span className="text-xs font-medium text-slate-500">Critical items needing attention</span>
          </button>
      </div>

      {/* CORE STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Inventory Value" 
          value={`₹${(stats.totalValue / 100000).toFixed(2)} Lakh`} 
          icon={TrendingUp} 
          trend="+2.4% vs last month"
          colorClass="bg-white border border-slate-100"
        />
        <StatCard 
          title="Active Items" 
          value={stats.totalItems} 
          icon={Package} 
          colorClass="bg-white border border-slate-100"
        />
        <StatCard 
          title="Out of Stock" 
          value={stats.zeroStockCount} 
          icon={AlertCircle} 
          colorClass={stats.zeroStockCount > 0 ? "bg-rose-50 border border-rose-100" : "bg-white border border-slate-100"}
          onClick={() => navigate('/out-of-stock')}
        />
        <StatCard 
          title="Stock Efficiency" 
          value="92%" 
          icon={Zap} 
          trend="Excellent"
          colorClass="bg-white border border-slate-100"
        />
      </div>

      {/* RECENT INVENTORY OVERVIEW */}
      <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-50 overflow-hidden flex flex-col h-[600px]">
         <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
               <h3 className="text-xl font-black text-slate-900 tracking-tight">Stock Snapshot</h3>
               <p className="text-sm text-slate-500 font-medium">Real-time overview of your top inventory items.</p>
            </div>
            <Link to="/parts" className="flex items-center gap-2 text-brand-600 font-bold text-sm hover:underline">
               View Full Catalog <ArrowRight size={16} />
            </Link>
         </div>
         <div className="flex-1 min-h-0">
            <StockTable 
               items={inventory.slice(0, 50)} 
               userRole={user.role}
               enableActions={true}
               hideToolbar={true}
            />
         </div>
      </div>

    </div>
  );
};

export default Dashboard;