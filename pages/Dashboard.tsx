
import React, { useEffect, useState } from 'react';
import { User, Role, StockItem, Brand } from '../types';
import { fetchInventory, getStats } from '../services/inventoryService';
import { generateInventoryInsights } from '../services/geminiService';
import StatCard from '../components/StatCard';
import StockTable from '../components/StockTable';
import { 
  Package, 
  AlertTriangle, 
  AlertCircle, 
  Banknote, 
  Sparkles, 
  Loader2,
  Eye,
  EyeOff,
  Filter,
  X
} from 'lucide-react';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Filters
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchInventory();
      setInventory(data);
      setLoading(false);
    };
    loadData();
  }, []);

  const stats = getStats(inventory);

  const handleGenerateInsights = async () => {
    setLoadingAi(true);
    const insight = await generateInventoryInsights(inventory);
    setAiInsight(insight);
    setLoadingAi(false);
  };

  const toggleBrand = (brand: Brand) => {
    if (selectedBrand === brand) setSelectedBrand(undefined);
    else setSelectedBrand(brand);
  };

  // Filter items passed to table
  const displayedInventory = inventory.filter(item => {
    if (hideOutOfStock && item.quantity === 0) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-blue-600">
        <Loader2 className="animate-spin" size={32} />
        <span className="ml-2 font-medium">Loading Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.role === Role.OWNER ? 'Owner Overview' : 'Manager Overview'}
          </h1>
          <p className="text-gray-500">Welcome back, {user.name}</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
           <button
             onClick={() => setHideOutOfStock(!hideOutOfStock)}
             className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                hideOutOfStock 
                ? 'bg-gray-800 text-white border-gray-800' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
             }`}
           >
             {hideOutOfStock ? <EyeOff size={18} /> : <Eye size={18} />}
             {hideOutOfStock ? 'Hidden Out of Stock' : 'Hide Out of Stock'}
           </button>

           {user.role === Role.OWNER && (
            <button 
                onClick={handleGenerateInsights}
                disabled={loadingAi}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
                {loadingAi ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {aiInsight ? 'Refresh Insights' : 'AI Insights'}
            </button>
           )}
        </div>
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

      {/* Brand Splits - Interactive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
            onClick={() => toggleBrand(Brand.HYUNDAI)}
            className={`rounded-xl p-6 text-white shadow-lg cursor-pointer transition-all transform hover:scale-[1.01] relative overflow-hidden ${
                selectedBrand === Brand.HYUNDAI 
                ? 'bg-blue-900 ring-4 ring-blue-300 ring-offset-2' 
                : selectedBrand === Brand.MAHINDRA // Dim if other selected
                    ? 'bg-blue-900 opacity-60 hover:opacity-80'
                    : 'bg-gradient-to-br from-blue-900 to-blue-800'
            }`}
        >
          {selectedBrand === Brand.HYUNDAI && (
             <div className="absolute top-4 right-4 bg-white/20 p-1 rounded-full"><Filter size={16} /></div>
          )}
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

        <div 
            onClick={() => toggleBrand(Brand.MAHINDRA)}
            className={`rounded-xl p-6 text-white shadow-lg cursor-pointer transition-all transform hover:scale-[1.01] relative overflow-hidden ${
                selectedBrand === Brand.MAHINDRA 
                ? 'bg-red-700 ring-4 ring-red-300 ring-offset-2' 
                : selectedBrand === Brand.HYUNDAI
                    ? 'bg-red-700 opacity-60 hover:opacity-80'
                    : 'bg-gradient-to-br from-red-700 to-red-600'
            }`}
        >
          {selectedBrand === Brand.MAHINDRA && (
             <div className="absolute top-4 right-4 bg-white/20 p-1 rounded-full"><Filter size={16} /></div>
          )}
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

      {/* Filter Status Bar if active */}
      {(selectedBrand || hideOutOfStock) && (
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
             <Filter size={14} />
             <span>Active Filters:</span>
             {selectedBrand && (
                 <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-800 font-medium flex items-center gap-1">
                    {selectedBrand} 
                    <button onClick={() => setSelectedBrand(undefined)} className="hover:text-red-500"><X size={12}/></button>
                 </span>
             )}
             {hideOutOfStock && (
                 <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-800 font-medium flex items-center gap-1">
                    No Zero Stock
                    <button onClick={() => setHideOutOfStock(false)} className="hover:text-red-500"><X size={12}/></button>
                 </span>
             )}
             <button onClick={() => {setSelectedBrand(undefined); setHideOutOfStock(false)}} className="text-blue-600 hover:underline ml-auto">Clear All</button>
          </div>
      )}

      {/* Main List */}
      <StockTable 
         items={displayedInventory} 
         title={selectedBrand ? `${selectedBrand} Inventory` : "Full Inventory"} 
         brandFilter={selectedBrand} 
      />
    </div>
  );
};

export default Dashboard;
