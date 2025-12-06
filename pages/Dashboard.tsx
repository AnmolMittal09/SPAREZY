import React, { useEffect, useState } from 'react';
import { User, Role, StockItem, Brand } from '../types';
import { getInventory, getStats } from '../services/inventoryService';
import { generateInventoryInsights } from '../services/geminiService';
import StatCard from '../components/StatCard';
import StockTable from '../components/StockTable';
import { 
  Package, 
  AlertTriangle, 
  AlertCircle, 
  Banknote, 
  Sparkles, 
  Loader2 
} from 'lucide-react';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    const data = getInventory();
    setInventory(data);
    setLoading(false);
  }, []);

  const stats = getStats(inventory);

  const handleGenerateInsights = async () => {
    setLoadingAi(true);
    const insight = await generateInventoryInsights(inventory);
    setAiInsight(insight);
    setLoadingAi(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.role === Role.OWNER ? 'Owner Overview' : 'Manager Overview'}
          </h1>
          <p className="text-gray-500">Welcome back, {user.name}</p>
        </div>
        {user.role === Role.OWNER && (
          <button 
            onClick={handleGenerateInsights}
            disabled={loadingAi}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loadingAi ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {aiInsight ? 'Refresh AI Insights' : 'Get AI Insights'}
          </button>
        )}
      </div>

      {/* AI Insights Section */}
      {aiInsight && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-indigo-600" size={20} />
            <h3 className="font-bold text-indigo-900">AI Inventory Analysis</h3>
          </div>
          <p className="text-indigo-800 leading-relaxed whitespace-pre-line text-sm md:text-base">
            {aiInsight}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Inventory Value" 
          value={`₹${stats.totalValue.toLocaleString()}`} 
          icon={Banknote}
          colorClass="bg-white"
        />
        <StatCard 
          title="Total Parts Count" 
          value={stats.totalItems} 
          icon={Package} 
        />
        <StatCard 
          title="Low Stock Alerts" 
          value={stats.lowStockCount} 
          icon={AlertTriangle}
          colorClass={stats.lowStockCount > 0 ? "bg-yellow-50 border-yellow-100" : "bg-white"}
          trend={stats.lowStockCount > 0 ? "Action Needed" : "Healthy"}
        />
        <StatCard 
          title="Zero Stock Items" 
          value={stats.zeroStockCount} 
          icon={AlertCircle}
          colorClass={stats.zeroStockCount > 0 ? "bg-red-50 border-red-100" : "bg-white"}
          trend={stats.zeroStockCount > 0 ? "Critical" : "Perfect"}
        />
      </div>

      {/* Brand Splits - Visual Only */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-bold opacity-90 mb-1">Hyundai Overview</h3>
          <div className="mt-4 flex justify-between items-end">
             <div>
                <p className="text-blue-200 text-sm">Total Items</p>
                <p className="text-3xl font-bold">{inventory.filter(i => i.brand === Brand.HYUNDAI).length}</p>
             </div>
             <div className="text-right">
                <p className="text-blue-200 text-sm">Stockout</p>
                <p className="text-2xl font-bold">{inventory.filter(i => i.brand === Brand.HYUNDAI && i.quantity === 0).length}</p>
             </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-700 to-red-600 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-bold opacity-90 mb-1">Mahindra Overview</h3>
          <div className="mt-4 flex justify-between items-end">
             <div>
                <p className="text-red-200 text-sm">Total Items</p>
                <p className="text-3xl font-bold">{inventory.filter(i => i.brand === Brand.MAHINDRA).length}</p>
             </div>
             <div className="text-right">
                <p className="text-red-200 text-sm">Stockout</p>
                <p className="text-2xl font-bold">{inventory.filter(i => i.brand === Brand.MAHINDRA && i.quantity === 0).length}</p>
             </div>
          </div>
        </div>
      </div>

      {/* Main List */}
      <StockTable items={inventory} title="Full Inventory" />
    </div>
  );
};

export default Dashboard;
