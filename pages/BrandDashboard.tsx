import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Brand, StockItem } from '../types';
import { getInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import StatCard from '../components/StatCard';
import { Package, AlertTriangle, AlertCircle } from 'lucide-react';

const BrandDashboard: React.FC = () => {
  const { brandName } = useParams<{ brandName: string }>();
  const [inventory, setInventory] = useState<StockItem[]>([]);
  
  // Normalize brand from URL
  const targetBrand = brandName?.toUpperCase() === 'HYUNDAI' ? Brand.HYUNDAI : Brand.MAHINDRA;
  const brandColor = targetBrand === Brand.HYUNDAI ? 'text-blue-700' : 'text-red-700';

  useEffect(() => {
    const allItems = getInventory();
    setInventory(allItems.filter(i => i.brand === targetBrand));
  }, [targetBrand]);

  const total = inventory.length;
  const low = inventory.filter(i => i.quantity > 0 && i.quantity < i.minStockThreshold).length;
  const zero = inventory.filter(i => i.quantity === 0).length;

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
