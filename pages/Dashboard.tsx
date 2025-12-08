import React, { useEffect, useState } from 'react';
import { User, Role, StockItem, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import { fetchTransactions } from '../services/transactionService';
import StatCard from '../components/StatCard';
import { 
  Package, 
  AlertTriangle, 
  AlertCircle, 
  Banknote, 
  Sparkles, 
  ArrowUpRight,
  TrendingUp,
  FileText,
  Plus,
  ShoppingCart,
  Download
} from 'lucide-react';
// @ts-ignore
import { Link } from 'react-router-dom';
import TharLoader from '../components/TharLoader';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [data, transactions] = await Promise.all([
         fetchInventory(),
         fetchTransactions() // Fetches recent history
      ]);
      setInventory(data);
      // Filter for sales only for the recent table
      setRecentSales(transactions.filter(t => t.type === 'SALE').slice(0, 5));
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = getStats(inventory);
  const lowStockItems = inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStockThreshold).slice(0, 5);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-slate-500 mt-1">Welcome back, {user.name}. Here's what's happening today.</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-3">
           <Link to="/transactions" className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
              <Download size={16} /> New Purchase
           </Link>
           <Link to="/transactions" className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-md shadow-primary-200">
              <Plus size={16} /> New Invoice
           </Link>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Stock Value" 
          value={`₹${(stats.totalValue / 100000).toFixed(2)} Lakh`} 
          icon={Banknote} 
          trend="+2.5%"
          colorClass="bg-white"
        />
        <StatCard 
          title="Low Stock Alerts" 
          value={stats.lowStockCount} 
          icon={AlertTriangle} 
          colorClass={stats.lowStockCount > 0 ? "bg-white border-l-4 border-yellow-400" : "bg-white"}
        />
        <StatCard 
          title="Zero Stock Items" 
          value={stats.zeroStockCount} 
          icon={AlertCircle} 
          colorClass={stats.zeroStockCount > 0 ? "bg-white border-l-4 border-red-500" : "bg-white"}
        />
        <StatCard 
          title="Total Parts" 
          value={stats.totalItems} 
          icon={Package} 
          colorClass="bg-white"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* 3. Recent Invoices (Main Panel) */}
         <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <FileText size={18} className="text-slate-400" /> Recent Invoices
               </h3>
               <Link to="/transactions" className="text-sm text-primary-600 hover:underline">View All</Link>
            </div>
            <div className="flex-1 overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                     <tr>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium">Customer</th>
                        <th className="px-6 py-3 font-medium">Part</th>
                        <th className="px-6 py-3 font-medium text-right">Amount</th>
                        <th className="px-6 py-3 font-medium text-center">Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {recentSales.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">No recent sales.</td></tr>
                     ) : (
                        recentSales.map((tx: any) => (
                           <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                              <td className="px-6 py-3 font-medium text-slate-900">{tx.customerName || 'Walk-in'}</td>
                              <td className="px-6 py-3 text-slate-600 font-mono text-xs">{tx.partNumber}</td>
                              <td className="px-6 py-3 text-right font-medium">₹{(tx.price * tx.quantity).toLocaleString()}</td>
                              <td className="px-6 py-3 text-center">
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    Paid
                                 </span>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* 4. Low Stock Panel (Side Panel) */}
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div className="p-5 border-b border-slate-100">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <TrendingUp size={18} className="text-yellow-500" /> Stock Alerts
               </h3>
            </div>
            <div className="p-4 space-y-3">
               {lowStockItems.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Inventory looks healthy!</p>
               ) : (
                  lowStockItems.map(item => (
                     <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-yellow-200 transition-colors">
                        <div>
                           <div className="font-bold text-sm text-slate-800">{item.partNumber}</div>
                           <div className="text-xs text-slate-500">{item.name}</div>
                        </div>
                        <div className="text-right">
                           <div className="text-sm font-bold text-red-600">{item.quantity} left</div>
                           <div className="text-[10px] text-slate-400">Min: {item.minStockThreshold}</div>
                        </div>
                     </div>
                  ))
               )}
            </div>
            <div className="mt-auto p-4 border-t border-slate-100">
               <button className="w-full py-2 text-sm text-slate-600 hover:text-primary-600 font-medium border border-slate-200 hover:border-primary-200 rounded-lg transition-colors">
                  View Full Stock Report
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;