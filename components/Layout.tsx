import React, { useState, useEffect } from 'react';
// @ts-ignore
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Role } from '../types';
import { 
  LayoutDashboard, 
  Package, 
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
      title: 'Operations',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Inventory', path: '/parts', icon: Package },
      ]
    },
    {
      title: 'Sales & Transactions',
      items: [
        { label: 'POS Terminal', path: '/billing', icon: Zap },
        { label: 'Tax Invoices', path: '/invoices', icon: FileText, requiredRole: Role.OWNER },
        { label: 'Stock Returns', path: '/billing?tab=return', icon: ArrowRightLeft },
      ]
    },
    {
      title: 'Inbound Management',
      items: [
        { label: 'Purchases', path: '/purchases', icon: ShoppingBag },
        { label: 'Requisitions', path: '/requisitions', icon: ClipboardList },
        { label: 'Admin Approvals', path: '/approvals', icon: CheckSquare, requiredRole: Role.OWNER },
      ]
    },
    {
      title: 'Administration',
      items: [
        { label: 'Stock Alerts', path: '/low-stock', icon: AlertTriangle },
        { label: 'Bulk Tools', path: '/import-export', icon: FileUp, requiredRole: Role.OWNER },
        { label: 'Analytics', path: '/reports', icon: BarChart3, requiredRole: Role.OWNER },
        { label: 'Settings', path: '/settings', icon: Settings, requiredRole: Role.OWNER },
      ]
    }
  ];

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[70] lg:hidden backdrop-blur-sm transition-all" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-[80] w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
           <Link to="/" className="flex items-center gap-3" onClick={() => setIsSidebarOpen(false)}>
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                <Package size={18} strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold tracking-tight">Sparezy</span>
           </Link>
           <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white">
             <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6 space-y-8 no-scrollbar">
           {navGroups.map((group, idx) => (
             <div key={idx} className="space-y-1">
                <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{group.title}</h3>
                <div className="space-y-0.5">
                   {group.items.map((item, itemIdx) => {
                      if (item.requiredRole && user.role !== item.requiredRole) return null;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={itemIdx}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                          <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                          <span>{item.label}</span>
                        </Link>
                      );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-4 border-t border-white/5">
           <div className="relative">
             <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-full flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${user.role === Role.OWNER ? 'bg-indigo-500' : 'bg-brand-500'}`}>{user.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{user.name}</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase">{user.role}</p>
                </div>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
             </button>
             {showUserMenu && (
               <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 rounded-xl shadow-xl border border-white/5 overflow-hidden p-1">
                  <button onClick={onLogout} className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-2 font-semibold transition-colors">
                     <LogOut size={14} /> Sign Out
                  </button>
               </div>
             )}
           </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-60">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600"><Menu size={20} /></button>
            <span className="font-bold text-slate-900">Sparezy</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs uppercase text-slate-500">{user.name.charAt(0)}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 no-scrollbar scroll-smooth">
           <div className="max-w-7xl mx-auto pb-12">{children}</div>
        </main>
      </div>
    </div>
  );
};
export default Layout;