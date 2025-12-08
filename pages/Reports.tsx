
import React, { useEffect, useState } from 'react';
import { User, StockItem, Transaction } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import { fetchAnalytics } from '../services/transactionService';
import StatCard from '../components/StatCard';
import TharLoader from '../components/TharLoader';
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  AlertCircle, 
  Banknote, 
  CalendarRange,
  Download,
  ArrowRight
} from 'lucide-react';

interface Props {
  user: User;
}

const Reports: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [analytics, setAnalytics] = useState<any>(null); // Using any for simplicity in mapping service response
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const [invData, analyticsData] = await Promise.all([
         fetchInventory(),
         fetchAnalytics(firstDayOfMonth, today)
      ]);
      setInventory(invData);
      setAnalytics(analyticsData);
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = getStats(inventory);
  
  // Calculate specific report metrics
  const sortedByValue = [...inventory].sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity)).slice(0, 5);
  const lowStockList = inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStockThreshold).slice(0, 5);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <BarChart3 className="text-primary-600" /> Analytics & Reports
          </h1>
          <p className="text-slate-500 mt-1">Deep insights into inventory health and sales performance.</p>
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50">
               <CalendarRange size={16} /> This Month
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
               <Download size={16} /> Export Report
            </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Inventory Value" 
          value={`₹${(stats.totalValue / 100000).toFixed(2)} Lakh`} 
          icon={Banknote} 
          trend="Asset Value"
          colorClass="bg-white border-b-4 border-blue-500"
        />
        <StatCard 
          title="Net Revenue (Month)" 
          value={`₹${(analytics?.netRevenue || 0).toLocaleString()}`} 
          icon={TrendingUp} 
          trend={`${analytics?.salesCount || 0} Transactions`}
          colorClass="bg-white border-b-4 border-green-500"
        />
        <StatCard 
          title="Low Stock Alerts" 
          value={stats.lowStockCount} 
          icon={AlertTriangle} 
          colorClass={stats.lowStockCount > 0 ? "bg-white border-b-4 border-yellow-400" : "bg-white"}
        />
        <StatCard 
          title="Zero Stock Items" 
          value={stats.zeroStockCount} 
          icon={AlertCircle} 
          colorClass={stats.zeroStockCount > 0 ? "bg-white border-b-4 border-red-500" : "bg-white"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Products by Value */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
             <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Top Inventory Assets</h3>
                <p className="text-xs text-slate-500">Highest value held in stock</p>
             </div>
             <div className="flex-1 overflow-auto">
                {sortedByValue.map((item, idx) => (
                   <div key={item.id} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                         <span className="text-slate-400 font-mono text-xs w-4">0{idx + 1}</span>
                         <div>
                            <div className="font-bold text-sm text-slate-900">{item.partNumber}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[120px]">{item.name}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="font-bold text-sm text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</div>
                         <div className="text-xs text-slate-400">{item.quantity} units</div>
                      </div>
                   </div>
                ))}
             </div>
             <div className="p-3 border-t border-slate-100 text-center">
                <button className="text-sm text-primary-600 hover:underline flex items-center justify-center gap-1 w-full">
                   View Full Valuation <ArrowRight size={14} />
                </button>
             </div>
          </div>

          {/* Low Stock Warning */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-slate-800">Restock Recommendations</h3>
                    <p className="text-xs text-slate-500">Critical items below threshold</p>
                </div>
                <AlertTriangle className="text-yellow-500" size={20} />
             </div>
             <div className="flex-1 overflow-auto">
                {lowStockList.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">All stock levels healthy.</div>
                ) : (
                    lowStockList.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-yellow-50/30 transition-colors">
                        <div>
                            <div className="font-bold text-sm text-slate-900">{item.partNumber}</div>
                            <div className="text-xs text-slate-500">{item.name}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-sm text-red-600">{item.quantity} Left</div>
                            <div className="text-xs text-slate-400">Min: {item.minStockThreshold}</div>
                        </div>
                    </div>
                    ))
                )}
             </div>
          </div>

          {/* Sales Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
             <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Top Selling (Month)</h3>
                <p className="text-xs text-slate-500">Best performing parts by revenue</p>
             </div>
             <div className="flex-1 overflow-auto">
                {analytics?.soldItems?.slice(0, 5).map((item: any, idx: number) => (
                   <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0">
                      <div>
                         <div className="font-bold text-sm text-slate-900">{item.partNumber}</div>
                         <div className="text-xs text-slate-500 truncate max-w-[120px]">{item.name}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-bold text-sm text-green-700">₹{item.totalRevenue.toLocaleString()}</div>
                         <div className="text-xs text-slate-400">{item.quantitySold} sold</div>
                      </div>
                   </div>
                ))}
                {(!analytics?.soldItems || analytics.soldItems.length === 0) && (
                    <div className="p-8 text-center text-slate-400">No sales data for this period.</div>
                )}
             </div>
          </div>
      </div>
    </div>
  );
};

export default Reports;
