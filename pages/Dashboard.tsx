

import React, { useEffect, useState } from 'react';
import { User, Brand, Role, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search, 
  Plus, 
  Truck, 
  PackagePlus,
  X,
  Layers
} from 'lucide-react';
// @ts-ignore
import { Link, useNavigate } from 'react-router-dom';
import TharLoader from '../components/TharLoader';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<Brand | undefined>(undefined);
  
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchInventory();
      setInventory(data);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) return <TharLoader />;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                   Operations Workspace
                </h1>
                <p className="text-slate-500 text-sm">Find parts quickly and start transactions.</p>
             </div>
             
             <div className="flex gap-2">
                 <button 
                   onClick={() => navigate('/billing')} 
                   className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                 >
                    <Plus size={16} /> New Invoice
                 </button>
                 <button 
                   onClick={() => navigate('/purchases')} 
                   className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                 >
                    <Truck size={16} /> New Purchase
                 </button>
                 {user.role === Role.OWNER && (
                    <button 
                      onClick={() => navigate('/parts')} 
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <PackagePlus size={16} /> Manage Parts
                    </button>
                 )}
             </div>
         </div>

         <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search parts by name, number, brand, or HSN code..."
                  className="w-full pl-12 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                   <button 
                     onClick={() => setSearchQuery('')}
                     className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                   >
                      <X size={18} />
                   </button>
                )}
             </div>
             
             {/* Brand Filter Buttons */}
             <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button 
                   onClick={() => setBrandFilter(undefined)}
                   className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                      brandFilter === undefined 
                        ? 'bg-white text-slate-800 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                   }`}
                >
                   <Layers size={16} /> All
                </button>
                <button 
                   onClick={() => setBrandFilter(Brand.HYUNDAI)}
                   className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      brandFilter === Brand.HYUNDAI 
                        ? 'bg-blue-900 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-blue-900'
                   }`}
                >
                   Hyundai
                </button>
                <button 
                   onClick={() => setBrandFilter(Brand.MAHINDRA)}
                   className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      brandFilter === Brand.MAHINDRA 
                        ? 'bg-red-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-red-600'
                   }`}
                >
                   Mahindra
                </button>
             </div>
         </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
         <StockTable 
            items={inventory} 
            title="Part Search Results"
            userRole={user.role}
            brandFilter={brandFilter}
            enableActions={true}
            externalSearch={searchQuery}
            hideToolbar={true}
         />
      </div>
    </div>
  );
};

export default Dashboard;