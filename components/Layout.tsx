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
    <div className="h-screen bg-[#F1F5F9] flex overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-[70] lg:hidden backdrop-blur-md transition-all duration-500"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-[80] w-[290px] glass-card border-r border-slate-200/50 flex flex-col transform transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-24 flex items-center justify-between px-8 border-b border-slate-200/30">
           <Link to="/" className="flex items-center gap-4 group" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-12 h-12 bg-gradient-to-tr from-brand-700 to-brand-500 rounded-2xl flex items-center justify-center text-white shadow-3d group-hover:scale-110 transition-transform duration-300">
                <Package size={24} strokeWidth={2.5} />
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tighter">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-colors">
             <X size={28} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-8 space-y-10 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-3">
                <h3 className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                  {group.title}
                </h3>
                
                <div className="space-y-1.5">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      const isActive = location.pathname === item.path;
                      
                      return (
                        <Link
                          key={itemIdx}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-300 group relative overflow-hidden ${
                            isActive 
                              ? 'bg-brand-600 text-white shadow-3d translate-x-1' 
                              : 'text-slate-600 hover:bg-white hover:shadow-soft hover:translate-x-1'
                          }`}
                        >
                          <item.icon 
                            size={20} 
                            strokeWidth={isActive ? 2.5 : 2}
                            className={`transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-500'}`} 
                          />
                          <span>{item.label}</span>
                          {isActive && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white] animate-pulse" />
                          )}
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-6 border-t border-slate-200/30">
           <div className="relative">
             <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-4 p-3.5 rounded-3xl glass-card border border-white/60 hover:shadow-premium hover:-translate-y-1 transition-all text-left group"
             >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-black shadow-3d ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-brand-500'}`}>
                    {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-slate-900 truncate">{user.name}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{user.role}</p>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform duration-500 ${showUserMenu ? 'rotate-180 text-brand-500' : ''}`} />
             </button>

             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-4 bg-white rounded-3xl shadow-3d border border-slate-100 overflow-hidden animate-slide-up z-50 p-2">
                  <button onClick={onLogout} className="w-full text-left px-5 py-4 text-[14px] text-rose-600 hover:bg-rose-50 rounded-2xl flex items-center gap-4 font-black transition-all active:scale-95">
                     <LogOut size={20} /> Sign Out
                  </button>
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* MAIN SECTION */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Mobile Menu Toggle - Fixed with 3D shadow */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden fixed top-6 left-6 z-[60] w-14 h-14 bg-white/80 backdrop-blur-xl shadow-3d border border-white rounded-2xl text-slate-900 active:scale-90 transition-all flex items-center justify-center"
        >
          <Menu size={28} />
        </button>

        {/* MAIN CONTENT Area */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-12 py-8 pt-24 lg:pt-12 scroll-smooth no-scrollbar">
           <div className="max-w-7xl mx-auto pb-24">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;