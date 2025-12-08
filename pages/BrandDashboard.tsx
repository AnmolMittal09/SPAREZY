
import React, { useEffect, useState } from 'react';
// @ts-ignore
import { useParams } from 'react-router-dom';
import { Brand, StockItem, User } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import StatCard from '../components/StatCard';
import TharLoader from '../components/TharLoader';
import { Package, AlertTriangle, AlertCircle, Search, TrendingUp, Boxes } from 'lucide-react';

interface Props {
  user: User;
}

const BrandDashboard: React.FC<Props> = ({ user }) => {
  const { brandName } = useParams<{ brandName: string }>();
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Normalize brand from URL
  const targetBrand = brandName?.toUpperCase() === 'HYUNDAI' ? Brand.HYUNDAI : Brand.MAHINDRA;
  
  // Theme Configurations
  const isHyundai = targetBrand === Brand.HYUNDAI;
  
  const theme = {
      gradient: isHyundai 
        ? 'bg-gradient-to-br from-slate-900 to-blue-900' 
        : 'bg-gradient-to-br from-red-700 to-red-600',
      textAccent: isHyundai ? 'text-blue-100' : 'text-red-100',
      iconBg: isHyundai ? 'bg-blue-800' : 'bg-red-800',
      tableBorder: isHyundai ? 'border-t-blue-500' : 'border-t-red-500'
  };

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const allItems = await fetchInventory();
        setInventory(allItems.filter(i => i.brand === targetBrand));
        setLoading(false);
    };
    loadData();
  }, [targetBrand]);

  const total = inventory.length;
  const low = inventory.filter(i => i.quantity > 0 && i.quantity < i.minStockThreshold).length;
  const zero = inventory.filter(i => i.quantity === 0).length;
  const totalValue = inventory.reduce((acc, item) => acc + (item.quantity * item.price), 0);

  if (loading) {
    return <TharLoader />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className={`${theme.gradient} rounded-2xl p-8 text-white shadow-xl relative overflow-hidden`}>
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 rounded-full bg-black opacity-10 blur-2xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
                <div className="flex items-center gap-3 mb-2 opacity-80">
                    <Boxes size={20} />
                    <span className="uppercase tracking-widest text-xs font-bold">Brand Overview</span>
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight mb-2">
                    {targetBrand}
                </h1>
                <p className={`${theme.textAccent} font-light max-w-lg`}>
                    Real-time inventory tracking, low stock alerts, and valuation specific to {targetBrand} spare parts.
                </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 min-w-[200px]">
                <p className="text-xs font-bold uppercase opacity-70 mb-1">Total Valuation</p>
                <p className="text-3xl font-bold">₹{totalValue.toLocaleString()}</p>
            </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
            title="Total Items" 
            value={total} 
            icon={Package} 
            colorClass="bg-white border-l-4 border-gray-300"
        />
        <StatCard 
            title="Low Stock Alerts" 
            value={low} 
            icon={AlertTriangle} 
            colorClass={low > 0 ? "bg-yellow-50 border-l-4 border-yellow-400" : "bg-white border-l-4 border-gray-200"}
            trend={low > 0 ? "Restock Needed" : "Healthy"}
        />
        <StatCard 
            title="Out of Stock" 
            value={zero} 
            icon={AlertCircle} 
            colorClass={zero > 0 ? "bg-red-50 border-l-4 border-red-500" : "bg-white border-l-4 border-gray-200"}
            trend={zero > 0 ? "Critical" : "Optimal"}
        />
      </div>

      {/* Main Table Container */}
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
         <StockTable 
            items={inventory} 
            title={`${targetBrand} Inventory List`} 
            brandFilter={targetBrand} 
            userRole={user.role}
            enableActions={true}
         />
      </div>
    </div>
  );
};

export default BrandDashboard;
