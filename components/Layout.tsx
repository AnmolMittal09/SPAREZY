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
  Zap 
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

  return (
    <div className="h-screen bg-[#F8FAFC] flex overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-[70] lg:hidden backdrop-blur-sm transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[80] w-[280px] bg-white border-r border-slate-200 flex flex-col transform transition-all duration-300 ease-in-out ${
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
        
        {/* Mobile Menu Toggle - Absolute to avoid shifting layout */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden fixed top-6 left-6 z-[60] p-2.5 bg-white shadow-premium border border-slate-100 rounded-2xl text-slate-600 active:scale-90 transition-all hover:bg-slate-50"
        >
          <Menu size={24} />
        </button>

        {/* MAIN CONTENT Area - Now occupies the full height from the top */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-8 lg:py-8 pt-20 lg:pt-8 scroll-smooth no-scrollbar">
           <div className="max-w-7xl mx-auto">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;