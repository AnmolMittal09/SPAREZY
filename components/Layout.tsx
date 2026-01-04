
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Role } from '../types';
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
  ChevronDown, 
  CheckSquare, 
  FileText, 
  X, 
  Zap,
  RefreshCw,
  PieChart
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleGlobalRefresh = () => {
    setIsRefreshing(true);
    // Briefly animate before the full page reload triggers a fresh data fetch from Supabase/LS
    setTimeout(() => {
      window.location.reload();
    }, 600);
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
        { label: 'Profit Analysis', path: '/profit-analysis', icon: PieChart, requiredRole: Role.OWNER },
        { label: 'Analytics', path: '/reports', icon: BarChart3, requiredRole: Role.OWNER },
        { label: 'Admin Settings', path: '/settings', icon: Settings, requiredRole: Role.OWNER },
      ]
    }
  ];

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-[70] lg:hidden backdrop-blur-sm transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[80] w-[260px] bg-white border-r border-slate-200/60 flex flex-col transform transition-all duration-300 ease-in-out shadow-soft ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-50">
           <Link to="/" className="flex items-center gap-2.5" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-100/50">
                <Package size={16} strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-7 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-2">
                <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 opacity-80">
                  {group.title}
                </h3>
                
                <div className="space-y-0.5">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      const isActive = location.pathname === item.path;
                      
                      return (
                        <Link
                          key={itemIdx}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-200 group ${
                            isActive 
                              ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100' 
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <item.icon 
                            size={18} 
                            strokeWidth={isActive ? 2.5 : 2}
                            className={`transition-colors ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-500'}`} 
                          />
                          <span>{item.label}</span>
                          {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-brand-500 shadow-sm" />}
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50/20">
           <div className="relative">
             <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/60 hover:border-brand-200 hover:shadow-soft transition-all text-left group"
             >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-soft ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-brand-500'}`}>
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{user.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{user.role}</p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
             </button>

             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-elevated border border-slate-100 overflow-hidden animate-slide-up z-50">
                  <div className="p-1">
                     <button onMouseDown={onLogout} className="w-full text-left px-3 py-2.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2.5 font-bold transition-colors">
                        <LogOut size={16} /> Sign Out
                     </button>
                  </div>
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* MAIN SECTION */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-white shadow-premium border border-slate-200/60 rounded-xl text-slate-600 active:scale-95 transition-all hover:bg-slate-50"
        >
          <Menu size={20} />
        </button>

        {/* Global Refresh Button (Top Right) */}
        <button 
          onClick={handleGlobalRefresh}
          className="fixed top-4 right-4 z-[60] p-2 bg-white shadow-premium border border-slate-200/60 rounded-xl text-slate-600 active:scale-95 transition-all hover:bg-slate-50 hover:text-brand-600 group"
          title="Refresh Application"
        >
          <RefreshCw size={20} className={`${isRefreshing ? 'animate-spin text-brand-600' : 'group-hover:rotate-90 transition-transform duration-500'}`} />
        </button>

        <main className="flex-1 overflow-y-auto px-4 lg:px-10 py-6 pt-16 lg:pt-8 scroll-smooth no-scrollbar">
           <div className="max-w-7xl mx-auto">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
