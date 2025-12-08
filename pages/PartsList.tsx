
import React, { useEffect, useState } from 'react';
import { User, Brand, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import TharLoader from '../components/TharLoader';
import { Package, Filter } from 'lucide-react';

interface Props {
  user: User;
}

const PartsList: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [brandFilter, setBrandFilter] = useState<Brand | undefined>(undefined);

  useEffect(() => {
    fetchInventory().then(data => {
      setInventory(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-end">
         <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
               <Package className="text-blue-600" /> Parts List
            </h1>
            <p className="text-slate-500">Manage your entire inventory catalog.</p>
         </div>
         <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
             <button 
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'ALL' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                All
             </button>
             <button 
                onClick={() => setStatusFilter('LOW')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'LOW' ? 'bg-yellow-100 text-yellow-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Low Stock
             </button>
             <button 
                onClick={() => setStatusFilter('OUT')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'OUT' ? 'bg-red-100 text-red-800' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Out of Stock
             </button>
         </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <StockTable 
             items={inventory} 
             title="Full Inventory"
             userRole={user.role}
             enableActions={true}
             stockStatusFilter={statusFilter}
          />
      </div>
    </div>
  );
};

export default PartsList;
