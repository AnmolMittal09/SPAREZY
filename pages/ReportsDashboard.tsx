import React, { useEffect, useState } from 'react';
import { User, StockItem } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import { fetchAnalytics } from '../services/transactionService';
import StatCard from '../components/StatCard';
import TharLoader from '../components/TharLoader';
import { 
  TrendingUp, 
  AlertTriangle, 
  AlertCircle, 
  Banknote, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';

const formatQty = (n: number) => {
  const abs = Math.abs(n);
  const str = abs < 10 ? `0${abs}` : `${abs}`;
  return n < 0 ? `-${str}` : str;
};

interface Props {
  user: User;
}

const ReportsDashboard: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const [invData, analyticsData] = await Promise.all([
         fetchInventory(),
         fetchAnalytics(firstDayOfMonth, today)
      ]);
      setInventory(invData);
      setAnalytics(analyticsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = getStats(inventory);
  const sortedByValue = [...inventory].sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity)).slice(0, 5);

  if (loading && !refreshing) return <TharLoader />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end px-1">
          <button 
             onClick={() => loadData(true)}
             disabled={refreshing}
             className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-brand-600 transition-all active:scale-95 shadow-sm text-xs font-bold ${refreshing ? 'opacity-50' : ''}`}
          >
             <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
             {refreshing ? 'Syncing...' : 'Refresh Stats'}
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Stock Value" 
          value={`₹${(stats.totalValue / 100000).toFixed(2)} Lakh`} 
          icon={Banknote} 
          trend="Asset Value"
          colorClass="bg-white border-b-4 border-blue-500"
        />
        <StatCard 
          title="Net Revenue (Month)" 
          value={`₹${(analytics?.netRevenue || 0).toLocaleString()}`} 
          icon={TrendingUp} 
          trend={`${formatQty(analytics?.salesCount || 0)} Transactions`}
          colorClass="bg-white border-b-4 border-green-500"
        />
        <StatCard 
          title="Low Stock" 
          value={formatQty(stats.lowStockCount)} 
          icon={AlertTriangle} 
          colorClass="bg-white border-b-4 border-yellow-400"
        />
        <StatCard 
          title="Out of Stock" 
          value={formatQty(stats.zeroStockCount)} 
          icon={AlertCircle} 
          colorClass="bg-white border-b-4 border-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
             <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Top Inventory Assets</h3>
             </div>
             <div className="flex-1 overflow-auto max-h-96">
                {sortedByValue.map((item, idx) => (
                   <div key={item.id} className="flex items-center justify-between p-4 border-b border-slate-50">
                      <div className="flex items-center gap-3">
                         <span className="text-slate-400 font-mono text-xs w-4">{formatQty(idx + 1)}</span>
                         <div>
                            <div className="font-bold text-sm text-slate-900">{item.partNumber}</div>
                            <div className="text-xs text-slate-500">{item.name}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="font-bold text-sm text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</div>
                         <div className="text-xs text-slate-400">{formatQty(item.quantity)} units</div>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
             <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Recent Sales Performance</h3>
             </div>
             <div className="flex-1 overflow-auto max-h-96">
                {analytics?.soldItems?.slice(0, 5).map((item: any, idx: number) => (
                   <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-50">
                      <div>
                         <div className="font-bold text-sm text-slate-900">{item.partNumber}</div>
                         <div className="text-xs text-slate-500">{item.name}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-bold text-sm text-green-700">₹{item.totalRevenue.toLocaleString()}</div>
                         <div className="text-xs text-slate-400">{formatQty(item.quantitySold)} sold</div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;