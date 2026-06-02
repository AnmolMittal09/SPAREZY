
import React, { useEffect, useState, useMemo } from 'react';
import { User, Brand, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import TharLoader from '../components/TharLoader';
import { Package, Layers, AlertTriangle } from 'lucide-react';

interface Props {
  user: User;
}

const PartsList: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [brandFilter, setBrandFilter] = useState<Brand | undefined>(undefined);
  const [showBelowThresholdOnly, setShowBelowThresholdOnly] = useState(false);

  useEffect(() => {
    fetchInventory().then(data => {
      setInventory(data);
      setLoading(false);
    });
  }, []);

  const displayedInventory = useMemo(() => {
    if (!showBelowThresholdOnly) return inventory;
    return inventory.filter(item => item.quantity < item.minStockThreshold);
  }, [inventory, showBelowThresholdOnly]);

  if (loading) return <TharLoader />;

  return (
    <div className="space-y-4 md:space-y-6 flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-1">
         <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
               <Package className="text-blue-600" /> Parts List
            </h1>
            <p className="text-slate-500 text-sm hidden md:block">Manage your entire inventory catalog.</p>
         </div>

         <div className="w-full md:w-auto flex flex-col md:flex-row gap-2.5">
             {/* Below Threshold Toggle */}
             <button
                onClick={() => setShowBelowThresholdOnly(!showBelowThresholdOnly)}
                className={`flex-grow md:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border text-[11px] font-bold uppercase transition-all shadow-sm ${
                   showBelowThresholdOnly 
                     ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/60' 
                     : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
             >
                <AlertTriangle size={14} className={showBelowThresholdOnly ? 'text-amber-600 animate-pulse' : 'text-amber-500'} />
                <span>Below Threshold Only</span>
             </button>

             {/* Brand Filters */}
             <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto no-scrollbar">
                <button 
                   onClick={() => setBrandFilter(undefined)}
                   className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                      brandFilter === undefined 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                   }`}
                >
                   <Layers size={12} /> All
                </button>
                <button 
                   onClick={() => setBrandFilter(Brand.HYUNDAI)}
                   className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all whitespace-nowrap ${
                      brandFilter === Brand.HYUNDAI 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                   }`}
                >
                   Hyundai
                </button>
                <button 
                   onClick={() => setBrandFilter(Brand.MAHINDRA)}
                   className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all whitespace-nowrap ${
                      brandFilter === Brand.MAHINDRA 
                        ? 'bg-red-650 text-white shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-red-600'
                   }`}
                >
                   Mahindra
                </button>
             </div>

             {/* Status Filters */}
             <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar w-full md:w-auto">
                 <button 
                    onClick={() => setStatusFilter('ALL')}
                    className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase whitespace-nowrap transition-all ${statusFilter === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                 >
                    All
                 </button>
                 <button 
                    onClick={() => setStatusFilter('LOW')}
                    className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase whitespace-nowrap transition-all ${statusFilter === 'LOW' ? 'bg-amber-50 text-amber-700 border border-amber-200/50 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                 >
                    Low Stock
                 </button>
                 <button 
                    onClick={() => setStatusFilter('OUT')}
                    className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase whitespace-nowrap transition-all ${statusFilter === 'OUT' ? 'bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                 >
                    Out Stock
                 </button>
             </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
          <StockTable 
             items={displayedInventory} 
             title="Full Inventory"
             userRole={user.role}
             userName={user.name}
             brandFilter={brandFilter}
             enableActions={true}
             stockStatusFilter={statusFilter}
             hidePriceByDefault={true}
          />
      </div>
    </div>
  );
};

export default PartsList;
