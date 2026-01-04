import React, { useEffect, useState } from 'react';
import { User, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import TharLoader from '../components/TharLoader';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  user: User;
}

const LowStock: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await fetchInventory();
      setInventory(data);
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

  if (loading && !refreshing) return <TharLoader />;

  return (
    <div className="space-y-6 flex flex-col">
      <div className="flex justify-between items-start">
         <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
               <AlertTriangle className="text-red-600" /> Low Stock Alerts
            </h1>
            <p className="text-slate-500">Items below minimum threshold requiring reorder.</p>
         </div>
         <button 
             onClick={() => loadData(true)}
             disabled={refreshing}
             className={`p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-brand-600 transition-all active:scale-95 shadow-sm ${refreshing ? 'opacity-50' : ''}`}
          >
             <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <StockTable 
             items={inventory} 
             title="Critical Inventory"
             userRole={user.role}
             enableActions={true}
             stockStatusFilter="LOW"
             hidePriceByDefault={true}
          />
      </div>
    </div>
  );
};

export default LowStock;