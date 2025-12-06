import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Brand, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import StatCard from '../components/StatCard';
import { Package, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

const BrandDashboard: React.FC = () => {
  const { brandName } = useParams<{ brandName: string }>();
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Normalize brand from URL
  const targetBrand = brandName?.toUpperCase() === 'HYUNDAI' ? Brand.HYUNDAI : Brand.MAHINDRA;
  const brandColor = targetBrand === Brand.HYUNDAI ? 'text-blue-700' : 'text-red-700';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${brandColor} flex items-center gap-2`}>
            {targetBrand} <span className="text-gray-900 font-light">Dashboard</span>
        </h1>
        <p className="text-gray-500 mt-1">Manage stock specific to {targetBrand} vehicles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Items" value={total} icon={Package} />
        <StatCard title="Low Stock Alerts" value={low} icon={AlertTriangle} colorClass="bg-yellow-50" />
        <StatCard title="Out of Stock" value={zero} icon={AlertCircle} colorClass="bg-red-50" />
      </div>

      <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200">
         <StockTable items={inventory} title={`${targetBrand} Inventory List`} brandFilter={targetBrand} />
      </div>
    </div>
  );
};

export default BrandDashboard;