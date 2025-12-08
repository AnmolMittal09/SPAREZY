
import React, { useEffect, useState } from 'react';
import { User, Brand, Role, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import StockTable from '../components/StockTable';
import { 
  Search, 
  Plus, 
  ShoppingCart, 
  Truck, 
  PackagePlus,
  Filter,
  X
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
  
  // Operational State
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<Brand | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  
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
      {/* 1. Header & Operational Tools */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
         
         {/* Top Row: Title + Quick Actions */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                   Operations Workspace
                </h1>
                <p className="text-slate-500 text-sm">Find parts, check stock, and manage inventory.</p>
             </div>
             
             <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                 <button 
                   onClick={() => navigate('/transactions')} 
                   className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap"
                 >
                    <Plus size={16} /> New Invoice
                 </button>
                 <button 
                   onClick={() => navigate('/transactions')} // Mode is handled in transactions page state, here just link
                   className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                 >
                    <Truck size={16} /> Purchase
                 </button>
                 {user.role === Role.OWNER && (
                    <button 
                      onClick={() => navigate('/upload')} 
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                    >
                        <PackagePlus size={16} /> Add Part
                    </button>
                 )}
             </div>
         </div>

         {/* Search & Filters Row */}
         <div className="flex flex-col md:flex-row gap-4">
             {/* Large Search Bar */}
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

             {/* Filters */}
             <div className="flex gap-2 items-center overflow-x-auto">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <button 
                      onClick={() => setBrandFilter(undefined)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!brandFilter ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       All Brands
                    </button>
                    <button 
                      onClick={() => setBrandFilter(Brand.HYUNDAI)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${brandFilter === Brand.HYUNDAI ? 'bg-blue-100 text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       Hyundai
                    </button>
                    <button 
                      onClick={() => setBrandFilter(Brand.MAHINDRA)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${brandFilter === Brand.MAHINDRA ? 'bg-red-100 text-red-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       Mahindra
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-300 mx-1 hidden md:block"></div>

                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <button 
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       All Stock
                    </button>
                    <button 
                      onClick={() => setStatusFilter('LOW')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'LOW' ? 'bg-yellow-100 text-yellow-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       Low Stock
                    </button>
                    <button 
                      onClick={() => setStatusFilter('OUT')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === 'OUT' ? 'bg-red-100 text-red-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       Out of Stock
                    </button>
                </div>
             </div>
         </div>
      </div>

      {/* 2. Results Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
         <StockTable 
            items={inventory} 
            title="Search Results"
            userRole={user.role}
            brandFilter={brandFilter}
            enableActions={true}
            externalSearch={searchQuery}
            hideToolbar={true} // Hide internal search bar since we have the big one
            stockStatusFilter={statusFilter}
         />
      </div>
    </div>
  );
};

export default Dashboard;
