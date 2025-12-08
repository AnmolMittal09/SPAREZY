

import React, { useEffect, useState } from 'react';
import { User, Brand, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import TharLoader from '../components/TharLoader';
import { Package, Layers } from 'lucide-react';

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
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
               <Package className="text-blue-600" /> Parts List
            </h1>
            <p className="text-slate-500">Manage your entire inventory catalog.</p>
         </div>

         <div className="flex flex-wrap items-center gap-4">
             {/* Brand Filters */}
             <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                <button 
                   onClick={() => setBrandFilter(undefined)}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-1 ${
                      brandFilter === undefined 
                        ? 'bg-slate-800 text-white' 
                        : 'text-slate-500 hover:bg-slate-50'
                   }`}
                >
                   <Layers size={14} /> All
                </button>
                <button 
                   onClick={() => setBrandFilter(Brand.HYUNDAI)}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                      brandFilter === Brand.HYUNDAI 
                        ? 'bg-blue-900 text-white' 
                        : 'text-slate-500 hover:text-blue-900'
                   }`}
                >
                   Hyundai
                </button>
                <button 
                   onClick={() => setBrandFilter(Brand.MAHINDRA)}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                      brandFilter === Brand.MAHINDRA 
                        ? 'bg-red-600 text-white' 
                        : 'text-slate-500 hover:text-red-600'
                   }`}
                >
                   Mahindra
                </button>
             </div>

             {/* Status Filters */}
             <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                 <button 
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${statusFilter === 'ALL' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    All Status
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
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <StockTable 
             items={inventory} 
             title="Full Inventory"
             userRole={user.role}
             brandFilter={brandFilter}
             enableActions={true}
             stockStatusFilter={statusFilter}
          />
      </div>
    </div>
  );
};

export default PartsList;