import React, { useEffect, useState } from 'react';
import { User, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import TharLoader from '../components/TharLoader';
import { XCircle } from 'lucide-react';

interface Props {
  user: User;
}

const OutOfStock: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory().then(data => {
      setInventory(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div>
         <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <XCircle className="text-red-600" /> Out of Stock Items
         </h1>
         <p className="text-slate-500">Items with zero quantity requiring immediate replenishment.</p>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <StockTable 
             items={inventory} 
             title="Zero Stock Inventory"
             userRole={user.role}
             enableActions={true}
             stockStatusFilter="OUT"
          />
      </div>
    </div>
  );
};

export default OutOfStock;