
import React, { useState, useRef, useEffect } from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Role, StockItem } from '../types';
import { fetchInventory } from '../services/inventoryService';
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  ShoppingBag, 
  ClipboardList, 
  ArrowRightLeft, 
  AlertTriangle, 
  FileUp, 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  Building2,
  Truck,
  Contact,
  FileBarChart,
  History
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [searchResults, setSearchResults] = useState<StockItem[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetchInventory().then(setInventory);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 1) {
      const results = inventory.filter(item => 
        item.partNumber.toLowerCase().includes(query.toLowerCase()) || 
        item.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8);
      setSearchResults(results);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const navigateToItem = (partNumber: string) => {
    navigate(`/parts?search=${encodeURIComponent(partNumber)}`);
    setShowResults(false);
    setSearchQuery('');
  };

  // --- NAVIGATION CONFIGURATION (STRICTLY FROM PROMPT) ---
  const navGroups = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Parts List', path: '/parts', icon: Package },
      ]
    },
    {
      title: 'Transactions',
      items: [
        { label: 'Billing / Invoices', path: '/billing', icon: Receipt },
        { label: 'Purchases', path: '/purchases', icon: ShoppingBag },
        { label: 'Requisitions', path: '/requisitions', icon: ClipboardList },
      ]
    },
    {
      title: 'Inventory Mgmt',
      items: [
        { label: 'Stock Movements', path: '/movements', icon: ArrowRightLeft },
        { label: 'Low Stock Items', path: '/low-stock', icon: AlertTriangle },
        { label: 'Import / Export', path: '/import-export', icon: FileUp, requiredRole: Role.OWNER },
      ]
    },
    {
      title: 'Reports',
      items: [
        { label: 'Analytics & Reports', path: '/reports', icon: BarChart3, requiredRole: Role.OWNER },
      ]
    },
    {
      title: 'Admin / Settings',
      items: [
        { label: 'Settings & Admin', path: '/settings', icon: Settings, requiredRole: Role.OWNER },
      ]
    }
  ];

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans">
      
      {/* --- 1. LEFT SIDEBAR --- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white z-20">
           <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-sm">
                S
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Sparezy</span>
           </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
           {navGroups.map((group, idx) => (
             <div key={idx} className="group-section">
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 py-2 z-10">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                     {group.title}
                   </h3>
                </div>
                
                <div className="px-3 mt-1 space-y-0.5">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      
                      const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                      
                      return (
                        <Link
                          key={itemIdx}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                            isActive 
                              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <item.icon 
                            size={18} 
                            strokeWidth={isActive ? 2.5 : 2}
                            className={`transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} 
                          />
                          <span>{item.label}</span>
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white z-20">
           <div className="relative">
             <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left group"
             >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${user.role === Role.OWNER ? 'bg-indigo-600' : 'bg-teal-600'}`}>
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">{user.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{user.role}</p>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
             </button>

             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in z-50">
                  <div className="p-1">
                     <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                        <LogOut size={14} /> Sign Out
                     </button>
                  </div>
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* --- RIGHT SECTION --- */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shadow-sm z-30 sticky top-0">
           <div className="flex items-center gap-4 lg:hidden">
              <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 hover:bg-slate-100 p-2 rounded-lg">
                 <Menu size={20} />
              </button>
              <span className="font-bold text-lg text-slate-900">Sparezy</span>
           </div>

           <div className="hidden lg:flex flex-1 max-w-2xl relative" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input 
                 type="text" 
                 className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 sm:text-sm transition-all"
                 placeholder="Search global inventory..."
                 value={searchQuery}
                 onChange={handleSearch}
              />
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 max-h-96 overflow-y-auto z-50 animate-fade-in">
                   {searchResults.length === 0 ? (
                      <div className="p-8 text-sm text-slate-500 text-center">No parts found matching "{searchQuery}"</div>
                   ) : (
                      searchResults.map(item => (
                        <div 
                           key={item.id}
                           onClick={() => navigateToItem(item.partNumber)}
                           className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                           <div>
                              <div className="text-sm font-semibold text-slate-900">{item.partNumber}</div>
                              <div className="text-xs text-slate-500">{item.name}</div>
                           </div>
                           <div className="text-right">
                              <div className="text-sm font-bold text-slate-800">₹{item.price}</div>
                           </div>
                        </div>
                      ))
                   )}
                </div>
              )}
           </div>

           <div className="flex items-center gap-3 ml-4">
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full relative">
                 <Bell size={20} />
              </button>
           </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8">
           <div className="max-w-[1600px] mx-auto space-y-6">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
