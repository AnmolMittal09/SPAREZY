
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
  XCircle
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

    // PWA Install Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Update UI notify the user they can install the PWA
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // Optionally, send analytics event with outcome of user choice
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
    navigate(`/parts?search=${encodeURIComponent(partNumber)}`);
    setShowResults(false);
    setSearchQuery('');
    setMobileSearchOpen(false);
  };

  // --- NAVIGATION CONFIGURATION ---
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
        { label: 'Billing', path: '/billing', icon: Receipt },
        { label: 'Tax Invoices', path: '/invoices', icon: FileText, requiredRole: Role.OWNER },
        { label: 'Purchases', path: '/purchases', icon: ShoppingBag },
        { label: 'Requisitions', path: '/requisitions', icon: ClipboardList },
        { label: 'Approvals', path: '/approvals', icon: CheckSquare, requiredRole: Role.OWNER },
      ]
    },
    {
      title: 'Inventory Mgmt',
      items: [
        { label: 'Stock Movements', path: '/movements', icon: ArrowRightLeft },
        { label: 'Low Stock Items', path: '/low-stock', icon: AlertTriangle },
        { label: 'Out of Stock', path: '/out-of-stock', icon: XCircle },
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

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`flex flex-col items-center justify-center gap-0.5 p-1 rounded-xl transition-all duration-200 ${
          isActive ? 'text-blue-600' : 'text-slate-400 active:bg-slate-50'
        }`}
      >
        <div className={`p-1 rounded-full ${isActive ? 'bg-blue-50' : 'bg-transparent'}`}>
           <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
      </Link>
    );
  };

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans">
      
      {/* --- MOBILE SIDEBAR DRAWER --- */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[60] w-[280px] bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-14 lg:h-16 flex items-center justify-between px-6 border-b border-slate-100 bg-white z-20">
           <Link to="/" className="flex items-center gap-2" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-sm">
                S
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
             <X size={24} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 pb-20 lg:pb-4">
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
                      
                      const isActive = location.pathname === item.path || (location.pathname !== '/' && location.pathname.startsWith(item.path + '/'));
                      
                      return (
                        <Link
                          key={itemIdx}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                            isActive 
                              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <item.icon 
                            size={20} 
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

        {/* INSTALL APP BUTTON */}
        {showInstallBtn && (
           <div className="px-4 py-2">
             <button 
               onClick={handleInstallClick}
               className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 py-3 rounded-lg text-sm font-bold transition-colors"
             >
               <Download size={16} /> Install App
             </button>
           </div>
        )}

        <div className="p-4 border-t border-slate-200 bg-white z-20 lg:mb-0 mb-safe-bottom">
           <div className="relative">
             <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left group"
             >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${user.role === Role.OWNER ? 'bg-indigo-600' : 'bg-teal-600'}`}>
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">{user.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{user.role}</p>
                </div>
                <ChevronDown size={16} className="text-slate-400" />
             </button>

             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in z-50">
                  <div className="p-1">
                     <button onClick={onLogout} className="w-full text-left px-3 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 font-medium">
                        <LogOut size={16} /> Sign Out
                     </button>
                  </div>
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* --- RIGHT SECTION (MAIN CONTENT) --- */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* MOBILE HEADER - COMPACT (h-12 / 48px) */}
        <header className="h-12 lg:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 lg:px-8 shadow-sm z-30 sticky top-0 no-print">
           {/* Mobile Logo */}
           <div className="flex items-center gap-2 lg:hidden">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">
                  S
                </div>
                <span className="font-bold text-base text-slate-900 tracking-tight">Sparezy</span>
              </Link>
           </div>

           {/* Desktop Search */}
           <div className="hidden lg:flex flex-1 max-w-2xl relative ml-4" ref={searchRef}>
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
                      <div className="p-8 text-sm text-slate-500 text-center">No parts found.</div>
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

           <div className="flex items-center gap-2 ml-auto">
              {/* Mobile Search Toggle */}
              <button 
                onClick={() => setMobileSearchOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-full"
              >
                <Search size={20} />
              </button>
              
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full relative">
                 <Bell size={20} />
                 <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>
           </div>
        </header>

        {/* MOBILE FULL SCREEN SEARCH MODAL */}
        {mobileSearchOpen && (
           <div className="fixed inset-0 bg-white z-[70] flex flex-col animate-fade-in">
             <div className="p-3 border-b border-slate-100 flex items-center gap-2 h-14">
                <div className="relative flex-1">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                     autoFocus
                     type="text"
                     className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="Search Part Number..."
                     value={searchQuery}
                     onChange={handleSearch}
                   />
                </div>
                <button 
                  onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); setShowResults(false); }}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  <span className="text-sm font-bold">Cancel</span>
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4">
                 {searchResults.length > 0 ? (
                    <div className="space-y-3">
                       {searchResults.map(item => (
                          <div 
                             key={item.id}
                             onClick={() => navigateToItem(item.partNumber)}
                             className="bg-white border border-slate-100 shadow-sm p-4 rounded-xl active:scale-95 transition-transform"
                          >
                             <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-slate-900">{item.partNumber}</span>
                                <span className="font-bold text-blue-600">₹{item.price}</span>
                             </div>
                             <div className="text-sm text-slate-500">{item.name}</div>
                          </div>
                       ))}
                    </div>
                 ) : searchQuery.length > 1 ? (
                    <div className="text-center text-slate-400 mt-10">No results found</div>
                 ) : (
                    <div className="text-center text-slate-400 mt-10">Type to search inventory</div>
                 )}
             </div>
           </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-3 lg:p-8 pb-20 lg:pb-8">
           <div className="max-w-[1600px] mx-auto space-y-4 lg:space-y-6 h-full">
              {children}
           </div>
        </main>

        {/* --- MOBILE BOTTOM NAVIGATION (Slimmer & Spaced) --- */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 grid grid-cols-5 gap-1 px-2 py-1 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] h-[60px]">
           <NavItem to="/" icon={Home} label="Home" />
           <NavItem to="/billing" icon={Receipt} label="POS" />
           <NavItem to="/parts" icon={Package} label="Parts" />
           <NavItem to="/purchases" icon={ShoppingBag} label="Buy" />
           
           <button 
             onClick={() => setIsSidebarOpen(true)}
             className={`flex flex-col items-center justify-center gap-0.5 p-1 rounded-xl transition-all duration-200 text-slate-400 active:bg-slate-50`}
           >
              <div className="p-1 rounded-full bg-transparent">
                  <MoreHorizontal size={20} />
              </div>
              <span className="text-[10px] font-medium">Menu</span>
           </button>
        </div>

      </div>
    </div>
  );
};

export default Layout;
