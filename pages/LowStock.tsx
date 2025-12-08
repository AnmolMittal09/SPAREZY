
import React, { useEffect, useState } from 'react';
import { User, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import TharLoader from '../components/TharLoader';
import { AlertTriangle } from 'lucide-react';

interface Props {
  user: User;
}

const LowStock: React.FC<Props> = ({ user }) => {
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
            <AlertTriangle className="text-red-600" /> Low Stock Alerts
         </h1>
         <p className="text-slate-500">Items below minimum threshold requiring reorder.</p>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <StockTable 
             items={inventory} 
             title="Critical Inventory"
             userRole={user.role}
             enableActions={true}
             stockStatusFilter="LOW"
          />
      </div>
    </div>
  );
};

export default LowStock;
