import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Role, StockItem } from '../types';
import Logo from './Logo';
import { fetchInventory } from '../services/inventoryService';
import { 
  LayoutDashboard, 
  Car, 
  Upload, 
  LogOut, 
  Menu, 
  X,
  PackageSearch,
  ShoppingCart,
  ChevronRight,
  Users,
  ClipboardList,
  Search,
  Bell,
  Settings,
  HelpCircle,
  FileText
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

  useEffect(() => {
    // Load inventory for global search
    fetchInventory().then(setInventory);
  }, []);

  useEffect(() => {
    // Click outside to close search results
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
      ).slice(0, 8); // Limit to 8 results
      setSearchResults(results);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const navigateToItem = (partNumber: string) => {
    navigate(`/item/${encodeURIComponent(partNumber)}`);
    setShowResults(false);
    setSearchQuery('');
  };

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: string }) => {
    const active = isActive(to);
    
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
          active 
            ? 'bg-primary-50 text-primary-700' 
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <Icon size={18} className={`transition-colors ${active ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <span>{label}</span>
        {badge && (
           <span className="ml-auto bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      
      {/* --- 1. LEFT SIDEBAR --- */}
      {/* Mobile Overlay */}
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
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
           <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-black text-sm">
                S
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Sparezy<span className="text-primary-600">.</span></span>
           </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
           <div>
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Main</p>
              <div className="space-y-1">
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/transactions" icon={ShoppingCart} label="Billing & Purchases" />
                <NavItem to="/requests" icon={ClipboardList} label="Requisitions" />
              </div>
           </div>

           <div>
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Inventory</p>
              <div className="space-y-1">
                <NavItem to="/brand/hyundai" icon={Car} label="Hyundai Parts" />
                <NavItem to="/brand/mahindra" icon={Car} label="Mahindra Parts" />
              </div>
           </div>

           {user.role === Role.OWNER && (
             <div>
                <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Management</p>
                <div className="space-y-1">
                  <NavItem to="/upload" icon={Upload} label="Import Data" />
                  <NavItem to="/users" icon={Users} label="Team Access" />
                  <NavItem to="/reports" icon={FileText} label="Reports" />
                </div>
             </div>
           )}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${user.role === Role.OWNER ? 'bg-indigo-600' : 'bg-teal-600'}`}>
                  {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.role}</p>
              </div>
              <button onClick={onLogout} className="text-slate-400 hover:text-red-600 transition-colors">
                  <LogOut size={16} />
              </button>
           </div>
        </div>
      </aside>


      {/* --- RIGHT SECTION (Header + Content) --- */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* --- 2. TOP HEADER --- */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shadow-sm z-30 sticky top-0">
           <div className="flex items-center gap-4 lg:hidden">
              <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 hover:bg-slate-100 p-2 rounded-lg">
                 <Menu size={20} />
              </button>
              <Logo className="h-8 w-auto" />
           </div>

           {/* Global Search Bar */}
           <div className="hidden lg:flex flex-1 max-w-2xl relative" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input 
                 type="text" 
                 className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm transition-colors"
                 placeholder="Search parts by name, number, or HSN..."
                 value={searchQuery}
                 onChange={handleSearch}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                 <span className="text-gray-400 text-xs border border-gray-200 rounded px-1.5 py-0.5 hidden xl:block">/</span>
              </div>

              {/* Search Results Dropdown */}
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 max-h-96 overflow-y-auto z-50">
                   {searchResults.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500 text-center">No parts found matching "{searchQuery}"</div>
                   ) : (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                           Best Matches
                        </div>
                        {searchResults.map(item => (
                          <div 
                             key={item.id}
                             onClick={() => navigateToItem(item.partNumber)}
                             className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                          >
                             <div>
                                <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                  {item.partNumber}
                                  <span className={`text-[10px] px-1.5 rounded ${item.brand === 'HYUNDAI' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                    {item.brand.substring(0, 1)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">{item.name}</div>
                             </div>
                             <div className="text-right">
                                <div className="text-sm font-bold text-slate-800">₹{item.price}</div>
                                <div className={`text-[10px] font-medium ${item.quantity === 0 ? 'text-red-600' : 'text-green-600'}`}>
                                   {item.quantity} in stock
                                </div>
                             </div>
                          </div>
                        ))}
                      </>
                   )}
                </div>
              )}
           </div>

           {/* Header Actions */}
           <div className="flex items-center gap-3 ml-4">
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full relative">
                 <Bell size={20} />
                 <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                 <HelpCircle size={20} />
              </button>
           </div>
        </header>

        {/* --- 3. MAIN CONTENT --- */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8">
           <div className="max-w-7xl mx-auto space-y-6">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;