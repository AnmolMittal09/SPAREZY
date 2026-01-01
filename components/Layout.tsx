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
  Settings, 
  LogOut, 
  Menu, 
  Search,
  Bell,
  ChevronDown,
  CheckSquare,
  FileText,
  Download,
  X,
  Home,
  MoreHorizontal,
  XCircle,
  Zap,
  UserCircle
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    fetchInventory().then(setInventory);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

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
    navigate(`/item/${encodeURIComponent(partNumber)}`);
    setShowResults(false);
    setSearchQuery('');
    setMobileSearchOpen(false);
  };

  const navGroups = [
    {
      title: 'Navigation',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Inventory', path: '/parts', icon: Package },
      ]
    },
    {
      title: 'Counter & Sales',
      items: [
        { label: 'Point of Sale', path: '/billing', icon: Zap },
        { label: 'Tax Invoices', path: '/invoices', icon: FileText, requiredRole: Role.OWNER },
        { label: 'Stock Returns', path: '/billing?tab=return', icon: ArrowRightLeft },
      ]
    },
    {
      title: 'Purchasing',
      items: [
        { label: 'New Purchases', path: '/purchases', icon: ShoppingBag },
        { label: 'Requisitions', path: '/requisitions', icon: ClipboardList },
        { label: 'Admin Approvals', path: '/approvals', icon: CheckSquare, requiredRole: Role.OWNER },
      ]
    },
    {
      title: 'Management',
      items: [
        { label: 'Stock Alerts', path: '/low-stock', icon: AlertTriangle },
        { label: 'Bulk Update', path: '/import-export', icon: FileUp, requiredRole: Role.OWNER },
        { label: 'Analytics', path: '/reports', icon: BarChart3, requiredRole: Role.OWNER },
        { label: 'Admin Settings', path: '/settings', icon: Settings, requiredRole: Role.OWNER },
      ]
    }
  ];

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all duration-300 ${
          isActive ? 'text-brand-600' : 'text-slate-400 active:bg-slate-100'
        }`}
      >
        <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-brand-50 shadow-sm' : 'bg-transparent'}`}>
           <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] uppercase tracking-wider ${isActive ? 'font-bold' : 'font-semibold'}`}>{label}</span>
      </Link>
    );
  };

  return (
    <div className="h-screen bg-[#F8FAFC] flex overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-50 lg:hidden backdrop-blur-sm transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[60] w-[280px] bg-white border-r border-slate-200 flex flex-col transform transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-50">
           <Link to="/" className="flex items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-200">
                <Package size={20} strokeWidth={2.5} />
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tighter">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors">
             <X size={24} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-2">
                <h3 className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                  {group.title}
                </h3>
                
                <div className="space-y-1">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      const isActive = location.pathname === item.path;
                      
                      return (
                        <Link
                          key={itemIdx}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[14px] font-semibold transition-all duration-200 group ${
                            isActive 
                              ? 'bg-brand-600 text-white shadow-xl shadow-brand-200' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <item.icon 
                            size={18} 
                            strokeWidth={isActive ? 2.5 : 2}
                            className={`transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} 
                          />
                          <span>{item.label}</span>
                          {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-4 border-t border-slate-50">
           <div className="relative">
             <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-brand-200 hover:bg-white transition-all text-left group"
             >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-soft ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-brand-500'}`}>
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</p>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
             </button>

             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-white rounded-2xl shadow-premium border border-slate-100 overflow-hidden animate-slide-up z-50">
                  <div className="p-2">
                     <button onClick={onLogout} className="w-full text-left px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-3 font-bold transition-colors">
                        <LogOut size={18} /> Sign Out
                     </button>
                  </div>
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* MAIN SECTION */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* HEADER */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 lg:px-10 z-40 no-print">
           <div className="flex items-center gap-4 lg:hidden">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 text-slate-600 bg-slate-50 rounded-2xl active:scale-95 transition-all">
                <Menu size={24} />
              </button>
              <span className="font-black text-xl tracking-tighter text-slate-900">Sparezy</span>
           </div>

           {/* DESKTOP SEARCH */}
           <div className="hidden lg:flex flex-1 max-w-xl relative" ref={searchRef}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                 type="text" 
                 className="block w-full pl-12 pr-4 py-3.5 border-none rounded-2xl bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/10 focus:bg-white transition-all text-[15px] font-medium shadow-inner"
                 placeholder="Search global inventory by part number or name..."
                 value={searchQuery}
                 onChange={handleSearch}
              />
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-premium border border-slate-100 max-h-[400px] overflow-y-auto z-50 animate-slide-up no-scrollbar">
                   {searchResults.length === 0 ? (
                      <div className="p-10 text-slate-400 text-center font-medium">No matches found for "{searchQuery}"</div>
                   ) : (
                      <div className="p-2 space-y-1">
                        {searchResults.map(item => (
                          <div 
                             key={item.id}
                             onClick={() => navigateToItem(item.partNumber)}
                             className="px-4 py-4 hover:bg-slate-50 rounded-2xl cursor-pointer flex justify-between items-center transition-colors group"
                          >
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center font-bold text-xs">
                                   {item.brand.charAt(0)}
                                </div>
                                <div>
                                   <div className="text-[15px] font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{item.partNumber}</div>
                                   <div className="text-xs text-slate-500 font-medium">{item.name}</div>
                                </div>
                             </div>
                             <div className="text-right">
                                <div className="text-[15px] font-bold text-slate-900">₹{item.price.toLocaleString()}</div>
                                <div className={`text-[10px] font-bold uppercase tracking-widest ${item.quantity > 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                                   {item.quantity} in stock
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                   )}
                </div>
             )}
           </div>

           <div className="flex items-center gap-3 ml-auto">
              <button onClick={() => setMobileSearchOpen(true)} className="lg:hidden p-2.5 text-slate-600 bg-slate-50 rounded-2xl active:scale-95 transition-all">
                <Search size={22} />
              </button>
              
              <button className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-2xl relative transition-all active:scale-95">
                 <Bell size={22} />
                 <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
              </button>
           </div>
        </header>

        {/* MOBILE SEARCH */}
        {mobileSearchOpen && (
           <div className="fixed inset-0 bg-white z-[70] flex flex-col animate-fade-in">
             <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="relative flex-1">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                   <input 
                     autoFocus
                     type="text"
                     className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-4 text-[16px] font-medium focus:ring-2 focus:ring-brand-500/10 outline-none"
                     placeholder="Search Part Number..."
                     value={searchQuery}
                     onChange={handleSearch}
                   />
                </div>
                <button 
                  onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); setShowResults(false); }}
                  className="px-4 h-12 text-slate-500 font-bold text-[15px]"
                >
                  Cancel
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                 {searchResults.length > 0 ? (
                    <div className="space-y-3">
                       {searchResults.map(item => (
                          <div 
                             key={item.id}
                             onClick={() => navigateToItem(item.partNumber)}
                             className="bg-white border border-slate-100 p-4 rounded-3xl shadow-soft active:scale-95 transition-all"
                          >
                             <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-[17px] text-slate-900">{item.partNumber}</span>
                                <span className="font-bold text-brand-600 text-[17px]">₹{item.price.toLocaleString()}</span>
                             </div>
                             <div className="text-[14px] text-slate-500 font-medium">{item.name}</div>
                          </div>
                       ))}
                    </div>
                 ) : searchQuery.length > 1 ? (
                    <div className="text-center text-slate-400 mt-20 font-medium">No parts found</div>
                 ) : (
                    <div className="text-center text-slate-400 mt-20 font-medium italic">Type part number or description...</div>
                 )}
             </div>
           </div>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-8 scroll-smooth no-scrollbar">
           <div className="max-w-7xl mx-auto pb-24 lg:pb-0">
              {children}
           </div>
        </main>

        {/* MOBILE TAB BAR */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50 px-4 py-2 flex items-center justify-around h-[70px] shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
           <NavItem to="/" icon={Home} label="Home" />
           <NavItem to="/billing" icon={Zap} label="Sale" />
           <NavItem to="/parts" icon={Package} label="Items" />
           <NavItem to="/purchases" icon={ShoppingBag} label="Buy" />
           
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl text-slate-400 active:bg-slate-100 transition-all"
           >
              <div className="p-1.5">
                  <Menu size={22} />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold">Menu</span>
           </button>
        </div>

      </div>
    </div>
  );
};

export default Layout;